import { describe, expect, it } from 'vitest';
import { items } from './items';
import {
	BASE_ELEMENT_ODDS,
	BASE_RARITY_ODDS,
	DEFAULT_WEIGHTS,
	MAX_WEIGHT,
	adjust,
	baseOdds,
	normalize,
	pull,
	sample,
	unbackedCategories
} from './odds';
import {
	ELEMENTS,
	ELEMENT_WEIGHTS,
	RARITIES,
	RARITY_WEIGHTS,
	type Element,
	type Item,
	type Rarity
} from '$lib/types';

/** The first two registered elements, whatever they currently are. */
const [ELEMENT_A, ELEMENT_B] = ELEMENTS;

/** Deterministic stand-in for Math.random. */
function seeded(seed: number): () => number {
	let state = seed;
	return () => {
		state = (state * 1664525 + 1013904223) % 4294967296;
		return state / 4294967296;
	};
}

describe('normalize', () => {
	it('scales weights to sum to 1', () => {
		expect(normalize({ a: 2, b: 2 })).toEqual({ a: 0.5, b: 0.5 });
	});

	it('falls back to uniform when everything is zero', () => {
		expect(normalize({ a: 0, b: 0, c: 0, d: 0 })).toEqual({ a: 0.25, b: 0.25, c: 0.25, d: 0.25 });
	});
});

describe('adjust', () => {
	it('drops the pulled category and lifts every other one', () => {
		const next = adjust(BASE_RARITY_ODDS, 'common', 0.3);

		expect(next.common).toBeLessThan(BASE_RARITY_ODDS.common);
		expect(next.uncommon).toBeGreaterThan(BASE_RARITY_ODDS.uncommon);
		expect(next.rare).toBeGreaterThan(BASE_RARITY_ODDS.rare);
		expect(next.legendary).toBeGreaterThan(BASE_RARITY_ODDS.legendary);
		expect(sum(next)).toBeCloseTo(1);
	});

	it('lifts commons back up when a rare lands', () => {
		const next = adjust(BASE_RARITY_ODDS, 'rare', 0.5);

		expect(next.rare).toBeLessThan(BASE_RARITY_ODDS.rare);
		expect(next.common).toBeGreaterThan(BASE_RARITY_ODDS.common);
	});

	it('compounds over a run of the same category', () => {
		let odds = BASE_RARITY_ODDS;
		for (let i = 0; i < 5; i++) odds = adjust(odds, 'common', 0.3);

		expect(odds.common).toBeLessThan(0.4);
		expect(odds.legendary).toBeGreaterThan(BASE_RARITY_ODDS.legendary * 2);
	});

	it('leaves the odds untouched at weight 0 and clamps above the max', () => {
		expectOdds(adjust(BASE_RARITY_ODDS, 'common', 0), BASE_RARITY_ODDS);
		expect(adjust(BASE_RARITY_ODDS, 'common', 5).common).toBeCloseTo(
			adjust(BASE_RARITY_ODDS, 'common', MAX_WEIGHT).common
		);
	});
});

describe('sample', () => {
	it('respects the weights', () => {
		const rng = seeded(42);
		const counts = Object.fromEntries(RARITIES.map((r) => [r, 0])) as Record<Rarity, number>;
		for (let i = 0; i < 10_000; i++) counts[sample(BASE_RARITY_ODDS, rng)]++;

		for (const rarity of RARITIES) {
			expect(counts[rarity] / 10_000).toBeCloseTo(BASE_RARITY_ODDS[rarity], 1);
		}
	});

	it('never picks a zeroed category', () => {
		const rng = seeded(7);
		for (let i = 0; i < 100; i++) {
			expect(sample({ a: 0, b: 1 }, rng)).toBe('b');
		}
	});
});

