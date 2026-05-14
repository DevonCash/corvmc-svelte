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
import { event } from '../src/lib/server/db/schema/event';
import { productConfig } from '../src/lib/server/db/schema/product-config';
import { creditTransaction } from '../src/lib/server/db/schema/finance';

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

// ---------------------------------------------------------------------------
// Seed functions
// ---------------------------------------------------------------------------

async function truncateAll() {
	console.log('Truncating all tables...');
	await db.execute(sql`
		TRUNCATE TABLE
			credit_transaction,
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

		const [u] = await db.insert(user).values({
			id,
			name,
			email,
			emailVerified: true,
			pronouns: pick(PRONOUNS),
			phone: Math.random() > 0.4 ? `541-555-${String(randomInt(1000, 9999))}` : null,
			credits: { free_hours: randomInt(0, 8), equipment: randomInt(0, 3) },
			createdAt,
			updatedAt: createdAt
		}).returning();

		users.push(u);
	}
	return users;
}

interface SeedRole { id: number; name: string }
interface SeedUser { id: string; name: string }

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

async function seedReservations(users: SeedUser[]) {
	console.log('Seeding reservations...');
	const statuses = ['scheduled', 'confirmed', 'completed', 'no_show', 'cancelled'] as const;
	const rows = [];

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

async function seedEvents(users: SeedUser[]) {
	console.log('Seeding events...');
	const rows = [];
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
	await seedProductConfig();
	await seedCreditTransactions(allUsers);

	console.log('\nSeed complete:');
	console.log(`  ${allUsers.length} users (admin: admin@corvallismusic.org / password)`);
	console.log(`  ${roles.length} roles`);
	console.log(`  ${reservations.length} reservations`);
	console.log(`  ${closures.length} closures`);
	console.log(`  ${events.length} events`);
	console.log('  3 product configs');
	console.log('  credit transactions for 12 users');

	await client.end();
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
