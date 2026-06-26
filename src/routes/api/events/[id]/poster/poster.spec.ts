import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockUploadFile = vi.fn().mockResolvedValue('events/posters/evt-1.jpg');
const mockDeleteObject = vi.fn().mockResolvedValue(undefined);
const mockGetById = vi.fn();

// Keep the real validateUpload so the endpoint exercises real validation.
vi.mock('$lib/server/storage', async () => {
	const actual = await vi.importActual<typeof import('$lib/server/storage')>('$lib/server/storage');
	return {
		...actual,
		uploadFile: (...args: unknown[]) => mockUploadFile(...args),
		deleteObject: (...args: unknown[]) => mockDeleteObject(...args)
	};
});

vi.mock('$lib/server/authorization', () => ({
	hasAnyRole: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/server/event/event-service', () => ({
	getById: (...args: unknown[]) => mockGetById(...args)
}));

// db.update().set().where() chain — only reached on the happy path.
const whereSpy = vi.fn().mockResolvedValue(undefined);
vi.mock('$lib/server/db', () => ({
	db: {
		update: () => ({ set: () => ({ where: whereSpy }) })
	}
}));

vi.mock('$lib/server/db/schema/event', () => ({ event: {} }));

beforeEach(() => {
	vi.clearAllMocks();
	mockGetById.mockResolvedValue({
		id: 'evt-1',
		status: 'published',
		posterKey: 'events/posters/evt-1.jpg'
	});
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function req(file: File | null) {
	const fd = new FormData();
	if (file) fd.append('poster', file);
	return {
		params: { id: 'evt-1' },
		locals: { user: { id: 'user-1' } },
		request: new Request('http://localhost/api/events/evt-1/poster', {
			method: 'POST',
			body: fd
		})
	} as any;
}

// ASCII string of `size` bytes — its byte length equals its length, so the
// resulting File reports `size` exactly (validateUpload reads File.size).
function bytes(size: number): string {
	return 'a'.repeat(size);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/events/[id]/poster', () => {
	it('rejects an oversized file with 400 and leaves the existing poster untouched', async () => {
		const big = new File([bytes(11 * 1024 * 1024)], 'big.jpg', { type: 'image/jpeg' });

		const { POST } = await import('./+server');
		await expect(POST(req(big))).rejects.toMatchObject({ status: 400 });

		// Validation must run before any mutation — old poster not deleted, nothing uploaded.
		expect(mockDeleteObject).not.toHaveBeenCalled();
		expect(mockUploadFile).not.toHaveBeenCalled();
	});

	it('rejects a disallowed file type with 400 and does not delete or upload', async () => {
		const pdf = new File([bytes(1024)], 'doc.pdf', { type: 'application/pdf' });

		const { POST } = await import('./+server');
		await expect(POST(req(pdf))).rejects.toMatchObject({ status: 400 });

		expect(mockDeleteObject).not.toHaveBeenCalled();
		expect(mockUploadFile).not.toHaveBeenCalled();
	});

	it('uploads a valid file, replacing the old poster', async () => {
		const ok = new File([bytes(1024)], 'poster.png', { type: 'image/png' });

		const { POST } = await import('./+server');
		const res = await POST(req(ok));

		expect(res.status).toBe(200);
		expect(mockDeleteObject).toHaveBeenCalledWith('events/posters/evt-1.jpg');
		expect(mockUploadFile).toHaveBeenCalledOnce();
		expect(whereSpy).toHaveBeenCalled();
	});
});
