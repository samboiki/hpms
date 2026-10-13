import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const practice = vi.hoisted(() => ({ dental: false as boolean | null, optometry: false as boolean | null }));
vi.mock('../../../dental/useDentalPractice', () => ({ useDentalPractice: () => practice.dental }));
vi.mock('../../../optometry/useOptometryPractice', () => ({ useOptometryPractice: () => practice.optometry }));
const service = vi.hoisted(() => ({ loadDueDate: vi.fn(), saveDueDate: vi.fn() }));
vi.mock('../../../../services/pregnancyService', async () => {
  const actual = await vi.importActual<typeof import('../../../../services/pregnancyService')>('../../../../services/pregnancyService');
  return { ...actual, ...service };
});
vi.mock('react-hot-toast', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));
vi.mock('@iconify/react', () => ({ Icon: () => null }));

import { PregnancyDueDateCard } from '../PregnancyDueDateCard';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
beforeEach(() => {
  practice.dental = false;
  practice.optometry = false;
  service.loadDueDate.mockReset().mockResolvedValue(null);
  service.saveDueDate.mockReset().mockResolvedValue(undefined);
  // 13 October 2026, 10:00 in Windhoek
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-13T08:00:00Z'));
});

describe('the pregnancy due date on the patient file', () => {
  it('never appears in a dental or optometry practice', async () => {
    practice.dental = true;
    const { container } = render(<PregnancyDueDateCard practiceId="practice-1" patientId="patient-1" gender="female" />);
    expect(container.textContent).toBe('');
    expect(service.loadDueDate).not.toHaveBeenCalled();
  });

  it('shows the due date with how far along the patient is', async () => {
    service.loadDueDate.mockResolvedValue('2027-03-14');
    render(<PregnancyDueDateCard practiceId="practice-1" patientId="patient-1" gender="female" />);
    expect(await screen.findByText('Due 14 Mar 2027')).toBeTruthy();
    expect(screen.getByText('18 weeks 2 days pregnant')).toBeTruthy();
  });

  it('offers nothing for a patient recorded as male', async () => {
    const { container } = render(<PregnancyDueDateCard practiceId="practice-1" patientId="patient-1" gender="male" />);
    await waitFor(() => expect(service.loadDueDate).toHaveBeenCalled());
    await waitFor(() => expect(container.textContent).toBe(''));
  });

  it('refuses a due date further than 40 weeks away before anything is saved (a mistyped year)', async () => {
    render(<PregnancyDueDateCard practiceId="practice-1" patientId="patient-1" gender="female" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add due date/ }));
    fireEvent.change(screen.getByLabelText('Due date'), { target: { value: '2028-03-14' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save due date' }));
    expect(await screen.findByText(/at most 40 weeks from today/)).toBeTruthy();
    expect(service.saveDueDate).not.toHaveBeenCalled();
  });

  it('works the due date out from the last period and saves it', async () => {
    render(<PregnancyDueDateCard practiceId="practice-1" patientId="patient-1" gender="female" />);
    fireEvent.click(await screen.findByRole('button', { name: /Add due date/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Work it out from the last period' }));
    fireEvent.change(screen.getByLabelText('First day of the last period'), { target: { value: '2026-09-01' } });
    expect(screen.getByText('8 Jun 2027')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save due date' }));
    await waitFor(() => expect(service.saveDueDate).toHaveBeenCalledWith('practice-1', 'patient-1', '2027-06-08'));
  });
});
