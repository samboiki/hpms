import { describe, it, expect } from 'vitest';
import { ANTERIOR_RESTORATION_CODES, POSTERIOR_RESTORATION_CODES, RESTORATION_CODES } from '../../billing/tariffRules';
import {
  AMALGAM_CODES,
  RESIN_BACK_CODES,
  RESIN_FRONT_CODES,
  codeForSurfaceCount,
  fillingCodeFor,
  planWorkForCode,
  restorationSide,
  suggestedCodes,
  surfaceCodeProblem,
  surfaceCountForCode,
  workForCode
} from '../workTypes';

// Business rule: the chart is built from what was billed. An extraction (8201) leaves the tooth missing, a resin
// restoration fills it, a crown or root canal code puts that work on the tooth; a radiograph changes nothing.
describe('the work a code does', () => {
  it('maps the codes dental practices bill', () => {
    expect(workForCode('8201')).toBe('extraction');
    expect(workForCode('8213')).toBe('extraction');
    expect(workForCode('8369')).toBe('filling');
    expect(workForCode(' 8411 ')).toBe('crown');
    expect(workForCode('8339')).toBe('root_canal');
    expect(workForCode('8194')).toBe('implant');
    expect(workForCode('8422')).toBe('bridge');
    expect(workForCode('8107')).toBeNull();
    expect(workForCode('8346')).toBeNull();
  });

  // One list of restoration codes for the 8346 rule, the claim checks and the chart (tariffRules.ts)
  it('treats every restoration of the claim rules as a filling', () => {
    RESTORATION_CODES.forEach(code => expect(workForCode(code)).toBe('filling'));
    expect(RESIN_FRONT_CODES).toEqual(ANTERIOR_RESTORATION_CODES);
    [...RESIN_BACK_CODES, ...AMALGAM_CODES].forEach(code => expect(POSTERIOR_RESTORATION_CODES).toContain(code));
  });

  it('plans codes that change nothing on the chart as other work', () => {
    expect(planWorkForCode('8163')).toBe('other');
    expect(planWorkForCode('8368')).toBe('filling');
  });
});

// Business rule: a restoration code says how many surfaces it is for and whether it is for front or back teeth; funds
// refuse "tariff not applicable to the tooth type". The chart picks the code from the surfaces marked.
describe('filling codes', () => {
  it('knows the surfaces and the side of each restoration code', () => {
    expect(surfaceCountForCode('8368')).toBe(2);
    expect(surfaceCountForCode('8354')).toBe(4);
    expect(surfaceCountForCode('8373')).toBe(3);
    expect(surfaceCountForCode('8101')).toBeNull();
    expect(restorationSide('8352')).toBe('front');
    expect(restorationSide('8369')).toBe('back');
    expect(restorationSide('8342')).toBe('back');
    expect(restorationSide('8411')).toBeNull();
  });

  it('chooses the code from the tooth, the surfaces and the material', () => {
    expect(fillingCodeFor('36', 3, 'resin')).toBe('8369');
    expect(fillingCodeFor('11', 2, 'resin')).toBe('8352');
    expect(fillingCodeFor('36', 5, 'resin')).toBe('8370');
    expect(fillingCodeFor('36', 2, 'amalgam')).toBe('8342');
    expect(fillingCodeFor('36', 0, 'resin')).toBeNull();
  });
});

// Business rule: the fund pays a restoration by its code, and the code says how many surfaces were filled (8367 one,
// 8368 two, 8369 three, 8370 four or more). A code that does not match the surfaces marked over- or under-charges, so
// the Billing tab and claim review name the code that fits, in the same series (resin stays resin, front stays front).
describe('the code must match the surfaces marked', () => {
  it('names the code of the same series for the surfaces marked', () => {
    expect(codeForSurfaceCount('8369', 2)).toBe('8368');
    expect(codeForSurfaceCount('8341', 3)).toBe('8343');
    expect(codeForSurfaceCount('8351', 5)).toBe('8354');
    expect(codeForSurfaceCount('8372', 1)).toBe('8371');
    expect(codeForSurfaceCount('8201', 2)).toBeNull();
  });

  it('says what is wrong and what fits', () => {
    expect(surfaceCodeProblem('8369', 'MO')).toEqual({
      message: '8369 is for 3 surfaces, but 2 are marked (M O). Use 8368, the code for 2 surfaces.',
      suggestedCode: '8368'
    });
    expect(surfaceCodeProblem('8367', 'MODB')?.suggestedCode).toBe('8370');
    expect(surfaceCodeProblem('8370', 'M')?.message).toMatch(/^8370 is for 4 or more surfaces, but 1 is marked \(M\)\. Use 8367/);
  });

  it('is quiet when the code fits, nothing is marked, or the code is not billed by surfaces', () => {
    expect(surfaceCodeProblem('8368', 'MO')).toBeNull();
    expect(surfaceCodeProblem('8370', 'MODBL')).toBeNull();
    expect(surfaceCodeProblem('8369', null)).toBeNull();
    expect(surfaceCodeProblem('8201', 'MO')).toBeNull();
  });
});

// Business rule: root canal and crown codes differ by tooth (molars, milk teeth); the first suggestion is the one
// a practitioner usually means, so planning takes one tap.
describe('codes suggested for planned work', () => {
  it('suggests the molar root canal codes for molars and the others for front teeth and premolars', () => {
    expect(suggestedCodes('root_canal', '46')[0]).toBe('8339');
    expect(suggestedCodes('root_canal', '14')[0]).toBe('8338');
  });

  it('suggests a preformed metal crown first on a milk tooth', () => {
    expect(suggestedCodes('crown', '84')[0]).toBe('8357');
    expect(suggestedCodes('crown', '36')[0]).toBe('8411');
  });

  it('has nothing to suggest for other work: the practitioner searches the list', () => {
    expect(suggestedCodes('other', '36')).toEqual([]);
  });
});
