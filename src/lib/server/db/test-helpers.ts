import { mockUser } from './test-factory';

export function mockRequestEvent(opts?: {
	method?: string;
	url?: string;
	headers?: Record<string, string>;
	body?: FormData | string | Record<string, unknown>;
	params?: Record<string, string>;
	user?: Record<string, unknown> | null;
}) {
	const method = opts?.method ?? 'GET';
	const urlStr = opts?.url ?? 'http://localhost/test';
	const headers = new Headers(opts?.headers);

	let requestInit: RequestInit = { method, headers };

	if (opts?.body instanceof FormData) {
		requestInit.body = opts.body;
	} else if (typeof opts?.body === 'string') {
		requestInit.body = opts.body;
	} else if (opts?.body && typeof opts.body === 'object') {
		headers.set('Content-Type', 'application/json');
		requestInit.body = JSON.stringify(opts.body);
	}

	return {
		request: new Request(urlStr, requestInit),
		locals: {
			user: opts?.user === null ? null : (opts?.user ?? mockUser()),
			session: opts?.user === null ? null : { id: 'session-1' }
		},
		params: opts?.params ?? {},
		url: new URL(urlStr)
	};
}

export function formData(fields: Record<string, string>): FormData {
	const fd = new FormData();
	for (const [k, v] of Object.entries(fields)) {
		fd.append(k, v);
	}
	return fd;
}
