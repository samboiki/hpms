import { describe, it, expect } from 'vitest';
import {
  EMPTY_TARIFF_ICD10_DATA,
  MAX_LEARNED_SUGGESTIONS,
  MAX_STARTER_SUGGESTIONS,
  learnedReason,
  suggestionsForTariff,
  toLearnedMap,
  toStarterMap,
  type TariffIcd10Data
} from '../tariffIcd10Suggestions';

// Business rule: the diagnosis on a claim line is the practitioner's, chosen for that patient. There is no official
// NAMAF or fund table that links a tariff code to ICD-10 codes, so the app may only SUGGEST codes, in an order the
// practitioner can trust: first what the practice itself decided, then what it has actually billed, then a reviewed
// starter list for codes whose own wording names the situation.
const data = (parts: Partial<TariffIcd10Data>): TariffIcd10Data => ({ ...EMPTY_TARIFF_ICD10_DATA, ...parts });

describe('the order of the suggestions', () => {
  it("offers the practice's own usual code first, then what it billed most, then the starter codes", () => {
    const suggestions = suggestionsForTariff(
      '2601',
      data({
        usual: new Map([['2601', 'Z34.0']]),
        learned: new Map([['2601', [{ code: 'Z34.9', timesUsed: 12 }, { code: 'O26.9', timesUsed: 2 }]]]),
        starter: new Map([['2601', [{ code: 'Z34.9', reason: 'Antenatal visit' }, { code: 'Z35.9', reason: 'High-risk' }]]])
      })
    );
    expect(suggestions.map(item => [item.code, item.source])).toEqual([
      ['Z34.0', 'practice'],
      ['Z34.9', 'learned'],
      ['O26.9', 'learned'],
      ['Z35.9', 'starter']
    ]);
  });

  // The practitioner should see one row per code; the stronger evidence (their own choice, then their own billing) wins
  it('shows each code once, keeping the strongest source', () => {
    const suggestions = suggestionsForTariff(
      '0102',
      data({
        usual: new Map([['0102', 'Z01.8']]),
        learned: new Map([['0102', [{ code: 'Z01.8', timesUsed: 5 }]]]),
        starter: new Map([['0102', [{ code: 'Z01.8', reason: 'Before an operation' }]]])
      })
    );
    expect(suggestions).toEqual([{ code: 'Z01.8', source: 'practice', reason: "Your practice's usual code for 0102" }]);
  });

  it('keeps the code box short: at most 3 learned and 3 starter codes, and a repeated code does not use up a place', () => {
    const learned = ['A01.0', 'A02.0', 'A03.0', 'A04.0', 'A05.0'].map((code, index) => ({ code, timesUsed: 9 - index }));
    const starter = ['B01.0', 'B02.0', 'B03.0', 'B04.0'].map(code => ({ code, reason: `Reason ${code}` }));
    const suggestions = suggestionsForTariff('0101', data({ learned: new Map([['0101', learned]]), starter: new Map([['0101', starter]]) }));
    expect(suggestions.filter(item => item.source === 'learned')).toHaveLength(MAX_LEARNED_SUGGESTIONS);
    expect(suggestions.filter(item => item.source === 'starter')).toHaveLength(MAX_STARTER_SUGGESTIONS);

    const repeated = suggestionsForTariff(
      '0101',
      data({ usual: new Map([['0101', 'A01.0']]), learned: new Map([['0101', learned]]) })
    );
    expect(repeated.map(item => item.code)).toEqual(['A01.0', 'A02.0', 'A03.0', 'A04.0']);
  });

  // The billing line holds "0190 ", "0190" and "0190" typed in lower case alike; suggestions must not depend on that
  it('finds the same suggestions however the tariff code was typed', () => {
    const suggestions = data({ learned: new Map([['NA70001', [{ code: 'Z01.0', timesUsed: 3 }]]]) });
    expect(suggestionsForTariff(' na70001 ', suggestions).map(item => item.code)).toEqual(['Z01.0']);
  });

  it('offers nothing for a line without a tariff code, or for a code nobody has said anything about', () => {
    expect(suggestionsForTariff('', data({ usual: new Map([['', 'J06.9']]) }))).toEqual([]);
    expect(suggestionsForTariff('9999', EMPTY_TARIFF_ICD10_DATA)).toEqual([]);
  });

  // The funds reject an external cause code as the main code of a line, and so does the line editor
  it('never suggests a code that cannot be the main code of a line', () => {
    const suggestions = suggestionsForTariff(
      '0101',
      data({ usual: new Map([['0101', 'W19']]), learned: new Map([['0101', [{ code: 'Y92.0', timesUsed: 4 }, { code: 'J06.9', timesUsed: 1 }]]]) })
    );
    expect(suggestions.map(item => item.code)).toEqual(['J06.9']);
  });
});

