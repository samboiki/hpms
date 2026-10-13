/**
 * The drawings of the tooth chart: each tooth seen from the cheek or lip side (crown and roots, shaped by its kind)
 * and from the biting side (the five surfaces a filling is charted on). Shapes are drawn once for an upper tooth with
 * its middle (mesial) side on the left, roots up; ToothGlyph turns them for lower teeth and mirrors them for the other
 * half of the chart, so the middle side always faces the middle of the chart.
 */
import { isMilkTooth, isUpperTooth } from '../../utils/dental/fdi';

/** Width of every drawing (SVG units). */
export const TOOTH_W = 40;
/** Height of the side view: roots from the top, the neck at NECK_Y, the biting edge near BITE_Y. */
export const SIDE_H = 58;
export const NECK_Y = 33;
export const BITE_Y = 56;
/** The biting-side view (surfaces), under an upper tooth and over a lower one. */
export const SURFACE_H = 28;
export const GAP = 4;
export const GLYPH_H = SIDE_H + GAP + SURFACE_H;

export type ToothKind = 'central' | 'incisor' | 'canine' | 'premolar' | 'premolarTwoRoots' | 'molar' | 'lowerMolar';

export interface ToothShape {
  kind: ToothKind;
  /** The crown, cheek side */
  crown: string;
  /** Roots behind the others (the palatal root of an upper molar), drawn lighter */
  backRoots: string[];
  roots: string[];
  /** Root canals: [x1, y1, x2, y2] from the neck to the tip of each root */
  canals: Array<[number, number, number, number]>;
  /** The biting surface outline (width, height, corner radius) and its middle (width, height) */
  surface: { w: number; h: number; r: number; innerW: number; innerH: number };
  /** Milk teeth and wisdom teeth are drawn smaller, round the middle of the biting edge */
  scale: number;
}

// Crowns: widest at the contact points, narrowing to the neck; the gum line (the neck) curves towards the root
const CENTRAL_CROWN =
  'M13.6 33C12.2 37 10.4 44 9.6 50.5Q9.2 54.6 11 55.6Q20 56.8 28.6 55.4Q30.8 54.6 30.6 50.6C30.2 44 28 37 26.4 33Q20 31.4 13.6 33Z';
const INCISOR_CROWN =
  'M14.6 33C13.4 37 11.9 44 11.4 50Q11.2 54.4 12.8 55.3Q20 56.4 27.2 55.3Q28.8 54.4 28.6 50C28.1 44 26.6 37 25.4 33Q20 31.6 14.6 33Z';
const CANINE_CROWN =
  'M13 33C10.6 35.6 9.8 40 10.2 44.4C10.6 48.4 13.4 51.6 16.8 54.1Q20 57.9 23.4 54C26.8 51.4 29.6 48.2 30 44.2C30.3 39.8 29.4 35.6 27 33Q20 31.2 13 33Z';
const PREMOLAR_CROWN =
  'M11.8 33C9.2 34.8 8.4 38.8 8.7 43.2C9.1 48.4 12.4 53 16.6 55.2Q20 56.9 23.4 55.2C27.6 53 30.9 48.4 31.3 43.2C31.6 38.8 30.8 34.8 28.2 33Q20 31.4 11.8 33Z';
const MOLAR_CROWN =
  'M8.6 33C5.6 34.6 4.6 38.6 4.9 43.2C5.2 48.4 7.6 53.4 11.6 55.4Q14.6 56.8 17.4 55.4Q20 53.6 22.6 55.4Q25.4 56.8 28.4 55.4C32.4 53.4 34.8 48.4 35.1 43.2C35.4 38.6 34.4 34.6 31.4 33Q20 31.4 8.6 33Z';

// Roots: tapering to a rounded tip; molars share a root trunk before they divide
const CENTRAL_ROOT = 'M13.8 33C13.6 25 15 15 17.2 8Q18.4 3.6 20 3.4Q21.6 3.6 22.8 8C25 15 26.4 25 26.2 33Z';
const INCISOR_ROOT = 'M14.8 33C14.6 25 15.8 16 17.6 9.2Q18.6 5 20 4.8Q21.4 5 22.4 9.2C24.2 16 25.4 25 25.2 33Z';
const CANINE_ROOT = 'M13 33C12.6 24 14 13 16.6 6Q18 1.4 20 1Q22 1.4 23.4 6C26 13 27.4 24 27 33Z';
const PREMOLAR_ROOT = 'M12.6 33C12.4 25 13.6 16 16.2 9Q17.6 3.4 20 3Q22.4 3.4 23.8 9C26.4 16 27.6 25 27.4 33Z';
/** The upper first premolar: a cheek-side and a palate-side root, split near the tip */
const PREMOLAR_TWO_ROOTS =
  'M12.6 33C12.4 25 13.2 17 14.8 11Q16 4.6 17.8 4.4Q19.4 4.6 19.6 9.5Q20 13.6 20.4 9.5Q20.6 4.6 22.2 4.4Q24 4.6 25.2 11C26.8 17 27.6 25 27.4 33Z';
