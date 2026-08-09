<script lang="ts">
	import { ELEMENTS, RARITIES, type Odds, type PullOdds } from '$lib/types';

	type Props = {
		/** Where the odds stand now — `odds.current` from the last pull. */
		current: PullOdds;
		/** The odds the very first pull started from, for the drift readout. */
		base: PullOdds | null;
	};

	let { current, base }: Props = $props();

	type Row = { key: string; label: string; now: number; drift: number };

	const pct = (n: number) => Math.round(n * 1000) / 10;

	function rowsFor<K extends string>(keys: readonly K[], now: Odds<K>, was: Odds<K> | null): Row[] {
		return keys.map((key) => ({
			key,
			// Registry keys are snake_case; the cards print them with a space.
			label: key.replace(/_/g, ' '),
			now: now[key] ?? 0,
			drift: was ? (now[key] ?? 0) - (was[key] ?? 0) : 0
		}));
	}

	const widest = (rows: Row[]) => Math.max(...rows.map((row) => row.now));

	// A pull nudges the odds away from whatever it just handed you, so the board
	// drifts between pulls. That drift is the point of the backend's
	// self-adjusting system, and it was previously invisible.
	const rarityRows = $derived(rowsFor(RARITIES, current.rarity, base?.rarity ?? null));
	const elementRows = $derived(rowsFor(ELEMENTS, current.element, base?.element ?? null));
	const rarityPeak = $derived(widest(rarityRows));
	const elementPeak = $derived(widest(elementRows));
</script>

{#snippet meter(row: Row, widest: number)}
	<li class="min-w-0">
		<div class="truncate text-xs font-bold text-chalk/60" title={row.label}>{row.label}</div>

		<div class="mt-1 h-2 overflow-hidden rounded-full border-2 border-ink bg-black/50">
			<!-- Scaled against the biggest in the group, or legendary at 4% would be
			     a single invisible pixel next to common at 50%. The printed number
			     is the actual probability. -->
			<div
				class="h-full rounded-full bg-lamp transition-[width] duration-500"
				style="width: {widest > 0 ? Math.max((row.now / widest) * 100, 3) : 0}%"
			></div>
		</div>

		<div class="mt-1 flex items-baseline gap-1">
			<span class="tabular text-sm font-bold text-chalk">{pct(row.now)}%</span>
			{#if base && Math.abs(row.drift) >= 0.005}
				<span
					class="tabular text-[0.65rem] font-bold"
					class:text-lamp={row.drift > 0}
					class:text-wall-lit={row.drift < 0}
				>
					{row.drift > 0 ? '▲' : '▼'}{Math.abs(pct(row.drift))}
				</span>
			{/if}
		</div>
	</li>
{/snippet}

<section class="space-y-4 panel px-4 py-3.5" aria-label="current odds">
	<div class="flex flex-wrap items-baseline gap-x-2">
		<span class="micro text-chalk/70">odds</span>
		<span class="micro">
			{base ? 'the machine hates giving you the same thing twice' : 'house baseline'}
		</span>
	</div>

	<div>
		<span class="mb-1.5 block micro">rarity</span>
		<ul class="grid grid-cols-5 gap-x-2 gap-y-1 sm:gap-x-4">
			{#each rarityRows as row (row.key)}
				{@render meter(row, rarityPeak)}
			{/each}
		</ul>
	</div>

	<div>
		<span class="mb-1.5 block micro">element</span>
		<ul class="grid grid-cols-3 gap-x-2 gap-y-2.5 sm:grid-cols-5 sm:gap-x-3 lg:grid-cols-9">
			{#each elementRows as row (row.key)}
				{@render meter(row, elementPeak)}
			{/each}
		</ul>
	</div>
</section>
