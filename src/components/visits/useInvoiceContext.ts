import { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../lib/supabase';
import { addDaysToKey, todayKey } from '../../utils/billing/dates';
import { treatingPractitionerOptions, type TreatingPractitionerOption } from '../../utils/billing/invoiceRights';
import type { CopayRule } from '../../utils/billing/lineSplit';
import type { BilledLine } from '../../utils/billing/invoiceDuplicates';
import { loadVisitInvoiceLocks, type InvoiceLock, type SentClaim } from '../../utils/invoiceLock';
import { loadInvoicingSetup, type InvoicingSetup } from '../../services/invoicingSetup';
import { loadCopayRules, loadPatientBilledLines, loadPracticeStaff } from '../../services/invoiceContextService';
import { loadTariffIcd10Defaults } from '../../services/icd10DefaultsService';
import type { TariffIcd10Defaults } from '../../utils/billing/icd10Defaults';
import { splitDiagnosisCodes } from '../../utils/billing/claimFile';
import { matchInvoiceServices } from '../finance/claims/buildClaimLines';
import type { BatchDetailRow, InvoiceServiceRow } from '../finance/claims/types';

// The quotes table is read with the untyped client (proposals/2026-10-07-quotes-and-bundles.sql)
const db = supabase as unknown as SupabaseClient;

/** How far back the duplicate warning looks for the same service on another invoice. */
export const DUPLICATE_LOOKBACK_DAYS = 400;

export interface VisitInvoice {
  id: string;
  invoiceNumber: string;
  batchId: string | null;
  paymentStatus: string | null;
  practitionerId: string | null;
  lock: InvoiceLock;
  /** The sent claim batch the invoice is in: a change is no longer sent to the fund */
  claim: SentClaim | null;
  /** The quote this invoice was made from, once quotes are switched on */
  quote: { id: string; number: string } | null;
  /** ICD-10 codes on the invoice's claim lines, by invoice line id (confirmed at claim review for older lines) */
  claimCodes: Map<string, string[]>;
}

export interface InvoiceContextState {
  status: 'loading' | 'ready';
  setup: InvoicingSetup;
  practitioners: TreatingPractitionerOption[];
  copayRules: CopayRule[];
  invoice: VisitInvoice | null;
  /** The patient's lines on other invoices (duplicate warning) */
  billedLines: BilledLine[];
  /** The practice's usual ICD-10 code per tariff code (empty until it sets some, or when they cannot be read) */
  icd10Defaults: TariffIcd10Defaults;
  /** Parts that could not be loaded, in plain words (the screen still works without them) */
  problems: string[];
  reload: () => void;
}

const NOTHING_SET_UP: InvoicingSetup = { lineDetails: false, createdBy: false, audit: false, lineCodes: false };
const NO_DEFAULTS: TariffIcd10Defaults = new Map();

const message = (error: unknown, fallback: string): string => (error instanceof Error ? plainWords(error.message) : fallback);

/**
 * What a visit's Billing tab needs besides the lines: which parts of the invoicing update exist, the practitioners
 * who can be chosen per line, the practice's co-payments, the visit's invoice (number, lock, claim batch, quote),
 * the patient's other invoice lines for the duplicate warning and the practice's usual ICD-10 code per tariff code.
 * Each part loads on its own, so one failing part only hides its own feature.
 */
export function useInvoiceContext(params: {
  practiceId: string | null;
  patientId: string | null;
  visitId: string | null;
  /** Practitioners to list even when switched off (the visit's own) */
  keepPractitionerIds?: readonly (string | null | undefined)[];
}): InvoiceContextState {
  const { practiceId, patientId, visitId } = params;
  const keepKey = (params.keepPractitionerIds ?? []).filter(Boolean).join(',');
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<Omit<InvoiceContextState, 'reload'>>({
    status: 'loading',
    setup: NOTHING_SET_UP,
    practitioners: [],
    copayRules: [],
    invoice: null,
    billedLines: [],
    icd10Defaults: NO_DEFAULTS,
    problems: []
  });
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    const problems: string[] = [];
    const run = async () => {
      const [setup, staff, copay, invoice, billed, usualCodes] = await Promise.all([
        loadInvoicingSetup().catch(() => NOTHING_SET_UP),
        loadPracticeStaff(practiceId).catch(error => {
          problems.push(message(error, 'The practitioners could not be loaded.'));
          return [];
        }),
        loadCopayRules(practiceId),
        visitId ? loadVisitInvoice(visitId).catch(error => {
          problems.push(message(error, "The visit's invoice could not be loaded."));
          return null;
        }) : Promise.resolve(null),
        patientId
          ? loadPatientBilledLines(patientId, addDaysToKey(todayKey(), -DUPLICATE_LOOKBACK_DAYS)).catch(error => {
              problems.push(`${message(error, "The patient's earlier invoices could not be read")}; duplicates are not checked.`);
              return [];
            })
          : Promise.resolve([]),
        loadTariffIcd10Defaults(practiceId)
      ]);
      if (copay.error) problems.push(`The co-payment settings could not be read (${copay.error}); the medical aid is billed the whole line.`);
      if (usualCodes.status === 'error') problems.push(`${usualCodes.message}; new lines start with the built-in suggestions.`);
      if (cancelled) return;
      setState({
        status: 'ready',
        setup,
        practitioners: treatingPractitionerOptions(staff, keepKey ? keepKey.split(',') : []),
        copayRules: copay.rules,
        invoice,
        billedLines: billed,
        icd10Defaults: usualCodes.defaults,
        problems
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId, visitId, keepKey, version]);

  return { ...state, reload };
}

/** The visit's invoice with its lock and the quote it came from. */
async function loadVisitInvoice(visitId: string): Promise<VisitInvoice | null> {
  const { data, error } = await supabase
    .from('invoices_enhanced')
    .select('id, invoice_number, batch_id, payment_status, practitioner_id')
    .eq('visit_id', visitId)
    .order('created_at', { ascending: true })
    .limit(1);
  if (error) throw new Error(`The visit's invoice could not be loaded: ${error.message}`);
  const row = data?.[0];
  if (!row) return null;
  const [locks, quote, claimCodes] = await Promise.all([
    loadVisitInvoiceLocks(visitId).catch(() => []),
    db
      .from('quotes')
      .select('id, quote_number')
      .eq('converted_invoice_id', row.id)
      .limit(1)
      .then(result => (result.error ? null : ((result.data ?? [])[0] as { id: string; quote_number: string } | undefined) ?? null)),
    loadClaimCodes(row.id)
  ]);
  return {
    id: row.id,
    invoiceNumber: row.invoice_number,
    batchId: row.batch_id,
    paymentStatus: row.payment_status,
    practitionerId: row.practitioner_id,
    // A lock that cannot be read is treated as locked by the save (it re-checks); here it only hides the editing
    lock: locks.find(item => item.id === row.id)?.lock ?? null,
    claim: locks.find(item => item.id === row.id)?.claim ?? null,
    quote: quote ? { id: quote.id, number: quote.quote_number } : null,
    claimCodes
  };
}

/**
 * The ICD-10 codes on an invoice's claim lines, by the invoice line each claim line came from (matchInvoiceServices,
 * as the printed invoice does). Lines saved before invoice lines kept codes have theirs only there. Empty when
 * nothing can be read: the Billing tab then suggests codes as for a new line.
 */
async function loadClaimCodes(invoiceId: string): Promise<Map<string, string[]>> {
  const codes = new Map<string, string[]>();
  try {
    const [claimLines, lines] = await Promise.all([
      db.from('batch_details').select('id, invoice_id, bhf_tariff_code, service_amount, transaction_number_in_batch, diagnostic_code').eq('invoice_id', invoiceId),
      db.from('invoice_services').select('id, invoice_id, code, total_price, system_transaction_number').eq('invoice_id', invoiceId)
    ]);
    if (claimLines.error || lines.error || !claimLines.data?.length) return codes;
    const details = claimLines.data as unknown as BatchDetailRow[];
    const matches = matchInvoiceServices(details, (lines.data ?? []) as unknown as InvoiceServiceRow[]);
    details.forEach(detail => {
      const line = matches.get(detail.id);
      const saved = splitDiagnosisCodes(detail.diagnostic_code);
      if (line && saved.primary) codes.set(line.id, [saved.primary, ...saved.secondary]);
    });
  } catch {
    // Read-only extra: without it the line follows the suggestion
  }
  return codes;
}
