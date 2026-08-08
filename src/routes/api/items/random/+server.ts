import { error, json } from '@sveltejs/kit';
import { items } from '$lib/server/items';
import { BASE_ELEMENT_ODDS, BASE_RARITY_ODDS, MAX_WEIGHT, normalize, pull } from '$lib/server/odds';
import {
	ELEMENTS,
	RARITIES,
	type Odds,
	type PullOdds,
	type PullWeights,
	type RandomItemsResponse
} from '$lib/types';
import type { RequestHandler } from './$types';

const DEFAULT_COUNT = 10;
const MAX_COUNT = 100;

/**
 * GET /api/items/random?count=10&rarityWeight=0.3&elementWeight=0.3
 *
 * Pulls `count` items starting from the base odds.
 */
export const GET: RequestHandler = ({ url }) => {
	const count = readCount(url.searchParams.get('count'));
	const weights: Partial<PullWeights> = {
		rarity: readWeight(url.searchParams.get('rarityWeight'), 'rarityWeight'),
		element: readWeight(url.searchParams.get('elementWeight'), 'elementWeight')
	};

	return respond(pull(items, { count, weights }));
};

/**
 * POST /api/items/random
 * { "count": 10, "weights": { "rarity": 0.3, "element": 0.3 }, "odds": { ... } }
 *
 * Same pull, but continues from the odds a previous response returned in
 * `odds.current`. Every field is optional; omitting `odds` starts from base.
 */
export const POST: RequestHandler = async ({ request }) => {
	const body: unknown = await request.json().catch(() => error(400, 'body must be valid JSON'));
	if (typeof body !== 'object' || body === null) error(400, 'body must be a JSON object');

	const { count: rawCount, weights: rawWeights, odds: rawOdds } = body as Record<string, unknown>;

	const count = readCount(rawCount === undefined ? null : String(rawCount));
	const weights: Partial<PullWeights> = {};
	const odds = rawOdds === undefined ? undefined : readOdds(rawOdds);

	if (typeof rawWeights === 'object' && rawWeights !== null) {
		const { rarity, element } = rawWeights as Record<string, unknown>;
		weights.rarity = readWeight(rarity === undefined ? null : String(rarity), 'weights.rarity');
		weights.element = readWeight(element === undefined ? null : String(element), 'weights.element');
	}

	return respond(pull(items, { count, weights, odds }));
};

function respond(result: ReturnType<typeof pull>) {
	const body: RandomItemsResponse = {
		count: result.items.length,
		items: result.items,
		weights: result.weights,
		odds: { initial: result.initial, current: result.current }
	};

	return json(body, { headers: { 'cache-control': 'no-store' } });
}

function readCount(raw: string | null): number {
	if (raw === null) return DEFAULT_COUNT;

	const count = Number(raw);
	if (!Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
		error(400, `count must be an integer between 1 and ${MAX_COUNT}`);
	}
	return count;
}

function readWeight(raw: string | null, field: string): number | undefined {
	if (raw === null) return undefined;

	const weight = Number(raw);
	if (!Number.isFinite(weight) || weight < 0 || weight > MAX_WEIGHT) {
		error(400, `${field} must be a number between 0 and ${MAX_WEIGHT}`);
	}
	return weight;
}

function readOdds(raw: unknown): PullOdds {
	if (typeof raw !== 'object' || raw === null) error(400, 'odds must be an object');
	const { rarity, element } = raw as Record<string, unknown>;

	return {
		rarity: readCategoryOdds(rarity, RARITIES, BASE_RARITY_ODDS, 'odds.rarity'),
		element: readCategoryOdds(element, ELEMENTS, BASE_ELEMENT_ODDS, 'odds.element')
	};
}

function readCategoryOdds<K extends string>(
	raw: unknown,
	keys: readonly K[],
	base: Odds<K>,
	field: string
): Odds<K> {
	if (typeof raw !== 'object' || raw === null) {
		error(400, `${field} must be an object with keys: ${keys.join(', ')}`);
	}

	const source = raw as Record<string, unknown>;
	const result = {} as Odds<K>;

	for (const key of keys) {
		// A client holding odds from before a registry change won't have every
		// key. Fill the gaps from base rather than rejecting the whole pull.
		if (source[key] === undefined) {
			result[key] = base[key];
			continue;
		}

		const value = Number(source[key]);
		if (!Number.isFinite(value) || value < 0) {
			error(400, `${field}.${key} must be a number >= 0`);
		}
		result[key] = value;
	}

	// Accept odds that don't quite sum to 1 — clients round when they serialise.
	return normalize(result);
}

/*
jenin if you're reading this i just want to say that claude can code better than i ever probably could but im low kirk kenuinely in this for the passion and enjoyment and i like making things
gng like
im so tired
i wanna keep making video essays but i can't animate and im too tired to do slides
i'm too scared to start drawing again
im too lazy to go back to hardware
ts slop


yeah
sorry twin

i really appreciate the code that you've proxy-written here and it works well
it's more of a personal thing and i have no qualms with the quality of your code so far

i like the modular functional-paradigm style of this endpoint
 */