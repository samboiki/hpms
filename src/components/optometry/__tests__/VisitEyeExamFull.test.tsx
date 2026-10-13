import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import VisitEyeExamPanel from '../VisitEyeExamPanel';
import { loadPatientBasics, loadSlipHeading, loadVisitExam, saveExam } from '../../../services/optometry/optometryService';

// Nothing here reaches the database: the exam load and save are mocked
vi.mock('../../../services/optometry/optometryService', () => ({
  loadVisitExam: vi.fn(),
  loadPatientBasics: vi.fn(),
  loadSlipHeading: vi.fn(),
  saveExam: vi.fn()
}));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select: (state: { user: { role: string } }) => unknown) => select({ user: { role: 'doctor' } })
}));
vi.mock('react-hot-toast', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const renderPanel = () =>
  render(<VisitEyeExamPanel practiceType="optometry" practiceId="practice-1" patientId="patient-1" visitId="visit-1" diagnosis="" onDiagnosisChange={() => undefined} />);

const ready = (full: boolean) => ({ status: 'ready' as const, exam: null, prescriptions: [], earlier: [], full });

// Business rule (Eminance parity M2): an optometrist records the whole eye exam in the visit, the case history,
// keratometry and the health of the eye with the vision and refraction, and it is kept with that exam. While a
// practice's database does not keep these parts yet, the exam must still save exactly as before.
describe('the full eye exam in the visit', () => {
  beforeEach(() => {
    vi.mocked(loadVisitExam).mockReset();
    vi.mocked(saveExam).mockReset().mockResolvedValue({ examId: 'exam-1', spectacles: null, contactLenses: null });
    vi.mocked(loadPatientBasics).mockResolvedValue({ name: 'Test Patient', dateOfBirth: null });
    vi.mocked(loadSlipHeading).mockResolvedValue({ name: 'Practice', phone: null, address: null, practiceNumber: null });
  });

  it('saves the case history and the eye health with the exam', async () => {
    vi.mocked(loadVisitExam).mockResolvedValue(ready(true));
    renderPanel();
    fireEvent.change(await screen.findByLabelText('Why the patient came'), { target: { value: 'Blurred reading' } });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Headaches' }));
    // "All normal" marks every part of the front of the eye normal in both eyes
    fireEvent.click(screen.getAllByRole('button', { name: 'All normal' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Save eye exam' }));
    await waitFor(() => expect(saveExam).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(saveExam).mock.calls[0][0];
    expect(payload).toMatchObject({ visit_id: 'visit-1', history_reason: 'Blurred reading', history_symptoms: ['headaches'] });
    expect(payload.ocular_health).toMatchObject({ cornea: { r: 'normal', l: 'normal' }, lens: { r: 'normal', l: 'normal' } });
    expect(payload.ocular_health).not.toHaveProperty('macula');
  });

  it('shows a K reading typed as the radius in mm in dioptres, as it is kept', async () => {
    vi.mocked(loadVisitExam).mockResolvedValue(ready(true));
    renderPanel();
    fireEvent.change(await screen.findByLabelText('R flat K'), { target: { value: '7.80' } });
    expect(screen.getByText('= 43.27 D')).toBeInTheDocument();
  });

  it('keeps the exam as it was where the database does not keep the full exam yet', async () => {
    vi.mocked(loadVisitExam).mockResolvedValue(ready(false));
    renderPanel();
    fireEvent.change(await screen.findByLabelText('R without glasses'), { target: { value: '6/9' } });
    expect(screen.queryByText('Case history')).toBeNull();
    expect(screen.queryByText('Keratometry')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save eye exam' }));
    await waitFor(() => expect(saveExam).toHaveBeenCalledTimes(1));
    const payload = vi.mocked(saveExam).mock.calls[0][0];
    expect(payload).toMatchObject({ va_unaided_r: '6/9' });
    expect(Object.keys(payload).filter(key => /^(history_|k_|ocular|cd_ratio|fundus|dilated|cl_lens_type|cl_fit$|cl_over|cl_va)/.test(key))).toEqual([]);
  });
});
