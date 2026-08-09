<script lang="ts">
	import { onMount } from 'svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { resolve } from '$app/paths';
	import Battlefield from './Battlefield.svelte';
	import BattleLog from './BattleLog.svelte';
	import Sparkle from './Sparkle.svelte';
	import {
		ELEMENT_COLORS,
		effectivenessLabel,
		runBattle,
		type FeedLine,
		type FieldCard,
		type Hit
	} from '$lib/battle';
	import { MOVES } from '$lib/moves';
	import type { BattleCombatant, BattleLogEntry, BattleResult, Element, Item } from '$lib/types';

	type Props = {
		/** The three the player put in the corners. */
		player: Item[];
		/** The seven they left on the floor — the AI draws its three from here. */
		pool: Item[];
		onback: () => void;
	};

	let { player, pool, onback }: Props = $props();

	/**
	 * The bout is settled server-side in one request; everything here is a
	 * replay of the log that came back. Nothing on this screen decides anything,
	 * which is why skipping to the end can just apply the rest of the log.
	 */
	let phase = $state<'loading' | 'error' | 'playing' | 'done'>('loading');
	let paused = $state(false);

	/** Half speed is there to actually watch a move; double is to get through it. */
	const SPEEDS = [1, 2, 0.5] as const;
	let speed = $state<number>(SPEEDS[0]);

	function cycleSpeed() {
		speed = SPEEDS[(SPEEDS.indexOf(speed as (typeof SPEEDS)[number]) + 1) % SPEEDS.length];
	}
	let result = $state<BattleResult | null>(null);

	let side = $state<{ player: FieldCard[]; ai: FieldCard[] }>({ player: [], ai: [] });
	let hits = $state<Record<string, Hit>>({});
	let actingId = $state<string | null>(null);
	let banner = $state<string | null>(null);
	let lines = $state<FeedLine[]>([]);
	let round = $state(0);

	/**
	 * The field's swing animation. Typed structurally rather than as the
	 * component instance — all this needs off `bind:this` is the one method.
	 */
	let field = $state<{
		strike: (
			attackerId: string,
			defenderId: string,
			element: Element,
			speed?: number
		) => Promise<void>;
	} | null>(null);

	/** The battle API deals in ids; the art comes from the pull. */
	const art = $derived(new Map([...player, ...pool].map((item) => [item.id, item.image])));
	const nameOf = (id: string) =>
		[...side.player, ...side.ai].find((card) => card.id === id)?.display_name.toLowerCase() ?? id;

	// Replay bookkeeping. `cursor` is how much of the log is already on the
	// field, so skipping knows where to pick up.
	let cursor = 0;
	/**
	 * Bumped to invalidate whatever is currently playing. Every await in the
	 * replay checks it, so starting over, skipping or unmounting all abandon the
	 * in-flight run instead of racing it.
	 */
	let run = 0;
	const timers = new SvelteSet<ReturnType<typeof setTimeout>>();
	let lineId = 0;

	function clearTimers() {
		for (const id of timers) clearTimeout(id);
		timers.clear();
	}

	function sleep(ms: number) {
		return new Promise<void>((resolve) => {
			const id = setTimeout(() => {
				timers.delete(id);
				resolve();
			}, ms);
			timers.add(id);
		});
	}

	/**
	 * One beat of the replay clock. Scaled by the speed control, and held at the
	 * end while paused — so pausing lands between blows rather than freezing a
	 * card halfway across the field.
	 */
	async function beat(ms: number, token: number) {
		await sleep(ms / speed);
		while (paused && token === run) await sleep(90);
	}

	function push(line: Omit<FeedLine, 'id'>) {
		lines = [...lines, { ...line, id: ++lineId }];
	}

	/** Puts one blow on the field: HP off, flash on, feed line down. */
	function apply(log: BattleLogEntry, animate: boolean) {
		const defender = [...side.player, ...side.ai].find((card) => card.id === log.defenderId);
		if (defender) defender.hp = log.defenderHpAfter;

		if (animate) {
			hits = {
				...hits,
				[log.defenderId]: {
					token: log.step,
					damage: log.totalDamage,
					multiplier: log.multiplier,
					element: log.attackerElement
				}
			};
		}

		const fromPlayer = side.player.some((card) => card.id === log.attackerId);
		push({
			kind: 'hit',
			side: fromPlayer ? 'player' : 'ai',
			move: `${nameOf(log.attackerId)} · ${MOVES[log.attackerElement].name}`,
			text: `${nameOf(log.defenderId)} takes ${log.totalDamage}.`,
			note: effectivenessLabel(log.multiplier),
			tint: ELEMENT_COLORS[log.attackerElement]
		});

		if (log.knockout) {
			push({ kind: 'ko', text: `${nameOf(log.defenderId)} is out.` });
		}

		cursor = log.step;
	}

	const OUTCOMES = {
		player: 'your three took it.',
		ai: 'they took it.',
		draw: 'nobody walked away with it.'
	} as const;

	function finish() {
		if (!result) return;
		actingId = null;
		banner = null;
		phase = 'done';
		push({ kind: 'result', text: OUTCOMES[result.outcome] });
	}

	async function play(token: number) {
		if (!result) return;

		for (const log of result.logs.slice(cursor)) {
			if (token !== run) return;

			if (log.round !== round) {
				round = log.round;
				banner = `round ${log.round}`;
				push({ kind: 'round', text: `round ${log.round}` });
				await beat(760, token);
				if (token !== run) return;
				banner = null;
			}

			actingId = log.attackerId;
			await field?.strike(log.attackerId, log.defenderId, log.attackerElement, speed);
			if (token !== run) return;

			apply(log, true);
			await beat(320, token);
			if (token !== run) return;

			actingId = null;
			// A knockout gets a moment on its own before the next card steps up.
			await beat(log.knockout ? 520 : 140, token);
		}

		if (token === run) finish();
	}

	/** Drops the rest of the log onto the field at once and calls it. */
	function skip() {
		if (!result) return;
		run++;
		clearTimers();
		paused = false;
		actingId = null;
		banner = null;

		for (const log of result.logs.slice(cursor)) {
			if (log.round !== round) {
				round = log.round;
				push({ kind: 'round', text: `round ${log.round}` });
			}
			apply(log, false);
		}

		finish();
	}

	async function start() {
		const token = ++run;
		clearTimers();

		phase = 'loading';
		paused = false;
		cursor = 0;
		round = 0;
		lines = [];
		hits = {};
		actingId = null;
		banner = null;

		try {
			const fought = await runBattle(
				player.map((item) => item.id),
				pool.map((item) => item.id)
			);
			// A second start (or an unmount) landed while this was in flight.
			if (token !== run) return;

			result = fought;
			// The API returns both teams at their final HP; the replay starts them
			// back at full and walks them down again.
			side = {
				player: fought.player.map(toFieldCard),
				ai: fought.ai.map(toFieldCard)
			};

			phase = 'playing';
			// A beat to take in the six of them before anyone swings.
			await beat(600, token);
			await play(token);
		} catch (err) {
			console.error(err);
			if (token === run) phase = 'error';
		}
	}

	function toFieldCard(card: BattleCombatant): FieldCard {
		return { ...card, hp: card.maxHp, image: art.get(card.id) ?? '' };
	}

	const standing = (cards: FieldCard[]) => cards.filter((card) => card.hp > 0).length;

	onMount(() => {
		start();
		return () => {
			run++;
			clearTimers();
		};
	});
