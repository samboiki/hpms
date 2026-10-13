/**
 * Database and gateway work for code bundles and quotes. The money rules live in billingLines.ts,
 * bundles.ts and quotes.ts (tested); this file only reads and writes.
 *
 * - The tables come from proposals/2026-10-07-quotes-and-bundles.sql. Until it is applied every load
 *   throws QuotesNotEnabledError and the screens show "Quotes are not switched on yet".
 * - Bundles and quotes are saved through save_code_bundle / save_quote, so a quote and its lines are
 *   written together (never a quote without its lines) and its totals are the sum of its lines.
 * - SMS and email go only through communicationService (the centralized gateways, logged and counted).
 * - Converting creates the invoice through invoiceService.createInvoice, the same path as the visit
 *   screens, so the invoice gets the same checks and amounts.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { plainWords } from '../../utils/plainErrors';
import { supabase } from '../../lib/supabase';
import { communicationService, getCommunicationErrorMessage } from '../../services/communicationService';
import { invoiceService } from '../../services/invoiceService';
import type { ServiceSelection } from '../../types/billing';
import {
  billableVisitTariffs,
  priceForPatient,
  withDisciplineRules,
  type VisitTariff
} from '../visits/visitBillingLines';
import { EMPTY_PRICE_BOOK, type FundPriceBook, type PatientFundKey } from '../../utils/billing/fundPricing';
import { loadFundPriceBook, loadInfectionControlStaff, loadPatientFundKey } from '../../services/fundPricingService';
import { loadPracticeTariffRows } from '../../services/practiceTariffService';
import { loadPatientRate } from '../../services/patientRateService';
import type { PatientRate } from '../../utils/billing/patientRates';
import { EXCLUDE_CARRIER_VISITS } from '../../utils/carrierVisits';
import { bundleSavePayload, toCodeBundles, type BundleDraft, type BundleLineRow, type BundleRow, type CodeBundle } from './bundles';
import {
  quoteEmailContent,
  toQuoteLineRecord,
  toQuoteRecord,
  type QuoteEstimate,
  type QuoteLineRecord,
  type QuoteLineRow,
  type QuoteRecord,
  type QuoteRow,
  type QuoteStatus
} from './quotes';
import { buildQuoteDocument, quotePdfBase64, renderQuotePdf, type PracticeLetterhead, type QuotePatientInfo } from './quotePdf';
import { messageHtml } from '../../utils/messages/documentEmail';
import { loadDocumentSettings } from '../../services/documentSettingsService';

// The generated database types do not know these tables yet, so they are read with the untyped client
// and normalised (same approach as patientListService and financeData).
const db = supabase as unknown as SupabaseClient;

export class QuotesNotEnabledError extends Error {
  constructor() {
    super('Quotes and code bundles are not switched on yet.');
    this.name = 'QuotesNotEnabledError';
  }
}

interface DbError {
  code?: string;
  message?: string;
}

const OWN_OBJECTS = /\b(quotes|quote_lines|save_quote|billing_code_bundles|billing_code_bundle_lines|save_code_bundle)\b/i;

/** True when the quote or bundle tables / functions are not in the database yet. */
export function isQuotesNotEnabledError(error: unknown): boolean {
  if (error instanceof QuotesNotEnabledError) return true;
  if (!error || typeof error !== 'object') return false;
  const { code, message } = error as DbError;
  // Only our own objects: any other missing table or function is a real error and is shown as one
  if (!OWN_OBJECTS.test(message ?? '')) return false;
  if (code === '42P01' || code === '42883' || code === 'PGRST202' || code === 'PGRST205') return true;
  return /could not find the (table|function)|does not exist/i.test(message ?? '');
}

const fail = (error: DbError, fallback: string): never => {
  if (isQuotesNotEnabledError(error)) throw new QuotesNotEnabledError();
  throw new Error(error.message || fallback);
};

// ---------------------------------------------------------------------------------------------------
// Tariffs
// ---------------------------------------------------------------------------------------------------

