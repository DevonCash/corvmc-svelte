import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form } from '$app/server';
import { requireUser } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';
import { requireBandAdmin } from '$lib/server/band/band-context';
import { getBySlug } from '$lib/server/band/band-service';
import { sanitizeCss } from '$lib/server/band/css-sanitizer';
import { db } from '$lib/server/db';
import { bandPageConfig, bandPageConfigSchema, type Block } from '$lib/server/db/schema/band-page';
import { eq } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export const getBandPageEditor = query(z.string(), async (slug) => {
	await requireFeature('bandPremium');
	requireUser();
	const band = await getBySlug(slug);
	if (!band) throw error(404, 'Band not found');

	const [config] = await db
		.select()
		.from(bandPageConfig)
		.where(eq(bandPageConfig.bandId, band.id))
		.limit(1);

	return {
		config: config
			? {
					theme: config.theme,
					customCss: config.customCss,
					blocks: config.blocks as Block[],
					epk: config.epk
				}
			: null
	};
});

// ---------------------------------------------------------------------------
// Forms
// ---------------------------------------------------------------------------

export const saveBandPageConfig = form(
	z.object({
		slug: z.string().min(1),
		theme: z.string().optional(),
		customCss: z.string().max(51200).optional(),
		blocks: z.string().optional() // JSON-encoded blocks array
	}),
	async (data) => {
		const { band } = await requireBandAdmin();

		if (band.tier !== 'premium') {
			throw error(403, 'Premium subscription required');
		}

		// Parse blocks if provided
		let blocks: Block[] | undefined;
		if (data.blocks) {
			try {
				const parsed = JSON.parse(data.blocks);
				// Validate with schema
				const result = bandPageConfigSchema.shape.blocks.safeParse(parsed);
				if (!result.success) {
					throw error(400, 'Invalid blocks configuration');
				}
				blocks = result.data as Block[];
			} catch (e) {
				if (e instanceof Error && e.message.includes('JSON')) {
					throw error(400, 'Invalid blocks JSON');
				}
				throw e;
			}
		}

		// Sanitize custom CSS if provided
		let customCss: string | null | undefined = undefined;
		if (data.customCss !== undefined) {
			const { css } = sanitizeCss(data.customCss);
			customCss = css || null;
		}

		// Upsert config
		const [existing] = await db
			.select({ id: bandPageConfig.id })
			.from(bandPageConfig)
			.where(eq(bandPageConfig.bandId, band.id))
			.limit(1);

		if (existing) {
			const updates: Record<string, unknown> = { updatedAt: new Date() };
			if (data.theme !== undefined) updates.theme = data.theme;
			if (customCss !== undefined) updates.customCss = customCss;
			if (blocks !== undefined) updates.blocks = blocks;

			await db
				.update(bandPageConfig)
				.set(updates)
				.where(eq(bandPageConfig.id, existing.id));
		} else {
			await db.insert(bandPageConfig).values({
				bandId: band.id,
				theme: data.theme ?? 'default',
				customCss: customCss ?? null,
				blocks: blocks ?? []
			});
		}

		return { success: true };
	}
);

export const saveBandEpk = form(
	z.object({
		slug: z.string().min(1),
		epk: z.string() // JSON-encoded BandEpk
	}),
	async (data) => {
		const { band } = await requireBandAdmin();

		if (band.tier !== 'premium') {
			throw error(403, 'Premium subscription required');
		}

		let epk: Record<string, unknown>;
		try {
			epk = JSON.parse(data.epk);
		} catch {
			throw error(400, 'Invalid EPK JSON');
		}

		// Upsert
		const [existing] = await db
			.select({ id: bandPageConfig.id })
			.from(bandPageConfig)
			.where(eq(bandPageConfig.bandId, band.id))
			.limit(1);

		if (existing) {
			await db
				.update(bandPageConfig)
				.set({ epk, updatedAt: new Date() })
				.where(eq(bandPageConfig.id, existing.id));
		} else {
			await db.insert(bandPageConfig).values({
				bandId: band.id,
				theme: 'default',
				blocks: [],
				epk
			});
		}

		return { success: true };
	}
);
