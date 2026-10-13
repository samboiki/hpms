import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  AGE_BANDS,
  ageBandFor,
  billedPortions,
  buildStatement,
  invoiceAgeDays,
  invoiceDateKey,
  leaveSettledOff,
  owedPortions,
  paymentDetailsText,
  settledInvoiceIds,
  statementDate,
  zeroBands,
  type ArAdjustment,
  type ArAllocation,
  type ArInvoiceBalance,
  type ArReceipt,
  type BandCents,
  type LedgerInvoice,
  type PaymentDetails,
  type Statement,
  type StatementInput,
  type StatementInvoice,
  type StatementLanguage,
  type StatementLine
} from '../../../services/ledgerService';
import { escapeHtml } from '../financeExport';

/**
 * Statements of account as documents: one account holder, every patient they pay for, the lines
 * with the running balance (arStatement), the age of what is owed, and how to pay. In English or
 * Afrikaans (the account's statement language). Pure: the screens print or send the HTML through
 * communicationService. No password, and certainly none made from a date of birth: the email goes
 * only to the address on the patient file and holds no clinical detail.
 */

const WORDS: Record<StatementLanguage, Record<string, string>> = {
  en: {
    statement: 'Statement of account', for: 'for', asAt: 'as at', reference: 'Account reference', patients: 'Patients on this account',
    date: 'Date', details: 'Details', medicalAid: 'Medical aid', patient: 'Patient', balance: 'Balance', ageOfDebt: 'What is owed, by age',
    medicalAidOwes: 'Medical aid still owes', patientOwes: 'Patient still owes', credit: 'Credit on the account', amountDue: 'Balance',
    howToPay: 'How to pay', queries: 'Queries', nothing: 'Nothing on this account in this period.', subject: 'Statement of account',
    broughtForward: 'Balance brought forward', invoice: 'Invoice', receipt: 'Payment received', payment: 'Payment', creditUsed: 'Credit used',
    paymentReversed: 'Payment taken off an invoice', receiptReversed: 'Payment reversed', creditNote: 'Credit note', writeOff: 'Write-off',
    journal: 'Correction', shortfall: 'Shortfall moved to patient', refund: 'Refund', adjustmentReversed: 'Adjustment reversed',
    layBye: 'Lay-bye: this account is paid off as agreed. Nothing on it is overdue; the balance is what is still to pay.',
    discount: 'Discount', authorisation: 'authorisation', authorisations: 'authorisations',
    settledLeftOff: 'Paid invoices, and the payments that settled them, are left off this statement.'
  },
  af: {
    statement: 'Rekeningstaat', for: 'vir', asAt: 'soos op', reference: 'Rekeningverwysing', patients: 'Pasiënte op hierdie rekening',
    date: 'Datum', details: 'Besonderhede', medicalAid: 'Mediese fonds', patient: 'Pasiënt', balance: 'Saldo', ageOfDebt: 'Uitstaande bedrag volgens ouderdom',
    medicalAidOwes: 'Mediese fonds skuld nog', patientOwes: 'Pasiënt skuld nog', credit: 'Krediet op die rekening', amountDue: 'Saldo',
    howToPay: 'Hoe om te betaal', queries: 'Navrae', nothing: 'Niks op hierdie rekening in hierdie tydperk nie.', subject: 'Rekeningstaat',
    broughtForward: 'Saldo oorgebring', invoice: 'Faktuur', receipt: 'Betaling ontvang', payment: 'Betaling', creditUsed: 'Krediet gebruik',
    paymentReversed: 'Betaling van faktuur afgehaal', receiptReversed: 'Terugboeking van betaling', creditNote: 'Kredietnota', writeOff: 'Afskrywing',
    journal: 'Regstelling', shortfall: 'Tekort na pasiënt oorgedra', refund: 'Terugbetaling', adjustmentReversed: 'Aansuiwering teruggedraai',
    layBye: 'Lay-bye: hierdie rekening word afbetaal soos ooreengekom. Niks daarop is agterstallig nie; die saldo is wat nog betaal moet word.',
    discount: 'Afslag', authorisation: 'magtiging', authorisations: 'magtigings',
    settledLeftOff: 'Betaalde fakture, en die betalings daarop, word nie op hierdie staat gewys nie.'
  }
};

const AGE_LABELS: Record<StatementLanguage, string[]> = {
  en: AGE_BANDS.map(band => band.label),
  af: ['Huidig', '30 dae', '60 dae', '90 dae', '120 dae', '150 dae', '180+ dae']
};

