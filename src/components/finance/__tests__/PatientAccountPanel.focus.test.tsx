/**
 * Tapping an account alert beside the patient's name (a promise to pay, credit-control notes) opens
 * Billing at the account: the account section scrolls into view and is outlined. Only a recent tap
 * counts, so coming back to Billing later does not jump to the account again.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../../stores/authStore', () => ({ useAuthStore: (selector: (state: { user: { role: string } }) => unknown) => selector({ user: { role: 'receptionist' } }) }));
vi.mock('../debtors/useAccountFlags', () => ({
  useAccountFlags: () => ({
    state: 'ready', error: null, flags: [], holder: null, members: [], accountId: 'pt1', familyIds: ['pt1'], creditLimit: null, smsOptOut: null, stored: [], reload: vi.fn()
  })
}));
vi.mock('../debtors/AccountSheet', () => ({ AccountSheet: () => null }));
vi.mock('../debtors/FlagEditor', () => ({ FlagEditor: () => null }));
vi.mock('../debtors/FamilySheet', () => ({ FamilySheet: () => null }));

import { PatientAccountPanel } from '../debtors/PatientAccountPanel';

const scrollIntoView = vi.fn();
beforeEach(() => {
  scrollIntoView.mockReset();
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scrollIntoView });
});
afterEach(() => {
  delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
});

const renderPanel = (focusKey: number) => render(
  <MemoryRouter>
    <PatientAccountPanel practiceId="practice-1" patientId="pt1" patientName="Test Patient" focusKey={focusKey} />
  </MemoryRouter>
);

describe('the account section on Billing', () => {
  it('comes into view and is outlined right after an alert was tapped', () => {
    renderPanel(Date.now());
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    const section = screen.getByRole('region', { name: 'Account' });
    expect(section).toHaveFocus();
    expect(section.className).toContain('ring-2');
  });

  it('stays put when the tap was long ago (staff came back to Billing on their own)', () => {
    renderPanel(Date.now() - 60000);
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(screen.getByRole('region', { name: 'Account' }).className).not.toContain('ring-2');
  });

  it('stays put without a tap', () => {
    renderPanel(0);
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
