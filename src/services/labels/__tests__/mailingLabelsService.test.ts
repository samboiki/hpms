import { afterEach, describe, expect, it, vi } from 'vitest';

const supabaseMock = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ supabase: supabaseMock }));

import { loadMailingSources } from '../mailingLabelsService';
import { mailingLines } from '../../../utils/labels/labelContent';

/** A query that answers `result` whatever is chained, and remembers the columns asked for */
const query = (result: unknown, asked: string[]) => {
  const chain: Record<string, unknown> = {};
  chain.select = vi.fn((columns: string) => {
    asked.push(columns);
    return chain;
  });
  chain.in = vi.fn(() => Promise.resolve(result));
  return chain;
};

// An invented patient with a PO Box and the town picked from the towns list
const ROW = { id: 'patient-1', title: 'Mrs', initials: 'N', first_name: 'Ndapewa', last_name: 'Example', postal_address: 'PO Box 1', postal_code: '9000', home_address: null };

afterEach(() => supabaseMock.from.mockReset());

describe('mailing labels', () => {
  // A label to "PO Box 1 9000" with no town would not be delivered: the town picker keeps the town in its own field
  it("print the patient's town from the town picker", async () => {
    const asked: string[] = [];
    supabaseMock.from.mockImplementation(() => query({ data: [{ ...ROW, town: 'Windhoek' }], error: null }, asked));
    const sources = await loadMailingSources(['patient-1']);
    expect(asked[0]).toContain('town');
    expect(mailingLines(sources.get('patient-1') ?? {})).toEqual(['Mrs N Example', 'PO Box 1', 'Windhoek 9000']);
  });

  it('still print, with the address alone, before the database has the town column', async () => {
    const asked: string[] = [];
    const answers = [{ data: null, error: { code: '42703', message: 'column patients.town does not exist' } }, { data: [ROW], error: null }];
    supabaseMock.from.mockImplementation(() => query(answers.shift(), asked));
    const sources = await loadMailingSources(['patient-1']);
    expect(asked).toHaveLength(2);
    expect(asked[1]).not.toContain('town');
    expect(mailingLines(sources.get('patient-1') ?? {})).toEqual(['Mrs N Example', 'PO Box 1 9000']);
  });
});
