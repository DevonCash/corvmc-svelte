import type { DirectoryContact, ProfileLink } from './profile';
import type { SubscriptionInfo, Credits, CommunityStats } from '$lib/finance/types';

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

export interface Pagination {
	page: number;
	pageSize: number;
	total: number;
	totalPages: number;
}

// ---------------------------------------------------------------------------
// Auth & Layout
// ---------------------------------------------------------------------------

export interface AuthMeResponse {
	user: {
		id: string;
		name: string;
		email: string;
		image: string | null;
		[key: string]: unknown;
	} | null;
}

export interface MemberLayoutResponse {
	user: { id: string; name: string; email: string; [key: string]: unknown };
	userBands: { id: string; name: string; slug: string; role: string; [key: string]: unknown }[];
	isStaff: boolean;
}

export interface StaffLayoutResponse {
	user: { id: string; name: string; email: string; [key: string]: unknown };
	userBands: { id: string; name: string; slug: string; [key: string]: unknown }[];
}

export interface BandLayoutResponse {
	band: {
		id: string;
		name: string;
		slug: string;
		bio: string | null;
		ownerId: string;
		avatarKey: string | null;
		memberCount: number;
		createdAt: string;
	};
	userRole: string;
	isStaff: boolean;
	userBands: { id: string; name: string; slug: string; [key: string]: unknown }[];
	user: { id: string; name: string; email: string; [key: string]: unknown } | null;
}

// ---------------------------------------------------------------------------
// Member pages
// ---------------------------------------------------------------------------

export interface DashboardResponse {
	weekReservations: {
		id: string;
		bookerType: string;
		bookerId: string;
		bandName: string | null;
		status: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
	}[];
	upcomingEvents: {
		id: string;
		title: string;
		startsAt: string;
		endsAt: string;
		doorsAt: string | null;
		posterUrl: string | null;
	}[];
	credits: Credits;
	subscription: SubscriptionInfo | null;
	allocatedThisMonth: number;
	usedThisMonth: number;
	pendingInviteCount: number;
}

export interface AccountResponse {
	user: {
		id: string;
		name: string;
		email: string;
		pronouns?: string;
		phone?: string;
	};
	isStaff: boolean;
}

export interface MemberBandsResponse {
	pending: {
		id: string;
		name: string;
		slug: string;
		avatarKey: string | null;
		role: string;
		status: string;
		memberCount: number;
	}[];
	active: {
		id: string;
		name: string;
		slug: string;
		avatarKey: string | null;
		role: string;
		status: string;
		memberCount: number;
	}[];
}

export interface MemberReservationsResponse {
	upcoming: {
		id: string;
		bookerType: string;
		bookerId: string;
		status: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
		recurringSeriesId: string | null;
	}[];
	past: {
		id: string;
		bookerType: string;
		bookerId: string;
		status: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
		recurringSeriesId: string | null;
	}[];
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
	reservation: {
		id: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
	};
	durationHours: number;
	totalCents: number;
	hourlyRateCents: number;
	freeHoursBalance: number;
}

export interface MemberTicketsResponse {
	tickets: {
		id: string;
		eventId: string;
		code: string;
		status: string;
		attendeeName: string;
		checkedInAt: string | null;
		createdAt: string;
		event: { title: string; startsAt: string; endsAt: string } | null;
	}[];
}

export interface MemberEquipmentResponse {
	equipment: {
		id: string;
		name: string;
		description: string;
		categoryId: string;
		categoryName: string;
		pricingTier: string;
		condition: string;
		totalQuantity: number;
		availableQuantity: number;
	}[];
	categories: { id: string; name: string; pricingTier: string }[];
	creditBalance: number;
	filters: { search: string; categoryId: string };
}

export interface EquipmentLoan {
	id: string;
	status: string;
	equipmentName: string | null;
	quantity: number;
	requestedPickupDate: string;
	scheduledPickupDate: string | null;
	dueDate: string | null;
	checkedOutAt: string | null;
	returnedAt: string | null;
	isOverdue: boolean;
	dailyRateCents: number | null;
	totalChargeCents: number | null;
	creditsCents: number | null;
	memberNotes: string | null;
	createdAt: string;
	updatedAt: string;
	[key: string]: unknown;
}

