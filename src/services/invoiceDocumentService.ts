/**
 * Loads everything a printed invoice needs (buildInvoiceDocument) and makes the PDF: the one invoice PDF of the app
 * (SSOT). Used by "Download PDF" (UnifiedPDFGenerator), the print button in the patient's invoice list
 * (CleanInvoiceTable) and the visit documents (documentGenerationService).
 *
 * Read-only. Each part that cannot be read leaves its field empty, and missingRuleEight then names it, so a
 * missing detail never stops the patient from getting an account.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { jsPDF } from 'jspdf';
import { supabase } from '../lib/supabase';
import { toCents } from '../utils/billing/money';
import { isValidDateKey, toDateKey, todayKey } from '../utils/billing/dates';
import { extractIcd10Codes } from '../utils/billing/icd10';
import { splitDiagnosisCodes } from '../utils/billing/claimFile';
import { parseToothList, selectBillableTariffs, type TariffRow } from '../utils/billing/pricing';
import { resolveFundReference, type FundProviderRow } from '../utils/billing/fundPricing';
import { getFundRule } from '../utils/billing/fundRules';
import { MATERIAL_FACTOR_CODE } from '../utils/billing/tariffRules';
import { matchInvoiceServices } from '../components/finance/claims/buildClaimLines';
import type { BatchDetailRow, InvoiceServiceRow } from '../components/finance/claims/types';
import { loadLetterhead } from '../components/quotes/quoteService';
import { loadItemVatRates } from './vatSettingsService';
import { buildInvoiceDocument, type InvoiceDocument, type InvoiceDocumentInput, type InvoiceDocumentLine } from '../components/billing/invoiceDocument';
import { renderInvoicePdf } from '../components/billing/invoicePdf';
import { isQuadrant } from '../utils/dental/lineTeeth';
import { loadPractitionerBilling } from './practitionerBillingService';
import { patientFileStatus } from '../utils/patients/temporaryPatient';
import { loadInvoiceDiscounts } from './discountService';
import { discountReasonText, standingDiscounts } from './ledgerService';
import { loadVisitBilledTo } from './payerAccountService';

// Columns the generated types do not know yet (dependant_code, the invoicing update's line columns) are read with '*'
const db = supabase as unknown as SupabaseClient;

type Row = Record<string, unknown>;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value.trim() : null);
const amount = (value: unknown): number => {
  const number = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(number) ? number : 0;
};

/** Codes whose price is worked out, not read from the tariff (8346: a percentage of its restoration). */
const COMPUTED_CODES = new Set([MATERIAL_FACTOR_CODE]);

/**
 * The codes billed at a price other than the practice tariff (the NAMAF benchmark of the discipline) on their
 * service date; null when the tariff list cannot be read.
 */
async function offBenchmarkCodes(practiceType: string | null, lines: readonly InvoiceDocumentLine[], fallbackDate: string): Promise<string[] | null> {
  if (!practiceType) return null;
  const { data, error } = await supabase
    .from('practice_tariffs_with_types')
    .select('id, code, price, is_active, effective_from, effective_to, can_be_multiplied, requires_tooth_number')
    .eq('practice_type_name', practiceType);
  if (error) return null;
  const rows = (data ?? []) as unknown as TariffRow[];
  const byDate = new Map<string, Map<string, number>>();
  const priceOn = (lineDate: string, code: string): number | undefined => {
    const date = isValidDateKey(lineDate) ? lineDate : todayKey();
    if (!byDate.has(date)) {
      byDate.set(date, new Map(selectBillableTariffs(rows, date).tariffs.map(tariff => [tariff.code.toUpperCase(), toCents(tariff.unitPrice)])));
    }
    return byDate.get(date)?.get(code.trim().toUpperCase());
  };
  return lines
    .filter(line => !COMPUTED_CODES.has(line.code.trim()))
    .filter(line => priceOn(line.serviceDate ?? fallbackDate, line.code) !== toCents(line.unitPrice))
    .map(line => line.code);
}

