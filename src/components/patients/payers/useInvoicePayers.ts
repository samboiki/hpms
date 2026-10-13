import { useEffect, useMemo, useState } from 'react';
import { isPayersNotSetUp, loadPayerAccounts, loadVisitPayersOf } from '../../../services/payerAccountService';
import { payersByInvoice, type InvoicePayer } from '../../../utils/accounts/payerAccounts';

const NONE: Record<string, InvoicePayer> = {};

/**
 * Which of a patient's invoices a company or fund account pays (parity A14, A19), by invoice id: the Billing tab says
 * "Billed to …" on them and leaves them out of what the patient owes. Empty before the tables exist.
 */
export function useInvoicePayers(practiceId: string | null | undefined, invoices: ReadonlyArray<{ id: string; visitId: string | null }>): Record<string, InvoicePayer> {
  const [result, setResult] = useState<Record<string, InvoicePayer>>(NONE);
  // Read again only when the invoices or their visits change, not on every render
  const key = useMemo(() => invoices.map(invoice => `${invoice.id}:${invoice.visitId ?? ''}`).join('|'), [invoices]);
  const latest = useMemo(() => invoices, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const visitIds = latest.map(invoice => invoice.visitId).filter((id): id is string => Boolean(id));
    if (!practiceId || visitIds.length === 0) {
      setResult(NONE);
      return;
    }
    let active = true;
    Promise.all([loadVisitPayersOf(visitIds), loadPayerAccounts(practiceId)])
      .then(([visitPayers, accounts]) => {
        if (active) setResult(payersByInvoice(latest, visitPayers, accounts));
      })
      .catch(error => {
        if (!active) return;
        if (!isPayersNotSetUp(error)) console.warn('Could not read which invoices company accounts pay:', error);
        setResult(NONE);
      });
    return () => {
      active = false;
    };
  }, [practiceId, latest]);

  return result;
}
