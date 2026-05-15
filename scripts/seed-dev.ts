/**
 * Seed the database with fake data for UI development.
 *
 * Usage:
 *   npx tsx scripts/seed-dev.ts
 *
 * This is DESTRUCTIVE — it truncates all app tables and rebuilds from scratch.
 * Do not run against production.
 *
 * Prerequisites:
 *   - DATABASE_URL env var set
 *   - Migrations already applied (npx drizzle-kit migrate)
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { user, account } from '../src/lib/server/db/schema/auth';
import { role, modelHasRole } from '../src/lib/server/db/schema/authorization';
import { reservation, closure } from '../src/lib/server/db/schema/reservation';
import { recurringSeries } from '../src/lib/server/db/schema/recurring';
import { event } from '../src/lib/server/db/schema/event';
import { ticket } from '../src/lib/server/db/schema/ticket';
import { productConfig } from '../src/lib/server/db/schema/product-config';
import { creditTransaction, paymentRecord } from '../src/lib/server/db/schema/finance';
import { notification, notificationPreference } from '../src/lib/server/db/schema/notification';
import { band, bandMember } from '../src/lib/server/db/schema/band';
import {
	subscriber,
	audience,
	audienceMember,
	campaign,
	campaignAudience
} from '../src/lib/server/db/schema/marketing';
// Build RRULE strings inline to avoid pulling rrule CJS dependency into seed script
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

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

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

/** Returns a Date in America/Los_Angeles at the given hour offset from today */
function ptDate(daysOffset: number, hour: number, minute = 0): Date {
	const d = new Date();
	d.setDate(d.getDate() + daysOffset);
	// Build an ISO string in PT then parse. We approximate PT as UTC-7.
	d.setUTCHours(hour + 7, minute, 0, 0);
	return d;
}

// ---------------------------------------------------------------------------
// Data pools
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
	'Alex', 'Jordan', 'Casey', 'Morgan', 'Taylor', 'Riley', 'Quinn',
	'Avery', 'Dakota', 'Reese', 'Skyler', 'Finley', 'Rowan', 'Sage',
	'Charlie', 'Emerson', 'Hayden', 'Parker', 'Blake', 'Jamie'
];

const LAST_NAMES = [
	'Chen', 'Rivera', 'Nguyen', 'Kowalski', 'Okafor', 'Singh', 'Larsson',
	'Fernandez', 'Tanaka', 'Dubois', 'Kim', 'Petrov', 'Anderson', 'Reyes',
	'Washington', 'Murphy', 'Cohen', 'Yamamoto', 'Santos', 'Berg'
];

const PRONOUNS = ['he/him', 'she/her', 'they/them', null, null];

const EVENT_TITLES = [
	'Open Mic Night', 'Jazz Jam Session', 'Songwriting Workshop',
	'Battle of the Bands', 'Acoustic Showcase', 'Electronic Music Night',
	'Blues & Brews', 'Hip-Hop Cypher', 'Classical Recital',
	'Punk Rock Matinee', 'Folk Circle', 'Album Release Party',
	'Music Theory Workshop', 'Guitar Clinic', 'Drum Circle',
	'Singer-Songwriter Night', 'Funk & Soul Revue', 'Latin Night'
];

const EVENT_TAGS_POOL = [
	'open mic', 'workshop', 'jam', 'showcase', 'all ages',
	'21+', 'free', 'ticketed', 'community', 'genre night'
];

const CLOSURE_REASONS = [
	'Building maintenance', 'Holiday closure', 'Staff retreat',
	'Private rental', 'Deep cleaning', 'Equipment installation',
	'Electrical work', 'Plumbing repair'
];

const CREDIT_TYPES = ['free_hours', 'equipment'];

const BAND_NAMES = [
	'The Voltage Thieves', 'Half Past Never', 'Cardboard Satellites',
	'Velvet Brake', 'Tin Whisker', 'Slow Catastrophe',
	'Paper Wolves', 'The After Math'
];

const BAND_POSITIONS = [
	'Guitar', 'Bass', 'Drums', 'Vocals', 'Keys',
	'Saxophone', 'Violin', 'Cello', 'Trumpet'
];

const TICKET_CODES_PREFIX = 'TIX';

const INSTRUMENTS = [
	'guitar', 'bass', 'drums', 'vocals', 'keys', 'piano',
	'saxophone', 'violin', 'cello', 'trumpet', 'trombone',
	'flute', 'banjo', 'mandolin', 'harmonica', 'ukulele',
	'synthesizer', 'turntables', 'percussion'
];

