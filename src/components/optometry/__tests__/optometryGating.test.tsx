import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import PatientModalTabs from '../../patients/PatientModalTabs';
import VisitEyeExamPanel from '../VisitEyeExamPanel';
import EyesView from '../EyesView';
import { loadIsDentalPractice } from '../../../services/dental/dentalChartService';
import { loadEyeRecords, loadIsOptometryPractice, loadPatientBasics, loadSlipHeading, loadVisitExam } from '../../../services/optometry/optometryService';
import { isDentalPractice, isOptometryPractice } from '../../../utils/billing/tariffRules';

// Nothing here reaches the database: the practice type and the "not set up" answers are mocked
vi.mock('../../../services/dental/dentalChartService', () => ({ loadIsDentalPractice: vi.fn() }));
vi.mock('../../../services/optometry/optometryService', () => ({
  loadIsOptometryPractice: vi.fn(),
  loadVisitExam: vi.fn(),
  loadEyeRecords: vi.fn(),
  loadPatientBasics: vi.fn(),
  loadSlipHeading: vi.fn()
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select: (state: { user: { role: string } }) => unknown) => select({ user: { role: 'doctor' } })
}));
// The practice view follows Stock's access (nothing chosen here: every role opens it)
vi.mock('../../../hooks/useScreenAccess', () => ({ useScreenAccess: () => ({ status: 'ready', access: {}, retry: () => undefined }) }));

const isDental = vi.mocked(loadIsDentalPractice);
const isOptometry = vi.mocked(loadIsOptometryPractice);

const tabLabels = () => screen.getAllByRole('tab').map(tab => tab.getAttribute('aria-label'));

// Business rule: OneHealth serves every discipline. Prescriptions, lab orders and frames are optometry: a GP, dental or
// specialist practice must never see an Eyes tab or an eye exam on its visits (isOptometryPractice decides).
describe('optometry shows for optometry practices only', () => {
  beforeEach(() => {
    isDental.mockReset();
    isOptometry.mockReset();
    vi.mocked(loadVisitExam).mockReset();
    vi.mocked(loadEyeRecords).mockReset();
    vi.mocked(loadPatientBasics).mockResolvedValue({ name: 'Test Patient', dateOfBirth: null });
    vi.mocked(loadSlipHeading).mockResolvedValue({ name: 'Practice', phone: null, address: null, practiceNumber: null });
  });

  it('reads the practice type exactly: optometry is not dental, and dental is not optometry', () => {
    expect(isOptometryPractice(' Optometry ')).toBe(true);
    expect(isOptometryPractice('dental')).toBe(false);
    expect(isOptometryPractice('general')).toBe(false);
    expect(isOptometryPractice(null)).toBe(false);
    expect(isDentalPractice('optometry')).toBe(false);
  });

  it('adds the Eyes tab, next to the encounters, for an optometry practice', async () => {
    isDental.mockResolvedValue(false);
    isOptometry.mockResolvedValue(true);
    render(<PatientModalTabs activeTab="overview" onTabChange={() => undefined} mode="details" practiceId="practice-1" />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Eyes' })).toBeInTheDocument());
    // Account (the account, claims and quotes) sits next to the owner's own Billing tab (owner, 15 Oct 2026)
    expect(tabLabels()).toEqual(['Overview', 'Encounters', 'Eyes', 'Medications', 'Media', 'Laboratory', 'Imaging', 'Billing', 'Account', 'Change history']);
    expect(screen.queryByRole('tab', { name: 'Teeth' })).not.toBeInTheDocument();
  });

  it('shows no Eyes tab to a dental or GP practice', async () => {
    isDental.mockResolvedValue(true);
    isOptometry.mockResolvedValue(false);
    render(<PatientModalTabs activeTab="overview" onTabChange={() => undefined} mode="details" practiceId="practice-2" />);
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Teeth' })).toBeInTheDocument());
    expect(screen.queryByRole('tab', { name: 'Eyes' })).not.toBeInTheDocument();
  });

  it('puts no eye exam on a GP visit, and does not even ask the database', () => {
    const { container } = render(
      <VisitEyeExamPanel practiceType="general" practiceId="p" patientId="pt" visitId="v" diagnosis="" onDiagnosisChange={() => undefined} />
    );
    expect(container).toBeEmptyDOMElement();
    expect(loadVisitExam).not.toHaveBeenCalled();
  });

  it('says plainly that eye records are not set up yet, on the visit and in the patient file', async () => {
    vi.mocked(loadVisitExam).mockResolvedValue({ status: 'not_set_up' });
    render(<VisitEyeExamPanel practiceType="optometry" practiceId="p" patientId="pt" visitId="v" diagnosis="" onDiagnosisChange={() => undefined} />);
    expect(screen.getByRole('heading', { name: 'Eye exam' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('Eye records are not set up yet')).toBeInTheDocument());

    isOptometry.mockResolvedValue(true);
    vi.mocked(loadEyeRecords).mockResolvedValue({ status: 'not_set_up' });
    render(<EyesView practiceId="practice-3" patientId="pt" />);
    await waitFor(() => expect(screen.getAllByText('Eye records are not set up yet')).toHaveLength(2));
  });
});
