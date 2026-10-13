/**
 * Billing teeth on a visit (dental practices). A code that needs a tooth gets one line per tooth, each added exactly
 * as every other screen adds a code (addTariffLines: the tariff's own price and quantity rule, 8109 once per visit,
 * the 8346 material line after each restoration), so choosing three teeth on the chart bills what three single picks
 * would. A code that needs no tooth is added once, without one, as before. A code billed per quadrant (8182, 8185)
 * gets one line per quadrant of the chosen teeth, with its quadrant. Surfaces marked on one chosen tooth go with a
 * code billed by surfaces (a filling), which must be the code for that many surfaces (parity D5).
 */
import { toast } from 'react-hot-toast';
import type { ServiceSelection } from '../../types/billing';
import { isValidFdiTooth, parseTariffPrice } from '../../utils/billing/pricing';
import { MATERIAL_FACTOR_CODE, isPerVisitCode } from '../../utils/billing/tariffRules';
import type { PlanItem } from '../../utils/dental/chart';
import { quadrantName, quadrantOfTooth } from '../../utils/dental/fdi';
import { lineSurfaces, quadrantsOf } from '../../utils/dental/lineTeeth';
import { isPerQuadrantCode, surfaceCodeProblem, surfaceCountForCode } from '../../utils/dental/workTypes';
import { addTariffLines, normalizeCode, tariffNeedsTooth, type LineContext, type LineProblem, type LineRequest } from '../quotes/billingLines';
import type { VisitTariff } from '../visits/visitBillingLines';
import { orderServices, usesOf } from '../billing/serviceOrder';

export type TeethOutcome =
  | {
      status: 'added';
      lines: ServiceSelection[];
      /** The new lines: per tooth the code and its 8346; 8109 first when the visit did not have it */
      added: ServiceSelection[];
      /** The teeth billed, in FDI order (none for a code without a tooth, or billed per quadrant) */
      teeth: string[];
      /** The quadrants billed, for a code billed per quadrant (1-4); none otherwise */
      quadrants: number[];
      warnings: string[];
      /** Automatic lines that could not be added (8109 or 8346 missing from the tariff list) */
      problems: LineProblem[];
    }
  | { status: 'skipped'; lines: ServiceSelection[]; reason: string }
  | { status: 'refused'; lines: ServiceSelection[]; message: string };

export interface TeethOptions {
  /** Surfaces marked on the one chosen tooth (a filling's "MO"); they go with a code billed by surfaces */
  surfaces?: string | null;
}

/**
 * The surfaces a code would carry for the chosen teeth: those marked, when exactly one tooth is chosen and the code is
 * billed by surfaces (a filling); null otherwise (surfaces belong to one tooth, and other work has none).
 */
export function surfacesForCode(code: string, teeth: readonly string[], surfaces: string | null | undefined): string | null {
  return teeth.length === 1 && surfaceCountForCode(code) !== null ? lineSurfaces(teeth, surfaces) : null;
}

/** Teeth once each in FDI order: 11 ... 48, then the milk teeth 51 ... 85. */
export const sortTeeth = (teeth: Iterable<string>): string[] =>
  [...new Set([...teeth].map(tooth => tooth.trim()).filter(Boolean))].sort((a, b) => Number(a) - Number(b) || a.localeCompare(b));

/** "36", "36 and 37", "36, 37 and 46". */
export function listTeeth(teeth: readonly string[]): string {
  if (teeth.length <= 1) return teeth.join('');
  return `${teeth.slice(0, -1).join(', ')} and ${teeth[teeth.length - 1]}`;
}

/**
 * Adds `tariff` to the visit's lines: once per tooth when it needs a tooth (`quantity` units on each tooth's line),
 * otherwise once. All or nothing: a refused tooth leaves the lines as they were, with the reason.
 */