const GENRES = [
	'jazz', 'rock', 'funk', 'blues', 'folk', 'indie',
	'electronic', 'hip-hop', 'classical', 'punk', 'metal',
	'r&b', 'soul', 'country', 'reggae', 'latin',
	'world', 'experimental', 'pop', 'ambient'
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

const MEMBER_BIOS = [
	'Been playing since I was 12. Love jamming with new people.',
	'Studied music at OSU. Currently in two bands but always looking for side projects.',
	'Self-taught guitarist. Into anything with a good groove.',
	'Professional session musician. Available for recording and live gigs.',
	'Just moved to Corvallis and looking to connect with local musicians.',
	'Weekend warrior. Day job in tech, music is my therapy.',
	null, null, null
];

const SAMPLE_LINKS = [
	{ label: 'My SoundCloud', url: 'https://soundcloud.com/example/tracks' },
	{ label: 'YouTube Channel', url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
	{ label: 'Spotify', url: 'https://open.spotify.com/artist/example' },
	{ label: 'Bandcamp', url: 'https://example.bandcamp.com/album/demo' },
	{ label: 'Instagram', url: 'https://instagram.com/musician' },
	{ label: 'Personal Site', url: 'https://example.com' }
];

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function truncateAll() {
	console.log('Truncating all tables...');
	await db.execute(sql`
		TRUNCATE TABLE
			campaign_audience,
			campaign,
			audience_member,
			audience,
			subscriber,
			notification_preference,
			notification,
			ticket,
			band_member,
			band,
			payment_record,
			credit_transaction,
			recurring_series,
			event,
			closure,
			reservation,
			model_has_roles,
			model_has_permissions,
			role_has_permissions,
			roles,
			permissions,
			product_config,
			session,
			account,
			verification,
			"user"
		CASCADE
	`);
}

async function seedRoles() {
	console.log('Seeding roles...');
	const roles = ['admin', 'staff', 'member', 'volunteer'];
	const inserted = [];
	for (const name of roles) {
		const [r] = await db.insert(role).values({ name, guardName: 'web' }).returning();
		inserted.push(r);
	}
	return inserted;
}

async function seedUsers(count: number) {
	console.log(`Seeding ${count} users...`);
	const users = [];
	const usedEmails = new Set<string>();

	for (let i = 0; i < count; i++) {
		const first = pick(FIRST_NAMES);
		const last = pick(LAST_NAMES);
		const name = `${first} ${last}`;
		let email = `${first.toLowerCase()}.${last.toLowerCase()}@example.com`;

		// Ensure unique emails
		let suffix = 1;
		while (usedEmails.has(email)) {
			email = `${first.toLowerCase()}.${last.toLowerCase()}${suffix}@example.com`;
			suffix++;
		}
		usedEmails.add(email);

		const id = randomUUID();
		const createdAt = new Date(Date.now() - randomInt(7, 365) * 86400000);

		// Profile data: ~70% of users have some profile info
		const hasProfile = Math.random() > 0.3;
		const memberInstruments = hasProfile ? pickN(INSTRUMENTS, randomInt(1, 3)) : null;
		const memberGenres = hasProfile ? pickN(GENRES, randomInt(1, 3)) : null;
		const memberLinks = hasProfile && Math.random() > 0.4
			? pickN(SAMPLE_LINKS, randomInt(1, 3))
			: null;
		const visibility = !hasProfile ? 'hidden' : Math.random() > 0.6 ? 'public' : 'members';

		const [u] = await db.insert(user).values({
			id,
			name,
			email,
			emailVerified: true,
			pronouns: pick(PRONOUNS),
			phone: Math.random() > 0.4 ? `541-555-${String(randomInt(1000, 9999))}` : null,
			credits: { free_hours: randomInt(0, 8), equipment: randomInt(0, 3) },
			bio: hasProfile ? pick(MEMBER_BIOS) : null,
			tagline: hasProfile ? pick(TAGLINES) : null,
			instruments: memberInstruments,
			genres: memberGenres,
			lookingForBand: hasProfile && Math.random() > 0.7,
			directoryVisibility: visibility,
			directoryContact: visibility === 'public' ? { email } : null,
			links: memberLinks,
			createdAt,
			updatedAt: createdAt
		}).returning();

		users.push(u);
	}
	return users;
}

interface SeedRole { id: number; name: string }
interface SeedUser { id: string; name: string }
interface SeedEvent { id: string; status: string; startsAt: Date }
interface SeedReservation { id: string; createdByUserId: string; startsAt: Date; endsAt: Date; status: string }

async function seedAdminUser(): Promise<SeedUser> {
	console.log('Seeding admin user (admin@corvallismusic.org)...');
	const id = randomUUID();
	const now = new Date();
	const hashedPassword = await hashPassword('password');

	const [adminUser] = await db.insert(user).values({
		id,
		name: 'Admin',
		email: 'admin@corvallismusic.org',
		emailVerified: true,
		createdAt: now,
		updatedAt: now
	}).returning();

	await db.insert(account).values({
		id: randomUUID(),
		accountId: id,
		providerId: 'credential',
		userId: id,
		password: hashedPassword,
		createdAt: now,
		updatedAt: now
	});

	return adminUser;
}

async function seedUserRoles(users: SeedUser[], adminUser: SeedUser, roles: SeedRole[]) {
	console.log('Assigning roles...');
	const adminRole = roles.find((r) => r.name === 'admin')!;
	const staffRole = roles.find((r) => r.name === 'staff')!;
	const memberRole = roles.find((r) => r.name === 'member')!;
	const volunteerRole = roles.find((r) => r.name === 'volunteer')!;

	// Admin user gets admin + staff + member
	await db.insert(modelHasRole).values([
		{ roleId: adminRole.id, userId: adminUser.id },
		{ roleId: staffRole.id, userId: adminUser.id },
		{ roleId: memberRole.id, userId: adminUser.id }
	]);

	// First 2 fake users are also admin + staff
	for (let i = 0; i < 2; i++) {
		await db.insert(modelHasRole).values([
			{ roleId: adminRole.id, userId: users[i].id },
			{ roleId: staffRole.id, userId: users[i].id }
		]);
	}

	// Next 3 are staff only
	for (let i = 2; i < 5; i++) {
		await db.insert(modelHasRole).values({ roleId: staffRole.id, userId: users[i].id });
	}

	// All users get the member role
	for (const u of users) {
		await db.insert(modelHasRole).values({ roleId: memberRole.id, userId: u.id });
	}

	// Random volunteers
	for (const u of pickN(users, 6)) {
		await db.insert(modelHasRole).values({ roleId: volunteerRole.id, userId: u.id }).onConflictDoNothing();
	}
}

async function seedReservations(users: SeedUser[]): Promise<SeedReservation[]> {
	console.log('Seeding reservations...');
	const statuses = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
	const rows: SeedReservation[] = [];

	// Past reservations (mostly completed)
	for (let day = -14; day < 0; day++) {
		const count = randomInt(1, 4);
		let hour = randomInt(9, 14);
		for (let i = 0; i < count; i++) {
			const duration = pick([1, 1.5, 2]);
			const startsAt = ptDate(day, hour);
			const endsAt = ptDate(day, hour + duration);
			hour += duration + 0.5; // leave a gap
			if (hour > 21) break;

			const status = Math.random() > 0.15 ? 'completed' : pick(['no_show', 'cancelled']);
			const member = pick(users);

			const [r] = await db.insert(reservation).values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status,
				startsAt,
				endsAt,
				notes: Math.random() > 0.7 ? 'Band practice' : null,
				cancellationReason: status === 'cancelled' ? 'Schedule conflict' : null
			}).returning();
			rows.push(r);
		}
	}

	// Today and future reservations (scheduled/confirmed)
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

			const [r] = await db.insert(reservation).values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status,
				startsAt,
				endsAt,
				notes: Math.random() > 0.6 ? pick(['Drum practice', 'Guitar lesson prep', 'Recording session']) : null
			}).returning();
			rows.push(r);
		}
	}

	return rows;
}

