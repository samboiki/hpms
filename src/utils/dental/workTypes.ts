/**
 * The kinds of work the tooth chart shows, and which NAMAF dental tariff codes do that work to a tooth. A billed line
 * with one of these codes and a tooth number changes what the chart shows for that tooth (an 8201 extraction makes it
 * missing, an 8369 resin filling fills it); other codes on a tooth (radiographs, pulp capping, sealants) appear in its
 * history only.
 * The restoration code lists are tariffRules.ts's (the 8346 material factor and claim rules use the same lists).
 */
// Explicit .ts extensions: the claim checks (claimValidation.ts) use surfaceCodeProblem
import { ANTERIOR_RESTORATION_CODES, POSTERIOR_RESTORATION_CODES, RESTORATION_CODES } from '../billing/tariffRules.ts';
import { isFrontTooth, isMilkTooth, isMolar } from './fdi.ts';
import { formatSurfaces, surfaceList } from './surfaces.ts';

/** What can be on a tooth, or be done to it. 'other' is planned work whose code does not change the chart. */
export type DentalWork = 'filling' | 'crown' | 'root_canal' | 'implant' | 'bridge' | 'extraction' | 'missing' | 'other';

export const WORK_LABELS: Readonly<Record<DentalWork, string>> = {
  filling: 'Filling',
  crown: 'Crown',
  root_canal: 'Root canal',
  implant: 'Implant',
  bridge: 'Bridge',
  extraction: 'Extraction',
  missing: 'Missing',
  other: 'Other work'
};

/** What an examination can find already on a tooth ("existing" or "defective"). */
export const RECORDABLE_WORK: readonly DentalWork[] = ['filling', 'crown', 'root_canal', 'implant', 'bridge', 'missing'];

/** What can be planned on a tooth. */
export const PLANNABLE_WORK: readonly DentalWork[] = ['filling', 'crown', 'root_canal', 'extraction', 'implant', 'bridge', 'other'];

/** Work that can be marked defective (a tooth that is gone cannot). */
export const canBeDefective = (work: DentalWork): boolean => work !== 'missing' && work !== 'extraction' && work !== 'other';

export type FillingMaterial = 'resin' | 'amalgam';

/** Resin (tooth-coloured) restorations of front teeth: 1, 2, 3, 4 or more surfaces. */
export const RESIN_FRONT_CODES: readonly string[] = ['8351', '8352', '8353', '8354'];
/** Resin restorations of back teeth: 1, 2, 3, 4 or more surfaces. */
export const RESIN_BACK_CODES: readonly string[] = ['8367', '8368', '8369', '8370'];
/** Amalgam restorations: 1, 2, 3, 4 or more surfaces. */
export const AMALGAM_CODES: readonly string[] = ['8341', '8342', '8343', '8344'];
/** Inlays (metallic, then ceramic or resin): 1, 2, 3, 4 or more surfaces. */
const INLAY_CODES: readonly string[] = ['8361', '8362', '8363', '8364', '8371', '8372', '8373', '8374'];
/** Crowns: cast full, three-quarter, acrylic veneered, porcelain jacket, porcelain veneered; preformed metal (milk teeth). */
const CROWN_CODES: readonly string[] = ['8401', '8403', '8407', '8409', '8411', '8357'];
/** "Each additional canal" (front teeth and premolars, molars): one per extra canal, so a tooth can have several. */
export const ADDITIONAL_CANAL_CODES: readonly string[] = ['8329', '8328', '8340', '8337'];
/** Root canal fillings (first canal, each further canal) and the re-treatment of a filled canal. */
const ROOT_CANAL_CODES: readonly string[] = ['8338', '8335', '8339', '8336', ...ADDITIONAL_CANAL_CODES, '8334'];
/** Implants: placement (first, second, third) and the restoration on an implant. */
const IMPLANT_CODES: readonly string[] = ['8194', '8195', '8196', '8193'];
/** Bridges: pontics (sanitary, back, front) and a Maryland-type abutment. */
const BRIDGE_CODES: readonly string[] = ['8420', '8422', '8424', '8356'];
/** Extractions, surgical removals and residual roots: afterwards the tooth is missing. */
const EXTRACTION_CODES: readonly string[] = ['8201', '8202', '8209', '8210', '8211', '8212', '8213', '8214'];

const codeKey = (code: string): string => code.trim().toUpperCase();

const WORK_BY_CODE: ReadonlyMap<string, DentalWork> = new Map<string, DentalWork>([
  ...[...RESTORATION_CODES, ...INLAY_CODES].map(code => [code, 'filling'] as [string, DentalWork]),
  ...CROWN_CODES.map(code => [code, 'crown'] as [string, DentalWork]),
  ...ROOT_CANAL_CODES.map(code => [code, 'root_canal'] as [string, DentalWork]),
  ...IMPLANT_CODES.map(code => [code, 'implant'] as [string, DentalWork]),
  ...BRIDGE_CODES.map(code => [code, 'bridge'] as [string, DentalWork]),
  ...EXTRACTION_CODES.map(code => [code, 'extraction'] as [string, DentalWork])
]);

/** The work a tariff code does to a tooth; null for codes that leave the chart as it was (radiographs, sealants ...). */
export const workForCode = (code: string): DentalWork | null => WORK_BY_CODE.get(codeKey(code)) ?? null;

