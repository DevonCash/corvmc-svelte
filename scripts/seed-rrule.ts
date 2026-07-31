/**
 * Recurrence rule builder for the dev seed.
 *
 * Mirrors the compact JSON format produced by the app's `buildRRule`
 * (src/lib/server/reservation/rrule-helpers.ts). We can't import that module
 * here — it pulls SvelteKit-only `$lib` aliases that don't resolve under tsx —
 * so the shape is reproduced inline. `scripts/seed-rrule.spec.ts` asserts the
 * output stays parseable by the app's `parseRRule`/`getOccurrences`, which is
 * what the generation cron runs.
 */

const TZ = 'America/Los_Angeles';

const WEEKDAYS: Record<string, number> = {
	Sun: 0,
	Mon: 1,
	Tue: 2,
	Wed: 3,
	Thu: 4,
	Fri: 5,
	Sat: 6
};

function partsInTz(d: Date) {
	const fmt = new Intl.DateTimeFormat('en-US', {
		timeZone: TZ,
		year: 'numeric',
		month: 'numeric',
		day: 'numeric',
		hour: 'numeric',
		minute: 'numeric',
		hour12: false,
		weekday: 'short'
	});
	const parts = Object.fromEntries(
		fmt
			.formatToParts(d)
			.filter((p) => p.type !== 'literal')
			.map((p) => [p.type, p.value])
	);
	return {
		year: Number(parts.year),
		month: Number(parts.month),
		day: Number(parts.day),
		// `hour12: false` can yield "24" at midnight.
		hour: Number(parts.hour) % 24,
		minute: Number(parts.minute),
		weekday: WEEKDAYS[parts.weekday]
	};
}

export function buildSeedRRule(startsAt: Date, freq: 'weekly' | 'biweekly' | 'monthly'): string {
	const parts = partsInTz(startsAt);
	const isMonthly = freq === 'monthly';

	return JSON.stringify({
		freq: isMonthly ? 'monthly' : 'weekly',
		interval: freq === 'biweekly' ? 2 : 1,
		tz: TZ,
		start: {
			year: parts.year,
			month: parts.month,
			day: parts.day,
			hour: parts.hour,
			minute: parts.minute
		},
		weekday: parts.weekday,
		monthlyMode: isMonthly ? 'weekday' : undefined,
		nthWeek: isMonthly ? Math.ceil(parts.day / 7) : undefined,
		dayOfMonth: undefined
	});
}
