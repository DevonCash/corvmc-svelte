<script lang="ts">
	import type { RemoteForm } from '@sveltejs/kit';
	import { IconCamera } from '@tabler/icons-svelte';
	import { toast } from 'svelte-sonner';
	import EntityAvatar from '$lib/components/shared/directory/EntityAvatar.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';

	let {
		uploadForm,
		removeForm,
		currentUrl,
		name,
		key,
		shape = 'round',
		accept = 'image/jpeg,image/png,image/webp'
	}: {
		uploadForm: RemoteForm<any, any>;
		removeForm: RemoteForm<any, any>;
		currentUrl: string | null;
		name: string;
		/**
		 * Unique id for this manager. The upload/remove forms are singleton
		 * `form()` instances; `.for(key)` gives each render its own instance so
		 * two managers on one page can't both attach the same form to a `<form>`
		 * element (SvelteKit throws "a form object can only be attached to a
		 * single `<form>` element" otherwise).
		 */
		key: string | number;
		/** member = round, band = square — the directory-wide convention */
		shape?: 'round' | 'square';
		accept?: string;
	} = $props();

	const upload = $derived(uploadForm.for(key));
	const remove = $derived(removeForm.for(key));
	const shapeClass = $derived(shape === 'round' ? 'rounded-full' : 'rounded-lg');
</script>

<div class="flex items-start gap-4">
	<Form
		remote={upload}
		enctype="multipart/form-data"
		onsuccess={() => toast.success('Photo updated')}
		onfailure={() => toast.error('Upload failed')}
	>
		<label
			class="group relative block size-24 cursor-pointer {shapeClass}"
			aria-label={currentUrl ? 'Replace photo' : 'Add photo'}
		>
			<EntityAvatar {shape} {name} image={currentUrl} class="size-24" />
			<span
				class="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100 {shapeClass}"
			>
				<IconCamera size={22} />
				<span class="text-xs font-semibold">{currentUrl ? 'Replace' : 'Add'}</span>
			</span>
			<input
				{...upload.fields.file.as('file')}
				{accept}
				class="hidden"
				onchange={(e) => e.currentTarget.form?.requestSubmit()}
			/>
		</label>
	</Form>

	{#if currentUrl}
		<Form
			remote={remove}
			onsuccess={() => toast.success('Photo removed')}
			onfailure={() => toast.error('Failed to remove')}
		>
			<SubmitButton label="Remove" class="btn-ghost btn-xs text-error" />
		</Form>
	{/if}
</div>