export interface TariffSet {
  practiceId: string;
  practiceType: string | null;
  /** Every tariff row of the practice type; billableOn() picks what may be billed on a date */
  rows: VisitTariff[];
  /** The fund prices of the practice type and the practice's contracts (empty until the fund tables exist) */
  book: FundPriceBook;
  /** Set when the fund prices exist but could not be read */
  bookError: string | null;
  /** 8109 clinical staff count (practice setting, 1-3) */
  infectionControlStaff: number;
}

/**
 * The practice type, its tariff rows (the shared list with the practice's own codes, loadPracticeTariffRows, as the
 * visit screens load them), its fund prices and the 8109 staff count.
 */
export async function loadTariffSet(practiceId: string): Promise<TariffSet> {
  const { data: practice, error: practiceError } = await supabase
    .from('practices')
    .select('practice_type')
    .eq('id', practiceId)
    .maybeSingle();
  if (practiceError) throw new Error(`Could not read the practice: ${practiceError.message}`);
  const practiceType = practice?.practice_type ?? null;
  if (!practiceType) throw new Error('The practice type is not set, so its tariff list is unknown.');
  const { rows: tariffRows, problems } = await loadPracticeTariffRows(practiceId, practiceType);
  problems.forEach(problem => console.warn(problem));
  const rows: VisitTariff[] = tariffRows;
  const [bookLoad, infectionControlStaff] = await Promise.all([
    loadFundPriceBook(practiceId, practiceType),
    loadInfectionControlStaff(practiceId)
  ]);
  return { practiceId, practiceType, rows, book: bookLoad.book, bookError: bookLoad.error, infectionControlStaff };
}

/**
 * The tariffs that may be billed on a date (yyyy-MM-dd): active, in effect, one version per code, priced for the
 * patient's fund when one is given (the fund's price where its schedule has the code, otherwise the practice tariff),
 * at the patient's own price rate when they have one (patientRates.ts), as the visit prices them.
 */
export const billableOn = (set: TariffSet, dateKey: string, fund: PatientFundKey | null = null, patientRate: PatientRate | null = null): VisitTariff[] =>
  priceForPatient(withDisciplineRules(billableVisitTariffs(set.rows, dateKey), set.practiceType), dateKey, {
    practiceId: set.practiceId,
    fund,
    book: set.book ?? EMPTY_PRICE_BOOK,
    patientRate
  });

// ---------------------------------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------------------------------

const BUNDLE_COLUMNS = 'id, practice_id, name, colour, description, sort_order, preset_key, updated_at';
const BUNDLE_LINE_COLUMNS = 'bundle_id, line_no, code, quantity, tooth_number, notes';
/** proposals/2026-10-09-bundle-extras.sql: a line's ICD-10 code, fee and stock item; "needs an authorisation number" */
const BUNDLE_EXTRA_COLUMNS = { bundle: 'needs_authorisation', line: 'icd10_code, fee, stock_item_id' };

/** True when PostgREST says a column is not there (the bundle-extras update is not applied). */
const isMissingColumn = (error: DbError | null): boolean =>
  Boolean(error && (error.code === '42703' || error.code === 'PGRST204' || /column .* does not exist|could not find the .* column/i.test(error.message ?? '')));

let bundleExtras: boolean | null = null;

/** Whether bundles can carry an ICD-10 code, fee and stock item per line (remembered once known). */
export async function loadBundleExtrasEnabled(): Promise<boolean> {
  if (bundleExtras !== null) return bundleExtras;
  const { error } = await db.from('billing_code_bundle_lines').select(BUNDLE_EXTRA_COLUMNS.line).limit(0);
  if (error && !isMissingColumn(error)) return false;
  bundleExtras = !error;
  return bundleExtras;
}