/** Everything buildInvoiceDocument needs for one invoice. */
export async function loadInvoiceDocumentInput(invoiceId: string): Promise<InvoiceDocumentInput> {
  const { data: invoice, error } = await db.from('invoices_enhanced').select('*').eq('id', invoiceId).maybeSingle();
  if (error) throw new Error(`Could not read the invoice: ${error.message}`);
  if (!invoice) throw new Error('The invoice could not be found.');
  const inv = invoice as Row;

  const [linesResult, visitResult, batchResult, discountRows] = await Promise.all([
    db.from('invoice_services').select('*').eq('invoice_id', invoiceId).order('system_transaction_number', { ascending: true }),
    text(inv.visit_id) ? supabase.from('visits').select('visit_date, doctor_id, diagnosis, practice_id').eq('id', String(inv.visit_id)).maybeSingle() : Promise.resolve({ data: null, error: null }),
    db.from('batch_details').select('*').eq('invoice_id', invoiceId),
    // Discounts given on the invoice (parity D19): none when they cannot be read
    loadInvoiceDiscounts(invoiceId)
  ]);
  if (linesResult.error) throw new Error(`Could not read the invoice lines: ${linesResult.error.message}`);
  const lineRows = (linesResult.data ?? []) as Row[];
  const visit = visitResult.data as { visit_date: string | null; doctor_id: string | null; diagnosis: string | null; practice_id: string | null } | null;

  const practiceId = text(inv.practice_id) ?? visit?.practice_id ?? null;
  if (!practiceId) throw new Error('The invoice is not linked to a practice, so it has no letterhead.');
  const patientId = String(inv.patient_id);
  const [letterhead, practiceRow, patientResult, aidResult, providersResult, vatRates] = await Promise.all([
    loadLetterhead(practiceId),
    supabase.from('practices').select('practice_type').eq('id', practiceId).maybeSingle(),
    supabase.from('patients').select('first_name, last_name, date_of_birth, cell_number, email, id_number, gender').eq('id', patientId).maybeSingle(),
    db.from('medical_aid_details').select('*').eq('patient_id', patientId).order('updated_at', { ascending: false }).limit(1),
    supabase.from('medical_aid_providers').select('id, name, short_name, medical_aid_reference'),
    // Settings > Practice > VAT and the VAT rate of each stock item billed (services are exempt); never throws
    loadItemVatRates(practiceId, lineRows.map(row => text(row.stock_item_id) ?? ''))
  ]);
  const practiceType = practiceRow.data?.practice_type ?? null;
  const patient = patientResult.data;

  // ICD-10 per line: the line's own codes, else the codes confirmed on its claim line, else codes written in the visit
  const batchDetails = ((batchResult.error ? [] : batchResult.data) ?? []) as unknown as BatchDetailRow[];
  const claimMatches = matchInvoiceServices(batchDetails, lineRows as unknown as InvoiceServiceRow[]);
  const claimCodesByLine = new Map<string, string[]>();
  batchDetails.forEach(detail => {
    const line = claimMatches.get(detail.id);
    const codes = splitDiagnosisCodes(detail.diagnostic_code);
    if (line && codes.primary) claimCodesByLine.set(line.id, [codes.primary, ...codes.secondary]);
  });
  const visitCodes = extractIcd10Codes(visit?.diagnosis ?? null);

  const lines: InvoiceDocumentLine[] = lineRows.map(row => {
    const own = [text(row.icd10_primary), ...(Array.isArray(row.icd10_secondary) ? (row.icd10_secondary as unknown[]).map(text) : [])].filter(
      (code): code is string => Boolean(code)
    );
    const discount = amount(row.discount_amount);
    return {
      id: String(row.id),
      serviceDate: toDateKey(text(row.service_date)),
      code: String(row.code ?? ''),
      description: String(row.description ?? ''),
      icd10: own.length > 0 ? own : claimCodesByLine.get(String(row.id)) ?? visitCodes,
      teeth: text(row.tooth_number) ? parseToothList(String(row.tooth_number)) : [],
      quantity: amount(row.quantity) || 1,
      unitPrice: amount(row.unit_price),
      discount,
      total: amount(row.total_price),
      medicalAid: amount(row.medical_aid_covered),
      patient: amount(row.patient_portion),
      practitionerId: text(row.practitioner_id),
      // What staff wrote for the line on the visit's Billing tab, printed under it
      narrative: text(row.notes),
      // A line the patient pays all of (never claimed) and the fund's authorisation number (line-portions update)
      paidBy: row.paid_by === 'patient' || row.paid_by === 'fund' ? row.paid_by : null,
      authorisationNumber: text(row.authorisation_number),
      // A filling's surfaces and the quadrant of a code billed per quadrant (line-teeth update), in the tooth column
      surfaces: text(row.tooth_surfaces),
      quadrant: isQuadrant(Number(row.tooth_quadrant)) ? Number(row.tooth_quadrant) : null,
      vatRate: text(row.stock_item_id) ? vatRates.rates.get(String(row.stock_item_id)) ?? 0 : 0
    };
  });

  const aid = (((aidResult.error ? [] : aidResult.data) ?? []) as Row[])[0];
  const providers = ((providersResult.data ?? []) as FundProviderRow[]);
  const knownFund = (name: string) => {
    const rule = getFundRule(null, name);
    return rule.configured ? rule.references[0] ?? null : null;
  };
  const fundReference = aid ? resolveFundReference({ medical_aid_provider_id: text(aid.medical_aid_provider_id), provider: text(aid.provider) }, providers, knownFund) : null;
  const provider = aid ? providers.find(row => row.id === aid.medical_aid_provider_id) : undefined;

  const practitionerIds = [...new Set([text(inv.practitioner_id), visit?.doctor_id ?? null, ...lines.map(line => line.practitionerId)].filter((id): id is string => Boolean(id)))];
  const [{ data: staff }, billing] = await Promise.all([
    practitionerIds.length > 0 ? supabase.from('users').select('id, full_name, role, hpcsa_number').in('id', practitionerIds) : Promise.resolve({ data: [] }),
    // Partners who bill under their own practice number (D31); none before the update or when it cannot be read
    loadPractitionerBilling(practiceId)
  ]);

  const issueDate = toDateKey(text(inv.issue_date));
  // A visit billed to a company or fund account (parity A14, A19): the account takes the medical aid's place
  const billedTo = text(inv.visit_id)
    ? await loadVisitBilledTo(String(inv.visit_id)).catch(failure => {
        console.warn('Who the invoice is billed to could not be read:', failure);
        return null;
      })
    : null;
  return {
    billedTo,
    invoice: {
      id: String(inv.id),
      invoiceNumber: String(inv.invoice_number ?? ''),
      issueDate,
      dueDate: toDateKey(text(inv.due_date)),
      paymentStatus: text(inv.payment_status),
      practitionerId: text(inv.practitioner_id)
    },
    practice: { ...letterhead, practiceType },
    patient: {
      firstName: patient?.first_name ?? null,
      lastName: patient?.last_name ?? null,
      // A file booked with a name and cell only has a placeholder birthday: never printed as the patient's
      dateOfBirth: patientFileStatus(patient).dateOfBirth,
      phone: patient?.cell_number ?? null,
      email: patient?.email ?? null
    },
    medicalAid: aid
      ? {
          fundName: provider?.name ?? text(aid.provider),
          fundReference,
          membershipNumber: text(aid.membership_number),
          planOption: text(aid.plan_type) ?? text(aid.scheme),
          mainMemberName: text(aid.main_member_name),
          relationshipToMain: text(aid.relationship_to_main),
          dependantCode: text(aid.dependant_code)
        }
      : null,
    visit: visit ? { date: toDateKey(visit.visit_date), practitionerId: visit.doctor_id } : null,
    practitioners: ((staff ?? []) as Array<{ id: string; full_name: string | null; role: string | null; hpcsa_number: string | null }>).map(person => ({
      id: person.id,
      fullName: person.full_name,
      role: person.role,
      hpcnaNumber: person.hpcsa_number,
      ownPracticeNumber: billing.billing.get(person.id)?.practiceNumber ?? null
    })),
    lines,
    offBenchmarkCodes: await offBenchmarkCodes(practiceType, lines, toDateKey(visit?.visit_date ?? null) ?? issueDate ?? todayKey()),
    vat: vatRates.settings.registered ? { vatNumber: vatRates.settings.vatNumber } : null,
    discounts: standingDiscounts(discountRows).discounts.map(discount => ({
      number: discount.number,
      amountCents: discount.amountCents,
      percent: discount.percent ?? null,
      reason: discountReasonText(discount)
    }))
  };
}

/** The invoice document and its PDF. */
export async function makeInvoicePdf(invoiceId: string): Promise<{ doc: InvoiceDocument; pdf: jsPDF }> {
  const doc = buildInvoiceDocument(await loadInvoiceDocumentInput(invoiceId));
  return { doc, pdf: renderInvoicePdf(doc) };
}

/** Saves the invoice PDF on this device; returns the document (its `missing` list says what rule 008 still lacks). */
export async function downloadInvoicePdf(invoiceId: string): Promise<InvoiceDocument> {
  const { doc, pdf } = await makeInvoicePdf(invoiceId);
  pdf.save(doc.fileName);
  return doc;
}
