import { describe, expect, it } from 'vitest';
import { executeBattle, toBattleCard } from './damage';
import { items } from './items';
import { ELEMENTS, type BattleCard } from '$lib/types';

const [ELEMENT_A, ELEMENT_B] = ELEMENTS;

/** Deterministic stand-in for Math.random. */
function seeded(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1103515245 + 12345) % 2147483648;
		return state / 2147483648;
	};
}

function card(id: string, overrides: Partial<BattleCard> = {}): BattleCard {
	return { id, display_name: id, element: ELEMENT_A, hp: 100, damage: 25, ...overrides };
}

const team = (...ids: string[]) => ids.map((id) => card(id));

describe('executeBattle', () => {
	it('leaves the caller’s cards untouched', () => {
		const player = team('p1', 'p2', 'p3');
		const pool = team('a1', 'a2', 'a3', 'a4');

		executeBattle(player, pool, { rng: seeded(1) });

		expect(player.every((c) => c.hp === 100)).toBe(true);
		expect(pool.every((c) => c.hp === 100)).toBe(true);
	});

	it('draws the AI team from the pool and never from the player', () => {
		const player = team('p1', 'p2', 'p3');
		const pool = team('a1', 'a2', 'a3', 'a4', 'a5', 'a6', 'a7');

		const result = executeBattle(player, pool, { rng: seeded(2) });

		expect(result.ai).toHaveLength(3);
		expect(result.ai.every((c) => c.id.startsWith('a'))).toBe(true);
		expect(new Set(result.ai.map((c) => c.id)).size).toBe(3);
	});

	it('lets both sides attack', () => {
		const player = team('p1', 'p2', 'p3');
		const pool = team('a1', 'a2', 'a3');

		const { logs } = executeBattle(player, pool, { rng: seeded(3) });
		const attackers = new Set(logs.map((entry) => entry.attackerId[0]));

		expect(attackers).toEqual(new Set(['p', 'a']));
	});

	it('only ever hits the opposing side', () => {
		const player = team('p1', 'p2', 'p3');
		const pool = team('a1', 'a2', 'a3');

		const { logs } = executeBattle(player, pool, { rng: seeded(4) });

		expect(logs.every((entry) => entry.attackerId[0] !== entry.defenderId[0])).toBe(true);
	});

	it('applies the element multiplier and clamps HP at zero', () => {
		const player = [card('p1', { element: ELEMENT_A, damage: 1000 })];
		const pool = [card('a1', { element: ELEMENT_B ?? ELEMENT_A, hp: 10 })];

		const { logs, outcome } = executeBattle(player, pool, { rng: seeded(5) });
		const first = logs[0];

		expect(first.totalDamage).toBe(Math.round(first.baseDamage * first.multiplier));
		expect(first.defenderHpAfter).toBe(0);
		expect(first.knockout).toBe(true);
		expect(outcome).toBe('player');
	});

	it('numbers log steps consecutively from 1', () => {
		const { logs } = executeBattle(team('p1', 'p2', 'p3'), team('a1', 'a2', 'a3'), {
			rng: seeded(6)
		});

		expect(logs.map((entry) => entry.step)).toEqual(logs.map((_, i) => i + 1));
	});

	it('reports the losing side when the player is outgunned', () => {
		const player = [card('p1', { hp: 1, damage: 1 })];
		const pool = [card('a1', { hp: 10_000, damage: 10_000 })];

		expect(executeBattle(player, pool, { rng: seeded(7) }).outcome).toBe('ai');
	});

	it('records maxHp so a survivor’s remaining HP can be read off the result', () => {
		const result = executeBattle(team('p1', 'p2', 'p3'), team('a1', 'a2', 'a3'), {
			rng: seeded(8)
		});

		for (const combatant of [...result.player, ...result.ai]) {
			expect(combatant.maxHp).toBe(100);
			expect(combatant.hp).toBeLessThanOrEqual(combatant.maxHp);
			expect(combatant.hp).toBeGreaterThanOrEqual(0);
		}
	});

	it('resolves a battle between real items from the CSV', () => {
		const cards = items.map(toBattleCard);
		const result = executeBattle(cards.slice(0, 3), cards.slice(3), { rng: seeded(9) });

		expect(result.outcome).not.toBe('draw');
		expect(result.logs.length).toBeGreaterThan(0);
		expect(result.rounds).toBeGreaterThan(0);
	});
});
