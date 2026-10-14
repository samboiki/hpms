/**
 * The practice typed 'dental_practice' (owner, 14 Oct 2026: it matches no practice type, so the app treats it as 'dental'
 * and its stored text is not changed). Why: if only the tooth chart read it as dental, the practice would still be given
 * no shared dental price list and no dentist fund prices, because those are looked up by the type's name. Invented rows.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const calls = vi.hoisted(() => [] as Array<{ table: string; column: string; value: unknown }>);

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => {
      const builder: Record<string, unknown> = {};
      ['select', 'order', 'limit', 'in', 'range', 'is', 'neq', 'not', 'or', 'gte', 'lte'].forEach(method => {
        builder[method] = () => builder;
      });
      builder.eq = (column: string, value: unknown) => {
        calls.push({ table, column, value });
        return builder;
      };
      builder.maybeSingle = () => Promise.resolve({ data: null, error: null });
      builder.then = (resolve: (value: unknown) => unknown) => Promise.resolve({ data: [], error: null }).then(resolve);
      return builder;
    },
    rpc: () => Promise.resolve({ data: [], error: null })
  }
}));

import { loadFundPriceBook } from '../fundPricingService';
import { loadPracticeTariffRows } from '../practiceTariffService';

/** The type names asked of a table, in order */
const askedOf = (table: string) => calls.filter(call => call.table === table && call.column === 'practice_type_name').map(call => call.value);

beforeEach(() => {
  calls.length = 0;
});

describe("the price lists of the practice typed 'dental_practice'", () => {
  it("reads the shared dental price list, as the type's name, however the text is typed", async () => {
    await loadPracticeTariffRows('practice-1', 'dental_practice');
    await loadPracticeTariffRows('practice-1', ' Dental_Practice ');
    expect(askedOf('practice_tariffs_with_types')).toEqual(['dental', 'dental']);
  });

  it('reads the dentist fund prices too', async () => {
    await loadFundPriceBook('practice-1', 'dental_practice');
    expect(askedOf('fund_tariffs_with_types')).toEqual(['dental']);
  });

  it("asks for a specialist's own type name, which has no shared list of its own (its NAMAF list is the price list)", async () => {
    await loadPracticeTariffRows('practice-1', 'orthodontist');
    expect(askedOf('practice_tariffs_with_types')).toEqual(['orthodontist']);
  });
});
