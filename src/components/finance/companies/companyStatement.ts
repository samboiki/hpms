/**
 * A company or fund account's statement (parity A14, A19): every invoice billed to it with the employee's name and,
 * for an injury or accident case, the case's details (claim number, date of the injury), the account's payments, the
 * running balance and what it owes by age. The account pays all of each invoice, so the document has one amount
 * column; the lines and the age bands come from the same builders as the patients' statements (arStatement,
 * accountStatement), so the two never count differently. Pure: the screen prints it.
 */
import { formatNad, fromCents } from '../../../utils/billing/money';
import { AGE_BANDS, invoiceDateKey, owedPortions, paymentDetailsText, statementDate, toCents, type PaymentDetails } from '../../../services/ledgerService';
import { escapeHtml } from '../financeExport';
import { accountStatement, statementsHtml, type AccountStatement, type StatementAccount } from '../debtors/statementDocument';
import { payerRowKey, type PayerAccount } from '../../../utils/accounts/payerAccounts';
import { caseDetails, caseTitle, type InjuryCase } from '../../../utils/accounts/injuryCases';
import type { AccountLedger } from '../../../services/payerAccountService';

export type CompanyLedger = Pick<AccountLedger, 'invoices' | 'balances' | 'receipts' | 'allocations' | 'adjustments' | 'accountReceiptIds' | 'patientNames'>;

/** One invoice billed to the account, as its sheet lists it */
export interface CompanyInvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  dateKey: string | null;
  patientId: string | null;
  patientName: string;
  /** "Injury on duty, 10 Oct 2026" for an invoice of a case */
  caseTitle: string | null;
  /** "Employer …, employee no …, claim no …" for an invoice of a case */
  caseDetails: string | null;
  totalCents: number;
  /** What it still owes (both portions: the account pays all of it) */
  owedCents: number;
  cancelled: boolean;
}

/** The account's invoices, oldest first, with what each still owes and the case it was billed under */
export function companyInvoiceRows(
  ledger: Pick<AccountLedger, 'invoices' | 'balances' | 'caseOfVisit' | 'patientNames'>,
  cases: readonly InjuryCase[],
  accountNames: Readonly<Record<string, string>>
): CompanyInvoiceRow[] {
  const caseById = new Map(cases.map(item => [item.id, item]));
  return ledger.invoices
    .map(invoice => {
      const owed = owedPortions(invoice, ledger.balances[invoice.id]);
      const injuryCase = invoice.visitId ? caseById.get(ledger.caseOfVisit[invoice.visitId] ?? '') : undefined;
      const cancelled = invoice.status === 'cancelled';
      return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        dateKey: invoiceDateKey(invoice),
        patientId: invoice.patientId,
        patientName: (invoice.patientId && ledger.patientNames[invoice.patientId]) || 'Patient',
        caseTitle: injuryCase ? caseTitle(injuryCase) : null,
        caseDetails: injuryCase ? caseDetails(injuryCase, accountNames) : null,
        totalCents: toCents(invoice.total),
        owedCents: cancelled ? 0 : Math.max(owed.medical_aid, 0) + Math.max(owed.patient, 0),
        cancelled
      };
    })
    .sort((a, b) => (a.dateKey ?? '').localeCompare(b.dateKey ?? '') || a.invoiceNumber.localeCompare(b.invoiceNumber));
}

/** Invoice number -> the case's title and details, for the statement */
export const caseNotesOf = (rows: readonly CompanyInvoiceRow[]): Record<string, string> =>
  Object.fromEntries(rows.filter(row => row.caseTitle).map(row => [row.invoiceNumber, `${row.caseTitle}. ${row.caseDetails ?? ''}`.trim()]));

/**
 * The statement of an account. Its own receipts are the payments it made; a payment by anyone else on one of its
 * invoices (an employee who paid part) shows as a payment on that invoice, never as the account's money.
 */