const KIND_WORD: Record<StatementLine['kind'], string> = {
  opening: 'broughtForward', invoice: 'invoice', receipt: 'receipt', payment: 'payment', credit_used: 'creditUsed', payment_reversed: 'paymentReversed',
  receipt_reversed: 'receiptReversed', credit_note: 'creditNote', write_off: 'writeOff', journal: 'journal', shortfall_transfer: 'shortfall', refund: 'refund',
  adjustment_reversed: 'adjustmentReversed', discount: 'discount'
};

/**
 * A line's details in the statement's language. English keeps the full sentence buildStatement
 * wrote (method, fund, reason); Afrikaans says what the line is and its document number, with the
 * patient's name on family statements.
 */
export function lineDetails(line: StatementLine, language: StatementLanguage, patientLabel?: string | null): string {
  if (language === 'en') return line.description;
  const words = WORDS.af;
  const label = words[KIND_WORD[line.kind]];
  const who = patientLabel ? ` (${patientLabel})` : '';
  // A payment says which invoice lines it covered (codes read the same in both languages)
  const covered = line.covered ? `, ${words.for} ${line.covered}` : '';
  // An invoice says the funds' authorisation numbers on its lines (parity D15)
  const numbers = line.authorisations ?? [];
  const authorised = numbers.length > 0 ? `, ${numbers.length === 1 ? words.authorisation : words.authorisations} ${numbers.join(', ')}` : '';
  return line.reference ? `${label} ${line.reference}${who}${authorised}${covered}` : label;
}

export interface StatementAccount {
  /** The account holder (who pays) */
  holderId: string;
  holderName: string;
  /** Every patient on the account (the holder included when they owe something) */
  memberIds: readonly string[];
  patientNames: Readonly<Record<string, string>>;
  reference: string | null;
  language: StatementLanguage;
  /** Flagged "Lay-bye": paid off as agreed, so the statement says so instead of showing what is overdue */
  layBye?: boolean;
  /** The account's own message, printed on every statement of it (the "Statement message" flag; parity I8) */
  message?: string | null;
}

export interface StatementEntries {
  invoices: readonly LedgerInvoice[];
  balances: Readonly<Record<string, ArInvoiceBalance>>;
  receipts: readonly ArReceipt[];
  allocations: readonly ArAllocation[];
  adjustments: readonly ArAdjustment[];
  /** Invoice id -> the funds' authorisation numbers on its lines (parity D15); absent when they could not be read */
  authorisations?: Readonly<Record<string, readonly string[]>>;
}

export interface AccountStatement {
  statement: Statement;
  /** What each band owes (patient and medical aid portions together), from the account's invoices */
  ages: BandCents;
  /** Invoice number -> patient name, on family statements */
  patientOfInvoice: Record<string, string>;
  /** How many settled invoices were left off (parity D26; 0 when they are shown) */
  settledLeftOff?: number;
}

/** The statement of one account from the entries of its patients; settled items left off when asked (parity D26) */
export function accountStatement(account: StatementAccount, entries: StatementEntries, options: { fromKey: string | null; asAtKey: string; leaveSettledOff?: boolean }): AccountStatement {
  const members = new Set([account.holderId, ...account.memberIds]);
  const family = members.size > 1;
  const invoices = entries.invoices.filter(invoice => invoice.patientId !== null && members.has(invoice.patientId));
  const patientOfInvoice: Record<string, string> = {};
  const statementInvoices: StatementInvoice[] = invoices.map(invoice => {
    const name = (invoice.patientId && account.patientNames[invoice.patientId]) || '';
    if (family && name) patientOfInvoice[invoice.invoiceNumber] = name;
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dateKey: invoiceDateKey(invoice),
      billed: entries.balances[invoice.id]?.billed ?? billedPortions(invoice),
      cancelled: invoice.status === 'cancelled',
      patientLabel: family ? name || null : null,
      authorisations: entries.authorisations?.[invoice.id] ?? []
    };
  });
  const invoiceIds = new Set(invoices.map(invoice => invoice.id));
  const receiptIds = new Set(entries.receipts.filter(receipt => receipt.patientId && members.has(receipt.patientId)).map(receipt => receipt.id));
  const input: StatementInput = {
    patientId: account.holderId,
    memberIds: [...members].filter(id => id !== account.holderId),
    invoices: statementInvoices,
    receipts: entries.receipts.filter(receipt => receiptIds.has(receipt.id) || entries.allocations.some(a => a.receiptId === receipt.id && invoiceIds.has(a.invoiceId))),
    allocations: entries.allocations.filter(allocation => invoiceIds.has(allocation.invoiceId) || receiptIds.has(allocation.receiptId)),
    adjustments: entries.adjustments.filter(adjustment => (adjustment.invoiceId && invoiceIds.has(adjustment.invoiceId)) || (adjustment.receiptId && receiptIds.has(adjustment.receiptId)))
  };
  // Settled invoices and what settled them add up to nothing, so leaving them off keeps every balance (settledItems.ts)
  const settled = options.leaveSettledOff ? leaveSettledOff(input, settledInvoiceIds(statementInvoices, entries.balances)) : null;
  const statement = buildStatement(settled?.input ?? input, { fromKey: options.fromKey });

  // The same rules as the aging report: what each invoice still owes, in the band of its age
  const ages = zeroBands();
  for (const invoice of invoices) {
    const owed = owedPortions(invoice, entries.balances[invoice.id]);
    const cents = owed.medical_aid + owed.patient;
    if (cents > 0) ages[ageBandFor(invoiceAgeDays(invoice, options.asAtKey))] += cents;
  }
  return { statement, ages, patientOfInvoice, settledLeftOff: settled?.invoicesLeftOff ?? 0 };
}

