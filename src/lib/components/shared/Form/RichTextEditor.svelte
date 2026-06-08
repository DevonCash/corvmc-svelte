<script lang="ts">
	import { untrack } from 'svelte';
	import { browser } from '$app/environment';
	import { Editor } from '@tiptap/core';
	import StarterKit from '@tiptap/starter-kit';
	import {
		IconBold,
		IconItalic,
		IconUnderline,
		IconList,
		IconListNumbers,
		IconBlockquote,
		IconLink,
		IconH3
	} from '@tabler/icons-svelte';

	let {
		value = $bindable(''),
		placeholder = ''
	}: {
		value?: string;
		placeholder?: string;
	} = $props();

	let element = $state<HTMLDivElement>();
	let editor = $state<Editor>();
	// Bump on every editor transaction so toolbar active-states stay reactive.
	let tick = $state(0);

	$effect(() => {
		if (!browser || !element) return;
		const ed = new Editor({
			element,
			extensions: [StarterKit.configure({ heading: { levels: [3] } })],
			content: untrack(() => value) || '',
			editorProps: {
				attributes: {
					class: 'prose prose-sm max-w-none min-h-32 px-3 py-2 focus:outline-none'
				}
			},
			onUpdate: ({ editor }) => {
				value = editor.getHTML();
				// Notify the surrounding FormField/Form so dirty tracking fires.
				element?.dispatchEvent(new Event('input', { bubbles: true }));
			},
			onTransaction: () => {
				tick++;
			}
		});
		editor = ed;
		return () => {
			ed.destroy();
			editor = undefined;
		};
	});

	// Reflect external value changes (e.g. async profile load, form reset).
	$effect(() => {
		const v = value;
		if (editor && v !== untrack(() => editor!.getHTML())) {
			editor.commands.setContent(v || '', { emitUpdate: false });
		}
	});

	function isActive(name: string, attrs?: Record<string, unknown>): boolean {
		void tick;
		return editor?.isActive(name, attrs) ?? false;
	}

	function toggleLink() {
		if (!editor) return;
		if (editor.isActive('link')) {
			editor.chain().focus().unsetLink().run();
			return;
		}
		const url = window.prompt('Link URL');
		if (url) editor.chain().focus().setLink({ href: url }).run();
	}
</script>

<div class="rounded-box border border-base-300">
	{#if editor}
		<div class="join flex flex-wrap border-b border-base-300 rounded-b-none">
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item rounded-b-none"
				class:btn-active={isActive('bold')}
				aria-label="Bold"
				onclick={() => editor!.chain().focus().toggleBold().run()}
			>
				<IconBold size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item"
				class:btn-active={isActive('italic')}
				aria-label="Italic"
				onclick={() => editor!.chain().focus().toggleItalic().run()}
			>
				<IconItalic size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item"
				class:btn-active={isActive('underline')}
				aria-label="Underline"
				onclick={() => editor!.chain().focus().toggleUnderline().run()}
			>
				<IconUnderline size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item"
				class:btn-active={isActive('heading', { level: 3 })}
				aria-label="Heading"
				onclick={() => editor!.chain().focus().toggleHeading({ level: 3 }).run()}
			>
				<IconH3 size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item"
				class:btn-active={isActive('bulletList')}
				aria-label="Bullet list"
				onclick={() => editor!.chain().focus().toggleBulletList().run()}
			>
				<IconList size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item"
				class:btn-active={isActive('orderedList')}
				aria-label="Numbered list"
				onclick={() => editor!.chain().focus().toggleOrderedList().run()}
			>
				<IconListNumbers size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item"
				class:btn-active={isActive('blockquote')}
				aria-label="Quote"
				onclick={() => editor!.chain().focus().toggleBlockquote().run()}
			>
				<IconBlockquote size={16} />
			</button>
			<button
				type="button"
				class="btn btn-ghost btn-xs btn-square join-item rounded-b-none"
				class:btn-active={isActive('link')}
				aria-label="Link"
				onclick={toggleLink}
			>
				<IconLink size={16} />
			</button>
			<div class='filler join-item rounded-b-none grow btn btn-xs pointer-events-none btn-ghost'></div>
		</div>
	{/if}
	<div bind:this={element} data-placeholder={placeholder}></div>
</div>
