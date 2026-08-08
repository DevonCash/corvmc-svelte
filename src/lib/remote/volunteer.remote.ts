import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { query, form } from '$app/server';
import { requireStaff, requireUser } from '$lib/server/authorization';
import { requireFeature } from '$lib/server/feature-flags';
import { mapDomainError } from '$lib/server/errors';
import { renderMarkdown } from '$lib/utils/markdown';
import {
	createVolunteerRole as createRoleService,
	updateVolunteerRole as updateRoleService,
	archiveVolunteerRole as archiveRoleService,
	restoreVolunteerRole as restoreRoleService,
	deleteVolunteerRole as deleteRoleService,
	listVolunteerRoles
} from '$lib/server/volunteer/volunteer-role-service';
import {
	submitHours,
	updateHourLog,
	withdrawHourLog,
	approveHourLog,
	rejectHourLog,
	listHourLogs,
	listUserHourLogs,
	getStatusCounts,
	getUserHourSummary
} from '$lib/server/volunteer/hour-log-service';
import {
	getVolunteerTotals,
	getHoursByMember,
	getHoursByRole,
	getHoursByMonth
} from '$lib/server/volunteer/volunteer-report-service';
import {
	volunteerHourStatuses,
	VOLUNTEER_DESCRIPTION_MAX,
	VOLUNTEER_REVIEW_NOTES_MAX,
	VOLUNTEER_ROLE_DESCRIPTION_MAX,
	VOLUNTEER_ROLE_NAME_MAX
} from '$lib/config';
import type { VolunteerHourStatus } from '$lib/server/db/schema/volunteer';

// Hours come off the form as a decimal (0.25 steps) and are stored as integer
// minutes. One place does the conversion so the two can't drift.
function hoursToMinutes(hours: string | number): number {
	const parsed = typeof hours === 'number' ? hours : parseFloat(hours);
	if (!Number.isFinite(parsed)) error(400, 'Enter how long you worked');
	return Math.round(parsed * 60);
}

function asStatus(raw: string | undefined): VolunteerHourStatus | undefined {
	return volunteerHourStatuses.includes(raw as VolunteerHourStatus)
		? (raw as VolunteerHourStatus)
		: undefined;
}

// ---------------------------------------------------------------------------
// Queries — Staff
// ---------------------------------------------------------------------------
// Staff functions guard with requireStaff() and deliberately do NOT check the
// feature flag: flags gate the member, band and public surfaces only, so staff
// can set up roles and work the queue before volunteering is switched on for
// everyone — and keep administering it if it is switched back off (#171).
// The member functions below do check it.

const staffLogFilters = z.object({
	status: z.string().optional(),
	volunteerRoleId: z.string().optional(),
	search: z.string().optional(),
	from: z.string().optional(),
	to: z.string().optional(),
	page: z.number().optional()
});

export const getStaffVolunteerLogs = query(staffLogFilters, async (f) => {
	await requireStaff();
	return listHourLogs(
		{
			status: asStatus(f.status),
			volunteerRoleId: f.volunteerRoleId || undefined,
			search: f.search || undefined,
			from: f.from || undefined,
			to: f.to || undefined
		},
		{ page: f.page ?? 1, pageSize: 50 }
	);
});

export const getVolunteerStatusCounts = query(async () => {
	await requireStaff();
	return getStatusCounts();
});

/** Staff view of the role list — includes archived roles. */
export const getVolunteerRoles = query(async () => {
	await requireStaff();
	return listVolunteerRoles({ includeInactive: true });
});

const reportRange = z.object({
	from: z.string().optional(),
	to: z.string().optional()
});

export const getVolunteerReport = query(reportRange, async (range) => {
	await requireStaff();

	const [totals, byRole, byMonth] = await Promise.all([
		getVolunteerTotals(range),
		getHoursByRole(range),
		getHoursByMonth(range)
	]);

	return { totals, byRole, byMonth };
});

