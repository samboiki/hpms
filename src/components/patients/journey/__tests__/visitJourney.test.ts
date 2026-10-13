import { describe, expect, it } from 'vitest';
import { toPatientInvoice, type PatientInvoiceRecord } from '../../patientBilling';
import {
  billingActionName,
  canMarkDone,
  formatVisitWhen,
  journeyStatus,
  mainAction,
  moreActions,
  recordActions,
  sortNewestFirst,
  visitBilling,
  visitBloodPressure,
  visitDateTimeAttribute,
  visitHeadline,
  visitRecords,
  visitTypeLabel,
  type JourneyVisit
} from '../visitJourney';

// All visits and invoices are invented
const TODAY = '2026-10-09';
const visit = (overrides: Partial<JourneyVisit> = {}): JourneyVisit => ({ id: 'v1', visit_date: TODAY, ...overrides });
const invoice = (overrides: Partial<PatientInvoiceRecord>) =>
  toPatientInvoice({ id: 'inv', visit_id: 'v1', total: 450, medical_aid_total: 450, patient_total: 0, payment_status: 'pending', ...overrides });

describe('formatVisitWhen', () => {
  it('writes the date day first with a 24-hour time, the way Namibian staff write it', () => {
    expect(formatVisitWhen(visit({ visit_time: '08:30:00' }))).toBe('9 Oct 2026, 08:30');
    expect(visitDateTimeAttribute(visit({ visit_time: '08:30:00' }))).toBe('2026-10-09T08:30');
  });

  it('leaves the time out when none was recorded, instead of inventing one', () => {
    expect(formatVisitWhen(visit({ visit_time: null }))).toBe('9 Oct 2026');
  });

  it('uses the booking date and time for bookings made outside the visit form', () => {
    expect(formatVisitWhen(visit({ visit_date: null, scheduled_date: '2026-10-12', scheduled_time: '14:05' }))).toBe('12 Oct 2026, 14:05');
  });

  it('says the date is not recorded rather than showing "Invalid date"', () => {
    expect(formatVisitWhen(visit({ visit_date: null }))).toBe('Date not recorded');
    expect(formatVisitWhen(visit({ visit_date: 'not a date' }))).toBe('Date not recorded');
  });
});

describe('sortNewestFirst', () => {
  it('shows the latest visit first (later time first on the same day) and undated visits last', () => {
    const sorted = sortNewestFirst([
      visit({ id: 'old', visit_date: '2026-01-05' }),
      visit({ id: 'undated', visit_date: null }),
      visit({ id: 'morning', visit_time: '08:00:00' }),
      visit({ id: 'afternoon', visit_time: '15:30:00' })
    ]);
    expect(sorted.map((item) => item.id)).toEqual(['afternoon', 'morning', 'old', 'undated']);
  });
});

describe('visitHeadline', () => {
  it('heads the card with why the patient came, keeping the visit type underneath', () => {
    expect(visitHeadline(visit({ visit_type: 'consultation', chief_complaint: ' Headache for 3 days ' }))).toEqual({
      title: 'Headache for 3 days',
      type: 'Consultation'
    });
  });

  it('falls back to the visit type alone when no reason was recorded', () => {
    expect(visitHeadline(visit({ visit_type: 'follow-up', chief_complaint: '  ' }))).toEqual({ title: 'Follow-up', type: null });
  });

  it('names visit types as the diary does and never leaves a heading empty', () => {
    expect(visitTypeLabel('procedure')).toBe('Procedure');
    expect(visitTypeLabel('eye_test')).toBe('Eye test');
    expect(visitTypeLabel(null)).toBe('Visit');
  });
});

