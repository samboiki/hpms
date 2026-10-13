import { describe, expect, it } from 'vitest';
import { DRAWING_TEMPLATES } from '../../../utils/clinical/drawings';
import { templateArt, templateImageSource } from '../drawingTemplates';

const toothNumbers = (svg: string): string[] => [...svg.matchAll(/>(\d\d)<\/text>/g)].map((match) => match[1]);

describe('the template artwork', () => {
  // The pad is sized by the template's aspect and the artwork is painted into it: if the two differed, the saved
  // picture would stretch the chart and the marks would no longer sit on the tooth or the body part they were drawn on
  it('has the shape the drawing pad is given', () => {
    for (const template of DRAWING_TEMPLATES) {
      const art = templateArt(template.id);
      if (!art) {
        expect(template.id).toBe('blank');
        continue;
      }
      expect(art.width / art.height).toBeCloseTo(template.aspect, 6);
      expect(art.svg).toContain(`viewBox="0 0 ${art.width} ${art.height}"`);
    }
  });

  it('numbers every adult and child tooth once, as the tooth chart does (FDI)', () => {
    const adult = toothNumbers(templateArt('teeth-adult')?.svg ?? '');
    expect(adult).toHaveLength(32);
    expect(new Set(adult).size).toBe(32);
    expect(adult).toEqual(expect.arrayContaining(['18', '11', '21', '28', '48', '41', '31', '38']));
    const child = toothNumbers(templateArt('teeth-child')?.svg ?? '');
    expect(child).toHaveLength(20);
    expect(child).toEqual(expect.arrayContaining(['55', '51', '61', '65', '85', '81', '71', '75']));
  });

  it('marks the patient\'s right and left, so a mark is never read on the wrong side', () => {
    for (const id of ['body', 'teeth-adult', 'teeth-child'] as const) {
      const svg = templateArt(id)?.svg ?? '';
      expect(svg).toMatch(/>R<\/text>/);
      expect(svg).toMatch(/>L<\/text>/);
    }
  });

  it('becomes an image source the pad and the saved picture can both load', () => {
    const art = templateArt('body');
    expect(art && templateImageSource(art).startsWith('data:image/svg+xml;charset=utf-8,%3Csvg')).toBe(true);
  });
});
