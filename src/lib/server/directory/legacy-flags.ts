/**
 * Mapping from the legacy Laravel `flags` table (spatie/laravel-model-flags) to
 * the directory's member flag booleans. The legacy app stored these as named
 * rows in a polymorphic `flags` table keyed by member-profile id; the new schema
 * stores them as columns on `user`. Used by the Postgres → D1 migrator.
 */

export type MemberFlagFields = {
	lookingForBand: boolean;
	availableForHire: boolean;
	teachesLessons: boolean;
	openToCollaboration: boolean;
};

/** Legacy `flags.name` → new `user` column. */
const FLAG_NAME_TO_FIELD = {
	looking_for_band: 'lookingForBand',
	available_for_hire: 'availableForHire',
	music_teacher: 'teachesLessons',
	open_to_collaboration: 'openToCollaboration'
} as const satisfies Record<string, keyof MemberFlagFields>;

/**
 * Reduce a set of legacy flag names into the new member flag booleans. Unknown
 * names are ignored; missing names default to `false`.
 */
export function mapMemberFlags(names: Iterable<string>): MemberFlagFields {
	const fields: MemberFlagFields = {
		lookingForBand: false,
		availableForHire: false,
		teachesLessons: false,
		openToCollaboration: false
	};
	for (const name of names) {
		const field = FLAG_NAME_TO_FIELD[name as keyof typeof FLAG_NAME_TO_FIELD];
		if (field) fields[field] = true;
	}
	return fields;
}
