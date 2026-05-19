export * from './auth';
export * from './authorization';
export * from './finance';
export * from './reservation';
export * from './product-config';
export * from './event';
export * from './ticket';
export * from './notification';
export * from './recurring';
export * from './marketing';
export * from './equipment';
export * from './band';
export * from './platform-invite';
export * from './help';

// ---------------------------------------------------------------------------
// Serialized resource types — safe for client use via `import type`
// ---------------------------------------------------------------------------

import { user } from './auth';
import { band, bandMember } from './band';
import { reservation, closure } from './reservation';
import { event } from './event';
import { equipment, equipmentCategory, equipmentLoan } from './equipment';
import { ticket } from './ticket';
import { recurringSeries } from './recurring';
import { paymentCache, creditTransaction } from './finance';
import { audience } from './marketing';

type Serialized<T> = {
	[K in keyof T]: T[K] extends Date
		? string
		: T[K] extends Date | null
			? string | null
			: T[K];
};

export type User = Serialized<typeof user.$inferSelect>;
export type Band = Serialized<typeof band.$inferSelect>;
export type BandMember = Serialized<typeof bandMember.$inferSelect>;
export type Reservation = Serialized<typeof reservation.$inferSelect>;
export type Event = Serialized<typeof event.$inferSelect>;
export type Equipment = Serialized<typeof equipment.$inferSelect>;
export type EquipmentCategory = Serialized<typeof equipmentCategory.$inferSelect>;
export type EquipmentLoan = Serialized<typeof equipmentLoan.$inferSelect>;
export type Ticket = Serialized<typeof ticket.$inferSelect>;
export type RecurringSeries = Serialized<typeof recurringSeries.$inferSelect>;
export type Closure = Serialized<typeof closure.$inferSelect>;
export type Payment = Serialized<typeof paymentCache.$inferSelect>;
export type CreditTransaction = Serialized<typeof creditTransaction.$inferSelect>;
export type Audience = Serialized<typeof audience.$inferSelect>;
