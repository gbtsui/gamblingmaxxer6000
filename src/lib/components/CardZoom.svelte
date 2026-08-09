<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { Item } from '$lib/types';
	import { elementName, isFoil, phaseOf } from '$lib/cards';
	import Shine from './Shine.svelte';

	let { card, onclose }: { card: Item; onclose: () => void } = $props();

	let held = $state(false);
	let closeButton = $state<HTMLButtonElement | null>(null);

	// Full resolution here, not the grid thumbnail — reading the lore is most of
	// the reason to open a card this big.
	const label = $derived(
		`${card.display_name.toLowerCase()} — ${card.rarity}, ${elementName(card.element)}, ` +
			`${card.hp} hp, ${card.damage} power`
	);

	function track(event: PointerEvent) {
		const el = event.currentTarget as HTMLElement;
		const box = el.getBoundingClientRect();
		const x = (event.clientX - box.left) / box.width;
		const y = (event.clientY - box.top) / box.height;

		held = true;
		el.style.setProperty('--mx', `${x * 100}%`);
		el.style.setProperty('--my', `${y * 100}%`);
		el.style.setProperty('--rx', `${(0.5 - y) * 12}deg`);
		el.style.setProperty('--ry', `${(x - 0.5) * 14}deg`);
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

	$effect(() => {
		closeButton?.focus();

		// The page behind must not scroll while this is up.
		const previous = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previous;
		};
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onclose();
	}}
/>

<!-- Clicking the backdrop closes; the dialog itself stops the click. -->
<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-[#12121a]/88 p-4 backdrop-blur-sm sm:p-8"
	role="dialog"
	aria-modal="true"
	aria-label={label}
	tabindex="-1"
	onclick={onclose}
	onkeydown={() => {}}
	transition:fade={{ duration: 160 }}
>
	<div
		class="stage relative"
		onclick={(event) => event.stopPropagation()}
		onkeydown={() => {}}
		onpointermove={track}
		onpointerleave={release}
		role="presentation"
		style="--phase: {phaseOf(card.id)}"
		transition:scale={{ duration: 200, start: 0.92 }}
	>
		<div class="tilt aspect-card max-h-[86dvh] w-auto">
			<div
				class="relative h-full overflow-hidden rounded-[3%] border-4 border-ink
				       shadow-[0_30px_70px_-20px_rgb(0_0_0/0.95)]"
			>
				<img
					src={card.image}
					alt={label}
					width="750"
					height="1058"
					class="h-full w-full object-cover"
				/>
				<Shine foil={isFoil(card.rarity)} {held} />
			</div>
		</div>

		<button
			bind:this={closeButton}
			type="button"
			onclick={onclose}
			aria-label="close"
			class="absolute -top-4 -right-4 flex h-12 w-12 slab items-center justify-center rounded-full
			       bg-lamp text-2xl text-ink hover:bg-lamp-bright"
		>
			×
		</button>
	</div>
</div>

<style>
	.stage {
		perspective: 1400px;
		height: 86dvh;
	}

	.tilt {
		height: 100%;
		transform: rotateX(var(--rx, 0deg)) rotateY(var(--ry, 0deg));
		transition: transform 0.12s ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.tilt {
			transform: none;
		}
	}
</style>
