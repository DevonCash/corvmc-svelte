<script lang="ts">
	import Column from './Column.svelte';
	import MemberLink from '../MemberLink.svelte';

	let {
		nameKey = 'userName',
		emailKey,
		userIdKey,
		header = 'Member',
		sortable = false,
		avatar = false
	}: {
		nameKey?: string;
		emailKey?: string;
		userIdKey?: string;
		header?: string;
		sortable?: boolean;
		avatar?: boolean;
	} = $props();
</script>

<Column key={nameKey} {header} {sortable} stopClick class="px-0">
	{#snippet cell(_, row: any)}
		<MemberLink
			name={row[nameKey]}
			email={emailKey ? row[emailKey] : undefined}
			userId={userIdKey ? row[userIdKey] : undefined}
			{avatar}
			class="p-7 px-4"
		/>
	{/snippet}
</Column>
