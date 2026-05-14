import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @aws-sdk/client-s3
// ---------------------------------------------------------------------------

const sendMock = vi.fn().mockResolvedValue({});

vi.mock('@aws-sdk/client-s3', () => {
	return {
		S3Client: class {
			send = sendMock;
		},
		PutObjectCommand: class {
			constructor(public input: unknown) {}
		},
		DeleteObjectCommand: class {
			constructor(public input: unknown) {}
		}
	};
});

// Mock env vars
vi.mock('$env/dynamic/private', () => ({
	env: {
		R2_ACCOUNT_ID: 'test-account',
		R2_ACCESS_KEY_ID: 'test-key',
		R2_SECRET_ACCESS_KEY: 'test-secret',
		R2_BUCKET_NAME: 'test-bucket',
		R2_PUBLIC_URL: 'https://pub.example.com',
		R2_TRANSFORM_URL: ''
	}
}));

import { uploadFile, deleteObject, getPublicUrl, isConfigured } from './storage';
import { env } from '$env/dynamic/private';

describe('storage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	// -----------------------------------------------------------------------
	// uploadFile
	// -----------------------------------------------------------------------

	describe('uploadFile', () => {
		it('uploads a valid JPEG file', async () => {
			const buffer = new ArrayBuffer(1024);
			const key = await uploadFile(buffer, 'test/img.jpg', 'image/jpeg');

			expect(key).toBe('test/img.jpg');
			expect(sendMock).toHaveBeenCalledOnce();
		});

		it('uploads a valid PNG file', async () => {
			const buffer = new ArrayBuffer(2048);
			const key = await uploadFile(buffer, 'test/img.png', 'image/png');
			expect(key).toBe('test/img.png');
		});

		it('uploads a valid WebP file', async () => {
			const buffer = new ArrayBuffer(512);
			const key = await uploadFile(buffer, 'test/img.webp', 'image/webp');
			expect(key).toBe('test/img.webp');
		});

		it('rejects disallowed content types', async () => {
			const buffer = new ArrayBuffer(100);

			await expect(uploadFile(buffer, 'test.pdf', 'application/pdf')).rejects.toThrow(
				'not allowed'
			);
			expect(sendMock).not.toHaveBeenCalled();
		});

		it('rejects files over 5MB', async () => {
			const buffer = new ArrayBuffer(6 * 1024 * 1024);

			await expect(uploadFile(buffer, 'big.jpg', 'image/jpeg')).rejects.toThrow(
				'exceeds the 5MB limit'
			);
			expect(sendMock).not.toHaveBeenCalled();
		});

		it('accepts files exactly at 5MB', async () => {
			const buffer = new ArrayBuffer(5 * 1024 * 1024);
			await expect(uploadFile(buffer, 'max.jpg', 'image/jpeg')).resolves.toBe('max.jpg');
		});
	});

	// -----------------------------------------------------------------------
	// deleteObject
	// -----------------------------------------------------------------------

	describe('deleteObject', () => {
		it('sends a delete command', async () => {
			await deleteObject('test/img.jpg');
			expect(sendMock).toHaveBeenCalledOnce();
		});
	});

	// -----------------------------------------------------------------------
	// getPublicUrl
	// -----------------------------------------------------------------------

	describe('getPublicUrl', () => {
		it('returns direct URL when R2_TRANSFORM_URL is not set', () => {
			const url = getPublicUrl('events/posters/evt-1.jpg');
			expect(url).toBe('https://pub.example.com/events/posters/evt-1.jpg');
		});

		it('returns transform URL when R2_TRANSFORM_URL is set', () => {
			(env as any).R2_TRANSFORM_URL = 'https://img.example.com';

			const url = getPublicUrl('events/posters/evt-1.jpg');
			expect(url).toBe(
				'https://img.example.com/width=1200,format=webp/events/posters/evt-1.jpg'
			);

			// Clean up
			(env as any).R2_TRANSFORM_URL = '';
		});
	});

	// -----------------------------------------------------------------------
	// isConfigured
	// -----------------------------------------------------------------------

	describe('isConfigured', () => {
		it('returns true when all required env vars are set', () => {
			expect(isConfigured()).toBe(true);
		});
	});
});
