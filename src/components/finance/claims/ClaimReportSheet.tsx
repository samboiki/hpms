import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { buildClaimFile, type ClaimFile } from '../../../utils/billing/claimFile';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { claimBatchLink, invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import { ErrorBox, PrimaryButton, SecondaryButton, Sheet } from '../receipts/ArUi';
import { printDocument } from '../receipts/receiptDocuments';
import { buildClaimLines } from './buildClaimLines';
import { loadBatchLineSources } from './claimsService';
import { buildClaimReport, claimFileHeaderOf, claimReportHtml, storedClaimFile } from './claimReport';
import type { BatchDetailRow, BatchHeaderRow, FundProvider, PracticeInfo } from './types';

interface ClaimReportSheetProps {
  practice: PracticeInfo;
  batch: BatchHeaderRow;
  fund: FundProvider | undefined;
  /** The file the preview shows; left out, the stored file is used, else the file built from the batch's lines */
  file?: ClaimFile;
  /** The batch's lines (for the patient and invoice links); loaded when left out */
  details?: BatchDetailRow[];
  onClose: () => void;
}

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * The per-file claim report: practice, fund, batch, file name, date sent, line count and total, then every line
 * with its patient and invoice (each a link), printable. Built on demand from the claim file, so it always matches
 * what was (or will be) sent.
 */
const ClaimReportSheet: React.FC<ClaimReportSheetProps> = ({ practice, batch, fund, file: givenFile, details: givenDetails, onClose }) => {
  const [loaded, setLoaded] = useState<{ file: ClaimFile; details: BatchDetailRow[] } | null>(
    givenFile && givenDetails ? { file: givenFile, details: givenDetails } : null
  );
  const [error, setError] = useState<string | null>(null);
  const [printNote, setPrintNote] = useState<string | null>(null);

  useEffect(() => {
    if (givenFile && givenDetails) {
      setLoaded({ file: givenFile, details: givenDetails });
      return;
    }
    let cancelled = false;
    loadBatchLineSources(batch, practice)
      .then(sources => {
        if (cancelled) return;
        const file = givenFile ?? storedClaimFile(batch) ?? buildClaimFile(claimFileHeaderOf(batch), buildClaimLines(sources, {}));
        setLoaded({ file, details: sources.details });
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'The batch lines could not be loaded.');
      });
    return () => {
      cancelled = true;
    };
  }, [batch, practice, givenFile, givenDetails]);

  const fundName = fund?.name ?? batch.medical_aid_reference;
  const report = useMemo(
    () =>
      loaded
        ? buildClaimReport({
            file: loaded.file,
            source: batch.generated_file_content && loaded.file.content === batch.generated_file_content ? 'sent_file' : 'batch_lines',
            practiceName: practice.name,
            fundName,
            fundCode: batch.medical_aid_reference,
            sentAt: batch.sent_at,
            details: loaded.details
          })
        : null,
    [loaded, batch, practice.name, fundName]
  );

  const print = () => {
    if (!report) return;
    setPrintNote(printDocument(claimReportHtml(report)) ? null : 'The browser blocked the print window. Allow pop-ups for this site and try again.');
  };

  return (
    <Sheet
      open
      onClose={onClose}
      size="xl"
      title={`Claim report: batch ${batch.batch_number}`}
      subtitle={report?.fileName ?? 'Loading the claim file...'}
      icon="solar:document-text-bold-duotone"
      footer={
        <>
          <SecondaryButton onClick={onClose}>Close</SecondaryButton>
          <PrimaryButton icon="solar:printer-bold-duotone" onClick={print} disabled={!report}>Print report</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        {printNote && <ErrorBox>{printNote}</ErrorBox>}
        {!report && !error && (
          <div className="space-y-2" role="status" aria-label="Loading the claim report">
            {[0, 1, 2].map(index => <div key={index} className="h-10 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />)}
          </div>
        )}
        {report && (
          <>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm sm:grid-cols-2">
              <div className="flex items-center gap-3 sm:col-span-2">
                <MedicalAidLogo name={fund?.name ?? batch.medical_aid_reference} size="md" />
                <div className="min-w-0">
                  <dt className="sr-only">Fund</dt>
                  <dd className="font-semibold text-gray-900">{fundName}</dd>
                  <dd className="text-xs text-gray-500">{practice.name}{report.practiceNumber ? `, practice number ${report.practiceNumber}` : ''}</dd>
                </div>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Batch</dt>
                <dd>
                  <Link to={claimBatchLink(batch.id)} onClick={onClose} className="font-medium text-cyan-700 hover:underline" title="Open the batch">
                    {report.batchNumber || batch.batch_number}
                  </Link>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Batch date</dt>
                <dd className="text-gray-900">{formatServiceDate(report.batchDate)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Date sent</dt>
                <dd className="text-gray-900">{report.sentOn ? formatServiceDate(report.sentOn) : 'Not sent yet'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-gray-500">Lines</dt>
                <dd className="tabular-nums text-gray-900">{report.lineCount}</dd>
              </div>
              <div className="flex justify-between gap-3 sm:col-span-2">
                <dt className="text-gray-500">Total claimed</dt>
                <dd className="tabular-nums font-semibold text-gray-900">{nad(report.totalCents)}</dd>
              </div>
            </dl>

            {report.matchesTrailer ? (
              <p className="flex items-center gap-2 text-sm text-green-700">
                <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4 flex-none" aria-hidden="true" />
                The lines and total agree with the count and total at the end of the file.
              </p>
            ) : (
              <ErrorBox>
                The lines do not agree with the count and total at the end of the file
                {report.trailer ? ` (${report.trailer.lineCount} lines, ${nad(report.trailer.totalCents)})` : ''}. Check the file before sending it again.
              </ErrorBox>
            )}
            <p className="text-xs text-gray-500">
              {report.source === 'sent_file'
                ? 'Built from the file exactly as it was sent to the fund.'
                : batch.sent_at
                  ? "The file that was sent was not kept; this report is built from the batch's lines as they are now."
                  : "Built from the batch's lines as they are now (the file has not been sent)."}
            </p>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <caption className="sr-only">Lines of claim file {report.fileName}</caption>
                <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-right">Line</th>
                    <th scope="col" className="px-3 py-2">Patient</th>
                    <th scope="col" className="px-3 py-2">Account</th>
                    <th scope="col" className="px-3 py-2">Date</th>
                    <th scope="col" className="px-3 py-2">Code</th>
                    <th scope="col" className="px-3 py-2">Invoice</th>
                    <th scope="col" className="px-3 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.lines.map(line => (
                    <tr key={`${line.lineNumber}-${line.invoiceNumber}`}>
                      <td className="px-3 py-2 text-right font-mono text-gray-600">{line.lineNumber}</td>
                      <td className="px-3 py-2">
                        {line.patientId ? (
                          <Link to={patientBillingLink(line.patientId)} onClick={onClose} className="text-cyan-700 hover:underline" title="Open the patient's file">
                            {line.patientName || 'Patient'}
                          </Link>
                        ) : (
                          <span className="text-gray-900">{line.patientName || '-'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono text-gray-700">{line.accountReference || '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatServiceDate(line.serviceDate)}</td>
                      <td className="px-3 py-2 font-mono text-gray-900">{line.tariffCode}</td>
                      <td className="px-3 py-2">
                        {line.invoiceId ? (
                          <Link to={invoiceLink(line.invoiceId)} onClick={onClose} className="font-mono text-cyan-700 hover:underline" title="Open the invoice">
                            {line.invoiceNumber}
                          </Link>
                        ) : (
                          <span className="font-mono text-gray-700">{line.invoiceNumber || '-'}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">{nad(line.amountCents)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t-2 border-gray-300 font-semibold">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-gray-700">{report.lineCount} line(s)</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-gray-900">{nad(report.totalCents)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
};

export default ClaimReportSheet;
