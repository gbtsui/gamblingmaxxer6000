import { describe, expect, it } from 'vitest';
import { items, parseCsv, parseItems } from './items';
import { ELEMENTS, RARITIES } from '$lib/types';

describe('parseCsv', () => {
	it('parses quoted fields, escaped quotes and CRLF line endings', () => {
		const text = 'id,name\r\n1,"Bell, Large"\r\n2,"He said ""hi"""\r\n';

		expect(parseCsv(text)).toEqual([
			['id', 'name'],
			['1', 'Bell, Large'],
			['2', 'He said "hi"']
		]);
	});
});

describe('parseItems', () => {
	it('skips the header row and trims fields', () => {
		const parsed = parseItems(
			'id,display_name,image,rarity,element\n 7 , Seven , /s.png , RARE , Fire '
		);

		expect(parsed).toEqual([
			{ id: '7', displayName: 'Seven', image: '/s.png', rarity: 'rare', element: 'fire' }
		]);
	});

	it('keeps the first row when there is no header', () => {
		expect(parseItems('7,Seven,/s.png,rare,fire')).toHaveLength(1);
	});

	it('throws on a rarity or element missing from the registry, naming the line', () => {
		const good = `1,A,/a.png,${RARITIES[0]},${ELEMENTS[0]}`;

		expect(() => parseItems(`${good}\n2,B,/b.png,mythic,${ELEMENTS[0]}`)).toThrow(/line 2.*mythic/);
		expect(() => parseItems(`1,A,/a.png,${RARITIES[0]},plasma`)).toThrow(/line 1.*plasma/);
	});

	it('accepts every element the registry declares', () => {
		const csv = ELEMENTS.map((el, i) => `${i},X,/x.png,${RARITIES[0]},${el}`).join('\n');

		expect(parseItems(csv).map((item) => item.element)).toEqual([...ELEMENTS]);
	});

	it('loads the bundled CSV', () => {
		expect(items.length).toBeGreaterThan(0);
		expect(items[0]).toEqual({
			id: '1',
			displayName: 'Cherry',
			image: '/items/cherry.png',
			rarity: 'common',
			element: 'fire'
		});
	});
});
