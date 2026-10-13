import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { formatNad, fromCents, toCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { AGE_BANDS, UNKNOWN_SCHEME } from '../../../services/ledgerService';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { claimBatchLink, invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { printDocument } from '../receipts/receiptDocuments';
import { downloadCsv, exportFileName } from '../financeExport';
import { logReportExport } from '../practiceReports/practiceReportsService';
import type { FinanceWorkspace } from '../financeData';
import type { FinanceDerived } from '../deriveFinance';
import { ageBandLabel, batchHeading, buildFundStatements, fundStatementCsv, fundStatementHtml } from './fundStatement';
import FundStatementEmailSheet from './FundStatementEmailSheet';
import type { PracticeInfo } from './types';

/** The Finance page's figures (its workspace and what is derived from it), as the Overview shows them */
export interface FinanceFigures {
  workspace: FinanceWorkspace;
  derived: FinanceDerived;
  todayKey: string;
}

interface FundStatementSheetProps {
  practice: PracticeInfo;
  finance: FinanceFigures;
  onClose: () => void;
}

const nad = (cents: number) => formatNad(fromCents(cents));
const fundName = (fund: string) => (fund === UNKNOWN_SCHEME ? 'Fund not recorded' : fund);

/**
 * The statement of outstanding claims per fund (parity F22): what a medical aid still owes on the claims sent to it, by
 * batch and patient, with totals and ages; printed, downloaded or emailed to the fund (FundStatementEmailSheet). Its figures are the Overview's
 * "Claims sent, awaiting payment" (fundStatement.ts), and each batch, patient and invoice opens its own screen.
 */
const FundStatementSheet: React.FC<FundStatementSheetProps> = ({ practice, finance, onClose }) => {
  const { workspace, derived, todayKey } = finance;
  const statements = useMemo(
    () =>
      workspace.claimBatches.error
        ? null
        : buildFundStatements({
            aging: derived.aging,
            schemeByPatient: workspace.schemeByPatient,
            batches: workspace.claimBatches.rows,
            serviceDateByVisit: workspace.serviceDateByVisit,
            todayKey,
            patientNames: workspace.patientNames
          }),
    [workspace, derived.aging, todayKey]
  );
  const [chosen, setChosen] = useState<string | null>(null);
  const [printNote, setPrintNote] = useState<string | null>(null);
  // Email to the fund's claims address (parity F22)
  const [emailing, setEmailing] = useState(false);
  const statement = statements?.funds.find(fund => fund.fund === chosen) ?? statements?.funds[0] ?? null;
  const overviewCents = derived.fundDebtors ? toCents(derived.fundDebtors.totals.sent) : null;

  // Every print and download is recorded for "Who did what" (the fund codes only, never names or amounts)
  const record = (format: 'csv' | 'print') => {
    if (!statement) return;
    void logReportExport(practice.id, { report: 'fund_statement', format, range: null, rows: statement.claimCount, filters: { fund: statement.fundCodes.join(',') || null } });
  };

  const print = () => {
    if (!statement || !statements) return;
    const opened = printDocument(fundStatementHtml(statement, statements.asOfKey, { practiceName: practice.name, practiceNumber: practice.practice_number }));
    setPrintNote(opened ? null : 'The browser blocked the print window. Allow pop-ups for this site and try again.');
    if (opened) record('print');
  };

  const download = () => {
    if (!statement) return;
    downloadCsv(exportFileName(`Outstanding claims ${fundName(statement.fund)}`), fundStatementCsv(statement));
    record('csv');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="xl"
      title="Statement of outstanding claims"
      subtitle={`${statement ? `${fundName(statement.fund)}, as` : 'As'} at ${formatServiceDate(statements?.asOfKey ?? todayKey)}`}
      icon="solar:document-text-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <SecondaryButton icon="solar:download-minimalistic-bold-duotone" onClick={download} disabled={!statement}>Download CSV</SecondaryButton>
          <SecondaryButton icon="solar:letter-bold-duotone" onClick={() => setEmailing(true)} disabled={!statement}>Email to the fund</SecondaryButton>
          <PrimaryButton icon="solar:printer-bold-duotone" onClick={print} disabled={!statement}>Print statement</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {printNote && <ErrorBox>{printNote}</ErrorBox>}
        {statements === null ? (
          <ErrorBox>
            The claim batches could not be loaded ({workspace.claimBatches.error}), so the statement cannot be made. Refresh Finance and try again.
          </ErrorBox>
        ) : !statement ? (
          <div className="py-10 text-center text-gray-500">
            <Icon icon="solar:check-circle-bold-duotone" className="mx-auto mb-2 h-10 w-10 text-green-500" />
            No claim sent to a fund is waiting for payment.
          </div>
        ) : (
          <>
            {statements.funds.length > 1 && (
              <Field label="Fund" htmlFor="fund-statement-fund">
                <select id="fund-statement-fund" className={inputClass} value={statement.fund} onChange={event => setChosen(event.target.value)}>
                  {statements.funds.map(fund => (
                    <option key={fund.fund} value={fund.fund}>
                      {fundName(fund.fund)}: {nad(fund.owedCents)}
                    </option>
                  ))}
                </select>
              </Field>
            )}

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-3 sm:col-span-2">
                <MedicalAidLogo name={fundName(statement.fund)} size="md" />
                <div className="min-w-0">
                  <dt className="sr-only">Fund</dt>
                  <dd className="font-semibold text-gray-900">
                    {fundName(statement.fund)}
                    {statement.fundCodes.length > 0 ? ` (${statement.fundCodes.join(', ')})` : ''}
                  </dd>
                  <dd className="text-xs text-gray-500">{practice.name}{practice.practice_number ? `, practice number ${practice.practice_number}` : ''}</dd>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Claims</dt>
                <dd className="tabular-nums text-gray-900">{statement.claimCount}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Oldest</dt>
                <dd className="tabular-nums text-gray-900">{statement.oldestAgeDays === null ? '-' : `${statement.oldestAgeDays} days`}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Total outstanding</dt>
                <dd className="tabular-nums font-semibold text-gray-900">{nad(statement.owedCents)}</dd>
              </div>
            </dl>

            <section aria-labelledby="fund-statement-ages">
              <h3 id="fund-statement-ages" className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500">By age (days since the invoice date)</h3>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                {AGE_BANDS.map(band => (
                  <div key={band.key} className="flex justify-between gap-3">
                    <dt className="whitespace-nowrap text-gray-500">{band.label}</dt>
                    <dd className="whitespace-nowrap tabular-nums text-gray-900">{nad(statement.byAgeBand[band.key])}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {overviewCents !== null && (overviewCents === statements.totalCents ? (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 flex-none" aria-hidden="true" />
                All funds together: {nad(statements.totalCents)}, the same as &quot;Claims sent, awaiting payment&quot; on the Overview.
              </p>
            ) : (
              <ErrorBox>
                All funds together come to {nad(statements.totalCents)}, but the Overview shows {nad(overviewCents)}. Refresh Finance before giving this statement to the fund.
              </ErrorBox>
            ))}

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <caption className="sr-only">Outstanding claims of {fundName(statement.fund)}, by batch</caption>
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2">Patient</th>
                    <th scope="col" className="px-3 py-2">Invoice</th>
                    <th scope="col" className="px-3 py-2">Date of service</th>
                    <th scope="col" className="px-3 py-2 text-right">Age (days)</th>
                    <th scope="col" className="px-3 py-2 text-right">Owed</th>
                  </tr>
                </thead>
                {statement.batches.map(batch => (
                  <tbody key={batch.batchId} className="divide-y divide-gray-100 border-t border-gray-200">
                    <tr className="bg-gray-50">
                      <th scope="rowgroup" colSpan={4} className="px-3 py-2 text-left text-xs font-semibold text-gray-700">
                        {batch.readable ? (
                          <Link to={claimBatchLink(batch.batchId)} onClick={onClose} className="text-cyan-700 hover:underline" title="Open the batch">
                            {batchHeading(batch)}
                          </Link>
                        ) : (
                          batchHeading(batch)
                        )}
                      </th>
                      <td className="whitespace-nowrap px-3 py-2 text-right text-xs font-semibold tabular-nums text-gray-700">{nad(batch.owedCents)}</td>
                    </tr>
                    {batch.lines.map(line => (
                      <tr key={line.invoiceId}>
                        <td className="px-3 py-2">
                          {line.patientId ? (
                            <Link to={patientBillingLink(line.patientId)} onClick={onClose} className="text-cyan-700 hover:underline" title="Open the patient's file">
                              {line.patientName}
                            </Link>
                          ) : (
                            <span className="text-gray-900">{line.patientName}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <Link to={invoiceLink(line.invoiceId)} onClick={onClose} className="font-mono text-cyan-700 hover:underline" title="Open the invoice">
                            {line.invoiceNumber}
                          </Link>
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatServiceDate(line.serviceDate)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-gray-700" title={ageBandLabel(line.ageBand)}>{line.ageDays ?? '-'}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">{nad(line.owedCents)}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
                <tfoot className="border-t-2 border-gray-300 font-semibold">
                  <tr>
                    <td colSpan={4} className="px-3 py-2 text-gray-700">{statement.claimCount} claim(s)</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">{nad(statement.owedCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="text-xs text-gray-500">
              Amounts are what the fund still owes on each invoice after its payments, credit notes and write-offs: a claim leaves this statement once it is settled.
            </p>
          </>
        )}
      </div>
      {emailing && statement && statements && (
        <FundStatementEmailSheet practice={practice} statement={statement} asOfKey={statements.asOfKey} onClose={() => setEmailing(false)} />
      )}
    </Sheet>
  );
};

export default FundStatementSheet;
