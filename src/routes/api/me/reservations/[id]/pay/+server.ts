import type { RequestHandler } from './$types';
import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import { getBalance } from '$lib/server/finance/credit-service';
import { checkout } from '$lib/server/finance/payment-service';
import { getProductConfig, buildLineItem } from '$lib/server/finance/product-config-service';

export const GET: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return error(401, 'Not authenticated');

	const [row] = await db
		.select()
		.from(reservation)
		.where(eq(reservation.id, params.id))
		.limit(1);

	if (!row) throw error(404, 'Reservation not found');
	if (row.createdByUserId !== locals.user.id) throw error(403, 'Not your reservation');
	if (row.status !== 'scheduled') throw error(400, 'This reservation is not awaiting payment');

	const rehearsalConfig = await getProductConfig('rehearsal');
	const hourlyRateCents = rehearsalConfig.unitAmountCents;

	const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);
	const freeHoursBalance = await getBalance(locals.user.id, 'free_hours');

	return json({
		reservation: {
			id: row.id,
			startsAt: row.startsAt.toISOString(),
			endsAt: row.endsAt.toISOString(),
			notes: row.notes
		},
		durationHours,
		totalCents,
		hourlyRateCents,
		freeHoursBalance
	});
};

export const POST: RequestHandler = async ({ params, locals, request }) => {
	if (!locals.user) return json({ error: 'Not authenticated' }, { status: 401 });

	const [row] = await db
		.select()
		.from(reservation)
		.where(eq(reservation.id, params.id))
		.limit(1);

	if (!row) return json({ error: 'Reservation not found' }, { status: 404 });
	if (row.createdByUserId !== locals.user.id) return json({ error: 'Not your reservation' }, { status: 403 });
	if (row.status !== 'scheduled') return json({ error: 'Not awaiting payment' }, { status: 400 });

	const formData = await request.formData();
	const coverFees = formData.get('coverFees') === 'on';
	const origin = (formData.get('origin') as string) || '';

	const rehearsalConfig = await getProductConfig('rehearsal');
	const hourlyRateCents = rehearsalConfig.unitAmountCents;

	const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
	const durationHours = durationMs / (1000 * 60 * 60);
	const totalCents = Math.round(durationHours * hourlyRateCents);

	const lineItem = await buildLineItem('rehearsal', totalCents, 1);

	const result = await checkout({
		stripeCustomerId: locals.user.stripeId ?? undefined,
		customerEmail: locals.user.email,
		userId: locals.user.id,
		mode: 'payment',
		lineItems: [lineItem],
		eligibleCredits: [{ type: 'free_hours', unitValueCents: hourlyRateCents }],
		coverFees,
		metadata: { reservation_id: row.id },
		successUrl: `${origin}/member/reservations`,
		cancelUrl: `${origin}/member/reservations/${row.id}/pay`
	});

	if (result.paid) {
		// Credits fully covered it — confirm the reservation directly
		await db
			.update(reservation)
			.set({
				status: 'confirmed',
				stripePaymentRecordId: result.stripePaymentRecordId ?? null,
				updatedAt: new Date()
			})
			.where(eq(reservation.id, row.id));

		return json({ success: true, redirectUrl: `${origin}/member/reservations` });
	}

	// Redirect to Stripe checkout
	return json({ redirectUrl: result.checkoutUrl! });
};
