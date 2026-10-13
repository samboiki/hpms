import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { PatientSafety } from '../../../../services/patientSafetyService';

const service = vi.hoisted(() => ({
  loadPatientSafety: vi.fn(),
  addAllergy: vi.fn(),
  verifyAllergy: vi.fn(),
  removeAllergy: vi.fn(),
  setNoKnownAllergies: vi.fn(),
  saveAlertNote: vi.fn(),
  addProblem: vi.fn(),
  setProblemStatus: vi.fn(),
  recordAllergyOverride: vi.fn()
}));

const { NotSetUp } = vi.hoisted(() => ({ NotSetUp: class NotSetUp extends Error {} }));

vi.mock('../../../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../../../services/patientSafetyService', async importOriginal => ({
  // The real formatting helpers (allergyLabel...), with the database calls replaced
  ...(await importOriginal<typeof import('../../../../services/patientSafetyService')>()),
  ...service,
  SafetyNotSetUpError: NotSetUp,
  isSafetyNotSetUp: (error: unknown) => error instanceof NotSetUp,
  SEVERITY_LABELS: { severe: 'Severe', moderate: 'Moderate', mild: 'Mild', unknown: 'Severity not known' },
  MAX_ALERT_NOTE: 200
}));
const auth = vi.hoisted(() => ({ role: 'doctor' }));
vi.mock('../../../../stores/authStore', () => ({
  useAuthStore: () => ({ user: { id: 'user-1', practice_id: 'practice-1', role: auth.role } })
}));
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

import { ClinicalAlertStrip } from '../ClinicalAlertStrip';
import { useMedicineAllergyCheck } from '../useMedicineAllergyCheck';
import { DiagnosisToProblems } from '../DiagnosisToProblems';

const safety = (overrides: Partial<PatientSafety> = {}): PatientSafety => ({
  allergies: [],
  profile: null,
  problems: [],
  ...overrides
});

const penicillin = {
  id: 'a1',
  patientId: 'patient-1',
  substance: 'Penicillin',
  reaction: 'Anaphylaxis',
  severity: 'severe' as const,
  recordedByName: 'Reception',
  verifiedAt: null,
  verifiedByName: null,
  createdAt: '2026-10-01T08:00:00Z'
};

const renderWithQuery = (ui: React.ReactElement) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
};

afterEach(() => cleanup());
beforeEach(() => {
  Object.values(service).forEach(fn => fn.mockReset());
  auth.role = 'doctor';
});

