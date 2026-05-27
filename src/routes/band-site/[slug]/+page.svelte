<script lang="ts">
	import BandSiteRenderer from '$lib/components/band-site/BandSiteRenderer.svelte';
	import { getBandSiteData } from '$lib/remote/band-site.remote';
	import { page } from '$app/state';

	let data = $derived(await getBandSiteData(page.params.slug!));
</script>

<BandSiteRenderer
	band={data.band}
	config={data.config}
	members={data.members}
	events={data.events}
	media={data.media}
/>
