<script lang="ts">
	import { fly } from 'svelte/transition';
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import { pullItems } from '$lib/items';
	import { TEAM_SIZE, type Item, type PullOdds } from '$lib/types';
	import BattleScreen from '$lib/components/BattleScreen.svelte';
	import Card from '$lib/components/Card.svelte';
	import CardZoom from '$lib/components/CardZoom.svelte';
	import OddsBoard from '$lib/components/OddsBoard.svelte';
	import Sparkle from '$lib/components/Sparkle.svelte';

	let mode = $state<'PULL' | 'DECK' | 'RING'>('PULL');

	let isPulling = $state(false);
	let error = $state<string | null>(null);
	let pulled = $state<Item[]>([]);
	const revealed = new SvelteSet<string>();
	const selected = new SvelteSet<string>();

	/** Where the odds stand now. Fed back in so the drift carries between pulls. */
	let odds = $state<PullOdds | null>(null);
	/** The house baseline, captured from the first pull, for the drift readout. */
	let baseOdds = $state<PullOdds | null>(null);

	const dealing = $derived(pulled.length > 0 && revealed.size < pulled.length);
	const ready = $derived(selected.size === TEAM_SIZE);
	const corners = $derived(
		Array.from({ length: TEAM_SIZE }, (_, i) => pulled.find((c) => c.id === [...selected][i]))
	);

	/** The corners, once all three are filled — what goes into the ring. */
	const team = $derived(corners.filter((card): card is Item => card !== undefined));
	/** Everything left on the floor. The AI draws its three from here. */
	const floor = $derived(pulled.filter((card) => !selected.has(card.id)));

	// Cards turn themselves over one after another. Waiting for someone to
	// discover that a card is clickable is a worse first thirty seconds than
	// just dealing them out; clicking now only skips ahead.
	let timer: ReturnType<typeof setTimeout> | null = null;

	let excludedCards = $state<string[]>([]);

	if (typeof window !== 'undefined') {
		(window as any).excludeCard = (cardId: string) => {
			if (!excludedCards.includes(cardId)) {
				excludedCards = [...excludedCards, cardId];
				console.log(`Excluded: ${cardId}`);
				console.log('Current exclusions:', excludedCards);
			}
		};

		(window as any).removeExclusion = (cardId: string) => {
			excludedCards = excludedCards.filter(id => id !== cardId);
			console.log(`Removed exclusion: ${cardId}`);
			console.log('Current exclusions:', excludedCards);
		};

		(window as any).clearExclusions = () => {
			excludedCards = [];
			console.log('All exclusions cleared');
		};

		(window as any).showExclusions = () => {
			console.log('Excluded cards:', excludedCards);
			return excludedCards;
		};
	}


	function stopDealing() {
		if (timer) clearTimeout(timer);
		timer = null;
	}

	function dealOutFrom(i: number) {
		if (i >= pulled.length) return stopDealing();
		revealed.add(pulled[i].id);
		timer = setTimeout(() => dealOutFrom(i + 1), 230);
	}

	function turnAllOver() {
		stopDealing();
		for (const card of pulled) revealed.add(card.id);
	}

	$effect(() => stopDealing);

	async function pull() {
		if (isPulling) return;
		stopDealing();
		isPulling = true;
		error = null;
		revealed.clear();
		selected.clear();
		pulled = [];

		try {
			const data = await pullItems({ odds: odds ?? undefined });

			pulled = data.items;
			odds = data.odds.current;
			baseOdds ??= data.odds.initial;

			timer = setTimeout(() => dealOutFrom(0), 500);
		} catch (err) {
			console.error(err);
			error = 'the machine returned nothing.';
		} finally {
			isPulling = false;
		}
	}

	function toggleCorner(id: string) {
		if (selected.has(id)) selected.delete(id);
		else if (selected.size < TEAM_SIZE) selected.add(id);
	}

	let zoomed = $state<Item | null>(null);
	let returnFocusTo: HTMLElement | null = null;

	function zoom(card: Item) {
		returnFocusTo = document.activeElement as HTMLElement | null;
		zoomed = card;
	}

	function closeZoom() {
		zoomed = null;
		returnFocusTo?.focus();
		returnFocusTo = null;
	}
</script>

<!-- The wall photo carries its own lamps and vignette, so the only layer over
     it is a little extra falloff at the edges. -->
