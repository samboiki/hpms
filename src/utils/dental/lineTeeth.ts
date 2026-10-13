/**
 * The teeth, surfaces and quadrant of a billing line (parity D5), in the same words everywhere: the visit's Billing
 * tab, the printed invoice and claim review. The claim carries them too: the teeth in field 37, and "TOOTH: 46 MO" (or
 * "QUAD: 1" for a quadrant without teeth) at the start of the description, written by the database's
 * sync_invoice_to_batch (proposals/2026-10-12-line-teeth-and-billing-practitioners.sql). Surfaces belong to one tooth,
 * so a line with several teeth keeps none.
 */
// Explicit .ts extensions, as the billing modules that use it (invoiceLineRow.ts)
import { isValidFdiTooth } from '../billing/pricing.ts';
import { quadrantName, quadrantOfTooth } from './fdi.ts';
import { normalizeSurfaces } from './surfaces.ts';

export interface LineTeeth {
  teeth?: readonly string[] | null;
  /** Letters in the chart's order ("MO") */
  surfaces?: string | null;
  /** 1 upper right, 2 upper left, 3 lower left, 4 lower right */
  quadrant?: number | null;
}

export const QUADRANT_NUMBERS: readonly number[] = [1, 2, 3, 4];

export const isQuadrant = (value: unknown): value is number => typeof value === 'number' && QUADRANT_NUMBERS.includes(value);

const teethOf = (line: LineTeeth): string[] => (line.teeth ?? []).map(tooth => tooth.trim()).filter(Boolean);

/**
 * The surfaces a line can keep: those its one tooth has, in the chart's order ("dom" on 36 -> "MOD"); null for a line
 * without a tooth, with several teeth, or with nothing marked.
 */
export function lineSurfaces(teeth: readonly string[] | null | undefined, surfaces: string | null | undefined): string | null {
  const own = (teeth ?? []).map(tooth => tooth.trim()).filter(Boolean);
  if (own.length !== 1 || !isValidFdiTooth(own[0])) return null;
  return normalizeSurfaces(surfaces, own[0]) || null;
}

/** The quadrants of some teeth, once each, in order (milk teeth with the permanent teeth of their side). */
export function quadrantsOf(teeth: Iterable<string>): number[] {
  const quadrants = new Set<number>();
  for (const tooth of teeth) {
    const quadrant = quadrantOfTooth(tooth);
    if (quadrant !== null) quadrants.add(quadrant);
  }
  return [...quadrants].sort((a, b) => a - b);
}

/** "Upper right quadrant (Q1)". */
export const quadrantLabel = (quadrant: number): string => `${quadrantName(quadrant)} quadrant (Q${quadrant})`;

/** The tooth column of the printed invoice: "46, MO", "11, 12", "Q1"; '' without teeth or a quadrant. */
export function lineTeethCell(line: LineTeeth): string {
  const teeth = teethOf(line);
  if (teeth.length > 0) {
    const surfaces = lineSurfaces(teeth, line.surfaces);
    return [teeth.join(', '), surfaces].filter(Boolean).join(', ');
  }
  return isQuadrant(line.quadrant) ? `Q${line.quadrant}` : '';
}

/** In words: "Tooth 46, MO", "Teeth 11, 12", "Upper right quadrant (Q1)"; '' without teeth or a quadrant. */
export function lineTeethLabel(line: LineTeeth): string {
  const teeth = teethOf(line);
  if (teeth.length > 0) {
    const surfaces = lineSurfaces(teeth, line.surfaces);
    return `${teeth.length === 1 ? 'Tooth' : 'Teeth'} ${teeth.join(', ')}${surfaces ? `, ${surfaces}` : ''}`;
  }
  return isQuadrant(line.quadrant) ? quadrantLabel(line.quadrant) : '';
}
