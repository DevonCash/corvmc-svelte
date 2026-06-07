<script lang="ts">
	import { toast } from 'svelte-sonner';
	import { getFormContext } from '$lib/components/shared/Form/Form.svelte';

	let {
		result,
		onconflict
	}: {
		// The remote form's reactive result; we only care about the conflict signal.
		result: { conflict?: boolean } | undefined;
		onconflict: () => void;
	} = $props();

	const ctx = getFormContext()!;

	// Act once per conflict result. The remote form hands back a fresh object for
	// each submission, so reference identity distinguishes a new conflict from the
	// same one re-read on a later render.
	let handled: object | undefined;

	$effect(() => {
		if (result?.conflict && result !== handled) {
			handled = result;
			toast.error('That time slot was just taken. Please choose another.');
			ctx.goToStep(0);
			onconflict();
		}
	});
</script>
