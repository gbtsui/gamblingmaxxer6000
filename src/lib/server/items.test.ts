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
			'id,display_name,image,rarity,element,hp,damage\n 7 , Seven , /s.png , RARE , Fire , 120 , 30 '
		);

		expect(parsed).toEqual([
			{
				id: '7',
				display_name: 'Seven',
				image: '/s.png',
				rarity: 'rare',
				element: 'fire',
				hp: 120,
				damage: 30
			}
		]);
	});

	it('keeps the first row when there is no header', () => {
		expect(parseItems('7,Seven,/s.png,rare,fire,120,30')).toHaveLength(1);
	});

	it('matches a spaced registry key against its snake_case name', () => {
		expect(parseItems('7,Seven,/s.png,rare,Tung Descendant,120,30')[0].element).toBe(
			'tung_descendant'
		);
	});

	it('throws on a rarity or element missing from the registry, naming the line', () => {
		const good = `1,A,/a.png,${RARITIES[0]},${ELEMENTS[0]},100,10`;

		expect(() => parseItems(`${good}\n2,B,/b.png,mythic,${ELEMENTS[0]},100,10`)).toThrow(
			/line 2.*mythic/
		);
		expect(() => parseItems(`1,A,/a.png,${RARITIES[0]},plasma,100,10`)).toThrow(/line 1.*plasma/);
	});

	it('throws on a missing or non-positive stat, naming the column', () => {
		const stats = (hp: string, damage: string) =>
			`1,A,/a.png,${RARITIES[0]},${ELEMENTS[0]},${hp},${damage}`;

		expect(() => parseItems(stats('', '10'))).toThrow(/line 1.*hp/);
		expect(() => parseItems(stats('100', '0'))).toThrow(/line 1.*damage/);
		expect(() => parseItems(stats('100', 'lots'))).toThrow(/line 1.*damage/);
	});

	it('accepts every element the registry declares', () => {
		const csv = ELEMENTS.map((el, i) => `${i},X,/x.png,${RARITIES[0]},${el},100,10`).join('\n');

		expect(parseItems(csv).map((item) => item.element)).toEqual([...ELEMENTS]);
	});

	it('loads the bundled CSV with stats on every row', () => {
		expect(items.length).toBeGreaterThan(0);

		for (const item of items) {
			expect(item.display_name).not.toBe('');
			expect(item.hp).toBeGreaterThan(0);
			expect(item.damage).toBeGreaterThan(0);
		}
	});
});