const SURFACE_SERIES: readonly (readonly string[])[] = [RESIN_FRONT_CODES, RESIN_BACK_CODES, AMALGAM_CODES, INLAY_CODES.slice(0, 4), INLAY_CODES.slice(4)];

/** How many surfaces a restoration code is for (1, 2, 3; 4 means four or more); null for other codes. */
export function surfaceCountForCode(code: string): number | null {
  const key = codeKey(code);
  for (const series of SURFACE_SERIES) {
    const index = series.indexOf(key);
    if (index >= 0) return index + 1;
  }
  return null;
}

/**
 * Codes billed per quadrant (NAMAF 2025 dental schedule: 8182 root planing, 8185 gingivectomy, "per quadrant"): one
 * line per quadrant treated, never one per tooth (that would bill the quadrant several times).
 */
export const PER_QUADRANT_CODES: readonly string[] = ['8182', '8185'];
export const isPerQuadrantCode = (code: string): boolean => PER_QUADRANT_CODES.includes(codeKey(code));

/** The code of the same series (material, front or back) for a number of surfaces: 8369 with 2 -> 8368; null for other codes. */
export function codeForSurfaceCount(code: string, surfaceCount: number): string | null {
  const series = SURFACE_SERIES.find(list => list.includes(codeKey(code)));
  if (!series || !Number.isInteger(surfaceCount) || surfaceCount < 1) return null;
  return series[Math.min(surfaceCount, series.length) - 1];
}

const surfacesInWords = (count: number): string => (count >= 4 ? '4 or more surfaces' : `${count} surface${count === 1 ? '' : 's'}`);

/**
 * Whether a restoration code fits the surfaces marked on its tooth (NAMAF: 8341 and 8367 one surface ... 8344 and 8370
 * four or more). The fund pays by the code, so the wrong one over- or under-charges; the message names the code that
 * fits. Null when they fit, when nothing is marked, or for a code that is not billed by surfaces.
 */
export function surfaceCodeProblem(code: string, surfaces: string | null | undefined): { message: string; suggestedCode: string } | null {
  const codeSurfaces = surfaceCountForCode(code);
  const marked = surfaceList(surfaces).length;
  if (codeSurfaces === null || marked === 0) return null;
  if (codeSurfaces < 4 ? marked === codeSurfaces : marked >= 4) return null;
  const suggestedCode = codeForSurfaceCount(code, marked) as string;
  return {
    message: `${codeKey(code)} is for ${surfacesInWords(codeSurfaces)}, but ${marked} ${marked === 1 ? 'is' : 'are'} marked (${formatSurfaces(surfaces)}). Use ${suggestedCode}, the code for ${surfacesInWords(marked)}.`,
    suggestedCode
  };
}

/** Restorations whose code is for front or back teeth only (NAMAF: anterior 8351-8354, posterior 8341-8344 and 8367-8370). */
export function restorationSide(code: string): 'front' | 'back' | null {
  const key = codeKey(code);
  if (ANTERIOR_RESTORATION_CODES.includes(key)) return 'front';
  if (POSTERIOR_RESTORATION_CODES.includes(key)) return 'back';
  return null;
}

/**
 * The restoration code for a filling: resin uses the front or back series by the tooth, amalgam its own series, and
 * the number of surfaces picks the code (four or more surfaces share the last code). Null without a surface.
 */
export function fillingCodeFor(tooth: string, surfaceCount: number, material: FillingMaterial): string | null {
  if (!Number.isInteger(surfaceCount) || surfaceCount < 1) return null;
  const series = material === 'amalgam' ? AMALGAM_CODES : isFrontTooth(tooth) ? RESIN_FRONT_CODES : RESIN_BACK_CODES;
  return series[Math.min(surfaceCount, series.length) - 1];
}

/**
 * Codes to offer when planning work on a tooth, most likely first (the screen keeps those in the practice's tariff
 * list). Fillings are chosen by fillingCodeFor; 'other' has no suggestions (the practitioner searches the list).
 */
export function suggestedCodes(work: DentalWork, tooth: string): string[] {
  switch (work) {
    case 'crown':
      return isMilkTooth(tooth) ? ['8357', '8411', '8401', '8409', '8407', '8403'] : ['8411', '8401', '8409', '8407', '8403', '8357'];
    case 'root_canal':
      // The first canal, then each further canal; molars have their own codes
      return isMolar(tooth) ? ['8339', '8340', '8336', '8337', '8334'] : ['8338', '8329', '8335', '8328', '8334'];
    case 'extraction':
      return ['8201', '8209', '8213', '8210', '8202'];
    case 'implant':
      return ['8194', '8195', '8196', '8193'];
    case 'bridge':
      return isFrontTooth(tooth) ? ['8424', '8356', '8420'] : ['8422', '8420', '8356'];
    case 'filling':
      return isFrontTooth(tooth) ? [...RESIN_FRONT_CODES, ...AMALGAM_CODES] : [...RESIN_BACK_CODES, ...AMALGAM_CODES, ...INLAY_CODES];
    default:
      return [];
  }
}

/** Plan work for a code: the chart's work type, or 'other' for codes that do not change the chart. */
export const planWorkForCode = (code: string): DentalWork => {
  const work = workForCode(code);
  return work === null || work === 'missing' ? 'other' : work;
};
