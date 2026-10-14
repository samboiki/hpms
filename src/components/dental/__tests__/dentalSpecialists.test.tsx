import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook, render, screen, waitFor } from '@testing-library/react';
import type { ServiceSelection } from '../../../types/billing';
import type { ClaimLine } from '../../../utils/billing/claimLine';
import type { DentalLabOrder } from '../../../utils/dental/labOrderRecords';
import type { VisitTariff } from '../../visits/visitBillingLines';
import { loadBilledToothLines } from '../../../services/dental/dentalChartService';
import { loadBilledLabOrders, loadPatientLabOrders } from '../../../services/dental/labOrderService';
import { dentalTariffs } from '../../quotes/__tests__/quoteTestTariffs';
import LabWorkBillingCard from '../LabWorkBillingCard';
import TeethBillingPanel from '../TeethBillingPanel';
import { useBatchLabSlips } from '../useBatchLabSlips';

// Nothing here reaches the database
vi.mock('../../../services/dental/dentalChartService', () => ({
  loadBilledToothLines: vi.fn(async () => ({ lines: [], unplaced: 0 })),
  loadChart: vi.fn(async () => ({ status: 'not_set_up' })),
  loadQuoteRefs: vi.fn(async () => []),
  loadPatientBirthDate: vi.fn(async () => '1990-05-01')
}));
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
  loadSlipHeading: vi.fn(async () => ({ name: 'Rehearsal Orthodontics', phone: null, address: null, practiceNumber: null })),
  loadPatientBasics: vi.fn(async () => ({ name: 'Alex Tester', dateOfBirth: null }))
}));
vi.mock('../../../services/stock/stockService', () => ({ loadSuppliers: vi.fn(async () => []) }));
vi.mock('../../../stores/authStore', () => ({ useAuthStore: (select: (state: unknown) => unknown) => select({ user: { id: 'user-1', role: 'doctor' } }) }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

const tariffs = dentalTariffs();

const renderPanel = (practiceType: string) =>
  render(
    <TeethBillingPanel
      practiceId="practice-1"
      practiceType={practiceType}
      patientId="patient-1"
      tariffs={tariffs}
      lines={[]}
      usage={{ '8367': 10 }}
      hasMedicalAid
      infectionControlStaff={1}
      disabledReason={null}
      onApply={vi.fn()}
    />
  );

// Business rule (owner, 14 Oct 2026): dental specialists work like dental. An orthodontist bills by tooth, so the visit's
// Billing tab shows the same tooth chart and reads the patient's billed teeth; the dental laboratory (no patients' teeth)
// and every other discipline keep the plain service list.
describe('the tooth chart on the Billing tab of a dental specialist', () => {
  beforeEach(() => vi.mocked(loadBilledToothLines).mockClear());

  it.each(['orthodontist', 'maxillofacial_oral_surgeon', 'periodontist', 'prosthodontist', 'dental_therapist', 'dental_practice'])(
    'is shown in a practice of type %s, with every adult tooth',
    async type => {
      renderPanel(type);
      expect(screen.getByRole('group', { name: 'Tooth chart, adult teeth' })).toBeInTheDocument();
      expect(screen.getAllByRole('button', { name: /^Tooth \d\d,/ })).toHaveLength(32);
      await waitFor(() => expect(loadBilledToothLines).toHaveBeenCalledWith('patient-1'));
    }
  );

  it.each(['dental_technician', 'medical', 'urology'])('is not shown in a practice of type %s, which reads no dental history at all', async type => {
    const { container } = renderPanel(type);
    expect(container).toBeEmptyDOMElement();
    await Promise.resolve();
    expect(loadBilledToothLines).not.toHaveBeenCalled();
  });
});

const order = (): DentalLabOrder => ({
  id: 'o-1',
  orderNo: 3,
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
  workType: 'orthodontic',
  teeth: [],
  jaw: 'upper',
  shade: null,
  notes: null,
  slipNumber: 'LS-100',
  slipLines: [{ code: '9330', description: 'Retainer', amountCents: 85000 }],
  createdBy: 'Dr Test Practitioner',
  events: [],
});

const labTariff = { id: 't-8099', code: '8099', description: 'Dental technician fees', price: 0, can_be_multiplied: 'NO', requires_tooth_number: 'NO', is_active: true } as VisitTariff;
const renderCard = (practiceType: string) =>
  render(
    <LabWorkBillingCard
      practiceId="practice-1"
      practiceType={practiceType}
      patientId="patient-1"
      visitId="visit-1"
      tariffs={[labTariff]}
      lines={[] as ServiceSelection[]}
      hasMedicalAid
      feeEditable
      disabledReason={null}
      onApply={vi.fn()}
    />
  );

const claimLine = { key: 'line-1', transactionNumber: 1, visitId: 'visit-1', tariffCode: '8099', amount: 850 } as ClaimLine;

// Business rule: an orthodontist sends retainers and aligners to a laboratory and bills the lab's invoice under 8099 like a
// dentist; the claim goes only with the lab's lines that add up to it.
describe('lab work in a dental specialist practice', () => {
  beforeEach(() => {
    vi.mocked(loadPatientLabOrders).mockReset();
    vi.mocked(loadBilledLabOrders).mockReset();
  });

  it('offers the work back from the lab to bill under 8099 at the visit', async () => {
    vi.mocked(loadPatientLabOrders).mockResolvedValue({ status: 'ready', orders: [order()] });
    renderCard('orthodontist');
    expect(await screen.findByRole('button', { name: 'Bill under 8099 at this visit' })).toBeEnabled();
  });

  it('shows nothing, and reads no lab orders, in the dental laboratory or a GP practice', async () => {
    for (const type of ['dental_technician', 'medical']) {
      const { container, unmount } = renderCard(type);
      await Promise.resolve();
      expect(container).toBeEmptyDOMElement();
      unmount();
    }
    expect(loadPatientLabOrders).not.toHaveBeenCalled();
  });

  it('checks an 8099 line of a specialist practice against the lab invoice before the claim goes', async () => {
    vi.mocked(loadBilledLabOrders).mockResolvedValue({ status: 'ready', orders: [] });
    const { result } = renderHook(() => useBatchLabSlips({ practiceType: 'periodontist', lines: [claimLine], enabled: true }));
    await waitFor(() => expect(result.current.issues[0]?.message).toMatch(/needs the lab's slip/));
    expect(loadBilledLabOrders).toHaveBeenCalled();
  });

  it("leaves a GP practice's batch alone", () => {
    const { result } = renderHook(() => useBatchLabSlips({ practiceType: 'medical', lines: [claimLine], enabled: true }));
    expect(result.current.issues).toEqual([]);
    expect(loadBilledLabOrders).not.toHaveBeenCalled();
  });
});
