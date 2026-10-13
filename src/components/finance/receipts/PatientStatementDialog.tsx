import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import DateInput from '../../ui/DateInput';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  billedPortions,
  buildStatement,
  invoiceDateKey,
  leaveSettledOff,
  settledInvoiceIds,
  statementLineOpens,
  statementMessageOf,
  toDateKey,
  type ArReceipt,
  type StatementInput,
  type StatementInvoice,
  type StatementLine
} from '../../../services/ledgerService';
import { loadDocumentSettings } from '../../../services/documentSettingsService';
import { DEFAULT_DOCUMENT_SETTINGS, practiceMessageFor, type DocumentSettings } from '../../../utils/billing/documentSettings';
import { loadInvoiceAuthorisations } from '../debtors/debtorsService';
import { statementWords } from '../debtors/statementDocument';
import { useAccountFlags } from '../debtors/useAccountFlags';
import { AR_NOT_SET_UP_MESSAGE, loadPatientAccount, type PatientAccount } from './arService';
import { ErrorBox, PrimaryButton, SecondaryButton, Sheet, SummaryRow } from './ArUi';
import { formatDay, printDocument, statementHtml } from './receiptDocuments';
import { ReceiptDetailModal } from './ReceiptDetailModal';

const nad = (cents: number) => formatNad(fromCents(cents));
const signed = (cents: number) => (cents === 0 ? '' : nad(cents));

/**
 * Statement of account: invoices (with the funds' authorisation numbers), receipts, credit notes,
 * discounts, write-offs, corrections, shortfall transfers and refunds in date order, with the
 * running balance of the medical aid and patient portions and the credit on the account. Settled
 * items can be left off (the practice's setting decides the start). Printable, with the account's
 * own statement message and the practice's message. On screen every line opens what it is about:
 * a payment its receipt (here, on top of the statement), an invoice and what was done to it the
 * invoice (the way the screen that opened the statement shows invoices).
 */
