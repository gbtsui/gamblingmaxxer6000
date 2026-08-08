/**
 * The rarity registry. Values are relative starting weights — they don't have
 * to sum to anything, they get normalized into odds.
 */
export const RARITY_WEIGHTS = {
	common: 70,
	uncommon: 20,
	rare: 8,
	legendary: 2
} as const satisfies Record<string, number>;

/**
 * The element registry. Add or remove a line here and everything follows: the
 * `Element` type, the base odds, CSV validation and the API's accepted values.
 * Nothing else needs editing, and anything referring to an element that isn't
 * listed stops compiling.
 *
 * Equal weights give a flat split; set them unevenly to bias the base odds.
 */
export const ELEMENT_WEIGHTS = {
	ice: 1,
	fire: 1,
	air: 1,
	water: 1,
	metal: 1,
	grimble: 1,
	tung_descendant: 1,
	socratic: 1,
	voidtype: 1
} as const satisfies Record<string, number>;

export type Rarity = keyof typeof RARITY_WEIGHTS;
export type Element = keyof typeof ELEMENT_WEIGHTS;

export const RARITIES = Object.keys(RARITY_WEIGHTS) as readonly Rarity[];
export const ELEMENTS = Object.keys(ELEMENT_WEIGHTS) as readonly Element[];

/** One row of the items CSV, as returned by `/api/items/random`. */
export type Item = {
	id: string;
	displayName: string;
	image: string;
	rarity: Rarity;
	element: Element;
};

/** A probability per category. Values always sum to 1. */
export type Odds<K extends string> = Record<K, number>;

export type PullOdds = {
	rarity: Odds<Rarity>;
	element: Odds<Element>;
};

/**
 * How hard a pull pushes the odds away from what was just pulled. 0 keeps the
 * odds fixed; higher values swing them harder.
 */
export type PullWeights = {
	rarity: number;
	element: number;
};

export type RandomItemsResponse = {
	count: number;
	items: Item[];
	weights: PullWeights;
	odds: {
		/** The odds this pull started from. */
		initial: PullOdds;
		/** The odds after the pull — feed these back in for the next one. */
		current: PullOdds;
	};
};
