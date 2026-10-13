/**
 * Tooth surfaces for fillings. A back tooth has a biting surface (O, occlusal) and a cheek side (B, buccal); a front
 * tooth has a biting edge (I, incisal) and a lip side (F, labial). Every tooth has M (mesial, towards the middle of the
 * arch) and D (distal, away from it); the inside is palatal (P) on upper teeth and lingual (L) on lower teeth.
 * Surfaces are stored as letters in one fixed order ("MOD"), the same order the database function
 * dental_chart_surfaces uses (proposals/2026-10-07-dental-chart.sql).
 */
import { isFrontTooth, isOnChartLeft, isUpperTooth } from './fdi.ts';

export type Surface = 'M' | 'O' | 'I' | 'D' | 'B' | 'F' | 'L' | 'P';

/** The stored order of surface letters. */
export const SURFACE_ORDER: readonly Surface[] = ['M', 'O', 'I', 'D', 'B', 'F', 'L', 'P'];

const SURFACE_NAMES: Readonly<Record<Surface, string>> = {
  M: 'mesial (towards the middle)',
  O: 'occlusal (biting surface)',
  I: 'incisal (biting edge)',
  D: 'distal (away from the middle)',
  B: 'buccal (cheek side)',
  F: 'labial (lip side)',
  L: 'lingual (tongue side)',
  P: 'palatal (palate side)'
};

/** The surfaces a tooth has, in stored order: M, O or I, D, B or F, L or P. */
export function surfacesForTooth(tooth: string): Surface[] {
  const front = isFrontTooth(tooth);
  return ['M', front ? 'I' : 'O', 'D', front ? 'F' : 'B', isUpperTooth(tooth) ? 'P' : 'L'];
}

/**
 * The surfaces given (letters, in any order and case, with or without separators) that the tooth has, once each, in
 * stored order: "dom" on tooth 36 -> "MOD". Letters the tooth does not have (an occlusal surface on an incisor) are
 * dropped, so a filling never names a surface its tooth lacks.
 */
export function normalizeSurfaces(input: string | readonly string[] | null | undefined, tooth: string): string {
  const letters = (Array.isArray(input) ? input.join('') : String(input ?? '')).toUpperCase();
  const allowed = surfacesForTooth(tooth);
  return SURFACE_ORDER.filter(surface => allowed.includes(surface) && letters.includes(surface)).join('');
}

/** "MOD" -> ['M', 'O', 'D'] (unknown letters dropped). */
export const surfaceList = (surfaces: string | null | undefined): Surface[] =>
  SURFACE_ORDER.filter(surface => (surfaces ?? '').toUpperCase().includes(surface));

/** Plain words for one surface letter. */
export const surfaceName = (surface: Surface): string => SURFACE_NAMES[surface];

/** "MOD" -> "M O D" for short labels; '' when none. */
export const formatSurfaces = (surfaces: string | null | undefined): string => surfaceList(surfaces).join(' ');

/**
 * Where each surface is drawn on the five-part tooth of the chart. The cheek or lip side faces out of the mouth (up for
 * upper teeth, down for lower teeth), the inside faces the other jaw, and the middle (mesial) side faces the middle of
 * the chart: right for teeth on the left half of the screen, left for the others.
 */
export interface SurfaceLayout {
  top: Surface;
  bottom: Surface;
  left: Surface;
  right: Surface;
  centre: Surface;
}

export function surfaceLayout(tooth: string): SurfaceLayout {
  const [mesial, centre, distal, outside, inside] = surfacesForTooth(tooth);
  const upper = isUpperTooth(tooth);
  const chartLeft = isOnChartLeft(tooth);
  return {
    top: upper ? outside : inside,
    bottom: upper ? inside : outside,
    left: chartLeft ? distal : mesial,
    right: chartLeft ? mesial : distal,
    centre
  };
}
