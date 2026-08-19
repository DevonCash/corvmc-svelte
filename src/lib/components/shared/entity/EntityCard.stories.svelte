<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import EntityCard from './EntityCard.svelte';
	import EntityGallery from './EntityGallery.svelte';
	import DefinitionList from '../DefinitionList/DefinitionList.svelte';
	import Fact from '../DefinitionList/Fact.svelte';
	import Button from '../Button.svelte';
	import { fakeRef } from '$lib/test/fixtures';

	const { Story } = defineMeta({
		title: 'Shared/Entity/EntityCard',
		component: EntityCard,
		tags: ['autodocs'],
		parameters: {
			layout: 'padded',
			docs: {
				description: {
					component:
						'One record, expanded — what a *related* record looks like on someone ' +
						'else&apos;s detail page. Built on `Card`/`CardBody` rather than `InfoCard`, ' +
						'because an InfoCard&apos;s title is a section label whereas this card&apos;s ' +
						'title is the record itself.'
				}
			}
		},
		args: { ref: fakeRef('band', { id: 'band-1', status: 'active' }) }
	});
</script>

{#snippet plain()}
	<div class="max-w-md">
		<EntityCard ref={fakeRef('band', { id: 'band-1', status: 'active' })} />
	</div>
{/snippet}
<Story name="Default" template={plain} />

{#snippet withFacts()}
	<div class="max-w-md">
		<EntityCard ref={fakeRef('member', { id: 'm1', status: 'active' })}>
			{#snippet facts()}
				<DefinitionList>
					<Fact label="Pronouns" value="she/her" />
					<Fact label="Member since" value="2021" />
					<Fact label="Bands" value="The Velvet Underground" />
				</DefinitionList>
			{/snippet}
			{#snippet actions()}
				<Button variant="ghost" size="sm">Message</Button>
				<Button size="sm">View profile</Button>
			{/snippet}
		</EntityCard>
	</div>
{/snippet}
<Story name="With facts and actions" template={withFacts} />

<!--
	`banner` ships from day one so Event does not force an API change later.
	The right-hand card has no image and falls back to the generated pattern
	rather than a grey box — a listing without a poster should still look like
	something.
-->
{#snippet banner()}
	<div class="grid max-w-3xl grid-cols-2 gap-4">
		<EntityCard ref={fakeRef('event', { id: 'e1', status: 'published' })} media="banner" />
		<EntityCard
			ref={fakeRef('event', { id: 'e2', title: 'No Poster Yet', status: 'draft' })}
			media="banner"
		/>
	</div>
{/snippet}
<Story name="Banner media — with and without an image" template={banner} />

{#snippet gallery()}
	<EntityGallery columns={1}>
		{#snippet item(type)}
			<EntityCard ref={fakeRef(type)} />
		{/snippet}
	</EntityGallery>
{/snippet}
<Story name="Gallery — every entity type" template={gallery} />

{#snippet unreachable()}
	<div class="max-w-md">
		<EntityCard ref={fakeRef('member', { id: null, subtitle: 'Account deleted' })} />
	</div>
{/snippet}
<Story name="Unreachable record" template={unreachable} />
