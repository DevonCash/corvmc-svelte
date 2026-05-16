<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		name,
		upload,
		accept,
		value = $bindable(''),
		src,
		disabled = false,
		preview
	}: {
		name: string;
		upload: (file: File) => Promise<string>;
		accept?: string;
		value?: string;
		src?: string;
		disabled?: boolean;
		preview?: Snippet<[{ file: File | null; src: string | null }]>;
	} = $props();

	let uploadStatus = $state<'idle' | 'uploading' | 'success' | 'error'>('idle');
	let uploadError = $state('');
	let selectedFile = $state<File | null>(null);
	let previewUrl = $state<string | null>(null);
	let hiddenInput = $state<HTMLInputElement | null>(null);

	let isImage = $derived(selectedFile?.type.startsWith('image/') ?? false);
	let hasPreview = $derived(!!previewUrl || !!src);

	$effect(() => {
		if (selectedFile && selectedFile.type.startsWith('image/')) {
			const url = URL.createObjectURL(selectedFile);
			previewUrl = url;
			return () => URL.revokeObjectURL(url);
		} else {
			previewUrl = null;
		}
	});

	async function handleFileChange(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		selectedFile = file;
		uploadStatus = 'uploading';
		uploadError = '';

		try {
			const key = await upload(file);
			value = key;
			if (hiddenInput) {
				hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
			}
			uploadStatus = 'success';
		} catch (err) {
			uploadError = err instanceof Error ? err.message : 'Upload failed';
			uploadStatus = 'error';
		}

		input.value = '';
	}

	function formatSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`;
		return `${(bytes / 1024).toFixed(0)} KB`;
	}
</script>

<input type="hidden" {name} bind:value bind:this={hiddenInput} />

<div class="flex items-start gap-4">
	{#if preview}
		{@render preview({ file: selectedFile, src: previewUrl ?? src ?? null })}
	{:else if previewUrl || src}
		<img
			src={previewUrl ?? src}
			alt=""
			class="h-24 w-24 rounded object-cover"
		/>
	{/if}

	<div class="flex flex-col gap-1">
		{#if uploadStatus === 'uploading'}
			<span class="btn btn-sm btn-outline btn-disabled">
				<span class="loading loading-spinner loading-sm"></span>
				Uploading…
			</span>
		{:else if hasPreview}
			<label class="btn btn-sm btn-outline" class:btn-disabled={disabled}>
				Replace
				<input
					type="file"
					{accept}
					onchange={handleFileChange}
					{disabled}
					class="hidden"
				/>
			</label>
		{:else}
			<input
				type="file"
				{accept}
				onchange={handleFileChange}
				{disabled}
				class="file-input file-input-bordered w-full"
			/>
		{/if}

		{#if uploadStatus === 'error'}
			<p class="text-sm text-error">{uploadError}</p>
		{:else if uploadStatus === 'success' && !isImage}
			<p class="text-sm text-success">Uploaded</p>
		{:else if selectedFile && !isImage}
			<p class="text-sm opacity-60">{selectedFile.name} ({formatSize(selectedFile.size)})</p>
		{/if}
	</div>
</div>
