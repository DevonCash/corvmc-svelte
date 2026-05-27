import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { band } from './band';

// ---------------------------------------------------------------------------
// Band Page Config — stores block layout, theme, and custom CSS for premium pages
// ---------------------------------------------------------------------------

export const bandPageConfig = sqliteTable(
	'band_page_config',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bandId: text('band_id')
			.notNull()
			.unique()
			.references(() => band.id, { onDelete: 'cascade' }),
		theme: text('theme').notNull().default('default'),
		customCss: text('custom_css'),
		blocks: text('blocks', { mode: 'json' }).$type<Block[]>().notNull().default([]),
		epk: text('epk', { mode: 'json' }).$type<BandEpk>(),
		updatedAt: integer('updated_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [index('idx_band_page_config_band').on(t.bandId)]
);

// ---------------------------------------------------------------------------
// Band Media — R2-stored images for gallery, hero, etc.
// ---------------------------------------------------------------------------

export const bandMedia = sqliteTable(
	'band_media',
	{
		id: text('id')
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		bandId: text('band_id')
			.notNull()
			.references(() => band.id, { onDelete: 'cascade' }),
		key: text('key').notNull(),
		type: text('type').notNull(), // 'image' | 'hero' | 'rider' | 'stage_plot'
		caption: text('caption'),
		sortOrder: integer('sort_order').notNull().default(0),
		createdAt: integer('created_at', { mode: 'timestamp' })
			.notNull()
			.default(sql`(unixepoch())`)
	},
	(t) => [index('idx_band_media_band_type').on(t.bandId, t.type, t.sortOrder)]
);

// ---------------------------------------------------------------------------
// Block types
// ---------------------------------------------------------------------------

export type Block =
	| { id: string; type: 'hero'; imageKey: string; headline?: string; subtitle?: string; cssClass?: string }
	| { id: string; type: 'bio'; content: string; cssClass?: string }
	| { id: string; type: 'links'; style: 'buttons' | 'icons' | 'list'; cssClass?: string }
	| { id: string; type: 'members'; showPositions: boolean; cssClass?: string }
	| { id: string; type: 'events'; limit?: number; cssClass?: string }
	| { id: string; type: 'gallery'; imageKeys: string[]; downloadable?: boolean; cssClass?: string }
	| { id: string; type: 'embed'; platform: string; url: string; cssClass?: string }
	| { id: string; type: 'press'; cssClass?: string }
	| { id: string; type: 'achievements'; cssClass?: string }
	| { id: string; type: 'contact'; cssClass?: string }
	| { id: string; type: 'tech_rider'; cssClass?: string }
	| { id: string; type: 'custom_html'; content: string; cssClass?: string }
	| { id: string; type: 'merch'; items: MerchItem[]; cssClass?: string }
	| { id: string; type: 'spacer'; height: 'sm' | 'md' | 'lg'; cssClass?: string };

export interface MerchItem {
	title: string;
	url: string;
	imageKey?: string;
	price?: string;
}

// ---------------------------------------------------------------------------
// EPK data
// ---------------------------------------------------------------------------

export interface BandEpk {
	bookingContact?: { name: string; email: string; phone?: string };
	managementContact?: { name: string; email: string; phone?: string };
	prContact?: { name: string; email: string };
	technicalRiderKey?: string;
	stagePlotKey?: string;
	backline?: BacklineItem[];
	pressQuotes?: PressQuote[];
	achievements?: string[];
}

export interface BacklineItem {
	instrument: string;
	details: string;
	provided: boolean;
}

export interface PressQuote {
	quote: string;
	publication: string;
	date?: string;
	url?: string;
}

// ---------------------------------------------------------------------------
// Theme options
// ---------------------------------------------------------------------------

export const BAND_THEMES = [
	'default',
	'punk',
	'jazz',
	'metal',
	'indie',
	'electronic',
	'folk'
] as const;

export type BandTheme = (typeof BAND_THEMES)[number];

// ---------------------------------------------------------------------------
// Zod schemas for validation
// ---------------------------------------------------------------------------

export const blockSchema = z.discriminatedUnion('type', [
	z.object({ id: z.string(), type: z.literal('hero'), imageKey: z.string(), headline: z.string().optional(), subtitle: z.string().optional(), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('bio'), content: z.string().max(10000), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('links'), style: z.enum(['buttons', 'icons', 'list']), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('members'), showPositions: z.boolean(), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('events'), limit: z.number().optional(), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('gallery'), imageKeys: z.array(z.string()), downloadable: z.boolean().optional(), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('embed'), platform: z.string(), url: z.string().url(), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('press'), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('achievements'), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('contact'), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('tech_rider'), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('custom_html'), content: z.string().max(50000), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('merch'), items: z.array(z.object({ title: z.string(), url: z.string(), imageKey: z.string().optional(), price: z.string().optional() })).max(50), cssClass: z.string().optional() }),
	z.object({ id: z.string(), type: z.literal('spacer'), height: z.enum(['sm', 'md', 'lg']), cssClass: z.string().optional() })
]);

export const bandPageConfigSchema = z.object({
	theme: z.enum(BAND_THEMES),
	customCss: z.string().max(51200).optional(), // 50KB
	blocks: z.array(blockSchema).max(50)
});

// ---------------------------------------------------------------------------
// Client-safe types
// ---------------------------------------------------------------------------

export type BandPageConfig = typeof bandPageConfig.$inferSelect;
export type BandMedia = typeof bandMedia.$inferSelect;