export async function loadBundles(practiceId: string): Promise<CodeBundle[]> {
  const read = (extras: boolean) =>
    Promise.all([
      db
        .from('billing_code_bundles')
        .select(extras ? `${BUNDLE_COLUMNS}, ${BUNDLE_EXTRA_COLUMNS.bundle}` : BUNDLE_COLUMNS)
        .eq('practice_id', practiceId),
      db
        .from('billing_code_bundle_lines')
        .select(extras ? `${BUNDLE_LINE_COLUMNS}, ${BUNDLE_EXTRA_COLUMNS.line}` : BUNDLE_LINE_COLUMNS)
        .eq('practice_id', practiceId)
    ]);
  let [bundles, lines] = await read(bundleExtras !== false);
  // Before the bundle-extras update the plain columns are read, as before
  if (isMissingColumn(bundles.error) || isMissingColumn(lines.error)) {
    bundleExtras = false;
    [bundles, lines] = await read(false);
  }
  if (bundles.error) fail(bundles.error, 'Could not load the code bundles');
  if (lines.error) fail(lines.error, 'Could not load the code bundle lines');
  // The column list is chosen at run time, so the client cannot type the rows
  return toCodeBundles((bundles.data ?? []) as unknown as BundleRow[], (lines.data ?? []) as unknown as BundleLineRow[]);
}

/** Saves a checked draft (validateBundleDraft) and returns its id. */
export async function saveBundle(practiceId: string, draft: BundleDraft): Promise<string> {
  const { data, error } = await db.rpc('save_code_bundle', bundleSavePayload(practiceId, draft));
  if (error) {
    if (error.code === '23505') throw new Error(`There is already a bundle called "${draft.name.trim()}". Choose another name.`);
    fail(error, 'Could not save the bundle');
  }
  return String(data);
}

export async function deleteBundle(bundleId: string): Promise<void> {
  const { error } = await db.from('billing_code_bundles').delete().eq('id', bundleId);
  if (error) fail(error, 'Could not delete the bundle');
}

// ---------------------------------------------------------------------------------------------------
// The patient's medical aid and the fund's rates
// ---------------------------------------------------------------------------------------------------

export interface PatientFund {
  /** The patient has a medical_aid_details record: the same check invoiceService makes */
  hasMedicalAid: boolean;
  fundName: string | null;
  scheme: string | null;
  membershipNumber: string | null;
  /** The fund code and plan options the patient's lines are priced with (billableOn) */
  pricingFund: PatientFundKey | null;
  /** Set when the fund could not be identified: lines get the practice tariff and the estimate shows no fund rates */
  ratesError: string | null;
  /** The patient's own price rate (patientRates.ts; R28): the quote is priced with it, as the visit is */
  patientRate?: PatientRate | null;
}

/** The patient's medical aid and own price rate, as the quote is priced (a rate that cannot be read stops the quote). */
export async function loadPatientFund(patientId: string): Promise<PatientFund> {
  const [fund, rate] = await Promise.all([loadPatientFundDetails(patientId), loadPatientRate(patientId)]);
  if (rate.status === 'error') throw new Error(`Could not read the patient's price rate: ${rate.message}`);
  return { ...fund, patientRate: rate.rate };
}

async function loadPatientFundDetails(patientId: string): Promise<PatientFund> {
  const { data: details, error } = await supabase
    .from('medical_aid_details')
    .select('provider, scheme, plan_type, membership_number')
    .eq('patient_id', patientId)
    .limit(1);
  if (error) throw new Error(`Could not read the patient's medical aid: ${error.message}`);
  const record = details?.[0];
  if (!record) return { hasMedicalAid: false, fundName: null, scheme: null, membershipNumber: null, pricingFund: null, ratesError: null };
  const key = await loadPatientFundKey({ patientId });
  return {
    hasMedicalAid: true,
    fundName: record.provider?.trim() || null,
    scheme: record.scheme?.trim() || record.plan_type?.trim() || null,
    membershipNumber: record.membership_number?.trim() || null,
    pricingFund: key.fund,
    ratesError: key.error
  };
}

// ---------------------------------------------------------------------------------------------------
// Quotes
// ---------------------------------------------------------------------------------------------------

