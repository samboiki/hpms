import { describe, it, expect } from 'vitest';
import {
  DEFAULT_INFECTION_CONTROL_STAFF,
  INFECTION_CONTROL_CODE,
  MATERIAL_FACTOR_CODE,
  MAX_INFECTION_CONTROL_STAFF,
  PER_VISIT_CODES,
  RESTORATION_CODES,
  infectionControlStaffCount,
  isDentalPractice,
  isPerVisitCode,
  isRestorationCode
} from '../tariffRules';

// The lists as each screen kept its own copy before they moved to tariffRules.ts (AddVisitTabs, EditVisitTabs,
// EnhancedDentalServiceSelector, quotes/billingLines.ts). One list must give exactly the same answers, or a screen
// would start (or stop) adding an 8346 line or a once-per-visit code.
const OLD_RESTORATIVE_MATERIAL_CODES = ['8341', '8342', '8343', '8344', '8351', '8352', '8353', '8354', '8367', '8368', '8369', '8370'];
const OLD_PER_VISIT_CODES = ['8109', '8110', '8145'];

describe('tariffRules code lists are the single source', () => {
  it('holds the same restoration codes the screens used, and only those', () => {
    expect([...RESTORATION_CODES].sort()).toEqual([...OLD_RESTORATIVE_MATERIAL_CODES].sort());
    for (let code = 8000; code <= 9999; code += 1) {
      expect(isRestorationCode(String(code))).toBe(OLD_RESTORATIVE_MATERIAL_CODES.includes(String(code)));
    }
  });

  it('holds the same once-per-visit codes, the same 8109 and 8346, and compares codes without case or spaces', () => {
    expect([...PER_VISIT_CODES]).toEqual(OLD_PER_VISIT_CODES);
    expect(INFECTION_CONTROL_CODE).toBe('8109');
    expect(MATERIAL_FACTOR_CODE).toBe('8346');
    expect(isPerVisitCode(' 8145 ')).toBe(true);
    expect(isPerVisitCode('8101')).toBe(false);
    expect(isRestorationCode(' 8369')).toBe(true);
  });
});

// Business rule: NAMAF bills 8109 per dentist, hygienist and assistant at the visit; the practice billed 2 on 99.5% of
// its lines. The practice setting decides the default; a missing or unusable setting keeps the old single unit.
describe('infectionControlStaffCount', () => {
  it('reads the practice setting as a whole number from 1 to 3, as a number or text', () => {
    expect(infectionControlStaffCount(2)).toBe(2);
    expect(infectionControlStaffCount('3')).toBe(3);
    expect(infectionControlStaffCount(1)).toBe(1);
    expect(MAX_INFECTION_CONTROL_STAFF).toBe(3);
  });

  it.each([null, undefined, '', 'two', 0, 4, 2.5, -1, Number.NaN, { value: 2 }])('falls back to one staff member for %s', value => {
    expect(infectionControlStaffCount(value)).toBe(DEFAULT_INFECTION_CONTROL_STAFF);
    expect(DEFAULT_INFECTION_CONTROL_STAFF).toBe(1);
  });

  it('treats only dental practice types as dental', () => {
    expect(isDentalPractice(' Dental ')).toBe(true);
    expect(isDentalPractice('medical')).toBe(false);
    expect(isDentalPractice('aesthetic')).toBe(false);
    expect(isDentalPractice(null)).toBe(false);
  });
});
