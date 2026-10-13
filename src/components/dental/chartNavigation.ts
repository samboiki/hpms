/**
 * Moving round the tooth chart with the keyboard. The chart is one stop for the Tab key; the arrow keys then move
 * along a jaw (left and right, across the middle of the mouth) and between the jaws (up and down, to the tooth at the
 * same place counted from the middle), Home and End to the ends of a jaw.
 */
import type { ChartRow } from '../../utils/dental/fdi';

/** The tooth in `target` at the same side and distance from the middle as `row.teeth[index]` (milk rows are shorter). */
function counterpart(target: ChartRow | undefined, row: ChartRow, index: number): string | null {
  if (!target) return null;
  const half = row.teeth.length / 2;
  const rightHalf = index >= half;
  const fromMiddle = rightHalf ? index - half : half - 1 - index;
  const targetHalf = target.teeth.length / 2;
  const at = Math.min(fromMiddle, targetHalf - 1);
  return rightHalf ? target.teeth[targetHalf + at] : target.teeth[targetHalf - 1 - at];
}

/** The tooth a key moves to from `tooth`; null when the key does not move (an edge, or another key). */
export function nextTooth(rows: readonly ChartRow[], tooth: string, key: string): string | null {
  const rowIndex = rows.findIndex(row => row.teeth.includes(tooth));
  if (rowIndex < 0) return null;
  const row = rows[rowIndex];
  const index = row.teeth.indexOf(tooth);
  switch (key) {
    case 'ArrowLeft':
      return index > 0 ? row.teeth[index - 1] : null;
    case 'ArrowRight':
      return index < row.teeth.length - 1 ? row.teeth[index + 1] : null;
    case 'Home':
      return row.teeth[0];
    case 'End':
      return row.teeth[row.teeth.length - 1];
    case 'ArrowUp':
      return counterpart(rows[rowIndex - 1], row, index);
    case 'ArrowDown':
      return counterpart(rows[rowIndex + 1], row, index);
    default:
      return null;
  }
}