export interface MemberEquipmentLoansResponse {
	active: EquipmentLoan[];
	past: EquipmentLoan[];
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
	upcoming: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
		bookedByName: string | null;
	}[];
}

export interface BandMembersResponse {
	active: {
		id: string;
		userId: string;
		role: string;
		position: string;
		userName: string;
		userEmail: string;
		createdAt: string;
	}[];
	pending: {
		id: string;
		userId: string;
		role: string;
		position: string;
		userName: string;
		userEmail: string;
		invitedById: string;
		createdAt: string;
	}[];
}

export interface BandReservationsResponse {
	upcoming: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
		bookedByName: string | null;
	}[];
	past: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
		notes: string | null;
		bookedByName: string | null;
	}[];
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
	recentUsers: {
		id: string;
		name: string;
		email: string;
		createdAt: string;
	}[];
}

export interface StaffUsersResponse {
	users: {
		id: string;
		name: string;
		email: string;
		pronouns: string | null;
		createdAt: string;
		roles: string[];
	}[];
	pagination: Pagination;
	search: string;
}

export interface StaffBandsResponse {
	bands: {
		id: string;
		name: string;
		slug: string;
		status: string;
		createdAt: string;
		deletedAt: string | null;
		[key: string]: unknown;
	}[];
	filters: { search: string; status: string };
}

export interface StaffEventsResponse {
	events: {
		id: string;
		title: string;
		description: string;
		startsAt: string;
		endsAt: string;
		doorsAt: string | null;
		publishedAt: string | null;
		createdAt: string;
		updatedAt: string;
		status: string;
		tags: string;
		reservationId: string | null;
		ticketingEnabled: boolean;
		ticketPrice: number | null;
		ticketQuantity: number | null;
		posterKey: string | null;
		[key: string]: unknown;
	}[];
}

export interface StaffEventDetailResponse {
	event: {
		id: string;
		title: string;
		description: string;
		startsAt: string;
		endsAt: string;
		doorsAt: string | null;
		publishedAt: string | null;
		createdAt: string;
		updatedAt: string;
		status: string;
		tags: string;
		reservationId: string | null;
		ticketingEnabled: boolean;
		ticketPrice: number | null;
		ticketQuantity: number | null;
		posterKey: string | null;
		[key: string]: unknown;
	};
	posterUrl: string | null;
	creator: { name: string; email: string };
	linkedReservation: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
	} | null;
	ticketStats: { sold: number; remaining: number | null } | null;
	tickets: {
		id: string;
		purchaseId: string;
		attendeeName: string;
		attendeeEmail: string;
		code: string;
		status: string;
		checkedInAt: string | null;
		createdAt: string;
	}[];
}

export interface StaffCheckInResponse {
	event: {
		id: string;
		title: string;
		startsAt: string;
		ticketQuantity: number;
	};
	tickets: {
		id: string;
		attendeeName: string;
		attendeeEmail: string;
		code: string;
		status: string;
		checkedInAt: string | null;
	}[];
	stats: { sold: number; checkedIn: number };
}

export interface StaffReservationsResponse {
	reservations: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
		bookerType: string;
		notes: string | null;
		stripePaymentRecordId: string | null;
		createdByUserId: string;
		recurringSeriesId: string | null;
		memberName: string;
		memberEmail: string;
		memberPronouns: string | null;
	}[];
	unresolved: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
		createdByUserId: string;
		notes: string | null;
		memberName: string;
		memberEmail: string;
		memberPronouns: string | null;
	}[];
	tab: string;
	search: string;
	statusFilter: string[];
	dateFrom: string | null;
	dateTo: string | null;
	counts: { upcoming: number; all: number; unresolved: number };
	hourlyRateCents: number;
}

export interface StaffReservationDetailResponse {
	reservation: {
		id: string;
		status: string;
		startsAt: string;
		endsAt: string;
		bookerType: string;
		bookerId: string;
		notes: string | null;
		cancellationReason: string | null;
		stripePaymentRecordId: string | null;
		createdByUserId: string;
		createdAt: string;
		memberName: string;
		memberEmail: string;
		memberPhone: string | null;
		memberPronouns: string | null;
		memberImage: string | null;
	};
	sameDayReservations: {
		id: string;
		memberName: string;
		bookerType: string;
		startsAt: string;
		endsAt: string;
	}[];
	isLastOfDay: boolean;
	prevId: string | null;
	nextId: string | null;
	isFirstReservation: boolean;
	hourlyRateCents: number;
}

