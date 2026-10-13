import { describe, expect, it } from 'vitest';
import {
  handleSmsReply,
  type AutoReplyRequest,
  type AutoReplyResult,
  type NewSmsReplyRow,
  type PatientPhoneRow,
  type ReplyRepository,
  type SmsLogRow,
  type SmsReplyOutcomeRow,
} from '../../../../supabase/functions/_shared/smsReplyHandler.ts';
import { replyIdempotencyKey, type SmsPortalReply } from '../../../../supabase/functions/_shared/smsReplyPayload.ts';
import {
  AUTO_REPLY_DAILY_LIMIT_PER_PHONE,
  smsVisitStage,
  type PracticeForReply,
  type SmsVisit,
} from '../../../../supabase/functions/_shared/smsReplyPlan.ts';

const NOW = new Date('2026-10-07T08:00:00Z'); // Wednesday 10:00 in Windhoek
const LOG_ID = '3f1c2b9a-7d4e-4c1a-9b2f-0a1b2c3d4e5f';
const VISIT_ID = '8a6e0f3c-2b1d-4e5f-9a8b-7c6d5e4f3a2b';
const OTHER_VISIT_ID = '1b2c3d4e-5f60-4718-9a0b-c1d2e3f4a5b6';

type StoredReply = NewSmsReplyRow & { id: string } & Partial<SmsReplyOutcomeRow>;
type PatientRow = PatientPhoneRow & { sms_opt_out: boolean };

/** SQL LIKE as a RegExp (the database does this for the real repository). */
const like = (pattern: string) =>
  new RegExp(`^${pattern.split('%').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*')}$`, 'i');

/** The database and SMS gateway in memory, with the same unique key on provider_event_id. */
function fakeWorld() {
  const state = {
    logs: [] as SmsLogRow[],
    patients: [] as PatientRow[],
    practices: [] as PracticeForReply[],
    visits: [] as SmsVisit[],
    replies: [] as StoredReply[],
    sent: [] as AutoReplyRequest[],
    remindersCancelled: [] as string[],
    visitWrites: 0,
    failVisitWrites: false,
    failInsert: false,
    gatewayResult: { ok: true, logId: 'auto-log-1' } as AutoReplyResult,
  };

  const repo: ReplyRepository = {
    async findSmsLog(logId) {
      return state.logs.find((log) => log.id === logId) ?? null;
    },
    async findRecentSmsLogs(pattern, sinceIso) {
      return state.logs
        .filter((log) => like(pattern).test(log.recipient_phone ?? '') && (log.created_at ?? '') >= sinceIso)
        .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''));
    },
    async findPatientsByPhone(pattern, practiceId) {
      return state.patients.filter((patient) => like(pattern).test(patient.cell_number ?? '') && (!practiceId || patient.practice_id === practiceId));
    },
    async findPractice(practiceId) {
      return state.practices.find((practice) => practice.id === practiceId) ?? null;
    },
    async findVisit(visitId) {
      return state.visits.find((visit) => visit.id === visitId) ?? null;
    },
    async findUpcomingVisits(patientId, practiceId, fromDate) {
      return state.visits.filter(
        (visit) =>
          visit.patient_id === patientId &&
          visit.practice_id === practiceId &&
          !visit.is_cancelled &&
          ((visit.scheduled_date ?? '') >= fromDate || (visit.visit_date ?? '') >= fromDate)
      );
    },
    async insertReply(row) {
      if (state.failInsert) throw new Error('database unavailable');
      if (state.replies.some((reply) => reply.provider_event_id === row.provider_event_id)) return 'duplicate';
      const id = `reply-${state.replies.length + 1}`;
      state.replies.push({ ...row, id });
      return { id };
    },
    async recordOutcome(replyId, outcome) {
      Object.assign(state.replies.find((reply) => reply.id === replyId) ?? {}, outcome);
    },
    async countAutoReplies(e164, sinceIso) {
      return state.replies.filter((reply) => reply.source_phone_e164 === e164 && reply.auto_reply_log_id && reply.received_at >= sinceIso).length;
    },
    async updateScheduledVisit(visitId, owner, changes) {
      const visit = state.visits.find((v) => v.id === visitId);
      if (
        state.failVisitWrites ||
        !visit ||
        visit.patient_id !== owner.patientId ||
        visit.practice_id !== owner.practiceId ||
        smsVisitStage(visit) !== 'scheduled'
      ) {
        return false;
      }
      Object.assign(visit, changes);
      state.visitWrites += 1;
      return true;
    },
    async cancelPendingReminders(visitId) {
      state.remindersCancelled.push(visitId);
    },
    async setSmsOptOut(practiceId, patientIds, optOut) {
      const changing = state.patients.filter((p) => p.practice_id === practiceId && patientIds.includes(p.id) && p.sms_opt_out !== optOut);
      changing.forEach((patient) => {
        patient.sms_opt_out = optOut;
      });
      return changing.length;
    },
    async sendAutoReply(request) {
      state.sent.push(request);
      return state.gatewayResult;
    },
  };

  // Maria (081 123 4567) has an appointment on Fri 9 Oct at 10:30 and was sent a reminder yesterday
  state.practices.push(
    { id: 'practice-1', name: 'Kalahari Medical', contactPhone: '061 123 456' },
    { id: 'practice-2', name: 'Oshana Clinic', contactPhone: null }
  );
  state.patients.push({ id: 'patient-1', practice_id: 'practice-1', cell_number: '081 123 4567', sms_opt_out: false });
  state.visits.push({
    id: VISIT_ID,
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
    notes: 'Bring the X-rays',
  });
  state.logs.push({
    id: LOG_ID,
    practice_id: 'practice-1',
    patient_id: 'patient-1',
    visit_id: VISIT_ID,
    appointment_id: null,
    recipient_phone: '081 123 4567',
    message_type: 'appointment_reminder',
    message_content: 'Kalahari Medical: reminder for Fri 9 Oct at 10:30. Reply 1 to confirm, 2 to cancel, 3 for a new time.',
    metadata: {},
    created_at: '2026-10-06T08:00:00Z',
  });
  return { repo, state };
}

