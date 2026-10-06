import { describe, expect, it } from 'vitest';
import { interpretReply } from '../../../../supabase/functions/_shared/smsReplyIntent.ts';
import {
  AUTO_REPLY_DAILY_LIMIT_PER_PHONE,
  appendCancellationNote,
  checkVisitForSmsAction,
  clinicDateKey,
  fitReply,
  formatVisitWhen,
  planReplyHandling,
  SMS_SINGLE_MESSAGE_LENGTH,
  type ReplyPlanInput,
  type SmsVisit,
} from '../../../../supabase/functions/_shared/smsReplyPlan.ts';

const NOW = new Date('2026-10-07T08:00:00Z'); // Wednesday 10:00 in Windhoek (UTC+2)
const PRACTICE = { id: 'practice-1', name: 'Kalahari Medical', contactPhone: '061 123 456' };
const OWNER = { patientId: 'patient-1', practiceId: 'practice-1' };

const visit = (overrides: Partial<SmsVisit> = {}): SmsVisit => ({
  id: 'visit-1',
  practice_id: 'practice-1',
  patient_id: 'patient-1',
  status: 'scheduled',
  is_confirmed: false,
  is_cancelled: false,
  is_checked_in: false,
  is_ready: false,
  is_handoff: false,
  scheduled_date: '2026-10-09',
  scheduled_time: '10:30:00',
  visit_date: '2026-10-09',
  visit_time: '10:30:00',
  notes: null,
  ...overrides,
});

const input = (reply: string, overrides: Partial<ReplyPlanInput> = {}): ReplyPlanInput => ({
  interpretation: interpretReply(reply, 'appointment'),
  practice: PRACTICE,
  patientId: 'patient-1',
  visit: visit(),
  upcomingVisitCount: 0,
  optOutTargetCount: 1,
  canAutoReply: true,
  originalIsAutoReply: false,
  autoRepliesInLastDay: 0,
  providerOptOut: false,
  now: NOW,
  ...overrides,
});

describe('checkVisitForSmsAction: an SMS only changes a future appointment that has not started', () => {
  it("allows the patient's own future scheduled appointment", () => {
    expect(checkVisitForSmsAction(visit(), OWNER, NOW)).toEqual({ ok: true });
  });

  it.each([
    [{ is_checked_in: true }, 'under_way'],
    [{ status: 'in-progress' }, 'under_way'],
    [{ is_handoff: true }, 'under_way'],
    [{ status: 'completed' }, 'completed'],
    [{ status: 'no-show' }, 'no_show'],
    [{ is_cancelled: true }, 'cancelled'],
  ] as Array<[Partial<SmsVisit>, string]>)('never touches a visit with %j (%s)', (flags, code) => {
    expect(checkVisitForSmsAction(visit(flags), OWNER, NOW)).toMatchObject({ ok: false, code });
  });

  it("refuses another patient's or another practice's visit", () => {
    expect(checkVisitForSmsAction(visit({ patient_id: 'patient-2' }), OWNER, NOW)).toMatchObject({ code: 'other_patient' });
    expect(checkVisitForSmsAction(visit({ practice_id: 'practice-2' }), OWNER, NOW)).toMatchObject({ code: 'other_patient' });
  });

  it('uses Namibian time (UTC+2): at 10:00 a 09:30 appointment has passed and an 11:00 one has not', () => {
    const today = { scheduled_date: '2026-10-07', visit_date: '2026-10-07' };
    expect(checkVisitForSmsAction(visit({ ...today, scheduled_time: '09:30:00' }), OWNER, NOW)).toMatchObject({ code: 'past' });
    expect(checkVisitForSmsAction(visit({ ...today, scheduled_time: '11:00:00' }), OWNER, NOW)).toEqual({ ok: true });
  });

  it('keeps a visit without a time changeable until the end of its day, and refuses one without a date', () => {
    expect(checkVisitForSmsAction(visit({ scheduled_date: '2026-10-07', scheduled_time: null }), OWNER, NOW)).toEqual({ ok: true });
    expect(checkVisitForSmsAction(visit({ scheduled_date: null, visit_date: null }), OWNER, NOW)).toMatchObject({ code: 'no_date' });
  });

  it('reads visit_date and visit_time when the scheduled pair is empty', () => {
    expect(checkVisitForSmsAction(visit({ scheduled_date: null, scheduled_time: null }), OWNER, NOW)).toEqual({ ok: true });
    expect(formatVisitWhen(visit({ scheduled_date: null, scheduled_time: null }))).toBe('Fri 9 Oct at 10:30');
  });
});