export interface StaffEquipmentResponse {
	equipment: {
		id: string;
		name: string;
		description: string;
		categoryId: string;
		createdAt: string;
		updatedAt: string;
		deletedAt: string | null;
		category: { id: string; name: string; pricingTier: string; createdAt: string; updatedAt: string };
		[key: string]: unknown;
	}[];
	categories: { id: string; name: string; pricingTier: string; displayOrder: number; createdAt: string; updatedAt: string }[];
	filters: { search: string; categoryId: string; status: string };
}

export interface StaffEquipmentLoansResponse {
	loans: {
		id: string;
		status: string;
		requestedPickupDate: string;
		scheduledPickupDate: string | null;
		dueDate: string | null;
		checkedOutAt: string | null;
		returnedAt: string | null;
		createdAt: string;
		updatedAt: string;
		[key: string]: unknown;
	}[];
	filters: { search: string; status: string };
}

export interface StaffClosuresResponse {
	closures: {
		id: string;
		reason: string;
		startsAt: string;
		endsAt: string;
	}[];
}

export interface StaffPaymentsResponse {
	payments: {
		id: string;
		userId: string;
		userName: string;
		userEmail: string;
		amountCents: number;
		paymentMethod: string;
		status: string;
		createdAt: string;
		[key: string]: unknown;
	}[];
	total: number;
	page: number;
	totalPages: number;
	filters: { search: string; method: string; status: string; from: string; to: string };
}

export interface StaffRecurringResponse {
	series: {
		id: string;
		userName: string;
		userPronouns: string | null;
		frequencyLabel: string;
		bookerType: string;
		startsAt: string;
		endsAt: string;
		createdAt: string;
		cancelledAt: string | null;
	}[];
	filter: string;
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

export interface DirectoryResponse {
	members: {
		id: string;
		name: string;
		pronouns: string | null;
		image: string | null;
		tagline: string | null;
		instruments: string[];
		genres: string[];
		lookingForBand: boolean;
		memberSince: string;
		bands: { name: string; slug: string }[];
	}[];
	bands: {
		id: string;
		name: string;
		slug: string;
		bio: string | null;
		tagline: string | null;
		avatarUrl: string | null;
		memberCount: number;
		genres: string[];
		lookingForMembers: boolean;
	}[];
}

export interface DirectoryBandResponse {
	band: {
		id: string;
		name: string;
		slug: string;
		bio: string | null;
		tagline: string | null;
		avatarUrl: string | null;
		memberCount: number;
		createdAt: string;
		genres: string[];
		lookingForMembers: boolean;
		directoryContact: DirectoryContact | null;
		links: ProfileLink[];
	};
	members: {
		id: string;
		role: string;
		position: string;
		userName: string;
		userImage: string | null;
	}[];
}

export interface DirectoryMemberResponse {
	member: {
		id: string;
		name: string;
		pronouns: string | null;
		image: string | null;
		bio: string | null;
		tagline: string | null;
		instruments: string[];
		genres: string[];
		lookingForBand: boolean;
		directoryContact: DirectoryContact | null;
		links: ProfileLink[];
	};
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export interface EventsResponse {
	events: {
		id: string;
		title: string;
		description: string;
		startsAt: string;
		endsAt: string;
		doorsAt: string | null;
		tags: string | null;
		posterUrl: string | null;
		ticketingEnabled: boolean;
		ticketPrice: number | null;
	}[];
}

// ---------------------------------------------------------------------------
// Marketing
// ---------------------------------------------------------------------------

export interface AudiencesResponse {
	audiences: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		optIn: boolean;
		[key: string]: unknown;
	}[];
}

export interface AudienceDetailResponse {
	audience: {
		id: string;
		name: string;
		slug: string;
		description: string | null;
		[key: string]: unknown;
	};
	isSubscribed: boolean;
}

export interface UnsubscribeResponse {
	valid: boolean;
	audienceName: string | null;
}
