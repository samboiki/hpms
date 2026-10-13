import { describe, expect, it } from 'vitest';
import {
  buildInstalments,
  describePosting,
  describeSchedule,
  normalizePlan,
  planFromDraft,
  planProgress,
  type PlanDraft
} from '../paymentPlans';

const draft = (overrides: Partial<PlanDraft> = {}): PlanDraft => ({
  title: 'Braces',
  total: '24,000.00',
  deposit: '4000',
  payments: '10',
  startKey: '2026-10-13',
  practitionerId: '',
  notes: '',
  ...overrides
});

describe('buildInstalments: what the patient agreed to pay, and when', () => {
  it('takes the deposit on the start day and spreads the rest over the months after it', () => {
    const { instalments } = buildInstalments({ totalCents: 2_400_000, depositCents: 400_000, payments: 10, startKey: '2026-10-13' });
    expect(instalments).toHaveLength(11);
    expect(instalments![0]).toEqual({ dueOn: '2026-10-13', amountCents: 400_000 });
    expect(instalments![1]).toEqual({ dueOn: '2026-11-13', amountCents: 200_000 });
    expect(instalments![10].dueOn).toBe('2027-08-13');
  });

  it('starts paying on the start day when there is no deposit', () => {
    const { instalments } = buildInstalments({ totalCents: 90_000, payments: 3, startKey: '2026-10-13' });
    expect(instalments!.map(item => item.dueOn)).toEqual(['2026-10-13', '2026-11-13', '2026-12-13']);
  });

  it('puts the odd cents on the last instalment, so the instalments add up to the total exactly', () => {
    const { instalments } = buildInstalments({ totalCents: 100_000, payments: 3, startKey: '2026-10-13' });
    expect(instalments!.map(item => item.amountCents)).toEqual([33_333, 33_333, 33_334]);
    expect(instalments!.reduce((sum, item) => sum + item.amountCents, 0)).toBe(100_000);
  });

  it('keeps month-end plans on the month\'s last day (31 Jan, 28 Feb, 31 Mar), never skipping a month', () => {
    const { instalments } = buildInstalments({ totalCents: 30_000, payments: 3, startKey: '2027-01-31' });
    expect(instalments!.map(item => item.dueOn)).toEqual(['2027-01-31', '2027-02-28', '2027-03-31']);
  });

  it('refuses what the database would refuse: a deposit of the whole total, too many payments, cents that cannot be split', () => {
    expect(buildInstalments({ totalCents: 1_000, depositCents: 1_000, payments: 1, startKey: '2026-10-13' }).error).toMatch(/less than the total/);
    expect(buildInstalments({ totalCents: 1_000, depositCents: 100, payments: 120, startKey: '2026-10-13' }).error).toMatch(/1 to 119/);
    expect(buildInstalments({ totalCents: 2, payments: 3, startKey: '2026-10-13' }).error).toMatch(/choose fewer/);
    expect(buildInstalments({ totalCents: 0, payments: 1, startKey: '2026-10-13' }).error).toMatch(/total/);
  });
});

describe('planFromDraft: the form, as reception types it', () => {
  it('reads "24,000.00" and an empty practitioner, and sends the schedule in N$ as the database checks it', () => {
    const result = planFromDraft(draft(), 'patient-1');
    expect(result.error).toBeNull();
    expect(result.payload).toMatchObject({ patient_id: 'patient-1', title: 'Braces', total: 24000, practitioner_id: null, notes: null });
    expect(result.payload!.instalments[0]).toEqual({ due_on: '2026-10-13', amount: 4000 });
    expect(result.payload!.instalments.reduce((sum, item) => sum + item.amount * 100, 0)).toBe(2_400_000);
  });

  it('asks for what is missing instead of saving a different plan', () => {
    expect(planFromDraft(draft({ title: 'B' }), 'p').error).toMatch(/Say what the plan is for/);
    expect(planFromDraft(draft({ total: 'lots' }), 'p').error).toMatch(/total agreed/);
    expect(planFromDraft(draft({ payments: '' }), 'p').error).toMatch(/monthly payments/);
  });

  it('describes the schedule in one plain sentence', () => {
    const result = planFromDraft(draft(), 'p');
    expect(describeSchedule(result.schedule!, true)).toBe('N$ 4,000.00 deposit, then 10 monthly payments of N$ 2,000.00');
    const odd = buildInstalments({ totalCents: 100_000, payments: 3, startKey: '2026-10-13' });
    expect(describeSchedule(odd.instalments!, false)).toBe('2 monthly payments of N$ 333.33 and a last one of N$ 333.34');
  });
});

describe('planProgress: where a plan stands on the patient file', () => {
  const plan = normalizePlan({
    id: 'plan-1',
    patient_id: 'p',
    title: 'Braces',
    total: '1000.00',
    created_at: '2026-09-01T08:00:00Z',
    payment_plan_instalments: [
      { id: 'i3', number: 3, due_on: '2026-11-13', amount: '300.00' },
      { id: 'i1', number: 1, due_on: '2026-09-03', amount: '400.00', invoice_id: 'inv-1', posted_on: '2026-10-01' },
      { id: 'i2', number: 2, due_on: '2026-10-13', amount: '300.00' }
    ]
  });

  it('counts what is on the account and what is left, in order, and lists what falls due now', () => {
    const progress = planProgress(plan, '2026-10-13');
    expect(progress.state).toBe('active');
    expect(progress.postedCount).toBe(1);
    expect(progress.postedCents).toBe(40_000);
    expect(progress.leftCents).toBe(60_000);
    expect(progress.next?.number).toBe(2);
    expect(progress.dueNow.map(item => item.number)).toEqual([2]);
  });

  it('posts nothing more for a stopped plan, but keeps what was posted', () => {
    const progress = planProgress({ ...plan, stoppedAt: '2026-10-13T09:00:00Z', stopReason: 'Paid in cash' }, '2026-12-31');
    expect(progress.state).toBe('stopped');
    expect(progress.next).toBeNull();
    expect(progress.dueNow).toEqual([]);
    expect(progress.postedCents).toBe(40_000);
  });

  it('is complete once every instalment is posted', () => {
    const done = { ...plan, instalments: plan.instalments.map(item => ({ ...item, postedOn: item.dueOn })) };
    expect(planProgress(done, '2026-12-31').state).toBe('completed');
  });
});

describe('describePosting', () => {
  it('says what the posting did, and why an instalment still waits', () => {
    expect(describePosting({ posted: 2, totalCents: 70_000, waiting: 0 })).toBe('2 instalments (N$ 700.00) posted to the account.');
    expect(describePosting({ posted: 0, totalCents: 0, waiting: 1 })).toMatch(/1 instalment waits for an open month/);
    expect(describePosting({ posted: 0, totalCents: 0, waiting: 0 })).toBeNull();
  });
});
