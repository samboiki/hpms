/**
 * NAMAF dental tariff rules that funds apply on assessment (Namibian benchmark tariffs for dental practitioners,
 * effective 1 January 2025: rule 001 and the section notes), checked across the lines of one claim batch.
 * Each rule was broken in the practice's 2023-2025 claims and cost money: 8155 billed with 8159, 8107 above
 * 7 films, 8145 with a quantity, a second restoration on the same tooth pended as a possible duplicate, 8346
 * apart from its restoration, laboratory items sent as ordinary lines.
 * Errors are lines the fund will not pay; warnings are lines a fund is likely to pend or cut.
 */
import { parseToothList } from './pricing.ts';
import type { ClaimLine } from './claimLine.ts';
import { DENTAL_PRACTICE_TYPES, normalisePracticeType } from './practiceTypeNames.ts';

/**
 * These rules and suggestions are NAMAF's dental schedule: they apply to dental practices only (practices.practice_type
 * 'dental' and the dental specialists: orthodontist, maxillo-facial and oral surgeon, periodontist, prosthodontist, dental
 * therapist; practiceTypeNames.ts). OneHealth also serves GPs and other specialists, whose codes and rules differ.
 * This is the one question every dental rule asks: the tooth chart, the dental claim checks, the quote's tooth column,
 * dental lab orders and the dental code rules. 'dental_practice' is read as 'dental' (the stored text is not changed).
 */
export const isDentalPractice = (practiceType: string | null | undefined): boolean =>
  DENTAL_PRACTICE_TYPES.includes(normalisePracticeType(practiceType));

/**
 * Optometry practices (practices.practice_type 'optometry') get the eye records: prescriptions, the eye exam, lab
 * orders, contact lenses and frames (src/components/optometry). GPs, dentists and specialists see none of it.
 */
export const isOptometryPractice = (practiceType: string | null | undefined): boolean =>
  (practiceType ?? '').trim().toLowerCase() === 'optometry';

export const MATERIAL_FACTOR_CODE = '8346';
/** Posterior restorations: paid once per tooth. */
export const POSTERIOR_RESTORATION_CODES: readonly string[] = ['8341', '8342', '8343', '8344', '8367', '8368', '8369', '8370'];
/** Anterior restorations: paid per restoration. */
export const ANTERIOR_RESTORATION_CODES: readonly string[] = ['8351', '8352', '8353', '8354'];
/** Restorations that carry the 8346 material factor (10% of the restoration's unit price). */
export const RESTORATION_CODES: readonly string[] = [...POSTERIOR_RESTORATION_CODES, ...ANTERIOR_RESTORATION_CODES];
/** Infection control: "per dentist, per hygienist, per dental assistant, per visit" (NAMAF 2025). */
export const INFECTION_CONTROL_CODE = '8109';
/**
 * Whether a price list is NAMAF's dentist schedule: its codes are numbered 8xxx (8101 examination, 8109 infection
 * control, 8341 fillings ...). Only that schedule has the rule the app applies by itself, 8109 once per visit and 8346
 * with a restoration; where the list lacks 8109 staff are told. The dental therapist's list (095) is numbered 001-071 and
 * has its own infection control code (009), so nothing is added for it and no error says 8109 is missing.
 */
export const followsDentistSchedule = (rows: ReadonlyArray<{ code?: string | null }>): boolean =>
  rows.some(row => /^8\d{3}$/.test((row.code ?? '').trim()));
/** Clinical staff billed for 8109 at one visit: dentist, hygienist and assistant at most. */
export const MAX_INFECTION_CONTROL_STAFF = 3;
/** Without a practice setting 8109 is billed for one staff member, as before the setting existed. */
export const DEFAULT_INFECTION_CONTROL_STAFF = 1;
/** Charged once per visit: infection control (8109), sterilised wrapped instruments (8110), local anaesthetic (8145). */
export const PER_VISIT_CODES: readonly string[] = [INFECTION_CONTROL_CODE, '8110', '8145'];
const tariffCodeKey = (code: string): string => code.trim().toUpperCase();
export const isRestorationCode = (code: string): boolean => RESTORATION_CODES.includes(tariffCodeKey(code));
export const isPerVisitCode = (code: string): boolean => PER_VISIT_CODES.includes(tariffCodeKey(code));
/**
 * The practice's 8109 staff count (practice_settings 'infection_control_staff'): a whole number from 1 to 3, stored as
 * a number or a numeric string. Anything else falls back to one staff member.
 */
export function infectionControlStaffCount(value: unknown): number {
  const count = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : Number.NaN;
  return Number.isInteger(count) && count >= 1 && count <= MAX_INFECTION_CONTROL_STAFF ? count : DEFAULT_INFECTION_CONTROL_STAFF;
}
export const MAX_FILMS_8107 = 7;
export const MAX_ARCHES_8304 = 2;
/**
 * The diagnosis that went with a code on at least 85% of the lines the funds accepted in 2025 (visit codes take the
 * examination code, fluoride and sealants the prophylaxis code, scaling the deposits code). Offered as an unconfirmed
 * suggestion; restorations are left to the visit notes because their code depends on the tooth.
 */
