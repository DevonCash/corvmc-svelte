<script lang="ts">
	import { goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import { getAudienceOptions, getPreview, createDraft, createAndSend, createAndSchedule } from '$lib/remote/marketing.remote';

	let subject = $state('');
	let markdownBody = $state('');
	let selectedAudienceIds = $state<string[]>([]);
	let scheduleDate = $state('');
	let submitting = $state(false);
	let showSchedule = $state(false);

	let audiences = $derived(await getAudienceOptions());
	let previewHtml = $derived(await getPreview(markdownBody));

	function toggleAudience(id: string) {
		if (selectedAudienceIds.includes(id)) {
			selectedAudienceIds = selectedAudienceIds.filter((a) => a !== id);
		} else {
			selectedAudienceIds = [...selectedAudienceIds, id];
		}
	}

	let totalSubscribers = $derived(
		audiences
			.filter((a) => selectedAudienceIds.includes(a.id))
			.reduce((sum, a) => sum + a.subscriberCount, 0)
	);

	async function handleSaveDraft() {
		if (!isValid()) return;
		submitting = true;
		try {
			const result = await createDraft({
				subject: subject.trim(),
				markdownBody,
				audienceIds: selectedAudienceIds
			});
			toast.success('Draft saved');
			goto(`/staff/marketing/campaigns/${result?.campaignId}/edit`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to save');
		} finally {
			submitting = false;
		}
	}

	async function handleSendNow() {
		if (!isValid()) return;
		if (!window.confirm(`Send to approximately ${totalSubscribers} recipients now?`)) return;
		submitting = true;
		try {
			const result = await createAndSend({
				subject: subject.trim(),
				markdownBody,
				audienceIds: selectedAudienceIds
			});
			toast.success('Campaign sent');
			goto(`/staff/marketing/campaigns/${result?.campaignId}`);
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
			const result = await createAndSchedule({
				subject: subject.trim(),
				markdownBody,
				audienceIds: selectedAudienceIds,
				scheduledFor: scheduleDate
			});
			toast.success('Campaign scheduled');
			goto(`/staff/marketing/campaigns/${result?.campaignId}`);
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Failed to schedule');
		} finally {
			submitting = false;
		}
	}

	function isValid() {
		return subject.trim() && markdownBody.trim() && selectedAudienceIds.length > 0;
	}
</script>

	<PageHeader title="New Campaign" subtitle="Marketing" backHref="/staff/marketing/campaigns" />
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

			<!-- Actions -->
			<div class="flex flex-wrap gap-2">
				<button
					class="btn btn-outline btn-sm"
					disabled={!isValid() || submitting}
					onclick={handleSaveDraft}
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