describe('journeyStatus', () => {
  it('reads Done for a completed visit and Pending for one still open, as staff read the journey', () => {
    expect(journeyStatus(visit({ status: 'completed' }), TODAY).label).toBe('Done');
    expect(journeyStatus(visit({ status: 'in-progress' }), TODAY).label).toBe('Pending');
  });

  it('never shows a cancelled or missed booking as Pending (the old switch did, and one click marked it done)', () => {
    expect(journeyStatus(visit({ status: 'cancelled' }), TODAY).label).toBe('Cancelled');
    expect(journeyStatus(visit({ status: 'scheduled', is_cancelled: true }), TODAY).label).toBe('Cancelled');
    expect(journeyStatus(visit({ status: 'no-show' }), TODAY).label).toBe('No-show');
  });

  it('calls a booking still ahead Scheduled, but one whose day has passed Pending: it was never closed', () => {
    expect(journeyStatus(visit({ status: 'scheduled', visit_date: '2026-10-20' }), TODAY).label).toBe('Scheduled');
    expect(journeyStatus(visit({ status: 'scheduled' }), TODAY).label).toBe('Scheduled');
    expect(journeyStatus(visit({ status: 'scheduled', visit_date: '2026-10-01' }), TODAY).label).toBe('Pending');
  });

  it('treats a checked-in patient as Pending: the visit has started, it is no longer just a booking', () => {
    expect(journeyStatus(visit({ status: 'scheduled', is_checked_in: true }), TODAY).kind).toBe('pending');
  });
});

describe('canMarkDone', () => {
  it("offers Mark as done for an open visit and for today's booking", () => {
    expect(canMarkDone(visit({ status: 'in-progress' }), TODAY)).toBe(true);
    expect(canMarkDone(visit({ status: 'scheduled' }), TODAY)).toBe(true);
  });

  it('does not offer it where marking done would be wrong: a future booking, a cancelled or missed one, a done visit', () => {
    expect(canMarkDone(visit({ status: 'scheduled', visit_date: '2026-10-20' }), TODAY)).toBe(false);
    expect(canMarkDone(visit({ status: 'cancelled' }), TODAY)).toBe(false);
    expect(canMarkDone(visit({ status: 'no-show' }), TODAY)).toBe(false);
    expect(canMarkDone(visit({ status: 'completed' }), TODAY)).toBe(false);
  });
});

describe('visitBilling', () => {
  const done = visit({ status: 'completed' });

  it('says nothing until the invoices have loaded, so a card never claims "Not billed" too early', () => {
    expect(visitBilling(done, undefined, TODAY)).toEqual({ state: 'unknown' });
    expect(mainAction(visitBilling(done, undefined, TODAY))).toBe('open');
  });

  it('adds up the visit invoices in whole cents, so the amount matches the invoices to the cent', () => {
    const billing = visitBilling(done, [invoice({ id: 'a', total: 0.1 }), invoice({ id: 'b', total: 0.2 })], TODAY);
    expect(billing).toMatchObject({ state: 'billed', total: 0.3, invoiceCount: 2 });
  });

  it('leaves out cancelled invoices and other visits: a done visit whose only invoice was cancelled is not billed', () => {
    expect(visitBilling(done, [invoice({ payment_status: 'cancelled' }), invoice({ id: 'other', visit_id: 'v2' })], TODAY)).toEqual({ state: 'not-billed' });
  });

  it('only says "Not billed" once the visit is done; a booking or an open visit has nothing to bill yet', () => {
    expect(visitBilling(visit({ status: 'scheduled', visit_date: '2026-10-20' }), [], TODAY)).toEqual({ state: 'none' });
    expect(visitBilling(visit({ status: 'in-progress' }), [], TODAY)).toEqual({ state: 'none' });
  });

  it('says Unpaid while a (medical aid) invoice waits for payment, and Paid once it is settled', () => {
    expect(visitBilling(done, [invoice({})], TODAY)).toMatchObject({ label: 'Unpaid', total: 450 });
    expect(visitBilling(done, [invoice({ payment_status: 'paid' })], TODAY)).toMatchObject({ label: 'Paid' });
  });

  it('says Part paid when some money came in but more is owed', () => {
    expect(visitBilling(done, [invoice({ payment_status: 'partial' })], TODAY)).toMatchObject({ label: 'Part paid' });
    expect(visitBilling(done, [invoice({ id: 'a', payment_status: 'paid' }), invoice({ id: 'b' })], TODAY)).toMatchObject({ label: 'Part paid' });
  });

  it('says Overdue when any invoice is overdue, because that one needs chasing', () => {
    expect(visitBilling(done, [invoice({ id: 'a', payment_status: 'paid' }), invoice({ id: 'b', payment_status: 'overdue' })], TODAY)).toMatchObject({ label: 'Overdue' });
  });

  it('tells screen reader users the amount and whether it is paid', () => {
    expect(billingActionName(visitBilling(done, [invoice({ total: 1250.5 })], TODAY))).toBe('Billing: N$ 1,250.50, unpaid');
    expect(billingActionName({ state: 'not-billed' })).toBe('Billing: not billed yet');
    expect(billingActionName({ state: 'none' })).toBe('Billing');
  });
});

