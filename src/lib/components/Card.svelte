<script lang="ts">
	import type { Item } from '$lib/types';
	import { elementName, isFoil, phaseOf, stars, thumb } from '$lib/cards';
	import Shine from './Shine.svelte';
	import Sparkle from './Sparkle.svelte';

	type Props = {
		card: Item;
		/** Face-up. Face-down shows the printed back. */
		revealed?: boolean;
		/** Picked for a corner — gets taped. */
		selected?: boolean;
		/** Greyed out because the three corners are full. */
		muted?: boolean;
		/** Corner number, printed as a chip. */
		corner?: number | null;
		/** What activating the card does. Omit for a static card. */
		onactivate?: (() => void) | null;
		/** Verb for the accessible label, e.g. "turn over" or "put in a corner". */
		action?: string;
		/**
		 * Opens the full-size view. Where activating the card already does
		 * something else, this gets its own button rather than competing for the
		 * same tap.
		 */
		onzoom?: (() => void) | null;
	};

	let {
		card,
		revealed = true,
		selected = false,
		muted = false,
		corner = null,
		onactivate = null,
		action = '',
		onzoom = null
	}: Props = $props();

	let held = $state(false);

	const shell = $derived(
		['stage relative block w-full', muted && 'is-muted', selected && 'is-selected']
			.filter(Boolean)
			.join(' ')
	);

	const rarityStars = $derived([...Array(stars(card.rarity)).keys()]);

	// A face-down card must not leak its identity to a screen reader either.
	const label = $derived(
		revealed
			? `${card.display_name.toLowerCase()} — ${card.rarity}, ${elementName(card.element)}, ` +
					`${card.hp} hp, ${card.damage} power${action ? `. ${action}` : ''}`
			: `face-down card${action ? `. ${action}` : ''}`
	);

	/**
	 * A card catches the lamp differently depending on how you hold it, so the
	 * tilt, the specular and the foil's position all hang off pointer position.
	 * Touch fires these too — a drag across a card works like a thumb would.
	 */
	function track(event: PointerEvent) {
		const el = event.currentTarget as HTMLElement;
		const box = el.getBoundingClientRect();
		const x = (event.clientX - box.left) / box.width;
		const y = (event.clientY - box.top) / box.height;

		held = true;
		el.style.setProperty('--mx', `${x * 100}%`);
		el.style.setProperty('--my', `${y * 100}%`);
		// Inverted on x so the card leans towards the pointer, not away from it.
		el.style.setProperty('--rx', `${(0.5 - y) * 13}deg`);
		el.style.setProperty('--ry', `${(x - 0.5) * 15}deg`);
		el.style.setProperty('--fx', `${15 + x * 70}%`);
		el.style.setProperty('--fy', `${15 + y * 70}%`);
	}

	function release(event: PointerEvent) {
		const el = event.currentTarget as HTMLElement;
		held = false;
		for (const prop of ['--mx', '--my', '--rx', '--ry', '--fx', '--fy']) {
			el.style.removeProperty(prop);
		}
	}
</script>

