/**
 * The rarity registry. Values are relative starting weights — they don't have
 * to sum to anything, they get normalized into odds.
 */
export const RARITY_WEIGHTS = {
	common: 70,
	uncommon: 20,
	rare: 8,
	epic: 4,
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
	water: 1,
	fire: 1,
	ice: 1,
	air: 1,
	metal: 1,
	void: 1,
	socratic: 1,
	tung_descendant: 1,
	grimble: 1
} as const satisfies Record<string, number>;

export type Rarity = keyof typeof RARITY_WEIGHTS;
export type Element = keyof typeof ELEMENT_WEIGHTS;

export const RARITIES = Object.keys(RARITY_WEIGHTS) as readonly Rarity[];
export const ELEMENTS = Object.keys(ELEMENT_WEIGHTS) as readonly Element[];

/** One row of the items CSV, as returned by `/api/items/random`. */
export type Item = {
	id: string;
	display_name: string;
	image: string;
	rarity: Rarity;
	element: Element;
	hp: number;
	damage: number;
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

/** How many cards each side brings into a battle. */
export const TEAM_SIZE = 3;

/** The combat-relevant slice of an `Item`. */
export type BattleCard = Pick<Item, 'id' | 'display_name' | 'element' | 'hp' | 'damage'>;

/**
 * A card in a battle. `hp` counts down as it takes hits; `maxHp` is what it
 * started with, so a client can size a health bar without a second lookup.
 */
export type BattleCombatant = BattleCard & { maxHp: number };

/** One attack, in the order it happened. */
export type BattleLogEntry = {
	/** 1-based, counted across the whole battle. */
	step: number;
	/** Which round the attack fell in. Every living card acts once per round. */
	round: number;
	attackerId: string;
	defenderId: string;
	attackerElement: Element;
	defenderElement: Element;
	/** The attacker's `damage` stat, before the element multiplier. */
	baseDamage: number;
	multiplier: number;
	/** What actually came off the defender's HP. */
	totalDamage: number;
	defenderHpBefore: number;
	defenderHpAfter: number;
	/** Whether this hit is what took the defender to 0. */
	knockout: boolean;
};

/**
 * Who was left standing. A draw means either both sides traded their last
 * knockouts in the same round, or the battle hit its round cap.
 */
export type BattleOutcome = 'player' | 'ai' | 'draw';

/** The result of a battle, as returned by `/api/battle`. */
export type BattleResult = {
	outcome: BattleOutcome;
	/** The player's team at its final HP. */
	player: BattleCombatant[];
	/** The AI's team at its final HP — also the selection it drew from the pool. */
	ai: BattleCombatant[];
	logs: BattleLogEntry[];
	/** How many rounds the battle lasted. */
	rounds: number;
};
