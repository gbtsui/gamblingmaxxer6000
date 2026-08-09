import type {
	BattleCard,
	BattleCombatant,
	BattleLogEntry,
	BattleOutcome,
	BattleResult,
	Element,
	Item
} from '$lib/types';

/**
 * How much damage an attacking element (outer key) deals to a defending one
 * (inner key), as a multiplier on the attacker's `damage` stat.
 *
 * Keyed off the element registry in `$lib/types`, so registering a new element
 * stops this file compiling until its row and column are filled in.
 */
const DAMAGE_MATRIX: Record<Element, Record<Element, number>> = {
	water: {
		water: 1.0,
		fire: 1.5,
		ice: 0.75,
		air: 1.0,
		metal: 1.2,
		void: 1.0,
		socratic: 1.0,
		tung_descendant: 0.75,
		grimble: 1.0
	},
	fire: {
		water: 0.75,
		fire: 1.0,
		ice: 1.5,
		air: 1.2,
		metal: 1.5,
		void: 1.0,
		socratic: 1.0,
		tung_descendant: 1.0,
		grimble: 1.2
	},
	ice: {
		water: 1.5,
		fire: 0.75,
		ice: 1.0,
		air: 1.0,
		metal: 0.75,
		void: 1.2,
		socratic: 1.0,
		tung_descendant: 1.5,
		grimble: 1.0
	},
	air: {
		water: 1.0,
		fire: 1.2,
		ice: 1.0,
		air: 1.0,
		metal: 0.75,
		void: 1.5,
		socratic: 1.2,
		tung_descendant: 1.0,
		grimble: 0.75
	},
	metal: {
		water: 0.75,
		fire: 0.75,
		ice: 1.5,
		air: 1.5,
		metal: 1.0,
		void: 1.0,
		socratic: 1.0,
		tung_descendant: 1.2,
		grimble: 1.0
	},
	void: {
		water: 1.2,
		fire: 1.0,
		ice: 0.75,
		air: 0.75,
		metal: 1.2,
		void: 1.5,
		socratic: 1.5,
		tung_descendant: 1.0,
		grimble: 1.5
	},
	socratic: {
		water: 1.0,
		fire: 1.0,
		ice: 1.2,
		air: 0.75,
		metal: 1.0,
		void: 0.75,
		socratic: 1.0,
		tung_descendant: 1.5,
		grimble: 1.2
	},
	tung_descendant: {
		water: 1.5,
		fire: 1.0,
		ice: 0.75,
		air: 1.2,
		metal: 0.75,
		void: 1.0,
		socratic: 0.75,
		tung_descendant: 1.0,
		grimble: 1.5
	},
	grimble: {
		water: 1.0,
		fire: 0.75,
		ice: 1.0,
		air: 1.5,
		metal: 1.2,
		void: 0.75,
		socratic: 0.75,
		tung_descendant: 1.5,
		grimble: 1.5
	}
};

/**
 * Safety valve. Every hit removes at least 1 HP as long as the attacker has a
 * `damage` stat, so a battle terminates on its own — this only catches a card
 * that somehow deals nothing.
 */
const MAX_ROUNDS = 50;

export type BattleOptions = {
	/** How many cards the AI draws from the pool. Defaults to the player's team size. */
	aiTeamSize?: number;
	rng?: () => number;
};

/** Drops the stats a battle doesn't care about. */
export function toBattleCard({ id, display_name, element, hp, damage }: Item): BattleCard {
	return { id, display_name, element, hp, damage };
}

/**
 * Runs a battle between the player's cards and a team the AI draws at random
 * from `pool` — the items from the same pull the player passed on.
 *
 * Rounds alternate between the sides: each living card takes one turn, hitting
 * a random living opponent, until one side is wiped.
 */
export function executeBattle(
	playerCards: readonly BattleCard[],
	pool: readonly BattleCard[],
	options: BattleOptions = {}
): BattleResult {
	const { rng = Math.random, aiTeamSize = playerCards.length } = options;

	// toCombatant copies, so the caller's cards never see the HP mutation.
	const player = playerCards.map(toCombatant);
	const ai = shuffle(pool, rng).slice(0, aiTeamSize).map(toCombatant);

	const logs: BattleLogEntry[] = [];
	let round = 0;

	while (round < MAX_ROUNDS && anyAlive(player) && anyAlive(ai)) {
		round++;

		for (const { attacker, defenders } of buildQueue(player, ai, rng)) {
			// The attacker may have been knocked out earlier in this same round.
			if (attacker.hp <= 0) continue;

			const defender = pickTarget(defenders, rng);
			// That side is wiped — the round ends here, and so does the battle.
			if (!defender) break;

			logs.push(strike(attacker, defender, logs.length + 1, round));
		}
	}

	return { outcome: decide(player, ai), player, ai, logs, rounds: round };
}

/** One card's turn: who swings, and which side they may swing at. */
type Turn = { attacker: BattleCombatant; defenders: BattleCombatant[] };

/**
 * Orders a round's turns, interleaving the sides so neither gets to act twice
 * before the other answers. Pairing each attacker with the opposing array here
 * is what keeps a card from ever being handed a target from its own side.
 */
function buildQueue(player: BattleCombatant[], ai: BattleCombatant[], rng: () => number): Turn[] {
	const attackers = { player: shuffle(living(player), rng), ai: shuffle(living(ai), rng) };
	const turns: Turn[] = [];

	for (let i = 0; i < Math.max(attackers.player.length, attackers.ai.length); i++) {
		if (i < attackers.player.length) turns.push({ attacker: attackers.player[i], defenders: ai });
		if (i < attackers.ai.length) turns.push({ attacker: attackers.ai[i], defenders: player });
	}
	return turns;
}

/** Resolves one attack, applying the damage and describing what happened. */
function strike(
	attacker: BattleCombatant,
	defender: BattleCombatant,
	step: number,
	round: number
): BattleLogEntry {
	const multiplier = DAMAGE_MATRIX[attacker.element][defender.element];
	const totalDamage = Math.round(attacker.damage * multiplier);
	const defenderHpBefore = defender.hp;

	defender.hp = Math.max(0, defenderHpBefore - totalDamage);

	return {
		step,
		round,
		attackerId: attacker.id,
		defenderId: defender.id,
		attackerElement: attacker.element,
		defenderElement: defender.element,
		baseDamage: attacker.damage,
		multiplier,
		totalDamage,
		defenderHpBefore,
		defenderHpAfter: defender.hp,
		knockout: defender.hp === 0
	};
}

function decide(player: BattleCombatant[], ai: BattleCombatant[]): BattleOutcome {
	const playerAlive = anyAlive(player);
	const aiAlive = anyAlive(ai);

	if (playerAlive === aiAlive) return 'draw';
	return playerAlive ? 'player' : 'ai';
}

function toCombatant(card: BattleCard): BattleCombatant {
	return { ...card, maxHp: card.hp };
}

function living(side: readonly BattleCombatant[]): BattleCombatant[] {
	return side.filter((card) => card.hp > 0);
}

function anyAlive(side: readonly BattleCombatant[]): boolean {
	return side.some((card) => card.hp > 0);
}

function pickTarget(side: readonly BattleCombatant[], rng: () => number): BattleCombatant | null {
	const targets = living(side);
	return targets.length > 0 ? targets[Math.floor(rng() * targets.length)] : null;
}

/** Fisher-Yates — returns a new array. */
function shuffle<T>(items: readonly T[], rng: () => number): T[] {
	const result = [...items];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}