export const getVolunteerReportByMember = query(
	reportRange.extend({ page: z.number().optional() }),
	async (r) => {
		await requireStaff();
		return getHoursByMember({ from: r.from, to: r.to }, { page: r.page ?? 1, pageSize: 50 });
	}
);

// ---------------------------------------------------------------------------
// Queries — Member
// ---------------------------------------------------------------------------

/**
 * Member view of the role list — live roles only, with job descriptions.
 *
 * The description is authored as markdown and rendered here rather than in the
 * component: `sanitizeBio` only sanitizes HTML, so passing markdown through it
 * left `**bold**` on the page as literal asterisks. Rendering server-side also
 * keeps `marked` and `xss` out of the client bundle.
 */
export const getActiveVolunteerRoles = query(async () => {
	await requireFeature('volunteering');
	requireUser();
	const roles = await listVolunteerRoles();
	return roles.map((r) => ({
		id: r.id,
		name: r.name,
		descriptionHtml: r.description ? renderMarkdown(r.description) : null
	}));
});

export const getMyVolunteerHours = query(async () => {
	await requireFeature('volunteering');
	const currentUser = requireUser();
	return listUserHourLogs(currentUser.id);
});

export const getMyVolunteerSummary = query(async () => {
	await requireFeature('volunteering');
	const currentUser = requireUser();
	return getUserHourSummary(currentUser.id);
});

// ---------------------------------------------------------------------------
// Forms — Hour logs (member)
// ---------------------------------------------------------------------------

// Messages are supplied on every user-facing rule: the field-level zod error is
// what the form renders, and the default reads "Too small: expected string to
// have >=1 characters".
const hoursFormSchema = z.object({
	volunteerRoleId: z.string().min(1, 'Pick what you helped with'),
	workedOn: z.string().min(1, 'Pick the date you worked'),
	hours: z.string().min(1, 'Enter how long you worked'),
	description: z
		.string()
		.min(1, 'Describe what you worked on')
		.max(VOLUNTEER_DESCRIPTION_MAX, `Keep this under ${VOLUNTEER_DESCRIPTION_MAX} characters`)
});

export const submitVolunteerHours = form(hoursFormSchema, async (data) => {
	await requireFeature('volunteering');
	const currentUser = requireUser();

	try {
		await submitHours(currentUser.id, {
			volunteerRoleId: data.volunteerRoleId,
			workedOn: data.workedOn,
			minutes: hoursToMinutes(data.hours),
			description: data.description
		});
	} catch (err) {
		mapDomainError(err);
	}

	await refreshMemberViews();
	return { success: true };
});

export const editVolunteerHours = form(
	hoursFormSchema.extend({ id: z.string().min(1) }),
	async (data) => {
		await requireFeature('volunteering');
		const currentUser = requireUser();

		try {
			await updateHourLog(data.id, currentUser.id, {
				volunteerRoleId: data.volunteerRoleId,
				workedOn: data.workedOn,
				minutes: hoursToMinutes(data.hours),
				description: data.description
			});
		} catch (err) {
			mapDomainError(err);
		}

		await refreshMemberViews();
		return { success: true };
	}
);

export const withdrawVolunteerHours = form(z.object({ id: z.string().min(1) }), async (data) => {
	await requireFeature('volunteering');
	const currentUser = requireUser();

	try {
		await withdrawHourLog(data.id, currentUser.id);
	} catch (err) {
		mapDomainError(err);
	}

	await refreshMemberViews();
	return { success: true };
});

// ---------------------------------------------------------------------------
// Forms — Review (staff)
// ---------------------------------------------------------------------------

export const approveVolunteerHours = form(
	z.object({
		id: z.string().min(1),
		notes: z.string().max(VOLUNTEER_REVIEW_NOTES_MAX).optional()
	}),
	async (data) => {
		const staff = await requireStaff();

		try {
			await approveHourLog(data.id, staff.id, data.notes);
		} catch (err) {
			mapDomainError(err);
		}

		await refreshStaffQueue();
		return { success: true };
	}
);

