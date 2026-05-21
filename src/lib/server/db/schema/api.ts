import type { Credits, SubscriptionInfo, CommunityStats } from './finance';
import type { User } from './auth';
import type { Band, BandMember } from './band';
import type { Reservation, Closure } from './reservation';
import type { Event } from './event';
import type { Equipment, EquipmentCategory, EquipmentLoan } from './equipment';
import type { Ticket } from './ticket';
import type { RecurringSeries } from './recurring';
import type { Payment, CreditTransaction } from './finance';
import type { Audience } from './marketing';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface Pagination {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

export interface MemberSummary {
	name: string;
	email?: string;
	pronouns?: string | null;
	role?: string | null;
	userId?: string;
	avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Auth & Layout
// ---------------------------------------------------------------------------

export interface AuthMeResponse {
	user: Pick<User, 'id' | 'name' | 'email' | 'image'> | null;
}

export interface MemberLayoutResponse {
	user: Pick<User, 'id' | 'name' | 'email'>;
	userBands: (Pick<Band, 'id' | 'name' | 'slug' | 'avatarKey'> & { role: string })[];
	isStaff: boolean;
}

export interface StaffLayoutResponse {
	user: Pick<User, 'id' | 'name' | 'email'>;
	userBands: Pick<Band, 'id' | 'name' | 'slug'>[];
}

export interface BandLayoutResponse {
	band: Pick<Band, 'id' | 'name' | 'slug' | 'bio' | 'ownerId' | 'avatarKey' | 'createdAt'> & {
		memberCount: number;
	};
	userRole: string;
	isStaff: boolean;
	userBands: Pick<Band, 'id' | 'name' | 'slug'>[];
	user: Pick<User, 'id' | 'name' | 'email'> | null;
}

// ---------------------------------------------------------------------------
// Member pages
// ---------------------------------------------------------------------------

export interface DashboardResponse {
	weekReservations: (Pick<
		Reservation,
		'id' | 'bookerType' | 'bookerId' | 'status' | 'startsAt' | 'endsAt' | 'notes'
	> & {
		bandName: string | null;
	})[];
	upcomingEvents: (Pick<Event, 'id' | 'title' | 'startsAt' | 'endsAt' | 'doorsAt'> & {
		posterUrl: string | null;
	})[];
	credits: Credits;
	subscription: SubscriptionInfo | null;
	allocatedThisMonth: number;
	usedThisMonth: number;
	pendingInviteCount: number;
}

export interface AccountResponse {
	user: Pick<User, 'id' | 'name' | 'email' | 'pronouns' | 'phone'>;
	isStaff: boolean;
}

export interface MemberBandsResponse {
	pending: (Pick<Band, 'id' | 'name' | 'slug' | 'avatarKey'> &
		Pick<BandMember, 'role' | 'status'> & { memberCount: number })[];
	active: (Pick<Band, 'id' | 'name' | 'slug' | 'avatarKey'> &
		Pick<BandMember, 'role' | 'status'> & { memberCount: number })[];
}

type MemberReservation = Pick<
	Reservation,
	| 'id'
	| 'bookerType'
	| 'bookerId'
	| 'status'
	| 'startsAt'
	| 'endsAt'
	| 'notes'
	| 'recurringSeriesId'
> & {
	paidAt: string | null;
	paidWithCredits: boolean;
};

export interface MemberReservationsResponse {
	upcoming: MemberReservation[];
	past: MemberReservation[];
	recurringSeries: {
		id: string;
		frequencyLabel: string;
		bookerType: string;
		startsAt: string;
		endsAt: string;
		createdAt: string;
	}[];
}

export interface ReservationPayResponse {
	reservation: Pick<Reservation, 'id' | 'startsAt' | 'endsAt' | 'notes'>;
	durationHours: number;
	totalCents: number;
	hourlyRateCents: number;
	freeHoursBalance: number;
}

export interface MemberTicketsResponse {
	tickets: (Pick<
		Ticket,
		'id' | 'eventId' | 'code' | 'status' | 'attendeeName' | 'checkedInAt' | 'createdAt'
	> & {
		event: Pick<Event, 'title' | 'startsAt' | 'endsAt'> | null;
	})[];
}

export interface MemberEquipmentResponse {
	equipment: (Pick<Equipment, 'id' | 'name' | 'description' | 'categoryId' | 'condition' | 'totalQuantity'> & {
		categoryName: string;
		pricingTier: string;
		availableQuantity: number;
	})[];
	categories: Pick<EquipmentCategory, 'id' | 'name' | 'pricingTier'>[];
	creditBalance: number;
	isSustainingMember: boolean;
	filters: { search: string; categoryId: string };
}

export interface MemberEquipmentLoansResponse {
	active: (EquipmentLoan & { equipmentName: string | null; isOverdue: boolean })[];
	past: (EquipmentLoan & { equipmentName: string | null; isOverdue: boolean })[];
}

export interface MembershipResponse {
	subscription: SubscriptionInfo | null;
	credits: Credits;
	billingPortalUrl: string | null;
	communityStats: CommunityStats;
	allocatedThisMonth: number;
	usedThisMonth: number;
	contributionUnitCents: number;
	feeSchedule: { perUnit: number };
}

// ---------------------------------------------------------------------------
// Band pages
// ---------------------------------------------------------------------------

export interface BandUpcomingResponse {
	upcoming: (Pick<Reservation, 'id' | 'status' | 'startsAt' | 'endsAt' | 'notes'> & {
		bookedByName: string | null;
	})[];
}

export interface BandMembersResponse {
	active: (Pick<BandMember, 'id' | 'userId' | 'role' | 'position' | 'createdAt'> & {
		userName: string;
		userEmail: string;
	})[];
	pending: (Pick<BandMember, 'id' | 'userId' | 'role' | 'position' | 'invitedById' | 'createdAt'> & {
		userName: string;
		userEmail: string;
	})[];
}

export interface BandReservationsResponse {
	upcoming: (Pick<Reservation, 'id' | 'status' | 'startsAt' | 'endsAt' | 'notes'> & {
		bookedByName: string | null;
	})[];
	past: (Pick<Reservation, 'id' | 'status' | 'startsAt' | 'endsAt' | 'notes'> & {
		bookedByName: string | null;
	})[];
}

// ---------------------------------------------------------------------------
// Staff pages
// ---------------------------------------------------------------------------

export interface StaffDashboardResponse {
	stats: {
		totalUsers: number;
		totalRoles: number;
		totalPermissions: number;
		newUsersThisMonth: number;
	};
	recentUsers: Pick<User, 'id' | 'name' | 'email' | 'createdAt'>[];
}

export interface StaffUsersResponse {
	users: (Pick<User, 'id' | 'name' | 'email' | 'pronouns' | 'createdAt'> & {
		roles: string[];
	})[];
	pagination: Pagination;
	search: string;
}

export interface StaffBandsResponse {
	bands: (Pick<Band, 'id' | 'name' | 'slug' | 'createdAt' | 'deletedAt'> & {
		status: string;
	})[];
	pagination: Pagination;
	filters: { search: string; status: string };
}

export interface StaffEventsResponse {
	pagination: Pagination;
	events: Pick<
		Event,
		| 'id'
		| 'title'
		| 'description'
		| 'startsAt'
		| 'endsAt'
		| 'doorsAt'
		| 'publishedAt'
		| 'createdAt'
		| 'updatedAt'
		| 'status'
		| 'tags'
		| 'reservationId'
		| 'ticketingEnabled'
		| 'ticketPrice'
		| 'ticketQuantity'
		| 'posterKey'
	>[];
}

export interface StaffEventDetailResponse {
	event: Pick<
		Event,
		| 'id'
		| 'title'
		| 'description'
		| 'startsAt'
		| 'endsAt'
		| 'doorsAt'
		| 'publishedAt'
		| 'createdAt'
		| 'updatedAt'
		| 'status'
		| 'tags'
		| 'reservationId'
		| 'ticketingEnabled'
		| 'ticketPrice'
		| 'ticketQuantity'
		| 'posterKey'
	>;
	posterUrl: string | null;
	creator: { name: string; email: string };
	linkedReservation: Pick<Reservation, 'id' | 'status' | 'startsAt' | 'endsAt'> | null;
	ticketStats: { sold: number; remaining: number | null } | null;
	tickets: Pick<
		Ticket,
		| 'id'
		| 'purchaseId'
		| 'attendeeName'
		| 'attendeeEmail'
		| 'code'
		| 'status'
		| 'checkedInAt'
		| 'createdAt'
	>[];
}

export interface StaffCheckInResponse {
	event: Pick<Event, 'id' | 'title' | 'startsAt' | 'ticketQuantity'>;
	tickets: Pick<
		Ticket,
		'id' | 'attendeeName' | 'attendeeEmail' | 'code' | 'status' | 'checkedInAt'
	>[];
	stats: { sold: number; checkedIn: number };
}

export interface StaffReservationsResponse {
	reservations: (Pick<
		Reservation,
		| 'id'
		| 'status'
		| 'startsAt'
		| 'endsAt'
		| 'bookerType'
		| 'notes'
		| 'stripePaymentRecordId'
		| 'createdByUserId'
		| 'recurringSeriesId'
	> & {
		memberName: string;
		memberEmail: string;
		memberPronouns: string | null;
		memberRole: string | null;
	})[];
	unresolved: (Pick<
		Reservation,
		'id' | 'status' | 'startsAt' | 'endsAt' | 'createdByUserId' | 'notes'
	> & {
		memberName: string;
		memberEmail: string;
		memberPronouns: string | null;
		memberRole: string | null;
	})[];
	pagination: Pagination;
	tab: string;
	search: string;
	statusFilter: string[];
	dateFrom: string | null;
	dateTo: string | null;
	counts: { upcoming: number; all: number; unresolved: number };
	hourlyRateCents: number;
}

export interface StaffReservationDetailResponse {
	reservation: Pick<
		Reservation,
		| 'id'
		| 'status'
		| 'startsAt'
		| 'endsAt'
		| 'bookerType'
		| 'bookerId'
		| 'notes'
		| 'cancellationReason'
		| 'stripePaymentRecordId'
		| 'createdByUserId'
		| 'createdAt'
	> & {
		memberName: string;
		memberEmail: string;
		memberPhone: string | null;
		memberPronouns: string | null;
		memberImage: string | null;
	};
	sameDayReservations: (Pick<Reservation, 'id' | 'bookerType' | 'startsAt' | 'endsAt'> & {
		memberName: string;
	})[];
	isLastOfDay: boolean;
	prevId: string | null;
	nextId: string | null;
	isFirstReservation: boolean;
	hourlyRateCents: number;
}

export interface StaffEquipmentResponse {
	equipment: (Pick<
		Equipment,
		'id' | 'name' | 'description' | 'categoryId' | 'createdAt' | 'updatedAt' | 'deletedAt'
	> & {
		category: Pick<
			EquipmentCategory,
			'id' | 'name' | 'pricingTier' | 'createdAt' | 'updatedAt'
		>;
	})[];
	categories: Pick<
		EquipmentCategory,
		'id' | 'name' | 'pricingTier' | 'displayOrder' | 'createdAt' | 'updatedAt'
	>[];
	pagination: Pagination;
	filters: { search: string; categoryId: string; status: string };
}

export interface StaffEquipmentLoansResponse {
	loans: Pick<
		EquipmentLoan,
		| 'id'
		| 'status'
		| 'requestedPickupDate'
		| 'scheduledPickupDate'
		| 'dueDate'
		| 'checkedOutAt'
		| 'returnedAt'
		| 'createdAt'
		| 'updatedAt'
	>[];
	pagination: Pagination;
	filters: { search: string; status: string };
}

export interface StaffClosuresResponse {
	closures: Pick<Closure, 'id' | 'reason' | 'startsAt' | 'endsAt'>[];
}

export interface StaffPaymentsResponse {
	payments: (Pick<Payment, 'id' | 'userId' | 'amountCents' | 'paymentMethod' | 'status' | 'reservationId' | 'createdAt'> & {
		userName: string;
		userEmail: string;
	})[];
	pagination: Pagination;
	filters: { search: string; method: string; status: string; from: string; to: string };
}

export interface StaffCreditsResponse {
	transactions: (Pick<CreditTransaction, 'id' | 'userId' | 'creditType' | 'amount' | 'balanceAfter' | 'source' | 'sourceId' | 'description' | 'createdAt'> & {
		userName: string | null;
		userEmail: string;
	})[];
	pagination: Pagination;
	filters: { search: string; creditType: string; source: string; from: string; to: string };
}

export interface StaffRecurringResponse {
	series: (Pick<RecurringSeries, 'id' | 'createdAt' | 'cancelledAt'> & {
		userName: string;
		userPronouns: string | null;
		userRole: string | null;
		frequencyLabel: string;
		bookerType: string;
		startsAt: string;
		endsAt: string;
	})[];
	pagination: Pagination;
	filter: string;
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export interface DirectoryResponse {
	members: (Pick<User, 'id' | 'name' | 'pronouns' | 'image' | 'tagline' | 'lookingForBand'> & {
		instruments: string[];
		genres: string[];
		memberSince: string;
		bands: Pick<Band, 'name' | 'slug'>[];
	})[];
	bands: (Pick<Band, 'id' | 'name' | 'slug' | 'bio' | 'tagline' | 'lookingForMembers'> & {
		avatarUrl: string | null;
		memberCount: number;
		genres: string[];
	})[];
}

export interface DirectoryBandResponse {
	band: Pick<
		Band,
		'id' | 'name' | 'slug' | 'bio' | 'tagline' | 'createdAt' | 'lookingForMembers' | 'directoryContact' | 'links'
	> & {
		avatarUrl: string | null;
		memberCount: number;
		genres: string[];
	};
	members: (Pick<BandMember, 'id' | 'role' | 'position'> & {
		userName: string;
		userImage: string | null;
	})[];
}

export interface DirectoryMemberResponse {
	member: Pick<
		User,
		'id' | 'name' | 'pronouns' | 'image' | 'bio' | 'tagline' | 'lookingForBand' | 'directoryContact' | 'links'
	> & {
		instruments: string[];
		genres: string[];
	};
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventsResponse {
	events: (Pick<
		Event,
		'id' | 'title' | 'description' | 'startsAt' | 'endsAt' | 'doorsAt' | 'tags' | 'ticketingEnabled' | 'ticketPrice'
	> & {
		posterUrl: string | null;
	})[];
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

export interface AudiencesResponse {
	audiences: (Pick<Audience, 'id' | 'name' | 'slug' | 'description'> & {
		optIn: boolean;
	})[];
}

export interface AudienceDetailResponse {
	audience: Pick<Audience, 'id' | 'name' | 'slug' | 'description'>;
	isSubscribed: boolean;
}

export interface UnsubscribeResponse {
	valid: boolean;
	audienceName: string | null;
}
