import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';
import { getJson, putJson } from '$lib/server/kv';
import { getConfigsByPrefix } from '$lib/server/site-config/site-config-service';

// ---------------------------------------------------------------------------
// Ultraloc API client
// ---------------------------------------------------------------------------
// Wraps the U-tec OpenAPI for managing temporary lock users.
// Uses OAuth2 client credentials flow with token caching.
//
// Credentials are read from site_config (admin UI), falling back to env vars.
// ---------------------------------------------------------------------------

const API_URL = 'https://api.u-tec.com/action';
const TOKEN_URL = 'https://oauth.u-tec.com/token';

const TOKEN_KEY = 'ultraloc:token';

async function getConfig() {
	const dbConfig = await getConfigsByPrefix('integration.utec');

	const clientId = (dbConfig.clientId as string) || env.ULTRALOC_CLIENT_ID;
	const clientSecret = (dbConfig.clientSecret as string) || env.ULTRALOC_CLIENT_SECRET;
	const deviceId = (dbConfig.deviceId as string) || env.ULTRALOC_DEVICE_ID;
	const refreshToken = (dbConfig.refreshToken as string) || env.ULTRALOC_REFRESH_TOKEN;

	if (!clientId || !clientSecret || !deviceId || !refreshToken) {
		throw new Error('Ultraloc credentials not configured — set them in Staff Settings > Integrations or via environment variables');
	}

	return { clientId, clientSecret, deviceId, refreshToken };
}

async function getAccessToken(): Promise<string> {
	const cached = await getJson<{ accessToken: string; expiresAt: number }>(TOKEN_KEY);
	if (cached && Date.now() < cached.expiresAt - 60_000) {
		return cached.accessToken;
	}

	const { clientId, clientSecret, refreshToken } = await getConfig();

	const res = await fetch(
		`${TOKEN_URL}?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`
	);

	if (!res.ok) {
		throw new Error(`Ultraloc token refresh failed: ${res.status} ${await res.text()}`);
	}

	const data: { access_token: string; expires_in: number } = await res.json();
	const expiresAt = Date.now() + data.expires_in * 1000;
	const ttlSeconds = Math.max(Math.floor(data.expires_in - 60), 60);

	await putJson(TOKEN_KEY, { accessToken: data.access_token, expiresAt }, ttlSeconds);

	return data.access_token;
}

async function apiCall(namespace: string, name: string, payload: Record<string, unknown>): Promise<any> {
	const token = await getAccessToken();

	const res = await fetch(API_URL, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify({
			header: {
				namespace,
				name,
				messageId: randomUUID(),
				payloadVersion: '1'
			},
			payload
		})
	});

	if (!res.ok) {
		throw new Error(`Ultraloc API error: ${res.status} ${await res.text()}`);
	}

	const body: { payload: { error?: { code: string; message: string } } & Record<string, unknown> } = await res.json();

	if (body.payload?.error) {
		throw new Error(`Ultraloc API error: ${body.payload.error.code} — ${body.payload.error.message}`);
	}

	return body.payload;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface TempUserParams {
	name: string;
	startTime: Date;
	endTime: Date;
}

export async function createTemporaryUser(params: TempUserParams): Promise<string> {
	const { deviceId } = await getConfig();

	const startTimestamp = Math.floor(params.startTime.getTime() / 1000);
	const endTimestamp = Math.floor(params.endTime.getTime() / 1000);

	const result = await apiCall('Uhome.Device', 'AddUser', {
		deviceId,
		user: {
			name: params.name,
			type: 'temporary',
			startTime: startTimestamp,
			endTime: endTimestamp
		}
	});

	return result.user?.id ?? result.userId ?? randomUUID();
}

export async function removeTemporaryUser(tempUserId: string): Promise<void> {
	const { deviceId } = await getConfig();

	await apiCall('Uhome.Device', 'RemoveUser', {
		deviceId,
		userId: tempUserId
	});
}

// ---------------------------------------------------------------------------
// Connection test — used by the settings page
// ---------------------------------------------------------------------------

export async function testConnection(): Promise<{ ok: boolean; error?: string }> {
	try {
		const { clientId, clientSecret, refreshToken } = await getConfig();

		const res = await fetch(
			`${TOKEN_URL}?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`
		);

		if (!res.ok) {
			const text = await res.text();
			return { ok: false, error: `Token refresh failed (${res.status}): ${text}` };
		}

		const data: { access_token: string } = await res.json();
		if (!data.access_token) {
			return { ok: false, error: 'No access token in response' };
		}

		return { ok: true };
	} catch (err) {
		return { ok: false, error: (err as Error).message };
	}
}
