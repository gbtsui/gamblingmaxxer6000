export type BattleCard = {
	id: string;
	display_name: string;
	element: Element;
	hp: number;
	damage: number;
};

export type BattleLogEntry = {
	step: number;
	attacker: string; // display_name
	defender: string; // display_name
	attackerElement: Element;
	defenderElement: Element;
	baseDamage: number;
	multiplier: number;
	totalDamage: number;
	defenderOldHp: number;
	defenderNewHp: number;
	/** If the defender was knocked out this hit */
	knockout: boolean;
};

export type BattleResult = {
	victory: boolean; // true = player won
	playerCards: BattleCard[];
	aiCards: BattleCard[];
	logs: BattleLogEntry[];
	/** The 3 cards the AI selected from the remaining 7 */
	aiSelection: BattleCard[];
	/** How many turns the battle lasted */
	totalSteps: number;
};

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
		grimble: 1.0,
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
		grimble: 1.2,
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
		grimble: 1.0,
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
		grimble: 0.75,
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
		grimble: 1.0,
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
		grimble: 1.5,
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
		grimble: 1.2,
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
		grimble: 1.5,
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
		grimble: 1.5,
	},
};


// ============================================================
// HELPERS
// ============================================================

/** Fisher-Yates shuffle — returns a new array. */
function shuffle<T>(arr: readonly T[]): T[] {
	const result = [...arr];
	for (let i = result.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[result[i], result[j]] = [result[j], result[i]];
	}
	return result;
}

/** Deep-clone a card so mutations don't leak. */
function cloneCard(card: BattleCard): BattleCard {
	return { ...card };
}

function cloneCards(cards: readonly BattleCard[]): BattleCard[] {
	return cards.map(cloneCard);
}

/** Get all alive cards from a side. */
function aliveCards(side: BattleCard[]): BattleCard[] {
	return side.filter((c) => c.hp > 0);
}

/** Build a turn queue: interleave team A and team B, shuffled within each team per round. */
function buildQueue(teamA: BattleCard[], teamB: BattleCard[]): BattleCard[] {
	const queue: BattleCard[] = [];
	const a = shuffle(aliveCards(teamA));
	const b = shuffle(aliveCards(teamB));
	const maxLen = Math.max(a.length, b.length);
	for (let i = 0; i < maxLen; i++) {
		if (i < a.length) queue.push(a[i]);
		if (i < b.length) queue.push(b[i]);
	}
	return queue;
}

/** Pick a random defender from the opposing side. */
function pickDefender(attackers: BattleCard[], defenders: BattleCard[]): BattleCard {
	const alive = aliveCards(defenders);
	if (alive.length === 0) {
		throw new Error("No defenders alive — battle should have ended.");
	}
	return alive[Math.floor(Math.random() * alive.length)];
}

/** Determine which side a card belongs to. */
function getSide(
	card: BattleCard,
	playerCards: BattleCard[],
	aiCards: BattleCard[],
): "player" | "ai" {
	if (playerCards.some((c) => c.id === card.id)) return "player";
	return "ai";
}

// ============================================================
// MAIN BATTLE FUNCTION
// ============================================================

/**
 * Execute a full battle between the player's 3 cards and
 * 3 randomly-selected AI cards from the remaining 7.
 *
 * @param playerCards - The 3 cards the player selected
 * @param remainingCards - The 7 cards not selected by the player
 * @returns BattleResult with full turn-by-turn logs
 */
export function executeBattle(
	playerCards: readonly BattleCard[],
	remainingCards: readonly BattleCard[],
): BattleResult {
	// 1. AI selects 3 random cards from the remaining 7
	const aiSelection = shuffle(remainingCards).slice(0, 3).map(cloneCard);

	// 2. Deep-clone both sides so we can mutate HP freely
	const player = cloneCards(playerCards);
	const ai = cloneCards(aiSelection);

	// 3. Battle state
	const logs: BattleLogEntry[] = [];
	let step = 0;
	const MAX_STEPS = 100; // safety valve to prevent infinite loops

	// 4. Turn loop
	while (aliveCards(player).length > 0 && aliveCards(ai).length > 0 && step < MAX_STEPS) {
		const queue = buildQueue(player, ai);

		for (const attacker of queue) {
			// Re-check victory condition mid-round
			if (aliveCards(player).length === 0 || aliveCards(ai).length === 0) break;

			// Skip dead attackers (they may have died earlier this round)
			if (attacker.hp <= 0) continue;

			const attackerSide = getSide(attacker, player, ai);
			const defenderSide = attackerSide === "player" ? ai : player;

			const defender = pickDefender(player, ai); // the function checks both
			// More explicit: find defender from the correct side
			const actualDefender = (attackerSide === "player" ? ai : player).find(
				(c) => c.id === defender.id,
			);
			if (!actualDefender || actualDefender.hp <= 0) continue;

			// --- Calculate damage ---
			const multiplier = DAMAGE_MATRIX[attacker.element][actualDefender.element];
			const baseDamage = attacker.damage;
			const totalDamage = Math.round(baseDamage * multiplier);
			const oldHp = actualDefender.hp;
			const newHp = Math.max(0, oldHp - totalDamage);
			actualDefender.hp = newHp;

			step++;

			// --- Log ---
			logs.push({
				step,
				attacker: attacker.display_name,
				defender: actualDefender.display_name,
				attackerElement: attacker.element,
				defenderElement: actualDefender.element,
				baseDamage,
				multiplier,
				totalDamage,
				defenderOldHp: oldHp,
				defenderNewHp: newHp,
				knockout: newHp <= 0,
			});

			// If the attacker's target dies, we just continue —
			// the attacker still keeps their turn for this round.
		}
	}

	// 5. Determine victory
	const playerAlive = aliveCards(player).length > 0;
	const aiAlive = aliveCards(ai).length > 0;

	// Player wins if AI is wiped; if both alive (hit step limit), it's a draw → player loses
	const victory = playerAlive && !aiAlive;

	return {
		victory,
		playerCards: player, // final HP states
		aiCards: ai, // final HP states
		logs,
		aiSelection,
		totalSteps: step,
	};
}