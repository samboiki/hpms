/**
 * The Inpatient page's rules (proposals/2026-10-13-inpatient-module.sql does the same checks again before saving):
 * plain-words labels for the database's codes, the bed board's counts, who may do what, the nights a stay is billed
 * for, the doses due on the medication chart and the visitor warnings. No React and no database here (tested in
 * __tests__/inpatientRules.test.ts).
 */
import type { ServiceSelection } from '../../types/billing';
import { addDaysToKey, daysBetweenKeys } from '../billing/dates';
import { toCents, fromCents, hasAtMostDecimals } from '../billing/money';
import { MAX_UNIT_PRICE, normalizeMultiplyRule } from '../billing/pricing';
import { WINDHOEK_UTC_OFFSET_MINUTES, windhoekClock } from '../patientLists/listDates';

export interface Option<T extends string = string> {
  value: T;
  label: string;
}

// ---------------------------------------------------------------------------------------------
// The database's codes in plain words (the CHECK lists of the inpatient tables)
// ---------------------------------------------------------------------------------------------

export type BedStatus = 'available' | 'occupied' | 'cleaning' | 'maintenance' | 'blocked' | 'reserved';

/** What the board shows per bed; "out of use" covers maintenance and blocked */
export const BED_STATUS_LABELS: Record<BedStatus, string> = {
  available: 'Free',
  occupied: 'Occupied',
  cleaning: 'Needs cleaning',
  maintenance: 'Out of use',
  blocked: 'Out of use',
  reserved: 'Reserved'
};

export const WARD_TYPES: readonly Option[] = [
  { value: 'general', label: 'General' },
  { value: 'surgical', label: 'Surgical' },
  { value: 'maternity', label: 'Maternity' },
  { value: 'pediatric', label: 'Children' },
  { value: 'icu', label: 'Intensive care' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'psychiatric', label: 'Mental health' },
  { value: 'oncology', label: 'Oncology' }
];

export const BED_TYPES: readonly Option[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'icu', label: 'Intensive care' },
  { value: 'pediatric', label: 'Child' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'vip', label: 'Private' },
  { value: 'emergency', label: 'Emergency' }
];

export const ROOM_TYPES: readonly Option[] = [
  { value: 'ward', label: 'Shared ward' },
  { value: 'single', label: 'Single room' },
  { value: 'double', label: 'Double room' },
  { value: 'isolation', label: 'Isolation room' },
  { value: 'vip', label: 'Private room' }
];

export const ADMISSION_TYPES: readonly Option[] = [
  { value: 'emergency', label: 'Emergency' },
  { value: 'scheduled', label: 'Planned' },
  { value: 'referral', label: 'Referred' },
  { value: 'transfer_in', label: 'Transferred in' },
  { value: 'newborn', label: 'Newborn' }
];

export const ADMISSION_SOURCES: readonly Option[] = [
  { value: 'outpatient_clinic', label: 'From a consultation here' },
  { value: 'emergency_room', label: 'Emergency room' },
  { value: 'physician_referral', label: 'Referred by a practitioner' },
  { value: 'transfer_hospital', label: 'Another hospital' },
  { value: 'transfer_ward', label: 'Another ward' },
  { value: 'walk_in', label: 'Walked in' }
];

export const ADMISSION_CONDITIONS: readonly Option[] = [
  { value: 'stable', label: 'Stable' },
  { value: 'fair', label: 'Fair' },
  { value: 'serious', label: 'Serious' },
  { value: 'critical', label: 'Critical' },
  { value: 'undetermined', label: 'Not yet known' }
];

export const ROUND_CONDITIONS: readonly Option[] = [
  { value: 'improving', label: 'Improving' },
  { value: 'stable', label: 'Stable' },
  { value: 'unchanged', label: 'Unchanged' },
  { value: 'deteriorating', label: 'Getting worse' },
  { value: 'critical', label: 'Critical' }
];