async function seedClosures() {
	console.log('Seeding closures...');
	const rows = [];

	// A past closure
	const [c1] = await db.insert(closure).values({
		reason: 'Holiday closure — New Year',
		startsAt: ptDate(-30, 0),
		endsAt: ptDate(-29, 23, 59)
	}).returning();
	rows.push(c1);

	// A future closure
	const [c2] = await db.insert(closure).values({
		reason: 'Building maintenance — HVAC replacement',
		startsAt: ptDate(21, 8),
		endsAt: ptDate(22, 18)
	}).returning();
	rows.push(c2);

	// Another future closure
	const [c3] = await db.insert(closure).values({
		reason: pick(CLOSURE_REASONS),
		startsAt: ptDate(35, 0),
		endsAt: ptDate(35, 23, 59)
	}).returning();
	rows.push(c3);

	return rows;
}

async function seedEvents(users: SeedUser[]): Promise<SeedEvent[]> {
	console.log('Seeding events...');
	const rows: SeedEvent[] = [];
	const staffUsers = users.slice(0, 6); // admin + first 5 fake users are staff

	/** Create a reservation for the event's space, with 30min setup/teardown buffer. */
	async function createEventReservation(
		day: number, eventStartHour: number, eventEndHour: number,
		createdByUserId: string, reservationStatus: string
	): Promise<string> {
		const startsAt = ptDate(day, eventStartHour, -30);
		const endsAt = ptDate(day, eventEndHour, 30);

		const [r] = await db.insert(reservation).values({
			bookerType: 'event',
			bookerId: 'event',
			createdByUserId,
			status: reservationStatus,
			startsAt,
			endsAt,
			notes: 'Event space reservation',
			cancellationReason: reservationStatus === 'cancelled' ? 'Event cancelled' : null
		}).returning();
		return r.id;
	}

	// Past events (published) — reservations are completed
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
			reservationId = await createEventReservation(day, hour, hour + duration, creator.id, 'completed');
		}

		const [e] = await db.insert(event).values({
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
		}).returning();
		rows.push(e);
	}

	// Upcoming events (published) — reservations are confirmed
	for (let i = 0; i < 4; i++) {
		const day = randomInt(3, 28);
		const hour = randomInt(18, 20);
		const duration = pick([2, 3]);
		const tags = pickN(EVENT_TAGS_POOL, randomInt(1, 3)).join(', ');
		const startsAt = ptDate(day, hour);
		const endsAt = ptDate(day, hour + duration);
		const creator = pick(staffUsers);

		let reservationId: string | undefined;
		if (Math.random() < 0.75) {
			reservationId = await createEventReservation(day, hour, hour + duration, creator.id, 'confirmed');
		}

		const [e] = await db.insert(event).values({
			title: pick(EVENT_TITLES),
			description: 'An evening of live performances at the Collective.',
			startsAt,
			endsAt,
			doorsAt: ptDate(day, hour - 0.5),
			status: 'published',
			publishedAt: new Date(),
			tags,
			reservationId,
			createdByUserId: creator.id
		}).returning();
		rows.push(e);
	}

	// Draft events — reservations are scheduled (not yet confirmed)
	for (let i = 0; i < 2; i++) {
		const day = randomInt(14, 45);
		const hour = randomInt(18, 20);
		const creator = pick(staffUsers);

		let reservationId: string | undefined;
		if (Math.random() < 0.75) {
			reservationId = await createEventReservation(day, hour, hour + 3, creator.id, 'scheduled');
		}

		const [e] = await db.insert(event).values({
			title: pick(EVENT_TITLES),
			description: 'Details TBD',
			startsAt: ptDate(day, hour),
			endsAt: ptDate(day, hour + 3),
			status: 'draft',
			tags: pick(EVENT_TAGS_POOL),
			reservationId,
			createdByUserId: creator.id
		}).returning();
		rows.push(e);
	}

	// Cancelled event with cancelled reservation
	const cancelledCreator = pick(staffUsers);
	const cancelledResId = await createEventReservation(7, 14, 20, cancelledCreator.id, 'cancelled');
	const [cancelled] = await db.insert(event).values({
		title: 'Cancelled: Outdoor Festival',
		description: 'Unfortunately cancelled due to weather.',
		startsAt: ptDate(7, 14),
		endsAt: ptDate(7, 20),
		status: 'cancelled',
		tags: 'community, all ages',
		reservationId: cancelledResId,
		createdByUserId: cancelledCreator.id
	}).returning();
	rows.push(cancelled);

	// Cancelled event without reservation
	const [cancelledNoRes] = await db.insert(event).values({
		title: 'Cancelled: Benefit Concert',
		description: 'Cancelled — performer unavailable.',
		startsAt: ptDate(14, 19),
		endsAt: ptDate(14, 22),
		status: 'cancelled',
		tags: 'ticketed, community',
		createdByUserId: pick(staffUsers).id
	}).returning();
	rows.push(cancelledNoRes);

	return rows;
}

