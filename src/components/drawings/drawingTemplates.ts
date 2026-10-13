/**
 * The artwork under a drawing (parity C9), as SVG text: shown under the pen and painted into the saved PNG. The tooth
 * charts are made from the dental chart's own drawings (toothShapes.ts, in the chart's row order: fdi.ts chartRows),
 * so a tooth looks the same here as on the patient's chart. The body is a plain outline, front and back.
 */
import { BITE_Y, GAP, GLYPH_H, SIDE_H, SURFACE_H, TOOTH_W, toothShape } from '../dental/toothShapes';
import { chartRows, isOnChartLeft, isUpperTooth } from '../../utils/dental/fdi';
import { smoothPath, type DrawingTemplateId } from '../../utils/clinical/drawings';

export interface TemplateArt {
  svg: string;
  width: number;
  height: number;
}

const LINE = '#9ca3af';
const LABEL = '#6b7280';
const FONT = 'font-family="Arial, Helvetica, sans-serif"';

const label = (x: number, y: number, text: string, size = 13): string =>
  `<text x="${x}" y="${y}" text-anchor="middle" font-size="${size}" fill="${LABEL}" ${FONT}>${text}</text>`;

// One side of the body (the viewer's left), from the neck down the arm and the leg and back up to the crotch
const BODY_SIDE: ReadonlyArray<readonly [number, number]> = [
  [90, 62], [70, 74], [52, 86], [44, 112], [38, 168], [32, 218], [28, 246], [24, 272], [32, 290], [42, 270], [44, 246],
  [50, 214], [56, 170], [64, 124], [66, 150], [70, 198], [64, 236], [66, 290], [72, 340], [72, 380], [76, 410], [70, 424],
  [90, 428], [92, 410], [92, 370], [94, 336], [96, 280], [100, 252]
];

function bodyFigure(offsetX: number, offsetY: number, side: 'front' | 'back'): string {
  const mirrored = BODY_SIDE.slice(0, -1).map(([x, y]) => [200 - x, y] as const).reverse();
  const outline = smoothPath([...BODY_SIDE, ...mirrored], true);
  const details =
    side === 'front'
      ? `<circle cx="100" cy="212" r="2.2" fill="none" stroke="${LINE}" stroke-width="1.4"/>`
      : `<path d="M100 72 L100 244" fill="none" stroke="${LINE}" stroke-width="1.2" stroke-dasharray="4 4"/>`;
  return (
    `<g transform="translate(${offsetX} ${offsetY})">` +
    `<ellipse cx="100" cy="34" rx="22" ry="28" fill="none" stroke="${LINE}" stroke-width="1.6"/>` +
    `<path d="${outline}" fill="none" stroke="${LINE}" stroke-width="1.6" stroke-linejoin="round"/>` +
    details +
    // The patient's right is on the viewer's left from the front, and on the viewer's right from the back
    label(14, 300, side === 'front' ? 'R' : 'L', 12) +
    label(186, 300, side === 'front' ? 'L' : 'R', 12) +
    `</g>`
  );
}

function bodyArt(): TemplateArt {
  const width = 440;
  const height = 470;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    label(110, 20, 'Front') +
    label(330, 20, 'Back') +
    bodyFigure(10, 32, 'front') +
    bodyFigure(230, 32, 'back') +
    `</svg>`;
  return { svg, width, height };
}

/** One tooth from the chart's drawings: the side view (crown and roots) and the biting-side outline, lines only */
function toothOutline(tooth: string, x: number, y: number): string {
  const upper = isUpperTooth(tooth);
  const shape = toothShape(tooth);
  const scale = shape.scale;
  const sideTransform = [
    upper ? '' : `translate(0 ${GLYPH_H}) scale(1 -1)`,
    isOnChartLeft(tooth) ? `translate(${TOOTH_W} 0) scale(-1 1)` : '',
    scale === 1 ? '' : `translate(20 ${BITE_Y}) scale(${scale}) translate(-20 ${-BITE_Y})`
  ]
    .filter(Boolean)
    .join(' ');
  const paths = [...shape.backRoots, ...shape.roots, shape.crown]
    .map((d) => `<path d="${d}" fill="none" stroke="${LINE}" stroke-width="0.9" stroke-linejoin="round"/>`)
    .join('');
  const cx = TOOTH_W / 2;
  const cy = (upper ? SIDE_H + GAP : 0) + SURFACE_H / 2;
  const { w, h, r, innerW, innerH } = shape.surface;
  const surface =
    `<rect x="${cx - (w * scale) / 2}" y="${cy - (h * scale) / 2}" width="${w * scale}" height="${h * scale}" rx="${r * scale}" fill="none" stroke="${LINE}" stroke-width="0.9"/>` +
    `<rect x="${cx - (innerW * scale) / 2}" y="${cy - (innerH * scale) / 2}" width="${innerW * scale}" height="${innerH * scale}" fill="none" stroke="${LINE}" stroke-width="0.7"/>`;
  return `<g transform="translate(${x} ${y})"><g${sideTransform ? ` transform="${sideTransform}"` : ''}>${paths}</g>${surface}</g>`;
}

const MARGIN = 24;
const CELL = TOOTH_W + 4;
const TOP = 16;
const NUMBER_BAND = 22;
const ARCH_GAP = 12;

function teethArt(dentition: 'adult' | 'child'): TemplateArt {
  const [upperRow, lowerRow] = chartRows(dentition);
  const count = upperRow.teeth.length;
  const width = MARGIN * 2 + count * CELL - 4;
  const lowerY = TOP + GLYPH_H + NUMBER_BAND * 2 + ARCH_GAP;
  const height = lowerY + GLYPH_H + TOP;
  const middleX = MARGIN + (count / 2) * CELL - 2;
  const parts: string[] = [];
  upperRow.teeth.forEach((tooth, index) => {
    const x = MARGIN + index * CELL;
    parts.push(toothOutline(tooth, x, TOP));
    parts.push(label(x + TOOTH_W / 2, TOP + GLYPH_H + 15, tooth, 11));
  });
  lowerRow.teeth.forEach((tooth, index) => {
    const x = MARGIN + index * CELL;
    parts.push(label(x + TOOTH_W / 2, lowerY - NUMBER_BAND + 15, tooth, 11));
    parts.push(toothOutline(tooth, x, lowerY));
  });
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">` +
    `<path d="M${middleX} ${TOP} L${middleX} ${height - TOP}" stroke="${LINE}" stroke-width="0.8" stroke-dasharray="3 4" fill="none"/>` +
    // Read facing the patient: their right is on the left
    label(10, TOP + GLYPH_H + NUMBER_BAND + ARCH_GAP / 2 + 4, 'R', 12) +
    label(width - 10, TOP + GLYPH_H + NUMBER_BAND + ARCH_GAP / 2 + 4, 'L', 12) +
    parts.join('') +
    `</svg>`;
  return { svg, width, height };
}

/** The artwork of a template, or null for a blank page */
export function templateArt(id: DrawingTemplateId): TemplateArt | null {
  if (id === 'body') return bodyArt();
  if (id === 'teeth-adult') return teethArt('adult');
  if (id === 'teeth-child') return teethArt('child');
  return null;
}

/** The artwork as an image source (for an <img> under the pen and for painting into the PNG) */
export const templateImageSource = (art: TemplateArt): string => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(art.svg)}`;
