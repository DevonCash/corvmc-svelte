import { db } from '$lib/server/db';
import { inboxChannelConfig } from '$lib/server/db/schema/inbox';
import { eq } from 'drizzle-orm';
import { inboxChannels } from '$lib/config';
import type { InboxChannel } from '$lib/server/db/schema/inbox';

export interface ChannelConfigRow {
	channel: InboxChannel;
	enabled: boolean;
	config: Record<string, unknown>;
}

export async function getAllChannelConfigs(): Promise<ChannelConfigRow[]> {
	const rows = await db.select().from(inboxChannelConfig);
	const byChannel = new Map(rows.map((r) => [r.channel, r]));

	return inboxChannels.map((ch) => {
		const row = byChannel.get(ch);
		return {
			channel: ch,
			enabled: ch === 'web' ? true : (row?.enabled ?? false),
			config: (row?.config as Record<string, unknown>) ?? {}
		};
	});
}

export async function getChannelConfig(channel: InboxChannel): Promise<ChannelConfigRow> {
	if (channel === 'web') {
		return { channel, enabled: true, config: {} };
	}

	const [row] = await db
		.select()
		.from(inboxChannelConfig)
		.where(eq(inboxChannelConfig.channel, channel))
		.limit(1);

	return {
		channel,
		enabled: row?.enabled ?? false,
		config: (row?.config as Record<string, unknown>) ?? {}
	};
}

export async function isChannelEnabled(channel: InboxChannel): Promise<boolean> {
	if (channel === 'web') return true;

	const [row] = await db
		.select({ enabled: inboxChannelConfig.enabled })
		.from(inboxChannelConfig)
		.where(eq(inboxChannelConfig.channel, channel))
		.limit(1);

	return row?.enabled ?? false;
}

export async function getEnabledChannels(): Promise<InboxChannel[]> {
	const configs = await getAllChannelConfigs();
	return configs.filter((c) => c.enabled).map((c) => c.channel);
}

export async function updateChannelConfig(channel: InboxChannel, enabled: boolean): Promise<void> {
	const [existing] = await db
		.select()
		.from(inboxChannelConfig)
		.where(eq(inboxChannelConfig.channel, channel))
		.limit(1);

	if (existing) {
		await db
			.update(inboxChannelConfig)
			.set({ enabled, updatedAt: new Date() })
			.where(eq(inboxChannelConfig.channel, channel));
	} else {
		await db.insert(inboxChannelConfig).values({ channel, enabled });
	}
}
