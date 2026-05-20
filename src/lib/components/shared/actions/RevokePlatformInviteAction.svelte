<script lang="ts">
	import Action from '../Action.svelte';
	import { invalidateAll } from '$app/navigation';
	import { actionFetch } from './api';

	let {
		bandId,
		inviteId,
		email,
		class: className = 'btn-ghost btn-xs text-warning',
		onsuccess,
		...rest
	}: {
		bandId: string;
		inviteId: string;
		email: string;
		class?: string;
		onsuccess?: () => void;
		[key: string]: unknown;
	} = $props();
</script>

<Action
	action={() => actionFetch(`/api/bands/${bandId}/invites/${inviteId}`, { method: 'DELETE' })}
	label="Revoke"
	confirm={`Revoke invite for ${email}?`}
	successToast="Invite revoked"
	class={className}
	onsuccess={onsuccess ?? (() => invalidateAll())}
	{...rest}
/>
