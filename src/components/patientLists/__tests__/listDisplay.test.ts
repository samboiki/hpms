import { describe, it, expect } from 'vitest';
import { getSmsLength } from '../../messages/messageText';
import { DEFAULT_AUTOMATION, isQuietTime, parseTime, validateAutomation } from '../../../utils/patientLists/listAutomation';
import { buildMessageValues, findUnknownVariables, renderListMessage } from '../../../utils/patientLists/listMessages';
import { validateRule, type ListMember, type PatientFacts } from '../../../utils/patientLists/listRules';
import {
  automaticSendLine,
  automaticSendState,
  buildMembersCsv,
  csvCell,
  csvFileName,
  describeRule,
  memberReason,
  recallNoticeText,
  recallStatusText,
  skipReasonLabel
} from '../listDisplay';
import { LIST_PRESETS, REPEAT_MEDICINE_PRESET, uniqueListName } from '../listPresets';

const TODAY = '2026-10-07';

const facts = (overrides: Partial<PatientFacts> = {}): PatientFacts => ({
  patientId: 'p1',
  firstName: 'Maria',
  lastName: 'Shikongo',
  dateOfBirth: '1986-10-07',
  cellNumber: '081 123 4567',
  smsOptOut: false,
  lastCompletedVisitOn: '2026-03-03',
  lastCompletedByType: {},
  completedVisitsLastYear: 1,
  nextBookingOn: '2026-10-20',
  nextBookingTime: '09:30',
  lastNoShowOn: '2026-10-01',
  balanceDue: 450,
  oldestUnpaidOn: '2026-08-01',
  ...overrides
});

const member = (overrides: Partial<ListMember> = {}, factOverrides: Partial<PatientFacts> = {}): ListMember => ({
  patientId: 'p1',
  facts: facts(factOverrides),
  automatic: true,
  manual: false,
  addedAt: null,
  lastSentAt: null,
  lastSentPeriod: null,
  ...overrides
});

describe('ready-made lists', () => {
  it('all have rules the list engine accepts, so a one-click list is never broken', () => {
    for (const preset of LIST_PRESETS) expect(validateRule(preset.rule)).toEqual({ ok: true, rule: preset.rule });
  });

  it('only use variables that can be filled, and fit one SMS for a typical patient', () => {
    const practice = { name: 'Eros Family Clinic', phone: '061 123 456' };
    for (const preset of LIST_PRESETS) {
      expect(findUnknownVariables(preset.automation.template)).toEqual([]);
      const rendered = renderListMessage(preset.automation.template, buildMessageValues(facts(), practice, TODAY));
      expect(rendered.missing).toEqual([]);
      expect(getSmsLength(rendered.text).parts).toBe(1);
    }
  });

  it('can be switched on as they are: their send time is outside their quiet hours', () => {
    for (const preset of LIST_PRESETS) {
      if (preset.automation.schedule === 'manual') continue;
      expect(validateAutomation(preset.automation, true).ok).toBe(true);
      const minutes = parseTime(preset.automation.sendTime) as number;
      expect(isQuietTime(minutes, preset.automation.quietStart, preset.automation.quietEnd)).toBe(false);
    }
  });

  it('greet birthdays once a year, so nobody gets "happy birthday" twice', () => {
    for (const preset of LIST_PRESETS.filter((item) => item.rule.type === 'birthday')) {
      expect(preset.automation.repeat).toBe('year');
    }
  });
});

describe('uniqueListName', () => {
  it('numbers a second "Recall due" because list names are unique per practice', () => {
    expect(uniqueListName('Recall due', ['recall due', 'Recall due 2'])).toBe('Recall due 3');
    expect(uniqueListName('Birthdays today', [])).toBe('Birthdays today');
  });
});

