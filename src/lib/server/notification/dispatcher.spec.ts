import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./email/postmark-client', () => ({ sendEmailWithTemplate: vi.fn() }));
vi.mock('./in-app-service', () => ({ createNotification: vi.fn() }));
vi.mock('./preference-service', () => ({ getPreference: vi.fn() }));
vi.mock('./sse', () => ({ pushToUser: vi.fn() }));

const EMAIL_TEMPLATE = {
	alias: 'reservation-reminder',
	model: { userName: 'Ada', date: '2026-02-01' }
};

const BASE_PARAMS = {
	type: 'reservation.confirmed',
	userId: 'user-1',
	userEmail: 'user@example.com',
	title: 'Reservation Confirmed',
	body: 'Your reservation has been confirmed.',
	href: '/reservations/1',
	emailTemplate: EMAIL_TEMPLATE
};

const FAKE_ROW = {
	id: 'notif-1',
	type: BASE_PARAMS.type,
	title: BASE_PARAMS.title,
	body: BASE_PARAMS.body,
	href: BASE_PARAMS.href,
	createdAt: new Date('2026-01-01T00:00:00Z')
};

describe('dispatch', () => {
	let sendEmailWithTemplate: ReturnType<typeof vi.fn>;
	let createNotification: ReturnType<typeof vi.fn>;
	let getPreference: ReturnType<typeof vi.fn>;
	let pushToUser: ReturnType<typeof vi.fn>;
	let dispatch: (params: any) => Promise<void>;

	beforeEach(async () => {
		vi.resetAllMocks();

		sendEmailWithTemplate = (await import('./email/postmark-client'))
			.sendEmailWithTemplate as unknown as ReturnType<typeof vi.fn>;
		createNotification = (await import('./in-app-service'))
			.createNotification as unknown as ReturnType<typeof vi.fn>;
		getPreference = (await import('./preference-service')).getPreference as unknown as ReturnType<
			typeof vi.fn
		>;
		pushToUser = (await import('./sse')).pushToUser as unknown as ReturnType<typeof vi.fn>;
		dispatch = (await import('./dispatcher')).dispatch as any;

		createNotification.mockResolvedValue(FAKE_ROW);
	});

	it('sends in-app notification and SSE push when pref.inApp is true', async () => {
		getPreference.mockResolvedValue({ email: false, inApp: true });

		await dispatch({ ...BASE_PARAMS, emailTemplate: undefined });

		expect(createNotification).toHaveBeenCalledWith({
			userId: BASE_PARAMS.userId,
			type: BASE_PARAMS.type,
			title: BASE_PARAMS.title,
			body: BASE_PARAMS.body,
			href: BASE_PARAMS.href,
			data: undefined
		});
		expect(pushToUser).toHaveBeenCalledWith(BASE_PARAMS.userId, {
			id: FAKE_ROW.id,
			type: FAKE_ROW.type,
			title: FAKE_ROW.title,
			body: FAKE_ROW.body,
			href: FAKE_ROW.href,
			createdAt: FAKE_ROW.createdAt.toISOString()
		});
	});

	it('sends templated email when pref.email is true and a template is provided', async () => {
		getPreference.mockResolvedValue({ email: true, inApp: false });

		await dispatch(BASE_PARAMS);

		expect(sendEmailWithTemplate).toHaveBeenCalledWith({
			to: BASE_PARAMS.userEmail,
			templateAlias: EMAIL_TEMPLATE.alias,
			model: EMAIL_TEMPLATE.model,
			tag: BASE_PARAMS.type
		});
	});

	it('skips email when no emailTemplate', async () => {
		getPreference.mockResolvedValue({ email: true, inApp: false });

		await dispatch({ ...BASE_PARAMS, emailTemplate: undefined });

		expect(sendEmailWithTemplate).not.toHaveBeenCalled();
	});

	it('sends email via forceEmail even when pref.email is false', async () => {
		getPreference.mockResolvedValue({ email: false, inApp: false });

		await dispatch({ ...BASE_PARAMS, forceEmail: true });

		expect(sendEmailWithTemplate).toHaveBeenCalledWith({
			to: BASE_PARAMS.userEmail,
			templateAlias: EMAIL_TEMPLATE.alias,
			model: EMAIL_TEMPLATE.model,
			tag: BASE_PARAMS.type
		});
	});

	it('skips in-app notification and SSE when pref.inApp is false', async () => {
		getPreference.mockResolvedValue({ email: false, inApp: false });

		await dispatch(BASE_PARAMS);

		expect(createNotification).not.toHaveBeenCalled();
		expect(pushToUser).not.toHaveBeenCalled();
	});

	it('logs error but does not throw if createNotification fails', async () => {
		getPreference.mockResolvedValue({ email: false, inApp: true });
		createNotification.mockRejectedValue(new Error('DB error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(dispatch({ ...BASE_PARAMS, emailTemplate: undefined })).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
		consoleSpy.mockRestore();
	});

	it('logs error but does not throw if sendEmailWithTemplate fails', async () => {
		getPreference.mockResolvedValue({ email: true, inApp: false });
		sendEmailWithTemplate.mockRejectedValue(new Error('Postmark error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(dispatch(BASE_PARAMS)).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
		consoleSpy.mockRestore();
	});
});

describe('dispatchEmailOnly', () => {
	let sendEmailWithTemplate: ReturnType<typeof vi.fn>;
	let dispatchEmailOnly: (params: any) => Promise<void>;

	beforeEach(async () => {
		vi.resetAllMocks();

		sendEmailWithTemplate = (await import('./email/postmark-client'))
			.sendEmailWithTemplate as unknown as ReturnType<typeof vi.fn>;
		dispatchEmailOnly = (await import('./dispatcher')).dispatchEmailOnly as any;
	});

	it('sends a templated email with the provided params', async () => {
		sendEmailWithTemplate.mockResolvedValue(undefined);

		await dispatchEmailOnly({
			type: 'ticket.purchased',
			toEmail: 'buyer@example.com',
			templateAlias: 'ticket-confirmation',
			model: { attendeeName: 'Ada' }
		});

		expect(sendEmailWithTemplate).toHaveBeenCalledWith({
			to: 'buyer@example.com',
			templateAlias: 'ticket-confirmation',
			model: { attendeeName: 'Ada' },
			tag: 'ticket.purchased'
		});
	});

	it('logs error but does not throw on send failure', async () => {
		sendEmailWithTemplate.mockRejectedValue(new Error('Network error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			dispatchEmailOnly({
				type: 'ticket.purchased',
				toEmail: 'buyer@example.com',
				templateAlias: 'ticket-confirmation',
				model: {}
			})
		).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalledWith(expect.any(Error));
		consoleSpy.mockRestore();
	});
});