describe('dates and notes', () => {
  it('knows it is already the next day in Windhoek at 23:30 UTC', () => {
    expect(clinicDateKey(new Date('2026-10-06T23:30:00Z'))).toBe('2026-10-07');
  });

  it('writes dates day first for patients', () => {
    expect(formatVisitWhen(visit())).toBe('Fri 9 Oct at 10:30');
    expect(formatVisitWhen(visit({ scheduled_time: null }))).toBe('Fri 9 Oct');
  });

  it('adds the SMS cancellation note under existing notes instead of replacing them', () => {
    expect(appendCancellationNote('Bring the X-rays')).toBe('Bring the X-rays\n\n[Cancelled by patient by SMS]');
    expect(appendCancellationNote(null)).toBe('[Cancelled by patient by SMS]');
  });
});

describe('planReplyHandling', () => {
  it('confirms on YES and tells the patient exactly which appointment', () => {
    const plan = planReplyHandling(input('Ja'));
    expect(plan).toMatchObject({ action: 'confirm_visit', status: 'handled' });
    expect(plan.autoReply).toBe('Kalahari Medical: Thank you, your appointment on Fri 9 Oct at 10:30 is confirmed.');
  });

  it('changes nothing for a second YES but still reassures the patient', () => {
    const plan = planReplyHandling(input('yes', { visit: visit({ is_confirmed: true }) }));
    expect(plan).toMatchObject({ action: 'none', status: 'handled' });
    expect(plan.autoReply).toMatch(/is confirmed/);
  });

  it('cancels on NO and offers the way back (BOOK or the practice number)', () => {
    const plan = planReplyHandling(input('2'));
    expect(plan).toMatchObject({ action: 'cancel_visit', status: 'handled' });
    expect(plan.autoReply).toBe(
      'Kalahari Medical: Your appointment on Fri 9 Oct at 10:30 is cancelled. Reply BOOK or call 061 123 456 to make a new one.'
    );
  });

  it('sends YES for a cancelled appointment to staff, to call the patient, with no automatic answer', () => {
    const plan = planReplyHandling(input('yes', { visit: visit({ is_cancelled: true, status: 'cancelled' }) }));
    expect(plan).toMatchObject({ action: 'none', status: 'new', autoReply: null });
    expect(plan.note).toMatch(/call the patient/);
  });

  it('never applies a cancel once the patient is checked in', () => {
    expect(planReplyHandling(input('cancel', { visit: visit({ is_checked_in: true }) }))).toMatchObject({
      action: 'none',
      status: 'new',
      autoReply: null,
    });
  });

  it('asks staff which appointment is meant when none is linked and the patient has several', () => {
    const plan = planReplyHandling(input('yes', { visit: null, upcomingVisitCount: 2 }));
    expect(plan).toMatchObject({ action: 'none', status: 'new', autoReply: null });
    expect(plan.note).toMatch(/2 upcoming appointments/);
  });

  it('never answers a reply that cannot be tied to a practice (nobody to bill, nobody to sign it)', () => {
    expect(planReplyHandling(input('yes', { practice: null }))).toMatchObject({ action: 'none', status: 'new', autoReply: null });
  });

  it('opts out on STOP and says that appointment and results messages continue', () => {
    const plan = planReplyHandling(input('STOP'));
    expect(plan).toMatchObject({ action: 'opt_out', status: 'handled' });
    expect(plan.autoReply).toMatch(/appointments and results will still be sent\. Reply START to undo\.$/);
  });

  it('sends no answer after an opt-out SMSPortal recorded itself: SMSPortal would block it anyway', () => {
    const plan = planReplyHandling(
      input('', { interpretation: interpretReply('', 'none', { providerOptOut: true }), providerOptOut: true })
    );
    expect(plan).toMatchObject({ action: 'opt_out', autoReply: null });
  });

  it('sends STOP from a number no patient file has to staff, without promising anything', () => {
    expect(planReplyHandling(input('STOP', { optOutTargetCount: 0 }))).toMatchObject({ action: 'none', status: 'new', autoReply: null });
  });

  it('answers HELP with the practice number and the reply options', () => {
    const plan = planReplyHandling(input('HELP'));
    expect(plan).toMatchObject({ action: 'none', status: 'handled' });
    expect(plan.autoReply).toMatch(/Call us on 061 123 456\./);
    expect(plan.autoReply).toMatch(/STOP to opt out\.$/);
  });

  it('leaves a low rating for staff to follow up and files a good one', () => {
    const low = planReplyHandling(input('2', { interpretation: interpretReply('2', 'feedback'), visit: null }));
    expect(low).toMatchObject({ status: 'new' });
    expect(low.note).toMatch(/consider calling/);
    expect(planReplyHandling(input('5', { interpretation: interpretReply('5', 'feedback'), visit: null }))).toMatchObject({
      status: 'handled',
    });
  });

  it('sends a mixed reply to staff with no automatic answer', () => {
    const plan = planReplyHandling(input('yes but can we move it'));
    expect(plan).toMatchObject({ action: 'none', status: 'new', autoReply: null });
    expect(plan.note).toMatch(/^Needs a person/);
  });

  it('never answers an automatic answer (no SMS loops), but still acts on a clear reply', () => {
    const plan = planReplyHandling(input('Ja', { originalIsAutoReply: true }));
    expect(plan).toMatchObject({ action: 'confirm_visit', autoReply: null });
    expect(plan.note).toMatch(/automatic message/);
  });

  it('stops answering a number after the daily limit, and never answers a number that cannot receive SMS', () => {
    expect(planReplyHandling(input('HELP', { autoRepliesInLastDay: AUTO_REPLY_DAILY_LIMIT_PER_PHONE })).autoReply).toBeNull();
    expect(planReplyHandling(input('HELP', { canAutoReply: false })).autoReply).toBeNull();
  });

  it('keeps every automatic answer to one SMS (one credit), even for a long practice name', () => {
    const practice = { ...PRACTICE, name: 'Dr Ndapewa Shikongo Family Dental and Wellness Practice Windhoek', contactPhone: '+264 61 123 4567' };
    const cases: ReplyPlanInput[] = [
      input('Ja', { practice }),
      input('2', { practice }),
      input('3', { practice }),
      input('BOOK', { practice }),
      input('STOP', { practice }),
      input('START', { practice }),
      input('HELP', { practice }),
      input('5', { practice, interpretation: interpretReply('5', 'feedback'), visit: null }),
      input('yes', { practice, interpretation: interpretReply('yes', 'waitlist_offer'), visit: null }),
    ];
    for (const plan of cases.map(planReplyHandling)) {
      expect(plan.autoReply).toBeTruthy();
      expect(plan.autoReply!.length).toBeLessThanOrEqual(SMS_SINGLE_MESSAGE_LENGTH);
      expect(plan.autoReply!.startsWith('Dr Ndapewa')).toBe(true);
    }
  });

  it('shortens only the practice name to fit, never the instruction', () => {
    const text = fitReply((name) => `${name}: Reply STOP to opt out.`, 'A'.repeat(200));
    expect(text.length).toBeLessThanOrEqual(SMS_SINGLE_MESSAGE_LENGTH);
    expect(text.endsWith(': Reply STOP to opt out.')).toBe(true);
  });
});