{#snippet body()}
	<div class="tilt">
		<div class="turner aspect-card w-full" class:is-revealed={revealed}>
			<!-- Back: the printed back, identical on every card in the set. -->
			<div
				class="face back absolute inset-0 flex flex-col items-center justify-center gap-2
				       overflow-hidden rounded-[6%] border-4 border-ink"
			>
				<Sparkle class="w-1/4 text-white/20" />
				<span class="text-[0.6rem] font-bold text-white/30">gamblingmaxxer</span>
			</div>

			<!-- Front: the printed art, which already carries name, hp and lore. -->
			<div class="face front absolute inset-0 overflow-hidden rounded-[6%] border-4 border-ink">
				<img
					src={thumb(card.image)}
					alt=""
					width="750"
					height="1058"
					loading="lazy"
					decoding="async"
					class="h-full w-full object-cover"
				/>
				<Shine foil={isFoil(card.rarity)} {held} />
			</div>
		</div>
	</div>

	{#if selected}
		<!-- Taped down. -->
		<span
			class="pointer-events-none absolute -top-1.5 left-1/2 z-10 h-5 w-12 -translate-x-1/2 -rotate-3 tape"
		></span>
	{/if}

	{#if corner !== null}
		<span
			class="absolute -top-2 -left-2 z-10 flex h-7 w-7 items-center justify-center rounded-full
			       border-2 border-black bg-lamp text-sm font-bold text-black"
		>
			{corner}
		</span>
	{/if}

	{#if revealed}
		<!-- Rarity repeated outside the art: the stars printed on the card itself
		     are only a few pixels tall at grid size. -->
		<span class="pointer-events-none absolute right-1.5 bottom-1.5 z-10 flex gap-px">
			{#each rarityStars as n (n)}
				<Sparkle class="w-2.5 text-lamp drop-shadow-[0_1px_2px_rgb(0_0_0/0.95)]" />
			{/each}
		</span>
	{/if}
{/snippet}

<div class="relative w-full" style="--phase: {phaseOf(card.id)}">
	{#if onactivate}
		<button
			type="button"
			onclick={onactivate}
			onpointermove={track}
			onpointerleave={release}
			disabled={muted}
			aria-pressed={revealed ? selected : undefined}
			aria-label={label}
			class="{shell} cursor-pointer"
		>
			{@render body()}
		</button>
	{:else}
		<div class={shell}>
			{@render body()}
		</div>
	{/if}

	{#if onzoom && revealed && !muted}
		<!-- Sibling rather than nested, since the card itself is already a button. -->
		<button
			type="button"
			onclick={onzoom}
			aria-label="{card.display_name.toLowerCase()} — see the whole card"
			class="absolute top-1 right-1 z-20 flex h-7 w-7 items-center justify-center rounded-full
			       border border-white/25 bg-black/65 text-sm leading-none text-chalk
			       backdrop-blur-sm transition-colors hover:bg-black/90"
		>
			⤢
		</button>
	{/if}
</div>

<style>
	.stage {
		perspective: 900px;
	}

	/* Held between finger and thumb: leans towards the pointer. */
	.tilt {
		transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
		transform-style: preserve-3d;
		transition: transform 0.25s ease-out;
	}

	.stage:hover .tilt {
		transition: transform 0.08s linear;
	}

	.turner {
		position: relative;
		transform-style: preserve-3d;
		transition:
			transform 0.5s cubic-bezier(0.3, 0.8, 0.3, 1),
			translate 0.25s ease;
	}

	.turner.is-revealed {
		transform: rotateY(180deg);
	}

	.face {
		backface-visibility: hidden;
	}

	.back {
		background: radial-gradient(ellipse at 50% 35%, #3a3b45, #17171c 70%), var(--color-wall);
	}

	/* Pre-rotated so it lands facing the viewer when the turner reaches 180deg. */
	.face.front {
		transform: rotateY(180deg);
		box-shadow:
			0 0.3rem 0 var(--color-ink),
			0 0.7rem 1rem -0.2rem rgb(0 0 0 / 0.6);
	}

	/* The card catches the lamp as it turns over, then settles. */
	.is-revealed .front {
		animation: catch-the-light 0.9s ease-out 0.25s both;
	}

	@keyframes catch-the-light {
		0% {
			box-shadow:
				0 0 34px 6px rgb(159 220 255 / 0.85),
				0 0.3rem 0 var(--color-ink);
		}
		100% {
			box-shadow:
				0 0 0 0 rgb(159 220 255 / 0),
				0 0.3rem 0 var(--color-ink);
		}
	}

	.stage:is(:hover, :focus-visible) .turner {
		translate: 0 -6px;
	}

	.is-selected .front {
		outline: 3px solid var(--color-lamp);
		outline-offset: -2px;
	}

	.is-muted {
		opacity: 0.25;
		filter: grayscale(1);
		cursor: not-allowed;
	}

	.is-muted .turner {
		translate: none;
	}

	@media (prefers-reduced-motion: reduce) {
		.tilt {
			transform: none;
		}
	}
</style>
