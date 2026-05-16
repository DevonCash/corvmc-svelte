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
import { randomUUID } from 'crypto';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { sql } from 'drizzle-orm';
import { hashPassword } from 'better-auth/crypto';
import { user, account, userInstrument, userGenre } from '../src/lib/server/db/schema/auth';
import { role, modelHasRole } from '../src/lib/server/db/schema/authorization';
import { reservation, closure } from '../src/lib/server/db/schema/reservation';
import { recurringSeries } from '../src/lib/server/db/schema/recurring';
import { event } from '../src/lib/server/db/schema/event';
import { ticket } from '../src/lib/server/db/schema/ticket';
import { productConfig } from '../src/lib/server/db/schema/product-config';
import { creditTransaction, paymentRecord } from '../src/lib/server/db/schema/finance';
import { notification, notificationPreference } from '../src/lib/server/db/schema/notification';
import { band, bandMember, bandGenre } from '../src/lib/server/db/schema/band';
import {
	subscriber,
	audience,
	audienceMember,
	campaign,
	campaignAudience
} from '../src/lib/server/db/schema/marketing';
import {
	equipmentCategory,
	equipment,
	equipmentLoan
} from '../src/lib/server/db/schema/equipment';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';

// Find the local D1 SQLite file
function findD1SqlitePath(): string {
	const base = resolve('.wrangler/state/v3/d1/miniflare-D1DatabaseObject');
	for (const entry of readdirSync(base)) {
		if (entry.endsWith('.sqlite') && !entry.startsWith('metadata')) {
			return resolve(base, entry);
		}
	}
	throw new Error('No D1 SQLite file found. Run `pnpm db:push` first.');
}

const sqlitePath = findD1SqlitePath();
console.log(`Using SQLite: ${sqlitePath}`);
const sqlite = new Database(sqlitePath);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = OFF');
const db = drizzle(sqlite);

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

function deleteAll() {
	console.log('Deleting all data...');
	const tables = [
		'equipment_loan', 'equipment', 'equipment_category',
		'campaign_audience', 'campaign', 'audience_member', 'audience', 'subscriber',
		'notification_preference', 'notification',
		'ticket', 'band_genre', 'band_member', 'band',
		'payment_record', 'credit_transaction',
		'recurring_series', 'event', 'closure', 'reservation',
		'model_has_roles', 'model_has_permissions', 'role_has_permissions',
		'roles', 'permissions', 'product_config',
		'user_instrument', 'user_genre',
		'session', 'account', 'verification', 'user'
	];
	for (const t of tables) {
		sqlite.exec(`DELETE FROM "${t}"`);
	}
}

interface SeedRole { id: number; name: string }
interface SeedUser { id: string; name: string; email: string }
interface SeedEvent { id: string; status: string; startsAt: Date }
interface SeedReservation { id: string; createdByUserId: string; startsAt: Date; endsAt: Date; status: string }

function seedRoles(): SeedRole[] {
	console.log('Seeding roles...');
	const roles = ['admin', 'staff', 'member', 'volunteer'];
	const inserted: SeedRole[] = [];
	for (const name of roles) {
		const [r] = db.insert(role).values({ name, guardName: 'web' }).returning().all();
		inserted.push(r);
	}
	return inserted;
}

function seedUsers(count: number): SeedUser[] {
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
		const memberLinks = hasProfile && Math.random() > 0.4
			? pickN(SAMPLE_LINKS, randomInt(1, 3))
			: null;
		const visibility = !hasProfile ? 'hidden' : Math.random() > 0.6 ? 'public' : 'members';

		const [u] = db.insert(user).values({
			id,
			name,
			email,
			emailVerified: true,
			pronouns: pick(PRONOUNS),
			phone: Math.random() > 0.4 ? `541-555-${String(randomInt(1000, 9999))}` : null,
			creditFreeHours: randomInt(0, 8),
			creditEquipment: randomInt(0, 3),
			bio: hasProfile ? pick(MEMBER_BIOS) : null,
			tagline: hasProfile ? pick(TAGLINES) : null,
			lookingForBand: hasProfile && Math.random() > 0.7,
			directoryVisibility: visibility,
			directoryContact: visibility === 'public' ? { email } : null,
			links: memberLinks,
			createdAt,
			updatedAt: createdAt
		}).returning().all();

		// Junction tables for instruments and genres
		for (const instrument of memberInstruments) {
			db.insert(userInstrument).values({ userId: id, instrument }).run();
		}
		for (const genre of memberGenres) {
			db.insert(userGenre).values({ userId: id, genre }).run();
		}

		users.push({ ...u, email });
	}
	return users;
}

