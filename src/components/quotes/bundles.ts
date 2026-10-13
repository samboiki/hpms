/**
 * Code bundles ("macros"): a practice's named sets of tariff lines (code, quantity, optional tooth and
 * note) that staff add to a visit or a quote in one click.
 *
 * A bundle never stores the price list's price. Every line is priced from the practice's tariffs in effect
 * when the bundle is used (addTariffLines), so a tariff increase reaches every bundle without editing it.
 * Codes charged once per visit (8109, 8110, 8145) are added once, however many bundles contain them.
 *
 * Parity D12 (Eminance macros): a line can also carry
 * - a fixed main ICD-10 code, which the added line starts with instead of the suggestion;
 * - a fee per unit chosen for the bundle, recorded on the added line as a changed fee ("Bundle ...") with who
 *   used the bundle and when, exactly as a fee changed by hand (changeLineFee);
 * - a stock item instead of a tariff code, priced and taken off stock as "From stock" lines are;
 * and a bundle can need the fund's authorisation number, which then goes on every line it adds.
 */
import type { ServiceSelection } from '../../types/billing';
import { formatNad, fromCents, hasAtMostDecimals, sumCents, toCents } from '../../utils/billing/money';
import { MAX_QUANTITY, MAX_UNIT_PRICE, isValidFdiTooth, normalizeMultiplyRule } from '../../utils/billing/pricing';
import { normalizeIcd10 } from '../../utils/billing/icd10';
import { usualIcd10Problem } from '../../utils/billing/icd10Defaults';
import { changeLineFee, type VisitTariff } from '../visits/visitBillingLines';
import { MATERIAL_FACTOR_CODE, isPerVisitCode } from '../../utils/billing/tariffRules';
import {
  addTariffLines,
  findTariff,
  normalizeCode,
  tariffNeedsTooth,
  type LineContext,
  type LineProblem
} from './billingLines';

export const BUNDLE_COLOURS = ['cyan', 'teal', 'emerald', 'amber', 'orange', 'rose', 'violet', 'indigo', 'slate'] as const;
export type BundleColour = (typeof BUNDLE_COLOURS)[number];

/** Tailwind classes per colour (written out in full so Tailwind keeps them). */
export const BUNDLE_COLOUR_STYLES: Record<BundleColour, { label: string; dot: string; soft: string }> = {
  cyan: { label: 'Cyan', dot: 'bg-cyan-500', soft: 'bg-cyan-50 border-cyan-200 hover:border-cyan-400' },
  teal: { label: 'Teal', dot: 'bg-teal-500', soft: 'bg-teal-50 border-teal-200 hover:border-teal-400' },
  emerald: { label: 'Green', dot: 'bg-emerald-500', soft: 'bg-emerald-50 border-emerald-200 hover:border-emerald-400' },
  amber: { label: 'Amber', dot: 'bg-amber-500', soft: 'bg-amber-50 border-amber-200 hover:border-amber-400' },
  orange: { label: 'Orange', dot: 'bg-orange-500', soft: 'bg-orange-50 border-orange-200 hover:border-orange-400' },
  rose: { label: 'Rose', dot: 'bg-rose-500', soft: 'bg-rose-50 border-rose-200 hover:border-rose-400' },
  violet: { label: 'Violet', dot: 'bg-violet-500', soft: 'bg-violet-50 border-violet-200 hover:border-violet-400' },
  indigo: { label: 'Indigo', dot: 'bg-indigo-500', soft: 'bg-indigo-50 border-indigo-200 hover:border-indigo-400' },
  slate: { label: 'Grey', dot: 'bg-slate-500', soft: 'bg-slate-50 border-slate-200 hover:border-slate-400' }
};

export const isBundleColour = (value: unknown): value is BundleColour =>
  typeof value === 'string' && (BUNDLE_COLOURS as readonly string[]).includes(value);

export const MAX_BUNDLE_LINES = 30;
export const MAX_BUNDLE_NAME = 60;
export const MAX_BUNDLE_DESCRIPTION = 200;
export const MAX_LINE_NOTES = 200;

