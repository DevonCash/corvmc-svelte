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

// Module scope, not per-`beforeEach`: on a cold Vite cache the first import pays
// the transform of this module graph inside the hook timeout and reports as a
// timeout rather than a slow build. Same reason as commit 75fd70a. These are the
// mocked modules, so the bindings are stable — `vi.resetAllMocks()` clears their
// recorded calls without replacing the function objects.
const { sendEmailWithTemplate } = (await import('./email/postmark-client')) as any;
const { createNotification } = (await import('./in-app-service')) as any;
const { getPreference } = (await import('./preference-service')) as any;
const { pushToUser } = (await import('./sse')) as any;
const { dispatch, dispatchEmailOnly } = (await import('./dispatcher')) as any;

describe('dispatch', () => {
	beforeEach(() => {
		vi.resetAllMocks();
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
	beforeEach(() => {
		vi.resetAllMocks();
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

// ---------------------------------------------------------------------------
// Model normalization (generic `notification` alias only)
// ---------------------------------------------------------------------------

describe('notification model normalization', () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	async function sentModel(model: Record<string, unknown>) {
		await dispatchEmailOnly({
			type: 'contact_form',
			toEmail: 'staff@example.com',
			templateAlias: 'notification',
			model
		});
		return sendEmailWithTemplate.mock.calls[0][0].model;
	}

	it('derives preview_text from the first paragraph when unset', async () => {
		const model = await sentModel({
			subject: 's',
			heading: 'Reservation Cancelled',
			paragraphs: [{ text: 'Your reservation has been cancelled.' }]
		});

		expect(model.preview_text).toBe('Your reservation has been cancelled.');
	});

	it('falls back to the heading when there are no paragraphs', async () => {
		const model = await sentModel({ subject: 's', heading: 'Reservation Cancelled' });

		expect(model.preview_text).toBe('Reservation Cancelled');
	});

	it('does not overwrite a preview_text the caller wrote', async () => {
		const model = await sentModel({
			subject: 's',
			heading: 'h',
			preview_text: 'May 21, 10:00 AM – 11:00 AM',
			paragraphs: [{ text: 'Generic opening line.' }]
		});

		expect(model.preview_text).toBe('May 21, 10:00 AM – 11:00 AM');
	});

	it('sets has_details only when there are rows', async () => {
		expect((await sentModel({ subject: 's', heading: 'h' })).has_details).toBe(false);

		vi.clearAllMocks();
		const withRows = await sentModel({
			subject: 's',
			heading: 'h',
			details: [{ label: 'Date', value: 'May 21' }]
		});
		expect(withRows.has_details).toBe(true);
	});

	it('escapes the quote and keeps a raw copy for the text part', async () => {
		const model = await sentModel({
			subject: 's',
			heading: 'h',
			quote: '<b>hi</b>\nsecond line'
		});

		expect(model.quote).toBe('&lt;b&gt;hi&lt;/b&gt;<br />second line');
		expect(model.quote_text).toBe('<b>hi</b>\nsecond line');
	});

	it('leaves models for other templates untouched', async () => {
		await dispatchEmailOnly({
			type: 'ticket_confirmation',
			toEmail: 'buyer@example.com',
			templateAlias: 'ticket-confirmation',
			model: { attendeeName: 'Ada' }
		});

		expect(sendEmailWithTemplate.mock.calls[0][0].model).toEqual({ attendeeName: 'Ada' });
	});
});
