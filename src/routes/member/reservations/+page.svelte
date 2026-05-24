<script lang="ts">
	import { invalidateAll, goto } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import {
		formatDate,
		relativeDay,
		formatTimeRange,
		formatScheduleLabel,
		formatDateYear
	} from '$lib/utils/format';
	import type { ISODateString } from '$lib/types/dates';
	import DataTable from '$lib/components/shared/Table/DataTable.svelte';
	import Column from '$lib/components/shared/Table/Column.svelte';
	import Action from '$lib/components/shared/Action.svelte';
	import StatusBadge from '$lib/components/shared/StatusBadge.svelte';
	import Form from '$lib/components/shared/Form/Form.svelte';
	import FormField from '$lib/components/shared/Form/FormField.svelte';
	import SubmitButton from '$lib/components/shared/Form/SubmitButton.svelte';
	import Modal from '$lib/components/shared/Modal.svelte';
	import { CancelSeriesAction } from '$lib/components/shared/actions';
	import { editMemberSeries } from '$lib/remote/recurring.remote';
	import { getMembershipStatus, confirmWaitlisted } from '$lib/remote/reservations.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ButtonGroup from '$lib/components/shared/ButtonGroup.svelte';
	import Button from '$lib/components/shared/Button.svelte';
	import { IconClock, IconPencil, IconPlayerPause, IconX } from '@tabler/icons-svelte';
	import CreateModal from './CreateModal.svelte';
	import ReservationCard from './ReservationCard.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const upcoming = $derived(data.upcoming);
	const all = $derived(data.all);
	const recurringSeries = $derived(data.recurringSeries);

	let activeTab = $state<'upcoming' | 'all'>('upcoming');
	const tableData = $derived(activeTab === 'upcoming' ? upcoming : all);

	let creditData = $derived(await getMembershipStatus());
	const isSustaining = $derived(creditData.isSustainingMember);
	const hasHours = $derived(creditData.freeHoursBalance > 0);

	// Waitlist confirmation via ?confirm={id}
	const confirmReservation = $derived(
		data.confirmId
			? upcoming.find(
					(r) => r.id === data.confirmId && r.status === 'waitlisted' && r.waitlistNotifiedAt
				)
			: null
	);
	let confirmModalOpen = $state(false);

	$effect(() => {
		if (confirmReservation) {
			confirmModalOpen = true;
		}
	});

	function closeConfirmModal() {
		confirmModalOpen = false;
		goto('/member/reservations', { replaceState: true });
	}

	// Edit series state
	let editDate = $state('');
	let editStartTime = $state('');
	let editEndTime = $state('');
	let editFrequency = $state<'weekly' | 'biweekly' | 'monthly'>('weekly');
</script>

<PageHeader title="Reserve Practice Space">
	<CreateModal {isSustaining} />
