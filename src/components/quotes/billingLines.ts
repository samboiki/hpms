/**
 * One way to add a tariff to a list of billing lines, shared by code bundles and quotes. It adds a code
 * exactly as the visit screens' "Add services" does (addServiceDirectly in AddVisitTabs / EditVisitTabs):
 * the line is priced by buildTariffLine (computeLine: the tariff's own price and quantity rule, in whole
 * cents), 8109 infection control is added once per visit, and a restorative procedure brings its 8346
 * material line. So a quote holds the same lines, at the same prices, as the invoice its visit would get.
 *
 * Per-visit codes are charged once per visit: asking for one that is already on the visit adds nothing
 * and says so, instead of billing the fund twice.
 */
import type { ServiceSelection } from '../../types/billing';
import {
  buildInfectionControlLine,
  buildMaterialFactorLine,
  buildTariffLine,
  type VisitTariff
} from '../visits/visitBillingLines';
// The code lists (8109, 8346, restorations, per-visit codes) live in tariffRules.ts, shared with the visit screens,
// the dental service selector and the claim checks. Per-visit codes: two bundles that both contain one add it once.
import {
  INFECTION_CONTROL_CODE,
  MATERIAL_FACTOR_CODE,
  isPerVisitCode,
  isRestorationCode
} from '../../utils/billing/tariffRules';
import { isQuadrant, lineSurfaces } from '../../utils/dental/lineTeeth';

/** Tariff codes compare without outer spaces and case ('8101 ' = '8101'). */
export const normalizeCode = (code: string): string => code.trim().toUpperCase();

const hasCode = (lines: readonly ServiceSelection[], code: string): boolean =>
  lines.some(line => normalizeCode(line.code) === code);

export interface LineContext {
  /** Tariffs that may be billed on the service date (billableVisitTariffs): one current row per code */
  tariffs: readonly VisitTariff[];
  /** From the patient's medical aid record, as on the visit screens */
  hasMedicalAid: boolean;
  /**
   * Dental practices (isDentalPractice): 8109 is added once per visit and a restoration brings its 8346 line, as on
   * the visit screens. Other practice types bill neither.
   */
  autoInfectionControl: boolean;
  /** 8109 quantity: the practice's clinical staff count (1-3, the practice setting); 1 when not given */
  infectionControlStaff?: number;
}

export interface LineProblem {
  code: string;
  message: string;
}

export interface LineRequest {
  code: string;
  quantity: number;
  /** FDI tooth for codes that need one (one tooth per line, as on the visit screens) */
  tooth?: string | null;
  /** Several teeth on one line: a code billed per quadrant carries the teeth of its quadrant (instead of `tooth`) */
  teeth?: readonly string[] | null;
  notes?: string | null;
  /** Surfaces of the line's one tooth ("MO"), kept in the chart's order (lineTeeth.ts); dental */
  surfaces?: string | null;
  /** The quadrant of a code billed per quadrant (1-4); dental */
  quadrant?: number | null;
}

export type AddLinesOutcome =
  | {
      status: 'added';
      /** Every line after the change: existing lines plus the new ones */
      lines: ServiceSelection[];
      /** The new lines (8109 first when it was added, then the code, then its 8346) */
      added: ServiceSelection[];
      warnings: string[];
      /** Automatic lines that could not be added (8109 or 8346 missing from the tariff list) */
      problems: LineProblem[];
    }
  | { status: 'skipped'; lines: ServiceSelection[]; reason: string }
  | { status: 'refused'; lines: ServiceSelection[]; message: string };

export const notInTariffListMessage = (code: string): string =>
  `Code ${code} has no tariff in effect on this date in the practice's tariff list, so it was not added.`;

export const alreadyOnVisitMessage = (code: string): string =>
  `${code} is charged once per visit and is already on this visit, so it was not added again.`;

/** Whether a tariff's line needs a tooth number: the same check buildTariffLine makes. */
export const tariffNeedsTooth = (tariff: VisitTariff): boolean => tariff.requires_tooth_number === 'YES';

/** Finds the billable tariff for a code. */
export function findTariff<T extends VisitTariff>(tariffs: readonly T[], code: string): T | undefined {
  const wanted = normalizeCode(code);
  return tariffs.find(tariff => normalizeCode(tariff.code) === wanted);
}

