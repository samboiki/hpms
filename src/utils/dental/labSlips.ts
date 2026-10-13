/**
 * The 8099 lab slip (parity D28): the dental laboratory's invoice for a lab order, line by line (the lab's item code,
 * what it is, the amount). The practice bills the slip's total under 8099 (NAMAF rule 010: dental technician fees at
 * cost, with the lab's invoice), and the claim carries the slip's lines straight after the 8099 line as type L detail
 * records that add up to it (QEDI layout; a fund refuses an 8099 line without them, or when they do not add up). Before
 * a batch is sent, every 8099 line needs its slip: a lab order billed at the line's visit whose lines add up to the line.
 * Dental practices only. Pure; tested in __tests__/labSlips.test.ts.
 */
import { formatNad, fromCents, hasAtMostDecimals, sumCents, toCents } from '../billing/money';
import type { ClaimLabDetail, ClaimLine } from '../billing/claimLine';

/** NAMAF dental: "Dental technician fees" (laboratory work at cost, with the lab's invoice). */
export const LAB_FEE_CODE = '8099';
export const MAX_SLIP_LINES = 30;
/** What the slip and the patient file show; the claim's description field keeps the first 30 characters. */
export const SLIP_DESCRIPTION_MAX = 60;
export const SLIP_NUMBER_MAX = 15;
export const MAX_SLIP_AMOUNT = 1_000_000;
const SLIP_NUMBER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/-]{0,14}$/;
const LAB_CODE_PATTERN = /^[0-9A-Z]{1,10}$/;

export interface LabSlipLine {
  /** The lab's item code (a dental technician code such as 9330), when its invoice gives one */
  code: string | null;
  description: string;
  amountCents: number;
}

export interface LabSlipLineDraft {
  code: string;
  description: string;
  amount: string;
}

export interface LabSlipDraft {
  /** The lab's invoice (slip) number */
  slipNumber: string;
  lines: LabSlipLineDraft[];
}

export interface LabSlipErrors {
  slipNumber?: string;
  lines?: string;
  /** By the line's place in the form */
  byLine: Record<number, Partial<Record<keyof LabSlipLineDraft, string>>>;
}

export const emptySlipLine = (): LabSlipLineDraft => ({ code: '', description: '', amount: '' });

export const labSlipTotalCents = (lines: readonly Pick<LabSlipLine, 'amountCents'>[]): number => sumCents(lines.map(line => line.amountCents));

/** "1 850", "N$ 1,850.00" -> 1850; null when it is not an amount in cents above zero. */
export function parseSlipAmount(text: string): number | null {
  const clean = text.replace(/[N$\s,]/gi, '');
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return null;
  const value = Number(clean);
  return value > 0 && value <= MAX_SLIP_AMOUNT && hasAtMostDecimals(value, 2) ? value : null;
}

const isBlank = (line: LabSlipLineDraft): boolean => !line.code.trim() && !line.description.trim() && !line.amount.trim();

/**
 * Checks the lab's invoice as typed and builds the dental_lab_slip_save payload. Empty rows are left out; every other
 * row needs what it is and its amount (the fund pays the lab's lines, not a total). No rows removes the slip.
 */
export function validateLabSlipDraft(
  draft: LabSlipDraft
): { ok: true; payload: { slip_number: string | null; lines: Array<{ code: string | null; description: string; amount: number }> }; totalCents: number } | { ok: false; errors: LabSlipErrors } {
  const errors: LabSlipErrors = { byLine: {} };
  const slipNumber = draft.slipNumber.trim();
  if (slipNumber && !SLIP_NUMBER_PATTERN.test(slipNumber)) {
    errors.slipNumber = `The lab's invoice number: letters, digits, / and -, at most ${SLIP_NUMBER_MAX}.`;
  }
  const lines: Array<{ code: string | null; description: string; amount: number }> = [];
  draft.lines.forEach((line, index) => {
    if (isBlank(line)) return;
    const own: Partial<Record<keyof LabSlipLineDraft, string>> = {};
    const code = line.code.trim().toUpperCase();
    if (code && !LAB_CODE_PATTERN.test(code)) own.code = 'Letters and digits only.';
    const description = line.description.trim().replace(/\s+/g, ' ');
    if (!description) own.description = 'Say what the lab made.';
    else if (description.length > SLIP_DESCRIPTION_MAX) own.description = `At most ${SLIP_DESCRIPTION_MAX} characters.`;
    const amount = parseSlipAmount(line.amount);
    if (amount === null) own.amount = 'An amount such as 1850.00.';
    if (Object.keys(own).length > 0) errors.byLine[index] = own;
    else lines.push({ code: code || null, description, amount: amount as number });
  });
  if (lines.length + Object.keys(errors.byLine).length > MAX_SLIP_LINES) errors.lines = `At most ${MAX_SLIP_LINES} lines.`;
  if (errors.slipNumber || errors.lines || Object.keys(errors.byLine).length > 0) return { ok: false, errors };
  return {
    ok: true,
    payload: { slip_number: slipNumber || null, lines },
    totalCents: sumCents(lines.map(line => toCents(line.amount)))
  };
}

