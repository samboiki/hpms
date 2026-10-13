import React, { useId } from 'react';
import { CHART_COLOURS, TONE_LABELS, type MarkTone } from './chartMarks';

/** A small sample of each state, drawn with the chart's own patterns. */
const Swatch: React.FC<{ tone: MarkTone | 'missing' }> = ({ tone }) => {
  const id = `legend-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 16 16" className="h-4 w-4 flex-none" aria-hidden="true" focusable="false">
      <defs>
        <pattern id={id} width={4} height={4} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width={4} height={4} fill={tone === 'defective' ? CHART_COLOURS.defectiveGround : CHART_COLOURS.plannedGround} />
          <rect width={tone === 'defective' ? 1.3 : 1.7} height={4} fill={tone === 'defective' ? CHART_COLOURS.defective : CHART_COLOURS.planned} />
          {tone === 'defective' && <rect width={4} height={1.3} fill={CHART_COLOURS.defective} />}
        </pattern>
      </defs>
      {tone === 'missing' ? (
        <>
          <rect x={1.5} y={1.5} width={13} height={13} rx={3} fill="#ffffff" stroke="#c3c9d1" strokeDasharray="2.5 2" />
          <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke={CHART_COLOURS.missing} strokeWidth={2} strokeLinecap="round" />
        </>
      ) : (
        <rect
          x={1}
          y={1}
          width={14}
          height={14}
          rx={3}
          fill={tone === 'work' ? CHART_COLOURS.work : `url(#${id})`}
          stroke={tone === 'work' ? CHART_COLOURS.work : tone === 'defective' ? CHART_COLOURS.defective : CHART_COLOURS.planned}
        />
      )}
    </svg>
  );
};

/** What the drawings, colours and patterns of the tooth chart mean, one tap away. */
const ChartLegend: React.FC<{ billing?: boolean }> = ({ billing = false }) => (
  <details className="mx-auto max-w-4xl text-sm">
    <summary className="cursor-pointer select-none text-xs font-medium text-gray-600 hover:text-gray-900">What the chart shows</summary>
    <ul className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 text-xs text-gray-700 sm:grid-cols-2">
      <li className="flex items-center gap-2">
        <Swatch tone="work" />
        {TONE_LABELS.work} (done here, billed, or found at an examination): solid
      </li>
      <li className="flex items-center gap-2">
        <Swatch tone="defective" />
        {TONE_LABELS.defective}: cross-hatched
      </li>
      <li className="flex items-center gap-2">
        <Swatch tone="planned" />
        {TONE_LABELS.planned} (on the treatment plan): striped
      </li>
      <li className="flex items-center gap-2">
        <Swatch tone="missing" />
        Missing tooth: faded, with a grey cross (a dashed amber cross: extraction planned)
      </li>
      <li>A coloured crown: a crown. A line in a root: a root canal (dashed to do, dotted when defective).</li>
      <li>A screw in place of the roots: an implant. A bar at the gum: a bridge. A small amber dot: other work to do.</li>
      <li className="sm:col-span-2">
        The shape next to each tooth is its biting side, where fillings are charted: the middle is the biting surface, and
        its sides face the cheek or lips, the tongue or palate, and the front and back of the mouth. A dot in the middle: a
        filling whose surfaces were not recorded.
      </li>
      {billing && (
        <li className="sm:col-span-2">A tick and a ring: a tooth you chose. A number beside a tooth: its lines on this visit.</li>
      )}
    </ul>
  </details>
);

export default ChartLegend;