/** Tariff codes as the database accepts them (proposals/2026-10-07-quotes-and-bundles.sql). */
const CODE_PATTERN = /^[A-Z0-9./-]{1,20}$/;

export interface BundleLine {
  code: string;
  quantity: number;
  /** A tooth that is always the same for this bundle (rare); otherwise asked for when the bundle is used */
  tooth: string | null;
  notes: string | null;
  /** A fixed main ICD-10 code for the added line; absent: the usual suggestion */
  icd10?: string | null;
  /** A fee per unit for this bundle (N$) instead of the price list's; absent: the price list */
  fee?: number | null;
  /** The line is this stock item (practice_inventory id), priced as "From stock" lines are; absent: a tariff code */
  stockItemId?: string | null;
}

export interface CodeBundle {
  id: string;
  practiceId: string;
  name: string;
  colour: BundleColour;
  description: string | null;
  sortOrder: number;
  /** The starter suggestion it was made from, if any */
  presetKey: string | null;
  lines: BundleLine[];
  updatedAt: string | null;
  /** Its lines need the fund's authorisation number, asked for when the bundle is used */
  needsAuthorisation?: boolean;
}

export interface BundleDraft {
  id: string | null;
  name: string;
  colour: BundleColour;
  description: string;
  presetKey: string | null;
  lines: BundleLine[];
  needsAuthorisation?: boolean;
}

const lineLabel = (index: number, code: string): string =>
  `Line ${index + 1}${code.trim() ? ` (${normalizeCode(code)})` : ''}`;

/** A fee a bundle line may carry: N$ 0 to the highest unit price, in whole cents. */
const isBundleFee = (fee: unknown): fee is number =>
  typeof fee === 'number' && Number.isFinite(fee) && fee >= 0 && fee <= MAX_UNIT_PRICE && hasAtMostDecimals(fee, 2);

/** True for a line that is a stock item rather than a tariff code. */
export const isStockBundleLine = (line: Pick<BundleLine, 'stockItemId'>): boolean => Boolean(line.stockItemId);

/** Problems that stop a bundle from being saved, one message each. */
export function validateBundleDraft(draft: BundleDraft): string[] {
  const errors: string[] = [];
  const name = draft.name.trim();
  if (!name) errors.push('Give the bundle a name.');
  else if (name.length > MAX_BUNDLE_NAME) errors.push(`The name can have at most ${MAX_BUNDLE_NAME} characters.`);
  if (!isBundleColour(draft.colour)) errors.push('Choose a colour.');
  if (draft.description.trim().length > MAX_BUNDLE_DESCRIPTION) {
    errors.push(`The description can have at most ${MAX_BUNDLE_DESCRIPTION} characters.`);
  }
  if (draft.lines.length === 0) errors.push('Add at least one code.');
  if (draft.lines.length > MAX_BUNDLE_LINES) errors.push(`A bundle can have at most ${MAX_BUNDLE_LINES} lines.`);

  const perVisitSeen = new Set<string>();
  draft.lines.forEach((line, index) => {
    const label = lineLabel(index, line.code);
    const code = normalizeCode(line.code);
    if (!CODE_PATTERN.test(code)) {
      errors.push(`${label}: enter a tariff code (letters and digits, no spaces).`);
      return;
    }
    if (code === MATERIAL_FACTOR_CODE) {
      errors.push(`${label}: ${MATERIAL_FACTOR_CODE} is added automatically with restorative procedures; remove this line.`);
    }
    const quantity = line.quantity;
    if (
      typeof quantity !== 'number' ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > MAX_QUANTITY ||
      !hasAtMostDecimals(quantity, 2)
    ) {
      errors.push(`${label}: the quantity must be more than 0 and at most ${MAX_QUANTITY}, with at most 2 decimals.`);
    }
    const tooth = line.tooth?.trim();
    if (tooth && !isValidFdiTooth(tooth)) {
      errors.push(`${label}: "${tooth}" is not a valid tooth number (FDI 11-48, or 51-85 for milk teeth).`);
    }
    if ((line.notes ?? '').trim().length > MAX_LINE_NOTES) {
      errors.push(`${label}: the note can have at most ${MAX_LINE_NOTES} characters.`);
    }
    // The line's main ICD-10 code is checked as a practice's usual code is: a real code, never an external cause
    const icd10 = line.icd10?.trim();
    if (icd10) {
      const problem = usualIcd10Problem(icd10);
      if (problem) errors.push(`${label}: ${problem}`);
    }
    if (line.fee !== undefined && line.fee !== null && !isBundleFee(line.fee)) {
      errors.push(`${label}: the fee must be an amount from N$ 0 to N$ ${MAX_UNIT_PRICE.toLocaleString('en-ZA')} with at most 2 decimals.`);
    }
    // Stock is counted in whole units, as "From stock" adds it
    if (line.stockItemId && (!Number.isInteger(quantity) || quantity < 1)) {
      errors.push(`${label}: a stock item is added in whole units (1, 2, 3...).`);
    }
    if (isPerVisitCode(code)) {
      if (perVisitSeen.has(code)) errors.push(`${code} is charged once per visit: list it only once.`);
      perVisitSeen.add(code);
    }
  });
  return errors;
}