describe('describeRule and memberReason', () => {
  it('explains a balance rule in N$, as staff read amounts', () => {
    expect(describeRule({ type: 'outstanding_balance', minDays: 30, minAmount: 1 })).toBe(
      'Owe N$ 1.00 or more, unpaid for 30 days or more'
    );
  });

  it('says who has a birthday today and how old they turn', () => {
    expect(memberReason(member(), { type: 'birthday', window: 'this_month' }, TODAY)).toBe('Birthday today · turns 40');
  });

  it('says who turned 40 last week on a this-month list (not 41)', () => {
    expect(memberReason(member({}, { dateOfBirth: '1986-10-01' }), { type: 'birthday', window: 'this_month' }, TODAY)).toBe(
      'Birthday 1 Oct · turned 40'
    );
  });

  it('gives the date and amount behind an outstanding balance', () => {
    expect(memberReason(member(), { type: 'outstanding_balance', minDays: 30, minAmount: 1 }, TODAY)).toBe(
      'Owes N$ 450.00 · unpaid since 1 Aug 2026'
    );
  });

  // Parity O3: reception works recalls from these lists, so the patient's own recall (date and reason) shows where
  // they work: on "Recall due" instead of the months rule, and beside hand-picked members (e.g. Eminance recall lists)
  it('gives the patient\'s own recall date and reason on "Recall due", and says when it is overdue', () => {
    const recall = validateRule({ type: 'recall_due', months: 6, visitTypes: [] });
    if (!recall.ok) throw new Error(recall.error);
    expect(memberReason(member({}, { recallOn: '2026-10-07', recallReason: 'Review blood pressure' }), recall.rule, TODAY)).toBe(
      'Recall 7 Oct 2026: Review blood pressure'
    );
    expect(memberReason(member({}, { recallOn: '2026-09-01', recallReason: '6-monthly check-up' }), recall.rule, TODAY)).toBe(
      'Recall 1 Sep 2026: 6-monthly check-up (overdue)'
    );
  });

  it('adds the patient\'s recall to "Added by hand", so a hand-picked recall list says what each recall is for', () => {
    expect(memberReason(member({ automatic: false, manual: true }, { recallOn: '2027-04-12', recallReason: 'Annual check-up' }), null, TODAY)).toBe(
      'Added by hand · Recall 12 Apr 2027: Annual check-up'
    );
  });

  // Reception must see at a glance whether a recall still needs a call: due, overdue, or already booked
  it('words a recall\'s state: due, due today, overdue, booked and seen', () => {
    expect(recallStatusText({ status: 'open', dueOn: '2027-04-12', matchedOn: null }, TODAY)).toBe('Due 12 Apr 2027');
    expect(recallStatusText({ status: 'open', dueOn: TODAY, matchedOn: null }, TODAY)).toBe('Due today');
    expect(recallStatusText({ status: 'open', dueOn: '2026-09-01', matchedOn: null }, TODAY)).toBe('Overdue since 1 Sep 2026');
    expect(recallStatusText({ status: 'booked', dueOn: '2027-04-12', matchedOn: '2027-04-10' }, TODAY)).toBe('Booked for 10 Apr 2027');
    expect(recallStatusText({ status: 'seen', dueOn: '2027-04-12', matchedOn: '2027-04-10' }, TODAY)).toBe('Seen on 10 Apr 2027');
    expect(recallNoticeText({ status: 'open', dueOn: '2026-09-01' }, TODAY)).toBe('Recall overdue');
    expect(recallNoticeText({ status: 'open', dueOn: '2027-04-12' }, TODAY)).toBe('Recall 12 Apr 2027');
    expect(recallNoticeText({ status: 'booked', dueOn: '2027-04-12' }, TODAY)).toBe('Recall booked');
  });

  it('shows "Added by hand" for people staff put on the list', () => {
    expect(memberReason(member({ automatic: false, manual: true }), null, TODAY)).toBe('Added by hand');
  });

  it('names the period in the "already messaged" reason', () => {
    expect(skipReasonLabel('already_sent', 'year')).toBe('Already got this message this year');
    expect(skipReasonLabel('already_sent', 'ever')).toBe('Already got this message before (only once per patient)');
  });
});

describe('CSV export', () => {
  it('keeps a name with a comma or quote in its own column', () => {
    expect(csvCell('Shikongo, "Mary"')).toBe('"Shikongo, ""Mary"""');
  });

  it('stops a spreadsheet from running a value as a formula', () => {
    expect(csvCell('=HYPERLINK("http://x")')).toBe('"\'=HYPERLINK(""http://x"")"');
    expect(csvCell('+264811234567')).toBe('"\'+264811234567"');
  });

  it('writes dates day-first and opens in Excel with names intact (UTF-8 marker)', () => {
    const csv = buildMembersCsv([member({ lastSentAt: '2026-10-07T07:00:00Z' })], { type: 'birthday', window: 'today' }, TODAY);
    expect(csv.startsWith(String.fromCharCode(0xfeff) + '"First name","Surname"')).toBe(true);
    const row = csv.split('\r\n')[1];
    expect(row).toContain('"07/10/1986"');
    expect(row).toContain('"Automatic"');
    expect(row).toContain('"07/10/2026"');
  });

  it('names the file after the list and the date', () => {
    expect(csvFileName('Recall due (6 months)', TODAY)).toBe('recall-due-6-months-2026-10-07.csv');
  });
});

