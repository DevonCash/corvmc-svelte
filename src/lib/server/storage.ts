import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';

// ---------------------------------------------------------------------------
// R2 Storage — S3-compatible object storage via Cloudflare R2
// ---------------------------------------------------------------------------
// Lazily initialized so the app doesn't crash if R2 env vars aren't set
// (e.g., local dev without R2).
// ---------------------------------------------------------------------------

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

let client: S3Client | null = null;

function getClient(): S3Client {
	if (client) return client;

	const accountId = env.R2_ACCOUNT_ID;
	const accessKeyId = env.R2_ACCESS_KEY_ID;
	const secretAccessKey = env.R2_SECRET_ACCESS_KEY;

	if (!accountId || !accessKeyId || !secretAccessKey) {
		throw new Error('R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY');
	}

	client = new S3Client({
		region: 'auto',
		endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey }
	});

	return client;
}

function getBucket(): string {
	const bucket = env.R2_BUCKET_NAME;
	if (!bucket) throw new Error('R2_BUCKET_NAME is not set');
	return bucket;
}

// ---------------------------------------------------------------------------
// uploadFile — validate and upload to R2
// ---------------------------------------------------------------------------

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

	await getClient().send(
		new PutObjectCommand({
			Bucket: getBucket(),
			Key: key,
			Body: new Uint8Array(buffer),
			ContentType: contentType
		})
	);

	return key;
}

// ---------------------------------------------------------------------------
// deleteObject — remove from R2 (no-ops if missing)
// ---------------------------------------------------------------------------

export async function deleteObject(key: string): Promise<void> {
	await getClient().send(
		new DeleteObjectCommand({
			Bucket: getBucket(),
			Key: key
		})
	);
}

// ---------------------------------------------------------------------------
// getPublicUrl — returns the public URL, using transforms if configured
// ---------------------------------------------------------------------------

export function getPublicUrl(key: string): string {
	const transformUrl = env.R2_TRANSFORM_URL;
	if (transformUrl) {
		return `${transformUrl}/width=1200,format=webp/${key}`;
	}

	const publicUrl = env.R2_PUBLIC_URL;
	if (!publicUrl) throw new Error('R2_PUBLIC_URL is not set');
	return `${publicUrl}/${key}`;
}

// ---------------------------------------------------------------------------
// isConfigured — check if R2 is available (for graceful degradation)
// ---------------------------------------------------------------------------

export function isConfigured(): boolean {
	return !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID && env.R2_SECRET_ACCESS_KEY && env.R2_BUCKET_NAME);
}
