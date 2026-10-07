import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { formatDoctorName } from '../../utils/formatDoctorName';
import {
  hasUnrecognisedStatus,
  isOutstandingInvoice,
  normalizePaymentMethod,
  splitByFunder,
  sumAmounts,
  type LedgerInvoice,
  type LedgerLineItem
} from '../../services/ledgerService';
import { fetchInvoiceLineItems } from './financeData';
import { FUNDER_META, INVOICE_STATUS_META, PAYMENT_METHOD_META } from './financeTheme';
import { describeInvoiceAge, formatCount, formatDateKey, formatNad, formatTimestamp } from './financeFormat';
import { downloadCsv, exportFileName, toCsv } from './financeExport';
import { ActionButton, LoadingState, Notice } from './FinanceUI';

interface InvoiceDetailModalProps {
  invoice: LedgerInvoice | null;
  patientName: string;
  doctorName: string | null;
  scheme: string | null;
  todayKey: string;
  onClose: () => void;
}

const Fact: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500">{label}</p>
    <p className="text-sm font-medium text-gray-900 mt-0.5 break-words">{value}</p>
  </div>
);

/** Read-only invoice drill-down: facts, funder split and line items, with a link to the patient's billing */
export const InvoiceDetailModal: React.FC<InvoiceDetailModalProps> = ({ invoice, patientName, doctorName, scheme, todayKey, onClose }) => {
  const navigate = useNavigate();
  const [lines, setLines] = useState<LedgerLineItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const invoiceId = invoice?.id ?? null;

  const loadLines = useCallback(async () => {
    if (!invoiceId) return;
    setLines(null);
    setError(null);
    try {
      const result = await fetchInvoiceLineItems(invoiceId);
      setLines(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the invoice lines');
    }
  }, [invoiceId]);

  useEffect(() => {
    void loadLines();
  }, [loadLines]);

  if (!invoice) return null;

  const split = splitByFunder(invoice);
  const status = INVOICE_STATUS_META[invoice.status];
  const lineTotal = lines ? sumAmounts(lines.map(line => line.total)) : 0;
  const method = PAYMENT_METHOD_META[normalizePaymentMethod(invoice.paymentMethod)];

  const exportLines = () => {
    if (!lines) return;
    const csv = toCsv(
      [
        { header: 'Invoice', type: 'text' },
        { header: 'Code', type: 'text' },
        { header: 'Description', type: 'text' },
        { header: 'Quantity', type: 'count' },
        { header: 'Unit price', type: 'money' },
        { header: 'Medical aid', type: 'money' },
        { header: 'Patient', type: 'money' },
        { header: 'Line total', type: 'money' }
      ],
      lines.map(line => [invoice.invoiceNumber, line.code, line.description, line.quantity, line.unitPrice, line.medicalAid, line.patient, line.total])
    );
    downloadCsv(exportFileName(`invoice ${invoice.invoiceNumber} lines`), csv);
  };

  return (
    <Dialog open={!!invoice} onOpenChange={open => { if (!open) onClose(); }}>
      {/* Bottom sheet on phones (up to the full height), centred dialog from sm; the actions stay in view */}
      <DialogContent className="max-w-3xl self-end sm:self-auto sm:mx-4 max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="flex flex-wrap items-center gap-3 text-xl text-gray-900">
            <Icon icon="solar:document-text-bold-duotone" className="w-6 h-6 text-cyan-600" aria-hidden="true" />
            Invoice {invoice.invoiceNumber}
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${status.badge}`}>
              {status.label}{hasUnrecognisedStatus(invoice) ? ` (stored as "${invoice.rawStatus}")` : ''}
            </span>
          </DialogTitle>
          <p className="text-sm text-gray-500">{patientName}</p>
        </DialogHeader>

        <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-4">
          <Fact label="Issued" value={formatDateKey(invoice.issueDate)} />
          <Fact label="Due" value={formatDateKey(invoice.dueDate)} />
          <Fact label="Status" value={describeInvoiceAge(invoice, todayKey)} />
          <Fact label="Doctor" value={formatDoctorName(doctorName)} />
          <Fact label="Medical aid fund" value={scheme ?? 'Not recorded'} />
          <Fact label="Payment method" value={invoice.status === 'paid' ? method.label : 'Not paid yet'} />
          <Fact label="Claim batch" value={invoice.batchId ? 'Included in a claim batch' : 'Not in a batch'} />
          <Fact label="Last updated" value={formatTimestamp(invoice.updatedAt)} />
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {(['medical_aid', 'patient'] as const).map(funder => (
            <div key={funder} className={`p-3 rounded-lg ${FUNDER_META[funder].tint}`}>
              <p className="text-xs text-gray-600 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: FUNDER_META[funder].color }} aria-hidden="true" />
                {FUNDER_META[funder].label} {isOutstandingInvoice(invoice) ? 'owes' : 'portion'}
              </p>
              <p className="text-lg font-bold text-gray-900">{formatNad(funder === 'medical_aid' ? split.medicalAid : split.patient)}</p>
            </div>
          ))}
          <div className="p-3 rounded-lg bg-gray-50">
            <p className="text-xs text-gray-600">Invoice total</p>
            <p className="text-lg font-bold text-gray-900">{formatNad(invoice.total)}</p>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-2">Services billed</h3>
          {error && (
            <Notice tone="error" title="Line items could not be loaded" action={<ActionButton icon="solar:refresh-bold-duotone" label="Retry" onClick={() => void loadLines()} />}>
              {error}
            </Notice>
          )}
          {!error && lines === null && <LoadingState label="Loading invoice lines" rows={2} />}
          {!error && lines !== null && lines.length === 0 && (
            <p className="text-sm text-gray-500 p-3 border border-dashed border-gray-200 rounded-lg">No line items are recorded for this invoice.</p>
          )}
          {!error && lines !== null && lines.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Code</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Description</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Qty</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Unit price</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Medical aid</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Patient</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {lines.map((line, index) => (
                    <tr key={`${line.code}-${index}`}>
                      <td className="px-3 py-2 font-mono text-cyan-700 whitespace-nowrap">{line.code || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{line.description || '—'}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCount(line.quantity)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatNad(line.unitPrice)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatNad(line.medicalAid)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatNad(line.patient)}</td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap font-medium text-gray-900">{formatNad(line.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50 font-semibold text-gray-900">
                  <tr>
                    <td className="px-3 py-2" colSpan={6}>Line items total</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{formatNad(lineTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {lines !== null && lines.length > 0 && Math.round(lineTotal * 100) !== Math.round(invoice.total * 100) && (
            <p className="text-xs text-amber-700 mt-2">
              The line items add up to {formatNad(lineTotal)} but the invoice total is {formatNad(invoice.total)} (tax or a manual adjustment).
            </p>
          )}
        </div>

        <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 px-6 py-4 bg-white border-t border-gray-100 flex flex-wrap items-center justify-end gap-2">
          <ActionButton icon="solar:download-minimalistic-bold-duotone" label="Lines CSV" onClick={exportLines} disabled={!lines || lines.length === 0} />
          {invoice.patientId && (
            <ActionButton
              variant="primary"
              icon="solar:user-id-bold-duotone"
              label="Open patient billing"
              title="Open this patient's Billing tab, where invoices are marked paid"
              onClick={() => {
                onClose();
                navigate(`/patients?patientId=${encodeURIComponent(invoice.patientId ?? '')}&tab=billing`);
              }}
            />
          )}
          <ActionButton icon="solar:close-circle-bold-duotone" label="Close" onClick={onClose} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
