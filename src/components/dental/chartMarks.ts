/**
 * What the chart draws on a tooth and in which tone (ToothGlyph draws it, ChartLegend explains it). Work on the tooth
 * is blue and solid, defective work red and cross-hatched, work to do amber and striped, drawn over what is there, so
 * the chart shows what needs doing; the patterns keep the states apart without relying on colour.
 */
import type { ToothRecord, ToothWork } from '../../utils/dental/chart';
import { surfaceList, type Surface } from '../../utils/dental/surfaces';

/** The states the chart tells apart: work there (existing or done), defective work, and work to do. */
export type MarkTone = 'work' | 'defective' | 'planned';

/** Colours of the chart, shared with the legend: calm, and each at least 3:1 against white. */
export const CHART_COLOURS = {
  work: '#3a67ad',
  defective: '#c0392b',
  planned: '#b86e00',
  missing: '#7b8494',
  /** Light grounds of the patterns */
  defectiveGround: '#fbe5e2',
  plannedGround: '#fdf0d8',
  workGround: '#dce6f5',
  /** The tooth itself */
  crown: '#ffffff',
  crownOutline: '#8f897f',
  root: '#f3eee5',
  rootOutline: '#b4ac9e',
  divider: '#cdc6ba'
} as const;

export const TONE_COLOURS: Readonly<Record<MarkTone, string>> = {
  work: CHART_COLOURS.work,
  defective: CHART_COLOURS.defective,
  planned: CHART_COLOURS.planned
};

/** Plain words for each tone (legend and summaries). */
export const TONE_LABELS: Readonly<Record<MarkTone, string>> = {
  work: 'Work on the tooth',
  defective: 'Defective work',
  planned: 'Work to do'
};

const toneOf = (work: Pick<ToothWork, 'status'>): MarkTone => (work.status === 'defective' ? 'defective' : 'work');

export interface Marks {
  /** Tone per filled surface */
  surfaces: Partial<Record<Surface, MarkTone>>;
  /** A filling whose surfaces are not known (billed only): a dot in the middle */
  unknownFilling: MarkTone | null;
  crown: MarkTone | null;
  rootCanal: MarkTone | null;
  implant: MarkTone | null;
  bridge: MarkTone | null;
  missing: boolean;
  /** An extraction is planned */
  extraction: boolean;
  /** Other planned work (a code that does not change the chart) */
  other: boolean;
}

/** What to draw for a tooth: its work now, with the work to do drawn over it. */
export function marksFor(record: ToothRecord | undefined): Marks {
  const marks: Marks = {
    surfaces: {},
    unknownFilling: null,
    crown: null,
    rootCanal: null,
    implant: null,
    bridge: null,
    missing: Boolean(record?.missing),
    extraction: false,
    other: false
  };
  for (const work of record?.now ?? []) {
    const tone = toneOf(work);
    if (work.work === 'filling') {
      const surfaces = surfaceList(work.surfaces);
      if (surfaces.length === 0) marks.unknownFilling = tone;
      surfaces.forEach(surface => {
        marks.surfaces[surface] = tone;
      });
    }
    if (work.work === 'crown') marks.crown = tone;
    if (work.work === 'root_canal') marks.rootCanal = tone;
    if (work.work === 'implant') marks.implant = tone;
    if (work.work === 'bridge') marks.bridge = tone;
  }
  for (const item of record?.plan ?? []) {
    const { work, surfaces } = item.entry;
    if (work === 'filling') {
      const planned = surfaceList(surfaces);
      if (planned.length === 0) marks.unknownFilling = 'planned';
      planned.forEach(surface => {
        marks.surfaces[surface] = 'planned';
      });
    }
    if (work === 'crown') marks.crown = 'planned';
    if (work === 'root_canal') marks.rootCanal = 'planned';
    if (work === 'implant') marks.implant = 'planned';
    if (work === 'bridge') marks.bridge = 'planned';
    if (work === 'extraction') marks.extraction = true;
    if (work === 'other') marks.other = true;
  }
  return marks;
}