export interface StatementMeta {
  practiceName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  payment: PaymentDetails | null;
  asAtKey: string;
  /** The statement run's message (empty: none) */
  message: string;
  /** The practice's own message on its statements (parity D22; documentSettings.ts) */
  practiceMessage?: string | null;
  /** A VAT-registered practice's VAT number line (vat.ts vatStatementNote) */
  vatNote?: string | null;
}

/** The notices at the top of a statement: the run's message, then the account's own, then the lay-bye note */
export function statementNotices(account: Pick<StatementAccount, 'language' | 'layBye' | 'message'>, meta: Pick<StatementMeta, 'message'>): string[] {
  return [meta.message.trim(), account.message?.trim() ?? '', account.layBye ? WORDS[account.language].layBye : ''].filter(Boolean);
}

/** The lines at the foot of a statement: that settled items are left off, then the practice's message */
export function statementFootnotes(account: Pick<StatementAccount, 'language'>, built: Pick<AccountStatement, 'settledLeftOff'>, meta: Pick<StatementMeta, 'practiceMessage' | 'vatNote'>): string[] {
  return [(built.settledLeftOff ?? 0) > 0 ? WORDS[account.language].settledLeftOff : '', meta.practiceMessage?.trim() ?? '', meta.vatNote?.trim() ?? ''].filter(Boolean);
}

const STYLE = `body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px;max-width:760px}
h1{font-size:22px;margin:0}h2{font-size:14px;margin:20px 0 8px;color:#374151}.muted{color:#6B7280;font-size:12px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:5px 7px;border-bottom:1px solid #E5E7EB;text-align:left}
th{background:#F9FAFB;color:#4B5563;font-size:10px;text-transform:uppercase;letter-spacing:.04em}.num{text-align:right;font-variant-numeric:tabular-nums}
.message{margin:16px 0;padding:10px 12px;border-left:3px solid #0891B2;background:#ECFEFF;font-size:13px}.due{font-size:18px;font-weight:700}
.statement+.statement{page-break-before:always;margin-top:0}`;