async function seedAdminUser(): Promise<SeedUser> {
	console.log('Seeding admin user (admin@corvallismusic.org)...');
	const id = randomUUID();
	const now = new Date();
	const hashedPassword = await hashPassword('password');

	const [adminUser] = db.insert(user).values({
		id,
		name: 'Admin',
		email: 'admin@corvallismusic.org',
		emailVerified: true,
		createdAt: now,
		updatedAt: now
	}).returning().all();

	db.insert(account).values({
		id: randomUUID(),
		accountId: id,
		providerId: 'credential',
		userId: id,
		password: hashedPassword,
		createdAt: now,
		updatedAt: now
	}).run();

	return { ...adminUser, email: 'admin@corvallismusic.org' };
}

function seedUserRoles(users: SeedUser[], adminUser: SeedUser, roles: SeedRole[]) {
	console.log('Assigning roles...');
	const adminRole = roles.find((r) => r.name === 'admin')!;
	const staffRole = roles.find((r) => r.name === 'staff')!;
	const memberRole = roles.find((r) => r.name === 'member')!;
	const volunteerRole = roles.find((r) => r.name === 'volunteer')!;

	db.insert(modelHasRole).values([
		{ roleId: adminRole.id, userId: adminUser.id },
		{ roleId: staffRole.id, userId: adminUser.id },
		{ roleId: memberRole.id, userId: adminUser.id }
	]).run();

	for (let i = 0; i < 2; i++) {
		db.insert(modelHasRole).values([
			{ roleId: adminRole.id, userId: users[i].id },
			{ roleId: staffRole.id, userId: users[i].id }
		]).run();
	}

	for (let i = 2; i < 5; i++) {
		db.insert(modelHasRole).values({ roleId: staffRole.id, userId: users[i].id }).run();
	}

	for (const u of users) {
		db.insert(modelHasRole).values({ roleId: memberRole.id, userId: u.id }).run();
	}

	for (const u of pickN(users, 6)) {
		db.insert(modelHasRole).values({ roleId: volunteerRole.id, userId: u.id }).onConflictDoNothing().run();
	}
}

function seedReservations(users: SeedUser[]): SeedReservation[] {
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

			const [r] = db.insert(reservation).values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status,
				startsAt,
				endsAt,
				notes: Math.random() > 0.7 ? 'Band practice' : null,
				cancellationReason: status === 'cancelled' ? 'Schedule conflict' : null
			}).returning().all();
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

			const [r] = db.insert(reservation).values({
				bookerType: 'user',
				bookerId: member.id,
				createdByUserId: member.id,
				status,
				startsAt,
				endsAt,
				notes: Math.random() > 0.6 ? pick(['Drum practice', 'Guitar lesson prep', 'Recording session']) : null
			}).returning().all();
			rows.push(r);
		}
	}

	return rows;
}

function seedClosures() {
	console.log('Seeding closures...');
	db.insert(closure).values([
		{ reason: 'Holiday closure — New Year', startsAt: ptDate(-30, 0), endsAt: ptDate(-29, 23, 59) },
		{ reason: 'Building maintenance — HVAC replacement', startsAt: ptDate(21, 8), endsAt: ptDate(22, 18) },
		{ reason: pick(CLOSURE_REASONS), startsAt: ptDate(35, 0), endsAt: ptDate(35, 23, 59) }
	]).run();
}

