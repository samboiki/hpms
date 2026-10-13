import React, { useId } from 'react';
import type { ToothRecord } from '../../utils/dental/chart';
import { isOnChartLeft, isUpperTooth } from '../../utils/dental/fdi';
import { surfaceLayout, type Surface } from '../../utils/dental/surfaces';
import { CHART_COLOURS, TONE_COLOURS, marksFor, type MarkTone } from './chartMarks';
import { BITE_Y, GAP, GLYPH_H, IMPLANT_POST, IMPLANT_THREADS, NECK_Y, SIDE_H, SURFACE_H, TOOTH_W, toothShape } from './toothShapes';

/**
 * One tooth on the chart: its crown and roots seen from the cheek or lip side, shaped by its kind (incisor, canine,
 * premolar, molar; milk teeth smaller), and under it (over it for a lower tooth) the biting side with the five
 * surfaces a filling is charted on. Work on the tooth is solid blue, defective work red and cross-hatched, work to do
 * amber and striped; a coloured crown is a crown, a line in a root a root canal, a screw an implant, a bar at the gum
 * a bridge, a grey cross a missing tooth. The button around it carries the words for screen readers.
 */

interface ToothGlyphProps {
  tooth: string;
  record: ToothRecord | undefined;
  className?: string;
}

/** Lines (root canals, crosses) keep the states apart without colour too: solid, dotted when defective, dashed to do. */
const DASHES: Readonly<Record<MarkTone, string | undefined>> = {
  work: undefined,
  defective: '1 1.8',
  planned: '3 2'
};

