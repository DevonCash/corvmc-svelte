import { env } from '$env/dynamic/private';
import { randomUUID } from 'crypto';

// ---------------------------------------------------------------------------
// Ultraloc API client
// ---------------------------------------------------------------------------
// Wraps the U-tec OpenAPI for managing temporary lock users.
// Uses OAuth2 client credentials flow with token caching.
//
// Required env vars:
//   ULTRALOC_CLIENT_ID
//   ULTRALOC_CLIENT_SECRET
//   ULTRALOC_DEVICE_ID
//   ULTRALOC_REDIRECT_URI  (used during initial OAuth setup)
// ---------------------------------------------------------------------------

const API_URL = 'https://api.u-tec.com/action';
const TOKEN_URL = 'https://oauth.u-tec.com/token';

let cachedToken: { accessToken: string; expiresAt: number } | null = null;

function getConfig() {
	const clientId = env.ULTRALOC_CLIENT_ID;
	const clientSecret = env.ULTRALOC_CLIENT_SECRET;
	const deviceId = env.ULTRALOC_DEVICE_ID;
	const refreshToken = env.ULTRALOC_REFRESH_TOKEN;

	if (!clientId || !clientSecret || !deviceId || !refreshToken) {
		throw new Error('Ultraloc environment variables not configured');
	}

	return { clientId, clientSecret, deviceId, refreshToken };
}

async function getAccessToken(): Promise<string> {
	if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
		return cachedToken.accessToken;
	}

	const { clientId, clientSecret, refreshToken } = getConfig();

	const res = await fetch(
		`${TOKEN_URL}?grant_type=refresh_token&client_id=${clientId}&client_secret=${clientSecret}&refresh_token=${refreshToken}`
	);

	if (!res.ok) {
		throw new Error(`Ultraloc token refresh failed: ${res.status} ${await res.text()}`);
	}

	const data = await res.json();
	cachedToken = {
		accessToken: data.access_token,
		expiresAt: Date.now() + data.expires_in * 1000
	};

	return cachedToken.accessToken;
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

	const body = await res.json();

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

/**
 * Create a temporary user on the lock with time-scoped access.
 * Returns the temporary user ID for later cleanup.
 */
export async function createTemporaryUser(params: TempUserParams): Promise<string> {
	const { deviceId } = getConfig();

	// Format times as Unix timestamps (seconds)
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

/**
 * Remove a temporary user from the lock.
 */
export async function removeTemporaryUser(tempUserId: string): Promise<void> {
	const { deviceId } = getConfig();

	await apiCall('Uhome.Device', 'RemoveUser', {
		deviceId,
		userId: tempUserId
	});
}