const QUOTE_COLUMNS =
  'id, practice_id, patient_id, quote_number, status, quote_date, valid_until, medical_aid_name, medical_aid_scheme, ' +
  'membership_number, estimate_basis, estimate_note, preauth_number, fund_reference, notes, subtotal, medical_aid_estimate, ' +
  'patient_estimate, sent_at, sent_via, accepted_at, declined_at, converted_invoice_id, converted_visit_id, converted_at, created_at, updated_at';

const LINE_COLUMNS =
  'id, line_no, tariff_id, code, description, quantity, unit_price, total_price, tooth_numbers, notes, is_auto_generated, ' +
  'parent_line_id, medical_aid_estimate, patient_estimate, estimate_basis';

const ID_CHUNK = 200;

async function loadPatientNames(patientIds: readonly string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  for (let start = 0; start < patientIds.length; start += ID_CHUNK) {
    const { data, error } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .in('id', patientIds.slice(start, start + ID_CHUNK));
    if (error) throw new Error(`Could not read the patients' names: ${error.message}`);
    (data ?? []).forEach(patient => names.set(patient.id, `${patient.first_name ?? ''} ${patient.last_name ?? ''}`.trim()));
  }
  return names;
}

/** A practice's quotes, newest first (optionally one patient's), with patient names. */
export async function loadQuotes(options: { practiceId: string; patientId?: string | null; limit?: number }): Promise<QuoteRecord[]> {
  let query = db
    .from('quotes')
    .select(QUOTE_COLUMNS)
    .eq('practice_id', options.practiceId)
    .order('created_at', { ascending: false })
    .limit(options.limit ?? 500);
  if (options.patientId) query = query.eq('patient_id', options.patientId);
  const { data, error } = await query;
  if (error) fail(error, 'Could not load the quotes');
  const rows = (data ?? []) as unknown as QuoteRow[];
  const names = await loadPatientNames([...new Set(rows.map(row => row.patient_id))]);
  return rows.map(row => toQuoteRecord(row, names.get(row.patient_id) ?? null));
}

export interface QuoteWithLines {
  quote: QuoteRecord;
  lines: QuoteLineRecord[];
}

export async function loadQuote(quoteId: string): Promise<QuoteWithLines> {
  const [quote, lines] = await Promise.all([
    db.from('quotes').select(QUOTE_COLUMNS).eq('id', quoteId).maybeSingle(),
    db.from('quote_lines').select(LINE_COLUMNS).eq('quote_id', quoteId).order('line_no', { ascending: true })
  ]);
  if (quote.error) fail(quote.error, 'Could not load the quote');
  if (lines.error) fail(lines.error, 'Could not load the quote lines');
  if (!quote.data) throw new Error('This quote no longer exists, or you do not have access to it.');
  const row = quote.data as unknown as QuoteRow;
  const names = await loadPatientNames([row.patient_id]);
  return {
    quote: toQuoteRecord(row, names.get(row.patient_id) ?? null),
    lines: ((lines.data ?? []) as unknown as QuoteLineRow[]).map(toQuoteLineRecord)
  };
}

export interface QuoteSaveInput {
  id: string | null;
  practiceId: string;
  patientId: string;
  /** Saving an edited quote that was sent makes it a draft again (send it again) */
  status: QuoteStatus;
  quoteDate: string;
  validUntil: string;
  fund: Pick<PatientFund, 'fundName' | 'scheme' | 'membershipNumber'>;
  estimate: Pick<QuoteEstimate, 'basis' | 'note'>;
  preauthNumber: string;
  fundReference: string;
  notes: string;
  lines: readonly QuoteLineRecord[];
}

