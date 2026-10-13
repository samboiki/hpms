export interface LabResultRowFields {
  name: string;
  value: string;
  unit?: string | null;
  range?: string | null;
  /** True for a result that is already saved in the database */
  saved?: boolean;
}

/**
 * Returns the index of the first result row that was started but is missing its test name or value,
 * or -1 when every row is complete or completely blank. Saving used to skip such rows without a word,
 * so a result the user typed could be lost, and a saved result whose value was cleared kept its old
 * value. A saved row is never "blank": clearing it is not how a result gets removed.
 */
export function findIncompleteResultRow(rows: LabResultRowFields[]): number {
  return rows.findIndex((row) => {
    const hasName = row.name.trim() !== '';
    const hasValue = row.value.trim() !== '';
    if (hasName && hasValue) return false;
    const started = hasName || hasValue || Boolean(row.unit?.trim()) || Boolean(row.range?.trim());
    return started || Boolean(row.saved);
  });
}