export const USUAL_ICD10_BY_CODE: Readonly<Record<string, string>> = {
  '8101': 'Z01.2',
  '8109': 'Z01.2',
  '8110': 'Z01.2',
  '8159': 'K03.6',
  '8161': 'Z29.8',
  '8163': 'Z29.8',
  '8201': 'K08.1',
  '8220': 'Z48.0'
};
/** Dental technician (laboratory) items; funds expect them under 8099 with the lab slip. */
const isLaboratoryCode = (code: string): boolean => /^\d{4}$/.test(code) && Number(code) >= 9301 && Number(code) <= 9776;

export interface TariffRuleIssue {
  /** The claim line the issue belongs to. */
  key: string;
  severity: 'error' | 'warning';
  message: string;
}

const code = (line: ClaimLine): string => (line.tariffCode ?? '').trim();
const teethOf = (line: ClaimLine): string[] => parseToothList((line.toothNumbers ?? '').trim());
/** Lines of one patient on one day: what a fund treats as one visit. */
const visitKey = (line: ClaimLine): string => `${line.patientReference || line.invoiceNumber}|${line.serviceDate ?? ''}`;

/** Checks the NAMAF rules that span lines (same visit, same tooth, line order) and per-code quantity limits. */
export function checkTariffRules(lines: readonly ClaimLine[]): TariffRuleIssue[] {
  const issues: TariffRuleIssue[] = [];
  const error = (line: ClaimLine, message: string) => issues.push({ key: line.key, severity: 'error', message });
  const warn = (line: ClaimLine, message: string) => issues.push({ key: line.key, severity: 'warning', message });
  const ordered = [...lines].sort((a, b) => a.transactionNumber - b.transactionNumber);

  const codesByVisit = new Map<string, Set<string>>();
  ordered.forEach(line => codesByVisit.set(visitKey(line), (codesByVisit.get(visitKey(line)) ?? new Set<string>()).add(code(line))));
  const visitHas = (line: ClaimLine, other: string) => codesByVisit.get(visitKey(line))?.has(other) ?? false;

  const restoredTeeth = new Map<string, string>(); // patient|tooth -> first posterior restoration line key

  ordered.forEach((line, index) => {
    const tariff = code(line);
    const quantity = typeof line.quantity === 'number' ? line.quantity : 0;

    if (tariff === '8155' && visitHas(line, '8159')) {
      error(line, 'Remove 8155: it is not paid when 8159 is claimed at the same visit (NAMAF note).');
    }
    if (tariff === '8104' && visitHas(line, '8101')) {
      warn(line, '8101 and 8104 are not paid at the same visit (NAMAF rule 001); keep the one that applies.');
    }
    if (tariff === '8107' && quantity > MAX_FILMS_8107) {
      error(line, `8107 is paid for at most ${MAX_FILMS_8107} films (NAMAF 2025: 8108 is the maximum for 8107).`);
    }
    if (tariff === '8145' && quantity > 1) {
      warn(line, '8145 (local anaesthetic) is paid once per visit in the 2025 schedule; funds pay quantity 1.');
    }
    if (tariff === '8304' && quantity > MAX_ARCHES_8304) {
      error(line, `8304 is per arch: at most ${MAX_ARCHES_8304}.`);
    }
    if (RESTORATION_CODES.includes(tariff) && quantity > 1) {
      warn(line, 'Claim each restoration on its own line with its tooth; funds pend a second unit as a possible duplicate.');
    }
    if (isLaboratoryCode(tariff)) {
      warn(line, 'Laboratory item: funds expect technician fees under 8099 with the lab slip; a quantity above 1 is pended as a possible duplicate.');
    }

    if (POSTERIOR_RESTORATION_CODES.includes(tariff)) {
      teethOf(line).forEach(tooth => {
        const toothKey = `${line.patientReference || line.invoiceNumber}|${tooth}`;
        if (restoredTeeth.has(toothKey)) {
          warn(line, `Tooth ${tooth} already has a posterior restoration in this batch; it is paid once per tooth, so the fund pends the second.`);
        } else {
          restoredTeeth.set(toothKey, line.key);
        }
      });
    }

    if (tariff === MATERIAL_FACTOR_CODE) {
      const teeth = teethOf(line);
      const sameTooth = (other: ClaimLine) => teeth.length === 0 || teethOf(other).length === 0 || teethOf(other).some(tooth => teeth.includes(tooth));
      const restorations = ordered.filter(other =>
        other.invoiceNumber === line.invoiceNumber && RESTORATION_CODES.includes(code(other)) && sameTooth(other)
      );
      const previous = ordered[index - 1];
      if (restorations.length === 0) {
        error(line, '8346 is only paid with a restoration (8341-8344, 8351-8354, 8367-8370) on the same tooth on the same invoice.');
      } else if (!previous || !restorations.includes(previous)) {
        warn(line, '8346 belongs on the line straight after its restoration (same tooth); funds read it as an add-on to the line before.');
      }
    }
  });

  return issues;
}
