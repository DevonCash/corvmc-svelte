import { z } from 'zod';

// ---------------------------------------------------------------------------
// Credit types and config
// ---------------------------------------------------------------------------

export const creditTypes = ['free_hours', 'equipment_credits'] as const;
export type CreditType = (typeof creditTypes)[number];

/** Per-type policy config. maxBalance null = unlimited. */
export const creditTypeConfig: Record<CreditType, { maxBalance: number | null }> = {
	free_hours: { maxBalance: null },
	equipment_credits: { maxBalance: 250 }
};

/** Type guard: is this string a valid CreditType? */
export function isCreditType(value: string): value is CreditType {
	return creditTypes.includes(value as CreditType);
}

// ---------------------------------------------------------------------------
// Credits column shape: { [CreditType]: balance }
// ---------------------------------------------------------------------------

export const creditsSchema = z
	.object({
		free_hours: z.number().int().min(0).optional(),
		equipment_credits: z.number().int().min(0).optional()
	})
	.strict();

export type Credits = z.infer<typeof creditsSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse and validate a raw credits JSONB value from the database. */
export function parseCredits(raw: unknown): Credits {
	if (raw == null || (typeof raw === 'object' && Object.keys(raw as object).length === 0)) {
		return {};
	}
	return creditsSchema.parse(raw);
}

/** Get the balance for a specific credit type, defaulting to 0. */
export function getBalance(credits: Credits, type: CreditType): number {
	return credits[type] ?? 0;
}

// ---------------------------------------------------------------------------
// Transaction sources
// ---------------------------------------------------------------------------

export const transactionSources = [
	'monthly_allocation',
	'checkout',
	'refund',
	'cancelled',
	'admin_adjustment'
] as const;

export type TransactionSource = (typeof transactionSources)[number];
