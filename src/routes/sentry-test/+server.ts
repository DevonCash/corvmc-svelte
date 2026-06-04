import type { RequestHandler } from './$types';

// Temporary route to verify Sentry captures server errors in production.
// Hit GET /sentry-test on the deployed site, confirm the event appears in
// Sentry, then remove this file.
export const GET: RequestHandler = () => {
	throw new Error('Sentry production verification error');
};
