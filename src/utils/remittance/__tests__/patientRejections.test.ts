import { describe, expect, it } from 'vitest';
import { summarizeOpenRejections } from '../patientRejections';

// Business rule: reception opening a patient's file must see that the medical aid did not pay some of this
// patient's claims, how much money is waiting on them and the first deadline to resubmit, because a missed
// deadline means the practice can no longer claim that money from the fund.
describe("a patient's claims that need attention", () => {
  it('adds up what is at stake and finds the soonest deadline', () => {
    const summary = summarizeOpenRejections([
      { at_stake: '450.50', resubmit_by: '2026-11-30' },
      { at_stake: 120, resubmit_by: '2026-10-20' },
      { at_stake: null, resubmit_by: null }
    ]);
    expect(summary).toEqual({ count: 3, atStakeCents: 57050, nextDeadline: '2026-10-20' });
  });

  it('never lets a negative amount reduce what the practice is owed', () => {
    expect(summarizeOpenRejections([{ at_stake: -50, resubmit_by: null }, { at_stake: 10, resubmit_by: null }]).atStakeCents).toBe(1000);
  });

  it('has nothing to say when there are no open items', () => {
    expect(summarizeOpenRejections([])).toEqual({ count: 0, atStakeCents: 0, nextDeadline: null });
  });

  it('ignores a deadline that is not a date', () => {
    expect(summarizeOpenRejections([{ at_stake: 1, resubmit_by: 'soon' }]).nextDeadline).toBeNull();
  });
});
