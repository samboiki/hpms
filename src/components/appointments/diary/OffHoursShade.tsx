import React from 'react';
import { describeOffHourSpan, type OffHourSpan } from '../../../utils/diary/gridHours';

// A fine hatch, so the shading does not rely on colour alone; lighter than blocked time's stripes
const OFF_HOURS_HATCH =
  'repeating-linear-gradient(45deg, rgba(100,116,139,0.13) 0, rgba(100,116,139,0.13) 1px, transparent 1px, transparent 7px)';

interface OffHoursShadeProps {
  span: OffHourSpan;
  /** Pixels from the top of the column */
  top: number;
  height: number;
}

/**
 * Time a practitioner is not working on the diary grids (outside their hours, a break, a day off),
 * named for screen readers. Clicks pass through to the slot underneath: booking there still works,
 * with the booking form's warning.
 */
export const OffHoursShade: React.FC<OffHoursShadeProps> = ({ span, top, height }) => (
  <div className="pointer-events-none absolute inset-x-0 bg-slate-100/50" style={{ top: `${top}px`, height: `${height}px`, backgroundImage: OFF_HOURS_HATCH }}>
    <span className="sr-only">{describeOffHourSpan(span)}</span>
  </div>
);
