import { describe, it, expect } from 'vitest';
import { lineSurfaces, lineTeethCell, lineTeethLabel, quadrantLabel, quadrantsOf } from '../lineTeeth';
import { quadrantOfTooth } from '../fdi';

// Business rule: NAMAF and the funds read a filling by its tooth and surfaces ("Tooth 46, MO"); the account and claim
// review must say exactly what was done, in the same words, or the fund questions the code.
describe('a line\'s teeth in words', () => {
  it('names the tooth and its surfaces', () => {
    expect(lineTeethLabel({ teeth: ['46'], surfaces: 'MO' })).toBe('Tooth 46, MO');
    expect(lineTeethCell({ teeth: ['46'], surfaces: 'MO' })).toBe('46, MO');
  });

  it('lists several teeth, which keep no surfaces (surfaces belong to one tooth)', () => {
    expect(lineTeethLabel({ teeth: ['11', '12'], surfaces: 'M' })).toBe('Teeth 11, 12');
    expect(lineTeethCell({ teeth: ['11', '12'] })).toBe('11, 12');
  });

  it('names the quadrant of a code billed per quadrant', () => {
    expect(lineTeethLabel({ teeth: [], quadrant: 1 })).toBe('Upper right quadrant (Q1)');
    expect(lineTeethCell({ quadrant: 3 })).toBe('Q3');
    expect(quadrantLabel(4)).toBe('Lower right quadrant (Q4)');
  });

  it('says nothing for a line without teeth or a quadrant', () => {
    expect(lineTeethLabel({})).toBe('');
    expect(lineTeethCell({ teeth: [], quadrant: 5 })).toBe('');
  });
});

// Business rule: a surface the tooth does not have (an occlusal surface on an incisor) is not a surface the fund can
// pay for, so it is never kept; the chart's fixed order keeps "MO" and "OM" the same filling.
describe('the surfaces a line keeps', () => {
  it("keeps the tooth's own surfaces in the chart's order", () => {
    expect(lineSurfaces(['36'], 'dom')).toBe('MOD');
    expect(lineSurfaces(['11'], 'MOI')).toBe('MI');
  });

  it('keeps none without exactly one tooth, or with none marked', () => {
    expect(lineSurfaces([], 'MO')).toBeNull();
    expect(lineSurfaces(['36', '37'], 'MO')).toBeNull();
    expect(lineSurfaces(['36'], '')).toBeNull();
    expect(lineSurfaces(['99'], 'MO')).toBeNull();
  });
});

// Business rule: root planing and gingivectomy are billed per quadrant; a milk tooth sits in the quadrant of its side,
// so a child's teeth 54 and 14 are both in the upper right quadrant (one line, not two).
describe('quadrants of teeth', () => {
  it('maps permanent and milk teeth to quadrants 1-4, each once', () => {
    expect(quadrantOfTooth('14')).toBe(1);
    expect(quadrantOfTooth('54')).toBe(1);
    expect(quadrantOfTooth('85')).toBe(4);
    expect(quadrantOfTooth('19')).toBeNull();
    expect(quadrantsOf(['46', '14', '54', '31'])).toEqual([1, 3, 4]);
  });
});
