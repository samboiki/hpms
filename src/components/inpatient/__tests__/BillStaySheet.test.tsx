/**
 * The sheet where a discharged stay is billed. Why it matters: a bed whose rate was never entered used to stop the stay being
 * billed ("an administrator sets it"), and a ward fee with no fixed amount would have gone to the fund at N$ 0. Now the night is
 * billed at the code's NAMAF amount, or the person billing types the amount, and every line says where its amount came from so
 * nobody has to guess why two nights differ. Invented patient, beds, codes and amounts.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import type { AdmissionDetail, Bed, WardBoard } from '../../../services/inpatientService';
import { wardDayTariffs } from '../../../utils/billing/namafTariffs';

const mocks = vi.hoisted(() => ({ createInvoice: vi.fn(), markStayBilled: vi.fn(), wardDayCodes: [] as unknown[] }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../lib/queryClient', () => ({ refreshAfterSave: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../../../services/invoiceService', () => ({ invoiceService: { createInvoice: mocks.createInvoice } }));
vi.mock('../../../services/inpatientService', async () => {
  const actual = await vi.importActual<typeof import('../../../services/inpatientService')>('../../../services/inpatientService');
  return { ...actual, markStayBilled: mocks.markStayBilled, loadPatientVisits: vi.fn().mockResolvedValue([]) };
});
vi.mock('../../../contexts/PracticeTariffsContext', () => ({ usePracticeTariffs: () => ({ allTariffs: [], isLoading: false, practiceType: 'medical' }) }));
vi.mock('../useWardTariffs', async () => {
  const actual = await vi.importActual<typeof import('../useWardTariffs')>('../useWardTariffs');
  return { ...actual, useWardTariffs: () => ({ data: { practiceList: [], wardDayCodes: mocks.wardDayCodes }, isLoading: false }) };
});

import { BillStaySheet } from '../BillStaySheet';

const wardFees = wardDayTariffs([
  { id: '55555555-5555-4555-8555-555555555501', discipline_code: '057', tariff_code: '57001', code: '001', description: 'SURGICAL CASES: PER DAY', amount: 0, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' },
  { id: '55555555-5555-4555-8555-555555555507', discipline_code: '057', tariff_code: '57007', code: '007', description: 'DAY ADMISSION', amount: 2914.1, units: 0, valid_from: '2026-01-01', valid_to: '2026-12-31' }
]);

/** A stay of two nights (10 and 11 October 2026) in one bed of a ward billed under `bedDayCode` */
const stay = (bedDayCode: string, dailyRate: number | null) => {
  const board = {
    wards: [{ id: 'w1', ward_name: 'Day ward', bed_day_code: bedDayCode, daily_codes: [] }],
    beds: [{ id: 'b1', ward_id: 'w1', bed_number: 'D1', daily_rate: dailyRate } as unknown as Bed],
    active: [],
    current: []
  } as unknown as WardBoard;
  const data = {
    admission: {
      id: 'adm-1', admission_number: 'ADM-2026-000001', patient_id: 'p1', visit_id: 'visit-1', actual_discharge_date: '2026-10-12T08:00:00Z',
      attending_doctor_id: 'doc-1', primary_diagnosis_code: 'J18.9', secondary_diagnosis_codes: null, pre_authorization_number: null,
      patients: { first_name: 'Test', last_name: 'Patient' }
    },
    allocations: [{ id: 'a1', admission_id: 'adm-1', bed_id: 'b1', ward_id: 'w1', allocated_at: '2026-10-10T08:00:00Z', released_at: null, is_current: true }]
  } as unknown as AdmissionDetail;
  return { board, data };
};

const open = ({ board, data }: ReturnType<typeof stay>) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <BillStaySheet data={data} board={board} practiceId="practice-1" onClose={vi.fn()} />
      </MemoryRouter>
    </QueryClientProvider>
  );
const makeInvoice = () => screen.getByRole('button', { name: 'Make the invoice' });

beforeEach(() => {
  mocks.createInvoice.mockReset().mockResolvedValue({ id: 'inv-1', invoiceNumber: 'INV-1' });
  mocks.markStayBilled.mockReset().mockResolvedValue(undefined);
  mocks.wardDayCodes = wardFees;
});

describe('billing a stay on the sheet', () => {
  it("shows a night billed at the bed's own rate as 'bed rate'", () => {
    open(stay('007', 1850));
    expect(screen.getByText(/N\$ 1,850\.00 a night · bed rate/)).toBeInTheDocument();
    expect(makeInvoice()).not.toBeDisabled();
  });

  it("bills a bed with no rate at the code's NAMAF amount and shows 'NAMAF 2026', so the total is not a surprise", () => {
    open(stay('007', null));
    expect(screen.getByText(/N\$ 2,914\.10 a night · NAMAF 2026/)).toBeInTheDocument();
    // Two nights: on the line and in the total
    expect(screen.getAllByText('N$ 5,828.20')).toHaveLength(2);
    expect(makeInvoice()).not.toBeDisabled();
    expect(screen.queryByText(/administrator sets it/)).not.toBeInTheDocument();
  });

  it('asks for the amount when there is no bed rate and no NAMAF amount, makes no invoice until it is typed, then bills it as typed in', async () => {
    open(stay('001', null));
    expect(screen.getByText(/Some nights have no amount yet/)).toBeInTheDocument();
    const amount = screen.getByLabelText('Bed D1, Day ward: amount for one night (N$)');
    expect(screen.getByText(/Bed D1 has no daily rate and code 001 has no amount on the price list\. An administrator can set the bed's daily rate under Wards and beds\. It is billed for 2 nights\./)).toBeInTheDocument();
    expect(makeInvoice()).toBeDisabled();

    // N$ 0 and words are not an amount: the stay is never billed for nothing
    fireEvent.change(amount, { target: { value: '0' } });
    expect(screen.getByText(/Enter the amount in N\$/)).toBeInTheDocument();
    expect(makeInvoice()).toBeDisabled();

    fireEvent.change(amount, { target: { value: 'N$ 1,650' } });
    expect(screen.getByText(/N\$ 1,650\.00 a night · typed in/)).toBeInTheDocument();
    expect(screen.queryByText(/Some nights have no amount yet/)).not.toBeInTheDocument();
    expect(makeInvoice()).not.toBeDisabled();

    fireEvent.click(makeInvoice());
    await waitFor(() => expect(mocks.createInvoice).toHaveBeenCalledTimes(1));
    const { services } = mocks.createInvoice.mock.calls[0][0];
    expect(services.map((line: { code: string; unitPrice: number; serviceDate: string }) => [line.code, line.unitPrice, line.serviceDate])).toEqual([
      ['001', 1650, '2026-10-10'],
      ['001', 1650, '2026-10-11']
    ]);
    await waitFor(() => expect(mocks.markStayBilled).toHaveBeenCalledWith('adm-1', 'inv-1'));
  });
});