/** What SMSPortal sends when Maria answers the reminder (customerId = the reminder's log id). */
const smsportalReply = (overrides: Partial<SmsPortalReply> = {}): SmsPortalReply => ({
  eventId: '50123',
  incomingId: '90017',
  sentId: '70011',
  sourcePhone: '264811234567',
  destinationPhone: '31234',
  customerId: LOG_ID,
  optOut: false,
  optOutPhrase: null,
  campaign: null,
  incomingText: 'Ja',
  incomingAt: '2026-10-07T07:59:00.000Z',
  sentText: null,
  sentAt: null,
  ...overrides,
});

const handle = (repo: ReplyRepository, reply: SmsPortalReply) =>
  handleSmsReply({ reply, eventKey: replyIdempotencyKey(reply) ?? 'missing', rawPayload: { test: true }, now: NOW }, repo);

describe('handleSmsReply', () => {
  it("confirms the visit when a patient replies 'Ja' to a reminder, and sends one confirmation through the gateway", async () => {
    const { repo, state } = fakeWorld();
    const result = await handle(repo, smsportalReply());

    expect(result).toMatchObject({ duplicate: false, intent: 'confirm', action: 'confirm_visit', status: 'handled' });
    expect(state.visits[0].is_confirmed).toBe(true);
    expect(state.sent).toHaveLength(1);
    expect(state.sent[0]).toMatchObject({
      practiceId: 'practice-1',
      phone: '+264811234567',
      patientId: 'patient-1',
      visitId: VISIT_ID,
      inReplyToLogId: LOG_ID,
      text: 'Kalahari Medical: Thank you, your appointment on Fri 9 Oct at 10:30 is confirmed.',
    });
    expect(state.replies[0]).toMatchObject({
      practice_id: 'practice-1',
      patient_id: 'patient-1',
      visit_id: VISIT_ID,
      sms_log_id: LOG_ID,
      intent: 'confirm',
      status: 'handled',
      handled_at: NOW.toISOString(),
      auto_reply_log_id: 'auto-log-1',
      provider_event_id: 'smsportal:incoming:90017',
    });
    expect(state.replies[0].action_taken).toMatch(/confirmed\. Automatic answer sent\.$/);
  });

  it('stores a duplicate webhook delivery once and never acts or answers twice', async () => {
    const { repo, state } = fakeWorld();
    await handle(repo, smsportalReply());
    // SMSPortal retries the same incoming SMS (it may even carry a new event id)
    const retry = await handle(repo, smsportalReply({ eventId: '50999' }));

    expect(retry).toEqual({ duplicate: true });
    expect(state.replies).toHaveLength(1);
    expect(state.visitWrites).toBe(1);
    expect(state.sent).toHaveLength(1);
  });

  it('sends a reply that says yes but asks to move to staff, not to an automatic confirm', async () => {
    const { repo, state } = fakeWorld();
    const result = await handle(repo, smsportalReply({ incomingText: 'yes but can we move it to Friday' }));

    expect(result).toMatchObject({ intent: 'free_text', action: 'none', status: 'new' });
    expect(state.visits[0].is_confirmed).toBe(false);
    expect(state.sent).toHaveLength(0);
    expect(state.replies[0].action_taken).toMatch(/^Needs a person/);
  });

  it("cancels on 'Nee' the way the app does: cancelled, the patient's note added, no more reminders", async () => {
    const { repo, state } = fakeWorld();
    const result = await handle(repo, smsportalReply({ incomingText: 'Nee' }));

    expect(result).toMatchObject({ intent: 'cancel', action: 'cancel_visit', status: 'handled' });
    expect(state.visits[0]).toMatchObject({
      is_cancelled: true,
      status: 'cancelled',
      notes: 'Bring the X-rays\n\n[Cancelled by patient by SMS]',
    });
    expect(state.remindersCancelled).toEqual([VISIT_ID]);
    expect(state.sent[0].text).toMatch(/is cancelled\. Reply BOOK or call 061 123 456/);
  });

  it('never cancels a visit the patient is already checked in for', async () => {
    const { repo, state } = fakeWorld();
    state.visits[0].is_checked_in = true;
    const result = await handle(repo, smsportalReply({ incomingText: 'cancel' }));

    expect(result).toMatchObject({ intent: 'cancel', action: 'none', status: 'new' });
    expect(state.visits[0].is_cancelled).toBe(false);
    expect(state.sent).toHaveLength(0);
  });

  it('does not tell the patient the visit is confirmed when it could not be saved', async () => {
    const { repo, state } = fakeWorld();
    state.failVisitWrites = true;
    const result = await handle(repo, smsportalReply());

    expect(result).toMatchObject({ action: 'none', status: 'new' });
    expect(state.sent).toHaveLength(0);
    expect(state.replies[0].action_taken).toMatch(/confirm it by hand/);
  });

  it('records for staff that the confirmation could not be sent (e.g. no SMS bundle), after confirming', async () => {
    const { repo, state } = fakeWorld();
    state.gatewayResult = { ok: false, error: 'No active SMS subscription found for this practice' };
    const result = await handle(repo, smsportalReply());

    expect(result).toMatchObject({ action: 'confirm_visit', status: 'handled' });
    expect(state.replies[0].auto_reply_log_id).toBeNull();
    expect(state.replies[0].action_taken).toMatch(/Automatic answer not sent: No active SMS subscription/);
  });

  it('never answers an automatic answer, so two systems cannot text each other forever', async () => {
    const { repo, state } = fakeWorld();
    state.logs[0] = { ...state.logs[0], message_type: 'sms_auto_reply', metadata: { auto_reply: true } };
    const result = await handle(repo, smsportalReply({ incomingText: 'HELP' }));

    expect(result).toMatchObject({ intent: 'help' });
    expect(state.sent).toHaveLength(0);
    expect(state.replies[0].action_taken).toMatch(/automatic message/);
  });

  it('stops answering a number after the daily limit of automatic answers', async () => {
    const { repo, state } = fakeWorld();
    const earlier = (i: number): StoredReply => ({
      id: `earlier-${i}`,
      practice_id: 'practice-1',
      patient_id: 'patient-1',
      visit_id: null,
      sms_log_id: null,
      source_phone: '264811234567',
      source_phone_e164: '+264811234567',
      destination_phone: null,
      message: 'HELP',
      original_message: null,
      original_message_type: null,
      intent: 'help',
      rating: null,
      status: 'handled',
      provider_event_id: `smsportal:incoming:earlier-${i}`,
      provider_opt_out: false,
      received_at: '2026-10-07T06:00:00.000Z',
      raw: {},
      auto_reply_log_id: `earlier-log-${i}`,
    });
    for (let i = 0; i < AUTO_REPLY_DAILY_LIMIT_PER_PHONE; i++) state.replies.push(earlier(i));

    await handle(repo, smsportalReply({ incomingText: 'HELP' }));
    expect(state.sent).toHaveLength(0);
    expect(state.replies[state.replies.length - 1].action_taken).toMatch(/daily limit/);
  });

  it('opts out every patient file of the practice that uses the number, and no other practice', async () => {
    const { repo, state } = fakeWorld();
    state.patients.push(
      { id: 'patient-1b', practice_id: 'practice-1', cell_number: '+264 81 123 4567', sms_opt_out: false }, // a child on the same phone
      { id: 'patient-other', practice_id: 'practice-2', cell_number: '0811234567', sms_opt_out: false } // the same person at another clinic
    );
    const result = await handle(repo, smsportalReply({ incomingText: 'STOP' }));

    expect(result).toMatchObject({ intent: 'opt_out', action: 'opt_out', status: 'handled' });
    expect(state.patients.filter((p) => p.sms_opt_out).map((p) => p.id).sort()).toEqual(['patient-1', 'patient-1b']);
    expect(state.sent[0].text).toMatch(/Reply START to undo\.$/);
  });

  it('matches an older reply without a log id to the latest message sent to that number', async () => {
    const { repo, state } = fakeWorld();
    const result = await handle(repo, smsportalReply({ customerId: 'msg-1759737600000' }));

    expect(result).toMatchObject({ intent: 'confirm', action: 'confirm_visit' });
    expect(state.replies[0].sms_log_id).toBe(LOG_ID);
  });

  it('does not trust a customerId that points at a message sent to another number', async () => {
    const { repo, state } = fakeWorld();
    state.logs[0] = { ...state.logs[0], recipient_phone: '085 999 0000' };
    const result = await handle(repo, smsportalReply());

    expect(result).toMatchObject({ intent: 'free_text', action: 'none' });
    expect(state.visits[0].is_confirmed).toBe(false);
    expect(state.replies[0].sms_log_id).toBeNull();
  });

  it("treats YES to a waitlist offer as wanting the slot and never touches the other patient's visit", async () => {
    const { repo, state } = fakeWorld();
    state.visits.push({ ...state.visits[0], id: OTHER_VISIT_ID, patient_id: 'patient-9', is_cancelled: true, status: 'cancelled' });
    state.logs[0] = {
      ...state.logs[0],
      visit_id: null,
      appointment_id: OTHER_VISIT_ID,
      metadata: { source: 'waitlist_notification' },
    };
    const result = await handle(repo, smsportalReply({ incomingText: 'YES' }));

    expect(result).toMatchObject({ intent: 'waitlist_accept', action: 'none', status: 'new' });
    expect(state.visitWrites).toBe(0);
    expect(state.replies[0].visit_id).toBeNull();
    expect(state.sent[0].text).toMatch(/We will contact you to confirm the time/);
  });

  it('routes a fresh BOOK to the only practice that knows the number', async () => {
    const { repo, state } = fakeWorld();
    state.logs.length = 0;
    const result = await handle(repo, smsportalReply({ customerId: null, incomingText: 'BOOK' }));

    expect(result).toMatchObject({ intent: 'booking', status: 'new' });
    expect(state.replies[0]).toMatchObject({ practice_id: 'practice-1', patient_id: 'patient-1' });
    expect(state.sent[0].text).toMatch(/booking request/);
  });

  it('stores a reply nobody can be matched to without a practice, and sends nothing', async () => {
    const { repo, state } = fakeWorld();
    const result = await handle(repo, smsportalReply({ sourcePhone: '264859990000', customerId: null, incomingText: 'Hello who is this' }));

    expect(result).toMatchObject({ action: 'none', status: 'new' });
    expect(state.replies[0]).toMatchObject({ practice_id: null, patient_id: null });
    expect(state.sent).toHaveLength(0);
  });

  it('throws when the reply cannot be stored, before acting, so SMSPortal can deliver it again', async () => {
    const { repo, state } = fakeWorld();
    state.failInsert = true;

    await expect(handle(repo, smsportalReply())).rejects.toThrow('database unavailable');
    expect(state.visitWrites).toBe(0);
    expect(state.sent).toHaveLength(0);
  });
});
