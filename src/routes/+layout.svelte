<script lang="ts">
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head>
	<title>gamblingmaxxer6000 — ten come out, three go in</title>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
