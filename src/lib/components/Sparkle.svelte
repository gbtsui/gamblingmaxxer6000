<script lang="ts">
	/** The four-point mark the printed cards use for their element badge. */
	let { class: className = '' }: { class?: string } = $props();
</script>

<svg viewBox="0 0 32 32" aria-hidden="true" class={className} fill="currentColor">
	<path
		d="M16 3c1.1 8 4.9 11.8 12.9 12.9C20.9 17.1 17.1 20.9 16 28.9 14.9 20.9 11.1 17.1 3.1 15.9 11.1 14.8 14.9 11 16 3Z"
	/>
</svg>
