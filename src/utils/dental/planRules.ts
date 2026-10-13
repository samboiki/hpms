/**
 * What would make a fund refuse or cut planned work, said in plain words before the plan becomes a quote.
 * - The NAMAF rules that span the lines of one visit (8155 with 8159, a second posterior restoration on a tooth, 8346
 *   after its restoration ...) are tariffRules.ts's checkTariffRules, run on the visit's priced lines: the same check
 *   the claim batch gets, so a rule has one home.
 * - The rules that need the tooth's history live here: a code that does not fit the tooth (front and back restoration
 *   codes), a filling code for another number of surfaces, work on a tooth that was extracted (a fund pended exactly
 *   that: "tooth has been extracted previously"), a second posterior restoration within a year, the same work planned
 *   twice.
 */
import type { ClaimLine } from '../billing/claimLine';
import { addDaysToKey, formatServiceDate, isValidDateKey } from '../billing/dates';
import { POSTERIOR_RESTORATION_CODES, checkTariffRules } from '../billing/tariffRules';
import type { PlanItem, ToothRecord } from './chart';
import { isFrontTooth } from './fdi';
import type { PricedVisit } from './planPricing';
import { ADDITIONAL_CANAL_CODES, restorationSide, surfaceCodeProblem, type DentalWork } from './workTypes';

export interface PlanIssue {
  /** The plan item it is about; null for the visit as a whole or work not saved yet */
  itemId: string | null;
  /** error: the work cannot be quoted as it is; warning: a fund is likely to refuse or cut it */
  severity: 'error' | 'warning';
  message: string;
}

export interface PlannedWork {
  itemId?: string | null;
  tooth: string;
  code: string;
  work: DentalWork;
  surfaces: string | null;
}

/** A second posterior restoration on a tooth within this many days is questioned (the practice's history had 288). */
export const RESTORATION_REPEAT_DAYS = 365;

const codeKey = (code: string): string => code.trim().toUpperCase();

const TOOTH_WORK: readonly DentalWork[] = ['filling', 'crown', 'root_canal', 'extraction'];

/** Checks one piece of planned work against its tooth's record and the rest of the plan. */
export function checkPlannedWork(
  work: PlannedWork,
  context: { record: ToothRecord | undefined; openPlan: readonly PlanItem[]; today: string }
): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const itemId = work.itemId ?? null;
  const warn = (message: string) => issues.push({ itemId, severity: 'warning', message });
  const code = codeKey(work.code);
  const tooth = work.tooth.trim();

  const side = restorationSide(code);
  if (side === 'front' && !isFrontTooth(tooth)) {
    warn(`${code} is for front teeth (incisors and canines) and tooth ${tooth} is a back tooth: funds refuse a code that does not fit the tooth.`);
  } else if (side === 'back' && isFrontTooth(tooth)) {
    warn(`${code} is for back teeth (premolars and molars) and tooth ${tooth} is a front tooth: funds refuse a code that does not fit the tooth.`);
  }

  // The same rule the visit's Billing tab and the claim checks use (workTypes.ts)
  const surfaces = surfaceCodeProblem(code, work.surfaces);
  if (surfaces) warn(surfaces.message);

  const missing = context.record?.now.find(item => item.work === 'missing');
  if (missing && TOOTH_WORK.includes(work.work)) {
    const since = missing.date ? ` since ${formatServiceDate(missing.date)}` : '';
    warn(`Tooth ${tooth} is recorded as missing${since}. Funds refuse work on a tooth that was extracted: check the chart before quoting.`);
  }

  if (POSTERIOR_RESTORATION_CODES.includes(code) && isValidDateKey(context.today)) {
    const from = addDaysToKey(context.today, -RESTORATION_REPEAT_DAYS);
    const recent = (context.record?.now ?? []).find(
      item => item.code !== null && POSTERIOR_RESTORATION_CODES.includes(codeKey(item.code)) && item.date !== null && item.date >= from
    );
    if (recent?.date) {
      warn(
        `Tooth ${tooth} had a back-tooth restoration (${recent.code}) on ${formatServiceDate(recent.date)}. NAMAF pays a posterior restoration once per tooth, so the fund may refuse another: check with the fund first.`
      );
    }
  }

  // "Each additional canal" is planned once per extra canal, so twice on a molar is not a duplicate
  const twin =
    !ADDITIONAL_CANAL_CODES.includes(code) &&
    context.openPlan.find(item => item.entry.id !== itemId && !item.done && item.entry.tooth === tooth && codeKey(item.entry.tariffCode ?? '') === code);
  if (twin) warn(`${code} is already planned on tooth ${tooth}.`);

  return issues;
}

/** The fields of a claim line the NAMAF visit rules do not read. */
const RULE_LINE: Omit<ClaimLine, 'key' | 'transactionNumber' | 'tariffCode' | 'description' | 'quantity' | 'amount' | 'toothNumbers' | 'serviceDate'> = {
  systemTransactionNumber: null,
  invoiceId: null,
  invoiceNumber: 'plan',
  visitId: null,
  fundReference: '',
  membershipNumber: '',
  memberSurname: '',
  memberInitials: '',
  patientName: '',
  patientDateOfBirth: null,
  patientIdNumber: '',
  patientReference: 'plan',
  gender: '',
  practiceNumber: '',
  treatingDoctorHpcnaNumber: '',
  icd10Primary: '',
  icd10Secondary: [],
  icd10Confirmed: false
};

/**
 * The NAMAF rules across one planned visit's lines (checkTariffRules, as for a claim batch), lines that could not be
 * priced (errors: they cannot go on a quote) and missing automatic lines, each tied to its plan item where it has one.
 */
export function checkPlannedVisit(priced: PricedVisit, serviceDate: string): PlanIssue[] {
  const owner = new Map<string, string>();
  priced.items.forEach(item => item.lineIds.forEach(lineId => owner.set(lineId, item.itemId)));
  const ruleLines: ClaimLine[] = priced.lines.map((line, index) => ({
    ...RULE_LINE,
    key: line.id,
    transactionNumber: index + 1,
    tariffCode: line.code,
    description: line.description,
    quantity: line.quantity,
    amount: line.totalPrice,
    unitPrice: line.unitPrice,
    toothNumbers: (line.teethNumbers ?? []).join(','),
    serviceDate
  }));
  const issues: PlanIssue[] = checkTariffRules(ruleLines).map(issue => ({
    itemId: owner.get(issue.key) ?? null,
    severity: issue.severity,
    message: issue.message
  }));
  priced.items.forEach(item => {
    if (item.problem) issues.push({ itemId: item.itemId, severity: 'error', message: item.problem });
    item.warnings.forEach(message => issues.push({ itemId: item.itemId, severity: 'warning', message }));
  });
  priced.visitProblems.forEach(message => issues.push({ itemId: null, severity: 'warning', message }));
  return issues;
}