describe('pull', () => {
	it('returns distinct items and the odds on both sides of the pull', () => {
		const result = pull(items, { count: 10, rng: seeded(1) });

		expect(result.items).toHaveLength(10);
		expect(new Set(result.items.map((i) => i.id)).size).toBe(10);
		expect(result.initial).toEqual(baseOdds());
		expect(result.current).not.toEqual(result.initial);
		expect(sum(result.current.rarity)).toBeCloseTo(1);
		expect(sum(result.current.element)).toBeCloseTo(1);
	});

	it('leaves the odds at base when both weights are 0', () => {
		const result = pull(items, { count: 10, weights: { rarity: 0, element: 0 }, rng: seeded(2) });

		expectOdds(result.current.rarity, baseOdds().rarity);
		expectOdds(result.current.element, baseOdds().element);
	});

	it('falls back to the default weight per key when one is omitted', () => {
		const omitted = pull(items, { count: 10, weights: { element: 0.5 }, rng: seeded(8) });
		const spelled = pull(items, {
			count: 10,
			weights: { rarity: DEFAULT_WEIGHTS.rarity, element: 0.5 },
			rng: seeded(8)
		});

		expect(omitted.weights).toEqual({ rarity: DEFAULT_WEIGHTS.rarity, element: 0.5 });
		expectOdds(omitted.current.rarity, spelled.current.rarity);
	});

	it('never lands on a uniform distribution by accident', () => {
		// A NaN weight used to poison the odds into normalize's uniform fallback.
		const result = pull(items, { count: 10, rng: seeded(11) });
		const values = Object.values(result.current.rarity);

		expect(values.every(Number.isFinite)).toBe(true);
		expect(new Set(values).size).toBeGreaterThan(1);
	});

	it('continues from supplied odds', () => {
		const first = pull(items, { count: 5, rng: seeded(3) });
		const second = pull(items, { count: 5, odds: first.current, rng: seeded(4) });

		expect(second.initial).toEqual(first.current);
	});

	it('caps at the pool size', () => {
		expect(pull(items, { count: items.length + 5, rng: seeded(5) }).items).toHaveLength(
			items.length
		);
	});

	it('falls back when no item matches the rolled pairing', () => {
		const pool: Item[] = [
			{
				id: '1',
				display_name: 'A',
				image: '/a.png',
				rarity: RARITIES[0],
				element: ELEMENT_A,
				hp: 100,
				damage: 10
			},
			{
				id: '2',
				display_name: 'B',
				image: '/b.png',
				rarity: RARITIES[RARITIES.length - 1],
				element: ELEMENT_B ?? ELEMENT_A,
				hp: 120,
				damage: 20
			}
		];

		expect(pull(pool, { count: 2, rng: seeded(6) }).items).toHaveLength(2);
	});

	it('pulls rarer items more often as the weight climbs', () => {
		const rare = (weight: number) =>
			pull(items, { count: 10, weights: { rarity: weight }, rng: seeded(9) }).items.filter(
				(i) => i.rarity === 'rare' || i.rarity === 'legendary'
			).length;

		expect(rare(0.9)).toBeGreaterThan(rare(0));
	});
});

describe('category registries', () => {
	it('derives the key lists from the weight registries', () => {
		expect(RARITIES).toEqual(Object.keys(RARITY_WEIGHTS));
		expect(ELEMENTS).toEqual(Object.keys(ELEMENT_WEIGHTS));
	});

	it('derives base odds covering exactly the registered keys', () => {
		expect(Object.keys(BASE_RARITY_ODDS)).toEqual([...RARITIES]);
		expect(Object.keys(BASE_ELEMENT_ODDS)).toEqual([...ELEMENTS]);
		expect(sum(BASE_RARITY_ODDS)).toBeCloseTo(1);
		expect(sum(BASE_ELEMENT_ODDS)).toBeCloseTo(1);
	});

	it('keeps base odds proportional to the registry weights', () => {
		const totalWeight = sum(ELEMENT_WEIGHTS);
		for (const element of ELEMENTS) {
			expect(BASE_ELEMENT_ODDS[element]).toBeCloseTo(ELEMENT_WEIGHTS[element] / totalWeight);
		}
	});

	it('only ever pulls registered categories', () => {
		const result = pull(items, { count: items.length, rng: seeded(12) });

		for (const item of result.items) {
			expect(RARITIES).toContain(item.rarity);
			expect(ELEMENTS).toContain(item.element);
		}
	});
});

describe('unbackedCategories', () => {
	it('reports nothing when every registered category has items', () => {
		expect(unbackedCategories(items)).toEqual({ rarity: [], element: [] });
	});

	it('flags a registered element that no item uses', () => {
		const pool = items.filter((item) => item.element !== ELEMENT_A);
		const missing: Element[] = ELEMENT_A === undefined ? [] : [ELEMENT_A];

		expect(unbackedCategories(pool).element).toEqual(missing);
	});
});

function sum(odds: Record<string, number>): number {
	return Object.values(odds).reduce((total, value) => total + value, 0);
}

/** Normalizing repeatedly drifts in the last bit or two, so compare loosely. */
function expectOdds(actual: Record<string, number>, expected: Record<string, number>): void {
	expect(Object.keys(actual).sort()).toEqual(Object.keys(expected).sort());
	for (const [key, value] of Object.entries(expected)) {
		expect(actual[key]).toBeCloseTo(value, 10);
	}
}