async function seedProductConfig() {
	console.log('Seeding product config...');
	await db.insert(productConfig).values([
		{
			key: 'contribution',
			name: 'Monthly Contribution',
			description: 'Sustaining member monthly contribution',
			unitAmountCents: 500,
			unitLabel: 'per unit / month'
		},
		{
			key: 'rehearsal',
			name: 'Rehearsal Space',
			description: 'Practice room hourly rate',
			unitAmountCents: 1500,
			unitLabel: 'per hour'
		},
		{
			key: 'fee_coverage',
			name: 'Fee Coverage',
			description: 'Covers payment processing fees',
			unitAmountCents: 0,
			unitLabel: null
		}
	]);
}

async function seedCreditTransactions(users: SeedUser[]) {
	console.log('Seeding credit transactions...');

	for (const u of users.slice(0, 12)) {
		// Monthly allocation
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

		// Maybe some usage
		if (Math.random() > 0.4) {
			const used = randomInt(1, Math.min(3, hours));
			await db.insert(creditTransaction).values({
				userId: u.id,
				creditType: 'free_hours',
				amount: -used,
				balanceAfter: hours - used,
				source: 'reservation',
				description: `Applied to reservation`,
				metadata: {}
			});
		}
	}
}

async function seedBands(users: SeedUser[]) {
	console.log('Seeding bands...');
	const bands = [];

	for (let i = 0; i < BAND_NAMES.length; i++) {
		const owner = users[i % users.length];
		const slug = BAND_NAMES[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

		const bandGenres = pickN(GENRES, randomInt(1, 3));
		const bandLinks = Math.random() > 0.4 ? pickN(SAMPLE_LINKS, randomInt(1, 2)) : null;
		const bandVisibility = Math.random() > 0.8 ? 'hidden' : Math.random() > 0.4 ? 'public' : 'members';

		const [b] = await db.insert(band).values({
			name: BAND_NAMES[i],
			slug,
			bio: `${BAND_NAMES[i]} is a local band from Corvallis.`,
			ownerId: owner.id,
			tagline: Math.random() > 0.3 ? `${pick(GENRES)} ${pick(['trio', 'quartet', 'duo', 'ensemble', 'collective'])} from Corvallis` : null,
			genres: bandGenres,
			lookingForMembers: Math.random() > 0.6,
			directoryVisibility: bandVisibility,
			links: bandLinks
		}).returning();
		bands.push(b);

		// Owner as band member
		await db.insert(bandMember).values({
			bandId: b.id,
			userId: owner.id,
			role: 'owner',
			position: pick(BAND_POSITIONS),
			status: 'active'
		});

		// 1-3 additional members
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

	// One deactivated band
	const deactivatedOwner = users[BAND_NAMES.length % users.length];
	const [deactivated] = await db.insert(band).values({
		name: 'Disbanded Project',
		slug: 'disbanded-project',
		bio: 'This band was deactivated by staff.',
		ownerId: deactivatedOwner.id,
		deletedAt: new Date(Date.now() - 10 * 86400000)
	}).returning();
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

async function seedRecurringSeries(users: SeedUser[]) {
	console.log('Seeding recurring series...');
	const rows = [];
	const frequencies = ['weekly', 'biweekly', 'monthly'] as const;

	// 4 active recurring series
	for (let i = 0; i < 4; i++) {
		const member = users[i % users.length];
		const freq = frequencies[i % frequencies.length];
		const dayOffset = i; // spread across different days
		const hour = 10 + i * 2;
		const duration = pick([1, 1.5, 2]);

		const protoStart = ptDate(dayOffset - 14, hour); // started 2 weeks ago
		const protoEnd = ptDate(dayOffset - 14, hour + duration);

		// Create the prototype reservation
		const [proto] = await db.insert(reservation).values({
			bookerType: 'user',
			bookerId: member.id,
			createdByUserId: member.id,
			status: 'completed',
			startsAt: protoStart,
			endsAt: protoEnd,
			notes: `Recurring ${freq} practice`
		}).returning();

		const rrule = seedRRule(protoStart, freq);

		const [series] = await db.insert(recurringSeries).values({
			prototypeType: 'reservation',
			prototypeId: proto.id,
			rrule
		}).returning();
		rows.push(series);

		// Link prototype to the series
		await db.execute(
			sql`UPDATE reservation SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`
		);

		// Create a couple of generated instances
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

	// 1 cancelled series
	{
		const member = users[5];
		const protoStart = ptDate(-21, 14);
		const protoEnd = ptDate(-21, 16);

		const [proto] = await db.insert(reservation).values({
			bookerType: 'user',
			bookerId: member.id,
			createdByUserId: member.id,
			status: 'completed',
			startsAt: protoStart,
			endsAt: protoEnd,
			notes: 'Cancelled recurring session'
		}).returning();

		const rrule = seedRRule(protoStart, 'weekly');

		const [series] = await db.insert(recurringSeries).values({
			prototypeType: 'reservation',
			prototypeId: proto.id,
			rrule,
			cancelledAt: new Date(Date.now() - 7 * 86400000) // cancelled a week ago
		}).returning();
		rows.push(series);

		await db.execute(
			sql`UPDATE reservation SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`
		);
	}

	return rows;
}

async function seedPaymentRecords(users: SeedUser[], reservations: SeedReservation[]) {
	console.log('Seeding payment records...');
	const rows = [];

	// Payments for completed/confirmed reservations
	const payableReservations = reservations
		.filter((r) => ['completed', 'confirmed', 'scheduled'].includes(r.status))
		.slice(0, 25);

	for (const r of payableReservations) {
		const hours = Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 3600000 * 2) / 2;
		const amountCents = hours * 1500; // $15/hr
		const method = Math.random() > 0.3 ? 'Cash' : 'Credits';

		const [p] = await db.insert(paymentRecord).values({
			id: `pr_seed_${randomUUID().slice(0, 8)}`,
			userId: r.createdByUserId,
			reservationId: r.id,
			stripeCustomerId: `cus_seed${randomInt(1000, 9999)}`,
			amountCents,
			paymentMethod: method,
			status: Math.random() > 0.1 ? 'completed' : 'refunded',
			paidAt: r.startsAt,
			refundedAt: Math.random() > 0.9 ? new Date() : null
		}).returning();
		rows.push(p);
	}

	return rows;
}

async function seedTickets(users: SeedUser[], events: SeedEvent[]) {
	console.log('Seeding tickets...');
	const rows = [];

	const publishedEvents = events.filter((e) => e.status === 'published');

	for (const evt of publishedEvents) {
		// 2-6 tickets per event
		const ticketCount = randomInt(2, 6);
		const purchaseId = randomUUID();
		const buyers = pickN(users, ticketCount);

		for (let i = 0; i < ticketCount; i++) {
			const buyer = buyers[i];
			const code = `${TICKET_CODES_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;
			const isPast = evt.startsAt < new Date();

			const [t] = await db.insert(ticket).values({
				eventId: evt.id,
				purchaseId,
				userId: buyer.id,
				attendeeName: buyer.name,
				attendeeEmail: `${buyer.name.toLowerCase().replace(' ', '.')}@example.com`,
				code,
				status: isPast ? (Math.random() > 0.2 ? 'used' : 'pending') : 'pending',
				checkedInAt: isPast && Math.random() > 0.3 ? evt.startsAt : null,
				checkedInByUserId: isPast && Math.random() > 0.3 ? users[0].id : null
			}).returning();
			rows.push(t);
		}
	}

	return rows;
}

async function seedNotifications(users: SeedUser[]) {
	console.log('Seeding notifications...');
	const rows = [];

	const types = [
		{ type: 'reservation_reminder', title: 'Upcoming reservation', body: 'Your reservation is tomorrow at 2:00 PM.', href: '/member/reservations' },
		{ type: 'confirmation_reminder', title: 'Please confirm your reservation', body: 'You have an unconfirmed reservation this week.', href: '/member/reservations' },
		{ type: 'band_invitation', title: 'Band invitation', body: 'You\'ve been invited to join The Voltage Thieves.', href: '/member/bands' },
		{ type: 'band_invitation_accepted', title: 'Invitation accepted', body: 'Jordan Nguyen accepted your band invitation.', href: '/member/bands' },
		{ type: 'recurring_skipped', title: 'Recurring reservation skipped', body: 'Your weekly reservation was skipped due to a closure.', href: '/member/reservations' },
		{ type: 'ticket_confirmation', title: 'Tickets confirmed', body: 'Your tickets for Open Mic Night are confirmed!', href: '/member/tickets' },
		{ type: 'event_cancellation', title: 'Event cancelled', body: 'Outdoor Festival has been cancelled. Your tickets will be refunded.', href: '/member/tickets' }
	];

	// Give each user 0-5 notifications, mix of read and unread
	for (const u of users) {
		const count = randomInt(0, 5);
		const selected = pickN(types, count);

		for (const n of selected) {
			const daysAgo = randomInt(0, 14);
			const createdAt = new Date(Date.now() - daysAgo * 86400000);
			const isRead = Math.random() > 0.4;

			const [row] = await db.insert(notification).values({
				userId: u.id,
				type: n.type,
				title: n.title,
				body: n.body,
				href: n.href,
				readAt: isRead ? new Date(createdAt.getTime() + randomInt(1, 24) * 3600000) : null,
				createdAt
			}).returning();
			rows.push(row);
		}
	}

	return rows;
}

async function seedNotificationPreferences(users: SeedUser[]) {
	console.log('Seeding notification preferences...');
	const rows = [];
	const configurableTypes = [
		'check_in_reminder', 'reservation_reminder',
		'confirmation_reminder', 'band_invitation',
		'band_invitation_accepted', 'recurring_skipped'
	];

	// ~30% of users have customized preferences
	const customizers = pickN(users, Math.ceil(users.length * 0.3));

	for (const u of customizers) {
		// Each customizer tweaks 1-3 notification types
		const tweaked = pickN(configurableTypes, randomInt(1, 3));
		for (const nt of tweaked) {
			const [row] = await db.insert(notificationPreference).values({
				userId: u.id,
				notificationType: nt,
				emailEnabled: Math.random() > 0.3,
				inAppEnabled: Math.random() > 0.2
			}).returning();
			rows.push(row);
		}
	}

	return rows;
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

async function seedMarketing(users: SeedUser[]) {
	console.log('Seeding marketing...');

	// Create audiences
	const audienceRows = await db
		.insert(audience)
		.values([
			{
				id: randomUUID(),
				name: 'Newsletter',
				slug: 'newsletter',
				description: 'Monthly updates from CorvMC — events, news, and community highlights.',
				allowOptIn: true
			},
			{
				id: randomUUID(),
				name: 'Event Updates',
				slug: 'event-updates',
				description: 'Get notified about upcoming shows and events.',
				allowOptIn: true
			},
			{
				id: randomUUID(),
				name: 'Member Announcements',
				slug: 'member-announcements',
				description: 'Important announcements for CorvMC members.',
				allowOptIn: false
			},
			{
				id: randomUUID(),
				name: 'Public Updates',
				slug: 'public-updates',
				description: 'General updates and news from CorvMC.',
				allowOptIn: true
			}
		])
		.returning();

	// Create subscribers for all users
	const subscriberRows = await db
		.insert(subscriber)
		.values(
			users.map((u) => ({
				id: randomUUID(),
				email: u.email,
				name: u.name,
				userId: u.id
			}))
		)
		.returning();

	// Add some external subscribers
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

	// Add subscribers to audiences with randomized membership
	const membershipRows: { id: string; subscriberId: string; audienceId: string; unsubscribedAt: Date | null }[] = [];

	for (const sub of allSubs) {
		for (const aud of audienceRows) {
			// ~70% chance of being in each audience
			if (Math.random() < 0.7) {
				// ~10% chance of being unsubscribed
				const unsubscribed = Math.random() < 0.1;
				membershipRows.push({
					id: randomUUID(),
					subscriberId: sub.id,
					audienceId: aud.id,
					unsubscribedAt: unsubscribed ? new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000) : null
				});
			}
		}
	}

	if (membershipRows.length > 0) {
		await db.insert(audienceMember).values(membershipRows);
	}

	// Create campaigns in various states
	const adminUser = users[0]; // first user is admin

	const sentCampaigns = [
		{
			subject: 'Welcome to the CorvMC Newsletter!',
			markdownBody: '# Welcome!\n\nThanks for subscribing to the CorvMC newsletter. We\'ll keep you posted on all the latest happenings.\n\n## What\'s coming up\n\nStay tuned for event announcements and community updates.',
			sentAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
			scheduledFor: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
			recipientCount: 18
		},
		{
			subject: 'February Events Roundup',
			markdownBody: '# February Events\n\nHere\'s what happened this month at CorvMC:\n\n- **Open Mic Night** — Great turnout!\n- **Jazz Workshop** — Thanks to everyone who participated.\n\nSee you next month!',
			sentAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
			scheduledFor: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
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
				scheduledFor: c.scheduledFor,
				sentAt: c.sentAt,
				sentById: adminUser.id,
				recipientCount: c.recipientCount
			})
			.returning();

		// Attach to first two audiences
		await db.insert(campaignAudience).values([
			{ campaignId: row.id, audienceId: audienceRows[0].id },
			{ campaignId: row.id, audienceId: audienceRows[1].id }
		]);
	}

	// Scheduled campaign
	const [scheduled] = await db
		.insert(campaign)
		.values({
			id: randomUUID(),
			subject: 'Upcoming: Spring Concert Series',
			markdownBody: '# Spring Concert Series\n\nWe\'re excited to announce our spring lineup! More details coming soon.\n\nMark your calendars for March 15th.',
			htmlBody: '<p>Spring Concert Series preview</p>',
			scheduledFor: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
			sentAt: null,
			sentById: adminUser.id,
			recipientCount: null
		})
		.returning();

	await db.insert(campaignAudience).values([
		{ campaignId: scheduled.id, audienceId: audienceRows[0].id },
		{ campaignId: scheduled.id, audienceId: audienceRows[3].id }
	]);

	// Draft campaigns
	const [draft1] = await db
		.insert(campaign)
		.values({
			id: randomUUID(),
			subject: 'New Practice Room Hours',
			markdownBody: '# Updated Hours\n\nStarting next month, practice rooms will be available until 11pm on weekends.\n\n{{subscriber_name}}, we hope this helps your schedule!',
			htmlBody: '<p>Draft - practice room hours</p>',
			scheduledFor: null,
			sentAt: null,
			sentById: adminUser.id,
			recipientCount: null
		})
		.returning();

	await db.insert(campaignAudience).values({
		campaignId: draft1.id,
		audienceId: audienceRows[2].id
	});

	const [draft2] = await db
		.insert(campaign)
		.values({
			id: randomUUID(),
			subject: 'Volunteer Opportunities',
			markdownBody: '# Help Out at CorvMC\n\nWe\'re looking for volunteers for the upcoming fundraiser. If you\'re interested, reply to this email!',
			htmlBody: '<p>Draft - volunteer opportunities</p>',
			scheduledFor: null,
			sentAt: null,
			sentById: adminUser.id,
			recipientCount: null
		})
		.returning();

	await db.insert(campaignAudience).values({
		campaignId: draft2.id,
		audienceId: audienceRows[0].id
	});

	return {
		audiences: audienceRows.length,
		subscribers: allSubs.length,
		memberships: membershipRows.length,
		campaigns: sentCampaigns.length + 3 // 2 sent + 1 scheduled + 2 drafts
	};
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function confirmDestructive() {
	if (process.env.NODE_ENV === 'production') {
		console.error('Refusing to seed: NODE_ENV is "production".');
		process.exit(1);
	}

	const url = new URL(process.env.DATABASE_URL!);
	const host = url.hostname;
	const dbName = url.pathname.replace('/', '');

	console.log(`\n  Database host: ${host}`);
	console.log(`  Database name: ${dbName}\n`);
	console.log('  This will TRUNCATE ALL TABLES and replace them with fake data.');

	const readline = await import('readline');
	const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
	const answer = await new Promise<string>((resolve) => {
		rl.question('\n  Is this a dev/test database? Type "yes" to continue: ', resolve);
	});
	rl.close();

	if (answer.trim().toLowerCase() !== 'yes') {
		console.log('Aborted.');
		process.exit(0);
	}
}

async function main() {
	await confirmDestructive();
	console.log('\nStarting dev seed...\n');

	await truncateAll();

	const roles = await seedRoles();
	const adminUser = await seedAdminUser();
	const users = await seedUsers(20);
	await seedUserRoles(users, adminUser, roles);
	const allUsers = [adminUser, ...users];
	const reservations = await seedReservations(allUsers);
	const closures = await seedClosures();
	const events = await seedEvents(allUsers);
	const bands = await seedBands(allUsers);
	const series = await seedRecurringSeries(allUsers);
	const payments = await seedPaymentRecords(allUsers, reservations);
	const tickets = await seedTickets(allUsers, events);
	const notifications = await seedNotifications(allUsers);
	const preferences = await seedNotificationPreferences(allUsers);
	await seedProductConfig();
	await seedCreditTransactions(allUsers);
	const marketing = await seedMarketing(allUsers);

	console.log('\nSeed complete:');
	console.log(`  ${allUsers.length} users (admin: admin@corvallismusic.org / password)`);
	console.log(`  ${roles.length} roles`);
	console.log(`  ${reservations.length} reservations`);
	console.log(`  ${closures.length} closures`);
	console.log(`  ${events.length} events`);
	console.log(`  ${bands.length} bands`);
	console.log(`  ${series.length} recurring series`);
	console.log(`  ${payments.length} payment records`);
	console.log(`  ${tickets.length} tickets`);
	console.log(`  ${notifications.length} notifications`);
	console.log(`  ${preferences.length} notification preferences`);
	console.log('  3 product configs');
	console.log('  credit transactions for 12 users');
	console.log(`  ${marketing.audiences} audiences, ${marketing.subscribers} subscribers, ${marketing.memberships} memberships, ${marketing.campaigns} campaigns`);

	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
