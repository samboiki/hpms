/**
 * The dashboard's finance window used to email claim files itself: its Submit buttons called the send-batch-email
 * function, which built the file in the database with no ICD-10 check (a claim line without an ICD-10 code is not paid,
 * NAMAF Circular 4 of 2025), under another program's name, to a made-up address when the fund had none. A claim file now
 * goes to a medical aid from one place only, Finance > Batches, where every line is checked first. These tests keep it
 * that way: the window opens that review and calls no function, makes no database change and asks nothing itself.
 * Invented data only.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

const spy = vi.hoisted(() => ({
  invoke: vi.fn(),
  rpc: vi.fn(),
  writes: [] as string[],
  batches: [] as Array<Record<string, unknown>>
}));

// Every read answers from the table named; every attempt to write, call a function or run a database function is noted
vi.mock('../../../lib/supabase', () => {
  const answer = (table: string) =>
    table === 'practices'
      ? { data: { id: 'practice-1', name: 'Example Practice', practice_number: '0000001' }, error: null }
      : table === 'batch_management_view'
        ? { data: spy.batches, error: null, count: spy.batches.length }
        : { data: [], error: null };
  const query = (table: string): unknown =>
    new Proxy(
      {},
      {
        get: (_target, key) => {
          if (key === 'then') return (resolve: (value: unknown) => unknown) => Promise.resolve(answer(table)).then(resolve);
          if (key === 'insert' || key === 'update' || key === 'upsert' || key === 'delete') {
            return () => {
              spy.writes.push(`${table}.${String(key)}`);
              return query(table);
            };
          }
          return () => query(table);
        }
      }
    );
  return {
    supabase: {
      from: (table: string) => query(table),
      rpc: (...args: unknown[]) => {
        spy.rpc(...args);
        return query('rpc');
      },
      functions: {
        invoke: (...args: unknown[]) => {
          spy.invoke(...args);
          return Promise.resolve({ data: null, error: null });
        }
      }
    }
  };
});

// The same objects on every render, as the real stores give
const stores = vi.hoisted(() => ({
  auth: { user: { id: 'user-1', practice_id: 'practice-1', practices: { name: 'Example Practice' } }, selectedPracticeId: null },
  theme: { currentTheme: { gradients: {} } },
  kpis: {
    totalBilledMTD: 0,
    totalCollectedMTD: 0,
    totalOutstanding: 0,
    claimsInProgress: 0,
    invoiceCount: 0,
    monthlyRevenueTrend: [],
    invoiceVolumeTrend: [],
    revenueByStatus: [],
    topServices: [],
    medicalAidBreakdown: [],
    practitionerPerformance: [],
    statusSummary: {},
    recentInvoices: [],
    recentPaidInvoices: []
  }
}));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => stores.auth }));
vi.mock('../../../stores/themeStore', () => ({ useTheme: () => stores.theme }));
vi.mock('../../../services/financialKpiService', () => ({ financialKpiService: { getFinancialKPIs: vi.fn(async () => stores.kpis) } }));

// The charts size themselves with a ResizeObserver, which jsdom lacks
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

import EnhancedFinancialModal from '../EnhancedFinancialModal';

const ACTIVE_ID = '11111111-1111-4111-8111-111111111111';
const PAID_ID = '22222222-2222-4222-8222-222222222222';

const batchRow = (id: string, number: number, status: string) => ({
  batch_id: id,
  practice_number: '0000001',
  batch_number: String(number),
  batch_date: '2025-06-30',
  medical_aid_reference: 'NMC1',
  status,
  total_invoices: 3,
  total_amount: 1234.5,
  created_at: '2025-06-30T08:00:00Z',
  sent_at: null,
  confirmed_at: null,
  medical_aid_name: 'Example Medical Aid',
  medical_aid_short_name: 'EMA',
  medical_aid_email: 'claims@fund.example',
  medical_aid_logo_url: '',
  medical_aid_theme_color: '#1f97d5',
  practice_name: 'Example Practice',
  practice_email: 'office@practice.example',
  detail_transactions: 7,
  total_detail_transactions: 7,
  total_amount_detail_transactions: 1234.5,
  dat_filename: 'example'
});

const Where = () => {
  const location = useLocation();
  return <p data-testid="where">{location.pathname + location.search}</p>;
};

const onClose = vi.fn();

function openBatchesTab() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route
          path="/"
          element={
            <EnhancedFinancialModal
              isOpen
              onClose={onClose}
              data={{
                type: 'finance',
                title: 'Finance',
                subtitle: '',
                overview: { total: 0, change: '0%', isPositive: true, period: 'This month' },
                breakdown: [],
                chartData: { labels: [], datasets: [] },
                insights: []
              }}
            />
          }
        />
        <Route path="/finance" element={<Where />} />
      </Routes>
    </MemoryRouter>
  );
  return screen.findByRole('button', { name: /Batch Management/ }).then(tab => fireEvent.click(tab));
}

/** The window made no call that could send or change anything */
function expectNothingSent() {
  expect(spy.invoke).not.toHaveBeenCalled();
  expect(spy.rpc).not.toHaveBeenCalled();
  expect(spy.writes).toEqual([]);
}

