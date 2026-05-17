<script lang="ts">
	import { IconBell } from '@tabler/icons-svelte';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';

	// ---------------------------------------------------------------------------
	// Notification bell with dropdown
	// ---------------------------------------------------------------------------
	// Connects to SSE for real-time updates. Shows unread count badge.
	// Dropdown lists recent notifications with mark-as-read.
	// ---------------------------------------------------------------------------

	interface Notification {
		id: string;
		type: string;
		title: string;
		body?: string | null;
		href?: string | null;
		readAt?: string | null;
		createdAt: string;
	}

	let unreadCount = $state(0);
	let notifications = $state<Notification[]>([]);
	let open = $state(false);
	let loading = $state(false);
	let eventSource: EventSource | null = null;
	let connectTimeout: ReturnType<typeof setTimeout> | null = null;

	function closeEventSource() {
		eventSource?.close();
		eventSource = null;
	}

	function handleBeforeUnload() {
		closeEventSource();
	}

	onMount(() => {
		if (!browser) return;

		// Defer connection so it doesn't race with initial page load
		connectTimeout = setTimeout(() => {
			eventSource = new EventSource('/api/notifications/stream');

			eventSource.addEventListener('init', (e) => {
				const data = JSON.parse(e.data);
				unreadCount = data.unreadCount;
			});

			eventSource.addEventListener('message', (e) => {
				const notification: Notification = JSON.parse(e.data);
				notifications = [notification, ...notifications];
				unreadCount++;
			});

			eventSource.onerror = () => {};
		}, 100);

		window.addEventListener('beforeunload', handleBeforeUnload);
	});

	onDestroy(() => {
		if (connectTimeout) clearTimeout(connectTimeout);
		closeEventSource();
		if (browser) window.removeEventListener('beforeunload', handleBeforeUnload);
	});

	async function toggleDropdown() {
		open = !open;
		if (open && notifications.length === 0) {
			await fetchNotifications();
		}
	}

	async function fetchNotifications() {
		loading = true;
		try {
			const res = await fetch('/api/notifications?limit=10');
			if (res.ok) {
				const data = await res.json() as { notifications: typeof notifications; unreadCount: number };
				notifications = data.notifications;
				unreadCount = data.unreadCount;
			}
		} finally {
			loading = false;
		}
	}

	async function markRead(id: string) {
		await fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id })
		});
		notifications = notifications.map((n) =>
			n.id === id ? { ...n, readAt: new Date().toISOString() } : n
		);
		unreadCount = Math.max(0, unreadCount - 1);
	}

	async function markAllRead() {
		await fetch('/api/notifications/read', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ all: true })
		});
		notifications = notifications.map((n) => ({
			...n,
			readAt: n.readAt ?? new Date().toISOString()
		}));
		unreadCount = 0;
	}

	function timeAgo(dateStr: string): string {
		const diff = Date.now() - new Date(dateStr).getTime();
		const minutes = Math.floor(diff / 60_000);
		if (minutes < 1) return 'just now';
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	function handleClickOutside(e: MouseEvent) {
		const target = e.target as HTMLElement;
		if (!target.closest('.notification-bell-wrapper')) {
			open = false;
		}
	}
</script>

<svelte:window onclick={handleClickOutside} />

<div class="notification-bell-wrapper relative">
	<button
		class="btn btn-circle btn-ghost btn-sm"
		onclick={toggleDropdown}
		aria-label="Notifications"
	>
		<IconBell size={20} />
		{#if unreadCount > 0}
			<span
				class="absolute -top-0.5 -right-0.5 badge h-4 min-w-4 badge-xs text-[10px] badge-primary"
			>
				{unreadCount > 99 ? '99+' : unreadCount}
			</span>
		{/if}
	</button>

	{#if open}
		<div
			class="absolute top-full right-0 z-1000 mt-2 w-80 rounded-lg border border-base-300 bg-base-100 shadow-lg"
		>
			<div class="flex items-center justify-between border-b border-base-300 px-4 py-3">
				<span class="text-sm font-semibold">Notifications</span>
				{#if unreadCount > 0}
					<button class="text-xs text-primary hover:underline" onclick={markAllRead}>
						Mark all read
					</button>
				{/if}
			</div>

			<div class="max-h-80 overflow-y-auto">
				{#if loading}
					<div class="flex justify-center p-6">
						<span class="loading loading-sm loading-spinner"></span>
					</div>
				{:else if notifications.length === 0}
					<div class="p-6 text-center text-sm text-base-content/60">No notifications yet</div>
				{:else}
					{#each notifications as n (n.id)}
						{@const isUnread = !n.readAt}
						<div class="relative">
							{#if n.href}
								<a
									href={n.href}
									class="border-base-300/50} block border-b px-4 py-3 transition-colors hover:bg-base-200"
									class:bg-primary={isUnread}
									onclick={() => {
										if (isUnread) markRead(n.id);
										open = false;
									}}
								>
									<div class="flex items-start gap-2">
										{#if isUnread}
											<span class="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"></span>
										{:else}
											<span class="w-2 shrink-0"></span>
										{/if}
										<div class="min-w-0">
											<p class="truncate text-sm font-medium">{n.title}</p>
											{#if n.body}
												<p class="truncate text-xs text-base-content/60">{n.body}</p>
											{/if}
											<p class="mt-0.5 text-xs text-base-content/40">{timeAgo(n.createdAt)}</p>
										</div>
									</div>
								</a>
							{:else}
								<div class="border-b border-base-300/50 px-4 py-3" class:bg-primary={isUnread}>
									<div class="flex items-start gap-2">
										{#if isUnread}
											<button
												class="mt-1.5 h-2 w-2 shrink-0 cursor-pointer rounded-full bg-primary"
												onclick={() => markRead(n.id)}
												aria-label="Mark as read"
											></button>
										{:else}
											<span class="w-2 shrink-0"></span>
										{/if}
										<div class="min-w-0">
											<p class="truncate text-sm font-medium">{n.title}</p>
											{#if n.body}
												<p class="truncate text-xs text-base-content/60">{n.body}</p>
											{/if}
											<p class="mt-0.5 text-xs text-base-content/40">{timeAgo(n.createdAt)}</p>
										</div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
