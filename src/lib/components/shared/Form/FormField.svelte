<script lang="ts">
	import { type Snippet } from 'svelte';
	import TagInput from './TagInput.svelte';
	import { getFormContext } from './Form.svelte';
	import { IconPencilOff } from '@tabler/icons-svelte';

	type InputType = 'text' | 'email' | 'tel' | 'number' | 'password' | 'textarea' | 'select' | 'tags' | 'checkbox' | 'toggle';

	let {
		label,
		name,
		type,
		class: className = '',
		input,
		description,
		readonly,
		...rest
	}: {
		name: string;
		label?: string;
		input?: Snippet<[id: string]>;
		description?: string;
		type?: InputType;
		class?: string;
		value: any;
		readonly?: boolean;
		[key: string]: any;
	} = $props();

	const form = getFormContext();

	let id = `form-field-${name}-${Math.random().toString(16).slice(2, 8)}`;
	let _label = $derived.by(() => label ?? name.slice(0, 1).toUpperCase() + name.slice(1));
	let issues = $derived.by(() => form.issuesFor(name));
	let pending = $derived(form.status === 'pending');

	let inputProps = $derived({
		id,
		name,
		type,
		disabled: pending || readonly,
		onchange: () => form.changed(),
		oninput: () => form.changed()
	});
</script>

<fieldset class="fieldset {className}">
	<legend class="fieldset-legend">
		{_label}
	</legend>
	{#if issues}
		{#each issues as issue}
			<p class="text-sm text-error">{issue.message}</p>
		{/each}
	{:else if description}
		<p class="text-muted text-sm">{description}</p>
	{/if}
	{#if input}
		{@render input(id)}
	{:else if readonly}
		<p class="input-bordered input w-full">
			<span class="grow">{rest.value}</span>
			<IconPencilOff class="size-5 opacity-20" />
		</p>
	{:else if type === 'textarea'}
		<textarea class="textarea-bordered textarea w-full" class:ghost={readonly} {...inputProps}
		></textarea>
	{:else if type === 'tags'}
		<TagInput {...rest} options={rest.options} {...inputProps} disabled={pending} />
	{:else if type === 'checkbox'}
		<label class="label cursor-pointer gap-2">
			<input type="checkbox" class="checkbox" checked={rest.value} disabled={pending || readonly} {id} {name} onchange={() => form.changed()} />
			{#if rest.checkboxLabel}<span>{rest.checkboxLabel}</span>{/if}
		</label>
	{:else if type === 'toggle'}
		<label class="label cursor-pointer gap-2">
			<input type="checkbox" class="toggle" checked={rest.value} disabled={pending || readonly} {id} {name} onchange={() => form.changed()} />
			{#if rest.checkboxLabel}<span>{rest.checkboxLabel}</span>{/if}
		</label>
	{:else if type === 'select' && rest.multiple}
		{@const selectedValues = Array.isArray(rest.value) ? rest.value : []}
		<input type="hidden" {name} value={JSON.stringify(selectedValues)} />
		<select
			class="select-bordered select w-full"
			class:ghost={readonly}
			multiple
			disabled={pending}
			{id}
			onchange={(e) => {
				const sel = e.currentTarget;
				const vals = Array.from(sel.selectedOptions, (o) => o.value);
				const hidden = sel.previousElementSibling as HTMLInputElement;
				hidden.value = JSON.stringify(vals);
				form.changed();
			}}
		>
			{#each rest.options as option}
				<option value={option.value} selected={selectedValues.includes(option.value)}>
					{option.label}
				</option>
			{/each}
		</select>
	{:else if type === 'select'}
		<select class="select-bordered select w-full" class:ghost={readonly} {...rest} {...inputProps}>
			{#each rest.options as option}
				<option value={option.value} selected={option.value === rest.value}>
					{option.label}
				</option>
			{/each}
		</select>
	{:else}
		<input class="input-bordered input w-full" class:ghost={readonly} {...rest} {...inputProps} />
	{/if}
</fieldset>
