import { describe, it, expect } from 'vitest';
import { getSmsLength } from '../../messages/messageText';
import { isQuietTime, parseTime, validateAutomation } from '../../../utils/patientLists/listAutomation';
import { buildMessageValues, findUnknownVariables, renderListMessage } from '../../../utils/patientLists/listMessages';
import { validateRule, type ListMember, type PatientFacts } from '../../../utils/patientLists/listRules';
import { buildMembersCsv, csvCell, csvFileName, describeRule, memberReason, skipReasonLabel } from '../listDisplay';
import { LIST_PRESETS, uniqueListName } from '../listPresets';

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
