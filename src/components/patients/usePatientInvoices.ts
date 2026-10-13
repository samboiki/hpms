import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { patientMoneySummary, type PatientMoneySummary } from '../../services/ledgerService';
import { loadPatientBalances, loadPatientReceipts } from '../finance/receipts/arService';
import {
  summarizePatientInvoices,
  toPatientInvoice,
  type PatientAccountSummary,
  type PatientInvoice,
  type PatientInvoiceRecord,
  type PatientLedgerBalance
} from './patientBilling';

// Columns used by working invoice code (invoiceService inserts, financialKpiService / CleanInvoiceTable reads)
const INVOICE_COLUMNS =
  'id, invoice_number, visit_id, practice_id, issue_date, due_date, created_at, total, medical_aid_total, patient_total, payment_status, payment_method';

/** 'ready': receipts are in use and the balances loaded; 'not_set_up': the receipts tables do not exist yet */
export type PatientLedgerState = 'idle' | 'ready' | 'not_set_up' | 'error';

export interface PatientInvoicesResult {
  invoices: PatientInvoice[];
  summary: PatientAccountSummary;
  /** A load or refresh is in flight */
  isLoading: boolean;
  /** At least one load succeeded for the current patient */
  hasLoaded: boolean;
  error: string | null;
  reload: () => void;
  /** Whose invoices these are (for Receive payment and the statement) */
  patientId: string | null;
  practiceId: string | null;
  /** Receipts in use: per-invoice balances (part payments, credit notes) behind the summary */
  ledgerState: PatientLedgerState;
  ledgerBalances: Record<string, PatientLedgerBalance>;
  /** Receipts in use: credit not yet used on an invoice and the last payment; null until loaded or without receipts */
  money: PatientMoneySummary | null;
}

const EMPTY_INVOICES: PatientInvoice[] = [];
const EMPTY_SUMMARY = summarizePatientInvoices(EMPTY_INVOICES);
const NO_BALANCES: Record<string, PatientLedgerBalance> = {};

/**
 * Read-only: the patient's invoices at the current practice (invoices_enhanced by patient_id and
 * practice_id), newest first, with their ledger balances once receipts are in use. Without a
 * practice id it falls back to RLS scoping, like the Finance page. Pass a null patientId to stay idle.
 */
export function usePatientInvoices(patientId?: string | null, practiceId?: string | null): PatientInvoicesResult {
  const [invoices, setInvoices] = useState<PatientInvoice[]>(EMPTY_INVOICES);
  const [ledgerState, setLedgerState] = useState<PatientLedgerState>('idle');
  const [ledgerBalances, setLedgerBalances] = useState<Record<string, PatientLedgerBalance>>(NO_BALANCES);
  const [money, setMoney] = useState<PatientMoneySummary | null>(null);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const scopeKey = patientId ? `${patientId}:${practiceId ?? ''}` : null;

  useEffect(() => {
    if (!patientId || !scopeKey) {
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    const load = async () => {
      try {
        let query = supabase.from('invoices_enhanced').select(INVOICE_COLUMNS).eq('patient_id', patientId);
        if (practiceId) query = query.eq('practice_id', practiceId);
        const [{ data, error: queryError }, ledger, ownReceipts] = await Promise.all([
          query.order('issue_date', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }),
          // The balances never block the invoice list: without them the status rules apply, as before
          loadPatientBalances(patientId, practiceId ?? null).catch(ledgerError => {
            console.warn('[usePatientInvoices] Invoice balances unavailable:', ledgerError);
            return null;
          }),
          // Credit and the last payment for the summary; without them the summary simply leaves them out
          loadPatientReceipts(patientId, practiceId ?? null).catch(receiptError => {
            console.warn('[usePatientInvoices] Receipts unavailable:', receiptError);
            return null;
          })
        ]);
        if (queryError) throw queryError;
        if (cancelled) return;
        setInvoices(((data ?? []) as unknown as PatientInvoiceRecord[]).map(toPatientInvoice));
        setLedgerState(ledger ? ledger.state : 'error');
        setLedgerBalances(ledger?.state === 'ready'
          ? Object.fromEntries(Object.entries(ledger.balances).map(([id, balance]) => [id, {
              outstandingMedicalAid: balance.outstanding.medical_aid / 100,
              outstandingPatient: balance.outstanding.patient / 100,
              paid: (balance.allocated.medical_aid + balance.allocated.patient) / 100,
              hasEntries: balance.hasEntries
            }]))
          : NO_BALANCES);
        setMoney(ownReceipts?.state === 'ready' ? patientMoneySummary(ownReceipts.receipts, patientId) : null);
        setLoadedFor(scopeKey);
      } catch (loadError) {
        console.error('[usePatientInvoices] Failed to load invoices:', loadError);
        if (!cancelled) setError('Could not load invoices for this patient.');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void load();

    return () => {
      cancelled = true;
    };
  }, [patientId, practiceId, scopeKey, reloadKey]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  // Never show another patient's invoices while the new patient's are loading
  const isCurrent = loadedFor !== null && loadedFor === scopeKey;
  const currentInvoices = isCurrent ? invoices : EMPTY_INVOICES;
  const balances = isCurrent && ledgerState === 'ready' ? ledgerBalances : undefined;

  return {
    invoices: currentInvoices,
    summary: isCurrent ? summarizePatientInvoices(currentInvoices, balances) : EMPTY_SUMMARY,
    isLoading,
    hasLoaded: isCurrent,
    error,
    reload,
    patientId: patientId ?? null,
    practiceId: practiceId ?? null,
    ledgerState: isCurrent ? ledgerState : 'idle',
    ledgerBalances: balances ?? NO_BALANCES,
    money: isCurrent ? money : null
  };
}
