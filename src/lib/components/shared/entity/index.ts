/**
 * The entity presentation tiers: chip, row, card — plus the viewer provider
 * that lets each of them derive its own links.
 *
 * **Scope: the staff/member panels.** The public site and the directory
 * profiles have their own art-directed set (`PosterCard`, `VinylCard`,
 * `IdCard`, `GigList`, `directory/profile/*`) which optimises for looking good
 * rather than for dense, consistent data. Do not "consistency-fix" one into the
 * other; they are different jobs. Note this cuts across `member/` too —
 * `member/events/**` and `member/directory/**` are art-directed routes.
 */
export { default as EntityChip } from './EntityChip.svelte';
export { default as EntityRow } from './EntityRow.svelte';
export { default as EntityCard } from './EntityCard.svelte';
export { default as EntityHeader } from './EntityHeader.svelte';
export { default as RelatedList } from './RelatedList.svelte';
export { default as EntityViewer } from './EntityViewer.svelte';
export { entityKinds, type EntityKind } from './registry';
export { getEntityViewer, setEntityViewer } from './context';
// Re-exported so a page can drive `use:rowLink` from the same resolver the
// components use, rather than rebuilding the URL by hand on the <tr>.
export { entityHref } from '$lib/utils/entity-href';
