<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import InfoCard from '$lib/components/shared/InfoCard.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Alert from '$lib/components/shared/Alert.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import ThreadTimeline from '$lib/components/inbox/ThreadTimeline.svelte';
	import ThreadComposer from '$lib/components/inbox/ThreadComposer.svelte';
	import ThreadStatusActions from '$lib/components/inbox/ThreadStatusActions.svelte';
	import { channelIcon, channelLabel } from '$lib/components/inbox/channels';
	import { isAlwaysEnabledChannel } from '$lib/config';
	import { formatDateTime } from '$lib/utils/format';
	import {
		getInboxThread,
		replyToThread,
		addThreadNote,
		updateThreadStatus,
		assignThread,
		getInboxEnabledChannels,
		getAssignableStaff
	} from '$lib/remote/inbox.remote';

	const threadId = $derived(page.params.id!);

	// One await over all three, rather than three awaited deriveds: separate async
	// deriveds resolve at different times and the template can't read the early
	// ones until the last lands, which Svelte reports as a waterfall.
	const data = $derived(
		await Promise.all([getInboxThread(threadId), getInboxEnabledChannels(), getAssignableStaff()])
	);
	const t = $derived(data[0]);
	const enabledChannels = $derived(data[1]);
	const staffUsers = $derived(data[2]);

	const replyForm = replyToThread.for('reply');
	const noteForm = addThreadNote.for('note');
	const assignForm = assignThread.for('assign');
	// Separate instances so each status button tracks its own pending state. The
	// snooze modal takes the base form, since `Action` renders its own `<Form>`.
	const resolveForm = updateThreadStatus.for('resolve');
	const reopenForm = updateThreadStatus.for('reopen');
	const snoozeForm = updateThreadStatus;

	const ChannelIcon = $derived(channelIcon(t.channel));

	// Always-on channels deliver through the site itself, so they are never
	// disabled: a web thread replies by email to the address the contact form
	// captured, and a portal thread's reply is the message row itself.
	const channelDisabled = $derived(
		!isAlwaysEnabledChannel(t.channel) && !enabledChannels.includes(t.channel)
	);

	const replyBlockedReason = $derived.by(() => {
		if ((t.channel === 'web' || t.channel === 'email') && !t.contactEmail) {
			return 'This conversation has no contact email, so there is nowhere to send a reply. Leave an internal note instead.';
		}
		if (channelDisabled)
			return `Replies are turned off for the ${channelLabel(t.channel)} channel.`;
		return undefined;
	});

	const staffOptions = $derived([
		{ value: '', label: 'Unassigned' },
		...staffUsers.map((s) => ({ value: s.id, label: s.name }))
	]);
</script>

<PageHeader
	title={t.contactUserName ?? t.contactName ?? t.contactEmail ?? 'Conversation'}
	subtitle={t.subject ?? channelLabel(t.channel)}
	backHref="/staff/inbox"
>
	<StatusBadge status={t.status} label />
</PageHeader>
<PageContent>
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-4">
		<div class="space-y-4 lg:col-span-3">
			<ThreadTimeline messages={t.messages} notes={t.notes} contactName={t.contactName} />

			{#if channelDisabled}
				<Alert type="warning" href={resolve('/staff/settings')}>
					The {channelLabel(t.channel)} channel is disabled. Enable it in Settings → Inbox Channels to
					send replies.
				</Alert>
			{/if}

			<ThreadComposer
				threadId={t.id}
				{replyForm}
				{noteForm}
				{replyBlockedReason}
				onsent={() => getInboxThread(threadId).refresh()}
			/>
		</div>

		<div class="space-y-4">
			<InfoCard title="Details">
				<div class="flex items-center gap-2 text-sm">
					<ChannelIcon size={16} class="opacity-60" />
					{channelLabel(t.channel)}
				</div>

				{#if t.contactUserId}
					<div class="text-sm">
						<span class="opacity-60">Member:</span>
						<a href={resolve(`/staff/users/${t.contactUserId}`)} class="link link-primary">
							{t.contactUserName ?? t.contactName}
						</a>
					</div>
				{/if}

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

				<div class="text-sm">
					<span class="opacity-60">Messages:</span>
					{t.messageCount}
				</div>

				<div class="text-xs opacity-50">Created {formatDateTime(t.createdAt)}</div>
			</InfoCard>

			<InfoCard title="Status">
				<ThreadStatusActions
					threadId={t.id}
					status={t.status}
					snoozedUntil={t.snoozedUntil}
					{resolveForm}
					{reopenForm}
					{snoozeForm}
				/>
			</InfoCard>

			<InfoCard title="Assignment">
				<Form remote={assignForm} successToast="Assignment updated" class="flex flex-col gap-2">
					<input {...assignForm.fields.threadId.as('hidden', t.id)} />
					<FormField
						name="userId"
						label=""
						type="select"
						options={staffOptions}
						value={t.assignedToUserId ?? ''}
					/>
					<SubmitButton label="Update" variant="default" size="sm" />
				</Form>
			</InfoCard>
		</div>
	</div>
</PageContent>
