/**
 * Drawings on templates (parity C9): a practitioner draws with a finger, a pen or the mouse on a body chart, a tooth
 * chart (dental practices only: isDentalPractice) or a blank page; the drawing is saved as a PNG with the visit
 * (patient_media, category 'photo', subcategory 'drawing', in the private records bucket) and shown on the visit and in
 * the patient file's Media tab. The artwork is in src/components/drawings/drawingTemplates.ts.
 */

export type DrawingTemplateId = 'blank' | 'body' | 'teeth-adult' | 'teeth-child';

export interface DrawingTemplate {
  id: DrawingTemplateId;
  label: string;
  /** Width divided by height of the drawing */
  aspect: number;
  /** Only dental practices draw on tooth charts */
  dentalOnly: boolean;
}

export const DRAWING_TEMPLATES: readonly DrawingTemplate[] = [
  { id: 'body', label: 'Body, front and back', aspect: 440 / 470, dentalOnly: false },
  { id: 'teeth-adult', label: 'Teeth (adult)', aspect: 748 / 268, dentalOnly: true },
  { id: 'teeth-child', label: 'Teeth (child)', aspect: 484 / 268, dentalOnly: true },
  { id: 'blank', label: 'Blank page', aspect: 4 / 3, dentalOnly: false }
];

export const DRAWING_SUBCATEGORY = 'drawing';
export const DRAWING_CAPTION_MAX = 200;

/** The templates a practice can draw on: tooth charts for dental practices only, a dental practice's first */
export function drawingTemplatesFor(isDental: boolean): DrawingTemplate[] {
  const allowed = DRAWING_TEMPLATES.filter((template) => isDental || !template.dentalOnly);
  return isDental ? [...allowed.filter((template) => template.dentalOnly), ...allowed.filter((template) => !template.dentalOnly)] : allowed;
}

export const drawingTemplate = (id: string | null | undefined): DrawingTemplate =>
  DRAWING_TEMPLATES.find((template) => template.id === id) ?? DRAWING_TEMPLATES[DRAWING_TEMPLATES.length - 1];

/** "Drawing: Teeth (adult), crown on 21" as the file's title in the patient file */
export function drawingTitle(templateId: DrawingTemplateId, caption: string): string {
  const what = caption.replace(/\s+/g, ' ').trim();
  return `Drawing: ${drawingTemplate(templateId).label}${what ? `, ${what}` : ''}`.slice(0, 250);
}

/** "drawing-2026-10-13-k3x9q2.png": unique enough with the random part; the folder names the patient and visit */
export const drawingFileName = (dateKey: string, random: string): string =>
  `drawing-${dateKey}-${random.replace(/[^a-z0-9]/gi, '').slice(0, 12) || 'x'}.png`;

/** A point of a stroke as a share of the drawing's width and height (0 to 1), so a stroke survives a resize */
export type StrokePoint = readonly [number, number];

export interface Stroke {
  colour: string;
  /** Thickness as thousandths of the drawing's width */
  width: number;
  points: StrokePoint[];
}

/** The pens: a dark line, red and blue for what is marked */
export const DRAWING_COLOURS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '#111827', label: 'Black' },
  { value: '#dc2626', label: 'Red' },
  { value: '#2563eb', label: 'Blue' }
];
export const DRAWING_WIDTHS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 4, label: 'Thin' },
  { value: 10, label: 'Thick' }
];

/** A pointer's place on the drawing, kept between 0 and 1 */
export function toStrokePoint(x: number, y: number, width: number, height: number): StrokePoint {
  const clamp = (value: number) => Math.min(1, Math.max(0, value));
  return [clamp(width > 0 ? x / width : 0), clamp(height > 0 ? y / height : 0)];
}

/** True when the drawing has a line on it (an empty one is not saved) */
export const hasInk = (strokes: readonly Stroke[]): boolean => strokes.some((stroke) => stroke.points.length > 0);

const round = (value: number): number => Math.round(value * 100) / 100;

/**
 * A smooth SVG path through points (Catmull-Rom curves as cubic Beziers), closed or open: the body outline is drawn
 * through a few points per side instead of hundreds of hand-placed ones.
 */
export function smoothPath(points: ReadonlyArray<readonly [number, number]>, closed: boolean): string {
  if (points.length < 2) return '';
  const at = (index: number): readonly [number, number] => {
    if (closed) return points[(index + points.length) % points.length];
    return points[Math.min(points.length - 1, Math.max(0, index))];
  };
  const segments = closed ? points.length : points.length - 1;
  let d = `M${round(points[0][0])} ${round(points[0][1])}`;
  for (let i = 0; i < segments; i += 1) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${round(c1[0])} ${round(c1[1])} ${round(c2[0])} ${round(c2[1])} ${round(p2[0])} ${round(p2[1])}`;
  }
  return closed ? `${d} Z` : d;
}
