import type { Element } from './types';

/**
 * How a card crosses the field to land its hit.
 *
 * `lunge`, `dash`, `slam`, `blink` and `spin` carry the attacker to the target.
 * `shot` and `beam` keep it at home and send something instead — which is what
 * stops a nine-element roster from looking like nine versions of one animation.
 */
export type Motion = 'lunge' | 'dash' | 'slam' | 'blink' | 'spin' | 'shot' | 'beam';

/** What the hit leaves on the card that took it. */
export type Impact = 'burst' | 'slash' | 'shatter' | 'shock' | 'spiral';

export type Move = {
	/** Printed in the feed, so a fight reads as moves rather than as numbers. */
	name: string;
	motion: Motion;
	impact: Impact;
};

/**
 * One move per element. The pairing is deliberate: elements that read as
 * physical close the distance, elements that read as projectile or mental stay
 * put and throw something, so you can tell what hit you without the log.
 */
export const MOVES: Record<Element, Move> = {
	water: { name: 'tide slam', motion: 'shot', impact: 'shock' },
	fire: { name: 'grease fire', motion: 'shot', impact: 'burst' },
	ice: { name: 'cold open', motion: 'shot', impact: 'shatter' },
	air: { name: 'fly-by', motion: 'dash', impact: 'slash' },
	metal: { name: 'drop the anvil', motion: 'slam', impact: 'shock' },
	void: { name: 'no-show', motion: 'blink', impact: 'spiral' },
	socratic: { name: 'ask why', motion: 'beam', impact: 'spiral' },
	tung_descendant: { name: 'spin cycle', motion: 'spin', impact: 'slash' },
	grimble: { name: 'grimble pounce', motion: 'lunge', impact: 'burst' }
};

/**
 * How long each motion runs, and how far through it the hit actually connects —
 * the replay takes damage off on contact, so this is what keeps the number and
 * the flinch landing on the frame the card arrives.
 */
export const TIMING: Record<Motion, { duration: number; contact: number }> = {
	lunge: { duration: 620, contact: 0.46 },
	dash: { duration: 580, contact: 0.4 },
	slam: { duration: 780, contact: 0.56 },
	blink: { duration: 680, contact: 0.52 },
	spin: { duration: 700, contact: 0.5 },
	shot: { duration: 660, contact: 0.62 },
	beam: { duration: 620, contact: 0.5 }
};

/** Whether the motion sends something across instead of the card itself. */
export function isRanged(motion: Motion): boolean {
	return motion === 'shot' || motion === 'beam';
}
