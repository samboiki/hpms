/**
 * A claim file can be sent by hand (attached to an email, uploaded on a fund's portal), which skips every check Submit
 * makes. So an open batch's file can always be previewed as a draft, but it can be downloaded only once the batch passes
 * every check, the ICD-10 codes included (NAMAF Circular 4 of 2025: a claim line without an ICD-10 code is not paid). The
 * file of a batch that was already sent is the record of what went to the fund and stays available.
 */
export function downloadBlockedReason(batch: { open: boolean; canSubmit: boolean; errorCount: number }): string | null {
  if (!batch.open || batch.canSubmit) return null;
  return `Fix the ${batch.errorCount} error(s) first: a claim file with errors is refused or not paid by the fund, so it can be previewed here but not downloaded.`;
}
