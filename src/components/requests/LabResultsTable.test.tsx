import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LabResultsTable from './LabResultsTable';
import { supabase } from '../../lib/supabase';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../lib/geminiClient', () => ({ isGeminiConfigured: () => false, geminiExtractLabResults: vi.fn() }));

type QueryResult = { data: unknown; error: unknown };

// Stands in for the chainable, awaitable Supabase query builder (select/eq/order, then await)
function query(result: QueryResult) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const completedRequest = {
  id: 'request-1',
  request_date: '2026-10-05',
  preferred_date: null,
  lab_facility: 'PathCare',
  status: 'completed',
  notes: null,
  media_url: null,
  created_at: '2026-10-05T08:00:00Z',
};

const result = (id: string, test_name: string, test_value: string, test_unit: string, reference_range: string) => (
  { id, lab_request_id: 'request-1', test_name, test_value, test_unit, reference_range, status: null }
);

describe('LabResultsTable', () => {
  afterEach(cleanup);
  beforeEach(() => vi.resetAllMocks());

  it('spells out High or Low next to out-of-range results, so an abnormal value is never shown as normal or by colour alone', async () => {
    vi.mocked(supabase.from).mockImplementation((table) => (String(table) === 'lab_requests'
      ? query({ data: [completedRequest], error: null })
      : query({
          data: [
            result('r1', 'CRP', '48', 'mg/L', '<5'),
            result('r2', 'Haemoglobin', '9.8', 'g/dL', '13.0-17.0'),
            result('r3', 'Glucose', '5.4', 'mmol/L', '3.9-5.6'),
          ],
          error: null,
        })) as never);

    render(<LabResultsTable patientId="patient-1" visitId="visit-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /View Results \(3\)/ }));

    const row = (testName: string) => within(screen.getByText(testName).closest('tr') as HTMLElement);
    // "<5" upper-limit ranges used to be unreadable, so a CRP of 48 counted as normal
    expect(row('CRP').getByText('High')).toBeTruthy();
    expect(row('Haemoglobin').getByText('Low')).toBeTruthy();
    expect(row('Glucose').queryByText('High')).toBeNull();
    expect(row('Glucose').queryByText('Low')).toBeNull();
  });

  it('blocks a new lab request on an unsaved visit and says why, instead of letting the database reject it', async () => {
    vi.mocked(supabase.from).mockImplementation(() => query({ data: [], error: null }) as never);

    render(<LabResultsTable patientId="patient-1" visitId="" />);

    const button = await screen.findByRole('button', { name: /New Lab Request/ });
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Save the visit first, then open it again to add lab requests.')).toBeTruthy();
  });

  it('lets the user start a lab request once the visit exists', async () => {
    vi.mocked(supabase.from).mockImplementation(() => query({ data: [], error: null }) as never);

    render(<LabResultsTable patientId="patient-1" visitId="visit-1" />);

    const button = await screen.findByRole('button', { name: /New Lab Request/ });
    expect((button as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByText('No lab requests yet')).toBeTruthy();
  });
});