describe('Repeat medicine due (practices that dispense)', () => {
  it('is a list the engine accepts, whose message can be filled, fits one SMS and can be switched on as it is', () => {
    const preset = REPEAT_MEDICINE_PRESET;
    expect(validateRule(preset.rule)).toEqual({ ok: true, rule: preset.rule });
    expect(findUnknownVariables(preset.automation.template)).toEqual([]);
    const rendered = renderListMessage(preset.automation.template, buildMessageValues(facts(), { name: 'Eros Family Clinic', phone: '061 123 456' }, TODAY));
    expect(rendered.missing).toEqual([]);
    expect(getSmsLength(rendered.text).parts).toBe(1);
    expect(validateAutomation(preset.automation, true).ok).toBe(true);
    expect(isQuietTime(parseTime(preset.automation.sendTime) as number, preset.automation.quietStart, preset.automation.quietEnd)).toBe(false);
  });

  it('says when the repeat is due, or since when it is overdue, so staff can call the overdue first', () => {
    const rule = { type: 'repeat_medicine_due', withinDays: 7 } as const;
    expect(memberReason(member({}, { nextRepeatDueOn: '2026-10-10' }), rule, TODAY)).toBe('Repeat medicine due 10 Oct 2026');
    expect(memberReason(member({}, { nextRepeatDueOn: '2026-10-01' }), rule, TODAY)).toBe('Repeat medicine overdue since 1 Oct 2026');
    expect(memberReason(member({}, { nextRepeatDueOn: TODAY }), rule, TODAY)).toBe('Repeat medicine due today');
    expect(describeRule(rule)).toBe('A repeat of their medicine is due within 7 days or overdue, not booked in before then');
  });
});

// Business rule: staff see at a glance why a contact-lens wearer is on the list, before they call or send the message
describe('contact lenses running out, in words', () => {
  const rule = { type: 'contact_lenses_running_out', withinDays: 14 } as const;

  it('says what the list means and when each patient\'s lenses run out, day first', () => {
    expect(describeRule(rule)).toBe('Their contact lenses run out within 14 days or ran out lately, not booked in before then');
    expect(memberReason(member({}, { contactLensesRunOutOn: '2026-10-20' }), rule, TODAY)).toBe('Contact lenses run out on 20 Oct 2026');
    expect(memberReason(member({}, { contactLensesRunOutOn: TODAY }), rule, TODAY)).toBe('Contact lenses run out today');
    expect(memberReason(member({}, { contactLensesRunOutOn: '2026-09-30' }), rule, TODAY)).toBe('Contact lenses ran out on 30 Sep 2026');
  });
});

// No sender runs a list's automatic SMS yet: "Sends automatically every day at 09:00" made a practice believe its
// birthday and recall messages went out when none did
describe('automatic sending says whether it really runs', () => {
  const daily = { automation: { ...DEFAULT_AUTOMATION, schedule: 'daily' as const, sendTime: '09:00' }, automationEnabled: true };
  const at = (iso: string) => new Date(iso);

  it('is on but not running until the automatic sender has run the list', () => {
    expect(automaticSendState({ ...daily, lastRunOn: null }, at('2026-10-07T10:00:00+02:00'))).toBe('not_running');
    expect(automaticSendLine({ ...daily, lastRunOn: null }, at('2026-10-07T10:00:00+02:00'))).toBe(
      'On, but not running yet: OneHealth support must start the scheduler'
    );
  });

  it('runs while the sender ran the list today or yesterday (Windhoek days), and not after a missed day', () => {
    expect(automaticSendState({ ...daily, lastRunOn: '2026-10-07' }, at('2026-10-07T10:00:00+02:00'))).toBe('running');
    expect(automaticSendState({ ...daily, lastRunOn: '2026-10-06' }, at('2026-10-07T23:30:00+02:00'))).toBe('running');
    expect(automaticSendState({ ...daily, lastRunOn: '2026-10-05' }, at('2026-10-07T08:00:00+02:00'))).toBe('not_running');
    expect(automaticSendLine({ ...daily, lastRunOn: '2026-10-07' }, at('2026-10-07T10:00:00+02:00'))).toBe(
      'Sends automatically every day at 09:00 (last on 7 Oct 2026)'
    );
  });

  it('says nothing about a scheduler for lists that only send when staff press Send now', () => {
    const manual = { automation: { ...DEFAULT_AUTOMATION, schedule: 'manual' as const }, automationEnabled: false, lastRunOn: null };
    expect(automaticSendState(manual, at('2026-10-07T10:00:00+02:00'))).toBe('off');
    expect(automaticSendLine(manual, at('2026-10-07T10:00:00+02:00'))).toBe('Sends only when you press Send now');
  });
});