export function addCodeForTeeth(
  lines: readonly ServiceSelection[],
  tariff: VisitTariff,
  teeth: Iterable<string>,
  quantity: number,
  context: LineContext,
  options: TeethOptions = {}
): TeethOutcome {
  const unchanged = [...lines];
  const code = normalizeCode(tariff.code);
  const chosen = sortTeeth(teeth);
  const invalid = chosen.filter(tooth => !isValidFdiTooth(tooth));
  if (invalid.length > 0 && (tariffNeedsTooth(tariff) || isPerQuadrantCode(code))) {
    return { status: 'refused', lines: unchanged, message: `${listTeeth(invalid)} is not a tooth number (FDI 11-48, or 51-85 for milk teeth).` };
  }

  // One line per quadrant of the chosen teeth (with those teeth when the code needs them), never one per tooth
  if (isPerQuadrantCode(code)) {
    const quadrants = quadrantsOf(chosen);
    if (quadrants.length === 0) {
      return { status: 'refused', lines: unchanged, message: `${code} is billed per quadrant: choose a tooth in each quadrant treated on the chart first.` };
    }
    const requests = quadrants.map(quadrant => ({
      code,
      quantity,
      quadrant,
      ...(tariffNeedsTooth(tariff) ? { teeth: chosen.filter(tooth => quadrantOfTooth(tooth) === quadrant) } : {})
    }));
    return addEach(lines, requests, context, { teeth: [], quadrants });
  }

  if (!tariffNeedsTooth(tariff)) {
    const outcome = addTariffLines(lines, { code, quantity }, context);
    if (outcome.status === 'added') return { ...outcome, teeth: [], quadrants: [] };
    return outcome;
  }
  if (chosen.length === 0) {
    return { status: 'refused', lines: unchanged, message: `${code} needs a tooth number: choose the tooth or teeth on the chart first.` };
  }
  // A filling is billed by its number of surfaces: the code must be the one for the surfaces marked (the message names it)
  const surfaces = surfacesForCode(code, chosen, options.surfaces);
  const surfaceProblem = surfaceCodeProblem(code, surfaces);
  if (surfaceProblem) return { status: 'refused', lines: unchanged, message: surfaceProblem.message };
  return addEach(lines, chosen.map(tooth => ({ code, quantity, tooth, surfaces })), context, { teeth: chosen, quadrants: [] });
}

/** Adds the requests one after the other; all or nothing, as one add. */
function addEach(
  lines: readonly ServiceSelection[],
  requests: readonly LineRequest[],
  context: LineContext,
  billed: { teeth: string[]; quadrants: number[] }
): TeethOutcome {
  const unchanged = [...lines];
  let current: ServiceSelection[] = [...lines];
  const added: ServiceSelection[] = [];
  const warnings = new Set<string>();
  const problems = new Map<string, LineProblem>();
  for (const request of requests) {
    const outcome = addTariffLines(current, request, context);
    if (outcome.status === 'refused') return { status: 'refused', lines: unchanged, message: outcome.message };
    if (outcome.status === 'skipped') return { status: 'skipped', lines: unchanged, reason: outcome.reason };
    current = outcome.lines;
    added.push(...outcome.added);
    outcome.warnings.forEach(warning => warnings.add(warning));
    outcome.problems.forEach(problem => problems.set(`${problem.code}|${problem.message}`, problem));
  }
  return { status: 'added', lines: current, added, ...billed, warnings: [...warnings], problems: [...problems.values()] };
}

/** "the upper right quadrant", "the upper right and lower left quadrants". */
const quadrantWords = (quadrants: readonly number[]): string => {
  const names = quadrants.map(quadrant => quadrantName(quadrant).toLowerCase());
  return `the ${listTeeth(names)} quadrant${quadrants.length === 1 ? '' : 's'}`;
};

/**
 * What the screen says after adding: "Added 8369 for teeth 36 and 37, each with its 8346 material line.", "Added 8182
 * for the upper right and lower left quadrants."
 */
export function addedMessage(code: string, teeth: readonly string[], added: readonly ServiceSelection[], quadrants: readonly number[] = []): string {
  const material = added.some(line => normalizeCode(line.code) === MATERIAL_FACTOR_CODE && line.isAutoGenerated);
  const where =
    quadrants.length > 0 ? ` for ${quadrantWords(quadrants)}` : teeth.length === 0 ? '' : ` for ${teeth.length === 1 ? 'tooth' : 'teeth'} ${listTeeth(teeth)}`;
  const withMaterial = material ? (teeth.length > 1 ? ', each with its 8346 material line' : ' with its 8346 material line') : '';
  return `Added ${normalizeCode(code)}${where}${withMaterial}.`;
}

/** Says what happened after an add, the way the visit screens do: the lines, then any price notes or missing lines. */
export function announceOutcome(outcome: TeethOutcome, code: string): void {
  if (outcome.status === 'refused') {
    toast.error(outcome.message, { duration: 8000 });
    return;
  }
  if (outcome.status === 'skipped') {
    toast(outcome.reason, { duration: 6000 });
    return;
  }
  toast.success(addedMessage(code, outcome.teeth, outcome.added, outcome.quadrants));
  if (outcome.warnings.length > 0) toast(outcome.warnings.join(' '), { duration: 8000 });
  outcome.problems.forEach(problem => toast.error(problem.message, { id: `tariff-${problem.code}`, duration: 8000 }));
}

/**
 * The teeth on the visit's lines and their codes, for the chart. Only the procedures count: an 8346 material line
 * repeats its restoration's tooth.
 */
export function teethOnLines(lines: readonly ServiceSelection[]): Map<string, string[]> {
  const teeth = new Map<string, string[]>();
  for (const line of lines) {
    if (line.isAutoGenerated) continue;
    for (const tooth of line.teethNumbers ?? []) {
      const key = tooth.trim();
      if (!key) continue;
      teeth.set(key, [...(teeth.get(key) ?? []), normalizeCode(line.code)]);
    }
  }
  return teeth;
}

