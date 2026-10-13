import React, { useCallback, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { formatNad, fromCents } from '../../utils/billing/money';
import { checkInvoiceFlags, overrideReasonProblem, toCents, type InvoiceFlagCheck } from '../../services/ledgerService';
import { loadPatientAccountFlags } from '../finance/debtors/useAccountFlags';
import { recordCreditLimitOverride } from '../finance/debtors/debtorsService';
import { isArNotSetUp } from '../finance/receipts/arService';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../finance/receipts/ArUi';

const db = supabase as unknown as SupabaseClient;
const nad = (cents: number) => formatNad(fromCents(cents));

/** The invoice about to be saved, as the Billing tab totals it */
export interface InvoiceFlagRequest {
  totalCents: number;
  /** What the patient pays on it as the tab splits it (before "cash only") */
  patientCents: number;
  /** An invoice whose lines are saved again: what it already adds to the account is not counted twice */
  replacingInvoiceId?: string | null;
}

export interface InvoiceFlagDecision {
  /** Cash only, confirmed: the whole invoice is the patient's and nothing is claimed from a medical aid */
  billPatientOnly: boolean;
}

const NOTHING_TO_CONFIRM: InvoiceFlagDecision = { billPatientOnly: false };

/** An invoice being saved again: what the patient still owes on it, and what it bills the medical aid (ar_invoice_balances) */
async function invoiceNow(invoiceId: string): Promise<{ patientOwedCents: number; fundBilledCents: number }> {
  const { data, error } = await db.from('ar_invoice_balances').select('patient_outstanding, medical_aid_billed').eq('invoice_id', invoiceId).range(0, 0);
  if (error) throw error;
  const row = (data ?? [])[0] as { patient_outstanding?: number | string | null; medical_aid_billed?: number | string | null } | undefined;
  return { patientOwedCents: Math.max(toCents(row?.patient_outstanding), 0), fundBilledCents: Math.max(toCents(row?.medical_aid_billed), 0) };
}

interface Pending {
  check: InvoiceFlagCheck;
  request: InvoiceFlagRequest;
  resolve: (decision: InvoiceFlagDecision | null) => void;
}

/**
 * The account flags checked when a visit is invoiced (checkInvoiceFlags): "Cash only" asks the person to confirm
 * that the invoice is the patient's and is not claimed; above a credit limit only an administrator may go on,
 * with a reason kept on the account. `confirm` reads the account fresh and resolves with the decision, or null
 * when the person goes back (nothing is saved). Render `dialog` once in the screen.
 */
export function useInvoiceFlagCheck(params: { patientId: string | null | undefined; practiceId: string | null | undefined; role: string | null | undefined }) {
  const { patientId, practiceId, role } = params;
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(async (request: InvoiceFlagRequest): Promise<InvoiceFlagDecision | null> => {
    if (!patientId || !practiceId) return NOTHING_TO_CONFIRM;
    let check: InvoiceFlagCheck;
    let alreadyPatients = false;
    try {
      const account = await loadPatientAccountFlags(practiceId, patientId);
      // Unknown when it cannot be read: then the person is asked, and the whole invoice counts against the limit
      const replacing = request.replacingInvoiceId && account.flags.some(flag => flag.kind === 'credit_limit' || flag.kind === 'cash_only')
        ? await invoiceNow(request.replacingInvoiceId).catch(() => null)
        : null;
      check = checkInvoiceFlags({
        flags: account.flags,
        owedCents: account.creditLimit?.owedCents ?? null,
        invoice: { totalCents: request.totalCents, patientCents: request.patientCents },
        replacingPatientCents: replacing?.patientOwedCents ?? 0,
        role
      });
      alreadyPatients = replacing !== null && replacing.fundBilledCents === 0;
    } catch (error) {
      // Before the debtors proposal there are no flags; any other failure must not stop the practice billing
      if (!isArNotSetUp(error)) {
        console.warn('Account flags could not be checked before invoicing', error);
        toast('The account flags (cash only, credit limit) could not be checked. Look at the patient file before taking payment.', { duration: 7000 });
      }
      return NOTHING_TO_CONFIRM;
    }
    if (!check.needsConfirmation) return NOTHING_TO_CONFIRM;
    // A cash-only invoice that is already wholly the patient's is saved again as it is: nothing new to confirm
    if (check.cashOnly && check.overLimit === null && alreadyPatients) return { billPatientOnly: true };
    return new Promise(resolve => setPending({ check, request, resolve }));
  }, [patientId, practiceId, role]);

  const finish = (decision: InvoiceFlagDecision | null) => {
    pending?.resolve(decision);
    setPending(null);
  };

  const dialog = pending && patientId && practiceId
    ? <InvoiceFlagDialog check={pending.check} request={pending.request} practiceId={practiceId} patientId={patientId} onDone={finish} />
    : null;
  return { confirm, dialog };
}

export const InvoiceFlagDialog: React.FC<{
  check: InvoiceFlagCheck;
  request: InvoiceFlagRequest;
  practiceId: string;
  patientId: string;
  onDone: (decision: InvoiceFlagDecision | null) => void;
}> = ({ check, request, practiceId, patientId, onDone }) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const over = check.overLimit;
  // Above the limit and not an administrator: the invoice cannot be saved from here
  const blocked = over !== null && !check.canOverride;
  const fundCents = Math.max(request.totalCents - request.patientCents, 0);

  const proceed = async () => {
    if (over) {
      const problem = overrideReasonProblem(reason);
      if (problem) {
        setError(problem);
        return;
      }
      setBusy(true);
      setError(null);
      try {
        await recordCreditLimitOverride(practiceId, patientId, check.patientCents, reason);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : 'The reason could not be saved, so the invoice was not saved');
        setBusy(false);
        return;
      }
      setBusy(false);
    }
    onDone({ billPatientOnly: check.cashOnly });
  };

  return (
    <Sheet
      open
      onClose={() => onDone(null)}
      busy={busy}
      size="md"
      overFullScreen
      tone={blocked ? 'red' : 'amber'}
      icon="solar:flag-bold-duotone"
      title={blocked ? 'Above the credit limit' : 'Check the account before invoicing'}
      subtitle="Nothing is saved until you choose."
      footer={
        <>
          <SecondaryButton onClick={() => onDone(null)} disabled={busy}>Back</SecondaryButton>
          {!blocked && (
            <PrimaryButton icon="solar:check-circle-bold-duotone" busy={busy} onClick={() => void proceed()}>
              {check.cashOnly ? 'Invoice the patient' : 'Invoice anyway'}
            </PrimaryButton>
          )}
        </>
      }
    >
      <div className="space-y-3 text-sm text-gray-700">
        {check.cashOnly && (
          <section className="flex gap-3 rounded-xl bg-amber-50 p-3" aria-label="Cash only">
            <Icon icon="solar:wallet-money-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-700" aria-hidden="true" />
            <div>
              <p className="font-medium text-gray-900">Cash only</p>
              <p>
                The patient pays the whole invoice, {nad(request.totalCents)}, today. Nothing is claimed from a medical aid
                {fundCents > 0 ? ` (${nad(fundCents)} of it would have been)` : ''}.
              </p>
            </div>
          </section>
        )}
        {over && (
          <section className="flex gap-3 rounded-xl bg-red-50 p-3" aria-label="Credit limit">
            <Icon icon="solar:card-recive-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-700" aria-hidden="true" />
            <div>
              <p className="font-medium text-gray-900">Credit limit {nad(over.limitCents)}</p>
              <p>
                The account owes {nad(over.owedCents)}. With this invoice it would owe {nad(over.afterCents)}, {nad(over.overCents)} above the limit.
              </p>
              {blocked && <p className="mt-1">Only a practice administrator can invoice above the limit. Take a payment first, or ask an administrator.</p>}
            </div>
          </section>
        )}
        {over && check.canOverride && (
          <Field label="Why may it go above the limit? (kept with the account)" htmlFor="invoice-flag-reason">
            <textarea
              id="invoice-flag-reason"
              rows={2}
              className={inputClass}
              value={reason}
              onChange={event => setReason(event.target.value)}
              maxLength={500}
              disabled={busy}
            />
          </Field>
        )}
        {error && <ErrorBox>{error}</ErrorBox>}
      </div>
    </Sheet>
  );
};
