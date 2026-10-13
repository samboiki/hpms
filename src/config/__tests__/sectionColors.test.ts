/**
 * Staff find their way by colour: Patients purple, Encounters blue, Messages orange, Finance green, and since
 * October 2026 Stock its own slate. The owner found Stock in Finance's green and Finance's own page in blue; these
 * tests keep each section's colour defined once and recognisable.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_COLOR, SECTION_COLORS, type SectionKey } from '../sectionColors';

const sections = Object.keys(SECTION_COLORS) as SectionKey[];
/** "from-emerald-500" -> "emerald" */
const hueOf = (stop: string) => stop.split('-')[1];
const huesOf = (key: SectionKey) => [hueOf(SECTION_COLORS[key].from), hueOf(SECTION_COLORS[key].to)];

describe('section colours', () => {
  it('gives every section a colour no other section uses, so Stock no longer looks like Finance', () => {
    for (const a of sections) {
      for (const b of sections) {
        if (a === b) continue;
        const shared = huesOf(a).filter(hue => huesOf(b).includes(hue));
        expect(shared, `${a} and ${b} share ${shared.join(', ')}`).toEqual([]);
      }
    }
    expect(new Set(sections.map(key => SECTION_COLORS[key].name)).size).toBe(sections.length);
  });

  it('keeps Finance green, the colour its dashboard tile always had', () => {
    expect(SECTION_COLORS.finance.name).toBe('Green');
    expect(huesOf('finance')).toEqual(['emerald', 'teal']);
  });

  it('builds the header icon and the selected tab from the same two stops, so they always match', () => {
    for (const key of sections) {
      const { from, to, iconBox, activeTab } = SECTION_COLORS[key];
      expect(iconBox).toBe(`bg-gradient-to-br ${from} ${to}`);
      expect(activeTab).toBe(`bg-gradient-to-r ${from} ${to}`);
    }
  });

  it('keeps the Dashboard and Settings, which are not sections, in the app purple they always had', () => {
    expect(APP_COLOR.iconBox).toBe('bg-gradient-to-br from-purple-500 to-indigo-600');
    expect(APP_COLOR.activeTab).toBe('bg-gradient-to-r from-purple-500 to-indigo-600');
  });

  it('spells every colour class out in full, because Tailwind drops classes built from pieces (a blank header icon in production)', () => {
    const source = readFileSync(resolve(__dirname, '../sectionColors.ts'), 'utf8');
    for (const { from, to, text } of [...sections.map(key => SECTION_COLORS[key]), APP_COLOR]) {
      expect(from).toMatch(/^from-[a-z]+-\d{3}$/);
      expect(to).toMatch(/^to-[a-z]+-\d{3}$/);
      expect(text).toMatch(/^text-[a-z]+-\d{3}$/);
      for (const cls of [from, to, text]) expect(source).toContain(`'${cls}'`);
    }
  });
});
