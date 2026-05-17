import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { command } from '$app/server';
import { db } from '$lib/server/db';
import { user } from '$lib/server/db/schema/auth';
import { eq } from 'drizzle-orm';
import { requireStaff } from '$lib/server/authorization';
import {
	confirm,
	cancel,
	markComplete,
	markNoShow,
	recordCashAndComplete
} from '$lib/server/reservation/reservation-service';
import { recordCashPayment, refund } from '$lib/server/finance/payment-service';
import { HOURLY_RATE_CENTS } from '$lib/server/reservation/config';

const idSchema = z.object({ reservationId: z.string().min(1) });

export const confirmReservation = command(idSchema, async (data) => {
	await requireStaff();
	await confirm(data.reservationId);
	return { success: true };
});

export const completeReservation = command(idSchema, async (data) => {
	await requireStaff();
	await markComplete(data.reservationId);
	return { success: true };
});

export const noShowReservation = command(idSchema, async (data) => {
	await requireStaff();
	await markNoShow(data.reservationId);
	return { success: true };
});

export const cancelReservation = command(
	idSchema.extend({ reason: z.string().optional() }),
	async (data) => {
		const staff = await requireStaff();
		await cancel(data.reservationId, staff.id, data.reason, { staffOverride: true });
		return { success: true };
	}
);

export const compReservation = command(idSchema, async (data) => {
	await requireStaff();
	await confirm(data.reservationId);
	return { success: true };
});

export const refundReservation = command(
	idSchema.extend({
		userId: z.string().min(1),
		stripePaymentRecordId: z.string().min(1)
	}),
	async (data) => {
		await requireStaff();
		await refund({
			userId: data.userId,
			stripePaymentRecordId: data.stripePaymentRecordId
		});
		return { success: true };
	}
);

export const cashReceived = command(
	idSchema.extend({
		userId: z.string().min(1),
		startsAt: z.string(),
		endsAt: z.string()
	}),
	async (data) => {
		await requireStaff();
		const durationMs = new Date(data.endsAt).getTime() - new Date(data.startsAt).getTime();
		const durationHours = durationMs / (1000 * 60 * 60);
		const amountCents = Math.round(durationHours * HOURLY_RATE_CENTS);

		const [member] = await db
			.select({ stripeId: user.stripeId })
			.from(user)
			.where(eq(user.id, data.userId))
			.limit(1);

		if (!member?.stripeId) {
			throw error(400, 'Member has no Stripe customer ID');
		}

		const { paymentRecordId } = await recordCashPayment({
			userId: data.userId,
			stripeCustomerId: member.stripeId,
			amountCents,
			metadata: { reservation_id: data.reservationId }
		});

		await recordCashAndComplete(data.reservationId, paymentRecordId);
		return { success: true };
	}
);
