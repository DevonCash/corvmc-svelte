import { z } from 'zod';
import { redirect, error } from '@sveltejs/kit';
import { form, getRequestEvent } from '$app/server';
import { db } from '$lib/server/db';
import { reservation } from '$lib/server/db/schema/reservation';
import { eq } from 'drizzle-orm';
import { checkout } from '$lib/server/finance/payment-service';
import { getProductConfig, buildLineItem } from '$lib/server/finance/product-config-service';

function requireUser() {
	const { locals } = getRequestEvent();
	if (!locals.user) throw error(401, 'Not authenticated');
	return locals.user;
}

export const pay = form(
	z.object({
		coverFees: z.literal('on').optional()
	}),
	async (data) => {
		const user = requireUser();
		const { params, url } = getRequestEvent();

		const [row] = await db
			.select()
			.from(reservation)
			.where(eq(reservation.id, params.id!))
			.limit(1);

		if (!row) throw error(404, 'Reservation not found');
		if (row.createdByUserId !== user.id) throw error(403, 'Not your reservation');
		if (row.status !== 'scheduled') throw error(400, 'Not awaiting payment');

		const rehearsalConfig = await getProductConfig('rehearsal');
		const hourlyRateCents = rehearsalConfig.unitAmountCents;

		const durationMs = row.endsAt.getTime() - row.startsAt.getTime();
		const durationHours = durationMs / (1000 * 60 * 60);
		const totalCents = Math.round(durationHours * hourlyRateCents);

		const lineItem = await buildLineItem('rehearsal', totalCents, 1);

		const result = await checkout({
			stripeCustomerId: user.stripeId ?? undefined,
			userId: user.id,
			mode: 'payment',
			lineItems: [lineItem],
			eligibleCredits: [{ type: 'free_hours', unitValueCents: hourlyRateCents }],
			coverFees: data.coverFees === 'on',
			metadata: { reservation_id: row.id },
			successUrl: `${url.origin}/member/reservations`,
			cancelUrl: `${url.origin}/member/reservations/${row.id}/pay`
		});

		if (result.paid) {
			await db
				.update(reservation)
				.set({
					status: 'confirmed',
					stripePaymentRecordId: result.stripePaymentRecordId ?? null,
					updatedAt: new Date()
				})
				.where(eq(reservation.id, row.id));

			redirect(303, '/member/reservations');
		}

		redirect(303, result.checkoutUrl!);
	}
);