describe('mainAction', () => {
  it('makes billing the main action of a done visit with no bill: an unbilled visit is income never collected', () => {
    expect(mainAction(visitBilling(visit({ status: 'completed' }), [], TODAY))).toBe('billing');
  });

  it('keeps opening the visit as the main action while it is open or once it is billed', () => {
    expect(mainAction(visitBilling(visit({ status: 'in-progress' }), [], TODAY))).toBe('open');
    expect(mainAction(visitBilling(visit({ status: 'completed' }), [invoice({})], TODAY))).toBe('open');
  });
});

describe('visitRecords and recordActions', () => {
  it('counts medications from the visit and lab, imaging and media as the visit tabs list them', () => {
    const records = visitRecords(visit({ medications: [{}, {}] }), { lab: 1, imaging: 3, media: 0 });
    expect(records).toEqual({ medications: 2, lab: 1, imaging: 3, media: 0 });
  });

  it("falls back to the visit's own lab requests when the per-visit counts are missing", () => {
    expect(visitRecords(visit({ lab_requests: [{}, {}, {}] }), undefined).lab).toBe(3);
  });

  it('keeps the four shortcuts in the same order on every card, with a count only where something exists', () => {
    const actions = recordActions({ medications: 0, lab: 2, imaging: 0, media: 1 });
    expect(actions.map((action) => action.label)).toEqual(['Medications', 'Lab', 'Imaging', 'Media']);
    expect(actions.map((action) => action.countText)).toEqual([null, '2 lab requests', null, '1 file']);
    expect(actions.map((action) => action.tab)).toEqual(['medications', 'laboratory', 'imaging', 'media']);
  });
});

describe('moreActions', () => {
  it('always offers Letters, and a follow-up or reopening only once the visit is done', () => {
    expect(moreActions(visit({ status: 'in-progress' }), { canFollowUp: true }, TODAY).map((action) => action.id)).toEqual(['letters']);
    expect(moreActions(visit({ status: 'completed' }), { canFollowUp: true }, TODAY).map((action) => action.id)).toEqual(['letters', 'follow-up', 'reopen']);
  });

  it('leaves Create follow-up out where the screen cannot create one, so no button does nothing', () => {
    expect(moreActions(visit({ status: 'completed' }), { canFollowUp: false }, TODAY).map((action) => action.id)).toEqual(['letters', 'reopen']);
  });
});

describe('visitBloodPressure', () => {
  it('shows the latest of several readings (vitals arrive as a list per visit)', () => {
    const reading = visitBloodPressure([
      { blood_pressure: '150/95', created_at: '2026-10-09T08:40:00+00:00' },
      { blood_pressure: '128/82', created_at: '2026-10-09T09:10:00+00:00' },
      { blood_pressure: null, created_at: '2026-10-09T09:30:00+00:00' }
    ]);
    expect(reading).toEqual({ reading: '128/82', text: '128/82 mmHg', high: false, message: null });
  });

  it('does not repeat the unit when the reading was typed with it', () => {
    expect(visitBloodPressure({ blood_pressure: '118/76 mmHg' })?.text).toBe('118/76 mmHg');
  });

  it('flags a high reading with the same limits and words as every other vitals screen', () => {
    expect(visitBloodPressure({ blood_pressure: '150/95' })).toMatchObject({ high: true, message: expect.stringContaining('High blood pressure') });
  });

  it('shows nothing when no blood pressure was taken', () => {
    expect(visitBloodPressure([])).toBeNull();
    expect(visitBloodPressure(null)).toBeNull();
  });
});
