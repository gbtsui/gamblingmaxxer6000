<script lang="ts">
	/**
	 * The finish on a card: sleeve gloss on everything, foil stock under it on
	 * the rare ones.
	 *
	 * It never stops moving. Hover is a nice-to-have — plenty of people will see
	 * this on a phone where there's no pointer at all — so the shine drifts on
	 * its own and pointer tracking only takes over when there's a pointer to
	 * track. Position vars (`--mx`, `--my`, `--fx`, `--fy`) cascade in from the
	 * card, and `--phase` staggers cards so a spread of them doesn't shimmer in
	 * lockstep.
	 */
	let { foil = false, held = false }: { foil?: boolean; held?: boolean } = $props();
</script>

<span class="shine" class:is-foil={foil} class:is-held={held} aria-hidden="true">
	{#if foil}
		<span class="foil"></span>
		<span class="glitter"></span>
	{/if}
	<span class="gloss"></span>
	<span class="edge"></span>
</span>

<style>
	.shine,
	.shine > span {
		position: absolute;
		inset: 0;
		pointer-events: none;
		border-radius: inherit;
	}

	/*
	 * Two speculars: a tight one where the lamp reflects off the sleeve, and a
	 * broad diagonal wash so the plastic still reads as plastic away from it.
	 */
	.gloss {
		background-image:
			radial-gradient(
				circle at 50% 50%,
				rgb(255 255 255 / 0.55) 0%,
				rgb(255 255 255 / 0.14) 16%,
				transparent 44%
			),
			linear-gradient(
				105deg,
				transparent 36%,
				rgb(255 255 255 / 0.16) 45%,
				rgb(255 255 255 / 0.34) 50%,
				rgb(255 255 255 / 0.16) 55%,
				transparent 64%
			);
		background-size:
			230% 230%,
			280% 100%;
		background-repeat: no-repeat;
		mix-blend-mode: soft-light;
		opacity: 0.9;
		animation: gloss-drift 7s ease-in-out infinite;
		animation-delay: calc(var(--phase, 0) * -7s);
	}

	@keyframes gloss-drift {
		0%,
		100% {
			background-position:
				16% 18%,
				0% 50%;
		}
		50% {
			background-position:
				84% 76%,
				100% 50%;
		}
	}

	/*
	 * Foil. The rainbow band is far wider than the card, so movement slides the
	 * card across a spectrum rather than cycling it through one.
	 */
	.foil {
		background-image: repeating-linear-gradient(
			107deg,
			hsl(0 90% 62%) 0%,
			hsl(45 92% 62%) 6%,
			hsl(95 85% 60%) 12%,
			hsl(175 88% 60%) 18%,
			hsl(230 92% 66%) 24%,
			hsl(295 88% 66%) 30%,
			hsl(0 90% 62%) 36%
		);
		background-size: 320% 320%;
		mix-blend-mode: color-dodge;
		filter: brightness(0.6) contrast(1.5) saturate(1.3);
		opacity: 0.42;
		animation: foil-drift 9s ease-in-out infinite;
		animation-delay: calc(var(--phase, 0) * -9s);
	}

	/* Print glitter: the fine dot texture foil stock is stamped with. */
	.glitter {
		background-image:
			radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.55) 0.6px, transparent 1.1px),
			radial-gradient(circle at 50% 50%, rgb(255 255 255 / 0.35) 0.5px, transparent 1px);
		background-size:
			7px 7px,
			11px 11px;
		mix-blend-mode: color-dodge;
		opacity: 0.4;
		animation: foil-drift 9s ease-in-out infinite;
		animation-delay: calc(var(--phase, 0) * -9s);
	}

	@keyframes foil-drift {
		0%,
		100% {
			background-position:
				22% 28%,
				22% 28%;
		}
		50% {
			background-position:
				78% 72%,
				78% 72%;
		}
	}

	/* The card stock's own thickness, caught along the edges. */
	.edge {
		box-shadow:
			inset 0 1px 0 rgb(255 255 255 / 0.28),
			inset 0 -1px 0 rgb(0 0 0 / 0.5);
	}

	/* A pointer beats the drift: the shine goes where the finger is instead. */
	.is-held .gloss {
		animation: none;
		background-position:
			var(--mx, 50%) var(--my, 50%),
			var(--mx, 50%) 50%;
		opacity: 1;
	}

	.is-held .foil,
	.is-held .glitter {
		animation: none;
		background-position:
			var(--fx, 50%) var(--fy, 50%),
			var(--fx, 50%) var(--fy, 50%);
	}

	.is-held .foil {
		opacity: 0.72;
	}

	.is-held .glitter {
		opacity: 0.8;
	}

	/* Still finished, just not moving. */
	@media (prefers-reduced-motion: reduce) {
		.gloss,
		.foil,
		.glitter {
			animation: none;
			background-position:
				50% 40%,
				50% 40%;
		}
	}
</style>