/**
 * Checks a bundle's lines against the tariffs in effect today, so a typo or a quantity the tariff does
 * not allow is caught when the bundle is saved rather than when a receptionist uses it.
 */
export function checkBundleAgainstTariffs(lines: readonly BundleLine[], tariffs: readonly VisitTariff[]): string[] {
  const errors: string[] = [];
  lines.forEach((line, index) => {
    const code = normalizeCode(line.code);
    // A stock item is priced from stock, not the tariff list
    if (!CODE_PATTERN.test(code) || code === MATERIAL_FACTOR_CODE || isStockBundleLine(line)) return;
    const tariff = findTariff(tariffs, code);
    if (!tariff) {
      errors.push(`${lineLabel(index, code)}: ${code} is not in the tariff list in effect today. Check the code.`);
      return;
    }
    if (normalizeMultiplyRule(tariff.can_be_multiplied) === 'NO' && line.quantity !== 1) {
      errors.push(
        `${lineLabel(index, code)}: ${code} is billed once per line, so its quantity must be 1. Add another line for another unit.`
      );
    }
  });
  return errors;
}

/** Key of a bundle line within one application: `${bundleIndex}:${lineIndex}`. */
export const bundleLineKey = (bundleIndex: number, lineIndex: number): string => `${bundleIndex}:${lineIndex}`;

export interface ToothNeed {
  key: string;
  bundleName: string;
  code: string;
  description: string;
}

/** Lines whose tariff needs a tooth that the bundle does not fix: asked for when the bundle is used. */
export function teethNeeded(
  bundles: readonly Pick<CodeBundle, 'name' | 'lines'>[],
  tariffs: readonly VisitTariff[]
): ToothNeed[] {
  return bundles.flatMap((bundle, bundleIndex) =>
    bundle.lines.flatMap((line, lineIndex) => {
      const tariff = isStockBundleLine(line) ? undefined : findTariff(tariffs, line.code);
      if (!tariff || !tariffNeedsTooth(tariff) || line.tooth?.trim()) return [];
      return [
        {
          key: bundleLineKey(bundleIndex, lineIndex),
          bundleName: bundle.name,
          code: normalizeCode(line.code),
          description: tariff.description ?? ''
        }
      ];
    })
  );
}

export interface BundleApplication {
  /** Every line after the bundles were added */
  lines: ServiceSelection[];
  /** The new lines, in the order they were added */
  added: ServiceSelection[];
  /** Codes charged once per visit that were not added again */
  skipped: { code: string; reason: string }[];
  /** Lines that could not be added (no tariff in effect, refused quantity or tooth) */
  problems: LineProblem[];
  warnings: string[];
}

/** An added line with its bundle line's fixed main ICD-10 code. */
const withBundleExtras = (line: ServiceSelection, request: { icd10: string | null }): ServiceSelection =>
  request.icd10 ? { ...line, icd10Codes: [request.icd10] } : line;

