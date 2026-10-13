import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import type { ServiceSelection } from '../../../types/billing';
import type { ClaimLine } from '../../../utils/billing/claimLine';
import type { DentalLabOrder } from '../../../utils/dental/labOrderRecords';
import type { VisitTariff } from '../../visits/visitBillingLines';
import { billLabOrder, loadBilledLabOrders, loadPatientLabOrders, saveDentalLabOrder } from '../../../services/dental/labOrderService';
import LabWorkBillingCard from '../LabWorkBillingCard';
import LabWorkSection from '../LabWorkSection';
import { useBatchLabSlips } from '../useBatchLabSlips';

// Nothing here reaches the database
vi.mock('../../../services/dental/labOrderService', () => ({
  loadPatientLabOrders: vi.fn(),
  loadBilledLabOrders: vi.fn(),
  loadPracticeOpenLabOrders: vi.fn(async () => ({ status: 'ready', orders: [] })),
  billLabOrder: vi.fn(async () => ({})),
  saveLabSlip: vi.fn(),
  saveDentalLabOrder: vi.fn(),
  setDentalLabStatus: vi.fn(),
  isDentalLabNotSetUp: () => false
}));
vi.mock('../../../services/optometry/optometryService', () => ({
  loadSlipHeading: vi.fn(async () => ({ name: 'Rehearsal Dental', phone: null, address: null, practiceNumber: null })),
  loadPatientBasics: vi.fn(async () => ({ name: 'Alex Tester', dateOfBirth: null }))
}));
vi.mock('../../../services/stock/stockService', () => ({ loadSuppliers: vi.fn(async () => []) }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { id: 'user-1', role: 'doctor' } }) }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const order =(values: Partial<DentalLabOrder>): DentalLabOrder => ({
  id: 'o-1',
  orderNo: 12,
  patientId: 'patient-1',
  visitId: null,
  visitDate: null,
  billedVisitId: null,
  billedVisitDate: null,
  status: 'received',
  statusOn: '2026-10-12',
  sentOn: '2026-10-05',
  dueOn: '2026-10-12',
  supplierId: 'lab-1',
  labName: 'Alpha Dental Lab',
  workType: 'crown',
  teeth: ['11'],
  jaw: null,
  shade: 'A2',
  notes: null,
  slipNumber: 'LS-4471',
  slipLines: [
    { code: '9330', description: 'Porcelain fused to metal crown', amountCents: 185000 },
    { code: null, description: 'Model and die', amountCents: 12000 }
  ],
  createdBy: 'Dr Test Practitioner',
  events: [],
  ...values
});

const labTariff = { id: 't-8099', code: '8099', description: 'Dental technician fees', price: 0, can_be_multiplied: 'NO', requires_tooth_number: 'NO', is_active: true } as VisitTariff;
const feeLine = (amount: number): ServiceSelection => ({
  id: 'line-8099',
  tariffId: 't-8099',
  code: '8099',
  description: 'Dental technician fees',
  category: 'Dental Service',
  unitPrice: amount,
  quantity: 1,
  totalPrice: amount
});

const renderCard = (props: { practiceType?: string; lines?: ServiceSelection[]; feeEditable?: boolean; onApply?: (lines: ServiceSelection[]) => void }) =>
  render(
    <LabWorkBillingCard
      practiceId="practice-1"
      practiceType={props.practiceType ?? 'dental'}
      patientId="patient-1"
      visitId="visit-1"
      tariffs={[labTariff]}
      lines={props.lines ?? []}
      hasMedicalAid
      feeEditable={props.feeEditable ?? true}
      disabledReason={null}
      onApply={props.onApply ?? vi.fn()}
    />
  );