export const CONSCIOUSNESS: readonly Option[] = [
  { value: 'alert', label: 'Alert' },
  { value: 'drowsy', label: 'Drowsy' },
  { value: 'stuporous', label: 'Hard to rouse' },
  { value: 'comatose', label: 'Unresponsive' }
];

export const DISCHARGE_TYPES: readonly Option[] = [
  { value: 'home', label: 'Home' },
  { value: 'transfer', label: 'Transferred to another facility' },
  { value: 'rehab', label: 'To rehabilitation' },
  { value: 'hospice', label: 'To hospice' },
  { value: 'ama', label: 'Left against advice' },
  { value: 'expired', label: 'Died' }
];

export const ROUTES: readonly Option[] = [
  { value: 'oral', label: 'By mouth' },
  { value: 'iv', label: 'Into a vein (IV)' },
  { value: 'im', label: 'Into a muscle (IM)' },
  { value: 'subcutaneous', label: 'Under the skin' },
  { value: 'sublingual', label: 'Under the tongue' },
  { value: 'inhalation', label: 'Inhaled' },
  { value: 'topical', label: 'On the skin' },
  { value: 'rectal', label: 'Rectal' }
];

export const SHIFTS: readonly Option[] = [
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'night', label: 'Night' },
  { value: 'custom', label: 'Other' }
];

export const MOBILITY: readonly Option[] = [
  { value: 'ambulatory', label: 'Walks alone' },
  { value: 'assisted', label: 'Walks with help' },
  { value: 'wheelchair', label: 'Wheelchair' },
  { value: 'bedbound', label: 'In bed' }
];

export const TRANSFER_REASONS: readonly Option[] = [
  { value: 'medical_needs', label: 'Medical needs' },
  { value: 'isolation', label: 'Isolation' },
  { value: 'patient_request', label: 'Patient asked' },
  { value: 'bed_availability', label: 'Bed needed' }
];

export const VISIT_PURPOSES: readonly Option[] = [
  { value: 'regular_visit', label: 'Visit' },
  { value: 'caregiver', label: 'Caregiver' },
  { value: 'consultation', label: 'Family meeting' },
  { value: 'emergency', label: 'Emergency' }
];

export type DoseOutcome = 'given' | 'missed' | 'refused' | 'held';

export const DOSE_OUTCOMES: readonly Option<DoseOutcome>[] = [
  { value: 'given', label: 'Given' },
  { value: 'refused', label: 'Refused' },
  { value: 'missed', label: 'Missed' },
  { value: 'held', label: 'Held' }
];

/** The plain label of a code, or the code itself when the list does not know it (never blank) */
export function labelOf(options: readonly Option[], value: string | null | undefined): string {
  if (!value) return '';
  return options.find(option => option.value === value)?.label ?? value;
}

// ---------------------------------------------------------------------------------------------
// Who may do what (the same roles the database functions check)
// ---------------------------------------------------------------------------------------------

export type InpatientAction =
  | 'setUpWards'
  | 'admit'
  | 'transfer'
  | 'discharge'
  | 'round'
  | 'nursing'
  | 'prescribe'
  | 'giveDose'
  | 'visitors'
  | 'bedOutOfUse';

const ALLOWED: Record<InpatientAction, readonly string[]> = {
  setUpWards: ['admin'],
  admit: ['admin', 'doctor', 'nurse', 'receptionist'],
  transfer: ['admin', 'doctor', 'nurse', 'receptionist'],
  discharge: ['admin', 'doctor', 'nurse'],
  round: ['doctor'],
  nursing: ['nurse', 'doctor'],
  prescribe: ['doctor'],
  giveDose: ['nurse', 'doctor'],
  visitors: ['admin', 'doctor', 'nurse', 'receptionist'],
  bedOutOfUse: ['admin', 'nurse']
};

export function canDo(role: string | null | undefined, action: InpatientAction): boolean {
  return !!role && ALLOWED[action].includes(role);
}

// ---------------------------------------------------------------------------------------------
// The bed board
// ---------------------------------------------------------------------------------------------