function seedEvents(users: SeedUser[]): SeedEvent[] {
	console.log('Seeding events...');
	const rows: SeedEvent[] = [];
	const staffUsers = users.slice(0, 6);

	function createEventReservation(
		day: number, eventStartHour: number, eventEndHour: number,
		createdByUserId: string, reservationStatus: string
	): string {
		const startsAt = ptDate(day, eventStartHour, -30);
		const endsAt = ptDate(day, eventEndHour, 30);
		const [r] = db.insert(reservation).values({
			bookerType: 'event',
			bookerId: 'event',
			createdByUserId,
			status: reservationStatus,
			startsAt,
			endsAt,
			notes: 'Event space reservation',
			cancellationReason: reservationStatus === 'cancelled' ? 'Event cancelled' : null
		}).returning().all();
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
			reservationId = createEventReservation(day, hour, hour + duration, creator.id, 'completed');
		}

		const [e] = db.insert(event).values({
			title: pick(EVENT_TITLES),
			description: 'Join us for an evening of live music and community.',
			startsAt, endsAt,
			doorsAt: ptDate(day, hour - 0.5),
			status: 'published',
			publishedAt, tags, reservationId,
			createdByUserId: creator.id
		}).returning().all();
		rows.push(e);
	}

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
			reservationId = createEventReservation(day, hour, hour + duration, creator.id, 'confirmed');
		}

		const [e] = db.insert(event).values({
			title: pick(EVENT_TITLES),
			description: 'An evening of live performances at the Collective.',
			startsAt, endsAt,
			doorsAt: ptDate(day, hour - 0.5),
			status: 'published',
			publishedAt: new Date(),
			tags, reservationId,
			createdByUserId: creator.id
		}).returning().all();
		rows.push(e);
	}

	for (let i = 0; i < 2; i++) {
		const day = randomInt(14, 45);
		const hour = randomInt(18, 20);
		const creator = pick(staffUsers);

		let reservationId: string | undefined;
		if (Math.random() < 0.75) {
			reservationId = createEventReservation(day, hour, hour + 3, creator.id, 'scheduled');
		}

		const [e] = db.insert(event).values({
			title: pick(EVENT_TITLES),
			description: 'Details TBD',
			startsAt: ptDate(day, hour),
			endsAt: ptDate(day, hour + 3),
			status: 'draft',
			tags: pick(EVENT_TAGS_POOL),
			reservationId,
			createdByUserId: creator.id
		}).returning().all();
		rows.push(e);
	}

	const cancelledCreator = pick(staffUsers);
	const cancelledResId = createEventReservation(7, 14, 20, cancelledCreator.id, 'cancelled');
	const [cancelled] = db.insert(event).values({
		title: 'Cancelled: Outdoor Festival',
		description: 'Unfortunately cancelled due to weather.',
		startsAt: ptDate(7, 14), endsAt: ptDate(7, 20),
		status: 'cancelled', tags: 'community, all ages',
		reservationId: cancelledResId,
		createdByUserId: cancelledCreator.id
	}).returning().all();
	rows.push(cancelled);

	const [cancelledNoRes] = db.insert(event).values({
		title: 'Cancelled: Benefit Concert',
		description: 'Cancelled — performer unavailable.',
		startsAt: ptDate(14, 19), endsAt: ptDate(14, 22),
		status: 'cancelled', tags: 'ticketed, community',
		createdByUserId: pick(staffUsers).id
	}).returning().all();
	rows.push(cancelledNoRes);

	return rows;
}

function seedProductConfig() {
	console.log('Seeding product config...');
	db.insert(productConfig).values([
		{ key: 'contribution', name: 'Monthly Contribution', description: 'Sustaining member monthly contribution', unitAmountCents: 500, unitLabel: 'per unit / month' },
		{ key: 'rehearsal', name: 'Rehearsal Space', description: 'Practice room hourly rate', unitAmountCents: 1500, unitLabel: 'per hour' },
		{ key: 'fee_coverage', name: 'Fee Coverage', description: 'Covers payment processing fees', unitAmountCents: 0, unitLabel: null }
	]).run();
}

function seedCreditTransactions(users: SeedUser[]) {
	console.log('Seeding credit transactions...');
	for (const u of users.slice(0, 12)) {
		const hours = randomInt(2, 8);
		db.insert(creditTransaction).values({
			userId: u.id,
			creditType: 'free_hours',
			amount: hours,
			balanceAfter: hours,
			source: 'subscription_allocation',
			description: 'Monthly free hours allocation',
			metadata: { period: 'May 2026' }
		}).run();

		if (Math.random() > 0.4) {
			const used = randomInt(1, Math.min(3, hours));
			db.insert(creditTransaction).values({
				userId: u.id,
				creditType: 'free_hours',
				amount: -used,
				balanceAfter: hours - used,
				source: 'reservation',
				description: 'Applied to reservation',
				metadata: {}
			}).run();
		}
	}
}

