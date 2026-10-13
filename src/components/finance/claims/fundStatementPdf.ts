/**
 * The statement of outstanding claims (fundStatement.ts) as a PDF on the practice letterhead, to email to the fund
 * (parity F22): the same figures, words and order as the printed statement, drawn by receipts/documentPdf.ts. Pure.
 */
import { AGE_BANDS, UNKNOWN_SCHEME } from '../../../services/ledgerService';
import { formatServiceDate } from '../../../utils/billing/dates';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { practiceLinesOf } from '../../../utils/clinical/letters';
import type { PracticeLetterhead } from '../../quotes/quotePdf';
import type { FinanceDocumentPdf } from '../receipts/documentPdf';
import { batchHeading, type FundStatement } from './fundStatement';

const money = (cents: number): string => formatNad(fromCents(cents));
const fileSafe = (value: string): string => value.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'fund';

export const fundName = (statement: Pick<FundStatement, 'fund'>): string => (statement.fund === UNKNOWN_SCHEME ? 'Fund not recorded' : statement.fund);

export function fundStatementPdfModel(statement: FundStatement, asOfKey: string, letterhead: PracticeLetterhead): FinanceDocumentPdf {
  const codes = statement.fundCodes.length > 0 ? ` (${statement.fundCodes.join(', ')})` : '';
  return {
    practiceName: letterhead.name,
    practiceLines: practiceLinesOf(letterhead),
    primaryColor: letterhead.primaryColor,
    title: 'STATEMENT OF OUTSTANDING CLAIMS',
    number: null,
    meta: [`As at ${formatServiceDate(asOfKey)}`],
    intro: [`${fundName(statement)}${codes}`, 'Claims sent to the fund that it has not paid, credited or written off'],
    notices: [],
    facts: [
      { label: 'Practice', value: `${letterhead.name}${letterhead.practiceNumber ? ` (practice number ${letterhead.practiceNumber})` : ''}` },
      { label: 'Claims', value: String(statement.claimCount) },
      { label: 'Oldest', value: statement.oldestAgeDays === null ? '-' : `${statement.oldestAgeDays} days` },
      { label: 'Total outstanding', value: money(statement.owedCents) }
    ],
    tables: [
      {
        heading: 'By age (days since the invoice date)',
        columns: AGE_BANDS.map(band => ({ title: band.label, right: true })),
        rows: [AGE_BANDS.map(band => money(statement.byAgeBand[band.key]))]
      },
      {
        heading: 'Claims by batch',
        columns: [
          { title: 'Patient' },
          { title: 'Invoice', width: 30 },
          { title: 'Date of service', width: 28 },
          { title: 'Age (days)', right: true, width: 20 },
          { title: 'Owed', right: true, width: 28 }
        ],
        rows: statement.batches.flatMap(batch => [
          [batchHeading(batch), '', '', '', money(batch.owedCents)],
          ...batch.lines.map(line => [line.patientName, line.invoiceNumber, formatServiceDate(line.serviceDate), line.ageDays === null ? '-' : String(line.ageDays), money(line.owedCents)])
        ]),
        emptyText: 'No claim is outstanding.'
      }
    ],
    totals: [{ label: `${statement.claimCount} claim(s) outstanding`, value: money(statement.owedCents), bold: true }],
    paragraphs: [
      { heading: null, text: 'Ages count the days since the invoice date. Amounts are what the fund still owes on each invoice after its payments, credit notes and write-offs.' }
    ],
    footer: letterhead.name,
    fileName: `outstanding-claims-${fileSafe(fundName(statement))}-${asOfKey}.pdf`
  };
}
