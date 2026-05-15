<script lang="ts">
	import { type Snippet } from 'svelte';
	import TagInput from './TagInput.svelte';
	import { getFormContext } from './Form.svelte';
	import type { RemoteFormIssue } from '@sveltejs/kit';
	import { IconPencilOff } from '@tabler/icons-svelte';

	type InputType = 'text' | 'email' | 'tel' | 'number' | 'password' | 'date' | 'textarea' | 'select' | 'tags' | 'checkbox' | 'toggle';

	let {
		label,
		name,
		id: propId,
		type,
		class: className = '',
		input,
		description,
		readonly,
		issues: propIssues,
		children,
		...rest
	}: {
		name?: string;
		id?: string;
		label?: string;
		input?: Snippet<[id: string]>;
		children?: Snippet;
		description?: string;
		type?: InputType;
		class?: string;
		value?: any;
		readonly?: boolean;
		issues?: RemoteFormIssue[] | null;
		[key: string]: any;
	} = $props();

	const form = getFormContext();

	// Support old API: use `id` prop if `name` is not provided
	const uid = Math.random().toString(16).slice(2, 8);
	let _name = $derived(name ?? propId ?? '');
	let _id = $derived(propId ?? `form-field-${_name}-${uid}`);
	let _label = $derived.by(() => label ?? (_name ? _name.slice(0, 1).toUpperCase() + _name.slice(1) : ''));
	// When inside a Form context, derive issues from form; otherwise use prop
	let issues = $derived.by(() => form ? form.issuesFor(_name) : (propIssues ?? null));
	let pending = $derived(form ? form.status === 'pending' : false);

	let inputProps = $derived({
		id: _id,
		name: _name,
		type,
		disabled: pending || readonly
	});
</script>

<fieldset class="fieldset {className}" oninput={() => form?.changed()} onchange={() => form?.changed()}>
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
	{#if children}
		{@render children()}
	{:else if input}
		{@render input(_id)}
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
			<input type="checkbox" class="checkbox" checked={rest.value} disabled={pending || readonly} id={_id} name={_name} />
			{#if rest.checkboxLabel}<span>{rest.checkboxLabel}</span>{/if}
		</label>
	{:else if type === 'toggle'}
		<label class="label cursor-pointer gap-2">
			<input type="checkbox" class="toggle" checked={rest.value} disabled={pending || readonly} id={_id} name={_name} />
			{#if rest.checkboxLabel}<span>{rest.checkboxLabel}</span>{/if}
		</label>
	{:else if type === 'select' && rest.multiple}
		{@const selectedValues = Array.isArray(rest.value) ? rest.value : []}
		<input type="hidden" name={_name} value={JSON.stringify(selectedValues)} />
		<select
			class="select-bordered select w-full"
			class:ghost={readonly}
			multiple
			disabled={pending}
			id={_id}
			onchange={(e) => {
				const sel = e.currentTarget;
				const vals = Array.from(sel.selectedOptions, (o) => o.value);
				const hidden = sel.previousElementSibling as HTMLInputElement;
				hidden.value = JSON.stringify(vals);
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
