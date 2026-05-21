<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import {
		getCampaignDetail,
		getAudienceOptions,
		getPreview,
		saveDraft,
		sendCampaignNow,
		scheduleCampaign,
		deleteCampaign
	} from '$lib/remote/marketing.remote';

	let id = $derived(page.params.id!);
	let campaignData = $derived(await getCampaignDetail(id));
	let audiences = $derived(await getAudienceOptions());

	// Initialize editable state from loaded campaign
	let subject = $state('');
	let markdownBody = $state('');
	let selectedAudienceIds = $state<string[]>([]);
	let scheduleDate = $state('');
	let submitting = $state(false);
	let showSchedule = $state(false);
	let initialized = $state(false);

	$effect(() => {
		if (campaignData && !initialized) {
			subject = campaignData.subject;
			markdownBody = campaignData.markdownBody;
			selectedAudienceIds = campaignData.audiences.map((a) => a.id);
			initialized = true;
		}
	});

	// Redirect if not a draft
	$effect(() => {
		if (campaignData && campaignData.status !== 'draft') {
			goto(`/staff/marketing/campaigns/${id}`);
		}
	});

	let previewHtml = $derived(await getPreview(markdownBody));

	function toggleAudience(audienceId: string) {
		if (selectedAudienceIds.includes(audienceId)) {
			selectedAudienceIds = selectedAudienceIds.filter((a) => a !== audienceId);
		} else {
			selectedAudienceIds = [...selectedAudienceIds, audienceId];
		}
	}

	let totalSubscribers = $derived(
		audiences
			.filter((a) => selectedAudienceIds.includes(a.id))
			.reduce((sum, a) => sum + a.subscriberCount, 0)
	);

	function isValid() {
		return subject.trim() && markdownBody.trim() && selectedAudienceIds.length > 0;
	}

	async function handleSave() {
		if (!isValid()) return;
		submitting = true;
		try {
			await saveDraft({
				subject: subject.trim(),
				markdownBody,
				audienceIds: selectedAudienceIds
			});
			toast.success('Draft saved');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save');
		} finally {
			submitting = false;
		}
	}

	async function handleSendNow() {
		if (!isValid()) return;
		// Save first, then send
		submitting = true;
		try {
			await saveDraft({
				subject: subject.trim(),
				markdownBody,
				audienceIds: selectedAudienceIds
			});
			if (!window.confirm(`Send to approximately ${totalSubscribers} recipients now?`)) {
				submitting = false;
				return;
			}
			await sendCampaignNow({});
			toast.success('Campaign sent');
			goto(`/staff/marketing/campaigns/${id}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to send');
		} finally {
			submitting = false;
		}
	}

	async function handleSchedule() {
		if (!isValid() || !scheduleDate) return;
		submitting = true;
		try {
			await saveDraft({
				subject: subject.trim(),
				markdownBody,
				audienceIds: selectedAudienceIds
			});
			await scheduleCampaign({ scheduledFor: scheduleDate });
			toast.success('Campaign scheduled');
			goto(`/staff/marketing/campaigns/${id}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to schedule');
		} finally {
			submitting = false;
		}
	}

	async function handleDelete() {
		if (!window.confirm('Delete this draft campaign?')) return;
		try {
			await deleteCampaign({});
			toast.success('Campaign deleted');
			goto('/staff/marketing/campaigns');
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to delete');
		}
	}
</script>

	<PageHeader title="Edit Campaign" subtitle="Marketing" backHref="/staff/marketing/campaigns">
		<button class="btn btn-ghost btn-sm text-error" onclick={handleDelete}>Delete</button>
	</PageHeader>
<PageContent>
	<div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
		<!-- Editor pane -->
		<div class="space-y-4">
			<div>
				<label for="campaign-subject" class="label text-sm font-medium">Subject</label>
				<input
					id="campaign-subject"
					type="text"
					bind:value={subject}
					placeholder="Email subject line..."
					class="input-bordered input w-full"
				/>
			</div>

			<div>
				<p class="label text-sm font-medium">Audiences</p>
				<div class="flex flex-wrap gap-2">
					{#each audiences as a (a.id)}
						<label class="label cursor-pointer gap-2 border rounded-lg px-3 py-1.5 {selectedAudienceIds.includes(a.id) ? 'border-primary bg-primary/10' : 'border-base-300'}">
							<input
								type="checkbox"
								class="checkbox checkbox-sm checkbox-primary"
								checked={selectedAudienceIds.includes(a.id)}
								onchange={() => toggleAudience(a.id)}
							/>
							<span class="text-sm">{a.name}</span>
							<span class="text-xs opacity-60">({a.subscriberCount})</span>
						</label>
					{/each}
				</div>
				{#if selectedAudienceIds.length > 0}
					<p class="text-xs opacity-60 mt-1">~{totalSubscribers} recipients (before deduplication)</p>
				{/if}
			</div>

			<div>
				<label for="campaign-body" class="label text-sm font-medium">Body (Markdown)</label>
				<textarea
					id="campaign-body"
					bind:value={markdownBody}
					placeholder="Write your email in markdown..."
					class="textarea-bordered textarea w-full font-mono text-sm"
					rows="20"
				></textarea>
				<p class="text-xs opacity-60 mt-1">
					Available variables: {'{{subscriber_name}}'}, {'{{unsubscribe_url}}'}
				</p>
			</div>

			<div class="flex flex-wrap gap-2">
				<button
					class="btn btn-outline btn-sm"
					disabled={!isValid() || submitting}
					onclick={handleSave}
				>
					Save Draft
				</button>
				<button
					class="btn btn-primary btn-sm"
					disabled={!isValid() || submitting}
					onclick={handleSendNow}
				>
					Send Now
				</button>
				<button
					class="btn btn-secondary btn-sm"
					disabled={!isValid() || submitting}
					onclick={() => (showSchedule = !showSchedule)}
				>
					Schedule
				</button>
			</div>

			{#if showSchedule}
				<div class="flex gap-2 items-end">
					<div>
						<label for="schedule-date" class="text-xs opacity-60">Send at</label>
						<input
							id="schedule-date"
							type="datetime-local"
							bind:value={scheduleDate}
							class="input-bordered input input-sm"
						/>
					</div>
					<button
						class="btn btn-secondary btn-sm"
						disabled={!scheduleDate || submitting}
						onclick={handleSchedule}
					>
						Confirm Schedule
					</button>
				</div>
			{/if}

			{#if submitting}
				<div class="flex items-center gap-2 text-sm opacity-60">
					<span class="loading loading-sm loading-spinner"></span>
					Working...
				</div>
			{/if}
		</div>

		<!-- Preview pane -->
		<div>
			<p class="label text-sm font-medium">Preview</p>
			<div class="border rounded-lg bg-white overflow-hidden" style="min-height: 400px;">
				{#if previewHtml}
					{@html previewHtml}
				{:else}
					<div class="flex items-center justify-center h-full p-12 text-sm opacity-40">
						Start typing to see a preview...
					</div>
				{/if}
			</div>
		</div>
	</div>
</PageContent>