/** Saves a quote and all its lines at once (save_quote) and returns its id. */
export async function saveQuote(input: QuoteSaveInput): Promise<string> {
  const { data, error } = await db.rpc('save_quote', {
    p_quote: {
      id: input.id,
      practice_id: input.practiceId,
      patient_id: input.patientId,
      status: input.status,
      quote_date: input.quoteDate,
      valid_until: input.validUntil,
      medical_aid_name: input.fund.fundName,
      medical_aid_scheme: input.fund.scheme,
      membership_number: input.fund.membershipNumber,
      estimate_basis: input.estimate.basis,
      estimate_note: input.estimate.note,
      preauth_number: input.preauthNumber.trim() || null,
      fund_reference: input.fundReference.trim() || null,
      notes: input.notes.trim() || null
    },
    p_lines: input.lines.map(line => ({
      id: line.id,
      tariff_id: line.tariffId,
      code: line.code,
      description: line.description,
      quantity: line.quantity,
      unit_price: line.unitPrice,
      total_price: line.totalPrice,
      tooth_numbers: line.toothNumbers.join(',') || null,
      notes: line.notes,
      is_auto_generated: line.isAutoGenerated,
      parent_line_id: line.parentLineId,
      medical_aid_estimate: line.medicalAidEstimate,
      patient_estimate: line.patientEstimate,
      estimate_basis: line.estimateBasis
    }))
  });
  if (error) fail(error, 'Could not save the quote');
  return String(data);
}

/** Moves a quote to another status (the database refuses changes that are not allowed). */
export async function setQuoteStatus(quoteId: string, status: QuoteStatus): Promise<void> {
  const { error } = await db.from('quotes').update({ status }).eq('id', quoteId);
  if (error) fail(error, 'Could not change the quote status');
}

/** Drafts only: sent and answered quotes stay as records. */
export async function deleteQuote(quoteId: string): Promise<void> {
  const { data, error } = await db.from('quotes').delete().eq('id', quoteId).eq('status', 'draft').select('id');
  if (error) fail(error, 'Could not delete the quote');
  if (!data || data.length === 0) throw new Error('Only a draft quote can be deleted.');
}

/** The pre-authorisation number and fund reference often arrive after the quote was sent or accepted. */
export async function updateQuoteFundDetails(quoteId: string, preauthNumber: string, fundReference: string): Promise<void> {
  const { error } = await db
    .from('quotes')
    .update({ preauth_number: preauthNumber.trim() || null, fund_reference: fundReference.trim() || null })
    .eq('id', quoteId);
  if (error) fail(error, 'Could not save the pre-authorisation details');
}

export interface PatientContact {
  firstName: string | null;
  name: string;
  phone: string | null;
  email: string | null;
}

export async function loadPatientContact(patientId: string): Promise<PatientContact> {
  const { data, error } = await supabase
    .from('patients')
    .select('first_name, last_name, cell_number, email')
    .eq('id', patientId)
    .maybeSingle();
  if (error) throw new Error(`Could not read the patient's contact details: ${error.message}`);
  return {
    firstName: data?.first_name?.trim() || null,
    name: `${data?.first_name ?? ''} ${data?.last_name ?? ''}`.trim() || 'Patient',
    phone: data?.cell_number?.trim() || null,
    email: data?.email?.trim() || null
  };
}

/** The invoice number of a converted quote's invoice (null when it cannot be read). */
export async function loadInvoiceNumber(invoiceId: string): Promise<string | null> {
  const { data, error } = await supabase.from('invoices_enhanced').select('invoice_number').eq('id', invoiceId).maybeSingle();
  if (error) return null;
  return data?.invoice_number ?? null;
}

/** Records that the patient was given the quote; only drafts and sent quotes change status. */
export async function markQuoteSent(quote: Pick<QuoteRecord, 'id' | 'status'>, via: 'sms' | 'email' | 'print'): Promise<void> {
  if (quote.status !== 'draft' && quote.status !== 'sent') return;
  const { error } = await db.from('quotes').update({ status: 'sent', sent_via: via, sent_at: new Date().toISOString() }).eq('id', quote.id);
  if (error) fail(error, 'Could not record that the quote was sent');
}

// ---------------------------------------------------------------------------------------------------
// Printing and sending
// ---------------------------------------------------------------------------------------------------

