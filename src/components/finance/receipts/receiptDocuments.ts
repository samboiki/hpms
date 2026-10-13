import { format, isValid, parseISO } from 'date-fns';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  PORTION_LABELS,
  RECEIPT_METHOD_LABELS,
  type Portion,
  type ReceiptMethod,
  type Statement
} from '../../../services/ledgerService';
import { escapeHtml } from '../financeExport';

/**
 * Receipt and statement documents: printable HTML, and the short text of an SMS or email receipt.
 * Pure (no window, no network). Everything shown is escaped; amounts are N$ to the cent and
 * dates are day-first.
 */

const nad = (cents: number): string => formatNad(fromCents(cents));

export const formatDay = (dateKey: string | null | undefined): string => {
  if (!dateKey) return '—';
  const date = parseISO(dateKey);
  return isValid(date) ? format(date, 'd MMM yyyy') : '—';
};

export interface ReceiptDocument {
  practiceName: string;
  receiptNumber: string;
  receivedOn: string;
  /** Who paid, e.g. the patient's name or the fund */
  payer: string;
  /** Whose account, when someone else paid */
  patientName?: string | null;
  method: ReceiptMethod;
  amountCents: number;
  reference?: string | null;
  /** covers: what the payment covered on the invoice, line by line ("0190 Consultation N$ 200.00") */
  lines: ReadonlyArray<{ invoiceNumber: string; portion: Portion; amountCents: number; covers?: readonly string[] }>;
  /** Left on the account as credit */
  unallocatedCents: number;
  receivedBy?: string | null;
  reversed?: { on: string; reason: string } | null;
}

const PAGE_STYLE = `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px;max-width:720px}
h1{font-size:22px;margin:0}h2{font-size:14px;margin:24px 0 8px;color:#374151}.muted{color:#6B7280;font-size:12px}
.amount{font-size:28px;font-weight:700;margin:16px 0 4px}table{width:100%;border-collapse:collapse;font-size:13px}
th,td{padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:left}th{background:#F9FAFB;color:#4B5563;font-size:11px;text-transform:uppercase;letter-spacing:.04em}
.num{text-align:right;font-variant-numeric:tabular-nums}.facts td{border:none;padding:2px 8px 2px 0}.void{color:#B91C1C;font-weight:600;border:2px solid #B91C1C;padding:6px 10px;display:inline-block;margin-top:12px}`;

/** A printable receipt (A4 or a slip printer) */
export function receiptHtml(doc: ReceiptDocument): string {
  const lines = doc.lines.length === 0
    ? '<tr><td colspan="3" class="muted">Not allocated to an invoice yet: kept as credit on the account</td></tr>'
    : doc.lines.map(line => `<tr><td>${escapeHtml(line.invoiceNumber)}</td><td>${escapeHtml(PORTION_LABELS[line.portion])} portion</td><td class="num">${escapeHtml(nad(line.amountCents))}</td></tr>`
      + (line.covers && line.covers.length > 0 ? `<tr><td colspan="3" class="muted">For ${escapeHtml(line.covers.join(' · '))}</td></tr>` : '')).join('');
  const credit = doc.unallocatedCents > 0
    ? `<tr><td colspan="2">Credit on the account (not allocated)</td><td class="num">${escapeHtml(nad(doc.unallocatedCents))}</td></tr>`
    : '';
  const facts: Array<[string, string | null | undefined]> = [
    ['Received from', doc.payer],
    ['Account of', doc.patientName && doc.patientName !== doc.payer ? doc.patientName : null],
    ['Date', formatDay(doc.receivedOn)],
    ['Paid by', RECEIPT_METHOD_LABELS[doc.method]],
    ['Reference', doc.reference],
    ['Received by', doc.receivedBy]
  ];
  return `<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(doc.receiptNumber)}</title><style>${PAGE_STYLE}</style></head><body>
<h1>${escapeHtml(doc.practiceName)}</h1>
<p class="muted">Receipt ${escapeHtml(doc.receiptNumber)}</p>
<p class="amount">${escapeHtml(nad(doc.amountCents))}</p>
<table class="facts">${facts.filter(([, value]) => value).map(([label, value]) => `<tr><td class="muted">${escapeHtml(label)}</td><td>${escapeHtml(String(value))}</td></tr>`).join('')}</table>
${doc.reversed ? `<p class="void">Reversed on ${escapeHtml(formatDay(doc.reversed.on))}: ${escapeHtml(doc.reversed.reason)}</p>` : ''}
<h2>Paid on</h2>
<table><thead><tr><th>Invoice</th><th>Portion</th><th class="num">Amount</th></tr></thead><tbody>${lines}${credit}</tbody></table>
<p class="muted" style="margin-top:24px">Thank you. Keep this receipt for your records.</p>
</body></html>`;
}

