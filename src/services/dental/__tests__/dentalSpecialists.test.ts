import { describe, expect, it, vi } from 'vitest';
import { loadIsDentalPractice } from '../dentalChartService';

// The practices table answers per id: nothing here reaches the database
const { practiceTypes } = vi.hoisted(() => ({ practiceTypes: {} as Record<string, { data: unknown; error: unknown }> }));
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    from: () => {
      let id = '';
      const query = {
        select: () => query,
        eq: (_column: string, value: string) => {
          id = value;
          return query;
        },
        maybeSingle: () => Promise.resolve(practiceTypes[id])
      };
      return query;
    }
  }
}));

// Business rule (owner, 14 Oct 2026): dental specialists are their own practice types that work like dental. The Teeth
// tab, the tooth chart links and the lab work follow loadIsDentalPractice, so an orthodontist's practice must get them,
// as must the one practice typed 'dental_practice'; the dental laboratory has no patients' teeth to chart.
describe('which practices get the tooth chart', () => {
  it.each(['orthodontist', 'maxillofacial_oral_surgeon', 'periodontist', 'prosthodontist', 'dental_therapist', 'dental_practice'])(
    'gives a practice of type %s the tooth chart',
    async type => {
      practiceTypes[`${type}-1`] = { data: { practice_type: type }, error: null };
      expect(await loadIsDentalPractice(`${type}-1`)).toBe(true);
    }
  );

  it.each(['dental_technician', 'medical', 'urology', 'optometry'])('gives a practice of type %s none', async type => {
    practiceTypes[`${type}-1`] = { data: { practice_type: type }, error: null };
    expect(await loadIsDentalPractice(`${type}-1`)).toBe(false);
  });
});
