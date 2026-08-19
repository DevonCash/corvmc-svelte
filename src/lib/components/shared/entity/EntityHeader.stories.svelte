<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EntityHeader from './EntityHeader.svelte';
	import RelatedList from './RelatedList.svelte';
	import EntityRow from './EntityRow.svelte';
	import Button from '../Button.svelte';
	import { fakeRef } from '$lib/test/fixtures';

	const { Story } = defineMeta({
		title: 'Shared/Entity/EntityHeader',
		component: EntityHeader,
		tags: ['autodocs'],
		parameters: {
			layout: 'padded',
			docs: {
				description: {
					component:
						'The identity strip on a record&apos;s own detail page, below `PageHeader`. ' +
						'Not linked — you are already here. Together with `RelatedList` this is the ' +
						'whole of the detail tier as components; the rest is the documented page ' +
						'recipe, because the real detail pages share no skeleton below this strip.'
				}
			}
		},
		args: { ref: fakeRef('member', { id: 'm1', status: 'active' }) }
	});

	const members = Promise.resolve([
		fakeRef('member', { id: 'm1' }),
		fakeRef('member', { id: 'm2', title: 'Ada Lovelace', subtitle: 'ada@example.dev' })
	]);
	const failing = Promise.reject(new Error('boom'));
	// An unhandled rejection fails the storybook vitest project even though the
	// {:catch} handles it in the template.
	failing.catch(() => {});
</script>

{#snippet member()}
	<EntityHeader
		ref={fakeRef('member', { id: 'm1', status: 'active' })}
		email="jane@example.dev"
		phone="(541) 555-0134"
	>
		{#snippet qualifiers()}
			<span class="text-muted">#0142</span>
		{/snippet}
		{#snippet actions()}
			<Button variant="ghost" size="sm">Message</Button>
		{/snippet}
	</EntityHeader>
{/snippet}
<Story name="Member" template={member} />

{#snippet band()}
	<EntityHeader ref={fakeRef('band', { id: 'band-1', status: 'active' })} email="book@vu.example" />
{/snippet}
<Story name="Band — square avatar" template={band} />

<!-- A record with no avatar of its own: the strip degrades to name + facts. -->
{#snippet reservation()}
	<EntityHeader ref={fakeRef('reservation', { id: 'r1', status: 'confirmed' })} />
{/snippet}
<Story name="No avatar" template={reservation} />

<!--
	The full detail recipe in miniature: header, then RelatedList sections whose
	bodies are independent queries. The third deliberately rejects — a failed
	section must say so rather than render an empty card that reads as "none".
-->
{#snippet recipe()}
	<div class="flex flex-col gap-6">
		<EntityHeader
			ref={fakeRef('member', { id: 'm1', status: 'active' })}
			email="jane@example.dev"
		/>
		<div class="grid gap-4 lg:grid-cols-2">
			<RelatedList title="Bands" result={members}>
				{#snippet children(rows)}
					<div class="flex flex-col gap-2">
						{#each rows as ref (ref.id)}
							<EntityRow {ref} size="md" />
						{/each}
					</div>
				{/snippet}
			</RelatedList>
			<RelatedList title="Payment records" result={failing}>
				<p>unreachable — this section always rejects, to exercise the catch branch</p>
			</RelatedList>
		</div>
	</div>
{/snippet}
<Story name="Detail recipe — header + related lists" template={recipe} />