const ToothGlyph: React.FC<ToothGlyphProps> = ({ tooth, record, className }) => {
  // One set of patterns per drawing, with ids that are valid in url(#...)
  const id = `tooth-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const upper = isUpperTooth(tooth);
  const shape = toothShape(tooth);
  const marks = marksFor(record);
  const layout = surfaceLayout(tooth);
  const scale = shape.scale;

  const fillOf = (tone: MarkTone | null | undefined, fallback: string): string =>
    tone === 'work' ? CHART_COLOURS.work : tone === 'defective' ? `url(#${id}-defective)` : tone === 'planned' ? `url(#${id}-planned)` : fallback;

  // The side view is drawn for an upper tooth on the patient's left: lower teeth are turned upside down, teeth on the
  // left half of the chart mirrored (their middle side faces right), milk and wisdom teeth scaled round the bite.
  const sideTransform = [
    upper ? '' : `translate(0 ${GLYPH_H}) scale(1 -1)`,
    isOnChartLeft(tooth) ? `translate(${TOOTH_W} 0) scale(-1 1)` : '',
    scale === 1 ? '' : `translate(20 ${BITE_Y}) scale(${scale}) translate(-20 ${-BITE_Y})`
  ]
    .filter(Boolean)
    .join(' ');

  // An implant or a bridge in place restores a missing tooth; one that is only planned does not yet
  const restored = (marks.implant !== null && marks.implant !== 'planned') || (marks.bridge !== null && marks.bridge !== 'planned');
  // The natural roots are gone with the tooth (an implant takes their place); the crown too unless it was restored
  const ghostRoots = marks.missing || marks.implant !== null;
  const ghostCrown = marks.missing && !restored;
  const ghost = { fill: '#ffffff', fillOpacity: 0.6, stroke: '#c3c9d1', strokeDasharray: '2.5 2' };

  // The biting side: the outline of the tooth's kind with its middle; the four sides run to the outline
  const cx = TOOTH_W / 2;
  const cy = (upper ? SIDE_H + GAP : 0) + SURFACE_H / 2;
  const { w, h, r, innerW, innerH } = shape.surface;
  const [x0, x1, y0, y1] = [cx - (w * scale) / 2, cx + (w * scale) / 2, cy - (h * scale) / 2, cy + (h * scale) / 2];
  const [ix0, ix1, iy0, iy1] = [cx - (innerW * scale) / 2, cx + (innerW * scale) / 2, cy - (innerH * scale) / 2, cy + (innerH * scale) / 2];
  const zones: Array<{ surface: Surface; d: string }> = [
    { surface: layout.top, d: `M${x0} ${y0}H${x1}L${ix1} ${iy0}H${ix0}Z` },
    { surface: layout.right, d: `M${x1} ${y0}V${y1}L${ix1} ${iy1}V${iy0}Z` },
    { surface: layout.bottom, d: `M${x1} ${y1}H${x0}L${ix0} ${iy1}H${ix1}Z` },
    { surface: layout.left, d: `M${x0} ${y1}V${y0}L${ix0} ${iy0}V${iy1}Z` }
  ];
  const outline = { x: x0, y: y0, width: w * scale, height: h * scale, rx: r * scale };

  return (
    <svg viewBox={`0 0 ${TOOTH_W} ${GLYPH_H}`} className={className} aria-hidden="true" focusable="false">
      <defs>
        <pattern id={`${id}-planned`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={4} height={4} fill={CHART_COLOURS.plannedGround} />
          <rect width={1.7} height={4} fill={CHART_COLOURS.planned} />
        </pattern>
        <pattern id={`${id}-defective`} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={4} height={4} fill={CHART_COLOURS.defectiveGround} />
          <rect width={1.3} height={4} fill={CHART_COLOURS.defective} />
          <rect width={4} height={1.3} fill={CHART_COLOURS.defective} />
        </pattern>
        <linearGradient id={`${id}-enamel`} x1={0} y1={0} x2={0} y2={1}>
          <stop offset="0%" stopColor="#f2eee6" />
          <stop offset="55%" stopColor="#fdfcfa" />
          <stop offset="100%" stopColor="#ffffff" />
        </linearGradient>
        <clipPath id={`${id}-surface`}>
          <rect {...outline} />
        </clipPath>
      </defs>

      <g transform={sideTransform || undefined}>
        {/* Roots: the palatal root of an upper molar sits behind the others */}
        {shape.backRoots.map(d => (
          <path key={d} d={d} {...(ghostRoots ? ghost : { fill: '#ebe5da', stroke: CHART_COLOURS.rootOutline })} strokeWidth={0.9} />
        ))}
        {shape.roots.map(d => (
          <path key={d} d={d} {...(ghostRoots ? ghost : { fill: CHART_COLOURS.root, stroke: CHART_COLOURS.rootOutline })} strokeWidth={1} />
        ))}
        {marks.implant && (
          <g>
            <path d={IMPLANT_POST} fill={fillOf(marks.implant, '#ffffff')} stroke={TONE_COLOURS[marks.implant]} strokeWidth={1.3} />
            {IMPLANT_THREADS.map(y => (
              <line key={y} x1={15} y1={y} x2={25} y2={y} stroke={TONE_COLOURS[marks.implant as MarkTone]} strokeWidth={1.3} strokeLinecap="round" />
            ))}
          </g>
        )}
        {marks.rootCanal &&
          !ghostRoots &&
          shape.canals.map(([cx1, cy1, cx2, cy2]) => (
            <line
              key={`${cx1}-${cx2}`}
              x1={cx1}
              y1={cy1}
              x2={cx2}
              y2={cy2}
              stroke={TONE_COLOURS[marks.rootCanal as MarkTone]}
              strokeWidth={2.2}
              strokeDasharray={DASHES[marks.rootCanal as MarkTone]}
              strokeLinecap="round"
            />
          ))}
        {/* The crown: coloured all over when it is a crown */}
        <path
          d={shape.crown}
          {...(ghostCrown
            ? ghost
            : {
                fill: marks.crown ? fillOf(marks.crown, '#ffffff') : `url(#${id}-enamel)`,
                stroke: marks.crown ? TONE_COLOURS[marks.crown] : CHART_COLOURS.crownOutline
              })}
          strokeWidth={marks.crown ? 1.5 : 1.1}
          strokeLinejoin="round"
        />
        {marks.bridge && (
          <rect
            x={0.6}
            y={NECK_Y - 1.7}
            width={TOOTH_W - 1.2}
            height={3.4}
            rx={1.7}
            fill={fillOf(marks.bridge, '#ffffff')}
            stroke={TONE_COLOURS[marks.bridge]}
            strokeWidth={0.9}
          />
        )}
        {(ghostCrown || marks.extraction) && (
          <g
            stroke={marks.extraction ? CHART_COLOURS.planned : CHART_COLOURS.missing}
            strokeWidth={2.4}
            strokeLinecap="round"
            strokeDasharray={marks.extraction ? DASHES.planned : undefined}
          >
            <line x1={8} y1={10} x2={32} y2={54} />
            <line x1={32} y1={10} x2={8} y2={54} />
          </g>
        )}
      </g>

      {/* The biting side: the five surfaces */}
      {ghostCrown ? (
        <rect {...outline} {...ghost} strokeWidth={1} />
      ) : (
        <g>
          <g clipPath={`url(#${id}-surface)`}>
            {zones.map(zone => (
              <path key={zone.surface} d={zone.d} fill={fillOf(marks.surfaces[zone.surface], '#ffffff')} stroke={CHART_COLOURS.divider} strokeWidth={0.7} />
            ))}
            <rect
              x={ix0}
              y={iy0}
              width={ix1 - ix0}
              height={iy1 - iy0}
              rx={2 * scale}
              fill={fillOf(marks.surfaces[layout.centre], '#ffffff')}
              stroke={CHART_COLOURS.divider}
              strokeWidth={0.7}
            />
          </g>
          <rect {...outline} fill="none" stroke={CHART_COLOURS.crownOutline} strokeWidth={1.1} />
          {marks.unknownFilling && (
            <circle cx={cx} cy={cy} r={3.2 * scale} fill={fillOf(marks.unknownFilling, '#ffffff')} stroke={TONE_COLOURS[marks.unknownFilling]} strokeWidth={0.9} />
          )}
        </g>
      )}

      {/* Other work to do on this tooth (a code that does not change the drawing) */}
      {marks.other && <circle cx={36} cy={upper ? NECK_Y + 2 : GLYPH_H - NECK_Y - 2} r={3.2} fill={CHART_COLOURS.planned} stroke="#ffffff" strokeWidth={1.2} />}
    </svg>
  );
};

export default ToothGlyph;