export const rejectVolunteerHours = form(
	z.object({
		id: z.string().min(1),
		notes: z
			.string()
			.min(1, 'Give the member a reason so they can correct and resubmit')
			.max(VOLUNTEER_REVIEW_NOTES_MAX, `Keep this under ${VOLUNTEER_REVIEW_NOTES_MAX} characters`)
	}),
	async (data) => {
		const staff = await requireStaff();

		try {
			await rejectHourLog(data.id, staff.id, data.notes);
		} catch (err) {
			mapDomainError(err);
		}

		await refreshStaffQueue();
		return { success: true };
	}
);

// ---------------------------------------------------------------------------
// Forms — Roles (staff)
// ---------------------------------------------------------------------------

const roleFormSchema = z.object({
	name: z
		.string()
		.min(1, 'Give the role a name')
		.max(VOLUNTEER_ROLE_NAME_MAX, `Keep the name under ${VOLUNTEER_ROLE_NAME_MAX} characters`),
	description: z
		.string()
		.max(
			VOLUNTEER_ROLE_DESCRIPTION_MAX,
			`Keep the description under ${VOLUNTEER_ROLE_DESCRIPTION_MAX} characters`
		)
		.optional(),
	displayOrder: z.string().optional(),
	isActive: z.string().optional()
});

export const createVolunteerRole = form(roleFormSchema, async (data) => {
	await requireStaff();

	try {
		await createRoleService({
			name: data.name,
			description: data.description,
			displayOrder: data.displayOrder ? parseInt(data.displayOrder, 10) : 0,
			isActive: data.isActive !== 'false'
		});
	} catch (err) {
		mapDomainError(err);
	}

	void getVolunteerRoles().refresh();
	void getActiveVolunteerRoles().refresh();
	return { success: true };
});

export const updateVolunteerRole = form(
	roleFormSchema.extend({ id: z.string().min(1) }),
	async (data) => {
		await requireStaff();

		try {
			await updateRoleService(data.id, {
				name: data.name,
				description: data.description ?? '',
				displayOrder: data.displayOrder ? parseInt(data.displayOrder, 10) : undefined,
				isActive: data.isActive !== 'false'
			});
		} catch (err) {
			mapDomainError(err);
		}

		await refreshRoleViews();
		return { success: true };
	}
);

export const archiveVolunteerRole = form(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();

	try {
		await archiveRoleService(data.id);
	} catch (err) {
		mapDomainError(err);
	}

	await refreshRoleViews();
	return { success: true };
});

export const restoreVolunteerRole = form(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();

	try {
		await restoreRoleService(data.id);
	} catch (err) {
		mapDomainError(err);
	}

	await refreshRoleViews();
	return { success: true };
});

export const deleteVolunteerRole = form(z.object({ id: z.string().min(1) }), async (data) => {
	await requireStaff();

	try {
		await deleteRoleService(data.id);
	} catch (err) {
		mapDomainError(err);
	}

	await refreshRoleViews();
	return { success: true };
});

// ---------------------------------------------------------------------------
// Refresh helpers
// ---------------------------------------------------------------------------

async function refreshMemberViews() {
	await Promise.all([getMyVolunteerHours().refresh(), getMyVolunteerSummary().refresh()]);
}

/**
 * Only the argless queries can be refreshed from here. `refresh()` is keyed by
 * argument, so `getStaffVolunteerLogs({})` refreshes the empty-filter instance
 * — never the `{ status: 'pending', page: 1 }` one the queue page actually
 * subscribes to. Arg-keyed queries are refreshed by the page, which is the only
 * place that knows its own filters; see the `onsuccess` handlers on
 * /staff/volunteer and the mount refresh on /staff/volunteer/report.
 */
async function refreshStaffQueue() {
	await getVolunteerStatusCounts().refresh();
}

// Role edits change the member picker, the staff table (log counts included),
// and the report's role names all at once.
async function refreshRoleViews() {
	await Promise.all([getVolunteerRoles().refresh(), getActiveVolunteerRoles().refresh()]);
}