function seedBands(users: SeedUser[]) {
	console.log('Seeding bands...');
	const bands = [];

	for (let i = 0; i < BAND_NAMES.length; i++) {
		const owner = users[i % users.length];
		const slug = BAND_NAMES[i].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');

		const genres = pickN(GENRES, randomInt(1, 3));
		const bandLinks = Math.random() > 0.4 ? pickN(SAMPLE_LINKS, randomInt(1, 2)) : null;
		const bandVisibility = Math.random() > 0.8 ? 'hidden' : Math.random() > 0.4 ? 'public' : 'members';

		const [b] = db.insert(band).values({
			name: BAND_NAMES[i],
			slug,
			bio: `${BAND_NAMES[i]} is a local band from Corvallis.`,
			ownerId: owner.id,
			tagline: Math.random() > 0.3 ? `${pick(GENRES)} ${pick(['trio', 'quartet', 'duo', 'ensemble', 'collective'])} from Corvallis` : null,
			lookingForMembers: Math.random() > 0.6,
			directoryVisibility: bandVisibility,
			links: bandLinks
		}).returning().all();
		bands.push(b);

		for (const g of genres) {
			db.insert(bandGenre).values({ bandId: b.id, genre: g }).run();
		}

		db.insert(bandMember).values({
			bandId: b.id, userId: owner.id,
			role: 'owner', position: pick(BAND_POSITIONS), status: 'active'
		}).run();

		const memberCount = randomInt(1, 3);
		const candidates = users.filter((u) => u.id !== owner.id);
		const members = pickN(candidates, memberCount);
		for (const m of members) {
			db.insert(bandMember).values({
				bandId: b.id, userId: m.id,
				role: 'member', position: pick(BAND_POSITIONS),
				status: Math.random() > 0.15 ? 'active' : 'pending',
				invitedById: owner.id
			}).run();
		}
	}

	const deactivatedOwner = users[BAND_NAMES.length % users.length];
	const [deactivated] = db.insert(band).values({
		name: 'Disbanded Project', slug: 'disbanded-project',
		bio: 'This band was deactivated by staff.',
		ownerId: deactivatedOwner.id,
		deletedAt: new Date(Date.now() - 10 * 86400000)
	}).returning().all();
	db.insert(bandMember).values({
		bandId: deactivated.id, userId: deactivatedOwner.id,
		role: 'owner', position: 'Guitar', status: 'active'
	}).run();
	bands.push(deactivated);

	return bands;
}

function seedRecurringSeries(users: SeedUser[]) {
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

		const [proto] = db.insert(reservation).values({
			bookerType: 'user', bookerId: member.id,
			createdByUserId: member.id, status: 'completed',
			startsAt: protoStart, endsAt: protoEnd,
			notes: `Recurring ${freq} practice`
		}).returning().all();

		const rrule = seedRRule(protoStart, freq);

		const [series] = db.insert(recurringSeries).values({
			prototypeType: 'reservation',
			prototypeId: proto.id,
			rrule
		}).returning().all();
		rows.push(series);

		db.run(sql`UPDATE reservation SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`);

		for (let w = 1; w <= 2; w++) {
			const instStart = ptDate(dayOffset - 14 + w * 7, hour);
			const instEnd = ptDate(dayOffset - 14 + w * 7, hour + duration);
			const status = instStart < new Date() ? 'completed' : 'scheduled';

			db.insert(reservation).values({
				bookerType: 'user', bookerId: member.id,
				createdByUserId: member.id, status,
				startsAt: instStart, endsAt: instEnd,
				notes: `Recurring ${freq} practice`,
				recurringSeriesId: series.id
			}).run();
		}
	}

	{
		const member = users[5];
		const protoStart = ptDate(-21, 14);
		const protoEnd = ptDate(-21, 16);

		const [proto] = db.insert(reservation).values({
			bookerType: 'user', bookerId: member.id,
			createdByUserId: member.id, status: 'completed',
			startsAt: protoStart, endsAt: protoEnd,
			notes: 'Cancelled recurring session'
		}).returning().all();

		const rrule = seedRRule(protoStart, 'weekly');

		const [series] = db.insert(recurringSeries).values({
			prototypeType: 'reservation',
			prototypeId: proto.id,
			rrule,
			cancelledAt: new Date(Date.now() - 7 * 86400000)
		}).returning().all();
		rows.push(series);

		db.run(sql`UPDATE reservation SET recurring_series_id = ${series.id} WHERE id = ${proto.id}`);
	}

	return rows;
}

