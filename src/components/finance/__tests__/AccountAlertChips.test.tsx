/**
 * The account alerts beside the patient's name when the file opens: a promise to pay still open (an
 * overdue one in a warning tone) and "Credit-control notes", each one tap to the account on the
 * Billing tab. Nothing shows when there is nothing, so the header stays calm. Database calls are replaced.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { normalizePromise, normalizeReceipt } from '../../../services/ledgerService';

const mocks = vi.hoisted(() => ({ loadAccountAlerts: vi.fn() }));

vi.mock('../debtors/debtorsService', async importOriginal => ({
  ...(await importOriginal<typeof import('../debtors/debtorsService')>()),
  loadAccountAlerts: mocks.loadAccountAlerts
}));

import { AccountAlertChips } from '../debtors/AccountFlagBadges';

const promise = (promisedOn: string, amount = 200) =>
  normalizePromise({ id: `pp-${promisedOn}`, patient_id: 'holder', made_on: '2026-10-01', promised_on: promisedOn, amount, created_at: '2026-10-01T09:00:00+02:00' })!;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-08T10:00:00'));
  mocks.loadAccountAlerts.mockReset();
});
afterEach(() => vi.useRealTimers());

const renderChips = (onOpen = vi.fn()) => {
  render(<AccountAlertChips practiceId="practice-1" accountId="holder" familyIds={['holder', 'kid']} onOpen={onOpen} />);
  return onOpen;
};

describe('account alerts on the patient file', () => {
  it('shows an open promise and credit-control notes, each one tap to the account', async () => {
    mocks.loadAccountAlerts.mockResolvedValue({ promises: [promise('2026-10-15')], receipts: [], hasNotes: true });
    const onOpen = renderChips();
    fireEvent.click(await screen.findByRole('button', { name: 'Promised N$ 200.00 by 15 Oct 2026' }));
    fireEvent.click(screen.getByRole('button', { name: 'Credit-control notes' }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    // One request for the whole account, from a year back (older promises are history, not alerts)
    expect(mocks.loadAccountAlerts).toHaveBeenCalledWith('practice-1', 'holder', ['holder', 'kid'], '2025-10-08');
  });

  it('shows an overdue promise in a warning tone with what is still short', async () => {
    mocks.loadAccountAlerts.mockResolvedValue({ promises: [promise('2026-10-05')], receipts: [], hasNotes: false });
    renderChips();
    const chip = await screen.findByRole('button', { name: 'Promise overdue: N$ 200.00 not paid by 5 Oct 2026' });
    expect(chip.className).toContain('bg-amber-50');
  });

  it('counts a family member\'s payment: a kept promise shows nothing', async () => {
    mocks.loadAccountAlerts.mockResolvedValue({
      promises: [promise('2026-10-05')],
      receipts: [normalizeReceipt({ id: 'r1', receipt_number: 'RC-1', patient_id: 'kid', payer_type: 'patient', amount: '200.00', received_on: '2026-10-04' })],
      hasNotes: false
    });
    const { container } = render(<AccountAlertChips practiceId="practice-1" accountId="holder" familyIds={['holder', 'kid']} onOpen={vi.fn()} />);
    await waitFor(() => expect(mocks.loadAccountAlerts).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it('shows nothing when the account has no promise and no notes, or when they cannot be read', async () => {
    mocks.loadAccountAlerts.mockResolvedValueOnce({ promises: [], receipts: [], hasNotes: false });
    const first = render(<AccountAlertChips practiceId="practice-1" accountId="holder" familyIds={[]} onOpen={vi.fn()} />);
    await waitFor(() => expect(mocks.loadAccountAlerts).toHaveBeenCalledTimes(1));
    expect(first.container).toBeEmptyDOMElement();

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.loadAccountAlerts.mockRejectedValueOnce(new Error('network down'));
    const second = render(<AccountAlertChips practiceId="practice-1" accountId="other" familyIds={[]} onOpen={vi.fn()} />);
    await waitFor(() => expect(mocks.loadAccountAlerts).toHaveBeenCalledTimes(2));
    expect(second.container).toBeEmptyDOMElement();
    warn.mockRestore();
  });
});
