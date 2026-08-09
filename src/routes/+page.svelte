<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	/**
	 * The strip is laid down twice back to back. The scroll animation travels
	 * exactly one copy's width and restarts, so the seam never shows and the
	 * second copy costs nothing to load — it's the same eight files.
	 */
	const strip = $derived([...data.strip, ...data.strip]);
</script>

<svelte:head>
	<title>Gamblingmaxxer</title>
</svelte:head>

<main class="menu">
	<div class="card-row" aria-hidden="true">
		<div class="card-track">
			{#each strip as image, index (index)}
				<!-- Decorative and well behind the mascot, so it loads at low priority
				     rather than competing with the logo. -->
				<img src={image} alt="" width="750" height="1058" decoding="async" fetchpriority="low" />
			{/each}
		</div>
	</div>

	<section class="menu-content">
		<img class="logo" src="/logo.png" alt="Gamblingmaxxer" />
		<a href={resolve('/play')} class="menu-button">let's go gambling</a>
		<p>did you know that 99.9% of gamblers quit before they hit it big?</p>
	</section>

	<img class="grimble" src="/grimble.png" alt="grimble (Gamblingmaxxer mascot)s" />
</main>

<style>
	.menu {
		isolation: isolate;
		position: relative;
		display: grid;
		min-height: 100vh;
		place-items: center;
		overflow: hidden;
		background-color: #292930;
		background-image:
			linear-gradient(rgb(255 255 255 / 0.08) 1px, transparent 1px),
			linear-gradient(90deg, rgb(255 255 255 / 0.08) 1px, transparent 1px),
			radial-gradient(circle at 70% 48%, rgb(76 78 91 / 0.55), transparent 35rem);
		background-size:
			7.2rem 7.2rem,
			7.2rem 7.2rem,
			auto;
	}

	.menu-content {
		z-index: 2;
		display: flex;
		width: min(45rem, 88vw);
		flex-direction: column;
		align-items: flex-start;
		gap: clamp(1.7rem, 4vw, 3rem);
		transform: translateX(-11vw);
	}

	.logo {
		width: min(100%, 44rem);
		filter: drop-shadow(0 0.8rem 0 #050505);
	}

	.menu-button {
		border: 0.45rem solid #050505;
		border-radius: 1.75rem;
		padding: clamp(1.2rem, 3vw, 2rem) clamp(2.2rem, 6vw, 4.3rem);
		background: #9fdcff;
		box-shadow:
			0 0.65rem 0 #050505,
			0 1.25rem 1.3rem rgb(0 0 0 / 0.35);
		color: #050505;
		font-family: Helvetica, Arial, sans-serif;
		font-size: clamp(2rem, 5vw, 4.5rem);
		font-weight: 900;
		letter-spacing: -0.06em;
		line-height: 1;
		text-decoration: none;
		transition:
			transform 160ms ease,
			box-shadow 160ms ease,
			background 160ms ease;
	}

	.menu-button:hover {
		transform: translateY(-0.2rem) rotate(-1deg) scale(1.03);
		background: #c3ebff;
		box-shadow:
			0 0.85rem 0 #050505,
			0 1.5rem 1.5rem rgb(0 0 0 / 0.4);
	}

	.menu-button:active {
		transform: translateY(0.45rem);
		box-shadow: 0 0.2rem 0 #050505;
	}

	.menu-button:focus-visible {
		outline: 0.25rem solid white;
		outline-offset: 0.4rem;
	}

	.menu-content p {
		margin: -1rem 0 0 1.8rem;
		color: #f5f5f6;
		font-family: Helvetica, Arial, sans-serif;
		font-size: clamp(0.82rem, 1.45vw, 1.25rem);
		font-style: italic;
	}

	.grimble {
		z-index: 1;
		position: absolute;
		right: max(-3rem, 4vw);
		bottom: 0rem;
		width: min(47vw, 43rem);
		filter: drop-shadow(0 0.7rem 0 #050505) drop-shadow(0 1.5rem 1.5rem rgb(0 0 0 / 0.3));
	}

	.card-row {
		z-index: 0;
		position: absolute;
		right: -6rem;
		bottom: -6rem;
		left: -6rem;
		overflow: hidden;
		opacity: 0.28;
		transform: rotate(-1.5deg);
	}

	/*
	 * Drifts left forever. The travel is one copy of the strip — half the track,
	 * less half a gap, since the two copies have a gap between them as well as
	 * inside them — which puts copy two exactly where copy one started.
	 */
	.card-track {
		display: flex;
		width: max-content;
		gap: 1rem;
		animation: drift 48s linear infinite;
	}

	@keyframes drift {
		to {
			transform: translateX(calc(-50% - 0.5rem));
		}
	}

	.card-row img {
		width: 10rem;
		height: auto;
		box-shadow: 0 0.6rem 1rem rgb(0 0 0 / 0.45);
	}

	@media (max-width: 720px) {
		.menu-content {
			width: 90vw;
			align-items: center;
			transform: none;
		}
		.menu-content p {
			margin-left: 0;
			text-align: center;
		}
		.grimble {
			right: -8rem;
			width: 79vw;
			opacity: 0.72;
		}
		.card-row {
			left: -15rem;
			opacity: 0.18;
		}
	}
</style>