</script>

<section class="flex flex-col gap-6 pt-4">
	<div class="text-center">
		<h2 class="text-4xl hard-shadow sm:text-5xl">the ring</h2>
		<p class="mt-3 text-chalk/85 italic">
			your three against three of the seven you left on the floor.
		</p>
	</div>

	{#if phase === 'error'}
		<div class="mx-auto flex max-w-md flex-col items-center gap-5 py-10 text-center">
			<Sparkle class="w-10 text-lamp drop-shadow-[0_0.25rem_0_var(--color-ink)]" />
			<p class="text-lg text-chalk/85 italic">the bell never rang. the machine returned nothing.</p>
			<div class="flex flex-wrap justify-center gap-4">
				<button
					onclick={start}
					class="slab bg-lamp px-7 py-3.5 text-xl text-ink hover:bg-lamp-bright"
				>
					try again
				</button>
				<button onclick={onback} class="slab bg-chalk px-7 py-3.5 text-xl text-ink hover:bg-white">
					← back to the floor
				</button>
			</div>
		</div>
	{:else if phase === 'loading'}
		<p class="py-16 text-center text-lg text-chalk/70 italic">the room is filling up…</p>
	{:else}
		<div class="grid gap-4 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-stretch">
			<Battlefield bind:this={field} player={side.player} ai={side.ai} {actingId} {hits} {banner} />

			<!-- On a phone the feed sits under the field at a fixed height, so the
			     fight itself never gets pushed off the screen by its own commentary.
			     Beside it, the feed is taken out of flow so that a long fight can't
			     stretch the row taller than the field it's narrating. -->
			<div class="h-56 lg:relative lg:h-auto">
				<div class="h-full lg:absolute lg:inset-0">
					<BattleLog {lines} {round} />
				</div>
			</div>
		</div>

		<div class="flex flex-wrap items-center justify-center gap-3">
			{#if phase === 'playing'}
				<button
					onclick={() => (paused = !paused)}
					class="slab bg-wall-lit px-6 py-3 text-lg text-ink hover:bg-chalk"
				>
					{paused ? 'carry on' : 'hold it'}
				</button>

				<button
					onclick={cycleSpeed}
					class="slab bg-wall-lit px-6 py-3 text-lg text-ink hover:bg-chalk"
					aria-label="playback speed, currently {speed} times"
				>
					{speed}×
				</button>

				<button onclick={skip} class="slab bg-chalk px-6 py-3 text-lg text-ink hover:bg-white">
					call it
				</button>
			{:else}
				<span
					class="slab bg-lamp px-7 py-3 text-xl text-ink"
					role="status"
					class:is-loss={result?.outcome === 'ai'}
				>
					{result ? OUTCOMES[result.outcome] : ''}
				</span>

				{#if result?.outcome === 'ai'}
					<div
						class="fixed inset-0 z-50 flex min-h-dvh flex-col items-center justify-center bg-ink px-6 text-center"
					>
						<div class="space-y-2">
							<h2 class="text-6xl hard-shadow sm:text-8xl">you lost.</h2>
							<img src="/loss.png" alt="" class="w-1/2 justify-self-center" />
							<p class="text-lg text-chalk/85 italic sm:text-xl">skill issue</p>
						</div>

						<div class="flex gap-4 m-4">
							<button
								onclick={start}
								class="slab bg-wall-lit px-6 py-3 text-lg text-ink hover:bg-chalk"
							>
								run it again
							</button>

							<button
								onclick={onback}
								class="slab bg-chalk px-6 py-3 text-lg text-ink hover:bg-white"
							>
								← back to the floor
							</button>
						</div>
					</div>
				{/if}

				<button onclick={start} class="slab bg-wall-lit px-6 py-3 text-lg text-ink hover:bg-chalk">
					run it again
				</button>

				<button onclick={onback} class="slab bg-chalk px-6 py-3 text-lg text-ink hover:bg-white">
					← back to the floor
				</button>

				<!-- All the way out, rather than back into the flow. -->
				<a
					href={resolve('/')}
					class="slab bg-chalk px-6 py-3 text-lg text-ink no-underline hover:bg-white"
				>
					go home
				</a>
			{/if}
		</div>

		{#if phase === 'done'}
			<p class="text-center micro">
				{standing(side.player)} of yours left standing · {standing(side.ai)} of theirs · {result?.rounds}
				{result?.rounds === 1 ? 'round' : 'rounds'}
			</p>
		{/if}
	{/if}
</section>

<style>
	/* Losing shouldn't be announced in the same colour as winning. */
	.is-loss {
		background: #ff8f8f;
	}
</style>
