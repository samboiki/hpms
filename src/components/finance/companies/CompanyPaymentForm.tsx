import React, { useId, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { parseAmountInput } from '../../../services/ledgerService';
import { AmountInput, ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, SummaryRow, inputClass } from '../receipts/ArUi';
import { postAccountPayment, type AccountPaymentInput } from '../../../services/payerAccountService';
import { planAccountPayment } from '../../../utils/accounts/payerAccounts';
import type { CompanyInvoiceRow } from './companyStatement';

type Method = AccountPaymentInput['method'];

const METHODS: Array<{ value: Method; label: string }> = [
  { value: 'eft', label: 'EFT' },
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'debit_order', label: 'Debit order' }
];

const nad = (cents: number) => formatNad(fromCents(cents));

interface CompanyPaymentFormProps {
  accountId: string;
  accountName: string;
  rows: readonly CompanyInvoiceRow[];
  todayKey: string;
  onCancel: () => void;
  onSaved: (message: string) => void;
}

/**
 * Money a company or fund paid (parity A14): allocated to its invoices oldest first, as every receipt is; what is left
 * stays as its credit. The receipt is recorded as paid by the account (post_payer_account_receipt).
 */
export const CompanyPaymentForm: React.FC<CompanyPaymentFormProps> = ({ accountId, accountName, rows, todayKey, onCancel, onSaved }) => {
  const id = useId();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<Method>('eft');
  const [receivedOn, setReceivedOn] = useState(todayKey);
  const [reference, setReference] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountCents = amount.trim() ? parseAmountInput(amount) : null;
  const owing = useMemo(
    () => rows.filter(row => row.owedCents > 0).map(row => ({ invoiceId: row.invoiceId, invoiceNumber: row.invoiceNumber, dateKey: row.dateKey, outstandingCents: row.owedCents })),
    [rows]
  );
  const plan = amountCents && amountCents > 0 ? planAccountPayment(amountCents, owing) : null;
  const numberOf = new Map(rows.map(row => [row.invoiceId, row.invoiceNumber]));
  const problem = !amount.trim()
    ? 'Enter the amount received'
    : amountCents === null || amountCents <= 0
      ? 'Enter the amount as a number, e.g. 1250.00'
      : !receivedOn || receivedOn > todayKey
        ? 'The date cannot be in the future'
        : null;

  const save = async () => {
    if (problem || !plan || amountCents === null) return;
    setSaving(true);
    setError(null);
    try {
      const result = await postAccountPayment(accountId, {
        method,
        amountCents,
        receivedOn,
        reference,
        notes: '',
        allocations: plan.lines.map(line => ({ invoiceId: line.invoiceId, amountCents: line.amountCents }))
      });
      onSaved(
        `Receipt ${result.receiptNumber} recorded for ${accountName}: ${nad(result.allocatedCents)} on its invoices${result.unallocatedCents > 0 ? `, ${nad(result.unallocatedCents)} kept as its credit` : ''}.`
      );
    } catch (failure) {
      setError(failure instanceof Error ? plainWords(failure.message) : 'The payment could not be recorded.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3 rounded-xl border border-cyan-200 bg-cyan-50/40 p-4">
      {error && <ErrorBox>{error}</ErrorBox>}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Amount received" htmlFor={`${id}-amount`} error={amount.trim() && (amountCents === null || amountCents <= 0) ? 'Enter the amount as a number' : null}>
          <AmountInput id={`${id}-amount`} value={amount} onChange={event => setAmount(event.target.value)} invalid={!!amount.trim() && (amountCents === null || amountCents <= 0)} />
        </Field>
        <Field label="Received on" htmlFor={`${id}-date`}>
          <input id={`${id}-date`} type="date" className={inputClass} value={receivedOn} max={todayKey} onChange={event => setReceivedOn(event.target.value)} />
        </Field>
      </div>
      <div>
        <p className="mb-1 block text-sm font-medium text-gray-700">How it was paid</p>
        <ChoiceGroup<Method> label="How it was paid" value={method} onChange={setMethod} options={METHODS} disabled={saving} />
      </div>
      <Field label="Reference (optional)" htmlFor={`${id}-reference`} hint="The bank reference or the company's remittance number">
        <input id={`${id}-reference`} className={inputClass} value={reference} maxLength={100} onChange={event => setReference(event.target.value)} />
      </Field>

      {plan && (
        <div className="space-y-1 rounded-lg bg-white p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Paid on, oldest invoice first</p>
          {plan.lines.length === 0 ? (
            <p className="text-sm text-gray-600">No invoice of this account owes anything: all of it is kept as its credit.</p>
          ) : (
            plan.lines.map(line => <SummaryRow key={line.invoiceId} label={`Invoice ${numberOf.get(line.invoiceId) ?? ''}`} value={nad(line.amountCents)} />)
          )}
          {plan.unallocatedCents > 0 && <SummaryRow label="Kept as the account's credit" value={nad(plan.unallocatedCents)} tone="warning" />}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {problem && amount.trim() && <p className="text-sm text-gray-600">{problem}.</p>}
        <SecondaryButton onClick={onCancel} disabled={saving}>
          Cancel
        </SecondaryButton>
        <PrimaryButton icon="solar:hand-money-bold-duotone" onClick={() => void save()} busy={saving} disabled={!!problem}>
          Record payment
        </PrimaryButton>
      </div>
    </div>
  );
};

export default CompanyPaymentForm;