/**
 * The lines with a bundle's fee on one added line, recorded as a changed fee exactly as one changed by hand
 * (changeLineFee: the price before, why, who and when; its 8346 line follows). A fee that cannot be recorded is
 * reported, and the line keeps the price list's price.
 */
function withBundleFee(
  lines: ServiceSelection[],
  lineId: string,
  request: { fee: number | null; bundleName: string; code: string },
  context: LineContext,
  options: BundleApplyOptions,
  warnings: string[]
): ServiceSelection[] {
  const target = lines.find(line => line.id === lineId);
  if (request.fee === null || !target || toCents(target.unitPrice) === toCents(request.fee)) return lines;
  const unused = (why: string) => `${request.code}: the bundle's fee ${formatNad(request.fee as number)} was not used (${why}), so it is billed at ${formatNad(target.unitPrice)}.`;
  if (!options.by) {
    warnings.push(unused('who is billing is not known: sign in again'));
    return lines;
  }
  const result = changeLineFee(
    lines,
    lineId,
    { unitPrice: request.fee, reason: `Bundle "${request.bundleName}"`, by: options.by, at: options.at ?? new Date().toISOString() },
    context.tariffs,
    context.hasMedicalAid
  );
  if (result.error) {
    warnings.push(unused(result.error));
    return lines;
  }
  return result.services;
}

