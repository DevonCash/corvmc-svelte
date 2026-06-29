/**
 * Seed the local D1 database with fake data for UI development.
 *
 * Usage:
 *   pnpm db:seed
 *
 * This is DESTRUCTIVE — it deletes all data and rebuilds from scratch.
 * Do not run against production.
 *
 * Prerequisites:
 *   - Local D1 SQLite file exists (run `pnpm db:push` first)
 */
import 'dotenv/config';
import { randomUUID, randomBytes, scrypt } from 'crypto';
import { getPlatformProxy } from 'wrangler';
import { drizzle } from 'drizzle-orm/d1';
import { sql, eq } from 'drizzle-orm';

// Mirror the app's password hashing (src/lib/server/auth.ts `scryptHash`). We can't
// import that module here — it pulls SvelteKit-only `$env`/`$app` aliases that don't
// resolve under tsx — so the format is reproduced inline. The app's verifier only
// accepts `scrypt:` / `$2` / `pbkdf2:` prefixes; better-auth's bare-hex hashPassword
// is rejected as `unknown_hash_format`, which is why seeded logins must use this.
const SCRYPT_PARAMS = { N: 16384, r: 16, p: 1, keylen: 64, maxmem: 128 * 16384 * 16 * 2 };
function scryptHash(password: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const salt = randomBytes(16);
		const { N, r, p, keylen, maxmem } = SCRYPT_PARAMS;
		scrypt(password.normalize('NFKC'), salt, keylen, { N, r, p, maxmem }, (err, key) =>
			err
				? reject(err)
				: resolve(`scrypt:${N}:${r}:${p}:${salt.toString('hex')}:${key.toString('hex')}`)
		);
	});
}
import {
	user,
	account,
	userInstrument,
	userGenre
} from '../src/lib/server/db/schema/authentication';
import { role, modelHasRole } from '../src/lib/server/db/schema/authorization';
import { reservation, closure } from '../src/lib/server/db/schema/reservation';
import { recurringSeries } from '../src/lib/server/db/schema/recurring';
import { event } from '../src/lib/server/db/schema/event';
import { ticket } from '../src/lib/server/db/schema/ticket';
import { eventRsvp } from '../src/lib/server/db/schema/event-rsvp';
import {
	creditTransaction,
	paymentCache as paymentRecord
} from '../src/lib/server/db/schema/finance';
import { notification, notificationPreference } from '../src/lib/server/db/schema/notification';
import { band, bandMember, bandGenre } from '../src/lib/server/db/schema/band';
import { bandPageConfig, bandMedia } from '../src/lib/server/db/schema/band-page';
import {
	subscriber,
	audience,
	audienceMember,
	campaign,
	campaignAudience
} from '../src/lib/server/db/schema/marketing';
import { equipmentCategory, equipment, equipmentLoan } from '../src/lib/server/db/schema/equipment';
import { helpCategory, helpArticle } from '../src/lib/server/db/schema/help';
import { inboxThread, inboxMessage, inboxNote } from '../src/lib/server/db/schema/inbox';
import { contentFlag } from '../src/lib/server/db/schema/flag';
const { env, dispose } = await getPlatformProxy();
const db = drizzle(env.DB);
await db.run(sql`PRAGMA foreign_keys = OFF`);

