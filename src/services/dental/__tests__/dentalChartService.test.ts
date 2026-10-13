import { describe, it, expect, vi } from 'vitest';
import { isDentalChartNotSetUp, loadIsDentalPractice, toChartChange, toChartEntry } from '../dentalChartService';

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

// Business rule: the chart is NAMAF dental work. Only practices typed 'dental' get it, and a practice whose type cannot
// be read gets nothing dental rather than a broken or wrong screen.
describe('which practices get the tooth chart', () => {
  it('is a dental practice only when its type says so', async () => {
    practiceTypes['dental-1'] = { data: { practice_type: 'dental' }, error: null };
    practiceTypes['gp-1'] = { data: { practice_type: 'general' }, error: null };
    practiceTypes['broken-1'] = { data: null, error: { message: 'network down' } };
    expect(await loadIsDentalPractice('dental-1')).toBe(true);
    expect(await loadIsDentalPractice('gp-1')).toBe(false);
    expect(await loadIsDentalPractice('broken-1')).toBe(false);
  });

  it('asks again after a failed read, so a passing network error does not hide the chart for the session', async () => {
    practiceTypes['retry-1'] = { data: null, error: { message: 'network down' } };
    expect(await loadIsDentalPractice('retry-1')).toBe(false);
    practiceTypes['retry-1'] = { data: { practice_type: 'dental' }, error: null };
    expect(await loadIsDentalPractice('retry-1')).toBe(true);
  });
});

// Business rule: until the dental chart update is applied the Teeth view must keep working (billed history, "not set
// up yet"); but a missing table or function that is not the chart's is a real error and must be shown as one.
describe('telling "not set up yet" from a real error', () => {
  it('recognises the chart tables and functions only', () => {
    expect(isDentalChartNotSetUp({ code: '42P01', message: 'relation "public.dental_chart_entries" does not exist' })).toBe(true);
    expect(isDentalChartNotSetUp({ code: 'PGRST205', message: "Could not find the table 'public.dental_chart_changes' in the schema cache" })).toBe(true);
    expect(isDentalChartNotSetUp({ code: 'PGRST202', message: 'Could not find the function public.dental_chart_add(p_entries, p_patient_id)' })).toBe(true);
    expect(isDentalChartNotSetUp({ code: '42P01', message: 'relation "public.quotes" does not exist' })).toBe(false);
    expect(isDentalChartNotSetUp({ code: '42501', message: 'Only staff of the patient\'s practice can change this dental chart' })).toBe(false);
  });
});

// Business rule: the history says who recorded and who changed what (the database stamps them; the screen shows names).
describe('reading chart rows', () => {
  it('keeps who recorded an entry and who made a change', () => {
    const entry = toChartEntry({
      id: 'e1',
      tooth: '36',
      surfaces: 'MOD',
      work: 'filling',
      status: 'planned',
      tariff_code: '8369',
      plan_visit: 1,
      plan_order: 2,
      recorded_at: '2026-10-07T10:00:00Z',
      recorder: { full_name: 'A Practitioner' },
      voider: null
    });
    expect(entry).toMatchObject({ tooth: '36', surfaces: 'MOD', work: 'filling', status: 'planned', tariffCode: '8369', planVisit: 1, planOrder: 2, recordedBy: 'A Practitioner' });
    const change = toChartChange({ id: 7, entry_id: 'e1', action: 'status', from_status: 'planned', to_status: 'done', changed_at: '2026-10-08T09:00:00Z', changer: [{ full_name: 'A Nurse' }] });
    expect(change).toMatchObject({ id: '7', entryId: 'e1', action: 'status', fromStatus: 'planned', toStatus: 'done', changedBy: 'A Nurse' });
  });

  it('never draws a row it does not understand as work on a tooth', () => {
    expect(toChartEntry({ id: 'e2', tooth: '11', work: 'veneer', status: 'archived', recorded_at: '2026-10-07T10:00:00Z' })).toMatchObject({ work: 'other', status: 'removed' });
  });
});