export const PatientStatementDialog: React.FC<{
  practiceId: string;
  practiceName: string;
  patientId: string;
  patientName: string;
  onClose: () => void;
  /** Opens one of the account's invoices (Finance's invoice view, or the patient file's); lines show plain text without it */
  onOpenInvoice?: (invoiceId: string) => void;
  /** A receipt opened from the statement was refunded, reversed or allocated: the screen behind reloads too */
  onChanged?: () => void;
}> = ({ practiceId, practiceName, patientId, patientName, onClose, onOpenInvoice, onChanged }) => {
  const [account, setAccount] = useState<PatientAccount | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fromKey, setFromKey] = useState('');
  const [todayKey] = useState(() => toDateKey(new Date()));
  // The practice's message and settled-items setting, the authorisation numbers per invoice, and this view's own choice
  const [settings, setSettings] = useState<DocumentSettings>(DEFAULT_DOCUMENT_SETTINGS);
  const [authorisations, setAuthorisations] = useState<Record<string, string[]>>({});
  const [leaveOff, setLeaveOff] = useState<boolean | null>(null);
  // A payment line's receipt, open on top of the statement (the statement waits behind it)
  const [openedReceipt, setOpenedReceipt] = useState<ArReceipt | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const accountFlags = useAccountFlags(patientId, practiceId);
  const accountMessage = statementMessageOf(accountFlags.flags);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadPatientAccount(practiceId, patientId), loadDocumentSettings(practiceId)])
      .then(async ([result, loadedSettings]) => {
        if (cancelled) return;
        setAccount(result);
        setSettings(loadedSettings);
        if (result.state !== 'ready') return;
        const numbers = await loadInvoiceAuthorisations(result.invoices.map(invoice => invoice.id));
        if (!cancelled) setAuthorisations(numbers);
      })
      .catch(loadError => { if (!cancelled) setError(loadError instanceof Error ? loadError.message : 'Could not load the account'); });
    return () => { cancelled = true; };
  }, [practiceId, patientId, reloadKey]);

  // A change made on an opened receipt changes the statement (and the account behind it)
  const receiptChanged = useCallback(() => {
    setReloadKey(key => key + 1);
    onChanged?.();
  }, [onChanged]);

  const leavesOff = leaveOff ?? settings.leaveSettledOff;
  const built = useMemo(() => {
    if (!account || account.state !== 'ready') return null;
    const invoices: StatementInvoice[] = account.invoices.map(invoice => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      dateKey: invoiceDateKey(invoice),
      billed: account.balances[invoice.id]?.billed ?? billedPortions(invoice),
      cancelled: invoice.status === 'cancelled',
      authorisations: authorisations[invoice.id] ?? []
    }));
    const input: StatementInput = { patientId, invoices, receipts: account.receipts, allocations: account.allocations, adjustments: account.adjustments };
    // What is left off adds up to nothing, so every balance stays the same (settledItems.ts)
    const settled = leavesOff ? leaveSettledOff(input, settledInvoiceIds(invoices, account.balances)) : null;
    return { statement: buildStatement(settled?.input ?? input, { fromKey: fromKey || null }), leftOff: settled?.invoicesLeftOff ?? 0 };
  }, [account, patientId, fromKey, authorisations, leavesOff]);
  const statement = built?.statement ?? null;

  const print = () => {
    if (!statement || !built) return;
    const footnotes = [built.leftOff > 0 ? statementWords('en').settledLeftOff : '', practiceMessageFor(settings, 'statement') ?? ''];
    if (!printDocument(statementHtml(statement, { practiceName, patientName, asAtKey: todayKey, notices: accountMessage ? [accountMessage] : [], footnotes }))) {
      toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    }
  };

  // A line's details open its receipt or its invoice; the line looks as before until pointed at (as a receipt's invoice links do)
  const receiptsById = useMemo(() => new Map((account?.state === 'ready' ? account.receipts : []).map(receipt => [receipt.id, receipt])), [account]);
  const invoiceNumbers = useMemo(() => new Map((account?.invoices ?? []).map(invoice => [invoice.id, invoice.invoiceNumber])), [account]);
  const details = (line: StatementLine): React.ReactNode => {
    const opens = statementLineOpens(line);
    const receipt = opens?.kind === 'receipt' ? receiptsById.get(opens.id) : undefined;
    const invoiceId = opens?.kind === 'invoice' && onOpenInvoice ? opens.id : null;
    if (!receipt && !invoiceId) return <span className="break-words">{line.description}</span>;
    return (
      <button
        type="button"
        onClick={() => {
          if (receipt) setOpenedReceipt(receipt);
          else if (invoiceId) onOpenInvoice?.(invoiceId);
        }}
        title={receipt ? 'Open the receipt' : 'Open the invoice'}
        aria-label={`${line.description}. Open ${receipt ? `receipt ${receipt.number}` : `invoice ${invoiceNumbers.get(invoiceId as string) ?? ''}`.trim()}`}
        className="break-words rounded text-left hover:text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        {line.description}
      </button>
    );
  };

  return (
    <>
    <Sheet
      open={!openedReceipt}
      onClose={onClose}
      title={`Statement: ${patientName}`}
      subtitle={`As at ${formatDay(todayKey)}`}
      icon="solar:bill-list-bold-duotone"
      size="xl"
      footer={
        <>
          <SecondaryButton icon="solar:printer-minimalistic-bold-duotone" onClick={print} disabled={!statement}>Print statement</SecondaryButton>
          <PrimaryButton icon="solar:close-circle-bold-duotone" onClick={onClose}>Close</PrimaryButton>
        </>
      }
    >
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        {account?.state === 'not_set_up' && <ErrorBox>{AR_NOT_SET_UP_MESSAGE}</ErrorBox>}
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-full sm:w-56">
            <DateInput label="From (optional)" value={fromKey} onChange={setFromKey} maxDate={todayKey} placeholder="From the first invoice" />
          </div>
          {fromKey && <SecondaryButton onClick={() => setFromKey('')} className="!px-3 !py-2">Whole history</SecondaryButton>}
          <label className="inline-flex items-center gap-2 pb-2 text-sm text-gray-700">
            <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-cyan-600" checked={leavesOff} onChange={() => setLeaveOff(!leavesOff)} />
            Leave settled items off
          </label>
        </div>
        {accountMessage && <p className="text-sm text-gray-700">{accountMessage}</p>}

        {!account && !error ? (
          <div className="space-y-2" role="status" aria-label="Loading the statement">
            {[0, 1, 2, 3].map(index => <div key={index} className="h-10 animate-pulse rounded-lg bg-gray-100" />)}
          </div>
        ) : statement && statement.lines.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">Nothing on this account yet.</p>
        ) : statement ? (
          <>
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Date</th>
                    <th scope="col" className="px-3 py-2 text-left font-medium">Details</th>
                    <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Medical aid</th>
                    <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">Patient</th>
                    <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">Credit</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {statement.lines.map(line => (
                    <tr key={line.key} className={line.kind === 'opening' ? 'bg-gray-50 font-medium' : undefined}>
                      <td className="whitespace-nowrap px-3 py-2 text-gray-700">{formatDay(line.dateKey)}</td>
                      <td className="px-3 py-2 text-gray-900">
                        {details(line)}
                        {/* On a phone the portion columns are hidden: the change is shown here */}
                        <span className="mt-0.5 block text-xs text-gray-500 sm:hidden">
                          {[line.medicalAid ? `Medical aid ${nad(line.medicalAid)}` : '', line.patient ? `Patient ${nad(line.patient)}` : '', line.credit ? `Credit ${nad(line.credit)}` : '']
                            .filter(Boolean).join(' · ')}
                        </span>
                      </td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums sm:table-cell">{signed(line.medicalAid)}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums sm:table-cell">{signed(line.patient)}</td>
                      <td className="hidden whitespace-nowrap px-3 py-2 text-right tabular-nums md:table-cell">{signed(line.credit)}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums text-gray-900">{nad(line.balance.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
              <SummaryRow label="Medical aid still owes" value={nad(statement.closing.medicalAid)} />
              <SummaryRow label="Patient still owes" value={nad(statement.closing.patient)} />
              {statement.closing.credit > 0 && <SummaryRow label="Credit on the account" value={`-${nad(statement.closing.credit)}`} tone="good" />}
              <SummaryRow label="Balance" value={nad(statement.closing.total)} strong />
            </div>
          </>
        ) : null}
      </div>
    </Sheet>
    {openedReceipt && (
      <ReceiptDetailModal
        practiceId={practiceId}
        practiceName={practiceName}
        receipt={openedReceipt}
        patientNames={{ [patientId]: patientName }}
        onClose={() => setOpenedReceipt(null)}
        onChanged={receiptChanged}
      />
    )}
    </>
  );
};
