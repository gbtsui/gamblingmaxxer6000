<script lang="ts">
	import type { FeedLine } from '$lib/battle';

	type Props = {
		lines: FeedLine[];
		/** Printed at the top so you know how far in you are. */
		round?: number;
	};

	let { lines, round = 0 }: Props = $props();

	let scroller = $state<HTMLElement | null>(null);

	/**
	 * Whether the feed is still chasing the fight. It starts out following and
	 * only lets go when the reader scrolls back up themselves — checking the
	 * distance at paste time instead would strand the feed at the top the moment
	 * a skipped fight dumps its whole log in one go.
	 */
	let following = $state(true);

	function onScroll() {
		if (!scroller) return;
		following = scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < 120;
	}

	/** Keeps the newest line in view for as long as the reader wants it there. */
	$effect(() => {
		if (lines.length === 0 || !scroller || !following) return;
		scroller.scrollTo({ top: scroller.scrollHeight, behavior: 'smooth' });
	});
</script>

<div class="feed panel">
	<div class="head">
		<span class="micro">what happened</span>
		{#if round > 0}
			<span class="tabular micro">round {round}</span>
		{/if}
	</div>

	<!-- A live region, so the fight is followable without watching the field. -->
	<ol
		class="scroller"
		bind:this={scroller}
		onscroll={onScroll}
		aria-live="polite"
		aria-relevant="additions"
	>
		{#each lines as line (line.id)}
			<li class="line is-{line.kind}" class:is-theirs={line.side === 'ai'}>
				{#if line.kind === 'round'}
					<span class="rule"></span>
					<span class="round-label">{line.text}</span>
					<span class="rule"></span>
				{:else}
					{#if line.move}
						<span class="move" style="--tint: {line.tint ?? 'var(--color-lamp)'}">{line.move}</span>
					{/if}
					<span class="text">{line.text}</span>
					{#if line.note}
						<span class="note" style="--tint: {line.tint ?? 'var(--color-lamp)'}">{line.note}</span>
					{/if}
				{/if}
			</li>
		{:else}
			<li class="waiting">the room is quiet.</li>
		{/each}
	</ol>
</div>

<style>
	.feed {
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		padding: 0.7rem 0.15rem 0.7rem 0.8rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
		padding-right: 0.8rem;
		padding-bottom: 0.5rem;
		border-bottom: 0.15rem solid rgb(245 245 246 / 0.12);
	}

	.scroller {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.6rem 0.8rem 0 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		scrollbar-width: thin;
		scrollbar-color: var(--color-wall-lit) transparent;
	}

	.line {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: -0.02em;
		line-height: 1.3;
		color: rgb(245 245 246 / 0.9);
		animation: slide-in 0.28s ease-out;
	}

	@keyframes slide-in {
		from {
			opacity: 0;
			transform: translateX(-0.4rem);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	/* Your side is called out; theirs recedes. Reading the feed shouldn't need
	   cross-referencing the field to work out who just landed one. */
	.line.is-hit {
		border-left: 0.2rem solid var(--color-lamp);
		padding-left: 0.5rem;
	}

	.line.is-hit.is-theirs {
		border-left-color: rgb(255 90 90 / 0.75);
		color: rgb(245 245 246 / 0.72);
	}

	/* The move gets its own line above the damage — a fight reads as a sequence
	   of named moves, and the numbers hang off them. */
	.move {
		display: block;
		font-size: 0.7rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--tint);
	}

	.note {
		color: var(--tint);
	}

	.line.is-ko {
		padding-left: 0.5rem;
		font-weight: 900;
		color: #ff6b6b;
	}

	.line.is-result {
		margin-top: 0.3rem;
		padding: 0.4rem 0.5rem;
		border: 0.15rem solid var(--color-ink);
		border-radius: 0.4rem;
		background: rgb(159 220 255 / 0.14);
		font-weight: 900;
		color: var(--color-lamp);
	}

	.line.is-round {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.3rem;
		animation: none;
	}

	.round-label {
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.05em;
		color: var(--color-wall-lit);
		white-space: nowrap;
	}

	.rule {
		height: 0.1rem;
		flex: 1;
		background: rgb(245 245 246 / 0.14);
	}

	.waiting {
		font-size: 0.78rem;
		font-style: italic;
		color: var(--color-wall-lit);
	}
</style>
