<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import { formatDateTime } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import {
		getInboxThread,
		replyToThread,
		addThreadNote,
		updateThreadStatus,
		assignThread,
		getInboxEnabledChannels,
		getAssignableStaff
	} from '$lib/remote/inbox.remote';
	import {
		IconMail,
		IconMessageCircle,
		IconWorld,
		IconBrandInstagram,
		IconBrandFacebook,
		IconNote
	} from '@tabler/icons-svelte';
	import { inboxThreadStatuses } from '$lib/config';

	const channelLabels: Record<string, string> = {
		email: 'Email',
		sms: 'SMS',
		web: 'Contact Form',
		instagram: 'Instagram',
		messenger: 'Messenger'
	};

	const channelIcons: Record<string, typeof IconMail> = {
		email: IconMail,
		sms: IconMessageCircle,
		web: IconWorld,
		instagram: IconBrandInstagram,
		messenger: IconBrandFacebook
	};

	let showNoteForm = $state(false);

	const threadId = $derived(page.params.id!);
	let thread = $derived(getInboxThread(threadId));
	let enabledChannels = $derived(getInboxEnabledChannels());
	let staffUsers = $derived(getAssignableStaff());

	const replyForm = replyToThread.for('reply');
	const noteForm = addThreadNote.for('note');
	const statusForm = updateThreadStatus.for('status');
	const assignForm = assignThread.for('assign');
</script>