// Business rule: lab work is dental; a GP or specialist practice never sees it on a visit (isDentalPractice decides),
// and the claim only goes with each 8099 line carrying the lab's lines that add up to it (NAMAF rule 010, QEDI L lines)
describe('lab work on the visit Billing tab', () => {
  beforeEach(() => {
    vi.mocked(loadPatientLabOrders).mockReset();
    vi.mocked(billLabOrder).mockClear();
  });

  it('shows nothing in a GP practice and reads no lab orders there', async () => {
    const { container } = renderCard({ practiceType: 'general', lines: [feeLine(1970)] });
    await Promise.resolve();
    expect(container).toBeEmptyDOMElement();
    expect(loadPatientLabOrders).not.toHaveBeenCalled();
  });

  it('says an 8099 line carries the lab invoice of the order billed at the visit when they add up', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order({ billedVisitId: 'visit-1' })] });
    renderCard({ lines: [feeLine(1970)] });
    expect(await screen.findByText(/carries the lab's invoice of order 12/)).toBeInTheDocument();
  });

  it('bills work back from the lab in one tap: the order is billed here and an 8099 line at the invoice total is added', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order({})] });
    const onApply = vi.fn();
    renderCard({ onApply });
    fireEvent.click(await screen.findByRole('button', { name: 'Bill under 8099 at this visit' }));
    await waitFor(() => expect(onApply).toHaveBeenCalled());
    expect(billLabOrder).toHaveBeenCalledWith('o-1', 'visit-1');
    const added = (onApply.mock.calls[0][0] as ServiceSelection[]).find(line => line.code === '8099');
    expect(added).toMatchObject({ unitPrice: 1970, quantity: 1, totalPrice: 1970 });
    expect(added?.feeOverride?.reason).toContain('LS-4471');
    expect(added?.notes).toBe('Lab work: Crown on 11, Alpha Dental Lab, invoice LS-4471');
  });

  it('names the difference when an 8099 line does not add up, and puts the invoice total on the line', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order({ billedVisitId: 'visit-1' })] });
    const onApply = vi.fn();
    renderCard({ lines: [feeLine(1900)], onApply });
    expect(await screen.findByText(/adds up to N\$ 1,970.00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use N$ 1,970.00' }));
    expect((onApply.mock.calls[0][0] as ServiceSelection[])[0]).toMatchObject({ unitPrice: 1970, totalPrice: 1970 });
  });

  it('does not bill without billing rights, and says why', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order({})] });
    renderCard({ feeEditable: false });
    expect(await screen.findByRole('button', { name: 'Bill under 8099 at this visit' })).toBeDisabled();
    expect(screen.getByText(/needs billing rights/)).toBeInTheDocument();
  });
});

const claimLine = (values: Partial<ClaimLine>): ClaimLine =>
  ({ key: 'line-1', transactionNumber: 1, visitId: 'visit-1', tariffCode: '8099', amount: 1970, ...values }) as ClaimLine;

