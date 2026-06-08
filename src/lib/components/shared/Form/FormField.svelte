<script lang="ts">
	import { type Snippet } from 'svelte';
	import type { RemoteFormField, RemoteFormIssue } from '@sveltejs/kit';
	import TagInput from './TagInput.svelte';
	import CalendarSelect from './CalendarSelect.svelte';
	import FileUpload from './FileUpload.svelte';
	import { getFormContext } from './Form.svelte';
	import { IconPencilOff } from '@tabler/icons-svelte';

	type InputType =
		| 'text'
		| 'email'
		| 'tel'
		| 'number'
		| 'password'
		| 'date'
		| 'time'
		| 'datetime-local'
		| 'textarea'
		| 'select'
		| 'tags'
		| 'checkbox'
		| 'toggle'
		| 'file'
		| 'calendar';

	let {
		label,
		name,
		id: propId,
		type,
		field,
		class: className = '',
		input,
		description,
		readonly,
		issues: propIssues,
		children,
		upload,
		accept,
		src,
		value = $bindable(),
		...rest
	}: {
		name?: string;
		id?: string;
		label?: string;
		field?: RemoteFormField<any>;
		input?: Snippet<[id: string]>;
		children?: Snippet;
		description?: string;
		type?: InputType;
		class?: string;
		value?: any;
		readonly?: boolean;
		issues?: RemoteFormIssue[] | null;
		upload?: (file: File) => Promise<string>;
		accept?: string;
		src?: string;
		[key: string]: any;
	} = $props();

	const form = getFormContext();

	const uid = Math.random().toString(16).slice(2, 8);
	let _name = $derived(name ?? propId ?? '');
	let _id = $derived(propId ?? `form-field-${_name}-${uid}`);
	let _label = $derived.by(
		() => label ?? (_name ? _name.slice(0, 1).toUpperCase() + _name.slice(1) : '')
	);

	// These types render `value` themselves (bind:value / bind:checked / select) and
	// only use fieldAttrs for the resolved name, so we don't forward value into `.as()`.
	let ownsValue = $derived(
		type === 'textarea' ||
			type === 'tags' ||
			type === 'calendar' ||
			type === 'toggle' ||
			type === 'checkbox' ||
			type === 'select' ||
			type === 'file'
	);

	// Resolve field attributes from SvelteKit field definition when provided
	let fieldAttrs = $derived.by(() => {
		if (!field) return null;
		const asType =
			type === 'textarea' ||
			type === 'tags' ||
			type === 'calendar' ||
			type === 'toggle' ||
			type === 'file'
				? 'text'
				: (type ?? 'text');
		// Forward the supplied value so plain inputs render pre-filled from existing
		// data (edit forms). `.as(type, value)` controls the rendered value.
		return ownsValue || value === undefined
			? field.as(asType as any)
			: field.as(asType as any, value);
	});

	// When field is provided, derive name/id from it
	let resolvedName = $derived(fieldAttrs?.name ?? _name);
	let resolvedId = $derived(
		propId ?? (fieldAttrs?.name ? `form-field-${fieldAttrs.name}-${uid}` : _id)
	);

	// Issues: field.issues() > propIssues > form context
	let issues = $derived.by(() => {
		if (field) return field.issues() ?? null;
		if (form) return form.issuesFor(_name);
		return propIssues ?? null;
	});

	let pending = $derived(form ? form.status === 'pending' : false);

	let inputProps = $derived({
		id: resolvedId,
		name: resolvedName,
		type,
		disabled: pending || readonly,
		...(fieldAttrs ? { 'aria-invalid': fieldAttrs['aria-invalid'] } : {})
	});
</script>

<fieldset
	class="fieldset {className}"
	oninput={() => form?.changed()}
	onchange={() => form?.changed()}
>
	<legend class="fieldset-legend">
		{_label}
	</legend>
	{#if issues}
		{#each issues as issue (issue.message)}
			<p class="text-sm text-error">{issue.message}</p>
		{/each}
	{:else if description}
		<p class="text-muted text-sm">{description}</p>
	{/if}
	{#if children}
		{@render children()}
	{:else if input}
		{@render input(resolvedId)}
	{:else if readonly}
		<p class="input-bordered input w-full">
			<span class="grow">{value}</span>
			<IconPencilOff class="size-5 opacity-20" />
		</p>
	{:else if type === 'textarea'}
		<textarea
			class="textarea-bordered textarea w-full"
			class:ghost={readonly}
			{...inputProps}
			bind:value
		></textarea>
	{:else if type === 'tags'}
		<TagInput {...rest} options={rest.options} {...inputProps} disabled={pending} />
	{:else if type === 'calendar'}
		<CalendarSelect {...rest} name={resolvedName} bind:value disabled={pending || readonly} />
	{:else if type === 'checkbox'}
		<label class="label cursor-pointer gap-2 items-center">
			<input
				type="checkbox"
				class="checkbox shrink-0"
				bind:checked={value}
				disabled={pending || readonly}
				id={resolvedId}
				name={resolvedName}
			/>
			{#if rest.checkboxLabel}<span class="text-wrap">{rest.checkboxLabel}</span>{/if}
		</label>
	{:else if type === 'toggle'}
		<label class="label cursor-pointer gap-2">
			<input
				type="checkbox"
				class="toggle"
				bind:checked={value}
				disabled={pending || readonly}
				id={resolvedId}
				name={resolvedName}
			/>
			{#if rest.checkboxLabel}<span>{rest.checkboxLabel}</span>{/if}
		</label>
	{:else if type === 'file' && upload}
		<FileUpload
			name={resolvedName}
			{upload}
			{accept}
			{value}
			{src}
			orientation={rest.orientation}
			disabled={pending || readonly}
		/>
	{:else if type === 'select' && rest.multiple}
		<input
			type="hidden"
			name={resolvedName}
			value={JSON.stringify(Array.isArray(value) ? value : [])}
		/>
		<select
			class="select-bordered select w-full"
			class:ghost={readonly}
			multiple
			disabled={pending || readonly}
			id={resolvedId}
			onchange={(e) => {
				const sel = e.currentTarget;
				value = Array.from(sel.selectedOptions, (o) => o.value);
				const hidden = sel.previousElementSibling as HTMLInputElement;
				hidden.value = JSON.stringify(value);
			}}
		>
			{#each rest.options as option (option.value)}
				<option
					value={option.value}
					selected={Array.isArray(value) && value.includes(option.value)}
				>
					{option.label}
				</option>
			{/each}
		</select>
	{:else if type === 'select'}
		<select class="select-bordered select w-full" class:ghost={readonly} {...inputProps} bind:value>
			{#if rest.placeholder}
				<option value="">{rest.placeholder}</option>
			{/if}
			{#each rest.options as option (option.value)}
				<option value={option.value}>{option.label}</option>
			{/each}
		</select>
	{:else if field && fieldAttrs}
		<input
			class="input-bordered input w-full"
			class:ghost={readonly}
			{...rest}
			{...fieldAttrs}
			id={resolvedId}
			disabled={pending || readonly}
		/>
	{:else}
		<input
			class="input-bordered input w-full"
			class:ghost={readonly}
			{...rest}
			{...inputProps}
			bind:value
		/>
	{/if}
</fieldset>