function seedRRule(startsAt: Date, freq: 'weekly' | 'biweekly' | 'monthly'): string {
	const pad = (n: number) => String(n).padStart(2, '0');
	const y = startsAt.getUTCFullYear();
	const m = pad(startsAt.getUTCMonth() + 1);
	const d = pad(startsAt.getUTCDate());
	const h = pad(startsAt.getUTCHours());
	const min = pad(startsAt.getUTCMinutes());
	const dtstart = `DTSTART;TZID=America/Los_Angeles:${y}${m}${d}T${h}${min}00`;
	const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
	const day = days[startsAt.getDay()];
	switch (freq) {
		case 'weekly':
			return `${dtstart}\nRRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=${day}`;
		case 'biweekly':
			return `${dtstart}\nRRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${day}`;
		case 'monthly': {
			const nth = Math.ceil(startsAt.getDate() / 7);
			return `${dtstart}\nRRULE:FREQ=MONTHLY;INTERVAL=1;BYDAY=${nth}${day}`;
		}
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pick<T>(arr: T[]): T {
	return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
	const shuffled = [...arr].sort(() => Math.random() - 0.5);
	return shuffled.slice(0, n);
}

function randomInt(min: number, max: number): number {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ptDate(daysOffset: number, hour: number, minute = 0): Date {
	const d = new Date();
	d.setDate(d.getDate() + daysOffset);
	d.setUTCHours(hour + 7, minute, 0, 0);
	return d;
}

async function batchInsert<T extends Record<string, unknown>>(
	table: any,
	rows: T[],
	batchSize = 10
): Promise<T[]> {
	const results: T[] = [];
	for (let i = 0; i < rows.length; i += batchSize) {
		const batch = rows.slice(i, i + batchSize);
		const returned = await db.insert(table).values(batch).returning();
		results.push(...returned);
	}
	return results;
}

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
	'Alex',
	'Jordan',
	'Casey',
	'Morgan',
	'Taylor',
	'Riley',
	'Quinn',
	'Avery',
	'Dakota',
	'Reese',
	'Skyler',
	'Finley',
	'Rowan',
	'Sage',
	'Charlie',
	'Emerson',
	'Hayden',
	'Parker',
	'Blake',
	'Jamie'
];

const LAST_NAMES = [
	'Chen',
	'Rivera',
	'Nguyen',
	'Kowalski',
	'Okafor',
	'Singh',
	'Larsson',
	'Fernandez',
	'Tanaka',
	'Dubois',
	'Kim',
	'Petrov',
	'Anderson',
	'Reyes',
	'Washington',
	'Murphy',
	'Cohen',
	'Yamamoto',
	'Santos',
	'Berg'
];

const PRONOUNS = ['he/him', 'she/her', 'they/them', null, null];

const EVENT_TITLES = [
	'Open Mic Night',
	'Jazz Jam Session',
	'Songwriting Workshop',
	'Battle of the Bands',
	'Acoustic Showcase',
	'Electronic Music Night',
	'Blues & Brews',
	'Hip-Hop Cypher',
	'Classical Recital',
	'Punk Rock Matinee',
	'Folk Circle',
	'Album Release Party',
	'Music Theory Workshop',
	'Guitar Clinic',
	'Drum Circle',
	'Singer-Songwriter Night',
	'Funk & Soul Revue',
	'Latin Night'
];

const EVENT_TAGS_POOL = [
	'open mic',
	'workshop',
	'jam',
	'showcase',
	'all ages',
	'21+',
	'free',
	'ticketed',
	'community',
	'genre night'
];

const CLOSURE_REASONS = [
	'Building maintenance',
	'Holiday closure',
	'Staff retreat',
	'Private rental',
	'Deep cleaning',
	'Equipment installation',
	'Electrical work',
	'Plumbing repair'
];

const BAND_NAMES = [
	'The Voltage Thieves',
	'Half Past Never',
	'Cardboard Satellites',
	'Velvet Brake',
	'Tin Whisker',
	'Slow Catastrophe',
	'Paper Wolves',
	'The After Math'
];

const BAND_POSITIONS = [
	'Guitar',
	'Bass',
	'Drums',
	'Vocals',
	'Keys',
	'Saxophone',
	'Violin',
	'Cello',
	'Trumpet'
];

const TICKET_CODES_PREFIX = 'TIX';

const INSTRUMENTS = [
	'guitar',
	'bass',
	'drums',
	'vocals',
	'keys',
	'piano',
	'saxophone',
	'violin',
	'cello',
	'trumpet',
	'trombone',
	'flute',
	'banjo',
	'mandolin',
	'harmonica',
	'ukulele',
	'synthesizer',
	'turntables',
	'percussion'
];

const GENRES = [
	'jazz',
	'rock',
	'funk',
	'blues',
	'folk',
	'indie',
	'electronic',
	'hip-hop',
	'classical',
	'punk',
	'metal',
	'r&b',
	'soul',
	'country',
	'reggae',
	'latin',
	'world',
	'experimental',
	'pop',
	'ambient'
];

const TAGLINES = [
	'Drummer looking for a funk project',
	'Multi-instrumentalist | Jazz & Soul',
	'Singer-songwriter | Acoustic vibes',
	'Lead guitarist | Rock & Blues',
	'Bassist for hire',
	'Keys player | All genres welcome',
	'Producer & DJ',
	'Classically trained, genre curious',
	'Vocalist | R&B, Soul, Gospel',
	'Percussionist | World music enthusiast'
];

const HOMETOWNS = [
	'Corvallis, OR',
	'Albany, OR',
	'Philomath, OR',
	'Eugene, OR',
	'Salem, OR',
	'Lebanon, OR',
	'Portland, OR'
];

const MEMBER_BIOS = [
	'Been playing since I was 12. Love jamming with new people.',
	'Studied music at OSU. Currently in two bands but always looking for side projects.',
	'Self-taught guitarist. Into anything with a good groove.',
	'Professional session musician. Available for recording and live gigs.',
	'Just moved to Corvallis and looking to connect with local musicians.',
	'Weekend warrior. Day job in tech, music is my therapy.',
	null,
	null,
	null
];

const SAMPLE_LINKS = [
	{ label: 'My SoundCloud', url: 'https://soundcloud.com/example/tracks' },
	{ label: 'YouTube Channel', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
	{ label: 'Spotify', url: 'https://open.spotify.com/artist/example' },
	{ label: 'Bandcamp', url: 'https://example.bandcamp.com/album/demo' },
	{ label: 'Instagram', url: 'https://instagram.com/musician' },
	{ label: 'Personal Site', url: 'https://example.com' }
];

const BAND_EVENT_TITLES = [
	'Live at The Peacock',
	'House Show — All Ages',
	'Album Release Party',
	'Benefit for Local Food Bank',
	"Late Night at Cloud & Kelly's",
	'Backyard BBQ & Music',
	'Summer Solstice Set',
	'Vinyl Night',
	'Residency Night #4',
	'Co-Headliner with Paper Wolves'
];

const BAND_EVENT_LOCATIONS = [
	'The Peacock Tavern, 125 SW 2nd St',
	"Cloud & Kelly's, 126 SW 1st St",
	'Bombs Away Cafe, 2527 NW Monroe Ave',
	'Majestic Theatre, 115 SW 2nd St',
	'House show (DM for address)',
	'OSU MU Ballroom',
	'Avery Park Amphitheater',
	'Block 15 Brewery, 300 SW Jefferson Ave'
];

const PRESS_QUOTES = [
	{
		quote: 'One of the most exciting acts to come out of the Willamette Valley in years.',
		publication: 'Oregon Music News',
		date: '2025-11'
	},
	{
		quote: "Their live energy is absolutely electric — don't miss them.",
		publication: 'Corvallis Gazette-Times',
		date: '2025-09'
	},
	{
		quote: "A refreshing blend of genres that shouldn't work but absolutely does.",
		publication: 'PDX Monthly',
		date: '2026-01'
	},
	{
		quote: 'The real deal. Tight, inventive, and impossible not to dance to.',
		publication: 'Willamette Week',
		date: '2026-03'
	},
	{
		quote: 'They pack every venue they play. Simple as that.',
		publication: 'Eugene Weekly',
		date: '2025-12'
	}
];

const ACHIEVEMENTS_POOL = [
	'Opened for Built to Spill at the McDonald Theatre (2025)',
	'Selected for Pickathon Festival 2026',
	'150,000+ streams on Spotify',
	"Featured on KBOO Portland's Local Music Spotlight",
	'Won Battle of the Bands at Bombs Away (2025)',
	'Sold out Majestic Theatre (400 cap) twice',
	'Oregon Music Award nominee — Best New Act 2025',
	'Recorded at Jackpot! Recording Studio, Portland'
];

const BACKLINE_ITEMS = [
	{
		instrument: 'Drums',
		details: 'DW 5-piece kit, 22" kick. Band provides cymbals and snare.',
		provided: false
	},
	{
		instrument: 'Bass Amp',
		details: 'Ampeg SVT-style, 300W minimum with 4x10 or 8x10 cab',
		provided: false
	},
	{
		instrument: 'Guitar Amp',
		details: 'Fender Twin Reverb or equivalent clean amp',
		provided: false
	},
	{ instrument: 'Keys', details: 'Nord Stage 3 or similar weighted 88-key', provided: false },
	{ instrument: 'Monitors', details: '4 monitor wedges with independent mixes', provided: false },
	{ instrument: 'DI Boxes', details: '2x active DI (Radial J48 or equivalent)', provided: false }
];

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function deleteAll() {
	console.log('Deleting all data...');
	const tables = [
		'content_flag',
		'inbox_note',
		'inbox_message',
		'inbox_thread',
		'inbox_channel_config',
		'help_articles',
		'help_categories',
		'equipment_loan',
		'equipment',
		'equipment_category',
		'campaign_audience',
		'campaign',
		'audience_member',
		'audience',
		'subscriber',
		'notification_preference',
		'notification',
		'ticket',
		'band_media',
		'band_page_config',
		'band_genre',
		'band_member',
		'band',
		'payment_cache',
		'credit_transaction',
		'recurring_series',
		'event',
		'closure',
		'reservation',
		'model_has_roles',
		'model_has_permissions',
		'role_has_permissions',
		'roles',
		'permissions',
		'user_instrument',
		'user_genre',
		'session',
		'account',
		'verification',
		'user'
	];
	for (const t of tables) {
		await db.run(sql.raw(`DELETE FROM "${t}"`));
	}
}

interface SeedRole {
	id: number;
	name: string;
}
interface SeedUser {
	id: string;
	name: string;
	email: string;
}
interface SeedEvent {
	id: string;
	status: string;
	startsAt: Date;
}
interface SeedReservation {
	id: string;
	createdByUserId: string;
	startsAt: Date;
	endsAt: Date;
	status: string;
}

async function seedRoles(): SeedRole[] {
	console.log('Seeding roles...');
	const roles = ['admin', 'staff', 'member', 'volunteer', 'sustaining'];
	const inserted: SeedRole[] = [];
	for (const name of roles) {
		const [r] = await db.insert(role).values({ name, guardName: 'web' }).returning();
		inserted.push(r);
	}
	return inserted;
}

async function seedUsers(count: number): SeedUser[] {
	console.log(`Seeding ${count} users...`);
	const users: SeedUser[] = [];
	const usedEmails = new Set<string>();

	for (let i = 0; i < count; i++) {
		const first = pick(FIRST_NAMES);
		const last = pick(LAST_NAMES);
		const name = `${first} ${last}`;
		let email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;

		let suffix = 1;
		while (usedEmails.has(email)) {
			email = `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@example.com`;
			suffix++;
		}
		usedEmails.add(email);

		const id = randomUUID();
		const createdAt = new Date(Date.now() - randomInt(7, 365) * 86400000);

		const hasProfile = Math.random() > 0.3;
		const memberInstruments = hasProfile ? pickN(INSTRUMENTS, randomInt(1, 3)) : [];
		const memberGenres = hasProfile ? pickN(GENRES, randomInt(1, 3)) : [];
		const memberLinks =
			hasProfile && Math.random() > 0.4 ? pickN(SAMPLE_LINKS, randomInt(1, 3)) : null;
		const visibility = !hasProfile ? 'hidden' : Math.random() > 0.6 ? 'public' : 'members';

		const [u] = await db
			.insert(user)
			.values({
				id,
				name,
				email,
				emailVerified: true,
				pronouns: pick(PRONOUNS),
				phone: Math.random() > 0.4 ? `541-555-${String(randomInt(1000, 9999))}` : null,
				creditFreeHours: randomInt(0, 8),
				creditEquipment: randomInt(0, 3),
				memberNumber: 100 + i,
				bio: hasProfile ? pick(MEMBER_BIOS) : null,
				tagline: hasProfile ? pick(TAGLINES) : null,
				hometown: hasProfile ? pick(HOMETOWNS) : null,
				lookingForBand: hasProfile && Math.random() > 0.7,
				availableForHire: hasProfile && Math.random() > 0.7,
				teachesLessons: hasProfile && Math.random() > 0.8,
				openToCollaboration: hasProfile && Math.random() > 0.5,
				directoryVisibility: visibility,
				directoryContact: visibility === 'public' ? { email } : null,
				links: memberLinks,
				createdAt,
				updatedAt: createdAt
			})
			.returning();

		// Junction tables for instruments and genres
		for (const instrument of memberInstruments) {
			await db.insert(userInstrument).values({ userId: id, instrument });
		}
		for (const genre of memberGenres) {
			await db.insert(userGenre).values({ userId: id, genre });
		}

		users.push({ ...u, email });
	}
	return users;
}

async function seedAdminUser(): Promise<SeedUser> {
	console.log('Seeding admin user (admin@corvallismusic.org)...');
	const id = randomUUID();
	const now = new Date();
	const hashedPassword = await scryptHash('password');

	const [adminUser] = await db
		.insert(user)
		.values({
			id,
			name: 'Admin',
			email: 'admin@corvallismusic.org',
			emailVerified: true,
			createdAt: now,
			updatedAt: now
		})
		.returning();

	await db.insert(account).values({
		id: randomUUID(),
		accountId: id,
		providerId: 'credential',
		userId: id,
		password: hashedPassword,
		createdAt: now,
		updatedAt: now
	});

	return { ...adminUser, email: 'admin@corvallismusic.org' };
}

async function seedUserRoles(users: SeedUser[], adminUser: SeedUser, roles: SeedRole[]) {
	console.log('Assigning roles...');
	const adminRole = roles.find((r) => r.name === 'admin')!;
	const staffRole = roles.find((r) => r.name === 'staff')!;
	const memberRole = roles.find((r) => r.name === 'member')!;
	const volunteerRole = roles.find((r) => r.name === 'volunteer')!;
	const sustainingRole = roles.find((r) => r.name === 'sustaining')!;

	await db.insert(modelHasRole).values([
		{ roleId: adminRole.id, userId: adminUser.id },
		{ roleId: staffRole.id, userId: adminUser.id },
		{ roleId: memberRole.id, userId: adminUser.id }
	]);

	for (let i = 0; i < 2; i++) {
		await db.insert(modelHasRole).values([
			{ roleId: adminRole.id, userId: users[i].id },
			{ roleId: staffRole.id, userId: users[i].id }
		]);
	}

	for (let i = 2; i < 5; i++) {
		await db.insert(modelHasRole).values({ roleId: staffRole.id, userId: users[i].id });
	}

	for (const u of users) {
		await db.insert(modelHasRole).values({ roleId: memberRole.id, userId: u.id });
	}

	for (const u of pickN(users, 6)) {
		await db
			.insert(modelHasRole)
			.values({ roleId: volunteerRole.id, userId: u.id })
			.onConflictDoNothing();
	}

	for (const u of pickN(users, 8)) {
		await db
			.insert(modelHasRole)
			.values({ roleId: sustainingRole.id, userId: u.id })
			.onConflictDoNothing();

		// Give sustaining members an active subscription snapshot so the membership
		// page renders the dashboard view. hoursPerReset and creditFreeHours are in
		// credits (30-min blocks): each $5-unit grants one hour = two credits.
		const units = pick([2, 5, 12]); // $10 / $25 / $60 per month
		const hoursPerReset = units * 2;
		const startedAt = new Date(Date.now() - randomInt(30, 365) * 86400000);
		const creditsResetAt = new Date(Date.now() + randomInt(3, 27) * 86400000);
		await db
			.update(user)
			.set({
				stripeId: `cus_seed_${u.id.slice(0, 8)}`,
				creditFreeHours: randomInt(0, hoursPerReset),
				subscription: {
					startedAt: startedAt.toISOString(),
					stripeSubscriptionId: `sub_seed_${randomUUID().slice(0, 8)}`,
					hoursPerReset,
					creditsResetAt: creditsResetAt.toISOString(),
					coveringFees: Math.random() > 0.6,
					cancelAtPeriodEnd: false
				}
			})
			.where(eq(user.id, u.id));
	}
}

async function seedReservations(users: SeedUser[]): SeedReservation[] {
	console.log('Seeding reservations...');
	const rows: SeedReservation[] = [];

	for (let day = -14; day < 0; day++) {
		const count = randomInt(1, 4);
		let hour = randomInt(9, 14);
		for (let i = 0; i < count; i++) {
			const duration = pick([1, 1.5, 2]);
			const startsAt = ptDate(day, hour);
			const endsAt = ptDate(day, hour + duration);
			hour += duration + 0.5;
			if (hour > 21) break;

			const status = Math.random() > 0.15 ? 'completed' : pick(['no_show', 'cancelled']);
			const member = pick(users);

			const [r] = await db
				.insert(reservation)
				.values({
					bookerType: 'user',
					bookerId: member.id,
					createdByUserId: member.id,
					status,
					startsAt,
					endsAt,
					notes: Math.random() > 0.7 ? 'Band practice' : null,
					cancellationReason: status === 'cancelled' ? 'Schedule conflict' : null,
					paidAt: status === 'completed' ? startsAt : null
				})
				.returning();
			rows.push(r);
		}
	}

	for (let day = 0; day <= 14; day++) {
		const count = randomInt(1, 3);
		let hour = randomInt(10, 15);
		for (let i = 0; i < count; i++) {
			const duration = pick([1, 1.5, 2]);
			const startsAt = ptDate(day, hour);
			const endsAt = ptDate(day, hour + duration);
			hour += duration + 0.5;
			if (hour > 21) break;

			const status = day === 0 ? 'confirmed' : pick(['scheduled', 'confirmed']);
			const member = pick(users);

			// Today's confirmed reservations have a provisioned door code, mirroring
			// the daily lock job (codes are issued the morning of the reservation).
			const lockCode = day === 0 && status === 'confirmed' ? String(randomInt(1000, 9999)) : null;

			const [r] = await db
				.insert(reservation)
				.values({
					bookerType: 'user',
					bookerId: member.id,
					createdByUserId: member.id,
					status,
					startsAt,
					endsAt,
					lockCode,
					notes:
						Math.random() > 0.6
							? pick(['Drum practice', 'Guitar lesson prep', 'Recording session'])
							: null
				})
				.returning();
			rows.push(r);
		}
	}

	return rows;
}

async function seedClosures() {
	console.log('Seeding closures...');
	await db.insert(closure).values([
		{ reason: 'Holiday closure — New Year', startsAt: ptDate(-30, 0), endsAt: ptDate(-29, 23, 59) },
		{
			reason: 'Building maintenance — HVAC replacement',
			startsAt: ptDate(21, 8),
			endsAt: ptDate(22, 18)
		},
		{ reason: pick(CLOSURE_REASONS), startsAt: ptDate(35, 0), endsAt: ptDate(35, 23, 59) }
	]);
}

async function seedEvents(users: SeedUser[]): SeedEvent[] {
	console.log('Seeding events...');
	const rows: SeedEvent[] = [];
	const staffUsers = users.slice(0, 6);

	async function createEventReservation(
		day: number,
		eventStartHour: number,
		eventEndHour: number,
		createdByUserId: string,
		reservationStatus: string
	): Promise<string> {
		const startsAt = ptDate(day, eventStartHour, -30);
		const endsAt = ptDate(day, eventEndHour, 30);
		const [r] = await db
			.insert(reservation)
			.values({
				bookerType: 'event',
				bookerId: 'event',
				createdByUserId,
				status: reservationStatus,
				startsAt,
				endsAt,
				notes: 'Event space reservation',
				cancellationReason: reservationStatus === 'cancelled' ? 'Event cancelled' : null
			})
			.returning();
		return r.id;
	}

	for (let i = 0; i < 6; i++) {
		const day = -randomInt(3, 30);
		const hour = randomInt(18, 20);
		const duration = pick([2, 3]);
		const tags = pickN(EVENT_TAGS_POOL, randomInt(1, 3)).join(', ');
		const startsAt = ptDate(day, hour);
		const endsAt = ptDate(day, hour + duration);
		const publishedAt = new Date(startsAt.getTime() - randomInt(7, 21) * 86400000);
		const creator = pick(staffUsers);

		let reservationId: string | undefined;
		if (Math.random() < 0.75) {
			reservationId = await createEventReservation(
				day,
				hour,
				hour + duration,
				creator.id,
				'completed'
			);
		}

		const [e] = await db
			.insert(event)
			.values({
				title: pick(EVENT_TITLES),
				description: 'Join us for an evening of live music and community.',
				startsAt,
				endsAt,
				doorsAt: ptDate(day, hour - 0.5),
				status: 'published',
				publishedAt,
				tags,
				reservationId,
				createdByUserId: creator.id
			})
			.returning();
		rows.push(e);
	}

	// Future events: 2 paid ticketed, 2 free RSVP, 2 open (no ticketing)
	const futureConfigs: {
		ticketingEnabled: boolean;
		ticketPrice: number | null;
		ticketQuantity: number | null;
	}[] = [
		{ ticketingEnabled: true, ticketPrice: 1500, ticketQuantity: 50 },
		{ ticketingEnabled: true, ticketPrice: 2000, ticketQuantity: 30 },
		{ ticketingEnabled: true, ticketPrice: null, ticketQuantity: 40 },
		{ ticketingEnabled: true, ticketPrice: null, ticketQuantity: null },
		{ ticketingEnabled: false, ticketPrice: null, ticketQuantity: null },
		{ ticketingEnabled: false, ticketPrice: null, ticketQuantity: null }
	];

	for (let i = 0; i < 6; i++) {
		const day = randomInt(3, 28);
		const hour = randomInt(18, 20);
		const duration = pick([2, 3]);
		const tags = pickN(EVENT_TAGS_POOL, randomInt(1, 3)).join(', ');
		const startsAt = ptDate(day, hour);
		const endsAt = ptDate(day, hour + duration);
		const creator = pick(staffUsers);
		const config = futureConfigs[i];

		let reservationId: string | undefined;
		if (Math.random() < 0.75) {
			reservationId = await createEventReservation(
				day,
				hour,
				hour + duration,
				creator.id,
				'confirmed'
			);
		}

		const [e] = await db
			.insert(event)
			.values({
				title: pick(EVENT_TITLES),
				description:
					config.ticketingEnabled && !config.ticketPrice
						? 'A free community event — RSVP to reserve your spot!'
						: 'An evening of live performances at the Collective.',
				startsAt,
				endsAt,
				doorsAt: ptDate(day, hour - 0.5),
				status: 'published',
				publishedAt: new Date(),
				tags,
				reservationId,
				ticketingEnabled: config.ticketingEnabled,
				ticketPrice: config.ticketPrice,
				ticketQuantity: config.ticketQuantity,
				createdByUserId: creator.id
			})
			.returning();
		rows.push(e);
	}

	for (let i = 0; i < 2; i++) {
		const day = randomInt(14, 45);
		const hour = randomInt(18, 20);
		const creator = pick(staffUsers);

		let reservationId: string | undefined;
		if (Math.random() < 0.75) {
			reservationId = await createEventReservation(day, hour, hour + 3, creator.id, 'scheduled');
		}

		const [e] = await db
			.insert(event)
			.values({
				title: pick(EVENT_TITLES),
				description: 'Details TBD',
				startsAt: ptDate(day, hour),
				endsAt: ptDate(day, hour + 3),
				status: 'draft',
				tags: pick(EVENT_TAGS_POOL),
				reservationId,
				createdByUserId: creator.id
			})
			.returning();
		rows.push(e);
	}

	const cancelledCreator = pick(staffUsers);
	const cancelledResId = await createEventReservation(7, 14, 20, cancelledCreator.id, 'cancelled');
	const [cancelled] = await db
		.insert(event)
		.values({
			title: 'Cancelled: Outdoor Festival',
			description: 'Unfortunately cancelled due to weather.',
			startsAt: ptDate(7, 14),
			endsAt: ptDate(7, 20),
			status: 'cancelled',
			tags: 'community, all ages',
			reservationId: cancelledResId,
			createdByUserId: cancelledCreator.id
		})
		.returning();
	rows.push(cancelled);

	const [cancelledNoRes] = await db
		.insert(event)
		.values({
			title: 'Cancelled: Benefit Concert',
			description: 'Cancelled — performer unavailable.',
			startsAt: ptDate(14, 19),
			endsAt: ptDate(14, 22),
			status: 'cancelled',
			tags: 'ticketed, community',
			createdByUserId: pick(staffUsers).id
		})
		.returning();
	rows.push(cancelledNoRes);

	// Recurring CMC event: a weekly open mic. Prototype is a published past
	// occurrence; future occurrences are materialized as drafts (as the
	// generation job would produce), each with its own space reservation.
	{
		const creator = pick(staffUsers);
		const protoDay = -7;
		const hour = 19;
		const duration = 3;
		const protoStart = ptDate(protoDay, hour);

		const protoResId = await createEventReservation(
			protoDay,
			hour,
			hour + duration,
			creator.id,
			'completed'
		);

		const [proto] = await db
			.insert(event)
			.values({
				title: 'Weekly Open Mic',
				description: 'Sign up at the door — all skill levels welcome.',
				startsAt: protoStart,
				endsAt: ptDate(protoDay, hour + duration),
				doorsAt: ptDate(protoDay, hour - 0.5),
				status: 'published',
				publishedAt: new Date(protoStart.getTime() - 14 * 86400000),
				tags: 'open mic, all ages, community',
				reservationId: protoResId,
				createdByUserId: creator.id
			})
			.returning();
		rows.push(proto);

		const rrule = seedRRule(protoStart, 'weekly');
		const [series] = await db
			.insert(recurringSeries)
			.values({
				prototypeType: 'event',
				prototypeId: proto.id,
				rrule,
				createdBy: creator.id
			})
			.returning();

		await db.run(sql`UPDATE event SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`);

		for (let w = 1; w <= 2; w++) {
			const instDay = protoDay + w * 7;
			const instResId = await createEventReservation(
				instDay,
				hour,
				hour + duration,
				creator.id,
				'scheduled'
			);
			const [inst] = await db
				.insert(event)
				.values({
					title: proto.title,
					description: proto.description,
					startsAt: ptDate(instDay, hour),
					endsAt: ptDate(instDay, hour + duration),
					doorsAt: ptDate(instDay, hour - 0.5),
					status: 'draft',
					tags: proto.tags,
					reservationId: instResId,
					recurringSeriesId: series.id,
					createdByUserId: creator.id
				})
				.returning();
			rows.push(inst);
		}
	}

	return rows;
}

async function seedCreditTransactions(users: SeedUser[]) {
	console.log('Seeding credit transactions...');
	for (const u of users.slice(0, 12)) {
		const hours = randomInt(2, 8);
		await db.insert(creditTransaction).values({
			userId: u.id,
			creditType: 'free_hours',
			amount: hours,
			balanceAfter: hours,
			source: 'subscription_allocation',
			description: 'Monthly free hours allocation',
			metadata: { period: 'May 2026' }
		});

		if (Math.random() > 0.4) {
			const used = randomInt(1, Math.min(3, hours));
			await db.insert(creditTransaction).values({
				userId: u.id,
				creditType: 'free_hours',
				amount: -used,
				balanceAfter: hours - used,
				source: 'reservation',
				description: 'Applied to reservation',
				metadata: {}
			});
		}
	}
}

async function seedBands(users: SeedUser[]) {
	console.log('Seeding bands...');
	const bands = [];

	// First 3 bands are premium, rest are free
	const PREMIUM_BAND_COUNT = 3;

	for (let i = 0; i < BAND_NAMES.length; i++) {
		const owner = users[i % users.length];
		const slug = BAND_NAMES[i]
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/-$/, '');

		const genres = pickN(GENRES, randomInt(1, 3));
		const isPremiumBand = i < PREMIUM_BAND_COUNT;
		const bandLinks = [
			{
				label: 'Spotify',
				url: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb',
				embed: true
			},
			{ label: 'YouTube', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', embed: true },
			...pickN(SAMPLE_LINKS.slice(3), randomInt(0, 2))
		];
		const bandVisibility = 'public';

		const [b] = await db
			.insert(band)
			.values({
				name: BAND_NAMES[i],
				slug,
				bio: `${BAND_NAMES[i]} is a local band from Corvallis, OR. Formed in 20${randomInt(18, 24)}, they play a mix of ${genres.slice(0, 2).join(' and ')} with influences from all over the map.`,
				ownerId: owner.id,
				tier: isPremiumBand ? 'premium' : 'free',
				subscription: isPremiumBand
					? {
							startedAt: new Date(Date.now() - randomInt(30, 180) * 86400000).toISOString(),
							stripeSubscriptionId: `sub_seed_${randomUUID().slice(0, 8)}`,
							billingInterval: i === 0 ? 'yearly' : 'monthly',
							currentPeriodEnd: new Date(Date.now() + randomInt(10, 30) * 86400000).toISOString(),
							cancelAtPeriodEnd: false
						}
					: null,
				tagline: `${genres[0]} ${pick(['trio', 'quartet', 'duo', 'ensemble', 'collective'])} from Corvallis`,
				hometown: pick(HOMETOWNS),
				foundedYear: String(randomInt(2015, 2024)),
				lookingForMembers: Math.random() > 0.6,
				directoryVisibility: bandVisibility,
				directoryContact: { email: `booking+${slug}@example.com` },
				links: bandLinks
			})
			.returning();
		bands.push(b);

		for (const g of genres) {
			await db.insert(bandGenre).values({ bandId: b.id, genre: g });
		}

		await db.insert(bandMember).values({
			bandId: b.id,
			userId: owner.id,
			role: 'owner',
			position: pick(BAND_POSITIONS),
			status: 'active'
		});

		const memberCount = randomInt(1, 3);
		const candidates = users.filter((u) => u.id !== owner.id);
		const members = pickN(candidates, memberCount);
		for (const m of members) {
			await db.insert(bandMember).values({
				bandId: b.id,
				userId: m.id,
				role: 'member',
				position: pick(BAND_POSITIONS),
				status: Math.random() > 0.15 ? 'active' : 'pending',
				invitedById: owner.id
			});
		}
	}

	const deactivatedOwner = users[BAND_NAMES.length % users.length];
	const [deactivated] = await db
		.insert(band)
		.values({
			name: 'Disbanded Project',
			slug: 'disbanded-project',
			bio: 'This band was deactivated by staff.',
			ownerId: deactivatedOwner.id,
			deletedAt: new Date(Date.now() - 10 * 86400000)
		})
		.returning();
	await db.insert(bandMember).values({
		bandId: deactivated.id,
		userId: deactivatedOwner.id,
		role: 'owner',
		position: 'Guitar',
		status: 'active'
	});
	bands.push(deactivated);

	return bands;
}

async function seedBandEvents(bands: any[], _users: SeedUser[]) {
	console.log('Seeding band events...');
	const rows = [];

	for (const b of bands.slice(0, 6)) {
		if (b.deletedAt) continue;
		const eventCount = randomInt(2, 4);

		for (let i = 0; i < eventCount; i++) {
			const day = randomInt(-10, 30);
			const hour = randomInt(19, 21);
			const duration = pick([2, 3, 4]);
			const startsAt = ptDate(day, hour);
			const endsAt = ptDate(day, hour + duration);
			const isPast = day < 0;

			const [e] = await db
				.insert(event)
				.values({
					title: pick(BAND_EVENT_TITLES),
					description: `${b.name} live! Join us for a night of original music and good vibes. All ages welcome.`,
					startsAt,
					endsAt,
					doorsAt: ptDate(day, hour - 0.5),
					status: isPast ? 'published' : pick(['published', 'published', 'draft']),
					publishedAt: isPast
						? new Date(startsAt.getTime() - 14 * 86400000)
						: Math.random() > 0.3
							? new Date()
							: null,
					tags: pickN(EVENT_TAGS_POOL, randomInt(1, 3)).join(', '),
					bandId: b.id,
					source: 'band',
					location: pick(BAND_EVENT_LOCATIONS),
					externalTicketUrl:
						Math.random() > 0.5 ? `https://eventbrite.com/e/${randomInt(100000, 999999)}` : null,
					createdByUserId: b.ownerId
				})
				.returning();
			rows.push(e);
		}
	}

	return rows;
}

async function seedBandPageConfigs(bands: any[]) {
	console.log('Seeding band page configs (premium bands)...');
	const configs = [];
	const themes = ['punk', 'jazz', 'electronic', 'metal', 'indie', 'folk'] as const;

	// Only premium bands get page configs
	const premiumBands = bands.filter((b) => b.tier === 'premium' && !b.deletedAt);

	for (let i = 0; i < premiumBands.length; i++) {
		const b = premiumBands[i];
		const theme = themes[i % themes.length];

		const blocks = [
			{
				id: randomUUID(),
				type: 'hero',
				imageKey: 'bands/hero-placeholder.jpg',
				headline: b.name,
				subtitle: b.tagline || 'Live music from Corvallis, OR'
			},
			{
				id: randomUUID(),
				type: 'bio',
				content:
					b.bio || `${b.name} brings their unique sound to venues across the Pacific Northwest.`
			},
			{
				id: randomUUID(),
				type: 'embed',
				platform: 'spotify',
				url: 'https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb'
			},
			{ id: randomUUID(), type: 'events', limit: 5 },
			{ id: randomUUID(), type: 'members', showPositions: true },
			{ id: randomUUID(), type: 'links', style: 'buttons' },
			{ id: randomUUID(), type: 'press' },
			{ id: randomUUID(), type: 'achievements' },
			{
				id: randomUUID(),
				type: 'gallery',
				imageKeys: ['bands/gallery-1.jpg', 'bands/gallery-2.jpg', 'bands/gallery-3.jpg'],
				downloadable: true
			},
			{ id: randomUUID(), type: 'contact' },
			{ id: randomUUID(), type: 'tech_rider' },
			{ id: randomUUID(), type: 'spacer', height: 'md' }
		];

		const epk = {
			bookingContact: {
				name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
				email: `booking@${b.slug}.band`,
				phone: `541-555-${randomInt(1000, 9999)}`
			},
			managementContact: {
				name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
				email: `mgmt@${b.slug}.band`
			},
			prContact:
				Math.random() > 0.5
					? {
							name: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
							email: `press@${b.slug}.band`
						}
					: undefined,
			pressQuotes: pickN(PRESS_QUOTES, randomInt(2, 4)),
			achievements: pickN(ACHIEVEMENTS_POOL, randomInt(3, 5)),
			backline: pickN(BACKLINE_ITEMS, randomInt(3, 5)),
			technicalRiderKey: 'bands/rider-placeholder.pdf',
			stagePlotKey: 'bands/stage-plot-placeholder.png'
		};

		const customCss =
			theme === 'punk'
				? `.band-site-hero { text-transform: uppercase; letter-spacing: 0.1em; }\n.band-site-block { border-bottom: 2px solid var(--bs-accent); }`
				: theme === 'electronic'
					? `.band-site-hero h1 { text-shadow: 0 0 20px var(--bs-accent); }\n.band-site-block { transition: opacity 0.3s; }`
					: null;

		const [config] = await db
			.insert(bandPageConfig)
			.values({
				bandId: b.id,
				theme,
				customCss,
				blocks,
				epk,
				updatedAt: new Date()
			})
			.returning();
		configs.push(config);

		// Add some band media entries
		const mediaTypes = ['image', 'image', 'image', 'hero', 'stage_plot'];
		for (let m = 0; m < mediaTypes.length; m++) {
			await db.insert(bandMedia).values({
				bandId: b.id,
				key: `bands/${b.slug}/${mediaTypes[m]}-${m}.jpg`,
				type: mediaTypes[m],
				caption:
					mediaTypes[m] === 'image'
						? `${b.name} live at ${pick(BAND_EVENT_LOCATIONS).split(',')[0]}`
						: null,
				sortOrder: m
			});
		}
	}

	return configs;
}

async function seedRecurringSeries(users: SeedUser[]) {
	console.log('Seeding recurring series...');
	const rows = [];
	const frequencies = ['weekly', 'biweekly', 'monthly'] as const;

	for (let i = 0; i < 4; i++) {
		const member = users[i % users.length];
		const freq = frequencies[i % frequencies.length];
		const dayOffset = i;
		const hour = 10 + i * 2;
		const duration = pick([1, 1.5, 2]);

		const protoStart = ptDate(dayOffset - 14, hour);
		const protoEnd = ptDate(dayOffset - 14, hour + duration);

		const [proto] = await db
			.insert(reservation)
			.values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status: 'completed',
				startsAt: protoStart,
				endsAt: protoEnd,
				notes: `Recurring ${freq} practice`
			})
			.returning();

		const rrule = seedRRule(protoStart, freq);

		const [series] = await db
			.insert(recurringSeries)
			.values({
				prototypeType: 'reservation',
				prototypeId: proto.id,
				rrule,
				createdBy: member.id
			})
			.returning();
		rows.push(series);

		await db.run(
			sql`UPDATE reservation SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`
		);

		for (let w = 1; w <= 2; w++) {
			const instStart = ptDate(dayOffset - 14 + w * 7, hour);
			const instEnd = ptDate(dayOffset - 14 + w * 7, hour + duration);
			const status = instStart < new Date() ? 'completed' : 'scheduled';

			await db.insert(reservation).values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status,
				startsAt: instStart,
				endsAt: instEnd,
				notes: `Recurring ${freq} practice`,
				recurringSeriesId: series.id
			});
		}
	}

	{
		const member = users[5];
		const protoStart = ptDate(-21, 14);
		const protoEnd = ptDate(-21, 16);

		const [proto] = await db
			.insert(reservation)
			.values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status: 'completed',
				startsAt: protoStart,
				endsAt: protoEnd,
				notes: 'Cancelled recurring session'
			})
			.returning();

		const rrule = seedRRule(protoStart, 'weekly');

		const [series] = await db
			.insert(recurringSeries)
			.values({
				prototypeType: 'reservation',
				prototypeId: proto.id,
				rrule,
				createdBy: member.id,
				cancelledAt: new Date(Date.now() - 7 * 86400000)
			})
			.returning();
		rows.push(series);

		await db.run(
			sql`UPDATE reservation SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`
		);
	}

	return rows;
}

