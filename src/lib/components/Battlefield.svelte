<script lang="ts">
	import { SvelteMap } from 'svelte/reactivity';
	import Fighter from './Fighter.svelte';
	import { ELEMENT_COLORS, type FieldCard, type Hit } from '$lib/battle';
	import { MOVES, TIMING, isRanged, type Motion } from '$lib/moves';
	import type { Element } from '$lib/types';

	type Props = {
		player: FieldCard[];
		ai: FieldCard[];
		/** Who is mid-swing, so that card gets lit. */
		actingId?: string | null;
		/** Latest hit per card id. Keyed by id so a card keeps its own number. */
		hits?: Record<string, Hit>;
		/** Shown across the middle between rounds. */
		banner?: string | null;
	};

	let { player, ai, actingId = null, hits = {}, banner = null }: Props = $props();

	/** Slot elements by card id — what a strike measures and moves. */
	const slots = new SvelteMap<string, HTMLElement>();

	let fieldEl = $state<HTMLElement | null>(null);

	/** Something in flight between two slots — a projectile or a beam. */
	type Shot = {
		id: number;
		kind: 'shot' | 'beam';
		tint: string;
		/** Origin, in the field's coordinates. */
		x: number;
		y: number;
		dx: number;
		dy: number;
		angle: number;
		length: number;
		ms: number;
	};

	let shots = $state<Shot[]>([]);
	let shotId = 0;

	function register(node: HTMLElement, id: string) {
		slots.set(id, node);
		return {
			destroy() {
				slots.delete(id);
			}
		};
	}

	const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	/** A slot's middle, in the field's own coordinates. */
	function centre(node: HTMLElement) {
		const box = node.getBoundingClientRect();
		const field = fieldEl!.getBoundingClientRect();
		return {
			x: box.left + box.width / 2 - field.left,
			y: box.top + box.height / 2 - field.top
		};
	}

	/**
	 * Plays one card's move against another and resolves the moment it lands —
	 * not when the animation finishes. The damage has to come off on contact,
	 * and the recovery plays out underneath the next part of the replay.
	 *
	 * Everything is measured off the two slots rather than animated a fixed
	 * distance, so a card on the left of its row visibly crosses the field to
	 * reach someone on the right of theirs.
	 */
	export function strike(
		attackerId: string,
		defenderId: string,
		element: Element,
		speed = 1
	): Promise<void> {
		const attacker = slots.get(attackerId);
		const defender = slots.get(defenderId);
		if (!attacker || !defender || !fieldEl || reduced()) return Promise.resolve();

		const move = MOVES[element];
		const { duration, contact } = TIMING[move.motion];
		const ms = duration / speed;

		const from = centre(attacker);
		const to = centre(defender);
		const dx = to.x - from.x;
		const dy = to.y - from.y;

		if (isRanged(move.motion)) {
			recoil(attacker, dx, dy, ms);
			send(move.motion, from, to, element, ms * contact);
		} else {
			travel(attacker, move.motion, dx, dy, ms);
		}

		if (move.motion === 'slam') shakeField(ms * contact, ms);

		return new Promise((resolve) => setTimeout(resolve, ms * contact));
	}

	/** Carries the attacker across and brings it home. */
	function travel(node: HTMLElement, motion: Motion, dx: number, dy: number, ms: number) {
		// Stops short of the target rather than landing on top of it, so both
		// cards stay readable at the moment of contact.
		const x = dx * 0.62;
		const y = dy * 0.62;

		// Lifted above its neighbours for the whole move, otherwise it travels
		// underneath the cards it passes.
		node.style.zIndex = '30';

		const animation = node.animate(keyframes(motion, x, y, dx, dy), {
			duration: ms,
			easing: 'cubic-bezier(0.3, 0.7, 0.4, 1)',
			fill: 'none'
		});

		animation.finished
			.catch(() => {})
			.finally(() => {
				node.style.zIndex = '';
			});
	}

	function keyframes(motion: Motion, x: number, y: number, dx: number, dy: number): Keyframe[] {
		switch (motion) {
			// Straight in, hang on the hit, straight back.
			case 'lunge':
				return [
					{ transform: 'translate(0, 0) scale(1)', offset: 0 },
					{ transform: `translate(${-x * 0.12}px, ${-y * 0.12}px) scale(1.02)`, offset: 0.22 },
					{ transform: `translate(${x}px, ${y}px) scale(1.1)`, offset: 0.46 },
					{ transform: `translate(${x}px, ${y}px) scale(1.1)`, offset: 0.56 },
					{ transform: 'translate(0, 0) scale(1)', offset: 1 }
				];

			// Straight through and out the other side, then back into the slot.
			case 'dash':
				return [
					{ transform: 'translate(0, 0)', opacity: 1, offset: 0 },
					{ transform: `translate(${-x * 0.18}px, ${-y * 0.18}px)`, opacity: 1, offset: 0.18 },
					{ transform: `translate(${dx * 1.25}px, ${dy * 1.25}px)`, opacity: 0.15, offset: 0.55 },
					{ transform: `translate(${dx * 1.6}px, ${dy * 1.6}px)`, opacity: 0, offset: 0.62 },
					{ transform: 'translate(0, 0)', opacity: 0, offset: 0.63 },
					{ transform: 'translate(0, 0)', opacity: 1, offset: 1 }
				];

			// Up out of the line, then down onto the target from above.
			case 'slam':
				return [
					{ transform: 'translate(0, 0) scale(1)', offset: 0 },
					{ transform: `translate(${x * 0.3}px, ${y * 0.3 - 60}px) scale(1.12)`, offset: 0.34 },
					{ transform: `translate(${x}px, ${y - 55}px) scale(1.15)`, offset: 0.44 },
					{ transform: `translate(${x}px, ${y}px) scale(1.05)`, offset: 0.56 },
					{ transform: `translate(${x}px, ${y}px) scale(1.05)`, offset: 0.66 },
					{ transform: 'translate(0, 0) scale(1)', offset: 1 }
				];

			// Gone from one place, already at the other.
			case 'blink':
				return [
					{ transform: 'translate(0, 0) scale(1)', opacity: 1, filter: 'blur(0)', offset: 0 },
					{
						transform: 'translate(0, 0) scale(0.7)',
						opacity: 0,
						filter: 'blur(6px)',
						offset: 0.28
					},
					{ transform: `translate(${x}px, ${y}px) scale(0.7)`, opacity: 0, offset: 0.42 },
					{ transform: `translate(${x}px, ${y}px) scale(1.12)`, opacity: 1, offset: 0.52 },
					{ transform: `translate(${x}px, ${y}px) scale(1.12)`, opacity: 1, offset: 0.62 },
					{ transform: 'translate(0, 0) scale(0.9)', opacity: 0, offset: 0.72 },
					{ transform: 'translate(0, 0) scale(1)', opacity: 1, offset: 0.86 }
				];

			// Across the field end over end.
			case 'spin':
				return [
					{ transform: 'translate(0, 0) rotate(0) scale(1)', offset: 0 },
					{ transform: `translate(${-x * 0.15}px, ${-y * 0.15}px) rotate(-40deg)`, offset: 0.2 },
					{ transform: `translate(${x}px, ${y}px) rotate(400deg) scale(1.1)`, offset: 0.5 },
					{ transform: `translate(${x}px, ${y}px) rotate(720deg) scale(1.1)`, offset: 0.62 },
					{ transform: 'translate(0, 0) rotate(720deg) scale(1)', offset: 1 }
				];

			default:
				return [{ transform: 'translate(0, 0)' }];
		}
	}

	/** A ranged attacker plants and kicks back against its own shot. */
	function recoil(node: HTMLElement, dx: number, dy: number, ms: number) {
		const length = Math.hypot(dx, dy) || 1;
		const back = 14;

		node.animate(
			[
				{ transform: 'translate(0, 0) scale(1)' },
				{ transform: `translate(0, 0) scale(1.06)`, offset: 0.25 },
				{
					transform: `translate(${(-dx / length) * back}px, ${(-dy / length) * back}px) scale(1.04)`,
					offset: 0.42
				},
				{ transform: 'translate(0, 0) scale(1)' }
			],
			{ duration: ms, easing: 'ease-out' }
		);
	}

	/** Puts a projectile — or a beam — on the field between the two slots. */
	function send(
		motion: Motion,
		from: { x: number; y: number },
		to: { x: number; y: number },
		element: Element,
		travelMs: number
	) {
		const dx = to.x - from.x;
		const dy = to.y - from.y;

		shots = [
			...shots,
			{
				id: ++shotId,
				kind: motion === 'beam' ? 'beam' : 'shot',
				tint: ELEMENT_COLORS[element],
				x: from.x,
				y: from.y,
				dx,
				dy,
				angle: (Math.atan2(dy, dx) * 180) / Math.PI,
				length: Math.hypot(dx, dy),
				ms: travelMs
			}
		];
	}

	/**
	 * Flies a shot the moment it's rendered and clears it once it's spent. The
	 * shots live in state so Svelte owns the elements; only the motion is
	 * imperative, which is the part CSS can't express — the distance isn't known
	 * until the two slots are measured.
	 */
	function launch(node: HTMLElement, shot: Shot) {
		const { dx, dy, angle, ms } = shot;

		const animation =
			shot.kind === 'beam'
				? // Pinned at the attacker, pointed at the target, drawn out to it.
					node.animate(
						[
							{ transform: `rotate(${angle}deg) scaleX(0)`, opacity: 0.2 },
							{ transform: `rotate(${angle}deg) scaleX(1)`, opacity: 1, offset: 0.45 },
							{ transform: `rotate(${angle}deg) scaleX(1)`, opacity: 1, offset: 0.7 },
							{ transform: `rotate(${angle}deg) scaleX(1)`, opacity: 0 }
						],
						{ duration: ms * 1.8, easing: 'ease-out' }
					)
				: node.animate(
						[
							{ transform: `translate(-50%, -50%) rotate(${angle}deg) scale(0.4)`, opacity: 0 },
							{
								transform: `translate(calc(-50% + ${dx * 0.15}px), calc(-50% + ${dy * 0.15}px)) rotate(${angle}deg) scale(1)`,
								opacity: 1,
								offset: 0.15
							},
							{
								transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${angle}deg) scale(1)`,
								opacity: 1,
								offset: 1
							}
						],
						{ duration: ms, easing: 'cubic-bezier(0.4, 0, 0.7, 1)' }
					);

		animation.finished
			.catch(() => {})
			.finally(() => {
				shots = shots.filter((live) => live.id !== shot.id);
			});

		return {
			destroy() {
				animation.cancel();
			}
		};
	}

	/** An anvil landing moves the room, not just the card. */
	function shakeField(delay: number, ms: number) {
		if (!fieldEl) return;

		setTimeout(() => {
			fieldEl?.animate(
				[
					{ transform: 'translate(0, 0)' },
					{ transform: 'translate(-4px, 3px)' },
					{ transform: 'translate(4px, -2px)' },
					{ transform: 'translate(-2px, 1px)' },
					{ transform: 'translate(0, 0)' }
				],
				{ duration: ms * 0.4, easing: 'ease-out' }
			);
		}, delay);
	}
</script>

<div class="field" bind:this={fieldEl}>
	<!-- The far side of the room. Held slightly smaller and pushed back so the
	     two lines read as facing each other rather than as one stacked grid. -->
	<div class="row is-far">
		<span class="tag">theirs</span>
		<div class="line">
			{#each ai as card (card.id)}
				<div class="slot" use:register={card.id}>
					<Fighter {card} side="ai" acting={actingId === card.id} hit={hits[card.id] ?? null} />
				</div>
			{/each}
		</div>
	</div>

	<div class="divider" aria-hidden="true"></div>

	<div class="row is-near">
		<span class="tag">yours</span>
		<div class="line">
			{#each player as card (card.id)}
				<div class="slot" use:register={card.id}>
					<Fighter {card} side="player" acting={actingId === card.id} hit={hits[card.id] ?? null} />
				</div>
			{/each}
		</div>
	</div>

	<!-- Everything in flight. Sits over the cards but under the round banner. -->
	<div class="ordnance" aria-hidden="true">
		{#each shots as shot (shot.id)}
			<span
				class={shot.kind}
				style="left: {shot.x}px; top: {shot.y}px; --tint: {shot.tint};
				       {shot.kind === 'beam' ? `width: ${shot.length}px` : ''}"
				use:launch={shot}
			></span>
		{/each}
	</div>

	{#if banner}
		{#key banner}
			<span class="banner">{banner}</span>
		{/key}
	{/if}
</div>

<style>
	.field {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.9rem 0.7rem 1.1rem;
		border: 0.25rem solid var(--color-ink);
		border-radius: 0.9rem;
		/* The lamps hang over the far side, so the light falls away towards the
		   viewer and the near line sits in the darker half of the room. */
		background:
			radial-gradient(ellipse 70% 55% at 50% 8%, rgb(159 220 255 / 0.16), transparent 70%),
			linear-gradient(180deg, #23242c 0%, #191a20 55%, #121217 100%);
		box-shadow:
			0 0.35rem 0 var(--color-ink),
			0 0.9rem 1.4rem rgb(0 0 0 / 0.45),
			inset 0 0 4rem rgb(0 0 0 / 0.6);
		overflow: hidden;
	}

	.row {
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}

	.line {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		justify-items: center;
		gap: 0.5rem;
		align-items: start;
	}

	/* Depth without a 3D transform, which would have taken the cards' crisp
	   edges with it: the far line is simply smaller and dimmer. */
	.is-far .line {
		transform: scale(0.9);
		transform-origin: top center;
		filter: brightness(0.88) saturate(0.92);
	}

	.is-far {
		padding-inline: 4%;
	}

	.tag {
		font-size: 0.62rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		color: var(--color-wall-lit);
	}

	.is-near .tag {
		color: var(--color-lamp);
	}

	/* The line on the floor between the two sides. */
	.divider {
		height: 0.15rem;
		margin: 0.2rem 0;
		background: linear-gradient(
			90deg,
			transparent,
			rgb(245 245 246 / 0.22) 20%,
			rgb(245 245 246 / 0.22) 80%,
			transparent
		);
	}

	.slot {
		position: relative;
		width: 100%;
		max-width: 11rem;
	}

	.ordnance {
		position: absolute;
		inset: 0;
		z-index: 35;
		pointer-events: none;
	}

	.shot {
		position: absolute;
		width: 2.2rem;
		height: 0.7rem;
		border-radius: 999px;
		background: linear-gradient(90deg, transparent, var(--tint) 45%, #fff);
		box-shadow:
			0 0 0.9rem 0.15rem var(--tint),
			0 0 2rem 0.3rem color-mix(in srgb, var(--tint) 50%, transparent);
	}

	.beam {
		position: absolute;
		height: 0.35rem;
		transform-origin: left center;
		border-radius: 999px;
		background: linear-gradient(90deg, transparent, var(--tint), #fff);
		box-shadow: 0 0 1.2rem 0.2rem var(--tint);
	}

	.banner {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 40;
		transform: translate(-50%, -50%);
		padding: 0.25rem 1.1rem;
		border: 0.22rem solid var(--color-ink);
		border-radius: 0.6rem;
		background: var(--color-lamp);
		color: var(--color-ink);
		font-size: 1.15rem;
		font-weight: 900;
		letter-spacing: -0.05em;
		white-space: nowrap;
		pointer-events: none;
		animation: sweep 0.9s ease-out forwards;
	}

	@keyframes sweep {
		0% {
			transform: translate(-50%, -50%) scale(0.85);
			opacity: 0;
		}
		18% {
			transform: translate(-50%, -50%) scale(1.04);
			opacity: 1;
		}
		72% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -50%) scale(1);
			opacity: 0;
		}
	}

	@media (min-width: 640px) {
		.field {
			gap: 0.9rem;
			padding: 1.3rem 1.4rem 1.6rem;
		}

		.line {
			gap: 1.1rem;
		}

		.is-far {
			padding-inline: 7%;
		}
	}
</style>
