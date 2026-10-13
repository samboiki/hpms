/**
 * Every card on Communications > Automations, and what it honestly is (the owner's rule: every capability works, no
 * setting does nothing):
 *
 * - 'sends': OneHealth sends it by itself, end to end through one engine (a database trigger queues it, the
 *   process-automation-queue sender sends it through the SMS / email gateways). Only these have a switch.
 * - 'elsewhere': another part of OneHealth already does this job; the card says where in plain words and opens it.
 * - 'not_offered': nothing does it yet. No switch, never shown as on, and only listed under "All".
 *
 * The card ids are the ones the older screen saved in practice_automation_settings, so saved rows still match.
 * The 2026-10-08 decision for each card is in its comment.
 */
import type { WiredAutomationId } from '../../../supabase/functions/process-automation-queue/automationRules.ts';
import { claimBatchesLink, diaryReminderSettingsLink, payrollLink, remittancesLink } from '../../components/billing/invoiceLinks';

export type AutomationKind = 'sends' | 'elsewhere' | 'not_offered';

/** Where an 'elsewhere' card sends people. */
export type AutomationTarget =
  /** The diary's own reminder settings (its switch is shown on the card) */
  | { kind: 'diary_reminders'; href: string; label: string }
  /** Communications > Lists (the same page, another tab): `list` names the ready-made list to use */
  | { kind: 'lists'; list: string; label: string }
  /** Another page */
  | { kind: 'page'; href: string; label: string };

interface CardBase {
  id: string;
  name: string;
  icon: string;
  /** One plain sentence: what it sends / where the job is done / that it is not available */
  summary: string;
}

export interface SendsCard extends CardBase {
  kind: 'sends';
  id: WiredAutomationId;
  /** When it goes out and who is left out */
  when: string;
}

export interface ElsewhereCard extends CardBase {
  kind: 'elsewhere';
  target: AutomationTarget;
}

export interface NotOfferedCard extends CardBase {
  kind: 'not_offered';
  /** What staff can do by hand meanwhile, when there is something */
  meanwhile?: string;
}

export type AutomationCard = SendsCard | ElsewhereCard | NotOfferedCard;

