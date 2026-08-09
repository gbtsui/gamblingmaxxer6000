<script lang="ts">
	import { thumb } from '$lib/cards';
	import { ELEMENT_COLORS, effectivenessLabel, effectivenessOf, type Hit } from '$lib/battle';
	import { MOVES } from '$lib/moves';
	import type { BattleCombatant } from '$lib/types';

	type Props = {
		card: BattleCombatant & { image: string };
		side: 'player' | 'ai';
		/** Mid-swing. Lifts it out of the line and puts the lamp on it. */
		acting?: boolean;
		hit?: Hit | null;
	};

	let { card, side, acting = false, hit = null }: Props = $props();

	const fainted = $derived(card.hp <= 0);
	const ratio = $derived(card.maxHp > 0 ? Math.max(0, card.hp) / card.maxHp : 0);
	const health = $derived(ratio > 0.5 ? 'ok' : ratio > 0.2 ? 'hurt' : 'critical');
	const tint = $derived(ELEMENT_COLORS[card.element]);
	/** What lands on this card is decided by the element that threw it. */
	const incoming = $derived(hit ? MOVES[hit.element] : null);

	let spriteEl = $state<HTMLElement | null>(null);
	let flashEl = $state<HTMLElement | null>(null);

	/**
	 * The flinch. Driven from script rather than a CSS class because the same
	 * card can be hit twice in a row and a class only animates once — restarting
	 * a keyframe means removing it, forcing a reflow and putting it back, which
	 * is worse than just asking for the animation each time.
	 */
	$effect(() => {
		if (!hit?.token || !spriteEl || !flashEl) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		// Harder hits shake further, so a chip and a haymaker don't read the same.
		const force = effectivenessOf(hit.multiplier) === 'super' ? 10 : 5;
		const away = side === 'player' ? force : -force;

		spriteEl.animate(
			[
				{ transform: 'translate(0, 0) rotate(0)' },
				{ transform: `translate(${away * 0.8}px, ${away * 0.5}px) rotate(${away * 0.12}deg)` },
				{ transform: `translate(${-away * 0.7}px, ${away * -0.3}px) rotate(${-away * 0.1}deg)` },
				{ transform: `translate(${away * 0.4}px, 0) rotate(0)` },
				{ transform: 'translate(0, 0) rotate(0)' }
			],
			{ duration: 280, easing: 'ease-out' }
		);

		flashEl.animate([{ opacity: 0 }, { opacity: 0.72 }, { opacity: 0 }], {
			duration: 320,
			easing: 'ease-out'
		});
	});

	/** Topples out of the line when it goes down, instead of just dimming. */
	$effect(() => {
		if (!fainted || !spriteEl) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

		spriteEl.animate(
			[
				{ transform: 'translateY(0) rotate(0)' },
				{ transform: 'translateY(-8px) rotate(-4deg)', offset: 0.25 },
				{ transform: 'translateY(10px) rotate(-9deg)' }
			],
			{ duration: 520, easing: 'cubic-bezier(0.4, 0, 0.6, 1)', fill: 'forwards' }
		);
	});
</script>

