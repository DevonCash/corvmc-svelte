<script lang="ts">
	import {
		getMemberProfile,
		getInstrumentSuggestions,
		getGenreSuggestions
	} from '$lib/remote/directory.remote';
	import PageHeader from '$lib/components/shared/PageHeader.svelte';
	import PageContent from '$lib/components/shared/PageContent.svelte';
	import ProfileForm from './ProfileForm.svelte';

	// Resolve everything here and hand ProfileForm plain props. The form must
	// not live in a component whose script awaits: a top-level await marks all
	// later declarations "blocked", turning every bind:value/fields expression
	// in the template into an async derived — the reactive churn behind the
	// effect_update_depth_exceeded crashes on this page (JAVASCRIPT-SVELTEKIT-W).
	const profile = await getMemberProfile();
	const instrumentSuggestions = await getInstrumentSuggestions();
	const genreSuggestions = await getGenreSuggestions();
</script>

<PageHeader subtitle="Profile" title="My Profile" />
<PageContent width="3xl">
	<ProfileForm {profile} {instrumentSuggestions} {genreSuggestions} />
</PageContent>