/**
 * Lines whose code needs a tooth but that carry none: lines saved before the code's tooth flag was corrected, or
 * brought in another way. A fund refuses them ("tooth number required"), so the Billing tab points them out.
 */
export function linesWithoutTooth(lines: readonly ServiceSelection[], tariffs: readonly VisitTariff[]): ServiceSelection[] {
  const needTooth = new Set(tariffs.filter(tariffNeedsTooth).map(tariff => normalizeCode(tariff.code)));
  return lines.filter(
    line => !line.isAutoGenerated && needTooth.has(normalizeCode(line.code)) && !(line.teethNumbers ?? []).some(tooth => tooth.trim() !== '')
  );
}

/** The planned codes on the chosen teeth (still to do), with the teeth they are planned for: code -> teeth. */
export function plannedCodesFor(planItems: readonly PlanItem[], teeth: ReadonlySet<string>): Map<string, string[]> {
  const codes = new Map<string, string[]>();
  for (const item of planItems) {
    const { entry } = item;
    if (item.done || entry.status !== 'planned' || !entry.tariffCode || !teeth.has(entry.tooth)) continue;
    const code = normalizeCode(entry.tariffCode);
    codes.set(code, sortTeeth([...(codes.get(code) ?? []), entry.tooth]));
  }
  return codes;
}

export interface CodeChoice {
  tariff: VisitTariff;
  code: string;
  description: string;
  /** The patient's price per line (null: the tariff has no valid price for this patient) */
  unitPrice: number | null;
  needsTooth: boolean;
  /** How often the practice billed the code */
  uses: number;
  /** The chosen teeth it is planned for */
  plannedFor: string[];
  /** The chosen teeth that already have it on this visit */
  alreadyOn: string[];
  /** Billed per quadrant (8182, 8185): one line per quadrant of the chosen teeth */
  perQuadrant: boolean;
  /** With surfaces marked on one tooth, for a code billed by surfaces: whether it is the code for them */
  surfaceFit: 'fits' | 'other' | null;
}

export interface CodeOptions {
  usage: Readonly<Record<string, number>>;
  query: string;
  /** Planned codes on the chosen teeth (plannedCodesFor) */
  planned: ReadonlyMap<string, readonly string[]>;
  /** The chosen teeth, in FDI order */
  teeth: readonly string[];
  /** The visit's lines */
  lines: readonly ServiceSelection[];
  /** Surfaces marked on the one chosen tooth */
  surfaces?: string | null;
}

/**
 * The codes to offer for the chosen teeth: codes that need a tooth first, then the codes billed per quadrant, then the
 * others, each in the service list's order (orderServices: most used first, or the best match while searching);
 * without a search, work planned on those teeth comes first, and with surfaces marked, the codes for that many
 * surfaces come first. A code charged once per visit that the visit already has (8109 ...) is not offered: it would
 * not be added again.
 */
export function codesForTeeth(
  tariffs: readonly VisitTariff[],
  options: CodeOptions
): { forTeeth: CodeChoice[]; forQuadrants: CodeChoice[]; withoutTooth: CodeChoice[] } {
  const onVisit = teethOnLines(options.lines);
  const visitCodes = new Set(options.lines.map(line => normalizeCode(line.code)));
  const offered = orderServices(tariffs, options.usage, options.query).filter(tariff => {
    const code = normalizeCode(tariff.code);
    return !(isPerVisitCode(code) && visitCodes.has(code));
  });
  const choices: CodeChoice[] = offered.map(tariff => {
    const code = normalizeCode(tariff.code);
    return {
      tariff,
      code,
      description: tariff.description?.trim() ?? '',
      unitPrice: tariff.price_problem ? null : parseTariffPrice(tariff.price),
      needsTooth: tariffNeedsTooth(tariff),
      uses: usesOf(options.usage, tariff.code),
      plannedFor: [...(options.planned.get(code) ?? [])],
      alreadyOn: options.teeth.filter(tooth => onVisit.get(tooth)?.includes(code)),
      perQuadrant: isPerQuadrantCode(code),
      surfaceFit: surfacesForCode(code, options.teeth, options.surfaces) ? (surfaceCodeProblem(code, options.surfaces) ? 'other' : 'fits') : null
    };
  });
  // Stable sorts: the planned codes move up, then the codes for the surfaces marked; everything else keeps its order
  const planned = options.query.trim() ? choices : [...choices].sort((a, b) => Number(b.plannedFor.length > 0) - Number(a.plannedFor.length > 0));
  const ordered = [...planned].sort((a, b) => Number(b.surfaceFit === 'fits') - Number(a.surfaceFit === 'fits'));
  return {
    forTeeth: ordered.filter(choice => choice.needsTooth && !choice.perQuadrant),
    forQuadrants: ordered.filter(choice => choice.perQuadrant),
    withoutTooth: ordered.filter(choice => !choice.needsTooth && !choice.perQuadrant)
  };
}
