import { error } from '@sveltejs/kit';

// Domain error imports — grouped by service module
import { BandNotFoundError, BandMemberExistsError, CannotRemoveOwnerError, OwnerCannotLeaveError } from './band/band-service';
import { ReservationConflictError, ReservationValidationError } from './reservation/reservation-service';
import { RecurringSeriesError } from './reservation/recurring-series-service';
import { EquipmentNotFoundError, CategoryNotFoundError, CategoryHasEquipmentError } from './equipment/equipment-service';
import { LoanNotFoundError, InvalidLoanTransitionError, InsufficientQuantityError } from './equipment/loan-service';
import { InsufficientCreditsError } from './finance/credit-service';

// ---------------------------------------------------------------------------
// Base class for future domain errors
// ---------------------------------------------------------------------------

/**
 * Base class that new domain errors should extend. Existing error classes
 * predate this base and will be migrated in a follow-up.
 */
export abstract class DomainError extends Error {
	abstract readonly httpStatus: number;

	constructor(message: string) {
		super(message);
		this.name = this.constructor.name;
	}
}

// ---------------------------------------------------------------------------
// Mapper
// ---------------------------------------------------------------------------

/**
 * Maps a known domain error to a SvelteKit HTTP error. Unknown errors are
 * re-thrown so SvelteKit's default 500 handling kicks in.
 *
 * Usage in .remote.ts catch blocks:
 * ```ts
 * import { mapDomainError } from '$lib/server/errors';
 *
 * form(async ({ request }) => {
 *   try {
 *     await someService.doThing(…);
 *   } catch (err) {
 *     mapDomainError(err);
 *   }
 * });
 * ```
 */
export function mapDomainError(err: unknown): never {
	// Future domain errors that extend DomainError
	if (err instanceof DomainError) {
		error(err.httpStatus, err.message);
	}

	// --- 404 Not Found ---
	if (
		err instanceof BandNotFoundError ||
		err instanceof EquipmentNotFoundError ||
		err instanceof CategoryNotFoundError ||
		err instanceof LoanNotFoundError
	) {
		error(404, (err as Error).message);
	}

	// --- 409 Conflict ---
	if (
		err instanceof ReservationConflictError ||
		err instanceof BandMemberExistsError
	) {
		error(409, (err as Error).message);
	}

	// --- 400 Validation ---
	if (err instanceof ReservationValidationError) {
		error(400, err.message);
	}

	// --- 422 Business rule violations ---
	if (
		err instanceof CannotRemoveOwnerError ||
		err instanceof OwnerCannotLeaveError ||
		err instanceof CategoryHasEquipmentError ||
		err instanceof InvalidLoanTransitionError ||
		err instanceof InsufficientQuantityError ||
		err instanceof InsufficientCreditsError ||
		err instanceof RecurringSeriesError
	) {
		error(422, (err as Error).message);
	}

	// Unknown — re-throw for SvelteKit's default 500 handling
	throw err;
}
