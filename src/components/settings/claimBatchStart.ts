/**
 * Where OneHealth's claim batch numbers continue from (Settings > Practice > Claim batches).
 *
 * The claim file is named <practice number>_<batch number>_<fund>.Dat and the funds have already processed the runs the
 * practice's previous software (Eminance) sent under the same practice number. Repeating a number the fund has seen
 * risks the file being treated as a duplicate and not paid. Owner decision 13 Oct 2026: each practice enters its last
 * Eminance batch number in Settings. The database numbers every new batch (assign_claim_batch_number, live since
 * proposals/2026-10-07-claim-batch-numbers.sql) as one more than the highest batch under the practice number, never
 * lower than practices.claim_batch_number_start; so the start stored is the last Eminance number plus one.
 */

/** practices.claim_batch_number_start for the last Eminance batch number staff typed; null clears it */
export function startFromLastBatch(lastBatch: number | null): number | null {
  return lastBatch === null ? null : lastBatch + 1;
}

/** The last Eminance batch number to show for a stored start (the start minus one); null when none is set */
export function lastBatchFromStart(start: number | null | undefined): number | null {
  return typeof start === 'number' && Number.isInteger(start) && start > 1 ? start - 1 : null;
}

/** The number the next claim batch gets, the database's own rule: max(highest used + 1, start) */
export function nextClaimBatchNumber(highestUsed: number | null | undefined, start: number | null | undefined): number {
  const afterHighest = (typeof highestUsed === 'number' && Number.isFinite(highestUsed) ? highestUsed : 0) + 1;
  return Math.max(afterHighest, typeof start === 'number' && start > 0 ? start : 1);
}

/**
 * What staff typed, checked: empty clears the setting; otherwise a whole number from 1 (Eminance numbers its runs
 * from 1) up to a limit that leaves room for the database's integer column.
 */
export function parseLastBatchInput(text: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, error: 'Enter the batch number as a whole number, for example 44.' };
  const value = Number(trimmed);
  if (value < 1) return { ok: false, error: 'Batch numbers start at 1. Leave it empty if the practice never sent claims from Eminance.' };
  if (value > 999999) return { ok: false, error: 'That batch number is too large. Check it against the last Eminance claim file.' };
  return { ok: true, value };
}
