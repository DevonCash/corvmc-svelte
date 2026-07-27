import { describe, it, expect, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/sveltekit';

// Importing hooks.client runs Sentry.init and registers a window listener at
// module scope — stub both out so the module loads cleanly in node.
vi.mock('@sentry/sveltekit', () => ({
	init: vi.fn(),
	replayIntegration: vi.fn(() => ({})),
	handleErrorWithSentry: <T>(handler: T) => handler
}));
vi.mock('$app/environment', () => ({ dev: false }));
vi.mock('$env/dynamic/public', () => ({ env: {} }));

import { isStaleChunkError, isNetworkAbortError, isWebviewBridgeError } from './hooks.client';

function eventWithTopFrame(fn: string | undefined): ErrorEvent {
	return {
		type: undefined,
		exception: {
			values: [
				{
					type: 'TypeError',
					stacktrace: {
						frames: [{ function: 'outerCaller' }, { function: fn }]
					}
				}
			]
		}
	} as unknown as ErrorEvent;
}

const emptyEvent = { type: undefined } as unknown as ErrorEvent;

describe('isWebviewBridgeError', () => {
	it('drops the Instagram webkit bridge crash (JAVASCRIPT-SVELTEKIT-1F)', () => {
		const err = new TypeError(
			"undefined is not an object (evaluating 'window.webkit.messageHandlers')"
		);
		expect(isWebviewBridgeError(eventWithTopFrame('sendDataToNative'), err)).toBe(true);
	});

	it('matches on the bridge message alone when no stacktrace is attached', () => {
		const err = new TypeError(
			"undefined is not an object (evaluating 'window.webkit.messageHandlers')"
		);
		expect(isWebviewBridgeError(emptyEvent, err)).toBe(true);
	});

	it('matches on a known bridge entry-point frame even with an unrelated message', () => {
		const err = new TypeError('undefined is not an object');
		expect(isWebviewBridgeError(eventWithTopFrame('sendPageHideMessage'), err)).toBe(true);
	});

	it('keeps genuine app errors', () => {
		const err = new TypeError("Cannot read properties of undefined (reading 'foo')");
		expect(isWebviewBridgeError(eventWithTopFrame('handleClick'), err)).toBe(false);
		expect(isWebviewBridgeError(emptyEvent, err)).toBe(false);
	});
});

describe('existing noise filters', () => {
	it('drops stale-deploy chunk failures', () => {
		expect(isStaleChunkError(new Error('error loading dynamically imported module'))).toBe(true);
		expect(isStaleChunkError(new Error('Importing a module script failed.'))).toBe(true);
		expect(isStaleChunkError(new Error('boom'))).toBe(false);
	});

	it('drops browser fetch aborts', () => {
		expect(isNetworkAbortError(new TypeError('Failed to fetch'))).toBe(true);
		expect(isNetworkAbortError(new Error('Load failed'))).toBe(true);
		expect(isNetworkAbortError(new Error('boom'))).toBe(false);
	});
});