{#await thread}
	<div class="flex justify-center py-12">
		<span class="loading loading-spinner loading-lg"></span>
	</div>
{:then t}
	{@const ChannelIcon = channelIcons[t.channel] ?? IconWorld}
	<PageHeader
		title={t.contactName ?? t.contactEmail ?? 'Conversation'}
		subtitle={t.subject ?? channelLabels[t.channel]}
		backHref="/staff/inbox"
	/>
	<PageContent>
		<div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
			<!-- Messages -->
			<div class="lg:col-span-3 space-y-4">
				{#each t.messages as msg (msg.id)}
					<div class="chat {msg.direction === 'inbound' ? 'chat-start' : 'chat-end'}">
						<div class="chat-header mb-1">
							{msg.authorName ??
								(msg.direction === 'inbound' ? (t.contactName ?? 'Contact') : 'Staff')}
							<time class="text-xs opacity-50 ml-2">{formatDateTime(msg.createdAt)}</time>
						</div>
						<div class="chat-bubble {msg.direction === 'outbound' ? 'chat-bubble-primary' : ''}">
							{msg.body}
						</div>
					</div>
				{/each}

				{#each t.notes as note (note.id)}
					<div class="alert bg-base-200 border-dashed border-base-300">
						<IconNote size={16} class="opacity-60" />
						<div>
							<div class="text-xs opacity-60">
								{note.authorName ?? 'Staff'} · {formatDateTime(note.createdAt)}
							</div>
							<div class="text-sm">{note.body}</div>
						</div>
					</div>
				{/each}

				<!-- Reply form -->
				<div class="divider text-xs opacity-60">Reply</div>
				{#await enabledChannels then channels}
					{#if t.channel === 'web' || channels.includes(t.channel)}
						<form
							{...replyForm.enhance(async ({ submit }) => {
								if (await submit()) {
									toast.success('Reply sent');
									void getInboxThread(threadId).refresh();
								} else {
									toast.error('Failed to send reply');
								}
							})}
							class="flex flex-col gap-2"
						>
							<input {...replyForm.fields.threadId.as('hidden', t.id)} />
							<textarea
								name="body"
								class="textarea textarea-bordered w-full"
								placeholder="Type your reply..."
								rows="3"
								required
							></textarea>
							<div class="flex justify-end">
								<button type="submit" class="btn btn-primary btn-sm">Send Reply</button>
							</div>
						</form>
					{:else}
						<div class="alert alert-warning text-sm">
							The {channelLabels[t.channel]} channel is disabled. Enable it in
							<a href={resolve('/staff/settings')} class="link">Settings → Inbox Channels</a> to send
							replies.
						</div>
					{/if}
				{/await}

				<!-- Note form -->
				{#if showNoteForm}
					<div class="divider text-xs opacity-60">Internal Note</div>
					<form
						{...noteForm.enhance(async ({ submit }) => {
							if (await submit()) {
								toast.success('Note added');
								showNoteForm = false;
								void getInboxThread(threadId).refresh();
							} else {
								toast.error('Failed to add note');
							}
						})}
						class="flex flex-col gap-2"
					>
						<input {...noteForm.fields.threadId.as('hidden', t.id)} />
						<textarea
							name="body"
							class="textarea textarea-bordered w-full"
							placeholder="Add an internal note..."
							rows="2"
							required
						></textarea>
						<div class="flex justify-end gap-2">
							<button
								type="button"
								class="btn btn-ghost btn-sm"
								onclick={() => (showNoteForm = false)}>Cancel</button
							>
							<button type="submit" class="btn btn-sm">Add Note</button>
						</div>
					</form>
				{:else}
					<button class="btn btn-ghost btn-sm" onclick={() => (showNoteForm = true)}>
						<IconNote size={16} /> Add Note
					</button>
				{/if}
			</div>

			<!-- Sidebar -->
			<div class="space-y-4">
				<div class="card bg-base-200">
					<div class="card-body p-4 gap-3">
						<h3 class="card-title text-sm">Details</h3>

						<div class="flex items-center gap-2 text-sm">
							<ChannelIcon size={16} class="opacity-60" />
							{channelLabels[t.channel]}
						</div>

						<div class="flex items-center gap-2 text-sm">
							<StatusBadge status={t.status} label />
						</div>

						{#if t.contactEmail}
							<div class="text-sm">
								<span class="opacity-60">Email:</span>
								<a href="mailto:{t.contactEmail}" class="link link-primary">{t.contactEmail}</a>
							</div>
						{/if}

						{#if t.contactPhone}
							<div class="text-sm">
								<span class="opacity-60">Phone:</span>
								{t.contactPhone}
							</div>
						{/if}

						{#if t.assignedToName}
							<div class="text-sm">
								<span class="opacity-60">Assigned:</span>
								{t.assignedToName}
							</div>
						{:else}
							<div class="text-sm opacity-60">Unassigned</div>
						{/if}

						<div class="text-sm">
							<span class="opacity-60">Messages:</span>
							{t.messageCount}
						</div>

						<div class="text-xs opacity-50">
							Created {formatDateTime(t.createdAt)}
						</div>
					</div>
				</div>

				<div class="card bg-base-200">
					<div class="card-body p-4 gap-3">
						<h3 class="card-title text-sm">Assignment</h3>
						{#await staffUsers then staff}
							<form
								{...assignForm.enhance(async ({ submit }) => {
									if (await submit()) {
										toast.success('Assignment updated');
										void getInboxThread(threadId).refresh();
									} else {
										toast.error('Failed to update assignment');
									}
								})}
								class="flex flex-col gap-2"
							>
								<input {...assignForm.fields.threadId.as('hidden', t.id)} />
								<select
									name="userId"
									class="select select-bordered select-sm w-full"
									value={t.assignedToUserId ?? ''}
								>
									<option value="">Unassigned</option>
									{#each staff as s (s.id)}
										<option value={s.id}>{s.name}</option>
									{/each}
								</select>
								<button type="submit" class="btn btn-sm">Update Assignment</button>
							</form>
						{/await}
					</div>
				</div>

				<div class="card bg-base-200">
					<div class="card-body p-4 gap-3">
						<h3 class="card-title text-sm">Actions</h3>
						<form
							{...statusForm.enhance(async ({ submit }) => {
								if (await submit()) {
									toast.success('Status updated');
									void getInboxThread(threadId).refresh();
								}
							})}
							class="flex flex-col gap-2"
						>
							<input {...statusForm.fields.threadId.as('hidden', t.id)} />
							<select
								name="status"
								class="select select-bordered select-sm w-full"
								value={t.status}
							>
								{#each inboxThreadStatuses as s (s)}
									<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
								{/each}
							</select>
							<button type="submit" class="btn btn-sm">Update Status</button>
						</form>
					</div>
				</div>
			</div>
		</div>
	</PageContent>
{/await}