describe('ClinicalAlertStrip', () => {
  it('says plainly that allergies are not recorded yet, which is different from "no known allergies"', async () => {
    service.loadPatientSafety.mockResolvedValue(safety());
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" />);
    expect(await screen.findByText('Allergies not recorded yet')).toBeInTheDocument();
  });

  it('shows the allergy, the alert and the active problems on one line so nobody has to open anything', async () => {
    service.loadPatientSafety.mockResolvedValue(
      safety({
        allergies: [penicillin],
        profile: { noKnownAllergies: false, nkaConfirmedAt: null, nkaConfirmedByName: null, alertNote: 'Pacemaker', alertUpdatedAt: null, alertUpdatedByName: null },
        problems: [
          { id: 'p1', patientId: 'patient-1', description: 'Hypertension', icd10Code: 'I10', status: 'active', chronic: true, onsetDate: null, resolvedDate: null, sourceVisitId: null, createdAt: '' },
          { id: 'p2', patientId: 'patient-1', description: 'Old fracture', icd10Code: null, status: 'past', chronic: false, onsetDate: null, resolvedDate: null, sourceVisitId: null, createdAt: '' }
        ]
      })
    );
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" />);
    expect(await screen.findByText('Allergic to Penicillin (severe)')).toBeInTheDocument();
    expect(screen.getByText('Alert: Pacemaker')).toBeInTheDocument();
    expect(screen.getByText('Problems: Hypertension')).toBeInTheDocument();
  });

  it('records "no known allergies" as an explicit statement from the details', async () => {
    service.loadPatientSafety.mockResolvedValue(safety());
    service.setNoKnownAllergies.mockResolvedValue(undefined);
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" />);
    fireEvent.click(await screen.findByRole('button', { name: /Details/ }));
    fireEvent.click(screen.getByRole('button', { name: 'No known allergies' }));
    await waitFor(() => expect(service.setNoKnownAllergies).toHaveBeenCalledWith('practice-1', 'patient-1', true));
  });

  it('lets a practitioner verify an allergy reception recorded, but not reception itself', async () => {
    service.loadPatientSafety.mockResolvedValue(safety({ allergies: [penicillin] }));
    service.verifyAllergy.mockResolvedValue(undefined);
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" defaultExpanded />);
    fireEvent.click(await screen.findByRole('button', { name: /Verify/ }));
    await waitFor(() => expect(service.verifyAllergy).toHaveBeenCalledWith('a1'));

    cleanup();
    auth.role = 'receptionist';
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" defaultExpanded />);
    expect(await screen.findByText(/Not verified yet/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Verify/ })).not.toBeInTheDocument();
  });

  it('saves a new allergy with its reaction and severity', async () => {
    service.loadPatientSafety.mockResolvedValue(safety());
    service.addAllergy.mockResolvedValue(undefined);
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" defaultExpanded />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add allergy' }));
    fireEvent.change(screen.getByLabelText('Allergic to'), { target: { value: 'Sulfa drugs' } });
    fireEvent.change(screen.getByLabelText(/Reaction/), { target: { value: 'Rash' } });
    fireEvent.click(screen.getByLabelText('Moderate'));
    fireEvent.click(screen.getByRole('button', { name: 'Save allergy' }));
    await waitFor(() =>
      expect(service.addAllergy).toHaveBeenCalledWith('practice-1', 'patient-1', { substance: 'Sulfa drugs', reaction: 'Rash', severity: 'moderate', verified: true })
    );
  });

  it('says the records are not switched on yet before the database change, instead of failing', async () => {
    service.loadPatientSafety.mockRejectedValue(new NotSetUp('missing'));
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" />);
    expect(await screen.findByText(/not switched on yet/)).toBeInTheDocument();
  });

  it('warns when the allergies could not be loaded, so nobody reads silence as "no allergies"', async () => {
    service.loadPatientSafety.mockRejectedValue(new Error('network down'));
    renderWithQuery(<ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" />);
    // One automatic retry first (about a second), then the warning
    expect(await screen.findByText(/Could not load the allergies and alerts/, {}, { timeout: 4000 })).toBeInTheDocument();
  });
});

const Prescriber: React.FC<{ onAdded: (name: string) => void }> = ({ onAdded }) => {
  const check = useMedicineAllergyCheck({ patientId: 'patient-1', practiceId: 'practice-1', visitId: 'visit-1' });
  const [name, setName] = React.useState('');
  return (
    <div>
      <label>
        Medicine
        <input value={name} onChange={event => setName(event.target.value)} />
      </label>
      <button type="button" onClick={() => check.confirmMedicine(name, () => onAdded(name))}>
        Add medicine
      </button>
      {check.dialog}
      {/* Shares the cached safety data: once it shows the allergy, the check has it too */}
      <ClinicalAlertStrip patientId="patient-1" practiceId="practice-1" />
    </div>
  );
};

const ready = () => screen.findByText(/Allergic to Penicillin/);

