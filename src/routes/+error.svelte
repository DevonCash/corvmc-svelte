<script lang="ts">
	import { page } from '$app/state';
</script>

<div class="flex min-h-screen items-center justify-center px-4">
	<div class="text-center">
		<h1 class="text-6xl font-bold opacity-20">{page.status}</h1>
		<p class="mt-4 text-lg">{page.error?.message ?? 'Something went wrong'}</p>
		<a href="/" class="btn btn-primary mt-6">Go home</a>
	</div>
</div>