beforeEach(() => {
  spy.invoke.mockClear();
  spy.rpc.mockClear();
  spy.writes.length = 0;
  spy.batches = [];
  onClose.mockClear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the dashboard's finance window sends nothing", () => {
  // Submit looked like the way to send a batch, so it has to lead to the one place that checks the lines before they go
  it("Submit opens that batch's claim review in Finance > Batches and nothing is sent", async () => {
    spy.batches = [batchRow(ACTIVE_ID, 41, 'active')];
    await openBatchesTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Submit' }));

    expect((await screen.findByTestId('where')).textContent).toBe(`/finance?tab=batch-management&batch=${ACTIVE_ID}`);
    expect(onClose).toHaveBeenCalled();
    expectNothingSent();
  });

  // The bulk button used to ask "Send all N active batches?" and email them all at once, cannot be recalled
  it('Submit All Active opens the open batches in Finance > Batches, asks nothing and sends nothing', async () => {
    const confirm = vi.spyOn(window, 'confirm');
    spy.batches = [batchRow(ACTIVE_ID, 41, 'active'), batchRow(PAID_ID, 40, 'paid')];
    await openBatchesTab();
    fireEvent.click(await screen.findByRole('button', { name: 'Submit All Active' }));

    expect((await screen.findByTestId('where')).textContent).toBe('/finance?tab=batch-management');
    expect(confirm).not.toHaveBeenCalled();
    expectNothingSent();
  });

  // A batch the fund already has cannot be sent again; the button says so in words instead of failing when pressed
  it('a batch that was already sent cannot be opened with Submit, and its button says why', async () => {
    spy.batches = [batchRow(ACTIVE_ID, 41, 'active'), batchRow(PAID_ID, 40, 'paid')];
    await openBatchesTab();
    await screen.findAllByRole('button', { name: 'Submit' });
    fireEvent.click(screen.getByText('Paid').nextElementSibling as Element);

    const buttons = await screen.findAllByRole('button', { name: 'Submit' });
    expect(buttons).toHaveLength(2);
    expect((buttons[0] as HTMLButtonElement).disabled).toBe(false);
    expect((buttons[1] as HTMLButtonElement).disabled).toBe(true);
    expect(buttons[1].getAttribute('title')).toMatch(/already sent to the medical aid/i);

    fireEvent.click(buttons[1]);
    expect(screen.queryByTestId('where')).toBeNull();
    expectNothingSent();
  });

  it('Submit All Active is off when no batch is waiting, and says so', async () => {
    spy.batches = [batchRow(PAID_ID, 40, 'paid')];
    await openBatchesTab();
    const all = await screen.findByRole('button', { name: 'Submit All Active' });
    expect((all as HTMLButtonElement).disabled).toBe(true);
    expect(all.getAttribute('title')).toBe('No active batches to submit');
  });

  // A sender cannot creep back in unnoticed: nothing in the window's code can call a function, run a database function or
  // change a row (it only reads the practice's batches)
  it('the window\'s code holds no call that could send or change anything', () => {
    const source = readFileSync('src/components/modals/EnhancedFinancialModal.tsx', 'utf8');
    expect(source).not.toMatch(/functions\s*\.\s*invoke|send-batch-email|prepare_batch_for_sending|\.rpc\s*\(|sendEmail|sendSMS|window\.confirm/);
    expect(source).not.toMatch(/\.\s*(insert|update|upsert|delete)\s*\(/);
  });
});