export const AUTOMATION_CARDS: readonly AutomationCard[] = [
  // (a) Works: patients trigger -> automation_queue -> process-automation-queue -> SMS / email gateways
  {
    kind: 'sends',
    id: 'welcome-new-patient',
    name: 'Welcome new patients',
    icon: 'solar:hand-shake-bold-duotone',
    summary: 'A short welcome by SMS, email or both when a new patient file is created.',
    when:
      'Goes out a few minutes after the file is created, never between 20:00 and 07:00. Not for files without a cell number or email, files moved over from Eminance, or patients who replied STOP (SMS).'
  },
  // (a) Works: visits trigger (bookings made confirmed) -> automation_queue -> sender -> SMS gateway, linked to the
  // visit so the diary shows "Booking SMS" and the patient's reply 2 / 3 applies to that booking
  {
    kind: 'sends',
    id: 'appointment-confirmation',
    name: 'Booking confirmation',
    icon: 'solar:check-square-bold-duotone',
    summary: 'An SMS (or email) with the date, time and practitioner when a booking is made.',
    when:
      'Goes out a few minutes after the booking is made, never between 20:00 and 07:00. Not for website requests reception has not confirmed, bookings already cancelled, started or past, or patients who replied STOP. A repeat booking gets one confirmation for its first date.'
  },
  // (b) The diary sends reminders (Diary settings > Reminders, send-appointment-reminders): one reminder system
  {
    kind: 'elsewhere',
    id: 'appointment-reminder',
    name: 'Appointment reminders',
    icon: 'solar:calendar-mark-bold-duotone',
    summary: 'The diary can send reminders: the day before at your time, and optionally a few hours before.',
    target: { kind: 'diary_reminders', href: diaryReminderSettingsLink(), label: 'Open reminder settings' }
  },
  // (b) Patient lists: "Birthdays today" with a morning send (src/components/patientLists)
  {
    kind: 'elsewhere',
    id: 'birthday-wishes',
    name: 'Birthday wishes',
    icon: 'solar:gift-bold-duotone',
    summary: 'Done in Lists: create the "Birthdays today" list and switch on its morning SMS.',
    target: { kind: 'lists', list: 'Birthdays today', label: 'Open Lists' }
  },
  // (b) Patient lists: "Missed appointment" (no-shows of the last 14 days, not rebooked)
  {
    kind: 'elsewhere',
    id: 'no-show-followup',
    name: 'Missed appointments',
    icon: 'solar:calendar-search-bold-duotone',
    summary: 'Done in Lists: the "Missed appointment" list finds patients who did not come and have not rebooked.',
    target: { kind: 'lists', list: 'Missed appointment', label: 'Open Lists' }
  },
  // (b) Patient lists: "Regular follow-up due"
  {
    kind: 'elsewhere',
    id: 'follow-up',
    name: 'Follow-up care',
    icon: 'solar:heart-pulse-bold-duotone',
    summary: 'Done in Lists: the "Regular follow-up due" list finds regular patients due a visit, nothing booked.',
    target: { kind: 'lists', list: 'Regular follow-up due', label: 'Open Lists' }
  },
  // (b) Patient lists: "Recall due"
  {
    kind: 'elsewhere',
    id: 'annual-checkup',
    name: 'Check-up recalls',
    icon: 'solar:health-bold-duotone',
    summary: 'Done in Lists: the "Recall due" list finds patients not seen for months with nothing booked.',
    target: { kind: 'lists', list: 'Recall due', label: 'Open Lists' }
  },
  // (b) Patient lists: "Repeat medicine due" (offered to practices that dispense, Stock > Settings)
  {
    kind: 'elsewhere',
    id: 'prescription-refill',
    name: 'Repeat medicine due',
    icon: 'solar:pills-3-bold-duotone',
    summary: 'Done in Lists for practices that dispense: the "Repeat medicine due" list.',
    target: { kind: 'lists', list: 'Repeat medicine due', label: 'Open Lists' }
  },
  // (b) Finance > Remittances: imports a fund's remittance and matches it to the claims
  {
    kind: 'elsewhere',
    id: 'remittance-recon',
    name: 'Fund payments (remittances)',
    icon: 'solar:safe-square-bold-duotone',
    summary: 'Import a fund remittance in Finance > Remittances: OneHealth matches each line to the claims sent.',
    target: { kind: 'page', href: remittancesLink(), label: 'Open Remittances' }
  },
  // (b) Finance > Batches: claims are batched per fund and sent from there (no automatic weekly send)
  {
    kind: 'elsewhere',
    id: 'batch-submission',
    name: 'Claim batches',
    icon: 'solar:inbox-line-bold-duotone',
    summary: 'Claims are gathered per fund in Finance > Batches, where you review and send them.',
    target: { kind: 'page', href: claimBatchesLink(), label: 'Open Batches' }
  },
  // (b) Settings > Users > Payroll
  {
    kind: 'elsewhere',
    id: 'payroll-process',
    name: 'Payroll',
    icon: 'solar:wallet-money-bold-duotone',
    summary: 'Payslips are made in Settings > Users > Payroll.',
    target: { kind: 'page', href: payrollLink(), label: 'Open Users and payroll' }
  },
  // (c) Not offered: no trigger. Results reach the patient app once released (lab request > Release to patient)
  {
    kind: 'not_offered',
    id: 'lab-results',
    name: 'Lab results ready',
    icon: 'solar:test-tube-bold-duotone',
    summary: 'Patients are not told automatically when results are in.',
    meanwhile: 'Release the results to the patient app from the lab request, or SMS the patient from their file.'
  },
  // (c) Not offered: the old database trigger for this was empty
  {
    kind: 'not_offered',
    id: 'imaging-results',
    name: 'Imaging results ready',
    icon: 'solar:bone-bold-duotone',
    summary: 'Patients are not told automatically when imaging results are in.',
    meanwhile: 'SMS the patient from their file.'
  },
  // (c) Not offered: no review link is set anywhere and nothing triggers it
  {
    kind: 'not_offered',
    id: 'review-request',
    name: 'Review requests',
    icon: 'solar:star-bold-duotone',
    summary: 'Nothing asks patients for an online review yet.'
  },
  // (c) Not offered: invoices are not emailed by themselves
  {
    kind: 'not_offered',
    id: 'invoice-sent',
    name: 'Invoice by email',
    icon: 'solar:document-text-bold-duotone',
    summary: 'Invoices are not emailed automatically.',
    meanwhile: 'Email an invoice as a PDF from the patient file: Billing > Manage invoices > Email.'
  },
  // (c) Not offered automatically; the visit's Letters tab emails a sick note by hand (LetterActions)
  {
    kind: 'not_offered',
    id: 'leave-form-ready',
    name: 'Sick notes by email',
    icon: 'solar:document-medicine-bold-duotone',
    summary: 'Sick notes are not emailed automatically.',
    meanwhile: 'Email a sick note from the visit: Letters > Sick notes > Email.'
  },
  // (c) Not offered: prescriptions are not sent to patients
  {
    kind: 'not_offered',
    id: 'prescription-ready',
    name: 'Prescription ready',
    icon: 'solar:pills-bold-duotone',
    summary: 'Prescriptions are not sent to patients.'
  },
  // (c) Not offered: OneHealth does not read bank statements
  {
    kind: 'not_offered',
    id: 'transactions-import',
    name: 'Bank transactions import',
    icon: 'solar:card-transfer-bold-duotone',
    summary: 'OneHealth does not read bank statements.'
  }
];

/** What the screen knows right now, to decide which cards are really on. */
export interface AutomationLiveState {
  /** The engine's database part is in place (automation_status answered) */
  setUp: boolean;
  /** Automations the practice switched on (practice_automation_settings.enabled) */
  enabledIds: ReadonlySet<string>;
  /** The diary's own reminder switch (diary_settings), shown on the reminder card */
  diaryRemindersOn: boolean;
}

/**
 * Is the card on? Only what really runs: an automation the sender handles that the practice switched on (once the
 * engine is set up), or the diary's reminders when the diary's switch is on. A card nothing runs is never on.
 */
export function isCardOn(card: AutomationCard, state: AutomationLiveState): boolean {
  if (card.kind === 'sends') return state.setUp && state.enabledIds.has(card.id);
  if (card.kind === 'elsewhere') return card.target.kind === 'diary_reminders' && state.diaryRemindersOn;
  return false;
}

export type AutomationView = 'active' | 'all';

/** The cards a view shows: "Active" (the default) only those that are on; "All" every card, in catalog order. */
export function cardsForView(view: AutomationView, state: AutomationLiveState, cards: readonly AutomationCard[] = AUTOMATION_CARDS): AutomationCard[] {
  return view === 'all' ? [...cards] : cards.filter((card) => isCardOn(card, state));
}
