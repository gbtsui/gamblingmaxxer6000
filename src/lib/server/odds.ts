import {
	ELEMENTS,
	ELEMENT_WEIGHTS,
	RARITIES,
	RARITY_WEIGHTS,
	type Element,
	type Item,
	type Odds,
	type PullOdds,
	type PullWeights,
	type Rarity
} from '$lib/types';

export type PullOptions = {
	count: number;
	weights?: Partial<PullWeights>;
	odds?: PullOdds;
	exclude?: string[];  // Add this
	rng?: () => number;
};

// Derived from the registries in $lib/types, so editing a registry is the only
// change needed to add, remove or re-weight a category.
export const BASE_RARITY_ODDS: Odds<Rarity> = normalize(RARITY_WEIGHTS);
export const BASE_ELEMENT_ODDS: Odds<Element> = normalize(ELEMENT_WEIGHTS);

export const DEFAULT_WEIGHTS: PullWeights = { rarity: 0.3, element: 0.3 };

/**
 * A weight of 1 would zero a category out permanently — nothing can ever lift
 * it back off zero — so the knob stops just short of that.
 */
export const MAX_WEIGHT = 0.95;

export function baseOdds(): PullOdds {
	return { rarity: { ...BASE_RARITY_ODDS }, element: { ...BASE_ELEMENT_ODDS } };
}

/** Scales odds so they sum to 1. Falls back to uniform if every weight is 0. */
export function normalize<K extends string>(odds: Odds<K>): Odds<K> {
	const keys = Object.keys(odds) as K[];
	const total = keys.reduce((sum, key) => sum + Math.max(0, odds[key]), 0);

	const result = {} as Odds<K>;
	for (const key of keys) {
		result[key] = total > 0 ? Math.max(0, odds[key]) / total : 1 / keys.length;
	}
	return result;
}

/**
 * Shrinks the pulled category by `weight` and hands the freed probability to
 * everything else, in proportion to what each already had. Pull a lot of
 * commons and uncommon/rare/legendary all climb; pull a rare and everything
 * else — commons included — climbs instead.
 */
export function adjust<K extends string>(
	odds: Odds<K>,
	// NoInfer so a literal key doesn't narrow K out from under the odds object.
	pulled: NoInfer<K>,
	weight: number
): Odds<K> {
	// A non-finite weight would turn every probability into NaN, and normalize
	// would quietly hand back a uniform distribution. Treat it as "no change".
	const clamped = Number.isFinite(weight) ? Math.min(Math.max(weight, 0), MAX_WEIGHT) : 0;
	return normalize({ ...odds, [pulled]: odds[pulled] * (1 - clamped) });
}

/** Picks a category by weight. */
export function sample<K extends string>(odds: Odds<K>, rng: () => number = Math.random): K {
	const keys = Object.keys(odds) as K[];
	let roll = rng() * keys.reduce((sum, key) => sum + Math.max(0, odds[key]), 0);

	for (const key of keys) {
		roll -= Math.max(0, odds[key]);
		if (roll <= 0) return key;
	}
	return keys[keys.length - 1];
}

export type PullResult = {
	items: Item[];
	initial: PullOdds;
	current: PullOdds;
	weights: PullWeights;
};

/**
 * Draws `count` distinct items. Each draw rolls a rarity and an element off the
 * current odds, takes a matching item, then nudges both sets of odds away from
 * what it landed on so the next draw leans elsewhere.
 */
export function pull(pool: readonly Item[], options: PullOptions): PullResult {
	const { count, exclude, rng = Math.random } = options;
	// Key by key, not by spread: a `{ rarity: undefined }` from an omitted query
	// param would otherwise clobber the default rather than fall back to it.
	const weights: PullWeights = {
		rarity: options.weights?.rarity ?? DEFAULT_WEIGHTS.rarity,
		element: options.weights?.element ?? DEFAULT_WEIGHTS.element
	};
	const initial: PullOdds = options.odds
		? { rarity: normalize(options.odds.rarity), element: normalize(options.odds.element) }
		: baseOdds();

	let odds: PullOdds = { rarity: { ...initial.rarity }, element: { ...initial.element } };

	// Filter out excluded items from the pool
	const remaining = [...pool].filter(item =>
		!exclude || exclude.length === 0 || !exclude.includes(item.id) // Assuming items have an 'id' field
	);

	const items: Item[] = [];

	for (let i = 0; i < count && remaining.length > 0; i++) {
		const wantRarity = sample(odds.rarity, rng);
		const wantElement = sample(odds.element, rng);

		// The pool may hold no item for a given pairing — especially late in a
		// pull, once the good matches are used up. Relax the constraints in
		// order rather than ending the pull short.
		const candidates =
			pickMatches(
				remaining,
				(item) => item.rarity === wantRarity && item.element === wantElement
			) ??
			pickMatches(remaining, (item) => item.rarity === wantRarity) ??
			pickMatches(remaining, (item) => item.element === wantElement) ??
			remaining;

		const chosen = candidates[Math.floor(rng() * candidates.length)];
		remaining.splice(remaining.indexOf(chosen), 1);
		items.push(chosen);

		// Adjust on what was actually pulled, not on what was rolled for.
		odds = {
			rarity: adjust(odds.rarity, chosen.rarity, weights.rarity),
			element: adjust(odds.element, chosen.element, weights.element)
		};
	}

	return { items, initial, current: odds, weights };
}

function pickMatches(pool: readonly Item[], match: (item: Item) => boolean): Item[] | null {
	const matches = pool.filter(match);
	return matches.length > 0 ? matches : null;
}

export function isRarity(value: string): value is Rarity {
	return (RARITIES as readonly string[]).includes(value);
}

export function isElement(value: string): value is Element {
	return (ELEMENTS as readonly string[]).includes(value);
}

/**
 * Registered categories that no item in the pool has. Rolling one of these
 * forces the pull to fall back to a looser match, which quietly skews the
 * results — usually it means a registry entry landed before its CSV rows did.
 */
export function unbackedCategories(pool: readonly Item[]): {
	rarity: Rarity[];
	element: Element[];
} {
	const rarities = new Set(pool.map((item) => item.rarity));
	const elements = new Set(pool.map((item) => item.element));

	return {
		rarity: RARITIES.filter((rarity) => !rarities.has(rarity)),
		element: ELEMENTS.filter((element) => !elements.has(element))
	};
}
