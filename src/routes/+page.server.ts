import { thumb } from '$lib/cards';
import { items } from '$lib/server/items';
import type { PageServerLoad } from './$types';

/**
 * How many distinct cards the strip behind the menu cycles through.
 *
 * The strip is decorative and sits at 28% opacity behind the mascot, so it's
 * capped rather than showing the whole set: each thumbnail is ~60 KB and the
 * rest of the front door only comes to ~430 KB.
 */
const STRIP_SIZE = 8;

/**
 * Art for the strip that scrolls behind the menu. Drawn from the item registry
 * rather than a hard-coded list, so art added to the CSV turns up here too, and
 * shuffled per visit so the front door isn't the same picture every time.
 */
export const load: PageServerLoad = () => ({ strip: pickArt() });

function pickArt(): string[] {
	const pool = items.map((item) => thumb(item.image));

	// Fisher-Yates, in place — `pool` is already a fresh array.
	for (let i = pool.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[pool[i], pool[j]] = [pool[j], pool[i]];
	}

	return pool.slice(0, STRIP_SIZE);
}