/** SMS receipt: one message, no links, the facts a patient needs */
export function receiptSmsText(doc: Pick<ReceiptDocument, 'practiceName' | 'receiptNumber' | 'receivedOn' | 'method' | 'amountCents' | 'unallocatedCents'>): string {
  const credit = doc.unallocatedCents > 0 ? ` ${nad(doc.unallocatedCents)} is kept as credit on your account.` : '';
  return `${doc.practiceName}: thank you, we received ${nad(doc.amountCents)} (${RECEIPT_METHOD_LABELS[doc.method].toLowerCase()}) on ${formatDay(doc.receivedOn)}. Receipt ${doc.receiptNumber}.${credit}`;
}

/** Email receipt: the printable receipt as the body, with a plain-text alternative */
export function receiptEmail(doc: ReceiptDocument): { subject: string; html: string; text: string } {
  return {
    subject: `Receipt ${doc.receiptNumber} from ${doc.practiceName}`,
    html: receiptHtml(doc),
    text: receiptSmsText(doc)
  };
}

/** A printable statement of account with its running balances */
export function statementHtml(statement: Statement, meta: {
  practiceName: string;
  patientName: string;
  asAtKey: string;
  /** Under the heading: the account's own statement message (parity I8) */
  notices?: readonly string[];
  /** At the foot: that settled items are left off, the practice's message (parity D26, D22) */
  footnotes?: readonly string[];
}): string {
  const money = (cents: number) => (cents === 0 ? '' : escapeHtml(nad(cents)));
  const rows = statement.lines.map(line => `<tr><td>${escapeHtml(formatDay(line.dateKey))}</td><td>${escapeHtml(line.description)}</td>`
    + `<td class="num">${money(line.medicalAid)}</td><td class="num">${money(line.patient)}</td><td class="num">${escapeHtml(nad(line.balance.total))}</td></tr>`).join('');
  const closing = statement.closing;
  return `<!doctype html><html><head><meta charset="utf-8"><title>Statement ${escapeHtml(meta.patientName)}</title><style>${PAGE_STYLE}</style></head><body>
<h1>${escapeHtml(meta.practiceName)}</h1>
<p class="muted">Statement of account for ${escapeHtml(meta.patientName)}, as at ${escapeHtml(formatDay(meta.asAtKey))}</p>
${(meta.notices ?? []).filter(notice => notice.trim()).map(notice => `<p>${escapeHtml(notice.trim())}</p>`).join('\n')}
<table><thead><tr><th>Date</th><th>Details</th><th class="num">Medical aid</th><th class="num">Patient</th><th class="num">Balance</th></tr></thead><tbody>${rows}</tbody></table>
<h2>Balance</h2>
<table class="facts">
<tr><td class="muted">Medical aid still owes</td><td class="num">${escapeHtml(nad(closing.medicalAid))}</td></tr>
<tr><td class="muted">Patient still owes</td><td class="num">${escapeHtml(nad(closing.patient))}</td></tr>
${closing.credit > 0 ? `<tr><td class="muted">Credit on the account</td><td class="num">-${escapeHtml(nad(closing.credit))}</td></tr>` : ''}
<tr><td><strong>Balance</strong></td><td class="num"><strong>${escapeHtml(nad(closing.total))}</strong></td></tr>
</table>
${(meta.footnotes ?? []).filter(line => line.trim()).map(line => `<p class="muted">${escapeHtml(line.trim())}</p>`).join('\n')}
</body></html>`;
}

/** Open a document in a print window. False when the browser blocked the window. */
export function printDocument(html: string): boolean {
  const printWindow = window.open('', '_blank', 'width=820,height=900');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