export interface BoardBed {
  id: string;
  status: string | null;
  isActive: boolean;
  /** The admission in this bed now, if any */
  admissionId: string | null;
}

export type BoardState = 'free' | 'occupied' | 'cleaning' | 'outOfUse' | 'reserved';

/**
 * What the board shows for a bed. A patient in it wins over the stored status; a bed marked occupied with nobody
 * recorded in it (older setup data) shows as occupied so it is never offered for a new patient.
 */
export function boardState(bed: BoardBed): BoardState {
  if (bed.admissionId) return 'occupied';
  switch (bed.status) {
    case 'available':
      return 'free';
    case 'cleaning':
      return 'cleaning';
    case 'reserved':
      return 'reserved';
    case 'maintenance':
    case 'blocked':
      return 'outOfUse';
    default:
      return 'occupied';
  }
}

/** A bed a patient can be put in now: free or reserved, in use, nobody in it (inpatient_free_bed checks again) */
export const canTakePatient = (bed: BoardBed): boolean =>
  bed.isActive && !bed.admissionId && (bed.status === 'available' || bed.status === 'reserved');

export interface BoardCounts {
  free: number;
  occupied: number;
  cleaning: number;
  outOfUse: number;
  reserved: number;
  total: number;
}

/** Counts per state of the beds in use (beds taken out of the setup are left out) */
export function boardCounts(beds: readonly BoardBed[]): BoardCounts {
  const counts: BoardCounts = { free: 0, occupied: 0, cleaning: 0, outOfUse: 0, reserved: 0, total: 0 };
  for (const bed of beds) {
    if (!bed.isActive) continue;
    counts[boardState(bed)] += 1;
    counts.total += 1;
  }
  return counts;
}

// ---------------------------------------------------------------------------------------------
// Time in Windhoek
// ---------------------------------------------------------------------------------------------

const OFFSET_MS = WINDHOEK_UTC_OFFSET_MINUTES * 60_000;

/** The Windhoek date of a moment, yyyy-MM-dd */
export const windhoekDay = (moment: string | Date): string => windhoekClock(new Date(moment)).dateKey;

/** The moment of a Windhoek date and time of day ("2026-10-13", "08:00") */
export function windhoekMoment(dateKey: string, time: string): Date {
  const [hours, minutes] = time.split(':').map(Number);
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, hours || 0, minutes || 0) - OFFSET_MS);
}

/** "08:00" from a database time ("08:00:00") */
export const shortTime = (time: string): string => time.slice(0, 5);

/** Whole days since admission, counted by Windhoek dates (admitted today = day 1) */
export function dayOfStay(admittedAt: string, now: Date = new Date()): number {
  return daysBetweenKeys(windhoekDay(admittedAt), windhoekDay(now)) + 1;
}

// ---------------------------------------------------------------------------------------------
// Billing the stay: one line per night, in the bed the patient slept in
// ---------------------------------------------------------------------------------------------

export interface StaySegment {
  bedId: string;
  bedLabel: string;
  wardId: string;
  wardName: string;
  /** The bed's daily rate in N$, null when the setup has none */
  dailyRate: number | null;
  from: string;
  /** Null while the patient is still in this bed */
  to: string | null;
}

export interface StayNight {
  /** The date the night starts, yyyy-MM-dd */
  date: string;
  segment: StaySegment;
}

/**
 * The nights billed for a stay: every Windhoek date from the admission day up to the day before the discharge day,
 * each in the bed the patient was in at 23:59 that day. A stay that starts and ends on the same day is billed as
 * one day, in the bed the patient left from (a day case still used the bed).
 */
