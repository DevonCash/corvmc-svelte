import { env } from '$env/dynamic/private';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

let _bucket: R2Bucket;

export function initStorage(bucket: R2Bucket) {
	_bucket = bucket;
}

function getBucket(): R2Bucket {
	if (!_bucket) throw new Error('Storage not initialized — call initStorage() in hooks.server.ts first');
	return _bucket;
}

export async function uploadFile(
	buffer: ArrayBuffer,
	key: string,
	contentType: string
): Promise<string> {
	if (!ALLOWED_TYPES.includes(contentType)) {
		throw new Error(`File type "${contentType}" is not allowed. Accepted: ${ALLOWED_TYPES.join(', ')}`);
	}

	if (buffer.byteLength > MAX_SIZE_BYTES) {
		throw new Error(`File size ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB exceeds the 5MB limit`);
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
	const transformUrl = env.R2_TRANSFORM_URL;
	if (transformUrl) {
		return `${transformUrl}/width=1200,format=webp/${key}`;
	}

	const publicUrl = env.R2_PUBLIC_URL;
	if (!publicUrl) throw new Error('R2_PUBLIC_URL is not set');
	return `${publicUrl}/${key}`;
}

export function isConfigured(): boolean {
	return !!_bucket;
}
