import { error, fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import { getBalance } from '$lib/server/finance/credit-service';
import { checkout } from '$lib/server/finance/payment-service';
import { getProductConfig, buildLineItem } from '$lib/server/finance/product-config-service';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	if (!locals.user) return redirect(302, '/demo/better-auth/login');

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

	return {
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
	};
};

export const actions: Actions = {
	pay: async ({ params, locals, url, request }) => {
		if (!locals.user) return fail(401, { error: 'Not authenticated' });

		const [row] = await db
			.select()
			.from(reservation)
			.where(eq(reservation.id, params.id))
			.limit(1);

		if (!row) return fail(404, { error: 'Reservation not found' });
		if (row.createdByUserId !== locals.user.id) return fail(403, { error: 'Not your reservation' });
		if (row.status !== 'scheduled') return fail(400, { error: 'Not awaiting payment' });

		const formData = await request.formData();
		const coverFees = formData.get('coverFees') === 'on';

		const rehearsalConfig = await getProductConfig('rehearsal');
		const hourlyRateCents = rehearsalConfig.unitAmountCents;

		const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
		const durationHours = durationMs / (1000 * 60 * 60);
		const totalCents = Math.round(durationHours * hourlyRateCents);

		const lineItem = await buildLineItem('rehearsal', totalCents, 1);

		const result = await checkout({
			stripeCustomerId: locals.user.stripeId ?? undefined,
			userId: locals.user.id,
			mode: 'payment',
			lineItems: [lineItem],
			eligibleCredits: [{ type: 'free_hours', unitValueCents: hourlyRateCents }],
			coverFees,
			metadata: { reservation_id: row.id },
			successUrl: `${url.origin}/member/reservations`,
			cancelUrl: `${url.origin}/member/reservations/${row.id}/pay`
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

			return redirect(303, '/member/reservations');
		}

		// Redirect to Stripe checkout
		return redirect(303, result.checkoutUrl!);
	}
};