</PageHeader>
<PageContent>
	<div
		class="overflow-hidden rounded-lg border-[2.5px] border-(--cmc-brown) bg-(--cmc-parchment)"
	>
		<div class="grid grid-cols-2 divide-x divide-(--cmc-brown)/30 sm:grid-cols-4">
			<div class="px-4 py-3 text-center">
				<span class="block text-[.6rem] font-bold tracking-wide text-(--cmc-brown)/60 uppercase"
					>Rate</span
				>
				<span class="block text-lg font-bold text-(--cmc-brown)">$15/hr</span>
			</div>
			<div class="px-4 py-3 text-center">
				<span class="block text-[.6rem] font-bold tracking-wide text-(--cmc-brown)/60 uppercase"
					>Hours</span
				>
				<span class="block text-lg font-bold text-(--cmc-brown)">9 AM – 10 PM</span>
			</div>
			<div class="px-4 py-3 text-center">
				<span class="block text-[.6rem] font-bold tracking-wide text-(--cmc-brown)/60 uppercase"
					>Length</span
				>
				<span class="block text-lg font-bold text-(--cmc-brown)">1 – 8 hrs</span>
			</div>
			<div class="px-4 py-3 text-center">
				<span class="block text-[.6rem] font-bold tracking-wide text-(--cmc-brown)/60 uppercase"
					>Notice</span
				>
				<span class="block text-lg font-bold text-(--cmc-brown)">1 day+</span>
			</div>
		</div>
		<details class="border-t-[2.5px] border-(--cmc-brown)/30">
			<summary
				class="cursor-pointer px-4 py-2 text-xs font-semibold tracking-wide text-(--cmc-brown)/60 uppercase hover:text-(--cmc-brown)"
			>
				Booking Policy
			</summary>
			<div class="space-y-1 px-4 pb-3 text-sm opacity-70">
				<p>Payment is due at reservation start time via cash in person or card online.</p>
				<p>
					If you have specific needs for equipment or space, note them in the reservation form.
				</p>
			</div>
		</details>
	</div>

	{#if isSustaining}
		<div
			class="flex flex-col gap-1 rounded-lg border border-base-300 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2"
		>
			<div class="flex items-center gap-2">
				<IconClock size={18} class={hasHours ? 'text-success' : 'opacity-40'} />
				<span class={hasHours ? 'font-medium' : 'font-medium opacity-40'}
					>{creditData.freeHoursBalance}</span
				>
				<span class="text-sm {hasHours ? 'opacity-60' : 'opacity-30'}">free hours remaining</span>
			</div>
			{#if creditData.creditsResetAt}
				<span class="text-sm {hasHours ? 'opacity-60' : 'opacity-30'}">
					Resets to {creditData.hoursPerReset} on {formatDate(
						creditData.creditsResetAt as ISODateString
					)}
				</span>
			{/if}
		</div>
	{:else}
		<div
			class="flex flex-col gap-2 rounded-lg border border-base-300 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3"
		>
			<div class="flex items-center gap-3">
				<IconClock size={18} class="shrink-0 opacity-40" />
				<span>Get free practice hours each month with a sustaining membership.</span>
			</div>
			<Button href="/member/membership" class="self-end btn-sm sm:self-auto">Learn More</Button>
		</div>
	{/if}

	<div class="flex w-full flex-row flex-wrap items-center justify-between gap-2">
		<h2 class="shrink-0 text-2xl font-bold text-nowrap">My Reservations</h2>
		<ButtonGroup>
			<button
				class="btn btn-sm"
				class:btn-primary={activeTab === 'upcoming'}
				class:latched={activeTab === 'upcoming'}
				onclick={() => (activeTab = 'upcoming')}
			>
				Active ({upcoming.length})
			</button>
			<button
				class="btn btn-sm"
				class:btn-primary={activeTab === 'all'}
				class:latched={activeTab==='all'}
				onclick={() => (activeTab = 'all')}
			>
				All
			</button>
		</ButtonGroup>
	</div>

	<DataTable
		data={tableData}
		empty="No reservations found. Start by creating your first practice space reservation."
		gridClass="grid grid-cols-1 @2xl:grid-cols-2 @5xl:grid-cols-3 gap-3"
	>
		{#snippet card(row)}
			<ReservationCard reservation={row} />
		{/snippet}
	</DataTable>

	<div class="flex flex-auto"></div>

	{#if isSustaining}
		<div class="flex items-center justify-between pt-4">
			<h2 class="text-lg font-semibold">My Recurring Reservations</h2>
		</div>
		<DataTable data={recurringSeries} empty="No active recurring reservations.">
			<Column key="id" header="" shrink>
				{#snippet cell()}
					<StatusBadge status="active" />
				{/snippet}
			</Column>
			<Column key="frequencyLabel" header="Schedule">
				{#snippet cell(_value, row)}
					{formatScheduleLabel(row.frequencyLabel, row.startsAt)}
					<br />
					<span class="text-sm opacity-60">{formatTimeRange(row.startsAt, row.endsAt)}</span>
				{/snippet}
			</Column>
			<Column key="createdAt" header="Start Date" sortable>
				{#snippet cell(value)}
					{formatDateYear(String(value) as ISODateString)}
				{/snippet}
			</Column>
			<Column key="seriesEndsAt" header="End Date" sortable>
				{#snippet cell(value)}
					{value ? formatDateYear(String(value) as ISODateString) : '—'}
				{/snippet}
			</Column>
			<Column key="id" header="" shrink stopClick>
				{#snippet cell(_value, row)}
					<ButtonGroup>
						<CancelSeriesAction seriesId={row.id} class="btn-square btn-ghost">
							{#snippet trigger({ onclick, disabled })}
								<Button class="btn-square btn-ghost btn-sm" {disabled} {onclick}>
									<IconX size={20} />
								</Button>
							{/snippet}
						</CancelSeriesAction>
						<Action
							action={editMemberSeries}
							label="Edit"
							modalTitle="Edit Schedule"
							successToast="Series schedule updated"
							onsuccess={() => invalidateAll()}
							class="btn-xs btn-primary"
						>
							{#snippet trigger({ onclick, disabled })}
								<Button class="btn-square btn-ghost btn-sm" {disabled} {onclick}>
									<IconPencil size={20} />
								</Button>
							{/snippet}
							{#snippet form({ close })}
								<input type="hidden" name="seriesId" value={row.id} />
								<div class="grid grid-cols-3 gap-3">
									<FormField name="date" label="Day" type="date" bind:value={editDate} />
									<FormField
										name="startTime"
										label="Start"
										type="time"
										bind:value={editStartTime}
									/>
									<FormField name="endTime" label="End" type="time" bind:value={editEndTime} />
								</div>
								<FormField name="frequency" label="Frequency">
									<select
										class="select-bordered select w-full"
										name="frequency"
										bind:value={editFrequency}
									>
										<option value="weekly">Weekly</option>
										<option value="biweekly">Every 2 weeks</option>
										<option value="monthly">Monthly</option>
									</select>
								</FormField>
								<p class="text-xs opacity-60">
									This will create a new series with the updated schedule. The current series will
									end.
								</p>
							{/snippet}
						</Action>
						<Button class="btn-square btn-sm btn-ghost" title="Pause series">
							<IconPlayerPause size={20} />
						</Button>
					</ButtonGroup>
				{/snippet}
			</Column>
		</DataTable>
	{:else}
		<div class="rounded-lg border border-base-300 px-4 pb-3 text-sm">
			<h2 class="pt-4 text-lg font-semibold">Recurring Reservations</h2>

			<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
				<span
					>Sustaining members can set up recurring weekly, biweekly, or monthly reservations.</span
				>
				<Button href="/member/membership" class="self-end btn-sm sm:self-auto">Learn More</Button>
			</div>
		</div>
	{/if}
</PageContent>

{#if confirmReservation}
	<Modal
		bind:open={confirmModalOpen}
		title="Slot Available"
		maxWidth="max-w-md"
		onclose={closeConfirmModal}
	>
		<Form
			remote={confirmWaitlisted}
			successToast="Reservation confirmed"
			onsuccess={async () => {
				closeConfirmModal();
				await invalidateAll();
			}}
		>
			<div class="space-y-4">
				<p class="text-sm">A slot has opened up for your waitlisted reservation:</p>
				<div class="rounded-lg border border-base-300 bg-base-200/50 px-4 py-3">
					<p class="font-medium">{relativeDay(confirmReservation.startsAt)}</p>
					<p class="text-sm opacity-70">
						{formatTimeRange(confirmReservation.startsAt, confirmReservation.endsAt)}
					</p>
				</div>
				{#if confirmReservation.waitlistExpiresAt}
					<p class="text-xs opacity-60">
						Confirm by {formatDate(confirmReservation.waitlistExpiresAt)} or the slot will be offered
						to someone else.
					</p>
				{/if}
				<input type="hidden" name="id" value={confirmReservation.id} />
				<div class="flex justify-end gap-2">
					<Button type="button" class="btn-ghost btn-sm" onclick={closeConfirmModal}>Dismiss</Button
					>
					<SubmitButton label="Confirm Reservation" class="btn-sm btn-success" />
				</div>
			</div>
		</Form>
	</Modal>
{/if}
