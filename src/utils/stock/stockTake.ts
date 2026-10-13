/**
 * Stock takes: the variance report (counted against what the ledger expected when each count was entered) and its
 * value at the average cost, the way stock_post_count values the differences when the count is posted.
 */
import { gainValueCents, issueValueCents, type StockLevel } from './ledger';

export interface CountLine {
  itemId: string;
  name: string;
  unit: string;
  /** On hand when the count was entered */
  expected: number;
  counted: number;
  /** The item's level now, for valuing the difference */
  level: StockLevel;
}

export interface VarianceRow extends CountLine {
  /** counted - expected: negative = fewer on the shelf than the ledger said */
  difference: number;
  /** The value of the difference, signed like it (cents) */
  valueCents: number;
}

/** A variance report's lines with their totals (valued now while counting, or as posted once posted) */
export interface VarianceSummary<Row extends { name: string; difference: number; valueCents: number }> {
  rows: Row[];
  counted: number;
  /** Lines whose count differs */
  changed: number;
  unitsShort: number;
  unitsOver: number;
  valueCents: number;
}

export type VarianceReport = VarianceSummary<VarianceRow>;

/** Biggest losses first (by value), then the gains, then the lines that matched; with the totals */
function summarise<Row extends { name: string; difference: number; valueCents: number }>(lines: readonly Row[]): VarianceSummary<Row> {
  const rows = [...lines].sort((a, b) => a.valueCents - b.valueCents || a.difference - b.difference || a.name.localeCompare(b.name));
  return {
    rows: [...rows.filter(row => row.difference !== 0), ...rows.filter(row => row.difference === 0)],
    counted: rows.length,
    changed: rows.filter(row => row.difference !== 0).length,
    unitsShort: rows.reduce((sum, row) => sum + Math.max(-row.difference, 0), 0),
    unitsOver: rows.reduce((sum, row) => sum + Math.max(row.difference, 0), 0),
    valueCents: rows.reduce((sum, row) => sum + row.valueCents, 0)
  };
}

/** The variance report, biggest losses first (by value), then the gains, then the lines that matched */
export function varianceReport(lines: readonly CountLine[]): VarianceReport {
  return summarise(lines.map((line): VarianceRow => {
    const difference = line.counted - line.expected;
    const valueCents = difference < 0 ? -issueValueCents(line.level, -difference) : gainValueCents(line.level, difference);
    return { ...line, difference, valueCents };
  }));
}

/** One line of a count that was posted or cancelled, as it was */
export interface ClosedCountRow {
  itemId: string;
  name: string;
  unit: string;
  expected: number;
  counted: number;
  difference: number;
  /** The difference's value as the count posted it (signed like it); 0 when it matched or the count was cancelled */
  valueCents: number;
}

/**
 * A count already posted (or cancelled), read back as it was: each counted item with what the ledger expected when
 * it was counted, what was counted and the difference, valued from the count's own "counted" movements (by item),
 * not at today's average cost. So the variance report printed later still matches the stock value the count changed.
 * A cancelled count has no movements: its differences are shown, worth nothing.
 */
export function closedCountReport(
  lines: ReadonlyArray<{ itemId: string; name: string; unit: string; expected: number; counted: number }>,
  movements: ReadonlyArray<{ itemId: string; kind: string; valueCents: number }>
): VarianceSummary<ClosedCountRow> {
  const posted = new Map<string, number>();
  for (const movement of movements) {
    if (movement.kind === 'counted') posted.set(movement.itemId, (posted.get(movement.itemId) ?? 0) + movement.valueCents);
  }
  return summarise(lines.map((line): ClosedCountRow => ({
    ...line,
    difference: line.counted - line.expected,
    valueCents: posted.get(line.itemId) ?? 0
  })));
}