export function stayNights(segments: readonly StaySegment[], leftAt: string): StayNight[] {
  if (segments.length === 0) return [];
  const ordered = [...segments].sort((a, b) => a.from.localeCompare(b.from));
  const first = windhoekDay(ordered[0].from);
  const last = windhoekDay(leftAt);
  const nights: StayNight[] = [];
  for (let date = first; date < last; date = addDaysToKey(date, 1)) {
    const lateEvening = windhoekMoment(date, '23:59').getTime();
    const segment = ordered.find(item => new Date(item.from).getTime() <= lateEvening
      && (item.to === null || new Date(item.to).getTime() > lateEvening)) ?? ordered[ordered.length - 1];
    nights.push({ date, segment });
  }
  if (nights.length === 0) nights.push({ date: first, segment: ordered[ordered.length - 1] });
  return nights;
}

export interface WardBilling {
  /** The tariff code a night in a bed is billed under (priced at the bed's daily rate) */
  bedDayCode: string | null;
  /** Codes billed once per night at their own tariff price (e.g. a nursing fee) */
  dailyCodes: readonly string[];
}

export interface TariffForBilling {
  id: string;
  code: string;
  description: string;
  /** The code's amount in N$; 0 when the list has no fixed amount for it (priced by rule or at cost) */
  price: number;
  category?: string | null;
  can_be_multiplied?: string | null;
  /** Where `price` comes from, in the words the billing sheet shows ("NAMAF 2026"); absent: the practice's own price list */
  priceSource?: string | null;
}

/** Where a night's amount came from, in the words the billing sheet shows beside it (a NAMAF row carries its own: "NAMAF 2026") */
const BED_RATE_SOURCE = 'bed rate';
const PRICE_LIST_SOURCE = 'price list';
const TYPED_SOURCE = 'typed in';

/** An amount staff type on the billing sheet: the bed has no daily rate and the list has no amount for the code */
export interface AmountAsk {
  /** What typedAmounts are keyed by: `bed:<bed id>` for a bed-day line, `code:<CODE>` for a daily code */
  key: string;
  /** What the amount is for, e.g. "Bed S1, Surgical ward" */
  what: string;
  /** Why it is asked, in plain words */
  why: string;
  /** The nights it is billed for */
  nights: number;
}

export interface StayBill {
  /** Empty while anything is missing, a problem or an amount to type: a stay is never billed in part */
  lines: ServiceSelection[];
  /** Why the stay cannot be billed yet, in plain words (empty when it can) */
  problems: string[];
  /** Amounts staff still have to type before the stay can be billed (empty when none is needed) */
  asks: AmountAsk[];
  /** Where each line's amount came from, by line id: "bed rate", "NAMAF 2026", "price list" or "typed in" */
  sources: Readonly<Record<string, string>>;
  nights: number;
  totalCents: number;
}

/**
 * The invoice lines for a stay, for the app's invoice service: per night one bed-day line under the ward's bed-day code
 * plus one line per daily code, each dated its night (funds pay per day of service). A night is billed at the bed's daily
 * rate. A bed with none is billed at the code's amount on the list for that night's date (the NAMAF ward fee: tariffByCode
 * picks the list in force that day). Where the list has no amount either, staff type it (`asks`, answered through
 * `typedAmounts`) instead of the stay being blocked or a night billed at N$ 0. A daily code is billed at its list amount,
 * or typed the same way. Every code must be on the practice's tariff list (the invoice service refuses others).
 */