export async function loadLetterhead(practiceId: string): Promise<PracticeLetterhead> {
  // With the practice's message for its documents (parity D22; never fails: no message when it cannot be read)
  const [{ data, error }, documentSettings] = await Promise.all([
    supabase
      .from('practices')
      .select('id, name, contact_phone, contact_email, address, city, country, postal_code, practice_number, license_number, tax_number, primary_color, bank_name, account_number, branch_code, practice_type')
      .eq('id', practiceId)
      .maybeSingle(),
    loadDocumentSettings(practiceId)
  ]);
  if (error) throw new Error(`Could not read the practice details: ${error.message}`);
  if (!data) throw new Error('The practice details could not be found.');
  return {
    id: data.id,
    name: data.name,
    contactPhone: data.contact_phone,
    contactEmail: data.contact_email,
    address: data.address,
    city: data.city,
    country: data.country,
    postalCode: data.postal_code,
    practiceNumber: data.practice_number,
    licenseNumber: data.license_number,
    taxNumber: data.tax_number,
    primaryColor: data.primary_color,
    bankName: data.bank_name,
    accountNumber: data.account_number,
    branchCode: data.branch_code,
    documentSettings,
    // A dental practice's quote prints the tooth of each line (quotePdf.ts)
    practiceType: data.practice_type ?? null
  };
}

/** Downloads the quote PDF in the practice's invoice style. */
export function downloadQuotePdf(quote: QuoteRecord, lines: readonly QuoteLineRecord[], letterhead: PracticeLetterhead, patient: QuotePatientInfo): void {
  const printable = buildQuoteDocument(quote, lines, letterhead, patient);
  renderQuotePdf(printable).save(printable.fileName);
}

export interface SendResult {
  ok: boolean;
  message: string;
}

export async function sendQuoteSms(params: { quote: QuoteRecord; phone: string; message: string }): Promise<SendResult> {
  const { quote } = params;
  const response = await communicationService.sendSMS({
    practiceId: quote.practiceId,
    recipientPhone: params.phone.trim(),
    messageContent: params.message.trim(),
    messageType: 'custom',
    patientId: quote.patientId,
    metadata: { kind: 'quote', quoteId: quote.id, quoteNumber: quote.quoteNumber, total: quote.subtotal, source: 'quote_sms' },
    tags: ['quote']
  });
  if (!response.success) return { ok: false, message: getCommunicationErrorMessage('sms', response.error) };
  await markQuoteSent(quote, 'sms');
  return { ok: true, message: `Quote ${quote.quoteNumber} sent by SMS.` };
}

export async function sendQuoteEmail(params: {
  quote: QuoteRecord;
  lines: readonly QuoteLineRecord[];
  letterhead: PracticeLetterhead;
  patient: QuotePatientInfo;
  email: string;
  /** The subject and message staff checked (EmailDocumentForm); without them the quote's own wording */
  checked?: { subject: string; message: string; recipientName: string | null };
}): Promise<SendResult> {
  const { quote, lines, letterhead, patient, checked } = params;
  const content = checked
    ? { subject: checked.subject.trim(), html: messageHtml(checked.message), text: checked.message.trim() }
    : quoteEmailContent({
        practiceName: letterhead.name,
        practicePhone: letterhead.contactPhone,
        practiceEmail: letterhead.contactEmail,
        patientName: patient.name,
        quote,
        lines
      });
  const printable = buildQuoteDocument(quote, lines, letterhead, patient);
  const response = await communicationService.sendEmail({
    practiceId: quote.practiceId,
    recipientEmail: params.email.trim(),
    recipientName: checked?.recipientName ?? patient.name,
    subject: content.subject,
    htmlContent: content.html,
    textContent: content.text,
    emailType: 'custom',
    patientId: quote.patientId,
    attachments: [{ filename: printable.fileName, content: quotePdfBase64(renderQuotePdf(printable)), type: 'application/pdf' }],
    metadata: { kind: 'quote', quoteId: quote.id, quoteNumber: quote.quoteNumber, total: quote.subtotal, attachmentNames: [printable.fileName] },
    tags: ['quote']
  });
  if (!response.success) return { ok: false, message: getCommunicationErrorMessage('email', response.error) };
  await markQuoteSent(quote, 'email');
  return { ok: true, message: `Quote ${quote.quoteNumber} emailed to ${params.email.trim()}.` };
}

