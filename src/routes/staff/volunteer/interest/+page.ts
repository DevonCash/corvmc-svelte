import { redirect } from '@sveltejs/kit';

/**
 * The interest table was folded into the roles page: its per-role counts became
 * a column there, and "who wants to do this" became the role detail page. Kept
 * as a redirect because staff bookmark these panels.
 */
export function load() {
	redirect(308, '/staff/volunteer/roles');
}
