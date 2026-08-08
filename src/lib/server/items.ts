import { ELEMENTS, RARITIES, type Item } from '$lib/types';
import { isElement, isRarity, unbackedCategories } from './odds';
import csv from './data/items.csv?raw';

/**
 * Splits CSV text into rows of fields. Handles quoted fields (`"a,b"`),
 * escaped quotes (`""`), embedded newlines, and both LF and CRLF line endings.
 */
export function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let quoted = false;

	for (let i = 0; i < text.length; i++) {
		const char = text[i];

		if (quoted) {
			if (char === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					quoted = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			quoted = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n' || char === '\r') {
			if (char === '\r' && text[i + 1] === '\n') i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += char;
		}
	}

	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	// Drop rows that are entirely empty (e.g. a trailing newline).
	return rows.filter((r) => r.some((f) => f.trim() !== ''));
}

/**
 * Turns CSV text into items. The first row is treated as a header if its first
 * cell looks like a column name rather than an id. Columns are positional:
 * id, display name, path to PNG, rarity, element.
 *
 * Throws on an unknown rarity or element — a typo in the data should be loud
 * rather than quietly leaving a row unpullable.
 */
export function parseItems(text: string): Item[] {
	const rows = parseCsv(text);
	if (rows.length === 0) return [];

	const header = rows[0].map((f) => f.trim().toLowerCase());
	const hasHeader = header[0] === 'id';
	const body = hasHeader ? rows.slice(1) : rows;
	const lineOffset = hasHeader ? 2 : 1;

	const items: Item[] = [];

	body.forEach(([id, displayName, image, rarity, element], index) => {
		if ((id ?? '').trim() === '') return;

		const line = index + lineOffset;
		const normalizedRarity = (rarity ?? '').trim().toLowerCase();
		const normalizedElement = (element ?? '').trim().toLowerCase();

		if (!isRarity(normalizedRarity)) {
			throw new Error(
				`items.csv line ${line}: rarity "${rarity ?? ''}" must be one of ${RARITIES.join(', ')}`
			);
		}
		if (!isElement(normalizedElement)) {
			throw new Error(
				`items.csv line ${line}: element "${element ?? ''}" must be one of ${ELEMENTS.join(', ')}`
			);
		}

		items.push({
			id: id.trim(),
			displayName: (displayName ?? '').trim(),
			image: (image ?? '').trim(),
			rarity: normalizedRarity,
			element: normalizedElement
		});
	});

	return items;
}

/** All items from the bundled CSV, parsed once at module load. */
export const items: Item[] = parseItems(csv);

if (import.meta.env.DEV) {
	const unbacked = unbackedCategories(items);
	for (const [category, missing] of Object.entries(unbacked)) {
		if (missing.length > 0) {
			console.warn(
				`items.csv has no rows for ${category}: ${missing.join(', ')} — pulls will fall back to a looser match`
			);
		}
	}
}
