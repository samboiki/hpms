/**
 * Crediting chosen invoice lines with one reason (parity D24): what each line may still be credited, how a line's
 * credit splits over the medical aid and patient portions (as the line itself is split, so a line the fund pays is
 * credited to the fund), whether the fund must be told (a line already claimed in a sent batch gets a reversal in the
 * fund's next credit file), and the payload of credit_note_post_lines (proposals/2026-10-09-claim-corrections.sql),
 * which checks it all again. Money in whole cents.
 */
import { formatNad, fromCents } from '../../../utils/billing/money';
import { parseAmountInput } from '../../../services/ledgerService';

/** An invoice line as the credit note screen shows it */
export interface CreditableLine {
  /** invoice_services.id */
  id: string;
  code: string;
  description: string;
  /** yyyy-MM-dd */
  serviceDate: string | null;
  tooth: string | null;
  quantity: number;
  totalCents: number;
  /** The line's own split: what the fund and what the patient were billed */
  medicalAidCents: number;
  patientCents: number;
  /** Credited already by credit notes that were not reversed */
  creditedCents: number;
  /** The sent claim batch the fund received this line in (its latest claim), if any */
  claimedIn: { batchId: string; batchNumber: number } | null;
  /** The unsent batch this line waits in to be claimed, if any */
  waitingIn: number | null;
}

/** What is left to credit on a line */
export const leftToCredit = (line: Pick<CreditableLine, 'totalCents' | 'creditedCents'>): number => Math.max(line.totalCents - line.creditedCents, 0);

/**
 * The medical aid and patient parts of a credit on a line, in proportion to the line's own split, rounded half up
 * to the cent (the same rule as credit_note_post_lines). Every line is wholly one portion today, so a credit on a
 * line the fund pays goes all to the medical aid portion.
 */
export function splitCredit(line: Pick<CreditableLine, 'totalCents' | 'medicalAidCents'>, amountCents: number): { medicalAidCents: number; patientCents: number } {
  if (line.totalCents <= 0 || amountCents <= 0) return { medicalAidCents: 0, patientCents: Math.max(amountCents, 0) };
  const share = Math.max(Math.min(line.medicalAidCents, line.totalCents), 0);
  // amount x share / total, half up, with integers only
  const medicalAidCents = Math.min(Math.floor((2 * amountCents * share + line.totalCents) / (2 * line.totalCents)), amountCents);
  return { medicalAidCents, patientCents: amountCents - medicalAidCents };
}

export interface CreditNoteDraft {
  /** Chosen line id -> the amount typed (N$) */
  amounts: ReadonlyMap<string, string>;
  reason: string;
}

export interface CreditNoteCheck {
  ok: boolean;
  /** Line id -> why its amount cannot be credited */
  lineErrors: Record<string, string>;
  /** About the whole credit note (no line chosen, no reason) */
  errors: string[];
  medicalAidCents: number;
  patientCents: number;
  /** Chosen lines the fund was sent: each gets a reversal in the fund's next credit file */
  reversals: number;
  /** The credit_note_post_lines lines, amounts as N$ strings with 2 decimals */
  lines: Array<{ invoice_line_id: string; amount: string }>;
}

const MAX_REASON_LENGTH = 500;

/**
 * Checks a credit note before it is saved: at least one line, each amount in cents and no more than is left on the
 * line, a medical-aid credit never on a line still waiting in an unsent batch (that claim is corrected in its batch,
 * or the fund would still be claimed for it), and one reason (printed on the credit note).
 */
export function checkCreditNote(lines: readonly CreditableLine[], draft: CreditNoteDraft): CreditNoteCheck {
  const lineErrors: Record<string, string> = {};
  const errors: string[] = [];
  const payload: CreditNoteCheck['lines'] = [];
  let medicalAidCents = 0;
  let patientCents = 0;
  let reversals = 0;

  for (const line of lines) {
    const typed = draft.amounts.get(line.id);
    if (typed === undefined) continue;
    const amountCents = parseAmountInput(typed);
    const left = leftToCredit(line);
    if (amountCents === null) {
      lineErrors[line.id] = 'Enter an amount like 120.00';
      continue;
    }
    if (amountCents > left) {
      lineErrors[line.id] = left > 0 ? `At most ${formatNad(fromCents(left))} is left to credit on this line` : 'This line is credited in full already';
      continue;
    }
    const split = splitCredit(line, amountCents);
    if (split.medicalAidCents > 0 && line.waitingIn !== null) {
      lineErrors[line.id] = `Waiting to be claimed in batch ${line.waitingIn}: remove the invoice from that batch and correct it there instead`;
      continue;
    }
    medicalAidCents += split.medicalAidCents;
    patientCents += split.patientCents;
    if (split.medicalAidCents > 0 && line.claimedIn) reversals += 1;
    payload.push({ invoice_line_id: line.id, amount: (amountCents / 100).toFixed(2) });
  }

  if (draft.amounts.size === 0) errors.push('Choose the lines to credit.');
  const reason = draft.reason.trim();
  if (!reason) errors.push('Say why the lines are credited: it is printed on the credit note.');
  else if (reason.length > MAX_REASON_LENGTH) errors.push(`Keep the reason under ${MAX_REASON_LENGTH} characters.`);

  return {
    ok: errors.length === 0 && Object.keys(lineErrors).length === 0 && payload.length > 0,
    lineErrors,
    errors,
    medicalAidCents,
    patientCents,
    reversals,
    lines: payload
  };
}
