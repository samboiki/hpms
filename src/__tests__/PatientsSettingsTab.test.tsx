/**
 * Patients > Settings. Five options (default country, default language, consent for data processing, data export
 * requests, anonymising after 7 years) were saved but nothing in the app read them; the page even said so. The owner
 * decided on 13 Oct 2026 to remove them: the tab offers only what is applied (the inactive-patient threshold).
 */
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

const { Nothing } = vi.hoisted(() => ({ Nothing: () => null }));
vi.mock('../components/patients/PatientManagementView', () => ({ default: Nothing }));
vi.mock('../components/patients/PatientAnalytics', () => ({ default: Nothing }));
vi.mock('../components/dashboard/FloatingVisitTracker', () => ({ default: Nothing }));
vi.mock('../components/layout/ProfileMenu', () => ({ UserAvatar: Nothing }));
vi.mock('../stores/authStore', () => ({ useAuthStore: () => ({ user: { id: 'u1', role: 'admin', practice_id: 'practice-1' }, logout: vi.fn() }) }));
vi.mock('../contexts/PracticeContext', () => ({ usePractice: () => ({ practiceId: 'practice-1' }) }));
vi.mock('../stores/patientsStoreNew', () => ({ usePatientsStoreNew: () => ({ patients: [] }) }));
vi.mock('../stores/themeStore', () => ({ useTheme: () => ({ currentTheme: { gradients: {} } }) }));
vi.mock('../hooks/usePracticeData', () => ({ usePracticeData: () => ({ practiceData: null, colors: null }) }));
// One settings object (the page copies it whenever it changes)
const saved = vi.hoisted(() => ({ settings: { inactiveThresholdDays: 180 }, loading: false, saving: false, saveSettings: () => Promise.resolve(true) }));
vi.mock('../hooks/usePatientSettings', () => ({ usePatientSettings: () => saved }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));
vi.mock('framer-motion', () => {
  const Plain = ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
    const { initial, animate, exit, transition, whileHover, whileTap, layout, ...rest } = props;
    void initial; void animate; void exit; void transition; void whileHover; void whileTap; void layout;
    return <div {...(rest as React.HTMLAttributes<HTMLDivElement>)}>{children}</div>;
  };
  return { motion: new Proxy({}, { get: () => Plain }), AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</> };
});

import Patients from '../pages/Patients';

describe('Patients > Settings', () => {
  it('offers only the settings the app applies', () => {
    render(<MemoryRouter><Patients /></MemoryRouter>);
    fireEvent.click(screen.getByRole('tab', { name: /Settings/ }));

    expect(screen.getByText('Inactive Patient Threshold')).toBeInTheDocument();
    for (const removed of [
      'Default Country',
      'Default Language',
      'Require consent for data processing',
      'Enable patient data export requests',
      'Auto-anonymize inactive patient records after 7 years'
    ]) {
      expect(screen.queryByText(removed)).toBeNull();
    }
    // The note that "the other options are saved, but nothing uses them" went with them
    expect(screen.queryByText(/nothing uses them yet/)).toBeNull();
  });
});
