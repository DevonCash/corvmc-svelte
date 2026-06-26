import { env } from '$env/dynamic/private';

export const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const MAX_SIZE_LABEL = `${Math.round(MAX_SIZE_BYTES / 1024 / 1024)}MB`;

/**
 * Validate an upload's type and size. Returns a human-readable reason when the
 * file is invalid, or `null` when it's acceptable. Callers should surface the
 * reason as a 4xx so it isn't treated as a server bug (see hooks.server.ts).
 */
export function validateUpload(file: File): string | null {
	if (!ALLOWED_TYPES.includes(file.type)) {
		return `File type "${file.type}" is not allowed. Accepted: ${ALLOWED_TYPES.join(', ')}`;
	}
	if (file.size > MAX_SIZE_BYTES) {
		return `File size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds the ${MAX_SIZE_LABEL} limit`;
	}
	return null;
}

let _bucket: R2Bucket;

export function initStorage(bucket: R2Bucket) {
	_bucket = bucket;
}

function getBucket(): R2Bucket {
	if (!_bucket)
		throw new Error('Storage not initialized — call initStorage() in hooks.server.ts first');
	return _bucket;
}

export async function uploadFile(
	buffer: ArrayBuffer,
	key: string,
	contentType: string
): Promise<string> {
	if (!ALLOWED_TYPES.includes(contentType)) {
		throw new Error(
			`File type "${contentType}" is not allowed. Accepted: ${ALLOWED_TYPES.join(', ')}`
		);
	}

	if (buffer.byteLength > MAX_SIZE_BYTES) {
		throw new Error(
			`File size ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB exceeds the ${MAX_SIZE_LABEL} limit`
		);
	}

	await getBucket().put(key, buffer, {
		httpMetadata: { contentType }
	});

	return key;
}

export async function deleteObject(key: string): Promise<void> {
	await getBucket().delete(key);
}

export function getPublicUrl(key: string): string {
	if (/^https?:\/\//i.test(key)) return key; // already resolved — don't double-prefix

	const transformUrl = env.R2_TRANSFORM_URL;
	if (transformUrl) {
		return `${transformUrl}/width=1200,format=webp/${key}`;
	}

	const publicUrl = env.R2_PUBLIC_URL;
	if (!publicUrl) throw new Error('R2_PUBLIC_URL is not set');
	return `${publicUrl}/${key}`;
}

/**
 * Resolve an R2 key to a public URL, returning null if not available.
 * Convenience wrapper for optional image keys stored on models.
 */
export function resolveImageUrl(key: string | null | undefined): string | null {
	if (!key) return null;
	if (!_bucket) return null;
	try {
		return getPublicUrl(key);
	} catch {
		return null;
	}
}

export function isConfigured(): boolean {
	return !!_bucket;
}
