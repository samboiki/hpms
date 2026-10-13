/**
 * A statement of account as a PDF on the practice letterhead, to email as an attachment: the same lines, words and
 * language (English or Afrikaans) as the printed statement (statementDocument.ts statementSection), drawn by
 * receipts/documentPdf.ts. Pure: no network.
 */
import { formatNad, fromCents } from '../../../utils/billing/money';
import { practiceLinesOf } from '../../../utils/clinical/letters';
import { AGE_BANDS, paymentDetailsText, statementDate, type StatementLine } from '../../../services/ledgerService';
import type { PracticeLetterhead } from '../../quotes/quotePdf';
import type { FinanceDocumentPdf } from '../receipts/documentPdf';
import { lineDetails, statementAgeLabels, statementFootnotes, statementNotices, statementWords, type AccountStatement, type StatementAccount, type StatementMeta } from './statementDocument';

const money = (cents: number): string => formatNad(fromCents(cents));
const capitalised = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const fileSafe = (value: string): string => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'account';

export function statementPdfModel(account: StatementAccount, built: AccountStatement, meta: StatementMeta, letterhead: PracticeLetterhead): FinanceDocumentPdf {
  const words = statementWords(account.language);
  const asAt = statementDate(meta.asAtKey, account.language);
  const names = [...new Set([account.holderId, ...account.memberIds])].map(id => account.patientNames[id]).filter(Boolean);
  const invoiceOf = (line: StatementLine) => (line.kind === 'invoice' ? built.patientOfInvoice[line.reference] ?? null : null);
  const closing = built.statement.closing;
  const pay = paymentDetailsText(meta.payment, account.reference, account.language);
  const contact = [meta.contactPhone, meta.contactEmail].filter(Boolean).join(' · ');
  return {
    practiceName: meta.practiceName || letterhead.name,
    practiceLines: practiceLinesOf(letterhead),
    primaryColor: letterhead.primaryColor,
    title: words.statement.toUpperCase(),
    number: account.reference ? `${words.reference} ${account.reference}` : null,
    meta: [`${capitalised(words.asAt)} ${asAt}`],
    intro: [
      `${words.statement} ${words.for} ${account.holderName}`,
      ...(names.length > 1 ? [`${words.patients}: ${names.join(', ')}`] : [])
    ],
    // The run's message, the account's own message and the lay-bye note, as on the printed statement
    notices: statementNotices(account, meta),
    facts: [],
    tables: [
      {
        heading: null,
        columns: [
          { title: words.date, width: 24 },
          { title: words.details },
          { title: words.medicalAid, right: true, width: 26 },
          { title: words.patient, right: true, width: 26 },
          { title: words.balance, right: true, width: 28 }
        ],
        rows: built.statement.lines.map(line => [
          statementDate(line.dateKey, account.language),
          lineDetails(line, account.language, invoiceOf(line)),
          line.medicalAid === 0 ? '' : money(line.medicalAid),
          line.patient === 0 ? '' : money(line.patient),
          money(line.balance.total)
        ]),
        emptyText: words.nothing
      },
      // Paid off as agreed: nothing on a lay-bye account is overdue, so its age is not shown
      ...(account.layBye
        ? []
        : [
            {
              heading: words.ageOfDebt,
              columns: statementAgeLabels(account.language).map(label => ({ title: label, right: true })),
              rows: [AGE_BANDS.map(band => money(built.ages[band.key]))]
            }
          ])
    ],
    totals: [
      { label: words.medicalAidOwes, value: money(closing.medicalAid) },
      { label: words.patientOwes, value: money(closing.patient) },
      ...(closing.credit > 0 ? [{ label: words.credit, value: `-${money(closing.credit)}` }] : []),
      { label: words.amountDue, value: money(closing.total), bold: true }
    ],
    paragraphs: [
      ...(pay ? [{ heading: words.howToPay, text: pay }] : []),
      ...(contact ? [{ heading: null, text: `${words.queries}: ${contact}` }] : []),
      // That settled items are left off, and the practice's own message (parity D26, D22)
      ...statementFootnotes(account, built, meta).map(text => ({ heading: null, text }))
    ],
    footer: meta.practiceName || letterhead.name,
    fileName: `statement-${fileSafe(account.holderName)}-${meta.asAtKey}.pdf`
  };
}