describe('what the practice has billed', () => {
  // The database counts and orders them; the app must keep that order and not trust malformed rows
  it('keeps the most used code first and leaves out rows that are not codes or counts', () => {
    const learned = toLearnedMap([
      { tariff_code: '0101', icd10_code: 'I10', times_used: 2 },
      { tariff_code: '0101', icd10_code: 'J06.9', times_used: '6' },
      { tariff_code: ' 0101 ', icd10_code: 'j069', times_used: 1 },
      { tariff_code: '0101', icd10_code: 'not a code', times_used: 9 },
      { tariff_code: '0101', icd10_code: 'V01.0', times_used: 9 },
      { tariff_code: '0101', icd10_code: 'K02.1', times_used: 0 },
      { tariff_code: null, icd10_code: 'I10', times_used: 3 },
      { tariff_code: '0102', icd10_code: null, times_used: 3 }
    ]);
    expect(learned.get('0101')).toEqual([
      { code: 'J06.9', timesUsed: 7 },
      { code: 'I10', timesUsed: 2 }
    ]);
    expect(learned.size).toBe(1);
  });

  it('puts codes used equally often in code order, so the list does not jump about between visits', () => {
    const learned = toLearnedMap([
      { tariff_code: '0101', icd10_code: 'K05.1', times_used: 3 },
      { tariff_code: '0101', icd10_code: 'K02.1', times_used: 3 }
    ]);
    expect(learned.get('0101')?.map(item => item.code)).toEqual(['K02.1', 'K05.1']);
  });

  it('says in plain words how often the practice used a code with a tariff code', () => {
    expect(learnedReason('0102', 14)).toBe('Billed with 0102 14 times in the last 2 years');
    expect(learnedReason(' 0102 ', 1)).toBe('Billed with 0102 once in the last 2 years');
  });
});

describe('the starter list', () => {
  it('keeps the list order and leaves out rows without a usable code or a reason', () => {
    const starter = toStarterMap([
      { code: '450', icd10_code: 'Z76.2', sort_order: 2, rationale: 'Health supervision of a healthy infant' },
      { code: '450', icd10_code: 'Z00.1', sort_order: 1, rationale: ' Routine child health examination ' },
      { code: '450', icd10_code: 'Z00.1', sort_order: 1, rationale: 'The same code again' },
      { code: '450', icd10_code: 'Z00.2', sort_order: 1, rationale: '   ' },
      { code: '450', icd10_code: 'W19', sort_order: 1, rationale: 'An external cause code' },
      { code: '451', icd10_code: null, sort_order: 1, rationale: 'No code' }
    ]);
    expect(starter.get('450')).toEqual([
      { code: 'Z00.1', reason: 'Routine child health examination' },
      { code: 'Z76.2', reason: 'Health supervision of a healthy infant' }
    ]);
    expect(starter.has('451')).toBe(false);
  });

  // A link that follows a published standard says so, so nobody mistakes it for a NAMAF rule or for OneHealth's own reasoning
  it('says when a starter link follows the South African coding standards', () => {
    const starter = toStarterMap([
      { code: '107', icd10_code: 'Z53.2', sort_order: 1, rationale: 'Patient did not come', source: 'sa-standard' },
      { code: '107', icd10_code: 'Z53.9', sort_order: 2, rationale: 'Own reasoning', source: 'starter' }
    ]);
    expect(starter.get('107')).toEqual([
      { code: 'Z53.2', reason: 'Patient did not come (South African coding standard)' },
      { code: 'Z53.9', reason: 'Own reasoning' }
    ]);
  });

  // The starter reason is shown as it is stored: it must read as a suggestion, never as a rule
  it('shows the stored reason under the code', () => {
    const suggestions = suggestionsForTariff(
      '09997',
      data({ starter: toStarterMap([{ code: '09997', icd10_code: 'Z26.9', sort_order: 1, rationale: "Immunisation, vaccine not named: use the vaccine's own code" }]) })
    );
    expect(suggestions).toEqual([{ code: 'Z26.9', source: 'starter', reason: "Immunisation, vaccine not named: use the vaccine's own code" }]);
  });
});
