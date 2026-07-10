import { describe, expect, it, vi, beforeEach } from 'vitest';
import * as Sentry from '@sentry/sveltekit';
import { reportError } from './report-error';

vi.mock('@sentry/sveltekit', () => ({
	captureException: vi.fn()
}));

describe('reportError', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, 'error').mockImplementation(() => {});
	});

	it('reports genuine client-side errors', () => {
		const err = new TypeError('Cannot read properties of undefined');
		reportError(err);
		expect(Sentry.captureException).toHaveBeenCalledWith(err, undefined);
	});

	it('reports errors without an HTTP status, passing context as extras', () => {
		const err = new Error('fetch failed');
		reportError(err, { where: 'uploadAvatar' });
		expect(Sentry.captureException).toHaveBeenCalledWith(err, {
			extra: { where: 'uploadAvatar' }
		});
	});

	it('drops expected 4xx HTTP failures', () => {
		reportError({ status: 404, body: { message: 'Not Found' } });
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});

	// Regression test for JAVASCRIPT-SVELTEKIT-D: a remote-function 500 surfaces
	// client-side as a bare `{ status, body }` object. Capturing it produced a
	// useless "x"-titled Sentry issue duplicating the server-side capture, which
	// already has the request context. HTTP-shaped failures must not re-report.
	it('drops 5xx HTTP failures already captured server-side (JAVASCRIPT-SVELTEKIT-D)', () => {
		reportError({ status: 500, body: { message: 'Internal Error' } });
		expect(Sentry.captureException).not.toHaveBeenCalled();
	});
});
