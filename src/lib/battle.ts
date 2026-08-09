import type { BattleCombatant, BattleResult, Element } from './types';

/**
 * A combatant with its art attached. The battle API only deals in ids and
 * stats, so the ring pairs its result back up with the items from the pull.
 */
export type FieldCard = BattleCombatant & { image: string };

/** One line of the running feed down the side of the ring. */
export type FeedLine = {
	id: number;
	kind: 'round' | 'hit' | 'ko' | 'result';
	/** Who swung and what they threw, printed above the damage. */
	move?: string;
	text: string;
	/** The effectiveness call, printed in the attacking element's colour. */
	note?: string;
	tint?: string;
	/** Which side threw it, so the feed can be read at a glance. */
	side?: 'player' | 'ai';
};

/**
 * Fights the player's three against three of the cards they left behind.
 *
 * Only ids cross the wire — the server reads the stats from its own registry
 * and settles the whole bout in one go. What comes back is a finished battle
 * plus the blow-by-blow, which the ring then replays.
 */
export async function runBattle(
	playerIds: readonly string[],
	poolIds: readonly string[],
	fetcher: typeof fetch = fetch
): Promise<BattleResult> {
	const res = await fetcher('/api/battle', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ player: playerIds, pool: poolIds })
	});

	if (!res.ok) {
		const { message } = await res.json().catch(() => ({ message: res.statusText }));
		throw new Error(`Failed to run battle: ${message}`);
	}

	return res.json();
}

/**
 * The colour each element throws when it lands. Picked to read against the dim
 * blue-grey room without competing with the pastel card art — these only ever
 * appear for a few hundred milliseconds, on top of the sprite that got hit.
 */
export const ELEMENT_COLORS: Record<Element, string> = {
	water: '#5fb8ff',
	fire: '#ff7a45',
	ice: '#a8ecff',
	air: '#d8e4f5',
	metal: '#b9c2d4',
	void: '#b07cff',
	socratic: '#ffd166',
	tung_descendant: '#7cf0a8',
	grimble: '#ff8fd0'
};

/** What the field hands a fighter when it gets caught. */
export type Hit = {
	/** Bumped per hit — this is what retriggers the flash and the number. */
	token: number;
	damage: number;
	multiplier: number;
	/** The attacker's element, so the burst is the colour that threw it. */
	element: Element;
};

export type Effectiveness = 'super' | 'strong' | 'neutral' | 'weak';

/**
 * Buckets a damage multiplier from the matrix. Kept as ranges rather than
 * equality checks on 1.5/1.2/0.75 so retuning the matrix doesn't silently drop
 * hits into the wrong bucket.
 */
export function effectivenessOf(multiplier: number): Effectiveness {
	if (multiplier >= 1.4) return 'super';
	if (multiplier > 1) return 'strong';
	if (multiplier < 1) return 'weak';
	return 'neutral';
}

/** How the log calls it. Neutral hits say nothing — there's nothing to say. */
export function effectivenessLabel(multiplier: number): string {
	switch (effectivenessOf(multiplier)) {
		case 'super':
			return 'super effective!';
		case 'strong':
			return 'solid hit.';
		case 'weak':
			return 'barely scratched it.';
		default:
			return '';
	}
}