export function companyStatement(
  account: Pick<PayerAccount, 'id' | 'name' | 'accountNumber'>,
  ledger: CompanyLedger,
  options: { fromKey: string | null; asAtKey: string }
): AccountStatement {
  const holderId = payerRowKey(account.id);
  const employees = [...new Set(ledger.invoices.map(invoice => invoice.patientId).filter((id): id is string => Boolean(id)))];
  const receipts = ledger.receipts.map(receipt => ({ ...receipt, patientId: ledger.accountReceiptIds.has(receipt.id) ? holderId : null }));
  const statementAccount: StatementAccount = {
    holderId,
    holderName: account.name,
    memberIds: employees,
    patientNames: ledger.patientNames,
    reference: account.accountNumber || null,
    language: 'en'
  };
  return accountStatement(
    statementAccount,
    { invoices: ledger.invoices, balances: ledger.balances, receipts, allocations: ledger.allocations, adjustments: ledger.adjustments },
    options
  );
}

export interface CompanyStatementMeta {
  practiceName: string;
  contactPhone: string | null;
  contactEmail: string | null;
  payment: PaymentDetails | null;
  asAtKey: string;
}

/** The statement as a printable page. caseOfInvoice: invoice number -> the case's details, for invoices of a case */
export function companyStatementHtml(
  account: Pick<PayerAccount, 'name' | 'accountNumber' | 'contactName' | 'postalAddress' | 'town'>,
  built: AccountStatement,
  meta: CompanyStatementMeta,
  caseOfInvoice: Readonly<Record<string, string>> = {}
): string {
  const money = (cents: number) => escapeHtml(formatNad(fromCents(cents)));
  const rows = built.statement.lines.length === 0
    ? '<tr><td colspan="4" class="muted">Nothing on this account in this period.</td></tr>'
    : built.statement.lines
        .map(line => {
          const details = line.kind === 'invoice' && caseOfInvoice[line.reference] ? `${line.description}. ${caseOfInvoice[line.reference]}` : line.description;
          const amount = line.medicalAid + line.patient;
          return `<tr><td>${escapeHtml(statementDate(line.dateKey))}</td><td>${escapeHtml(details)}</td><td class="num">${amount === 0 ? '' : money(amount)}</td><td class="num">${money(line.balance.total)}</td></tr>`;
        })
        .join('');
  const address = [account.contactName ? `Attention: ${account.contactName}` : '', account.postalAddress ?? '', account.town ?? ''].filter(Boolean);
  const closing = built.statement.closing;
  const pay = paymentDetailsText(meta.payment, account.accountNumber || null);
  const section = `<div class="statement">
<h1>${escapeHtml(meta.practiceName)}</h1>
<p class="muted">Statement of account for ${escapeHtml(account.name)}, as at ${escapeHtml(statementDate(meta.asAtKey))}${account.accountNumber ? ` · Account ${escapeHtml(account.accountNumber)}` : ''}</p>
${address.length > 0 ? `<p class="muted">${address.map(escapeHtml).join('<br>')}</p>` : ''}
<table><thead><tr><th>Date</th><th>Details</th><th class="num">Amount</th><th class="num">Balance</th></tr></thead><tbody>${rows}</tbody></table>
<h2>What is owed, by age</h2>
<table><thead><tr>${AGE_BANDS.map(band => `<th class="num">${escapeHtml(band.label)}</th>`).join('')}</tr></thead><tbody><tr>${AGE_BANDS.map(band => `<td class="num">${money(built.ages[band.key])}</td>`).join('')}</tr></tbody></table>
<h2>Balance</h2>
<table>
${closing.credit > 0 ? `<tr><td class="muted">Paid and not yet used on an invoice</td><td class="num">-${money(closing.credit)}</td></tr>` : ''}
<tr><td class="due">Amount due</td><td class="num due">${money(closing.total)}</td></tr>
</table>
${pay ? `<h2>How to pay</h2><p>${escapeHtml(pay)}</p>` : ''}
${meta.contactPhone || meta.contactEmail ? `<p class="muted">Queries: ${escapeHtml([meta.contactPhone, meta.contactEmail].filter(Boolean).join(' · '))}</p>` : ''}
</div>`;
  return statementsHtml([section], `Statement ${account.name}`);
}
