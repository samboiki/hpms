import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import PatientModalTabs from '../../patients/PatientModalTabs';
import TeethChartLink from '../TeethChartLink';
import { loadIsDentalPractice } from '../../../services/dental/dentalChartService';

// Nothing here reaches the database: the practice type is the only thing the gate reads
vi.mock('../../../services/dental/dentalChartService', () => ({ loadIsDentalPractice: vi.fn() }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const isDental = vi.mocked(loadIsDentalPractice);

const renderTabs = () => render(<PatientModalTabs activeTab="overview" onTabChange={() => undefined} mode="details" practiceId="practice-1" />);

// Business rule: OneHealth serves GPs, specialists, optometrists and dentists. The tooth chart is NAMAF dental work:
// a GP or optometry practice must never see a Teeth tab or a "Teeth chart" link (isDentalPractice decides).
describe('the tooth chart shows for dental practices only', () => {
  beforeEach(() => isDental.mockReset());

  it('adds the Teeth tab, next to the encounters, for a dental practice', async () => {
    isDental.mockResolvedValue(true);
    renderTabs();
    await waitFor(() => expect(screen.getByRole('tab', { name: 'Teeth' })).toBeInTheDocument());
    expect(screen.getAllByRole('tab').map(tab => tab.getAttribute('aria-label'))).toEqual([
      'Overview',
      'Encounters',
      'Teeth',
      'Medications',
      'Media',
      'Laboratory',
      'Imaging',
      'Billing',
      'Change history'
    ]);
  });

  it('shows no Teeth tab for any other practice, nor while the practice type is unknown', async () => {
    isDental.mockResolvedValue(false);
    renderTabs();
    expect(screen.queryByRole('tab', { name: 'Teeth' })).toBeNull();
    await waitFor(() => expect(isDental).toHaveBeenCalledWith('practice-1'));
    expect(screen.queryByRole('tab', { name: 'Teeth' })).toBeNull();
  });

  it('links a quote or invoice back to the chart only in a dental practice', async () => {
    isDental.mockResolvedValue(true);
    const { unmount } = render(
      <MemoryRouter>
        <TeethChartLink patientId="patient 1" practiceId="practice-1" />
      </MemoryRouter>
    );
    expect(await screen.findByRole('link', { name: 'Teeth chart' })).toHaveAttribute('href', '/patients?patientId=patient%201&tab=teeth');
    unmount();

    isDental.mockResolvedValue(false);
    render(
      <MemoryRouter>
        <TeethChartLink patientId="patient 1" practiceId="practice-2" />
      </MemoryRouter>
    );
    await waitFor(() => expect(isDental).toHaveBeenCalledWith('practice-2'));
    expect(screen.queryByRole('link', { name: 'Teeth chart' })).toBeNull();
  });
});
