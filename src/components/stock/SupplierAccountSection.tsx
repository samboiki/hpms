import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { downloadReportCsv, printReport } from '../finance/financeExport';
import { payablesLink, stockDeliveryLink } from '../billing/invoiceLinks';
import { reverseSupplierPayment } from '../../services/stock/supplierLedgerService';
import { todayKey } from '../../utils/billing/dates';
import { paymentAdviceTable, supplierStatementTable } from '../../utils/stock/creditorsReports';
import { canStock, whoCan } from '../../utils/stock/stockRoles';
import {
  ENTRY_LABELS,
  ledgerEntries,
  openInvoices,
  statementFor,
  supplierAccount,
  type SupplierAccount,
  type SupplierLedgerData
} from '../../utils/stock/supplierLedger';
import type { Supplier } from '../../utils/stock/stockRows';
import type { StockContext } from './stockContext';
import { Chip, Field } from './stockParts';
import { DANGER, INPUT, LINK, PRIMARY, QUIET, SECONDARY, day, errorText, nad } from './stockUi';

/**
 * L12: a supplier's account in the supplier's sheet: what is owed (and overdue), the credit, the open invoices,
 * the latest entries with the balance, paying (practice admins and doctors: onPay opens PaySupplierSheet), the
 * statement for a period and the payment advice of each payment.
 */
export const SupplierAccountSection: React.FC<{
  context: StockContext;
  supplier: Supplier;
  ledger: SupplierLedgerData;
  /** The supplier's postal address, printed on its statement and payment advices */
  address: string | null;
  onPay: (account: SupplierAccount) => void;
  onChanged: () => void;
}> = ({ context, supplier, ledger, address, onPay, onChanged }) => {
  const today = todayKey();
  const account = useMemo(() => supplierAccount(supplier.id, supplier.paymentTermsDays, ledger), [supplier, ledger]);
  const entries = useMemo(() => ledgerEntries(ledger, () => supplier.paymentTermsDays).filter(entry => entry.supplierId === supplier.id), [ledger, supplier]);
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [reversing, setReversing] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const canPay = canStock(context.role, 'pay_suppliers');

  const open = openInvoices(account);
  const overdueCents = open.filter(row => row.dueDate < today).reduce((sum, row) => sum + row.owedCents, 0);
  const latest = useMemo(() => {
    const all = statementFor(entries, '0000-01-01', '9999-12-31').lines;
    return all.slice(-12).reverse();
  }, [entries]);
  const statement = () => supplierStatementTable(statementFor(entries, from, to), supplier.name, address);

  const reverse = async (paymentId: string) => {
    if (reason.trim().length < 3) {
      toast.error('Say why the payment is reversed. It stays with the payment.');
      return;
    }
    setBusy(true);
    try {
      const result = await reverseSupplierPayment(paymentId, reason.trim());
      toast.success(`${result.number} reversed: what it paid is owed again.`);
      setReversing(null);
      setReason('');
      onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Account" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Chip tone={account.owedCents > 0 ? 'amber' : 'green'}>Owed: {nad(account.owedCents)}</Chip>
        {overdueCents > 0 && <Chip tone="red">Overdue: {nad(overdueCents)}</Chip>}
        {account.creditCents > 0 && <Chip tone="cyan">Credit: {nad(account.creditCents)}</Chip>}
        <Link to={payablesLink()} className={`${LINK} text-sm`}>Payables in Finance</Link>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onPay(account)} disabled={!canPay} className={PRIMARY} title={canPay ? undefined : whoCan('pay_suppliers')}>
          <Icon icon="solar:card-send-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Pay
        </button>
      </div>
      {!canPay && <p className="text-xs text-gray-500">{whoCan('pay_suppliers')}</p>}

      {open.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-gray-900">Unpaid invoices</h3>
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {open.map(invoice => (
              <li key={invoice.delivery.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="min-w-0">
                  <Link to={stockDeliveryLink(invoice.delivery.id)} className={LINK}>Invoice {invoice.delivery.supplierReference}</Link>
                  <span className="block text-xs text-gray-500">
                    {invoice.delivery.number}{invoice.delivery.consignment ? ' · consignment frames sold' : ''} · {day(invoice.delivery.documentDate)} · due {day(invoice.dueDate)}
                    {invoice.allocatedCents > 0 ? ` · ${nad(invoice.allocatedCents)} paid` : ''}
                  </span>
                </span>
                <span className={`shrink-0 whitespace-nowrap tabular-nums ${invoice.dueDate < today ? 'font-semibold text-red-700' : 'text-gray-900'}`}>{nad(invoice.owedCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Latest on the account</h3>
        {latest.length === 0 ? (
          <p className="text-sm text-gray-500">No invoices, credits or payments yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {latest.map(entry => {
              const payment = entry.kind === 'payment' && entry.paymentId ? ledger.payments.find(row => row.id === entry.paymentId) ?? null : null;
              return (
                <li key={entry.key} className="px-3 py-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{ENTRY_LABELS[entry.kind]}</span>
                      <span className="text-gray-500"> · {day(entry.date)} · </span>
                      {entry.deliveryId ? <Link to={stockDeliveryLink(entry.deliveryId)} className={LINK}>{entry.document}</Link> : <span>{entry.document}</span>}
                      {entry.reference && <span className="text-gray-500"> · {entry.reference}</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1">
                      <span className={`whitespace-nowrap tabular-nums ${entry.amountCents < 0 ? 'text-emerald-700' : 'text-gray-900'}`}>
                        {entry.amountCents < 0 ? '−' : '+'}{nad(Math.abs(entry.amountCents))}
                      </span>
                      {payment && (
                        <button type="button" className={QUIET} aria-label={`Print the payment advice of ${payment.number}`}
                          onClick={() => {
                            if (!printReport(paymentAdviceTable(payment, ledger.allocations, ledger.deliveries, supplier.name, address), context.practiceName)) {
                              toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
                            }
                          }}>
                          <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
                    <span>{entry.note ?? ''}{payment?.reversedAt ? ' · reversed' : ''}</span>
                    <span className="shrink-0 whitespace-nowrap tabular-nums">balance {nad(entry.balanceCents)}</span>
                  </div>
                  {payment && !payment.reversedAt && canPay && (
                    reversing === payment.id ? (
                      <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end">
                        <Field label="Why reverse it?" className="flex-1">
                          {props => <input {...props} value={reason} onChange={event => setReason(event.target.value)} className={INPUT} maxLength={200} />}
                        </Field>
                        <button type="button" onClick={() => void reverse(payment.id)} disabled={busy} className={DANGER}>Reverse {payment.number}</button>
                        <button type="button" onClick={() => setReversing(null)} className={SECONDARY}>Keep it</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setReversing(payment.id); setReason(''); }} className={`${QUIET} mt-1 -ml-2.5`}>
                        Captured by mistake? Reverse it
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <details className="rounded-xl border border-gray-200 px-3 py-2">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">Statement for a period</summary>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field label="From">
            {props => <input {...props} type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className={INPUT} />}
          </Field>
          <Field label="To">
            {props => <input {...props} type="date" value={to} max={today} onChange={event => setTo(event.target.value)} className={INPUT} />}
          </Field>
          <div className="flex gap-2">
            <button type="button" disabled={from > to} onClick={() => {
              if (!printReport(statement(), context.practiceName)) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
            }} className={SECONDARY}>
              <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Print
            </button>
            <button type="button" disabled={from > to} onClick={() => downloadReportCsv(statement())} className={SECONDARY}>
              <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
          </div>
        </div>
      </details>
    </section>
  );
};

export default SupplierAccountSection;