// ---------------------------------------------------------------------------------------------------
// Converting to an invoice
// ---------------------------------------------------------------------------------------------------

export interface VisitOption {
  id: string;
  date: string | null;
  type: string | null;
  status: string | null;
  complaint: string | null;
}

/**
 * The patient's visits that can take the invoice: not cancelled and without an invoice yet (the visit
 * screens show one invoice per visit, so a second one would be hidden there). A row that only carries invoices
 * (utils/carrierVisits.ts) is never offered.
 */
export async function loadConvertibleVisits(patientId: string): Promise<VisitOption[]> {
  const { data: visits, error } = await supabase
    .from('visits')
    .select('id, visit_date, visit_type, status, chief_complaint, is_cancelled')
    .eq('patient_id', patientId)
    .or(EXCLUDE_CARRIER_VISITS)
    .order('visit_date', { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) throw new Error(`Could not load the patient's visits: ${error.message}`);
  const open = (visits ?? []).filter(visit => visit.is_cancelled !== true && visit.status !== 'cancelled');
  if (open.length === 0) return [];
  const { data: invoices, error: invoiceError } = await supabase
    .from('invoices_enhanced')
    .select('visit_id')
    .in('visit_id', open.map(visit => visit.id));
  if (invoiceError) throw new Error(`Could not check the visits' invoices: ${invoiceError.message}`);
  const invoiced = new Set((invoices ?? []).map(invoice => invoice.visit_id));
  return open
    .filter(visit => !invoiced.has(visit.id))
    .map(visit => ({
      id: visit.id,
      date: visit.visit_date,
      type: visit.visit_type,
      status: visit.status,
      complaint: visit.chief_complaint
    }));
}

export interface ConversionResult {
  invoiceId: string;
  invoiceNumber: string;
  /** Set when the invoice was created but the quote could not be marked as invoiced */
  linkError: string | null;
}

/** Marks a quote as invoiced and links it to its invoice (the database checks patient and practice). */
export async function linkQuoteToInvoice(quoteId: string, invoiceId: string, visitId: string): Promise<void> {
  const { error } = await db
    .from('quotes')
    .update({ status: 'converted', converted_invoice_id: invoiceId, converted_visit_id: visitId })
    .eq('id', quoteId);
  if (error) fail(error, 'Could not link the quote to its invoice');
}

/**
 * Creates the invoice for the chosen visit from the re-priced lines (repriceQuoteLines), then links the
 * quote. The quote is read again first, so a quote someone else already converted is not invoiced twice.
 */
export async function convertQuoteToInvoice(params: {
  quote: QuoteRecord;
  visitId: string;
  services: ServiceSelection[];
}): Promise<ConversionResult> {
  const { quote } = params;
  const { data: current, error } = await db.from('quotes').select('status').eq('id', quote.id).maybeSingle();
  if (error) fail(error, 'Could not check the quote before invoicing');
  const status = (current as { status?: string } | null)?.status;
  if (status !== 'accepted') {
    throw new Error(status === 'converted' ? 'This quote has already been invoiced.' : 'Only an accepted quote can be invoiced. Mark it as accepted first.');
  }
  const invoice = await invoiceService.createInvoice({
    patientId: quote.patientId,
    visitId: params.visitId,
    services: params.services,
    practiceId: quote.practiceId,
    notes: `From quote ${quote.quoteNumber}`
  });
  const invoiceId = String(invoice?.id ?? '');
  const invoiceNumber = String(invoice?.invoiceNumber ?? invoice?.invoice_number ?? '');
  try {
    await linkQuoteToInvoice(quote.id, invoiceId, params.visitId);
    return { invoiceId, invoiceNumber, linkError: null };
  } catch (linkError) {
    return { invoiceId, invoiceNumber, linkError: linkError instanceof Error ? plainWords(linkError.message) : 'unknown error' };
  }
}

