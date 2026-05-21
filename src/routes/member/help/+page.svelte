<script lang="ts">
	import { goto } from '$app/navigation';
	import { getMemberCategories } from '$lib/remote/help';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import EmptyState from '$lib/components/shared/EmptyState.svelte';
	import HelpSearch from '$lib/components/help/HelpSearch.svelte';
	import {
		IconBook,
		IconSettings,
		IconCalendar,
		IconUsers,
		IconMusic,
		IconHelp,
		IconTicket,
		IconTool
	} from '@tabler/icons-svelte';

	let categories = $derived(await getMemberCategories());

	const iconMap: Record<string, typeof IconBook> = {
		book: IconBook,
		settings: IconSettings,
		calendar: IconCalendar,
		users: IconUsers,
		music: IconMusic,
		help: IconHelp,
		ticket: IconTicket,
		tool: IconTool
	};

	function handleSelect(slug: string) {
		goto(`/member/help/${slug}`);
	}
</script>

<PageHeader title="Help Center" subtitle="Support" />
<PageContent width="2xl">
	<HelpSearch onselect={handleSelect} />

	{#if categories.length === 0}
		<EmptyState message="No help articles available yet." />
	{:else}
		<div class="grid gap-4 sm:grid-cols-2">
			{#each categories as category}
				{@const Icon = iconMap[category.icon ?? ''] ?? IconBook}
				<div class="card border border-base-300 bg-base-100">
					<div class="card-body p-4">
						<div class="flex items-start gap-3">
							<div class="rounded-lg bg-primary/10 p-2">
								<Icon size={20} class="text-primary" />
							</div>
							<div class="flex-1 min-w-0">
								<h3 class="font-semibold text-sm">{category.name}</h3>
								{#if category.description}
									<p class="text-xs opacity-60 mt-0.5">{category.description}</p>
								{/if}
							</div>
						</div>
						{#if category.articles.length > 0}
							<ul class="mt-3 space-y-1">
								{#each category.articles as article}
									<li>
										<a
											href="/member/help/{article.slug}"
											class="text-sm hover:text-primary transition-colors"
										>
											{article.title}
										</a>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="text-xs opacity-50 mt-3 italic">No articles yet</p>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</PageContent>