export function stayBill(params: {
  nights: readonly StayNight[];
  wards: ReadonlyMap<string, WardBilling>;
  /** The tariff a code bills as on a night's date (the date picks the version of a NAMAF list that was in force) */
  tariffByCode: (code: string, date: string) => TariffForBilling | undefined;
  /** What staff typed for each ask, N$ for one night, by its key */
  typedAmounts?: Readonly<Record<string, number>>;
  practitionerId?: string | null;
  icd10Codes?: readonly string[];
  authorisationNumber?: string | null;
}): StayBill {
  const problems = new Set<string>();
  const asks = new Map<string, AmountAsk>();
  const lines: ServiceSelection[] = [];
  const sources: Record<string, string> = {};
  const icd10 = (params.icd10Codes ?? []).filter(code => code.trim()).slice(0, 5);
  // A typed amount counts when it is a real price above N$ 0; anything else leaves the question open
  const typed = (key: string): number | null => {
    const amount = params.typedAmounts?.[key];
    return typeof amount === 'number' && Number.isFinite(amount) && amount > 0 && amount <= MAX_UNIT_PRICE && hasAtMostDecimals(amount, 2) ? amount : null;
  };
  const ask = (key: string, what: string, why: string) => {
    const known = asks.get(key);
    asks.set(key, known ? { ...known, nights: known.nights + 1 } : { key, what, why, nights: 1 });
  };
  const add = (tariff: TariffForBilling, unitPrice: number, date: string, note: string, source: string) => {
    const id = `stay-${lines.length + 1}`;
    sources[id] = source;
    lines.push({
      id,
      tariffId: tariff.id,
      code: tariff.code,
      description: tariff.description,
      category: tariff.category || 'Inpatient',
      unitPrice,
      quantity: 1,
      totalPrice: unitPrice,
      // One per line: a night is never multiplied, so the tariff's own rule does not refuse it
      canBeMultiplied: normalizeMultiplyRule(tariff.can_be_multiplied) !== 'NO',
      serviceDate: date,
      notes: note,
      ...(params.practitionerId ? { practitionerId: params.practitionerId } : {}),
      ...(icd10.length > 0 ? { icd10Codes: [...icd10] } : {}),
      ...(params.authorisationNumber?.trim() ? { authorisationNumber: params.authorisationNumber.trim() } : {})
    });
  };

  for (const night of params.nights) {
    const { segment } = night;
    const ward = params.wards.get(segment.wardId);
    const bedDayCode = ward?.bedDayCode?.trim().toUpperCase() || null;
    if (!bedDayCode) {
      problems.add(`${segment.wardName} has no bed-day code. An administrator sets it under Wards and beds.`);
    } else {
      const tariff = params.tariffByCode(bedDayCode, night.date);
      const place = `Bed ${segment.bedLabel}, ${segment.wardName}`;
      if (!tariff) problems.add(`Code ${bedDayCode} (bed-day, ${segment.wardName}) is not on your tariff list.`);
      else if (segment.dailyRate !== null && Number.isFinite(segment.dailyRate) && segment.dailyRate >= 0) {
        add(tariff, fromCents(toCents(segment.dailyRate)), night.date, place, BED_RATE_SOURCE);
      } else if (Number.isFinite(tariff.price) && tariff.price > 0) {
        // No daily rate on the bed: the code's own amount on the list for that night
        add(tariff, fromCents(toCents(tariff.price)), night.date, place, tariff.priceSource || PRICE_LIST_SOURCE);
      } else {
        const key = `bed:${segment.bedId}`;
        const amount = typed(key);
        if (amount !== null) add(tariff, amount, night.date, place, TYPED_SOURCE);
        else ask(key, place, `Bed ${segment.bedLabel} has no daily rate and code ${bedDayCode} has no amount on the price list. An administrator can set the bed's daily rate under Wards and beds.`);
      }
    }
    for (const raw of ward?.dailyCodes ?? []) {
      const code = raw.trim().toUpperCase();
      if (!code) continue;
      const tariff = params.tariffByCode(code, night.date);
      if (!tariff) problems.add(`Code ${code} (daily, ${segment.wardName}) is not on your tariff list.`);
      else if (Number.isFinite(tariff.price) && tariff.price > 0) add(tariff, fromCents(toCents(tariff.price)), night.date, segment.wardName, tariff.priceSource || PRICE_LIST_SOURCE);
      else {
        const key = `code:${code}`;
        const amount = typed(key);
        if (amount !== null) add(tariff, amount, night.date, segment.wardName, TYPED_SOURCE);
        else ask(key, `Code ${code}${tariff.description ? `, ${tariff.description}` : ''}`, `Code ${code} has no amount on the price list.`);
      }
    }
  }
  // Nothing is billed while a code, a bed-day code or an amount is missing: no half invoice
  const complete = problems.size === 0 && asks.size === 0;
  const totalCents = complete ? lines.reduce((sum, line) => sum + toCents(line.totalPrice), 0) : 0;
  return { lines: complete ? lines : [], problems: [...problems], asks: [...asks.values()], sources: complete ? sources : {}, nights: params.nights.length, totalCents };
}

