// ---------------------------------------------------------------------------
// Shared finance types — importable from both client and server code
// ---------------------------------------------------------------------------
// These are pure type definitions with no server-side dependencies.
// The canonical implementations live in $lib/server/finance/ but these
// interfaces are re-exported here for component props.
// ---------------------------------------------------------------------------

/** Dollars per subscription unit. 1 unit = 1 free practice hour. */
export const DOLLARS_PER_UNIT = 5;

/** Credit balance shape stored on the user record. */
export interface Credits {
	free_hours?: number;
	equipment_credits?: number;
}

/** Subscription status returned by getSubscription(). */
export interface SubscriptionInfo {
	id: string;
	status: string;
	quantity: number;
	coveringFees: boolean;
	currentPeriodEnd: Date;
	cancelAtPeriodEnd: boolean;
}

/** Community stats for the membership marketing page. */
export interface CommunityStats {
	sustainingMemberCount: number;
	totalFreeHoursAllocated: number;
	participationPercent: number;
}
