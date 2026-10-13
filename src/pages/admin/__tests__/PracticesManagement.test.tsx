import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const overview = vi.hoisted(() => ({ loadPracticeOverview: vi.fn() }));
const features = vi.hoisted(() => ({ loadPracticeFeatureStates: vi.fn(), setPracticeFeature: vi.fn() }));
const auth = vi.hoisted(() => {
  const state = {
    user: { id: 'support-1', role: 'admin', practice_id: null as string | null, is_super_admin: true },
    isSuperAdmin: () => state.user.is_super_admin,
  };
  return state;
});

vi.mock('../../../services/practiceOverviewService', () => overview);
vi.mock('../../../services/practiceFeatureService', () => features);
vi.mock('../../../stores/authStore', () => ({ useAuthStore: () => auth }));

import PracticesManagement from '../PracticesManagement';

const practice = (id: string, name: string, users: number) => ({
  id,
  slug: id,
  name,
  domain: '',
  status: 'active',
  subscription_tier: 'standard',
  contact_email: `${id}@example.test`,
  contact_phone: '',
  city: 'Windhoek',
  total_users: users,
  total_patients: users > 0 ? 40 : 0,
  appointments_this_month: users > 0 ? 12 : 0,
  created_at: '2026-01-01T00:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = { id: 'support-1', role: 'admin', practice_id: null, is_super_admin: true };
  overview.loadPracticeOverview.mockResolvedValue([
    practice('clinic', 'Kalahari Family Practice', 3),
    practice('listing', 'Directory Listing Dental', 0),
  ]);
  features.loadPracticeFeatureStates.mockResolvedValue({ ok: true, states: {} });
});

describe('Practice Management lists practices again', () => {
  // It read a view that no longer exists, so support saw "Practices could not be loaded" and nothing else
  it('shows the practices with their counts', async () => {
    render(<PracticesManagement />);
    expect(await screen.findByText('Kalahari Family Practice')).toBeInTheDocument();
    expect(screen.getByText('Directory Listing Dental')).toBeInTheDocument();
    expect(screen.queryByText('Practices could not be loaded')).not.toBeInTheDocument();
  });
});

describe("support's SMS replies switch", () => {
  // Directory listings have no staff and send no SMS: a switch there would only clutter the list
  it('is offered where staff work, not for directory listings', async () => {
    render(<PracticesManagement />);
    expect(await screen.findByRole('switch', { name: "Patients' SMS replies are collected: Kalahari Family Practice" })).toBeInTheDocument();
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(features.loadPracticeFeatureStates).toHaveBeenCalledWith('sms_replies');
  });

  // Replies switched on for a practice must stay visible so support can switch them off again
  it('stays visible while it is on, even without staff', async () => {
    features.loadPracticeFeatureStates.mockResolvedValue({ ok: true, states: { listing: { enabled: true, updatedAt: null } } });
    render(<PracticesManagement />);
    expect(await screen.findByRole('switch', { name: "Patients' SMS replies are collected: Directory Listing Dental" })).toBeChecked();
  });

  // Unknown states must not show as "Off" (support could switch on what is already on, or think it is off)
  it('says when the switches cannot be read, and shows none', async () => {
    features.loadPracticeFeatureStates.mockResolvedValue({ ok: false, message: 'The switches could not be read: timeout' });
    render(<PracticesManagement />);
    expect(await screen.findByRole('alert')).toHaveTextContent('The switches could not be read: timeout');
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  // /admin/practices also lets practice administrators in: they get no practice list and no switch
  it('is never shown to a practice administrator', () => {
    auth.user = { id: 'admin-1', role: 'admin', practice_id: 'clinic', is_super_admin: false };
    render(<PracticesManagement />);
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(overview.loadPracticeOverview).not.toHaveBeenCalled();
  });
});