/**
 * Adds one code to `existing`, the way the visit screens do. Never changes the existing lines: a refused
 * or skipped request returns them as they were, with the reason.
 */
export function addTariffLines(
  existing: readonly ServiceSelection[],
  request: LineRequest,
  context: LineContext
): AddLinesOutcome {
  const code = normalizeCode(request.code);
  const unchanged = [...existing];
  if (code === MATERIAL_FACTOR_CODE) {
    return {
      status: 'refused',
      lines: unchanged,
      message: `${MATERIAL_FACTOR_CODE} (restorative material) is added automatically with its restorative procedure, so it cannot be added on its own.`
    };
  }
  if (isPerVisitCode(code) && hasCode(existing, code)) {
    return { status: 'skipped', lines: unchanged, reason: alreadyOnVisitMessage(code) };
  }
  const tariff = findTariff(context.tariffs, code);
  if (!tariff) return { status: 'refused', lines: unchanged, message: notInTariffListMessage(code) };

  const teeth = (request.teeth ?? []).map(tooth => tooth.trim()).filter(Boolean);
  const built = buildTariffLine(tariff, request.quantity, teeth[0] ?? request.tooth?.trim() ?? '', context.hasMedicalAid);
  if (!built.ok) return { status: 'refused', lines: unchanged, message: built.message };
  const notes = request.notes?.trim();
  const surfaces = lineSurfaces(built.service.teethNumbers, request.surfaces);
  const line: ServiceSelection = {
    ...built.service,
    // Several teeth on one line (a quadrant's teeth): the line names them all
    ...(teeth.length > 1 ? { teethNumbers: teeth, description: `${tariff.description ?? ''} (Teeth ${teeth.join(', ')})` } : {}),
    ...(notes ? { notes } : {}),
    ...(surfaces ? { toothSurfaces: surfaces } : {}),
    ...(isQuadrant(request.quadrant) ? { toothQuadrant: request.quadrant } : {})
  };

  const lines = [...existing, line];
  const added = [line];
  const problems: LineProblem[] = [];

  if (context.autoInfectionControl && code !== INFECTION_CONTROL_CODE && !hasCode(existing, INFECTION_CONTROL_CODE)) {
    const infectionControl = buildInfectionControlLine(context.tariffs, context.hasMedicalAid, line.id, context.infectionControlStaff);
    if (infectionControl.ok) {
      // At the top, as the visit screens add it
      lines.unshift(infectionControl.service);
      added.unshift(infectionControl.service);
    } else {
      problems.push({ code: INFECTION_CONTROL_CODE, message: infectionControl.message });
    }
  }

  if (context.autoInfectionControl && isRestorationCode(code)) {
    const material = buildMaterialFactorLine(context.tariffs, line, context.hasMedicalAid);
    if (material.ok) {
      lines.push(material.service);
      added.push(material.service);
    } else {
      problems.push({ code: MATERIAL_FACTOR_CODE, message: material.message });
    }
  }

  return { status: 'added', lines, added, warnings: built.warnings, problems };
}

/**
 * Removes a line together with its 8346 material line and the codes it brought with it (the practice's linked codes,
 * quoteLinkedCodes.ts), as the visit screens do. The once-per-visit 8109 line cannot be removed on
 * its own (as on the visit screens); it stays while other lines remain, because the visit still has
 * infection control, and goes with the last of them.
 */
export function removeLine(lines: readonly ServiceSelection[], lineId: string): ServiceSelection[] {
  const target = lines.find(line => line.id === lineId);
  if (!target || target.isRequired) return [...lines];
  const remaining = lines.filter(
    line =>
      line.id !== lineId &&
      !(line.parentServiceId === lineId && (normalizeCode(line.code) === MATERIAL_FACTOR_CODE || Boolean(line.linkedFrom)))
  );
  if (!remaining.some(line => !line.isRequired)) return [];
  // An 8109 added with the removed line no longer points at it
  return remaining.map(line => (line.parentServiceId === lineId ? { ...line, parentServiceId: undefined } : line));
}
