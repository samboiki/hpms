import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import { OPTOMETRY_FOLLOWS, parseScreenAccess, screenForPath, sidebarShowsPath, type ScreenAccessRead } from '../../../utils/auth/screenAccess';

// Invented roles and choices. Nothing reaches the database.
const access = vi.hoisted(() => ({ read: { status: 'ready', access: {} } as ScreenAccessRead, role: 'receptionist' }));
vi.mock('../../../hooks/useScreenAccess', () => ({ useScreenAccess: () => ({ ...access.read, retry: () => undefined }) }));
// The page header's profile picture reads the whole store; the screens read the signed-in user's role
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select?: (state: { user: { role: string; name: string; email: string }; logout: () => void }) => unknown) => {
    const state = { user: { role: access.role, name: 'Test User', email: 'test.user@example.com' }, logout: () => undefined };
    return select ? select(state) : state;
  }
}));
vi.mock('../../../services/optometry/optometryService', () => ({
  loadEyeRecords: vi.fn(async () => ({ status: 'ready', prescriptions: [], exams: [], orders: [], supplies: [] })),
  loadPatientBasics: vi.fn(async () => ({ name: 'Test Patient', dateOfBirth: null })),
  loadSlipHeading: vi.fn(async () => ({ name: 'Practice', phone: null, address: null, practiceNumber: null })),
  voidPrescription: vi.fn()
}));
vi.mock('../useOptometryPractice', () => ({ useOptometryPractice: () => true }));
vi.mock('../OpticalBenefitNote', () => ({ default: () => null }));
vi.mock('../ContactLensSection', () => ({ default: () => null }));
vi.mock('../ExamHistory', () => ({ default: () => null }));
vi.mock('../LabOrderSheet', () => ({ default: () => null }));
vi.mock('../PrescriptionSheet', () => ({ default: () => null }));
vi.mock('../ReasonSheet', () => ({ default: () => null }));
vi.mock('../OptometryPracticePanel', () => ({ default: () => <p>The practice view</p> }));

import EyesView from '../EyesView';
import { ScreenAccessNotice } from '../../access/ScreenAccessNotice';
import { OPTOMETRY_PAGE } from '../optometryPageHeader';

afterEach(cleanup);

const receptionist = { role: 'receptionist', is_super_admin: false };
const ready = (stored: unknown): ScreenAccessRead => ({ status: 'ready', access: parseScreenAccess(stored) });

// The Optometry page holds the frames, consignment stock and lab orders: a practice that keeps a role out of Stock keeps
// it out of these too (the page was open to everyone), while its money reports keep following Finance
describe('the Optometry page follows Stock access', () => {
  it('is gated by Stock, and the sidebar hides it once the practice keeps the role out of Stock', () => {
    expect(OPTOMETRY_FOLLOWS).toBe('stock');
    expect(screenForPath('/optometry')).toBe('stock');
    expect(sidebarShowsPath(receptionist, '/optometry', ready({ stock: ['doctor'] }))).toBe(false);
    // Nothing chosen, or Finance limited only: as before
    expect(sidebarShowsPath(receptionist, '/optometry', ready({}))).toBe(true);
    expect(sidebarShowsPath(receptionist, '/optometry', ready({ finance: ['doctor'] }))).toBe(true);
  });

  it('tells a role kept out under the page\'s own name that it goes with Stock', () => {
    render(
      <MemoryRouter>
        <ScreenAccessNotice screen={OPTOMETRY_FOLLOWS} gate="closed" onRetry={vi.fn()} page={OPTOMETRY_PAGE} />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Optometry' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ask your practice administrator for access to Optometry' })).toBeInTheDocument();
    expect(screen.getByText(/opens for the roles that open Stock/)).toBeInTheDocument();
  });

  it('hides the patient file\'s practice view (the same lab orders, frames and reports) from a role kept out of Stock', async () => {
    access.role = 'receptionist';
    access.read = ready({ stock: ['doctor'] });
    render(<MemoryRouter><EyesView practiceId="practice-1" patientId="patient-1" /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Eyes' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: 'All lab orders, frames and the report' })).not.toBeInTheDocument();
  });

  it('keeps the practice view for a role that opens Stock', async () => {
    access.role = 'doctor';
    access.read = ready({ stock: ['doctor'] });
    render(<MemoryRouter><EyesView practiceId="practice-1" patientId="patient-1" /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: 'All lab orders, frames and the report' })).toBeInTheDocument();
  });
});
