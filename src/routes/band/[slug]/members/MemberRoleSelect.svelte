<script lang="ts">
	import Form, { Field } from '$lib/components/shared/Form';
	import { updateMemberRemote } from '$lib/remote/bands.remote';
	import { toast } from 'svelte-sonner';

	let {
		memberId,
		role,
		onchanged
	}: {
		memberId: string;
		role: 'admin' | 'member';
		onchanged: () => void;
	} = $props();

	const update = $derived(updateMemberRemote.for(memberId));
	const { fields } = updateMemberRemote;

	const roleOptions = [
		{ value: 'member', label: 'Member' },
		{ value: 'admin', label: 'Admin' }
	];

	function submitOnChange(e: Event & { currentTarget: HTMLElement }) {
		e.currentTarget.querySelector('select')?.form?.requestSubmit();
	}
</script>

<Form
	remote={update}
	onsuccess={() => {
		toast.success('Role updated');
		onchanged();
	}}
	onfailure={() => toast.error('Failed to update role')}
>
	<input {...fields.memberId.as('hidden', memberId)} />
	<div class="w-32" onchange={submitOnChange}>
		<Field type="select" name="role" label="" value={role} options={roleOptions} class="m-0" />
	</div>
</Form>