const uniqueBy = <T>(items: readonly T[], key: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter(item => {
    const value = key(item);
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
};

/** A stock line priced for the bill, or why it cannot be added. */
export type StockLineOutcome = { ok: true; service: ServiceSelection } | { ok: false; message: string };

/** What applyBundles needs besides the tariffs for the D12 extras. */
export interface BundleApplyOptions {
  /** Prices `quantity` units of a stock item as a "From stock" line; without it a stock line is reported, not added */
  stockLine?: (itemId: string, quantity: number) => StockLineOutcome;
  /** Who uses the bundle (users.id) and when (ISO time): a bundle's fee is recorded on the line against them */
  by?: string | null;
  at?: string;
  /** The fund's authorisation number: put on every line the bundles add */
  authorisationNumber?: string | null;
}

export const stockLineMissingMessage = (code: string): string =>
  `${code} is a stock item and the stock list could not be read, so it was not added. Try again in a moment.`;

/**
 * Adds bundles to existing lines with the visit screens' rules (addTariffLines). A code charged once per
 * visit is added once: not at all when it is already on the visit, and once (at the largest quantity
 * asked for) when several of the bundles contain it. `teeth` holds the teeth chosen when the bundles were
 * used, by bundleLineKey. Lines that cannot be added are reported, never priced at a guess.
 * A line's fixed ICD-10 code and fee, stock items and the authorisation number follow `options` (see the file comment).
 */
export function applyBundles(
  bundles: readonly Pick<CodeBundle, 'name' | 'lines'>[],
  existing: readonly ServiceSelection[],
  context: LineContext,
  teeth: Readonly<Record<string, string>> = {},
  options: BundleApplyOptions = {}
): BundleApplication {
  interface Planned {
    code: string;
    quantity: number;
    tooth: string | null;
    notes: string | null;
    icd10: string | null;
    fee: number | null;
    stockItemId: string | null;
    bundleName: string;
  }
  const planned: Planned[] = [];
  const perVisitAt = new Map<string, number>();
  const skipped: BundleApplication['skipped'] = [];

  bundles.forEach((bundle, bundleIndex) =>
    bundle.lines.forEach((line, lineIndex) => {
      const code = normalizeCode(line.code);
      const tooth = (teeth[bundleLineKey(bundleIndex, lineIndex)] ?? line.tooth ?? '').trim() || null;
      if (!isStockBundleLine(line) && isPerVisitCode(code)) {
        const at = perVisitAt.get(code);
        if (at !== undefined) {
          planned[at] = { ...planned[at], quantity: Math.max(planned[at].quantity, line.quantity) };
          skipped.push({ code, reason: `${code} is in more than one bundle and is charged once per visit, so it was added once.` });
          return;
        }
        perVisitAt.set(code, planned.length);
      }
      planned.push({
        code,
        quantity: line.quantity,
        tooth,
        notes: line.notes,
        icd10: line.icd10?.trim() ? normalizeIcd10(line.icd10) : null,
        fee: isBundleFee(line.fee) ? line.fee : null,
        stockItemId: line.stockItemId ?? null,
        bundleName: bundle.name
      });
    })
  );

  let lines = [...existing];
  const added: ServiceSelection[] = [];
  const problems: LineProblem[] = [];
  const warnings: string[] = [];
  for (const request of planned) {
    if (request.stockItemId) {
      const stock = options.stockLine ? options.stockLine(request.stockItemId, request.quantity) : { ok: false as const, message: stockLineMissingMessage(request.code) };
      if (!stock.ok) {
        problems.push({ code: request.code, message: stock.message });
        continue;
      }
      const notes = request.notes?.trim();
      const service = withBundleExtras(notes ? { ...stock.service, notes } : stock.service, request);
      lines = [...lines, service];
      added.push(service);
      lines = withBundleFee(lines, service.id, request, context, options, warnings);
      continue;
    }
    const outcome = addTariffLines(lines, request, context);
    if (outcome.status === 'added') {
      // The code's own line (not its automatic 8109 or 8346) takes the bundle's ICD-10 code and fee
      const main = outcome.added.find(line => !line.isAutoGenerated && normalizeCode(line.code) === request.code);
      lines = outcome.lines.map(line => (line === main ? withBundleExtras(line, request) : line));
      if (main) lines = withBundleFee(lines, main.id, request, context, options, warnings);
      const addedIds = new Set(outcome.added.map(line => line.id));
      added.push(...lines.filter(line => addedIds.has(line.id)));
      warnings.push(...outcome.warnings);
      problems.push(...outcome.problems);
    } else if (outcome.status === 'skipped') {
      skipped.push({ code: request.code, reason: outcome.reason });
    } else {
      problems.push({ code: request.code, message: outcome.message });
    }
  }

  // The fund's authorisation number goes on every line the bundles added (the claim carries it per line)
  const authorisation = options.authorisationNumber?.trim();
  if (authorisation) {
    const addedIds = new Set(added.map(line => line.id));
    lines = lines.map(line => (addedIds.has(line.id) ? { ...line, authorisationNumber: authorisation } : line));
    added.splice(0, added.length, ...lines.filter(line => addedIds.has(line.id)));
  }

  // The same code twice without a tooth is usually a mistake (two examinations); tooth codes repeat on purpose
  const addedCodes = new Set(added.filter(line => !line.isAutoGenerated).map(line => normalizeCode(line.code)));
  for (const code of addedCodes) {
    if (isPerVisitCode(code)) continue;
    const count = lines.filter(line => normalizeCode(line.code) === code && (line.teethNumbers?.length ?? 0) === 0).length;
    if (count > 1) warnings.push(`${code} is now on this visit ${count} times. Check that it should be charged more than once.`);
  }

  return {
    lines,
    added,
    skipped: uniqueBy(skipped, item => `${item.code}|${item.reason}`),
    problems: uniqueBy(problems, item => item.message),
    warnings: uniqueBy(warnings, item => item)
  };
}

/** Short text for a toast after bundles were used, e.g. "Added 4 lines (N$ 1,047.30)". */
export function describeApplication(application: BundleApplication, formatAmount: (amount: number) => string): string {
  const totalCents = sumCents(application.added.map(line => toCents(line.totalPrice)));
  const parts: string[] = [];
  if (application.added.length > 0) {
    parts.push(`Added ${application.added.length} line${application.added.length === 1 ? '' : 's'} (${formatAmount(fromCents(totalCents))}).`);
  } else {
    parts.push('No lines were added.');
  }
  parts.push(...application.skipped.map(item => item.reason));
  return parts.join(' ');
}

export interface BundlePreview {
  /** Total at today's prices, including the automatic 8109 and 8346 lines */
  totalCents: number;
  lineCount: number;
  needsTooth: boolean;
  problems: string[];
}

/** What a bundle adds to an empty visit at the given tariffs (the price does not depend on the tooth). */
export function previewBundle(
  bundle: Pick<CodeBundle, 'name' | 'lines'>,
  context: LineContext,
  options: Pick<BundleApplyOptions, 'stockLine'> = {}
): BundlePreview {
  const needs = teethNeeded([bundle], context.tariffs);
  // A placeholder tooth only so the lines can be priced; it never leaves this preview
  const teeth = Object.fromEntries(needs.map(need => [need.key, '11']));
  // The bundle's fees are shown as the line will bill them (the person is only needed to record the change)
  const result = applyBundles([bundle], [], context, teeth, { ...options, by: 'preview', at: '1970-01-01T00:00:00.000Z' });
  return {
    totalCents: sumCents(result.added.map(line => toCents(line.totalPrice))),
    lineCount: result.added.length,
    needsTooth: needs.length > 0,
    problems: result.problems.map(problem => problem.message)
  };
}

/** "8101, 8159, 8107 x2, 7012345 x2 (stock)" */
export function bundleCodesSummary(lines: readonly BundleLine[]): string {
  return lines
    .map(
      line =>
        `${normalizeCode(line.code)}${line.quantity !== 1 ? ` x${line.quantity}` : ''}${line.tooth ? ` (tooth ${line.tooth})` : ''}${isStockBundleLine(line) ? ' (stock)' : ''}`
    )
    .join(', ');
}

// ---------------------------------------------------------------------------------------------------
// Starter suggestions (dental). Offered for the practice to review and save as its own bundles; never
// used until someone saves them. Infection control (8109) is not listed: it is added once per visit.
// ---------------------------------------------------------------------------------------------------

export interface BundlePreset {
  key: string;
  name: string;
  colour: BundleColour;
  description: string;
  lines: BundleLine[];
}

const presetLine = (code: string, quantity = 1): BundleLine => ({ code, quantity, tooth: null, notes: null });

export const DENTAL_STARTER_BUNDLES: readonly BundlePreset[] = [
  {
    key: 'dental-check-up-scale-polish',
    name: 'Check-up with scale and polish',
    colour: 'cyan',
    description: 'Full mouth examination, scaling and polishing, sterilised instruments.',
    lines: [presetLine('8101'), presetLine('8159'), presetLine('8110')]
  },
  {
    key: 'dental-extraction',
    name: 'Extraction',
    colour: 'rose',
    description: 'Local anaesthetic, single tooth extraction (tooth asked for when used), sterilised instruments.',
    lines: [presetLine('8145'), presetLine('8201'), presetLine('8110')]
  },
  {
    key: 'dental-filling-resin-posterior',
    name: 'Filling (resin, back tooth, one surface)',
    colour: 'amber',
    description: 'Local anaesthetic, posterior resin one surface (its 8346 material line is added automatically), sterilised instruments.',
    lines: [presetLine('8145'), presetLine('8367'), presetLine('8110')]
  },
  {
    key: 'dental-emergency-pain',
    name: 'Emergency pain visit',
    colour: 'orange',
    description: 'Examination for a specific problem, one intra-oral X-ray, palliative treatment.',
    lines: [presetLine('8104'), presetLine('8107'), presetLine('8131')]
  }
];

/** The starter suggestions for a practice type (dental only for now). */
export const starterBundlesFor = (practiceType: string | null | undefined): readonly BundlePreset[] =>
  (practiceType ?? '').trim().toLowerCase() === 'dental' ? DENTAL_STARTER_BUNDLES : [];

export const presetToDraft = (preset: BundlePreset): BundleDraft => ({
  id: null,
  name: preset.name,
  colour: preset.colour,
  description: preset.description,
  presetKey: preset.key,
  lines: preset.lines.map(line => ({ ...line }))
});

export const emptyBundleDraft = (): BundleDraft => ({
  id: null,
  name: '',
  colour: 'cyan',
  description: '',
  presetKey: null,
  lines: [presetLine('')]
});

export const bundleToDraft = (bundle: CodeBundle): BundleDraft => ({
  id: bundle.id,
  name: bundle.name,
  colour: bundle.colour,
  description: bundle.description ?? '',
  presetKey: bundle.presetKey,
  lines: bundle.lines.map(line => ({ ...line })),
  needsAuthorisation: bundle.needsAuthorisation === true
});

// ---------------------------------------------------------------------------------------------------
// Database rows (proposals/2026-10-07-quotes-and-bundles.sql)
// ---------------------------------------------------------------------------------------------------

export interface BundleRow {
  id: string;
  practice_id: string;
  name: string;
  colour: string | null;
  description: string | null;
  sort_order: number | null;
  preset_key: string | null;
  updated_at: string | null;
  /** proposals/2026-10-09-bundle-extras.sql */
  needs_authorisation?: boolean | null;
}

export interface BundleLineRow {
  bundle_id: string;
  line_no: number;
  code: string;
  quantity: number | string | null;
  tooth_number: string | null;
  notes: string | null;
  /** proposals/2026-10-09-bundle-extras.sql */
  icd10_code?: string | null;
  fee?: number | string | null;
  stock_item_id?: string | null;
}

/** The D12 extras of a stored line, only those set (a line without them reads exactly as before). */
const lineExtras = (line: BundleLineRow): Pick<BundleLine, 'icd10' | 'fee' | 'stockItemId'> => {
  const fee = line.fee === null || line.fee === undefined || line.fee === '' ? null : Number(line.fee);
  return {
    ...(line.icd10_code?.trim() ? { icd10: line.icd10_code.trim().toUpperCase() } : {}),
    ...(fee !== null && isBundleFee(fee) ? { fee } : {}),
    ...(line.stock_item_id ? { stockItemId: line.stock_item_id } : {})
  };
};

const toQuantity = (value: number | string | null): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
};

/** Bundles with their lines in order, sorted by sort order then name. */
export function toCodeBundles(rows: readonly BundleRow[], lineRows: readonly BundleLineRow[]): CodeBundle[] {
  const linesByBundle = new Map<string, BundleLineRow[]>();
  lineRows.forEach(row => linesByBundle.set(row.bundle_id, [...(linesByBundle.get(row.bundle_id) ?? []), row]));
  return rows
    .map(row => ({
      id: row.id,
      practiceId: row.practice_id,
      name: row.name,
      colour: isBundleColour(row.colour) ? row.colour : 'cyan',
      description: row.description?.trim() || null,
      sortOrder: row.sort_order ?? 0,
      presetKey: row.preset_key,
      updatedAt: row.updated_at,
      ...(row.needs_authorisation ? { needsAuthorisation: true } : {}),
      lines: [...(linesByBundle.get(row.id) ?? [])]
        .sort((a, b) => a.line_no - b.line_no)
        .map(line => ({
          code: normalizeCode(line.code),
          quantity: toQuantity(line.quantity),
          tooth: line.tooth_number?.trim() || null,
          notes: line.notes?.trim() || null,
          ...lineExtras(line)
        }))
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * The save_code_bundle arguments for a checked draft. A line's ICD-10 code, fee and stock item are sent only when set,
 * so a plain bundle saves exactly what it did before (and never a price).
 */
export function bundleSavePayload(practiceId: string, draft: BundleDraft): { p_bundle: Record<string, unknown>; p_lines: Record<string, unknown>[] } {
  return {
    p_bundle: {
      id: draft.id,
      practice_id: practiceId,
      name: draft.name.trim(),
      colour: draft.colour,
      description: draft.description.trim() || null,
      preset_key: draft.presetKey,
      ...(draft.needsAuthorisation ? { needs_authorisation: true } : {})
    },
    p_lines: draft.lines.map(line => ({
      code: normalizeCode(line.code),
      quantity: line.quantity,
      tooth_number: line.tooth?.trim() || null,
      notes: line.notes?.trim() || null,
      ...(line.icd10?.trim() ? { icd10_code: normalizeIcd10(line.icd10) } : {}),
      ...(isBundleFee(line.fee) ? { fee: line.fee } : {}),
      ...(line.stockItemId ? { stock_item_id: line.stockItemId } : {})
    }))
  };
}
