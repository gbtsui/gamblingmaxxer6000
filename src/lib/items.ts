import type { PullOdds, PullWeights, RandomItemsResponse } from './types';

export type PullRequest = {
	count?: number;
	weights?: Partial<PullWeights>;
	/** Carry `odds.current` from a previous pull to keep the streak going. */
	odds?: PullOdds;
	exclude?: string[];
};

/**
 * Pulls random items from the backend. Pass SvelteKit's `fetch` when calling
 * this from a `load` function; the global one is fine in components.
 */
export async function pullItems(
	request: PullRequest = {},
	fetcher: typeof fetch = fetch
): Promise<RandomItemsResponse> {
	const res = await fetcher('/api/items/random', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(request)
	});

	if (!res.ok) {
		const { message } = await res.json().catch(() => ({ message: res.statusText }));
		throw new Error(`Failed to pull items: ${message}`);
	}

	return res.json();
}