describe('useMedicineAllergyCheck', () => {
  it('adds a medicine straight away when it matches no recorded allergy', async () => {
    service.loadPatientSafety.mockResolvedValue(safety({ allergies: [penicillin] }));
    const onAdded = vi.fn();
    renderWithQuery(<Prescriber onAdded={onAdded} />);
    await ready();
    fireEvent.change(screen.getByLabelText('Medicine'), { target: { value: 'Paracetamol 500mg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
    expect(onAdded).toHaveBeenCalledWith('Paracetamol 500mg');
  });

  it('stops Augmentin for a penicillin allergy until a reason is given, and keeps the reason', async () => {
    service.loadPatientSafety.mockResolvedValue(safety({ allergies: [penicillin] }));
    service.recordAllergyOverride.mockResolvedValue(undefined);
    const onAdded = vi.fn();
    renderWithQuery(<Prescriber onAdded={onAdded} />);
    await ready();
    fireEvent.change(screen.getByLabelText('Medicine'), { target: { value: 'Augmentin 625mg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Augmentin 625mg is a penicillin, and the patient is allergic to Penicillin.');
    expect(onAdded).not.toHaveBeenCalled();
    const addAnyway = screen.getByRole('button', { name: 'Add anyway' });
    expect(addAnyway).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/give the reason/), { target: { value: 'Tolerated it last year' } });
    fireEvent.click(addAnyway);
    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Augmentin 625mg'));
    expect(service.recordAllergyOverride).toHaveBeenCalledWith({
      practiceId: 'practice-1',
      patientId: 'patient-1',
      visitId: 'visit-1',
      allergyId: 'a1',
      allergySubstance: 'Penicillin',
      medicine: 'Augmentin 625mg',
      reason: 'Tolerated it last year'
    });
  });

  it('waits for the allergies when a medicine is added before they finished loading, instead of skipping the check', async () => {
    let release: (value: PatientSafety) => void = () => undefined;
    service.loadPatientSafety.mockReturnValue(new Promise<PatientSafety>(resolve => (release = resolve)));
    const onAdded = vi.fn();
    renderWithQuery(<Prescriber onAdded={onAdded} />);
    fireEvent.change(screen.getByLabelText('Medicine'), { target: { value: 'Augmentin 625mg' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
    expect(onAdded).not.toHaveBeenCalled();
    release(safety({ allergies: [penicillin] }));
    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Augmentin 625mg is a penicillin');
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('does not add the medicine when the reason cannot be recorded', async () => {
    service.loadPatientSafety.mockResolvedValue(safety({ allergies: [penicillin] }));
    service.recordAllergyOverride.mockRejectedValue(new Error('Could not record the reason. The medicine was not added.'));
    const onAdded = vi.fn();
    renderWithQuery(<Prescriber onAdded={onAdded} />);
    await ready();
    fireEvent.change(screen.getByLabelText('Medicine'), { target: { value: 'Amoxicillin' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
    fireEvent.change(await screen.findByLabelText(/give the reason/), { target: { value: 'Needed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));
    await waitFor(() => expect(service.recordAllergyOverride).toHaveBeenCalled());
    expect(onAdded).not.toHaveBeenCalled();
  });

  it('"Do not add" leaves the prescription unchanged', async () => {
    service.loadPatientSafety.mockResolvedValue(safety({ allergies: [penicillin] }));
    const onAdded = vi.fn();
    renderWithQuery(<Prescriber onAdded={onAdded} />);
    await ready();
    fireEvent.change(screen.getByLabelText('Medicine'), { target: { value: 'Penicillin V' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add medicine' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Do not add' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(onAdded).not.toHaveBeenCalled();
    expect(service.recordAllergyOverride).not.toHaveBeenCalled();
  });
});

describe('DiagnosisToProblems', () => {
  it('adds a coded visit diagnosis to the problem list in one tap, remembering the visit', async () => {
    service.loadPatientSafety.mockResolvedValue(safety());
    service.addProblem.mockResolvedValue(undefined);
    renderWithQuery(<DiagnosisToProblems patientId="patient-1" practiceId="practice-1" visitId="visit-1" diagnosis="HPT I10" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add Essential \(primary\) hypertension \(I10\) to the problem list/ }));
    await waitFor(() =>
      expect(service.addProblem).toHaveBeenCalledWith('practice-1', 'patient-1', {
        description: 'Essential (primary) hypertension',
        icd10Code: 'I10',
        chronic: false,
        onsetDate: null,
        sourceVisitId: 'visit-1'
      })
    );
  });

  it("works on a screen rendered without the app's query provider (an isolated visit screen)", async () => {
    service.loadPatientSafety.mockResolvedValue(safety());
    render(<DiagnosisToProblems patientId="patient-isolated" practiceId="practice-1" visitId={null} diagnosis="I10" />);
    expect(await screen.findByRole('button', { name: /Add Essential \(primary\) hypertension \(I10\)/ })).toBeInTheDocument();
  });

  it('shows nothing before the problem list is switched on', async () => {
    service.loadPatientSafety.mockRejectedValue(new NotSetUp('missing'));
    const { container } = renderWithQuery(<DiagnosisToProblems patientId="patient-1" practiceId="practice-1" visitId={null} diagnosis="I10" />);
    await waitFor(() => expect(service.loadPatientSafety).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
