import { RARITIES, type Element, type Rarity } from './types';

/** Rarity as the printed cards show it — one star per step up the registry. */
export function stars(rarity: Rarity): number {
	return RARITIES.indexOf(rarity) + 1;
}

/**
 * Which rarities get printed on foil stock. Derived from position in the
 * registry rather than a hard-coded list, so adding a rarity above `rare`
 * doesn't quietly leave it on plain card.
 */
export function isFoil(rarity: Rarity): boolean {
	return RARITIES.indexOf(rarity) >= RARITIES.indexOf('rare');
}

/**
 * The grid-sized JPEG written by `scripts/thumbs.sh`. The full PNGs are up to
 * 1.5 MB each and a ten-card pull ships all of them at once, which is slow
 * enough on venue wifi to look broken.
 */
export function thumb(image: string): string {
	return image.replace('/cards/', '/cards/thumb/').replace(/\.png$/, '.jpg');
}

/** Element names are registry keys; the cards print them with a space. */
export function elementName(element: Element): string {
	return element.replace(/_/g, ' ');
}

/**
 * A stable 0–1 offset per card, used to stagger the shine animations. Without
 * it a spread of ten cards shimmers in lockstep, which reads as a screensaver
 * rather than as light moving over a table.
 */
export function phaseOf(id: string): number {
	let hash = 7;
	for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
	return hash / 997;
}
