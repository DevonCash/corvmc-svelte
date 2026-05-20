import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./email/postmark-client', () => ({ sendEmail: vi.fn() }));
vi.mock('./in-app-service', () => ({ createNotification: vi.fn() }));
vi.mock('./preference-service', () => ({ getPreference: vi.fn() }));
vi.mock('./sse', () => ({ pushToUser: vi.fn() }));

const BASE_PARAMS = {
	type: 'reservation.confirmed',
	userId: 'user-1',
	userEmail: 'user@example.com',
	title: 'Reservation Confirmed',
	body: 'Your reservation has been confirmed.',
	href: '/reservations/1',
	emailSubject: 'Reservation Confirmed',
	emailHtml: '<p>Confirmed</p>'
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
	let sendEmail: ReturnType<typeof vi.fn>;
	let createNotification: ReturnType<typeof vi.fn>;
	let getPreference: ReturnType<typeof vi.fn>;
	let pushToUser: ReturnType<typeof vi.fn>;
	let dispatch: (params: any) => Promise<void>;

	beforeEach(async () => {
		vi.resetAllMocks();

		sendEmail = (await import('./email/postmark-client')).sendEmail as unknown as ReturnType<typeof vi.fn>;
		createNotification = (await import('./in-app-service')).createNotification as unknown as ReturnType<typeof vi.fn>;
		getPreference = (await import('./preference-service')).getPreference as unknown as ReturnType<typeof vi.fn>;
		pushToUser = (await import('./sse')).pushToUser as unknown as ReturnType<typeof vi.fn>;
		dispatch = (await import('./dispatcher')).dispatch as any;

		createNotification.mockResolvedValue(FAKE_ROW);
	});

	it('sends in-app notification and SSE push when pref.inApp is true', async () => {
		getPreference.mockResolvedValue({ email: false, inApp: true });

		await dispatch({ ...BASE_PARAMS, emailSubject: undefined, emailHtml: undefined });

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

	it('sends email when pref.email is true and email content is provided', async () => {
		getPreference.mockResolvedValue({ email: true, inApp: false });

		await dispatch(BASE_PARAMS);

		expect(sendEmail).toHaveBeenCalledWith({
			to: BASE_PARAMS.userEmail,
			subject: BASE_PARAMS.emailSubject,
			htmlBody: BASE_PARAMS.emailHtml,
			tag: BASE_PARAMS.type
		});
	});

	it('skips email when no emailSubject or emailHtml', async () => {
		getPreference.mockResolvedValue({ email: true, inApp: false });

		await dispatch({ ...BASE_PARAMS, emailSubject: undefined, emailHtml: undefined });

		expect(sendEmail).not.toHaveBeenCalled();
	});

	it('sends email via forceEmail even when pref.email is false', async () => {
		getPreference.mockResolvedValue({ email: false, inApp: false });

		await dispatch({ ...BASE_PARAMS, forceEmail: true });

		expect(sendEmail).toHaveBeenCalledWith({
			to: BASE_PARAMS.userEmail,
			subject: BASE_PARAMS.emailSubject,
			htmlBody: BASE_PARAMS.emailHtml,
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

		await expect(
			dispatch({ ...BASE_PARAMS, emailSubject: undefined, emailHtml: undefined })
		).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.any(Error)
		);
		consoleSpy.mockRestore();
	});

	it('logs error but does not throw if sendEmail fails', async () => {
		getPreference.mockResolvedValue({ email: true, inApp: false });
		sendEmail.mockRejectedValue(new Error('SMTP error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(dispatch(BASE_PARAMS)).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.any(Error)
		);
		consoleSpy.mockRestore();
	});
});

describe('dispatchEmailOnly', () => {
	let sendEmail: ReturnType<typeof vi.fn>;
	let dispatchEmailOnly: (params: any) => Promise<void>;

	beforeEach(async () => {
		vi.resetAllMocks();

		sendEmail = (await import('./email/postmark-client')).sendEmail as unknown as ReturnType<typeof vi.fn>;
		dispatchEmailOnly = (await import('./dispatcher')).dispatchEmailOnly as any;
	});

	it('sends email with the provided params', async () => {
		sendEmail.mockResolvedValue(undefined);

		await dispatchEmailOnly({
			type: 'ticket.purchased',
			toEmail: 'buyer@example.com',
			subject: 'Your Ticket',
			html: '<p>Thanks!</p>'
		});

		expect(sendEmail).toHaveBeenCalledWith({
			to: 'buyer@example.com',
			subject: 'Your Ticket',
			htmlBody: '<p>Thanks!</p>',
			tag: 'ticket.purchased'
		});
	});

	it('logs error but does not throw on sendEmail failure', async () => {
		sendEmail.mockRejectedValue(new Error('Network error'));
		const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

		await expect(
			dispatchEmailOnly({
				type: 'ticket.purchased',
				toEmail: 'buyer@example.com',
				subject: 'Your Ticket',
				html: '<p>Thanks!</p>'
			})
		).resolves.toBeUndefined();

		expect(consoleSpy).toHaveBeenCalledWith(
			expect.any(Error)
		);
		consoleSpy.mockRestore();
	});
});
