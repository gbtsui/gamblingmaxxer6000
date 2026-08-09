import { error, json } from '@sveltejs/kit';
import { executeBattle, toBattleCard } from '$lib/server/damage';
import { items } from '$lib/server/items';
import { TEAM_SIZE, type BattleCard, type BattleResult } from '$lib/types';
import type { RequestHandler } from './$types';

const byId = new Map(items.map((item) => [item.id, item]));

/**
 * POST /api/battle
 * { "player": ["id", "id", "id"], "pool": ["id", ...] }
 *
 * Fights the player's team against `TEAM_SIZE` cards the AI draws from `pool` —
 * the items from the same pull the player passed on.
 *
 * Only ids cross the wire: stats are read from the server's own registry, so a
 * client can't hand itself a card with 9999 damage.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body: unknown = await request.json().catch(() => error(400, 'body must be valid JSON'));
	if (typeof body !== 'object' || body === null) error(400, 'body must be a JSON object');

	const { player: rawPlayer, pool: rawPool } = body as Record<string, unknown>;
	const player = readCards(rawPlayer, 'player');
	const pool = readCards(rawPool, 'pool');

	if (player.length !== TEAM_SIZE) error(400, `player must hold exactly ${TEAM_SIZE} item ids`);
	if (pool.length < TEAM_SIZE) error(400, `pool must hold at least ${TEAM_SIZE} item ids`);

	const picked = new Set(player.map((card) => card.id));
	const repeated = pool.filter((card) => picked.has(card.id)).map((card) => card.id);
	if (repeated.length > 0) error(400, `pool must not repeat player ids: ${repeated.join(', ')}`);

	const result: BattleResult = executeBattle(player, pool, { aiTeamSize: TEAM_SIZE });

	return json(result, { headers: { 'cache-control': 'no-store' } });
};

function readCards(raw: unknown, field: string): BattleCard[] {
	if (!Array.isArray(raw)) error(400, `${field} must be an array of item ids`);

	const seen = new Set<string>();

	return raw.map((entry, index) => {
		if (typeof entry !== 'string') error(400, `${field}[${index}] must be an item id string`);
		if (seen.has(entry)) error(400, `${field}[${index}]: duplicate id "${entry}"`);
		seen.add(entry);

		const item = byId.get(entry);
		if (!item) error(400, `${field}[${index}]: no item with id "${entry}"`);

		return toBattleCard(item);
	});
}
