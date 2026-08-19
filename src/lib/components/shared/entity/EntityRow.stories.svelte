<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EntityRow from './EntityRow.svelte';
	import EntityGallery from './EntityGallery.svelte';
	import Table from '../Table.svelte';
	import StatusBadge from '../StatusBadge.svelte';
	import { fakeRef } from '$lib/test/fixtures';

	const { Story } = defineMeta({
		title: 'Shared/Entity/EntityRow',
		component: EntityRow,
		tags: ['autodocs'],
		parameters: {
			layout: 'padded',
			docs: {
				description: {
					component:
						'One record as a list item. `size="sm"` is the staff table **primary cell** — ' +
						'the shape hand-written 53 times across the panel; `size="md"` is the ' +
						'standalone list row with an avatar. It owns one cell&apos;s content and never ' +
						'the column set, the fetch, or the `<tr>`.'
				}
			}
		},
		args: { ref: fakeRef('member', { id: 'm1' }) }
	});

	const members = [
		fakeRef('member', { id: 'm1' }),
		fakeRef('member', {
			id: 'm2',
			title: 'Justin Sheetz',
			subtitle: 'justin@example.dev',
			role: 'staff'
		}),
		fakeRef('member', {
			id: 'm3',
			title: 'Ada Lovelace',
			subtitle: 'ada@example.dev',
			sustaining: true
		})
	];
</script>

<!--
	`component:` is set for the autodocs props table, which means svelte-csf
	renders `<EntityRow {...args} />` *instead of* a story's children — the trap
	documented in DataList.stories.svelte. Bespoke stories pass a `template`.
-->

<!-- The staff table primary cell, in a real `cell-primary` — the only place the
     truncation contract is observable. -->
{#snippet inTable()}
	<Table>
		{#snippet head()}
			<th class="w-px"><span class="sr-only">Status</span></th>
			<th>Member</th>
			<th class="col-support whitespace-nowrap">Joined</th>
		{/snippet}
		{#each members as ref, i (ref.id)}
			<tr class="hover">
				<td class="w-px"><StatusBadge status="active" /></td>
				<td class="cell-primary"><EntityRow {ref} /></td>
				<td class="col-support whitespace-nowrap">Mar {10 + i}, 2025</td>
			</tr>
		{/each}
	</Table>
{/snippet}
<Story name="In a table cell" template={inTable} />

<!--
	BEFORE / AFTER. Left is the markup as it exists in the tree today —
	`staff/bands/+page.svelte`, `staff/events/+page.svelte` and eight more files,
	verbatim. Right is the component. They should be indistinguishable; this
	story is the evidence for that, rather than an assertion of it.
-->
{#snippet beforeAfter()}
	<div class="grid grid-cols-2 gap-8">
		<div>
			<p class="mb-2 text-subtle">Before — hand-written, ×10 files</p>
			<Table>
				{#snippet head()}<th>Member</th>{/snippet}
				<tr class="hover">
					<td class="cell-primary">
						<a href="#x" class="block truncate font-medium hover:underline">Jane Doe</a>
						<div class="truncate text-muted">jane@example.dev</div>
					</td>
				</tr>
			</Table>
		</div>
		<div>
			<p class="mb-2 text-subtle">After — &lt;EntityRow&gt;</p>
			<Table>
				{#snippet head()}<th>Member</th>{/snippet}
				<tr class="hover">
					<td class="cell-primary"><EntityRow ref={fakeRef('member', { id: 'm1' })} /></td>
				</tr>
			</Table>
		</div>
	</div>
{/snippet}
<Story name="Before / after — the primary cell" template={beforeAfter} />

<!-- Long content: the reason the anchor must stay a direct child of the cell. -->
{#snippet truncation()}
	<Table>
		{#snippet head()}
			<th>Event</th>
			<th class="col-support">Date</th>
		{/snippet}
		<tr class="hover">
			<td class="cell-primary">
				<EntityRow
					ref={fakeRef('event', {
						id: 'e1',
						title:
							'An Extremely Long Show Title That Should Be Clipped Rather Than Wrapping Onto A Second Line',
						subtitle: 'With a subtitle that is also far too long to fit in this column'
					})}
				/>
			</td>
			<td class="col-support whitespace-nowrap">Mar 14, 2025</td>
		</tr>
	</Table>
{/snippet}
<Story name="Truncation under pressure" template={truncation} />

<!-- The standalone list row: 40px avatar, its own flex wrapper. -->
{#snippet listRows()}
	<div class="flex max-w-md flex-col gap-2">
		<EntityRow ref={fakeRef('band', { id: 'band-1' })} size="md" />
		<EntityRow ref={fakeRef('member', { id: 'm1' })} size="md" />
		<EntityRow ref={fakeRef('event', { id: 'e1' })} size="md" />
	</div>
{/snippet}
<Story name="Size md — standalone list row" template={listRows} />

{#snippet gallery()}
	<EntityGallery columns={1}>
		{#snippet item(type)}
			<EntityRow ref={fakeRef(type)} size="md" />
		{/snippet}
	</EntityGallery>
{/snippet}
<Story name="Gallery — every entity type" template={gallery} />

<!-- Unreachable and deleted both render unlinked, and both keep their row. -->
{#snippet unlinked()}
	<div class="flex max-w-md flex-col gap-2">
		<EntityRow ref={fakeRef('member', { id: null, subtitle: 'Account deleted' })} size="md" />
		<EntityRow ref={fakeRef('flag')} size="md" />
	</div>
{/snippet}
<Story name="Unlinked states" template={unlinked} />
