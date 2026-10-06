import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  summarizePatientInvoices,
  toPatientInvoice,
  type PatientAccountSummary,
  type PatientInvoice,
  type PatientInvoiceRecord
} from './patientBilling';

// Columns used by working invoice code (invoiceService inserts, financialKpiService / CleanInvoiceTable reads)
const INVOICE_COLUMNS =
  'id, invoice_number, visit_id, practice_id, issue_date, due_date, created_at, total, medical_aid_total, patient_total, payment_status, payment_method';

export interface PatientInvoicesResult {
  invoices: PatientInvoice[];
  summary: PatientAccountSummary;
  /** A load or refresh is in flight */
  isLoading: boolean;
  /** At least one load succeeded for the current patient */
  hasLoaded: boolean;
  error: string | null;
  reload: () => void;
}

const EMPTY_INVOICES: PatientInvoice[] = [];
const EMPTY_SUMMARY = summarizePatientInvoices(EMPTY_INVOICES);

/**
 * Read-only: the patient's invoices at the current practice (invoices_enhanced by patient_id and
 * practice_id), newest first. Without a practice id it falls back to RLS scoping, like the
 * Finance page. Pass a null patientId to stay idle.
 */
export function usePatientInvoices(patientId?: string | null, practiceId?: string | null): PatientInvoicesResult {
  const [invoices, setInvoices] = useState<PatientInvoice[]>(EMPTY_INVOICES);
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
        const { data, error: queryError } = await query
          .order('issue_date', { ascending: false, nullsFirst: false })
          .order('created_at', { ascending: false });
        if (queryError) throw queryError;
        if (cancelled) return;
        setInvoices(((data ?? []) as unknown as PatientInvoiceRecord[]).map(toPatientInvoice));
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

  return {
    invoices: currentInvoices,
    summary: isCurrent ? summarizePatientInvoices(currentInvoices) : EMPTY_SUMMARY,
    isLoading,
    hasLoaded: isCurrent,
    error,
    reload
  };
}