<div class="relative min-h-dvh">
	<div class="pointer-events-none fixed inset-0 z-0 room-ground" aria-hidden="true"></div>
	<div class="pointer-events-none fixed inset-0 z-0 vignette" aria-hidden="true"></div>

	<div class="relative z-10 flex min-h-dvh flex-col text-chalk">
		<header class="mx-auto flex w-full max-w-6xl items-center gap-2.5 px-4 py-5 sm:px-6">
			<!-- The wordmark is the way back out to the front door. -->
			<a
				href={resolve('/')}
				class="flex items-center gap-2.5 transition-colors hover:text-lamp"
				aria-label="back to the menu"
			>
				<Sparkle class="w-6 shrink-0 text-lamp drop-shadow-[0_0.2rem_0_var(--color-ink)]" />
				<span class="text-xl font-black tracking-[-0.055em]">gamblingmaxxer6000</span>
			</a>
			<span class="ml-auto micro">set 297</span>
		</header>

		<main class="mx-auto w-full max-w-6xl flex-1 px-4 pb-12 sm:px-6">
			{#if mode === 'PULL'}
				<section class="flex flex-col items-center gap-8 text-center">
					<div class="pt-4">
						<h2 class="text-4xl hard-shadow sm:text-6xl">ten come out. three go in.</h2>
					</div>

					<button
						onclick={pull}
						disabled={isPulling}
						class="slab bg-lamp px-10 py-5 text-3xl text-ink hover:bg-lamp-bright
						       disabled:cursor-wait disabled:opacity-60 sm:px-14 sm:py-6 sm:text-5xl"
					>
						{isPulling ? 'pulling' : 'pull ×10'}
					</button>

					{#if error}
						<p class="text-sm font-bold text-lamp" role="alert">{error} pull again.</p>
					{/if}

					{#if pulled.length > 0}
						<!-- The night's sheet, taped to the wall. -->
						<div class="relative w-full" transition:fly={{ y: 16, duration: 350 }}>
							<span class="absolute -top-2 left-8 z-20 h-6 w-16 -rotate-6 tape"></span>
							<span class="absolute -top-2 right-8 z-20 h-6 w-16 rotate-3 tape"></span>

							<div class="panel px-3 py-5 sm:px-5">
								<div class="mb-4 flex items-center justify-between gap-3">
									<span class="micro">{revealed.size} of {pulled.length} turned over</span>
									{#if dealing}
										<button
											onclick={turnAllOver}
											class="micro text-chalk/70! underline underline-offset-4 hover:text-lamp!"
										>
											show me all of them
										</button>
									{/if}
								</div>

								<ul class="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-5">
									{#each pulled as card, i (card.id)}
										<li in:fly={{ y: 24, duration: 380, delay: i * 40 }}>
											<!-- While they're still landing a tap skips ahead; once
											     they're all up, a tap opens the card. -->
											<Card
												{card}
												revealed={revealed.has(card.id)}
												onactivate={() => (dealing ? turnAllOver() : zoom(card))}
												action={dealing ? 'turn them all over' : 'see the whole card'}
											/>
										</li>
									{/each}
								</ul>
							</div>
						</div>

						<button
							onclick={() => (mode = 'DECK')}
							class="slab bg-chalk px-9 py-4 text-2xl text-ink hover:bg-white sm:text-3xl"
						>
							pick three →
						</button>
					{/if}

					{#if odds}
						<div class="w-full max-w-3xl text-left">
							<OddsBoard current={odds} base={baseOdds} />
						</div>
					{/if}
				</section>
			{:else if mode === 'DECK'}
				<section class="flex flex-col gap-9 pt-4">
					<div class="text-center">
						<h2 class="text-4xl hard-shadow sm:text-5xl">pick three</h2>
						<p class="mt-3 text-chalk/85 italic">
							the other seven stay on the floor. one of these three is yours to keep.
						</p>
					</div>

					<div class="mx-auto grid w-full max-w-2xl grid-cols-3 gap-4 sm:gap-6">
						{#each corners as card, i (i)}
							<div class="space-y-2">
								<span class="block text-center micro">corner {i + 1}</span>

								{#if card}
									<Card
										{card}
										selected
										corner={i + 1}
										onactivate={() => toggleCorner(card.id)}
										action="take out of the corner"
										onzoom={() => zoom(card)}
									/>
								{:else}
									<div
										class="flex aspect-card items-center justify-center rounded-[6%]
										       border-4 border-dashed border-ink/70 bg-black/25"
									>
										<Sparkle class="w-1/4 text-white/15" />
									</div>
								{/if}
							</div>
						{/each}
					</div>

					<div>
						<span class="mb-3 block micro">on the floor</span>
						<ul class="grid grid-cols-3 gap-3 sm:grid-cols-5 sm:gap-5">
							{#each pulled as card (card.id)}
								<li>
									<!-- Picking is the job on this screen, so a tap does that and
									     the corner button is what opens the card. -->
									<Card
										{card}
										selected={selected.has(card.id)}
										muted={ready && !selected.has(card.id)}
										onactivate={() => toggleCorner(card.id)}
										action={selected.has(card.id) ? 'take out of the corner' : 'put in a corner'}
										onzoom={() => zoom(card)}
									/>
								</li>
							{/each}
						</ul>
					</div>

					<div class="flex flex-wrap items-center justify-center gap-5">
						<button
							onclick={() => (mode = 'PULL')}
							class="slab bg-wall-lit px-7 py-3.5 text-xl text-ink hover:bg-chalk"
						>
							← pull again
						</button>

						<button
							onclick={() => (mode = 'RING')}
							disabled={!ready}
							class="slab px-9 py-3.5 text-2xl text-ink
							       {ready ? 'bg-lamp hover:bg-lamp-bright' : 'cursor-not-allowed bg-wall-lit/40 text-chalk/40'}"
						>
							{ready ? 'send them in' : `${selected.size} of ${TEAM_SIZE} picked`}
						</button>
					</div>
				</section>
			{:else}
				<BattleScreen player={team} pool={floor} onback={() => (mode = 'DECK')} />
			{/if}
		</main>

		<footer class="mx-auto w-full max-w-6xl px-4 pb-8 sm:px-6">
			<p class="text-center micro">gamblingmaxxer6000 · set 297 · art by kat wang</p>
		</footer>
	</div>
</div>

{#if zoomed}
	<CardZoom card={zoomed} onclose={closeZoom} />
{/if}