<div class="fighter" class:is-fainted={fainted} class:is-acting={acting} style="--tint: {tint}">
	<div class="sprite" bind:this={spriteEl}>
		<!-- The whole printed card — art, name, stars, power and all. -->
		<div class="frame">
			<img
				src={thumb(card.image)}
				alt={card.display_name}
				width="750"
				height="1058"
				decoding="async"
			/>
			<div class="flash" bind:this={flashEl} aria-hidden="true"></div>

			<!-- Current HP, over the bottom of the card. The printed HP is what it
			     started with, which stops meaning anything once it's been hit. -->
			<div class="hud">
				<div
					class="bar"
					role="meter"
					aria-valuenow={Math.max(0, card.hp)}
					aria-valuemin="0"
					aria-valuemax={card.maxHp}
					aria-label="{card.display_name.toLowerCase()} health"
				>
					<span class="fill is-{health}" style="width: {ratio * 100}%"></span>
				</div>
				<span class="tabular readout">
					{Math.max(0, card.hp)}<span class="of">/{card.maxHp}</span>
				</span>
			</div>
		</div>

		{#if hit && incoming}
			<!-- Coloured by the element that threw the hit, not the one taking it. -->
			{#key hit.token}
				<span
					class="impact is-{incoming.impact}"
					style="--tint: {ELEMENT_COLORS[hit.element]}"
					aria-hidden="true"
				></span>
				<span class="pop">−{hit.damage}</span>
				{#if effectivenessLabel(hit.multiplier)}
					<span class="pop-note" style="--tint: {ELEMENT_COLORS[hit.element]}">
						{effectivenessLabel(hit.multiplier)}
					</span>
				{/if}
			{/key}
		{/if}

		{#if fainted}
			<span class="ko">out</span>
		{/if}
	</div>
</div>

<style>
	.fighter {
		width: 100%;
		transition:
			opacity 0.5s ease,
			filter 0.5s ease;
	}

	.sprite {
		position: relative;
	}

	.frame {
		position: relative;
		aspect-ratio: var(--aspect-card);
		overflow: hidden;
		border: 0.2rem solid var(--color-ink);
		border-radius: 5%;
		background: var(--color-night);
		box-shadow:
			0 0.25rem 0 var(--color-ink),
			0 0.5rem 0.8rem rgb(0 0 0 / 0.45);
	}

	.frame img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.flash {
		position: absolute;
		inset: 0;
		opacity: 0;
		background: #ff2d2d;
		mix-blend-mode: hard-light;
	}

	.hud {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		display: flex;
		align-items: center;
		gap: 0.3rem;
		padding: 0.55rem 0.35rem 0.3rem;
		background: linear-gradient(180deg, transparent, rgb(0 0 0 / 0.85) 55%);
	}

	.bar {
		flex: 1;
		height: 0.45rem;
		border: 0.11rem solid var(--color-ink);
		border-radius: 999px;
		background: rgb(0 0 0 / 0.7);
		overflow: hidden;
	}

	.fill {
		display: block;
		height: 100%;
		/* Slower than the hit itself, so the bar is still draining as the next
		   card steps up — the way a health bar does when you watch a fight. */
		transition:
			width 0.45s cubic-bezier(0.3, 0.8, 0.3, 1),
			background 0.45s ease;
	}

	.fill.is-ok {
		background: #7ce08a;
	}

	.fill.is-hurt {
		background: #ffd166;
	}

	.fill.is-critical {
		background: #ff5a5a;
	}

	.readout {
		font-size: 0.6rem;
		font-weight: 900;
		letter-spacing: -0.03em;
		color: var(--color-chalk);
		text-shadow: 0 1px 2px rgb(0 0 0 / 0.9);
	}

	.of {
		color: rgb(245 245 246 / 0.45);
	}

	/* Lit in its own element's colour — reads as "this one is swinging". */
	.is-acting .frame {
		outline: 0.15rem solid var(--tint);
		outline-offset: -0.15rem;
		box-shadow:
			0 0.25rem 0 var(--color-ink),
			0 0 1.8rem 0.15rem color-mix(in srgb, var(--tint) 70%, transparent);
	}

	.is-fainted {
		opacity: 0.4;
		filter: grayscale(1) brightness(0.6);
	}

	/*
	 * One impact per move family. They all start at the point of contact and
	 * clear themselves within half a second, so a card that gets hit twice in a
	 * row never stacks two of them.
	 */
	.impact {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	/* A ring thrown out from the middle. */
	.impact.is-burst {
		inset: 12%;
		border-radius: 999px;
		border: 0.3rem solid var(--tint);
		background: radial-gradient(
			circle,
			color-mix(in srgb, var(--tint) 55%, transparent),
			transparent 65%
		);
		animation: burst 0.45s cubic-bezier(0.2, 0.8, 0.3, 1) forwards;
	}

	@keyframes burst {
		0% {
			transform: scale(0.3);
			opacity: 1;
		}
		100% {
			transform: scale(1.6);
			opacity: 0;
		}
	}

	/* Two cuts across the card. */
	.impact.is-slash {
		background:
			linear-gradient(66deg, transparent 44%, #fff 47%, var(--tint) 50%, transparent 54%),
			linear-gradient(52deg, transparent 56%, var(--tint) 60%, transparent 64%);
		animation: slash 0.4s ease-out forwards;
	}

	@keyframes slash {
		0% {
			clip-path: inset(0 100% 0 0);
			opacity: 1;
		}
		45% {
			clip-path: inset(0 0 0 0);
			opacity: 1;
		}
		100% {
			clip-path: inset(0 0 0 0);
			opacity: 0;
		}
	}

	/* The card behind cracked glass. */
	.impact.is-shatter {
		background:
			linear-gradient(28deg, transparent 47%, var(--tint) 49%, transparent 51%),
			linear-gradient(-52deg, transparent 40%, var(--tint) 42%, transparent 44%),
			linear-gradient(88deg, transparent 62%, var(--tint) 64%, transparent 66%),
			radial-gradient(
				circle at 50% 45%,
				color-mix(in srgb, var(--tint) 45%, transparent),
				transparent 55%
			);
		animation: shatter 0.5s ease-out forwards;
	}

	@keyframes shatter {
		0% {
			transform: scale(1.25);
			opacity: 0;
		}
		25% {
			transform: scale(1);
			opacity: 1;
		}
		100% {
			transform: scale(1);
			opacity: 0;
		}
	}

	/* A flat wave rolling out from the point of contact. */
	.impact.is-shock {
		inset: 20% 0;
		border-radius: 50%;
		border: 0.3rem solid var(--tint);
		border-inline-color: transparent;
		animation: shock 0.42s cubic-bezier(0.15, 0.75, 0.35, 1) forwards;
	}

	@keyframes shock {
		0% {
			transform: scale(0.2);
			opacity: 1;
		}
		100% {
			transform: scale(2.1);
			opacity: 0;
		}
	}

	/* Wound up and pulled inwards. */
	.impact.is-spiral {
		inset: 15%;
		border-radius: 999px;
		border: 0.25rem dashed var(--tint);
		animation: spiral 0.55s ease-in forwards;
	}

	@keyframes spiral {
		0% {
			transform: scale(1.7) rotate(0);
			opacity: 0;
		}
		30% {
			transform: scale(1.1) rotate(140deg);
			opacity: 1;
		}
		100% {
			transform: scale(0.2) rotate(420deg);
			opacity: 0;
		}
	}

	.pop,
	.pop-note {
		position: absolute;
		left: 50%;
		pointer-events: none;
		font-weight: 900;
		letter-spacing: -0.05em;
		white-space: nowrap;
		text-shadow:
			0 0.13rem 0 var(--color-ink),
			0 0 0.6rem rgb(0 0 0 / 0.9);
		animation: rise 0.95s ease-out forwards;
	}

	.pop {
		top: 22%;
		font-size: 1.6rem;
		color: #ff6b6b;
	}

	.pop-note {
		top: 46%;
		font-size: 0.7rem;
		color: var(--tint);
		animation-delay: 0.1s;
	}

	@keyframes rise {
		0% {
			transform: translate(-50%, 0.5rem) scale(0.7);
			opacity: 0;
		}
		22% {
			transform: translate(-50%, -0.3rem) scale(1.12);
			opacity: 1;
		}
		100% {
			transform: translate(-50%, -1.9rem) scale(1);
			opacity: 0;
		}
	}

	.ko {
		position: absolute;
		top: 45%;
		left: 50%;
		transform: translate(-50%, -50%) rotate(-9deg);
		padding: 0.1rem 0.7rem;
		border: 0.2rem solid var(--color-ink);
		border-radius: 0.3rem;
		background: #ff5a5a;
		color: var(--color-ink);
		font-size: 0.85rem;
		font-weight: 900;
		letter-spacing: -0.04em;
	}
</style>