// ---------------------------------------------------------------------------------------------------
// The claim: every 8099 line with its slip
// ---------------------------------------------------------------------------------------------------

/** A lab order billed at a visit, with the lab's invoice lines (what the claim needs). */
export interface BilledLabOrder {
  id: string;
  orderNo: number;
  /** The visit whose 8099 line bills the lab's work */
  billedVisitId: string;
  slipNumber: string | null;
  labName: string | null;
  lines: readonly LabSlipLine[];
}

export interface LabSlipIssue {
  /** ClaimLine.key */
  lineKey: string;
  severity: 'error';
  message: string;
}

export interface LabSlipPairing {
  /** The order each 8099 line carries, by ClaimLine.key */
  orders: Map<string, BilledLabOrder>;
  issues: LabSlipIssue[];
}

export const isLabFeeLine = (line: Pick<ClaimLine, 'tariffCode'>): boolean => (line.tariffCode ?? '').trim() === LAB_FEE_CODE;

/**
 * Each 8099 line paired with an order whose lab lines add up to the line exactly, each order once, in the lines' order
 * (so a second line never takes the order another line matches). What is left over is returned unpaired.
 */
export function matchLabSlips<L extends { key: string; cents: number }, O extends { id: string; lines: readonly Pick<LabSlipLine, 'amountCents'>[] }>(
  feeLines: readonly L[],
  orders: readonly O[]
): { paired: Map<string, O>; unpairedLines: L[]; unpairedOrders: O[] } {
  const used = new Set<string>();
  const paired = new Map<string, O>();
  for (const line of feeLines) {
    const match = orders.find(order => !used.has(order.id) && order.lines.length > 0 && labSlipTotalCents(order.lines) === line.cents);
    if (match) {
      used.add(match.id);
      paired.set(line.key, match);
    }
  }
  return { paired, unpairedLines: feeLines.filter(line => !paired.has(line.key)), unpairedOrders: orders.filter(order => !used.has(order.id)) };
}

/**
 * Pairs each 8099 claim line with a lab order billed at the line's visit whose lines add up to the line's amount
 * (matchLabSlips, per visit). A line left without one gets an error saying what to do: the fund would refuse it.
 */
export function pairLabSlips(lines: readonly ClaimLine[], orders: readonly BilledLabOrder[]): LabSlipPairing {
  const byVisit = new Map<string, BilledLabOrder[]>();
  for (const order of [...orders].sort((a, b) => a.orderNo - b.orderNo)) {
    byVisit.set(order.billedVisitId, [...(byVisit.get(order.billedVisitId) ?? []), order]);
  }
  const feeLines = lines.filter(isLabFeeLine).sort((a, b) => a.transactionNumber - b.transactionNumber);
  const lineVisits = new Map<string, ClaimLine[]>();
  for (const line of feeLines) lineVisits.set(line.visitId ?? '', [...(lineVisits.get(line.visitId ?? '') ?? []), line]);

  const paired = new Map<string, BilledLabOrder>();
  const leftOver = new Map<string, BilledLabOrder[]>();
  for (const [visitId, visitLines] of lineVisits) {
    const keyed = visitLines.map(line => ({ key: line.key, cents: Number.isFinite(line.amount) ? toCents(line.amount) : Number.NaN }));
    const match = matchLabSlips(keyed, visitId ? byVisit.get(visitId) ?? [] : []);
    match.paired.forEach((order, key) => paired.set(key, order));
    leftOver.set(visitId, match.unpairedOrders);
  }

  const issues: LabSlipIssue[] = [];
  for (const line of feeLines) {
    if (paired.has(line.key)) continue;
    const candidates = leftOver.get(line.visitId ?? '') ?? [];
    const withLines = candidates.filter(order => order.lines.length > 0);
    let message: string;
    if (candidates.length === 0) {
      message =
        "8099 needs the lab's slip: on the visit's Billing tab, under Lab work, bill the lab order this line is for, with the lab's invoice lines. A fund refuses 8099 without them.";
    } else if (withLines.length === 0) {
      message = `Order ${candidates[0].orderNo} has none of the lab's invoice lines yet: enter them from the lab's invoice (patient file, Teeth, Lab work).`;
    } else {
      const order = withLines[0];
      message = `The lab's lines of order ${order.orderNo} add up to ${formatNad(fromCents(labSlipTotalCents(order.lines)))}, but this 8099 line is ${formatNad(line.amount)}: they must be equal.`;
    }
    issues.push({ lineKey: line.key, severity: 'error', message });
  }
  return { orders: paired, issues };
}

/** The claim lines with each paired 8099 line carrying its lab's lines (written after it as type L records). */
export function withLabDetails(lines: readonly ClaimLine[], pairing: Pick<LabSlipPairing, 'orders'>): ClaimLine[] {
  return lines.map(line => {
    const order = pairing.orders.get(line.key);
    if (!order) return line;
    const labDetails: ClaimLabDetail[] = order.lines.map(detail => ({ code: detail.code, description: detail.description, amount: fromCents(detail.amountCents) }));
    return { ...line, labDetails, labSlipNumber: order.slipNumber };
  });
}