/** Upper molars: two cheek-side roots on a trunk, the palatal root behind them */
const MOLAR_ROOTS =
  'M9.5 33C8.8 26 8.6 18 9.6 10Q10.4 4.5 13 4.2Q15.6 4.5 16 10C16.5 15 17.5 21 19.2 25.5Q20 23.8 20.8 25.5C22.5 21 23.5 15 24.2 11Q24.8 6.2 27.3 6Q29.8 6.2 30.3 11C31 18 31.2 26 30.5 33Z';
const MOLAR_PALATAL_ROOT = 'M15 33C15.5 24 16.8 13 18.6 5.5Q19.8 1.8 21.4 5.5C23.2 13 24.5 24 25 33Z';
/** Lower molars: a front and a back root on a trunk */
const LOWER_MOLAR_ROOTS =
  'M9.2 33C8.6 26 8.8 17 10 10Q11 4.6 13.4 4.6Q15.8 4.8 16.4 10C16.8 15 17.8 21 19.3 26Q20 24.4 20.7 26C22.2 21 23.2 15 23.8 10.5Q24.6 5 27 5Q29.4 5.2 30 10.5C31 17 31.2 26 30.8 33Z';

const position = (tooth: string): number => Number(tooth.trim().charAt(1));

/** The kind of tooth a number is: incisors, canines, premolars and molars (milk molars at positions 4 and 5). */
export function toothKind(tooth: string): ToothKind {
  const at = position(tooth);
  const upper = isUpperTooth(tooth);
  if (at === 1) return upper ? 'central' : 'incisor';
  if (at === 2) return 'incisor';
  if (at === 3) return 'canine';
  if (isMilkTooth(tooth)) return upper ? 'molar' : 'lowerMolar';
  if (at === 4 || at === 5) return upper && at === 4 ? 'premolarTwoRoots' : 'premolar';
  return upper ? 'molar' : 'lowerMolar';
}

const SHAPES: Readonly<Record<ToothKind, Omit<ToothShape, 'kind' | 'scale'>>> = {
  central: {
    crown: CENTRAL_CROWN,
    backRoots: [],
    roots: [CENTRAL_ROOT],
    canals: [[20, 31, 20, 6]],
    surface: { w: 25, h: 15, r: 6.5, innerW: 13, innerH: 4.5 }
  },
  incisor: {
    crown: INCISOR_CROWN,
    backRoots: [],
    roots: [INCISOR_ROOT],
    canals: [[20, 31, 20, 7]],
    surface: { w: 21, h: 13.5, r: 6, innerW: 11, innerH: 4 }
  },
  canine: {
    crown: CANINE_CROWN,
    backRoots: [],
    roots: [CANINE_ROOT],
    canals: [[20, 31, 20, 3.4]],
    surface: { w: 21, h: 21, r: 9, innerW: 7.5, innerH: 7 }
  },
  premolar: {
    crown: PREMOLAR_CROWN,
    backRoots: [],
    roots: [PREMOLAR_ROOT],
    canals: [[20, 31, 20, 5]],
    surface: { w: 24, h: 23, r: 9.5, innerW: 9, innerH: 8.5 }
  },
  premolarTwoRoots: {
    crown: PREMOLAR_CROWN,
    backRoots: [],
    roots: [PREMOLAR_TWO_ROOTS],
    canals: [
      [17.8, 31, 17.6, 7],
      [22.2, 31, 22.4, 7]
    ],
    surface: { w: 24, h: 23, r: 9.5, innerW: 9, innerH: 8.5 }
  },
  molar: {
    crown: MOLAR_CROWN,
    backRoots: [MOLAR_PALATAL_ROOT],
    roots: [MOLAR_ROOTS],
    canals: [
      [13.6, 31, 12.9, 7],
      [26.4, 31, 27.2, 8.5],
      [20, 31, 20, 4]
    ],
    surface: { w: 28, h: 25, r: 8.5, innerW: 11, innerH: 9.5 }
  },
  lowerMolar: {
    crown: MOLAR_CROWN,
    backRoots: [],
    roots: [LOWER_MOLAR_ROOTS],
    canals: [
      [13.2, 31, 13.2, 7.5],
      [26.8, 31, 27, 7.5]
    ],
    surface: { w: 28, h: 25, r: 8.5, innerW: 11, innerH: 9.5 }
  }
};

/** How a tooth is drawn: its kind's shapes, smaller for milk teeth and wisdom teeth. */
export function toothShape(tooth: string): ToothShape {
  const kind = toothKind(tooth);
  const scale = isMilkTooth(tooth) ? 0.8 : position(tooth) === 8 ? 0.9 : 1;
  return { kind, scale, ...SHAPES[kind] };
}

/** The implant screw in place of the roots (side view, drawn like the roots). */
export const IMPLANT_POST = 'M16.6 33L16.6 9Q16.6 5 20 4.6Q23.4 5 23.4 9L23.4 33Z';
export const IMPLANT_THREADS: readonly number[] = [9, 13, 17, 21, 25, 29];