function seedPaymentRecords(users: SeedUser[], reservations: SeedReservation[]) {
	console.log('Seeding payment records...');
	const rows = [];

	const payableReservations = reservations
		.filter((r) => ['completed', 'confirmed', 'scheduled'].includes(r.status))
		.slice(0, 25);

	for (const r of payableReservations) {
		const hours = Math.round((r.endsAt.getTime() - r.startsAt.getTime()) / 3600000 * 2) / 2;
		const amountCents = hours * 1500;
		const method = Math.random() > 0.3 ? 'Cash' : 'Credits';

		const [p] = db.insert(paymentRecord).values({
			id: `pr_seed_${randomUUID().slice(0, 8)}`,
			userId: r.createdByUserId,
			reservationId: r.id,
			stripeCustomerId: `cus_seed${randomInt(1000, 9999)}`,
			amountCents,
			paymentMethod: method,
			status: Math.random() > 0.1 ? 'completed' : 'refunded',
			paidAt: r.startsAt,
			refundedAt: Math.random() > 0.9 ? new Date() : null
		}).returning().all();
		rows.push(p);
	}

	return rows;
}

function seedTickets(users: SeedUser[], events: SeedEvent[]) {
	console.log('Seeding tickets...');
	const rows = [];
	const publishedEvents = events.filter((e) => e.status === 'published');

	for (const evt of publishedEvents) {
		const ticketCount = randomInt(2, 6);
		const purchaseId = randomUUID();
		const buyers = pickN(users, ticketCount);

		for (let i = 0; i < ticketCount; i++) {
			const buyer = buyers[i];
			const code = `${TICKET_CODES_PREFIX}-${randomUUID().slice(0, 8).toUpperCase()}`;
			const isPast = evt.startsAt < new Date();

			const [t] = db.insert(ticket).values({
				eventId: evt.id,
				purchaseId,
				userId: buyer.id,
				attendeeName: buyer.name,
				attendeeEmail: `${buyer.name.toLowerCase().replace(' ', '.')}@example.com`,
				code,
				status: isPast ? (Math.random() > 0.2 ? 'used' : 'pending') : 'pending',
				checkedInAt: isPast && Math.random() > 0.3 ? evt.startsAt : null,
				checkedInByUserId: isPast && Math.random() > 0.3 ? users[0].id : null
			}).returning().all();
			rows.push(t);
		}
	}

	return rows;
}

function seedNotifications(users: SeedUser[]) {
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

	for (const u of users) {
		const count = randomInt(0, 5);
		const selected = pickN(types, count);

		for (const n of selected) {
			const daysAgo = randomInt(0, 14);
			const createdAt = new Date(Date.now() - daysAgo * 86400000);
			const isRead = Math.random() > 0.4;

			const [row] = db.insert(notification).values({
				userId: u.id,
				type: n.type,
				title: n.title,
				body: n.body,
				href: n.href,
				readAt: isRead ? new Date(createdAt.getTime() + randomInt(1, 24) * 3600000) : null,
				createdAt
			}).returning().all();
			rows.push(row);
		}
	}

	return rows;
}

function seedNotificationPreferences(users: SeedUser[]) {
	console.log('Seeding notification preferences...');
	const rows = [];
	const configurableTypes = [
		'check_in_reminder', 'reservation_reminder',
		'confirmation_reminder', 'band_invitation',
		'band_invitation_accepted', 'recurring_skipped'
	];

	const customizers = pickN(users, Math.ceil(users.length * 0.3));

	for (const u of customizers) {
		const tweaked = pickN(configurableTypes, randomInt(1, 3));
		for (const nt of tweaked) {
			const [row] = db.insert(notificationPreference).values({
				userId: u.id,
				notificationType: nt,
				emailEnabled: Math.random() > 0.3,
				inAppEnabled: Math.random() > 0.2
			}).returning().all();
			rows.push(row);
		}
	}

	return rows;
}

