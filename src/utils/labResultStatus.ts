export type LabResultStatus = 'low' | 'normal' | 'high';

/**
 * Compares a numeric lab value with its reference range: "4.0-11.0", "<5" / "≤5" (upper limit only)
 * or ">60" / "≥60" (lower limit only). Values or ranges that can't be read count as normal, so only
 * a value proven outside its range is flagged.
 */
export function getResultStatus(value: string | number | null | undefined, range: string | null | undefined): LabResultStatus {
  if (value === null || value === undefined || !range) return 'normal';
  const numValue = parseFloat(String(value));
  if (Number.isNaN(numValue)) return 'normal';

  const between = range.match(/(\d+\.?\d*)\s*-\s*(\d+\.?\d*)/);
  if (between) {
    const [, min, max] = between;
    if (numValue < parseFloat(min)) return 'low';
    if (numValue > parseFloat(max)) return 'high';
    return 'normal';
  }

  const upperOnly = range.match(/^\s*(?:<|≤|<=)\s*(\d+\.?\d*)/);
  if (upperOnly) return numValue > parseFloat(upperOnly[1]) ? 'high' : 'normal';

  const lowerOnly = range.match(/^\s*(?:>|≥|>=)\s*(\d+\.?\d*)/);
  if (lowerOnly) return numValue < parseFloat(lowerOnly[1]) ? 'low' : 'normal';

  return 'normal';
}
