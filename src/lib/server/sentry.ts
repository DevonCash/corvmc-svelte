import { captureException as sentryCaptureException, isInitialized } from '@sentry/cloudflare';

export function captureException(err: unknown, context?: Record<string, unknown>) {
	if (!isInitialized()) {
		console.error(err);
		return;
	}
	sentryCaptureException(err, context ? { extra: context } : undefined);
}
