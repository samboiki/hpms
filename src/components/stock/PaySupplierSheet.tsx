import React, { useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { paySupplier } from '../../services/stock/supplierLedgerService';
import { todayKey } from '../../utils/billing/dates';
import { toCents } from '../../utils/billing/money';
import { parseAmountText } from '../../utils/stock/items';
import {
  PAYMENT_METHODS,
  amountToSettle,
  invoicesForAmount,
  openInvoices,
  planPayment,
  type PaymentMethod,
  type SupplierAccount
} from '../../utils/stock/supplierLedger';
import type { Supplier } from '../../utils/stock/stockRows';
import { Field } from './stockParts';
import { INPUT, PRIMARY, SECONDARY, day, errorText, nad } from './stockUi';

const amountText = (cents: number): string => (cents / 100).toFixed(2);

/**
 * L12: pay a supplier. Tick the invoices paid (all open ones to start with); the amount follows, after the credits not
 * used yet (stock returned, earlier payments), or type the amount and the oldest invoices it pays are ticked. Invoices
 * paid in full are marked paid in Finance too.
 */
export const PaySupplierSheet: React.FC<{
  practiceId: string;
  supplier: Supplier;
  account: SupplierAccount;
  onClose: () => void;
  onPaid: () => void;
}> = ({ practiceId, supplier, account, onClose, onPaid }) => {
  const open = openInvoices(account);
  const [useCredits, setUseCredits] = useState(account.creditCents > 0);
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(open.map(row => row.delivery.id)));
  const [amount, setAmount] = useState(() => amountText(amountToSettle(account, new Set(open.map(row => row.delivery.id)), account.creditCents > 0)));
  const [date, setDate] = useState(todayKey());
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);

  const typed = amount.trim() === '' ? 0 : parseAmountText(amount);
  const amountCents = typed === null ? null : toCents(typed);
  const plan = useMemo(() => planPayment(account, chosen, amountCents ?? 0, useCredits), [account, chosen, amountCents, useCredits]);
  const planOf = new Map(plan.lines.map(line => [line.invoiceId, line]));

  const toggle = (invoiceId: string) => {
    const next = new Set(chosen);
    if (next.has(invoiceId)) next.delete(invoiceId);
    else next.add(invoiceId);
    setChosen(next);
    setAmount(amountText(amountToSettle(account, next, useCredits)));
  };
  const typeAmount = (value: string) => {
    setAmount(value);
    const parsed = value.trim() === '' ? 0 : parseAmountText(value);
    if (parsed !== null) setChosen(invoicesForAmount(account, toCents(parsed), useCredits));
  };
  const switchCredits = (next: boolean) => {
    setUseCredits(next);
    setAmount(amountText(amountToSettle(account, chosen, next)));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (amountCents === null) {
      toast.error('Type the amount as N$ and cents, e.g. 1250.00.');
      return;
    }
    if (amountCents === 0 && (chosen.size === 0 || !useCredits || plan.creditsUsedCents === 0)) {
      toast.error('Type the amount paid.');
      return;
    }
    setSaving(true);
    try {
      const result = await paySupplier({
        practice_id: practiceId,
        supplier_id: supplier.id,
        paid_on: date,
        amount: amountCents / 100,
        method,
        reference: reference.trim() || null,
        notes: null,
        invoice_ids: [...chosen],
        use_credits: useCredits
      });
      const paidInFull = plan.lines.filter(line => line.leftCents === 0).length;
      toast.success(`${result.number ?? 'Credits'} recorded${paidInFull > 0 ? `: ${paidInFull} invoice${paidInFull === 1 ? '' : 's'} paid in full` : ''}${result.on_account > 0 ? `, ${nad(toCents(result.on_account))} on account` : ''}.`);
      onPaid();
    } catch (error) {
      toast.error(errorText(error, 'Could not record the payment.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      title={`Pay ${supplier.name}`}
      subtitle="Tick the invoices this payment pays. Paid in full, they are marked paid in Finance too."
      size="lg"
      dismissible={!saving}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700" aria-live="polite">
            {plan.creditsUsedCents > 0 && <>Credits used {nad(plan.creditsUsedCents)} · </>}
            Pays {nad(plan.allocatedCents)}
            {plan.onAccountCents > 0 && <span className="ml-1 font-medium text-cyan-800">· {nad(plan.onAccountCents)} on account</span>}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
            <button type="submit" form="stock-pay-form" disabled={saving} className={PRIMARY}>
              {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Record payment
            </button>
          </div>
        </div>
      }
    >
      <form id="stock-pay-form" onSubmit={save} className="space-y-5" noValidate>
        {open.length === 0 ? (
          <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">Nothing is owed: a payment now stays on account (for example a deposit with an order).</p>
        ) : (
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">Invoices, oldest first</legend>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {open.map(invoice => {
                const line = planOf.get(invoice.delivery.id);
                const id = `pay-${invoice.delivery.id}`;
                return (
                  <li key={invoice.delivery.id} className="flex items-start justify-between gap-3 px-3 py-2 text-sm">
                    <label htmlFor={id} className="flex min-w-0 items-start gap-2">
                      <input id={id} type="checkbox" checked={chosen.has(invoice.delivery.id)} onChange={() => toggle(invoice.delivery.id)}
                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">Invoice {invoice.delivery.supplierReference}</span>
                        <span className="block text-xs text-gray-500">
                          {invoice.delivery.number}{invoice.delivery.consignment ? ' · consignment frames sold' : ''} · {day(invoice.delivery.documentDate)} · due {day(invoice.dueDate)}{invoice.dueDate < todayKey() ? ' (overdue)' : ''}
                        </span>
                      </span>
                    </label>
                    <span className="shrink-0 text-right tabular-nums">
                      {nad(invoice.owedCents)}
                      {line && line.leftCents > 0 && line.leftCents < invoice.owedCents && <span className="block text-xs text-amber-800">{nad(line.leftCents)} left</span>}
                      {line && line.leftCents === 0 && <span className="block text-xs text-emerald-700">paid in full</span>}
                    </span>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}

        {account.creditCents > 0 && (
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={useCredits} onChange={event => switchCredits(event.target.checked)} className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500" />
            <span>
              Use the credit first: {nad(account.creditCents)}
              <span className="block text-xs text-gray-500">{account.credits.map(credit => `${credit.number} ${nad(credit.unusedCents)}`).join(' · ')}</span>
            </span>
          </label>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Amount paid (N$)" hint={plan.onAccountCents > 0 ? 'More than the ticked invoices: the rest stays on account.' : undefined}>
            {props => <input {...props} value={amount} onChange={event => typeAmount(event.target.value)} className={INPUT} inputMode="decimal" aria-invalid={amountCents === null ? true : undefined} />}
          </Field>
          <Field label="Paid on">
            {props => <input {...props} type="date" value={date} max={todayKey()} onChange={event => setDate(event.target.value)} className={INPUT} />}
          </Field>
          <Field label="How">
            {props => (
              <select {...props} value={method} onChange={event => setMethod(event.target.value as PaymentMethod)} className={INPUT}>
                {PAYMENT_METHODS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            )}
          </Field>
          <Field label="Reference" hint="The bank's or the supplier's reference, for their statement.">
            {props => <input {...props} value={reference} onChange={event => setReference(event.target.value)} className={INPUT} maxLength={60} />}
          </Field>
        </div>
      </form>
    </ListSheet>
  );
};

export default PaySupplierSheet;