function seedMarketing(users: SeedUser[]) {
	console.log('Seeding marketing...');

	const audienceRows = db.insert(audience).values([
		{ id: randomUUID(), name: 'Newsletter', slug: 'newsletter', description: 'Monthly updates from CorvMC.', allowOptIn: true },
		{ id: randomUUID(), name: 'Event Updates', slug: 'event-updates', description: 'Get notified about upcoming shows.', allowOptIn: true },
		{ id: randomUUID(), name: 'Member Announcements', slug: 'member-announcements', description: 'Important announcements for members.', allowOptIn: false },
		{ id: randomUUID(), name: 'Public Updates', slug: 'public-updates', description: 'General updates and news.', allowOptIn: true }
	]).returning().all();

	const subscriberRows = db.insert(subscriber).values(
		users.map((u) => ({ id: randomUUID(), email: u.email, name: u.name, userId: u.id }))
	).returning().all();

	const externalEmails = ['fan1@example.com', 'fan2@example.com', 'localpress@example.com', 'musicblog@example.com', 'concertgoer@example.com', 'neighbor@example.com', 'sponsor@example.com'];
	const externalSubs = db.insert(subscriber).values(
		externalEmails.map((email) => ({ id: randomUUID(), email, name: email.split('@')[0].replace(/\d+/g, ''), userId: null }))
	).returning().all();

	const allSubs = [...subscriberRows, ...externalSubs];

	const membershipRows: { id: string; subscriberId: string; audienceId: string; unsubscribedAt: Date | null }[] = [];
	for (const sub of allSubs) {
		for (const aud of audienceRows) {
			if (Math.random() < 0.7) {
				membershipRows.push({
					id: randomUUID(),
					subscriberId: sub.id,
					audienceId: aud.id,
					unsubscribedAt: Math.random() < 0.1 ? new Date(Date.now() - Math.random() * 30 * 86400000) : null
				});
			}
		}
	}

	if (membershipRows.length > 0) {
		db.insert(audienceMember).values(membershipRows).run();
	}

	const adminUser = users[0];

	const sentCampaigns = [
		{ subject: 'Welcome to the CorvMC Newsletter!', markdownBody: '# Welcome!\n\nThanks for subscribing.', sentAt: new Date(Date.now() - 14 * 86400000), recipientCount: 18 },
		{ subject: 'February Events Roundup', markdownBody: '# February Events\n\nHere\'s what happened this month.', sentAt: new Date(Date.now() - 7 * 86400000), recipientCount: 15 }
	];

	for (const c of sentCampaigns) {
		const [row] = db.insert(campaign).values({
			id: randomUUID(), subject: c.subject, markdownBody: c.markdownBody,
			htmlBody: `<p>${c.markdownBody.replace(/\n/g, '</p><p>')}</p>`,
			scheduledFor: c.sentAt, sentAt: c.sentAt, sentById: adminUser.id, recipientCount: c.recipientCount
		}).returning().all();
		db.insert(campaignAudience).values([
			{ campaignId: row.id, audienceId: audienceRows[0].id },
			{ campaignId: row.id, audienceId: audienceRows[1].id }
		]).run();
	}

	const [scheduled] = db.insert(campaign).values({
		id: randomUUID(), subject: 'Upcoming: Spring Concert Series',
		markdownBody: '# Spring Concert Series\n\nMore details coming soon.',
		htmlBody: '<p>Spring Concert Series preview</p>',
		scheduledFor: new Date(Date.now() + 3 * 86400000),
		sentAt: null, sentById: adminUser.id, recipientCount: null
	}).returning().all();
	db.insert(campaignAudience).values([
		{ campaignId: scheduled.id, audienceId: audienceRows[0].id },
		{ campaignId: scheduled.id, audienceId: audienceRows[3].id }
	]).run();

	const [draft1] = db.insert(campaign).values({
		id: randomUUID(), subject: 'New Practice Room Hours',
		markdownBody: '# Updated Hours\n\nPractice rooms available until 11pm on weekends.',
		htmlBody: '<p>Draft</p>', scheduledFor: null, sentAt: null, sentById: adminUser.id, recipientCount: null
	}).returning().all();
	db.insert(campaignAudience).values({ campaignId: draft1.id, audienceId: audienceRows[2].id }).run();

	const [draft2] = db.insert(campaign).values({
		id: randomUUID(), subject: 'Volunteer Opportunities',
		markdownBody: '# Help Out at CorvMC\n\nWe\'re looking for volunteers.',
		htmlBody: '<p>Draft</p>', scheduledFor: null, sentAt: null, sentById: adminUser.id, recipientCount: null
	}).returning().all();
	db.insert(campaignAudience).values({ campaignId: draft2.id, audienceId: audienceRows[0].id }).run();

	return { audiences: audienceRows.length, subscribers: allSubs.length, memberships: membershipRows.length, campaigns: sentCampaigns.length + 3 };
}

