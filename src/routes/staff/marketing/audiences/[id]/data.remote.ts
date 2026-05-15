import { z } from 'zod';
import { query, command } from '$app/server';
import { getRequestEvent } from '$app/server';
import { requireStaff } from '$lib/server/authorization';
import {
	getAudience,
	updateAudience,
	deleteAudience,
	listSubscribers,
	addSubscriber,
	removeSubscriber,
	bulkAddMembers
} from '$lib/server/marketing/audience-service';
import { findOrCreateByEmail } from '$lib/server/marketing/subscriber-service';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getAudienceDetail = query(z.string(), async (id) => {
	await requireStaff();
	return getAudience(id);
});

export const getAudienceSubscribers = query(z.string(), async (audienceId) => {
	await requireStaff();
	return listSubscribers(audienceId);
});

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

const updateSchema = z.object({
	name: z.string().trim().min(1).max(255).optional(),
	description: z.string().trim().max(2000).optional(),
	allowOptIn: z.boolean().optional()
});

export const updateAudienceCommand = command(updateSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const id = params.id!;
	await updateAudience(id, data);
	void getAudienceDetail(id).refresh();
	return { success: true };
});

export const deleteAudienceCommand = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	await deleteAudience(params.id!);
	return { success: true };
});

const addSubscriberSchema = z.object({
	email: z.string().email().max(320),
	name: z.string().trim().max(255).optional()
});

export const addSubscriberCommand = command(addSubscriberSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const audienceId = params.id!;
	const sub = await findOrCreateByEmail(data.email, data.name);
	await addSubscriber(audienceId, sub.id);
	void getAudienceSubscribers(audienceId).refresh();
	void getAudienceDetail(audienceId).refresh();
	return { success: true };
});

const removeSubscriberSchema = z.object({ subscriberId: z.string().min(1) });

export const removeSubscriberCommand = command(removeSubscriberSchema, async (data) => {
	await requireStaff();
	const { params } = getRequestEvent();
	const audienceId = params.id!;
	await removeSubscriber(audienceId, data.subscriberId);
	void getAudienceSubscribers(audienceId).refresh();
	void getAudienceDetail(audienceId).refresh();
	return { success: true };
});

export const bulkAddMembersCommand = command(z.object({}), async () => {
	await requireStaff();
	const { params } = getRequestEvent();
	const audienceId = params.id!;
	const count = await bulkAddMembers(audienceId);
	void getAudienceSubscribers(audienceId).refresh();
	void getAudienceDetail(audienceId).refresh();
	return { added: count };
});