// ---------------------------------------------------------------------------------------------
// The medication chart
// ---------------------------------------------------------------------------------------------

export interface DoseRecord {
  due_at: string;
  outcome: DoseOutcome;
  recorded_at: string;
  recorded_by: string | null;
  note: string | null;
}

export interface ChartMedication {
  startDatetime: string;
  endDatetime: string | null;
  scheduledTimes: readonly string[];
  records: readonly DoseRecord[];
}

export interface DueDose {
  /** As the database stores it: 2026-10-13T06:00:00Z */
  dueAt: string;
  /** Windhoek date and time of day */
  date: string;
  time: string;
  record: DoseRecord | null;
  /** Not recorded and more than an hour past its time */
  late: boolean;
}

/** The key a dose is stored under (inpatient_record_dose rounds to the minute, in UTC) */
export const doseKey = (moment: Date): string => `${moment.toISOString().slice(0, 16)}:00Z`;

/**
 * The doses of a medicine from yesterday until two hours from now (what a nurse needs on a shift: what is due, what
 * was missed), with what was recorded for each. Doses before the start or after the end are not due.
 */
export function dueDoses(medication: ChartMedication, now: Date = new Date()): DueDose[] {
  const today = windhoekDay(now);
  const start = new Date(medication.startDatetime).getTime();
  const end = medication.endDatetime ? new Date(medication.endDatetime).getTime() : Infinity;
  const until = now.getTime() + 2 * 3_600_000;
  const byKey = new Map(medication.records.map(record => [record.due_at, record]));
  const doses: DueDose[] = [];
  for (const date of [addDaysToKey(today, -1), today]) {
    for (const time of [...medication.scheduledTimes].map(shortTime).sort()) {
      const moment = windhoekMoment(date, time);
      const at = moment.getTime();
      if (at < start || at > end || at > until) continue;
      const dueAt = doseKey(moment);
      const record = byKey.get(dueAt) ?? null;
      // Yesterday's doses only matter while one is still open
      if (date !== today && record) continue;
      doses.push({ dueAt, date, time, record, late: !record && now.getTime() - at > 3_600_000 });
    }
  }
  return doses;
}

// ---------------------------------------------------------------------------------------------
// Visitors
// ---------------------------------------------------------------------------------------------

export interface VisitingRules {
  visitingStart: string | null;
  visitingEnd: string | null;
  maxVisitors: number | null;
}

/**
 * Warnings before a visitor is signed in: outside the ward's visiting hours, or the patient already has the most
 * visitors allowed at a time. Warnings, not refusals: a caregiver or a family in an emergency still comes in.
 */
export function visitorWarnings(rules: VisitingRules, visitorsInNow: number, now: Date = new Date()): string[] {
  const warnings: string[] = [];
  if (rules.visitingStart && rules.visitingEnd) {
    const minutes = windhoekClock(now).minutes;
    const toMinutes = (time: string) => {
      const [hours, mins] = time.split(':').map(Number);
      return (hours || 0) * 60 + (mins || 0);
    };
    if (minutes < toMinutes(rules.visitingStart) || minutes >= toMinutes(rules.visitingEnd)) {
      warnings.push(`It is outside visiting hours (${shortTime(rules.visitingStart)} to ${shortTime(rules.visitingEnd)}).`);
    }
  }
  if (rules.maxVisitors !== null && rules.maxVisitors > 0 && visitorsInNow >= rules.maxVisitors) {
    warnings.push(`The patient already has ${visitorsInNow} visitor${visitorsInNow === 1 ? '' : 's'} (at most ${rules.maxVisitors} at a time).`);
  }
  return warnings;
}