function seedEquipment(users: SeedUser[]) {
	console.log('Seeding equipment...');

	const categories = db.insert(equipmentCategory).values([
		{ id: randomUUID(), name: 'Guitars', displayOrder: 0, pricingTier: 'major' },
		{ id: randomUUID(), name: 'Amplifiers', displayOrder: 1, pricingTier: 'major' },
		{ id: randomUUID(), name: 'Microphones', displayOrder: 2, pricingTier: 'major' },
		{ id: randomUUID(), name: 'Drum Hardware', displayOrder: 3, pricingTier: 'major' },
		{ id: randomUUID(), name: 'Cables & Accessories', displayOrder: 4, pricingTier: 'accessory' }
	]).returning().all();

	const catByName = Object.fromEntries(categories.map((c) => [c.name, c.id]));

	const items = db.insert(equipment).values([
		{ id: randomUUID(), name: 'Fender Stratocaster', description: 'Sunburst finish, maple neck.', categoryId: catByName['Guitars'], totalQuantity: 1, serialNumber: 'FEN-STR-2019-0041', resourceId: 'EQ-001', condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Gibson Les Paul Standard', description: 'Cherry burst.', categoryId: catByName['Guitars'], totalQuantity: 1, serialNumber: 'GIB-LP-2021-1187', resourceId: 'EQ-002', condition: 'excellent', status: 'available' },
		{ id: randomUUID(), name: 'Ibanez SR500 Bass', description: '4-string active bass.', categoryId: catByName['Guitars'], totalQuantity: 1, serialNumber: 'IBZ-SR5-2020-0223', resourceId: 'EQ-003', condition: 'fair', status: 'available' },
		{ id: randomUUID(), name: 'Fender Blues Deluxe', description: '40W tube combo.', categoryId: catByName['Amplifiers'], totalQuantity: 1, serialNumber: 'FEN-BD-2018-0912', resourceId: 'EQ-004', condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Orange CR120 Head + 4x12 Cab', description: 'Solid state 120W.', categoryId: catByName['Amplifiers'], totalQuantity: 1, serialNumber: 'ORG-CR120-2022-0055', resourceId: 'EQ-005', condition: 'excellent', status: 'available' },
		{ id: randomUUID(), name: 'QSC K12.2 Powered Speaker', description: '2000W powered PA speaker.', categoryId: catByName['Amplifiers'], totalQuantity: 2, resourceId: 'EQ-006', condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Shure SM58', description: 'Dynamic vocal mic.', categoryId: catByName['Microphones'], totalQuantity: 6, outOfOrderQuantity: 1, condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Shure SM57', description: 'Instrument mic.', categoryId: catByName['Microphones'], totalQuantity: 4, condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'AKG P420 Condenser', description: 'Large-diaphragm condenser.', categoryId: catByName['Microphones'], totalQuantity: 2, resourceId: 'EQ-009', condition: 'excellent', status: 'available' },
		{ id: randomUUID(), name: 'DW 5000 Kick Pedal', description: 'Single chain drive.', categoryId: catByName['Drum Hardware'], totalQuantity: 2, condition: 'fair', status: 'available' },
		{ id: randomUUID(), name: 'Snare Stand', description: 'Heavy-duty double-braced.', categoryId: catByName['Drum Hardware'], totalQuantity: 3, condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'XLR Cable (25ft)', description: 'Standard balanced XLR.', categoryId: catByName['Cables & Accessories'], totalQuantity: 12, outOfOrderQuantity: 2, condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Instrument Cable (15ft)', description: '1/4" TS cable.', categoryId: catByName['Cables & Accessories'], totalQuantity: 8, condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Mic Stand (Boom)', description: 'Tripod base with boom arm.', categoryId: catByName['Cables & Accessories'], totalQuantity: 6, outOfOrderQuantity: 1, condition: 'good', status: 'available' },
		{ id: randomUUID(), name: 'Yamaha MG10XU Mixer', description: '10-channel mixer. Being repaired.', categoryId: catByName['Amplifiers'], totalQuantity: 1, serialNumber: 'YAM-MG10-2020-0331', resourceId: 'EQ-015', condition: 'poor', status: 'maintenance' }
	]).returning().all();

	const itemByName = Object.fromEntries(items.map((i) => [i.name, i]));
	const now = new Date();
	const day = 86400000;

	const loans = db.insert(equipmentLoan).values([
		{ id: randomUUID(), equipmentId: itemByName['Fender Stratocaster'].id, userId: users[0].id, quantity: 1, requestedPickupDate: new Date(now.getTime() - 10 * day), scheduledPickupDate: new Date(now.getTime() - 9 * day), dueDate: new Date(now.getTime() + 3 * day), checkedOutAt: new Date(now.getTime() - 9 * day), status: 'checked_out', dailyRateCents: 500, memberNotes: 'Need it for a gig this weekend' },
		{ id: randomUUID(), equipmentId: itemByName['Shure SM58'].id, userId: users[1].id, quantity: 2, requestedPickupDate: new Date(now.getTime() - 14 * day), scheduledPickupDate: new Date(now.getTime() - 13 * day), dueDate: new Date(now.getTime() - 2 * day), checkedOutAt: new Date(now.getTime() - 13 * day), status: 'checked_out', dailyRateCents: 500 },
		{ id: randomUUID(), equipmentId: itemByName['Gibson Les Paul Standard'].id, userId: users[2].id, quantity: 1, requestedPickupDate: new Date(now.getTime() + 2 * day), status: 'requested', memberNotes: 'Would love to try this for a recording session' },
		{ id: randomUUID(), equipmentId: itemByName['QSC K12.2 Powered Speaker'].id, userId: users[3].id, quantity: 1, requestedPickupDate: new Date(now.getTime() + 1 * day), scheduledPickupDate: new Date(now.getTime() + 1 * day), status: 'scheduled', memberNotes: 'Need for band practice' },
		{ id: randomUUID(), equipmentId: null, userId: users[4].id, quantity: 1, requestedPickupDate: new Date(now.getTime() + 3 * day), status: 'requested', memberNotes: 'Looking for a bass amp 300W+' },
		{ id: randomUUID(), equipmentId: itemByName['Fender Blues Deluxe'].id, userId: users[0].id, quantity: 1, requestedPickupDate: new Date(now.getTime() - 30 * day), scheduledPickupDate: new Date(now.getTime() - 29 * day), dueDate: new Date(now.getTime() - 22 * day), checkedOutAt: new Date(now.getTime() - 29 * day), returnedAt: new Date(now.getTime() - 23 * day), status: 'returned', dailyRateCents: 500, totalChargeCents: 3000, creditsCents: 2000, cashCents: 1000, staffNotes: 'Returned in good condition' },
		{ id: randomUUID(), equipmentId: itemByName['XLR Cable (25ft)'].id, userId: users[1].id, quantity: 3, requestedPickupDate: new Date(now.getTime() - 20 * day), scheduledPickupDate: new Date(now.getTime() - 19 * day), dueDate: new Date(now.getTime() - 15 * day), checkedOutAt: new Date(now.getTime() - 19 * day), returnedAt: new Date(now.getTime() - 16 * day), status: 'returned', dailyRateCents: 0, totalChargeCents: 0, creditsCents: 0, cashCents: 0, staffNotes: 'Sustaining member — accessories free' },
		{ id: randomUUID(), equipmentId: itemByName['AKG P420 Condenser'].id, userId: users[5].id, quantity: 1, requestedPickupDate: new Date(now.getTime() - 7 * day), status: 'cancelled' }
	]).returning().all();

	return { categories: categories.length, items: items.length, loans: loans.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	console.log('\nStarting dev seed...\n');

	deleteAll();

	const roles = seedRoles();
	const adminUser = await seedAdminUser();
	const users = seedUsers(20);
	seedUserRoles(users, adminUser, roles);
	const allUsers = [adminUser, ...users];
	const reservations = seedReservations(allUsers);
	seedClosures();
	const events = seedEvents(allUsers);
	const bands = seedBands(allUsers);
	const series = seedRecurringSeries(allUsers);
	const payments = seedPaymentRecords(allUsers, reservations);
	const tickets = seedTickets(allUsers, events);
	const notifications = seedNotifications(allUsers);
	const preferences = seedNotificationPreferences(allUsers);
	seedProductConfig();
	seedCreditTransactions(allUsers);
	const marketing = seedMarketing(allUsers);
	const eq = seedEquipment(allUsers);

	sqlite.pragma('foreign_keys = ON');

	console.log('\nSeed complete:');
	console.log(`  ${allUsers.length} users (admin: admin@corvallismusic.org / password)`);
	console.log(`  ${roles.length} roles`);
	console.log(`  ${reservations.length} reservations`);
	console.log(`  ${events.length} events`);
	console.log(`  ${bands.length} bands`);
	console.log(`  ${series.length} recurring series`);
	console.log(`  ${payments.length} payment records`);
	console.log(`  ${tickets.length} tickets`);
	console.log(`  ${notifications.length} notifications`);
	console.log(`  ${preferences.length} notification preferences`);
	console.log('  3 product configs');
	console.log(`  ${marketing.audiences} audiences, ${marketing.subscribers} subscribers, ${marketing.campaigns} campaigns`);
	console.log(`  ${eq.categories} equipment categories, ${eq.items} equipment items, ${eq.loans} loans`);

	sqlite.pragma('wal_checkpoint(TRUNCATE)');
	sqlite.close();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
