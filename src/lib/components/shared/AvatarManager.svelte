<script lang="ts">
	import type { RemoteForm } from '@sveltejs/kit';
	import { toast } from 'svelte-sonner';
	import Avatar from '$lib/components/shared/Avatar.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';

	let {
		uploadForm,
		removeForm,
		currentUrl,
		name,
		accept = 'image/jpeg,image/png,image/webp'
	}: {
		uploadForm: RemoteForm<any, any>;
		removeForm: RemoteForm<any, any>;
		currentUrl: string | null;
		name: string;
		accept?: string;
	} = $props();
</script>

<div class="flex items-center gap-4">
	<Avatar src={currentUrl ?? undefined} {name} class="w-16" />
	<div class="flex flex-col items-start gap-1">
		<Form
			remote={uploadForm}
			enctype="multipart/form-data"
			onsuccess={() => toast.success('Photo updated')}
			onfailure={() => toast.error('Upload failed')}
		>
			<label class="btn btn-sm btn-outline">
				{currentUrl ? 'Replace Photo' : 'Upload Photo'}
				<input
					{...uploadForm.fields.file.as('file')}
					{accept}
					class="hidden"
					onchange={(e) => e.currentTarget.form?.requestSubmit()}
				/>
			</label>
		</Form>
		{#if currentUrl}
			<Form
				remote={removeForm}
				onsuccess={() => toast.success('Photo removed')}
				onfailure={() => toast.error('Failed to remove')}
			>
				<SubmitButton label="Remove" class="btn-ghost btn-xs text-error" />
			</Form>
		{/if}
	</div>
</div>