/** The body of one statement (shared by a single print, a batch print and the email) */
export function statementSection(account: StatementAccount, built: AccountStatement, meta: StatementMeta): string {
  const words = WORDS[account.language];
  const money = (cents: number) => (cents === 0 ? '' : escapeHtml(formatNad(fromCents(cents))));
  const names = [...new Set([account.holderId, ...account.memberIds])].map(id => account.patientNames[id]).filter(Boolean);
  const invoiceOf = (line: StatementLine) => (line.kind === 'invoice' ? built.patientOfInvoice[line.reference] ?? null : null);
  const rows = built.statement.lines.length === 0
    ? `<tr><td colspan="5" class="muted">${escapeHtml(words.nothing)}</td></tr>`
    : built.statement.lines.map(line => `<tr><td>${escapeHtml(statementDate(line.dateKey, account.language))}</td><td>${escapeHtml(lineDetails(line, account.language, invoiceOf(line)))}</td>`
      + `<td class="num">${money(line.medicalAid)}</td><td class="num">${money(line.patient)}</td><td class="num">${escapeHtml(formatNad(fromCents(line.balance.total)))}</td></tr>`).join('');
  const ageHead = AGE_LABELS[account.language].map(label => `<th class="num">${escapeHtml(label)}</th>`).join('');
  const ageCells = AGE_BANDS.map(band => `<td class="num">${escapeHtml(formatNad(fromCents(built.ages[band.key])))}</td>`).join('');
  const closing = built.statement.closing;
  const pay = paymentDetailsText(meta.payment, account.reference, account.language);
  return `<div class="statement">
<h1>${escapeHtml(meta.practiceName)}</h1>
<p class="muted">${escapeHtml(words.statement)} ${escapeHtml(words.for)} ${escapeHtml(account.holderName)}, ${escapeHtml(words.asAt)} ${escapeHtml(statementDate(meta.asAtKey, account.language))}${account.reference ? ` · ${escapeHtml(words.reference)} ${escapeHtml(account.reference)}` : ''}</p>
${names.length > 1 ? `<p class="muted">${escapeHtml(words.patients)}: ${escapeHtml(names.join(', '))}</p>` : ''}
${statementNotices(account, meta).map(notice => `<p class="message">${escapeHtml(notice)}</p>`).join('\n')}
<table><thead><tr><th>${escapeHtml(words.date)}</th><th>${escapeHtml(words.details)}</th><th class="num">${escapeHtml(words.medicalAid)}</th><th class="num">${escapeHtml(words.patient)}</th><th class="num">${escapeHtml(words.balance)}</th></tr></thead><tbody>${rows}</tbody></table>
${account.layBye ? '' : `<h2>${escapeHtml(words.ageOfDebt)}</h2>
<table><thead><tr>${ageHead}</tr></thead><tbody><tr>${ageCells}</tr></tbody></table>`}
<h2>${escapeHtml(words.balance)}</h2>
<table>
<tr><td class="muted">${escapeHtml(words.medicalAidOwes)}</td><td class="num">${escapeHtml(formatNad(fromCents(closing.medicalAid)))}</td></tr>
<tr><td class="muted">${escapeHtml(words.patientOwes)}</td><td class="num">${escapeHtml(formatNad(fromCents(closing.patient)))}</td></tr>
${closing.credit > 0 ? `<tr><td class="muted">${escapeHtml(words.credit)}</td><td class="num">-${escapeHtml(formatNad(fromCents(closing.credit)))}</td></tr>` : ''}
<tr><td class="due">${escapeHtml(words.amountDue)}</td><td class="num due">${escapeHtml(formatNad(fromCents(closing.total)))}</td></tr>
</table>
${pay ? `<h2>${escapeHtml(words.howToPay)}</h2><p>${escapeHtml(pay)}</p>` : ''}
${meta.contactPhone || meta.contactEmail ? `<p class="muted">${escapeHtml(words.queries)}: ${escapeHtml([meta.contactPhone, meta.contactEmail].filter(Boolean).join(' · '))}</p>` : ''}
${statementFootnotes(account, built, meta).map(line => `<p class="muted">${escapeHtml(line)}</p>`).join('\n')}
</div>`;
}

/** Statements in one printable document, one per page */
export function statementsHtml(sections: readonly string[], title: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>${STYLE}</style></head><body>${sections.join('\n')}</body></html>`;
}

/** The statement as an email: the document as the body, the balance in the plain-text part */
export function statementEmail(account: StatementAccount, built: AccountStatement, meta: StatementMeta): { subject: string; html: string; text: string } {
  const words = WORDS[account.language];
  const pay = paymentDetailsText(meta.payment, account.reference, account.language);
  return {
    subject: `${words.subject}: ${meta.practiceName}`,
    html: statementsHtml([statementSection(account, built, meta)], `${words.subject} ${account.holderName}`),
    text: `${meta.practiceName}: ${words.statement.toLowerCase()} ${words.asAt} ${statementDate(meta.asAtKey, account.language)}. ${words.amountDue}: ${formatNad(fromCents(built.statement.closing.total))}.${pay ? ` ${pay}` : ''}`
  };
}

/** The statement's words in its language and the age-band headings, for the emailed PDF (debtors/statementPdf.ts) */
export const statementWords = (language: StatementLanguage): Readonly<Record<string, string>> => WORDS[language];
export const statementAgeLabels = (language: StatementLanguage): readonly string[] => AGE_LABELS[language];