describe('claim review of 8099 lines', () => {
  beforeEach(() => vi.mocked(loadBilledLabOrders).mockReset());

  it('leaves a GP practice\'s batch alone', () => {
    const { result } = renderHook(() => useBatchLabSlips({ practiceType: 'general', lines: [claimLine({})], enabled: true }));
    expect(result.current.issues).toEqual([]);
    expect(loadBilledLabOrders).not.toHaveBeenCalled();
  });

  it('holds an 8099 line until its lab invoice is checked, then stops it when none adds up', async () => {
    let resolve: (value: Awaited<ReturnType<typeof loadBilledLabOrders>>) => void = () => undefined;
    vi.mocked(loadBilledLabOrders).mockReturnValue(new Promise(done => (resolve = done)));
    const lines = [claimLine({})];
    const { result } = renderHook(() => useBatchLabSlips({ practiceType: 'dental', lines, enabled: true }));
    expect(result.current.issues[0]?.message).toMatch(/Checking/);
    await act(async () => resolve({ status: 'ready', orders: [] }));
    expect(result.current.issues).toHaveLength(1);
    expect(result.current.issues[0].message).toMatch(/needs the lab's slip/);
  });

  it('lets a paired 8099 line go, carrying the lab\'s lines into the file', async () => {
    vi.mocked(loadBilledLabOrders).mockResolvedValue({
      status: 'ready',
      orders: [{ id: 'o-1', orderNo: 12, billedVisitId: 'visit-1', slipNumber: 'LS-4471', labName: 'Alpha Dental Lab', lines: order({}).slipLines }]
    });
    const lines = [claimLine({})];
    const { result } = renderHook(() => useBatchLabSlips({ practiceType: 'dental', lines, enabled: true }));
    await waitFor(() => expect(result.current.issues).toEqual([]));
    expect(result.current.fileLines[0].labDetails).toHaveLength(2);
  });
});

describe('Lab work on the patient file', () => {
  const renderSection = (canChart: boolean, entry = '/patients?patientId=patient-1&tab=teeth', orderRequest: { teeth: string[]; nonce: number } | null = null) =>
    render(
      <MemoryRouter initialEntries={[entry]}>
        <LabWorkSection
          practiceId="practice-1"
          patientId="patient-1"
          visitId={null}
          navigation
          today="2026-10-13"
          canChart={canChart}
          model={{ teeth: new Map(), planItems: [], recordedTeeth: [] } as never}
          dateOfBirth={null}
          orderRequest={orderRequest}
        />
      </MemoryRouter>
    );

  it('opens a new order for the tooth "Send to the lab" was tapped on', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [] });
    renderSection(true, '/patients?patientId=patient-1&tab=teeth', { teeth: ['36'], nonce: 1 });
    expect(await screen.findByText('Tooth 36: lower left first molar')).toBeInTheDocument();
  });

  it('says plainly when lab work is not set up yet', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'not_set_up' });
    renderSection(true);
    expect(await screen.findByText(/Lab work is not set up yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New lab order/ })).toBeNull();
  });

  it('lets practitioners order, and shows open work with its next step', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order({})] });
    renderSection(true);
    expect(await screen.findByRole('article', { name: 'Lab order 12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /New lab order/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Fitted' })).toBeInTheDocument();
  });

  it('does not offer ordering to reception', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [] });
    renderSection(false);
    expect(await screen.findByText('No lab work')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New lab order/ })).toBeNull();
  });

  it('orders a crown for the tooth tapped on the chart, for this patient', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [] });
    vi.mocked(saveDentalLabOrder).mockResolvedValue({ id: 'new', order_no: 3, created: true });
    renderSection(true);
    fireEvent.click(await screen.findByRole('button', { name: /New lab order/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Crown' }));
    fireEvent.click(screen.getByRole('button', { name: /^Tooth 11,/ }));
    fireEvent.change(screen.getByPlaceholderText('For example A2'), { target: { value: 'A2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the order' }));
    await waitFor(() => expect(saveDentalLabOrder).toHaveBeenCalled());
    expect(vi.mocked(saveDentalLabOrder).mock.calls[0][0]).toMatchObject({ patient_id: 'patient-1', visit_id: null, work_type: 'crown', teeth: ['11'], shade: 'A2' });
  });

  it('does not send an order without its tooth to the database', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [] });
    vi.mocked(saveDentalLabOrder).mockClear();
    renderSection(true);
    fireEvent.click(await screen.findByRole('button', { name: /New lab order/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Bridge' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save the order' }));
    expect(await screen.findByText(/A bridge spans at least two teeth/)).toBeInTheDocument();
    expect(saveDentalLabOrder).not.toHaveBeenCalled();
  });

  it('opens a fitted order a link points to among the earlier orders', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order({ status: 'fitted' })] });
    renderSection(true, '/patients?patientId=patient-1&tab=teeth&labOrder=o-1');
    expect(await screen.findByRole('article', { name: 'Lab order 12' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hide earlier orders' })).toBeInTheDocument();
  });

  // "All lab work" links to another patient's order while this file is still on screen: this file used up the link,
  // so the other patient's file opened without the order shown first
  it("leaves a link to another patient's order for that patient's file", async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [] });
    const Address = () => {
      const location = useLocation();
      return <output data-testid="address">{location.search}</output>;
    };
    render(
      <MemoryRouter initialEntries={['/patients?patientId=patient-2&tab=teeth&labOrder=o-9']}>
        <LabWorkSection
          practiceId="practice-1"
          patientId="patient-1"
          visitId={null}
          navigation
          today="2026-10-13"
          canChart
          model={{ teeth: new Map(), planItems: [], recordedTeeth: [] } as never}
          dateOfBirth={null}
          orderRequest={null}
        />
        <Address />
      </MemoryRouter>
    );
    await waitFor(() => expect(loadPatientLabOrders).toHaveBeenCalledWith('patient-1'));
    expect(screen.getByTestId('address')).toHaveTextContent('labOrder=o-9');
  });
});