async function seedPaymentRecords(users: SeedUser[], reservations: SeedReservation[]) {
	console.log('Seeding payment records...');
	const rows = [];

	const payableReservations = reservations
		.filter((r) => ['completed', 'confirmed', 'scheduled'].includes(r.status))
		.slice(0, 25);

	for (const r of payableReservations) {
		const hours = Math.round(((r.endsAt.getTime() - r.startsAt.getTime()) / 3600000) * 2) / 2;
		const amountCents = hours * 1500;
		const method = Math.random() > 0.3 ? 'Cash' : 'Credits';

		const [p] = await db
			.insert(paymentRecord)
			.values({
				id: `pr_seed_${randomUUID().slice(0, 8)}`,
				userId: r.createdByUserId,
				reservationId: r.id,
				stripeCustomerId: `cus_seed${randomInt(1000, 9999)}`,
				amountCents,
				paymentMethod: method,
				status: Math.random() > 0.1 ? 'completed' : 'refunded',
				paidAt: r.startsAt,
				refundedAt: Math.random() > 0.9 ? new Date() : null
			})
			.returning();
		rows.push(p);
	}

	return rows;
}

async function seedTickets(users: SeedUser[], _events: SeedEvent[]) {
	console.log('Seeding tickets...');
	const rows = [];

	const ticketedEvents = await db
		.select({ id: event.id, startsAt: event.startsAt, ticketPrice: event.ticketPrice })
		.from(event)
		.where(eq(event.ticketingEnabled, true));

	for (const evt of ticketedEvents) {
		const ticketCount = randomInt(3, 8);
		const isPast = evt.startsAt < new Date();
		const isFree = !evt.ticketPrice || evt.ticketPrice === 0;

		// Group tickets into 2-3 separate purchases/RSVPs
		const purchaseCount = randomInt(2, 3);
		let remaining = ticketCount;

		for (let p = 0; p < purchaseCount && remaining > 0; p++) {
			const qty = p === purchaseCount - 1 ? remaining : randomInt(1, Math.min(3, remaining));
			remaining -= qty;

			const purchaseId = isFree ? `rsvp-${randomUUID()}` : randomUUID();
			const buyer = pick(users);
			const email = `${buyer.name.toLowerCase().replace(' ', '.')}@example.com`;

			for (let i = 0; i < qty; i++) {
				const code = `${TICKET_CODES_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;
				const checkedIn = isPast && Math.random() > 0.3;

				const [t] = await db
					.insert(ticket)
					.values({
						eventId: evt.id,
						purchaseId,
						userId: buyer.id,
						attendeeName: buyer.name,
						attendeeEmail: email,
						code,
						status: checkedIn ? 'checked_in' : 'valid',
						checkedInAt: checkedIn ? evt.startsAt : null,
						checkedInByUserId: checkedIn ? users[0].id : null
					})
					.returning();
				rows.push(t);
			}
		}
	}

	return rows;
}

async function seedRsvps(users: SeedUser[]) {
	console.log('Seeding RSVPs...');
	const rows = [];

	// RSVPs only apply to non-ticketed events (lightweight headcount, no codes).
	const nonTicketedEvents = await db
		.select({ id: event.id })
		.from(event)
		.where(eq(event.ticketingEnabled, false));

	for (const evt of nonTicketedEvents) {
		// A random, distinct subset of members RSVP (unique per event_id, user_id).
		for (const u of pickN(users, randomInt(2, 8))) {
			const [r] = await db
				.insert(eventRsvp)
				.values({
					eventId: evt.id,
					userId: u.id,
					attendeeName: u.name,
					attendeeEmail: `${u.name.toLowerCase().replace(' ', '.')}@example.com`
				})
				.onConflictDoNothing({ target: [eventRsvp.eventId, eventRsvp.userId] })
				.returning();
			if (r) rows.push(r);
		}
	}

	return rows;
}

async function seedNotifications(users: SeedUser[]) {
	console.log('Seeding notifications...');
	const rows = [];

	const types = [
		{
			type: 'reservation_reminder',
			title: 'Upcoming reservation',
			body: 'Your reservation is tomorrow at 2:00 PM.',
			href: '/member/reservations'
		},
		{
			type: 'confirmation_reminder',
			title: 'Please confirm your reservation',
			body: 'You have an unconfirmed reservation this week.',
			href: '/member/reservations'
		},
		{
			type: 'band_invitation',
			title: 'Band invitation',
			body: "You've been invited to join The Voltage Thieves.",
			href: '/member/bands'
		},
		{
			type: 'band_invitation_accepted',
			title: 'Invitation accepted',
			body: 'Jordan Nguyen accepted your band invitation.',
			href: '/member/bands'
		},
		{
			type: 'recurring_skipped',
			title: 'Recurring reservation skipped',
			body: 'Your weekly reservation was skipped due to a closure.',
			href: '/member/reservations'
		},
		{
			type: 'ticket_confirmation',
			title: 'Tickets confirmed',
			body: 'Your tickets for Open Mic Night are confirmed!',
			href: '/member/tickets'
		},
		{
			type: 'event_cancellation',
			title: 'Event cancelled',
			body: 'Outdoor Festival has been cancelled. Your tickets will be refunded.',
			href: '/member/tickets'
		}
	];

	for (const u of users) {
		const count = randomInt(0, 5);
		const selected = pickN(types, count);

		for (const n of selected) {
			const daysAgo = randomInt(0, 14);
			const createdAt = new Date(Date.now() - daysAgo * 86400000);
			const isRead = Math.random() > 0.4;

			const [row] = await db
				.insert(notification)
				.values({
					userId: u.id,
					type: n.type,
					title: n.title,
					body: n.body,
					href: n.href,
					readAt: isRead ? new Date(createdAt.getTime() + randomInt(1, 24) * 3600000) : null,
					createdAt
				})
				.returning();
			rows.push(row);
		}
	}

	return rows;
}

async function seedNotificationPreferences(users: SeedUser[]) {
	console.log('Seeding notification preferences...');
	const rows = [];
	const configurableTypes = [
		'check_in_reminder',
		'reservation_reminder',
		'confirmation_reminder',
		'band_invitation',
		'band_invitation_accepted',
		'recurring_skipped'
	];

	const customizers = pickN(users, Math.ceil(users.length * 0.3));

	for (const u of customizers) {
		const tweaked = pickN(configurableTypes, randomInt(1, 3));
		for (const nt of tweaked) {
			const [row] = await db
				.insert(notificationPreference)
				.values({
					userId: u.id,
					notificationType: nt,
					emailEnabled: Math.random() > 0.3,
					inAppEnabled: Math.random() > 0.2
				})
				.returning();
			rows.push(row);
		}
	}

	return rows;
}

async function seedMarketing(users: SeedUser[]) {
	console.log('Seeding marketing...');

	const audienceRows = await db
		.insert(audience)
		.values([
			{
				id: randomUUID(),
				name: 'Newsletter',
				slug: 'newsletter',
				description: 'Monthly updates from CorvMC.',
				allowOptIn: true
			},
			{
				id: randomUUID(),
				name: 'Event Updates',
				slug: 'event-updates',
				description: 'Get notified about upcoming shows.',
				allowOptIn: true
			},
			{
				id: randomUUID(),
				name: 'Member Announcements',
				slug: 'member-announcements',
				description: 'Important announcements for members.',
				allowOptIn: false
			},
			{
				id: randomUUID(),
				name: 'Public Updates',
				slug: 'public-updates',
				description: 'General updates and news.',
				allowOptIn: true
			}
		])
		.returning();

	const subscriberRows = await db
		.insert(subscriber)
		.values(users.map((u) => ({ id: randomUUID(), email: u.email, name: u.name, userId: u.id })))
		.returning();

	const externalEmails = [
		'fan1@example.com',
		'fan2@example.com',
		'localpress@example.com',
		'musicblog@example.com',
		'concertgoer@example.com',
		'neighbor@example.com',
		'sponsor@example.com'
	];
	const externalSubs = await db
		.insert(subscriber)
		.values(
			externalEmails.map((email) => ({
				id: randomUUID(),
				email,
				name: email.split('@')[0].replace(/\d+/g, ''),
				userId: null
			}))
		)
		.returning();

	const allSubs = [...subscriberRows, ...externalSubs];

	const membershipRows: {
		id: string;
		subscriberId: string;
		audienceId: string;
		unsubscribedAt: Date | null;
	}[] = [];
	for (const sub of allSubs) {
		for (const aud of audienceRows) {
			if (Math.random() < 0.7) {
				membershipRows.push({
					id: randomUUID(),
					subscriberId: sub.id,
					audienceId: aud.id,
					unsubscribedAt:
						Math.random() < 0.1 ? new Date(Date.now() - Math.random() * 30 * 86400000) : null
				});
			}
		}
	}

	if (membershipRows.length > 0) {
		await batchInsert(audienceMember, membershipRows);
	}

	const adminUser = users[0];

	const sentCampaigns = [
		{
			subject: 'Welcome to the CorvMC Newsletter!',
			markdownBody: '# Welcome!\n\nThanks for subscribing.',
			sentAt: new Date(Date.now() - 14 * 86400000),
			recipientCount: 18
		},
		{
			subject: 'February Events Roundup',
			markdownBody: "# February Events\n\nHere's what happened this month.",
			sentAt: new Date(Date.now() - 7 * 86400000),
			recipientCount: 15
		}
	];

	for (const c of sentCampaigns) {
		const [row] = await db
			.insert(campaign)
			.values({
				id: randomUUID(),
				subject: c.subject,
				markdownBody: c.markdownBody,
				htmlBody: `<p>${c.markdownBody.replace(/\n/g, '</p><p>')}</p>`,
				scheduledFor: c.sentAt,
				sentAt: c.sentAt,
				sentById: adminUser.id,
				recipientCount: c.recipientCount
			})
			.returning();
		await db.insert(campaignAudience).values([
			{ campaignId: row.id, audienceId: audienceRows[0].id },
			{ campaignId: row.id, audienceId: audienceRows[1].id }
		]);
	}

	const [scheduled] = await db
		.insert(campaign)
		.values({
			id: randomUUID(),
			subject: 'Upcoming: Spring Concert Series',
			markdownBody: '# Spring Concert Series\n\nMore details coming soon.',
			htmlBody: '<p>Spring Concert Series preview</p>',
			scheduledFor: new Date(Date.now() + 3 * 86400000),
			sentAt: null,
			sentById: adminUser.id,
			recipientCount: null
		})
		.returning();
	await db.insert(campaignAudience).values([
		{ campaignId: scheduled.id, audienceId: audienceRows[0].id },
		{ campaignId: scheduled.id, audienceId: audienceRows[3].id }
	]);

	const [draft1] = await db
		.insert(campaign)
		.values({
			id: randomUUID(),
			subject: 'New Practice Room Hours',
			markdownBody: '# Updated Hours\n\nPractice rooms available until 11pm on weekends.',
			htmlBody: '<p>Draft</p>',
			scheduledFor: null,
			sentAt: null,
			sentById: adminUser.id,
			recipientCount: null
		})
		.returning();
	await db
		.insert(campaignAudience)
		.values({ campaignId: draft1.id, audienceId: audienceRows[2].id });

	const [draft2] = await db
		.insert(campaign)
		.values({
			id: randomUUID(),
			subject: 'Volunteer Opportunities',
			markdownBody: "# Help Out at CorvMC\n\nWe're looking for volunteers.",
			htmlBody: '<p>Draft</p>',
			scheduledFor: null,
			sentAt: null,
			sentById: adminUser.id,
			recipientCount: null
		})
		.returning();
	await db
		.insert(campaignAudience)
		.values({ campaignId: draft2.id, audienceId: audienceRows[0].id });

	return {
		audiences: audienceRows.length,
		subscribers: allSubs.length,
		memberships: membershipRows.length,
		campaigns: sentCampaigns.length + 3
	};
}

async function seedEquipment(users: SeedUser[]) {
	console.log('Seeding equipment...');

	const categories = await db
		.insert(equipmentCategory)
		.values([
			{ id: randomUUID(), name: 'Guitars', displayOrder: 0, pricingTier: 'major' },
			{ id: randomUUID(), name: 'Amplifiers', displayOrder: 1, pricingTier: 'major' },
			{ id: randomUUID(), name: 'Microphones', displayOrder: 2, pricingTier: 'major' },
			{ id: randomUUID(), name: 'Drum Hardware', displayOrder: 3, pricingTier: 'major' },
			{ id: randomUUID(), name: 'Cables & Accessories', displayOrder: 4, pricingTier: 'accessory' }
		])
		.returning();

	const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

	const items = await batchInsert(
		equipment,
		[
			{
				id: randomUUID(),
				name: 'Fender Stratocaster',
				description: 'Sunburst finish, maple neck.',
				categoryId: catByName['Guitars'],
				totalQuantity: 1,
				serialNumber: 'FEN-STR-2019-0041',
				resourceId: 'EQ-001',
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Gibson Les Paul Standard',
				description: 'Cherry burst.',
				categoryId: catByName['Guitars'],
				totalQuantity: 1,
				serialNumber: 'GIB-LP-2021-1187',
				resourceId: 'EQ-002',
				condition: 'excellent',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Ibanez SR500 Bass',
				description: '4-string active bass.',
				categoryId: catByName['Guitars'],
				totalQuantity: 1,
				serialNumber: 'IBZ-SR5-2020-0223',
				resourceId: 'EQ-003',
				condition: 'fair',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Fender Blues Deluxe',
				description: '40W tube combo.',
				categoryId: catByName['Amplifiers'],
				totalQuantity: 1,
				serialNumber: 'FEN-BD-2018-0912',
				resourceId: 'EQ-004',
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Orange CR120 Head + 4x12 Cab',
				description: 'Solid state 120W.',
				categoryId: catByName['Amplifiers'],
				totalQuantity: 1,
				serialNumber: 'ORG-CR120-2022-0055',
				resourceId: 'EQ-005',
				condition: 'excellent',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'QSC K12.2 Powered Speaker',
				description: '2000W powered PA speaker.',
				categoryId: catByName['Amplifiers'],
				totalQuantity: 2,
				resourceId: 'EQ-006',
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Shure SM58',
				description: 'Dynamic vocal mic.',
				categoryId: catByName['Microphones'],
				totalQuantity: 6,
				outOfOrderQuantity: 1,
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Shure SM57',
				description: 'Instrument mic.',
				categoryId: catByName['Microphones'],
				totalQuantity: 4,
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'AKG P420 Condenser',
				description: 'Large-diaphragm condenser.',
				categoryId: catByName['Microphones'],
				totalQuantity: 2,
				resourceId: 'EQ-009',
				condition: 'excellent',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'DW 5000 Kick Pedal',
				description: 'Single chain drive.',
				categoryId: catByName['Drum Hardware'],
				totalQuantity: 2,
				condition: 'fair',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Snare Stand',
				description: 'Heavy-duty double-braced.',
				categoryId: catByName['Drum Hardware'],
				totalQuantity: 3,
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'XLR Cable (25ft)',
				description: 'Standard balanced XLR.',
				categoryId: catByName['Cables & Accessories'],
				totalQuantity: 12,
				outOfOrderQuantity: 2,
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Instrument Cable (15ft)',
				description: '1/4" TS cable.',
				categoryId: catByName['Cables & Accessories'],
				totalQuantity: 8,
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Mic Stand (Boom)',
				description: 'Tripod base with boom arm.',
				categoryId: catByName['Cables & Accessories'],
				totalQuantity: 6,
				outOfOrderQuantity: 1,
				condition: 'good',
				status: 'available'
			},
			{
				id: randomUUID(),
				name: 'Yamaha MG10XU Mixer',
				description: '10-channel mixer. Being repaired.',
				categoryId: catByName['Amplifiers'],
				totalQuantity: 1,
				serialNumber: 'YAM-MG10-2020-0331',
				resourceId: 'EQ-015',
				condition: 'poor',
				status: 'maintenance'
			}
		],
		5
	);

	const itemByName = Object.fromEntries(items.map((i) => [i.name, i]));
	const now = new Date();
	const day = 86400000;

	const loans = await batchInsert(
		equipmentLoan,
		[
			{
				id: randomUUID(),
				equipmentId: itemByName['Fender Stratocaster'].id,
				userId: users[0].id,
				quantity: 1,
				requestedPickupDate: new Date(now.getTime() - 10 * day),
				scheduledPickupDate: new Date(now.getTime() - 9 * day),
				dueDate: new Date(now.getTime() + 3 * day),
				checkedOutAt: new Date(now.getTime() - 9 * day),
				status: 'checked_out',
				dailyRateCents: 500,
				memberNotes: 'Need it for a gig this weekend'
			},
			{
				id: randomUUID(),
				equipmentId: itemByName['Shure SM58'].id,
				userId: users[1].id,
				quantity: 2,
				requestedPickupDate: new Date(now.getTime() - 14 * day),
				scheduledPickupDate: new Date(now.getTime() - 13 * day),
				dueDate: new Date(now.getTime() - 2 * day),
				checkedOutAt: new Date(now.getTime() - 13 * day),
				status: 'checked_out',
				dailyRateCents: 500
			},
			{
				id: randomUUID(),
				equipmentId: itemByName['Gibson Les Paul Standard'].id,
				userId: users[2].id,
				quantity: 1,
				requestedPickupDate: new Date(now.getTime() + 2 * day),
				status: 'requested',
				memberNotes: 'Would love to try this for a recording session'
			},
			{
				id: randomUUID(),
				equipmentId: itemByName['QSC K12.2 Powered Speaker'].id,
				userId: users[3].id,
				quantity: 1,
				requestedPickupDate: new Date(now.getTime() + 1 * day),
				scheduledPickupDate: new Date(now.getTime() + 1 * day),
				status: 'scheduled',
				memberNotes: 'Need for band practice'
			},
			{
				id: randomUUID(),
				equipmentId: null,
				userId: users[4].id,
				quantity: 1,
				requestedPickupDate: new Date(now.getTime() + 3 * day),
				status: 'requested',
				memberNotes: 'Looking for a bass amp 300W+'
			},
			{
				id: randomUUID(),
				equipmentId: itemByName['Fender Blues Deluxe'].id,
				userId: users[0].id,
				quantity: 1,
				requestedPickupDate: new Date(now.getTime() - 30 * day),
				scheduledPickupDate: new Date(now.getTime() - 29 * day),
				dueDate: new Date(now.getTime() - 22 * day),
				checkedOutAt: new Date(now.getTime() - 29 * day),
				returnedAt: new Date(now.getTime() - 23 * day),
				status: 'returned',
				dailyRateCents: 500,
				totalChargeCents: 3000,
				creditsCents: 2000,
				cashCents: 1000,
				staffNotes: 'Returned in good condition'
			},
			{
				id: randomUUID(),
				equipmentId: itemByName['XLR Cable (25ft)'].id,
				userId: users[1].id,
				quantity: 3,
				requestedPickupDate: new Date(now.getTime() - 20 * day),
				scheduledPickupDate: new Date(now.getTime() - 19 * day),
				dueDate: new Date(now.getTime() - 15 * day),
				checkedOutAt: new Date(now.getTime() - 19 * day),
				returnedAt: new Date(now.getTime() - 16 * day),
				status: 'returned',
				dailyRateCents: 0,
				totalChargeCents: 0,
				creditsCents: 0,
				cashCents: 0,
				staffNotes: 'Sustaining member — accessories free'
			},
			{
				id: randomUUID(),
				equipmentId: itemByName['AKG P420 Condenser'].id,
				userId: users[5].id,
				quantity: 1,
				requestedPickupDate: new Date(now.getTime() - 7 * day),
				status: 'cancelled'
			}
		],
		3
	);

	return { categories: categories.length, items: items.length, loans: loans.length };
}

// ---------------------------------------------------------------------------
// Help Articles
// ---------------------------------------------------------------------------

async function seedHelp() {
	const cats = await batchInsert(
		helpCategory,
		[
			{
				name: 'Getting Started',
				slug: 'getting-started',
				description: 'Learn the basics of your membership',
				icon: 'book',
				sortOrder: 0,
				minRole: 'member'
			},
			{
				name: 'Reservations',
				slug: 'reservations',
				description: 'Booking rooms and managing your time',
				icon: 'calendar',
				sortOrder: 1,
				minRole: 'member'
			},
			{
				name: 'Bands',
				slug: 'bands',
				description: 'Creating and managing bands',
				icon: 'music',
				sortOrder: 3,
				minRole: 'member'
			},
			{
				name: 'Staff Guide',
				slug: 'staff-guide',
				description: 'Operations and admin tasks',
				icon: 'settings',
				sortOrder: 8,
				minRole: 'staff'
			},
			{
				name: 'Profile & Directory',
				slug: 'profile-directory',
				description: 'Your profile, visibility, and being found',
				icon: 'user',
				sortOrder: 2,
				minRole: 'member'
			},
			{
				name: 'Band Pages (Premium)',
				slug: 'band-pages',
				description: 'Premium band websites, page editor, and press kit',
				icon: 'layout',
				sortOrder: 4,
				minRole: 'member'
			},
			{
				name: 'Events & Tickets',
				slug: 'events-tickets',
				description: 'Browsing events, buying tickets, and check-in',
				icon: 'ticket',
				sortOrder: 5,
				minRole: 'member'
			},
			{
				name: 'Equipment Lending',
				slug: 'equipment',
				description: 'Borrowing gear from the lending library',
				icon: 'package',
				sortOrder: 6,
				minRole: 'member'
			},
			{
				name: 'Membership & Billing',
				slug: 'membership',
				description: 'Sustaining membership, benefits, and billing',
				icon: 'heart',
				sortOrder: 7,
				minRole: 'member'
			}
		],
		9
	);

	const articles = await batchInsert(
		helpArticle,
		[
			{
				categoryId: cats[0].id,
				title: 'Welcome to CorvMC',
				slug: 'welcome',
				summary: 'An overview of your membership and what you can do.',
				content:
					'## Welcome\n\nCorvMC is a community music space where you can book rehearsal rooms, connect with other musicians, and join bands.\n\n## What You Can Do\n\n- **Book Reservations** — Reserve practice rooms by the hour\n- **Join the Directory** — Share your instruments and genres so others can find you\n- **Create or Join Bands** — Collaborate with other members\n- **Attend Events** — Check out shows and community events',
				source: 'static',
				minRole: 'member',
				published: true,
				sortOrder: 0
			},
			{
				categoryId: cats[0].id,
				title: 'Your Profile',
				slug: 'your-profile',
				summary: 'How to set up and customize your member profile.',
				content:
					'## Your Profile\n\nYour profile helps other members find you in the directory.\n\n### What to Add\n\n- **Instruments** — What do you play?\n- **Genres** — What styles are you into?\n- **Looking for a band** — Toggle this to show up in searches\n\n### Updating Your Profile\n\nNavigate to your account settings to update your display name, pronouns, and contact info.',
				source: 'static',
				minRole: 'member',
				published: true,
				sortOrder: 1
			},
			{
				categoryId: cats[1].id,
				title: 'Booking a Session',
				slug: 'booking-a-session',
				summary: 'How to reserve practice time at the studio.',
				content:
					'## Booking a Session\n\nYou can book a rehearsal room from your member dashboard.\n\n### How to Book\n\n1. Navigate to **Reservations** in the sidebar\n2. Select an available time slot\n3. Choose the duration (1-4 hours)\n4. Confirm your booking\n\n### Cancellation Policy\n\nYou can cancel up to 24 hours before the start time without charge.',
				source: 'static',
				minRole: 'member',
				published: true,
				sortOrder: 0
			},
			{
				categoryId: cats[1].id,
				title: 'Recurring Reservations',
				slug: 'recurring-reservations',
				summary: 'Set up weekly or biweekly practice schedules.',
				content:
					'## Recurring Reservations\n\nIf you practice at the same time each week, set up a recurring reservation.\n\n### How It Works\n\n- Choose weekly, biweekly, or monthly frequency\n- Recurring reservations are created in advance\n- You can skip individual occurrences without cancelling the series\n\n### Eligibility\n\nRecurring reservations are available to sustaining members and above.',
				source: 'static',
				minRole: 'member',
				published: true,
				sortOrder: 1
			},
			{
				categoryId: cats[2].id,
				title: 'Creating a Band',
				slug: 'creating-a-band',
				summary: 'How to create a band and invite members.',
				content:
					'## Creating a Band\n\nBands allow you to share a practice schedule and coordinate with other members.\n\n### Steps\n\n1. Go to **My Bands** in the sidebar\n2. Click **Create Band**\n3. Name your band and add a bio\n4. Invite members by searching the directory\n\n### Roles\n\n- **Owner** — Full control, can delete the band\n- **Admin** — Can manage members and book on behalf of the band\n- **Member** — Can view the schedule and band info',
				source: 'static',
				minRole: 'member',
				published: true,
				sortOrder: 0
			},
			{
				categoryId: cats[3].id,
				title: 'Managing Reservations',
				slug: 'staff-managing-reservations',
				summary: 'How to confirm, complete, and resolve reservations.',
				content:
					"## Managing Reservations\n\nAs staff, you can manage all member reservations.\n\n### Actions\n\n- **Confirm** — Approve a pending reservation\n- **Complete** — Mark as done after the session\n- **No-show** — Mark if the member didn't arrive\n- **Cancel** — Cancel with an optional reason\n\n### Resolving Issues\n\nUse the Resolve panel to handle unresolved reservations (past their end time but not completed).",
				source: 'static',
				minRole: 'staff',
				published: true,
				sortOrder: 0
			}
		],
		6
	);

	return { categories: cats.length, articles: articles.length };
}

// ---------------------------------------------------------------------------
// Inbox threads
// ---------------------------------------------------------------------------

async function seedInbox(adminUser: SeedUser) {
	const now = new Date();
	const hour = 3600_000;
	const day = 24 * hour;

	const threads = await batchInsert(
		inboxThread,
		[
			{
				id: randomUUID(),
				channel: 'web' as const,
				status: 'open' as const,
				subject: 'General Inquiry',
				preview:
					'Hi, I was wondering about your membership options and pricing. Do you offer student discounts?',
				contactName: 'Sarah Chen',
				contactEmail: 'sarah.chen@example.com',
				messageCount: 2,
				lastMessageAt: new Date(now.getTime() - 2 * hour),
				createdAt: new Date(now.getTime() - day),
				updatedAt: new Date(now.getTime() - 2 * hour)
			},
			{
				id: randomUUID(),
				channel: 'web' as const,
				status: 'open' as const,
				subject: 'Performance Inquiry',
				preview:
					'We are a 5-piece indie rock band looking to book a show at your venue. We have a press kit available.',
				contactName: 'Marcus Rivera',
				contactEmail: 'marcus@thelateshift.band',
				messageCount: 1,
				lastMessageAt: new Date(now.getTime() - 6 * hour),
				createdAt: new Date(now.getTime() - 6 * hour),
				updatedAt: new Date(now.getTime() - 6 * hour)
			},
			{
				id: randomUUID(),
				channel: 'email' as const,
				status: 'open' as const,
				subject: 'Broken mic stand in Room B',
				preview:
					"Hey, just a heads up that the mic stand in Room B has a stripped threading and won't tighten.",
				contactName: 'Jordan Lee',
				contactEmail: 'jordan.lee@gmail.com',
				messageCount: 3,
				lastMessageAt: new Date(now.getTime() - 12 * hour),
				createdAt: new Date(now.getTime() - 2 * day),
				updatedAt: new Date(now.getTime() - 12 * hour)
			},
			{
				id: randomUUID(),
				channel: 'web' as const,
				status: 'resolved' as const,
				subject: 'Volunteer Opportunities',
				preview: "Thanks for the info! I'll sign up for the next orientation session.",
				contactName: 'Priya Patel',
				contactEmail: 'priya.p@outlook.com',
				messageCount: 4,
				lastMessageAt: new Date(now.getTime() - 3 * day),
				createdAt: new Date(now.getTime() - 5 * day),
				updatedAt: new Date(now.getTime() - 3 * day)
			},
			{
				id: randomUUID(),
				channel: 'sms' as const,
				status: 'open' as const,
				preview: "Is the studio open tomorrow? Google says you're closed on Mondays.",
				contactName: null,
				contactPhone: '+15415551234',
				messageCount: 1,
				lastMessageAt: new Date(now.getTime() - hour),
				createdAt: new Date(now.getTime() - hour),
				updatedAt: new Date(now.getTime() - hour)
			}
		],
		5
	);

	const messages = await batchInsert(
		inboxMessage,
		[
			// Thread 1: Sarah Chen contact form
			{
				id: randomUUID(),
				threadId: threads[0].id,
				direction: 'inbound' as const,
				body: 'Hi, I was wondering about your membership options and pricing. Do you offer student discounts?',
				authorName: 'Sarah Chen',
				createdAt: new Date(now.getTime() - day)
			},
			{
				id: randomUUID(),
				threadId: threads[0].id,
				direction: 'outbound' as const,
				body: 'Hi Sarah! Yes, we offer a free membership tier and discounted rates for students with a valid .edu email. Check out our membership page for details!',
				authorName: adminUser.name,
				authorUserId: adminUser.id,
				createdAt: new Date(now.getTime() - 2 * hour)
			},

			// Thread 2: Marcus performance inquiry
			{
				id: randomUUID(),
				threadId: threads[1].id,
				direction: 'inbound' as const,
				body: "We are a 5-piece indie rock band looking to book a show at your venue. We have a press kit available. Our EPK is at thelateshift.band/press. We're free most weekends in June and July.",
				authorName: 'Marcus Rivera',
				createdAt: new Date(now.getTime() - 6 * hour)
			},

			// Thread 3: Jordan equipment report
			{
				id: randomUUID(),
				threadId: threads[2].id,
				direction: 'inbound' as const,
				body: "Hey, just a heads up that the mic stand in Room B has a stripped threading and won't tighten. It was like that when I arrived for my 2pm session.",
				authorName: 'Jordan Lee',
				createdAt: new Date(now.getTime() - 2 * day)
			},
			{
				id: randomUUID(),
				threadId: threads[2].id,
				direction: 'outbound' as const,
				body: "Thanks for letting us know, Jordan. We'll get that replaced. Sorry for the inconvenience!",
				authorName: adminUser.name,
				authorUserId: adminUser.id,
				createdAt: new Date(now.getTime() - day)
			},
			{
				id: randomUUID(),
				threadId: threads[2].id,
				direction: 'inbound' as const,
				body: 'No worries, I just used Room A instead. Thanks for the quick response!',
				authorName: 'Jordan Lee',
				createdAt: new Date(now.getTime() - 12 * hour)
			},

			// Thread 4: Priya volunteer (resolved)
			{
				id: randomUUID(),
				threadId: threads[3].id,
				direction: 'inbound' as const,
				body: "Hi! I'm interested in volunteering at CorvMC. What opportunities do you have available?",
				authorName: 'Priya Patel',
				createdAt: new Date(now.getTime() - 5 * day)
			},
			{
				id: randomUUID(),
				threadId: threads[3].id,
				direction: 'outbound' as const,
				body: "Hey Priya! We'd love to have you. We have sound engineer, event setup, and front desk volunteer roles. Would any of those interest you?",
				authorName: adminUser.name,
				authorUserId: adminUser.id,
				createdAt: new Date(now.getTime() - 4 * day)
			},
			{
				id: randomUUID(),
				threadId: threads[3].id,
				direction: 'inbound' as const,
				body: 'Sound engineering sounds amazing! How do I get started?',
				authorName: 'Priya Patel',
				createdAt: new Date(now.getTime() - 4 * day + hour)
			},
			{
				id: randomUUID(),
				threadId: threads[3].id,
				direction: 'outbound' as const,
				body: 'Great choice! We run orientation sessions on the first Saturday of each month. Sign up at our events page. See you there!',
				authorName: adminUser.name,
				authorUserId: adminUser.id,
				createdAt: new Date(now.getTime() - 3 * day)
			},

			// Thread 5: SMS about hours
			{
				id: randomUUID(),
				threadId: threads[4].id,
				direction: 'inbound' as const,
				body: "Is the studio open tomorrow? Google says you're closed on Mondays.",
				createdAt: new Date(now.getTime() - hour)
			}
		],
		12
	);

	// Add a staff note to thread 3
	const notes = await batchInsert(
		inboxNote,
		[
			{
				id: randomUUID(),
				threadId: threads[2].id,
				authorUserId: adminUser.id,
				body: 'Ordered replacement mic stand from Sweetwater — should arrive Thursday.',
				createdAt: new Date(now.getTime() - 18 * hour)
			}
		],
		1
	);

	return { threads: threads.length, messages: messages.length, notes: notes.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('\nStarting dev seed...\n');

	await deleteAll();

	const roles = await seedRoles();
	const adminUser = await seedAdminUser();
	const users = await seedUsers(20);
	await seedUserRoles(users, adminUser, roles);
	const allUsers = [adminUser, ...users];
	const reservations = await seedReservations(allUsers);
	await seedClosures();
	const events = await seedEvents(allUsers);
	const bands = await seedBands(allUsers);
	const bandEvents = await seedBandEvents(bands, allUsers);
	const pageConfigs = await seedBandPageConfigs(bands);
	const series = await seedRecurringSeries(allUsers);
	const payments = await seedPaymentRecords(allUsers, reservations);
	const tickets = await seedTickets(allUsers, events);
	const rsvps = await seedRsvps(allUsers);
	const notifications = await seedNotifications(allUsers);
	const preferences = await seedNotificationPreferences(allUsers);
	await seedCreditTransactions(allUsers);
	const marketing = await seedMarketing(allUsers);
	const eq = await seedEquipment(allUsers);
	const help = await seedHelp();
	const inbox = await seedInbox(adminUser);
	const flags = await seedContentFlags(allUsers, bands);

	await db.run(sql`PRAGMA foreign_keys = ON`);

	const premiumBands = bands.filter((b: any) => b.tier === 'premium' && !b.deletedAt);
	console.log('\nSeed complete:');
	console.log(`  ${allUsers.length} users (admin: admin@corvallismusic.org / password)`);
	console.log(`  ${roles.length} roles`);
	console.log(`  ${reservations.length} reservations`);
	console.log(`  ${events.length} CMC events`);
	console.log(`  ${bands.length} bands (${premiumBands.length} premium)`);
	console.log(`  ${bandEvents.length} band events`);
	console.log(`  ${pageConfigs.length} band page configs with EPK data`);
	console.log(`  ${series.length} recurring series`);
	console.log(`  ${payments.length} payment records`);
	console.log(`  ${tickets.length} tickets`);
	console.log(`  ${rsvps.length} RSVPs`);
	console.log(`  ${notifications.length} notifications`);
	console.log(`  ${preferences.length} notification preferences`);
	console.log(
		`  ${marketing.audiences} audiences, ${marketing.subscribers} subscribers, ${marketing.campaigns} campaigns`
	);
	console.log(
		`  ${eq.categories} equipment categories, ${eq.items} equipment items, ${eq.loans} loans`
	);
	console.log(`  ${help.categories} help categories, ${help.articles} help articles`);
	console.log(`  ${inbox.threads} inbox threads, ${inbox.messages} messages, ${inbox.notes} notes`);
	console.log(`  ${flags.length} content flags`);
	console.log('\n  Premium band pages available at:');
	for (const b of premiumBands) {
		console.log(`    http://localhost:5173/?__band_subdomain=${b.slug}`);
	}

	await dispose();
}

async function seedContentFlags(users: any[], bands: any[]) {
	console.log('Seeding content flags...');
	const REASONS = [
		'Inappropriate language in bio',
		'Possible impersonation',
		'Spam links in profile',
		'Offensive band name',
		'Outdated / misleading info'
	];
	const STATUSES = ['pending', 'pending', 'pending', 'resolved', 'dismissed'] as const;
	const rows = [];

	for (let i = 0; i < 5; i++) {
		const reporter = users[i % users.length];
		const flagBand = i % 2 === 0 && bands.length > 0;
		const target = flagBand ? pick(bands) : pick(users.filter((u) => u.id !== reporter.id));
		const status = STATUSES[i];
		const resolved = status !== 'pending';

		const [row] = await db
			.insert(contentFlag)
			.values({
				entityType: flagBand ? 'band_profile' : 'member_profile',
				entityId: target.id,
				reportedByUserId: reporter.id,
				reason: REASONS[i],
				description: i % 3 === 0 ? 'Flagged via the directory report button.' : null,
				status,
				resolvedByUserId: resolved ? users[0].id : null,
				resolutionNotes: resolved
					? status === 'resolved'
						? 'Content edited.'
						: 'No action needed.'
					: null,
				resolvedAt: resolved ? new Date() : null
			})
			.returning();
		rows.push(row);
	}

	return rows;
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
