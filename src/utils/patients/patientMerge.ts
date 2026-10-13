/**
 * Plain words for merging two patient files (merge_patients / undo_patient_merge in
 * proposals/2026-10-09-patient-merge.sql), and which file to suggest keeping.
 *
 * The database counts what a merge moved per table ("visits": 3, "invoices_enhanced": 2); reception knows these as
 * visits, invoices, receipts, claim lines, documents. Tables without a plain name are counted as "other records", so a
 * table added later never shows its database name.
 */
import { patientFileStatus } from './temporaryPatient';

/** Singular and plural, in the order a summary names them (what reception looks for first) */
const RECORD_LABELS: ReadonlyArray<readonly [table: string, singular: string, plural: string]> = [
  ['visits', 'visit', 'visits'],
  ['invoices_enhanced', 'invoice', 'invoices'],
  ['receipts', 'receipt', 'receipts'],
  ['batch_details', 'claim line', 'claim lines'],
  ['invoice_adjustments', 'credit note or adjustment', 'credit notes and adjustments'],
  ['quotes', 'quote', 'quotes'],
  ['patient_documents', 'document', 'documents'],
  ['visit_documents', 'visit document', 'visit documents'],
  ['patient_media', 'photo or file', 'photos and files'],
  ['patient_notes', 'note', 'notes'],
  ['medications', 'medicine', 'medicines'],
  ['lab_requests', 'lab request', 'lab requests'],
  ['imaging_requests', 'imaging request', 'imaging requests'],
  ['patient_allergies', 'allergy', 'allergies'],
  ['patient_problems', 'problem', 'problems'],
  ['patient_letters', 'letter', 'letters'],
  ['leave_forms', 'sick note', 'sick notes'],
  ['medical_aid_details', 'medical aid', 'medical aids'],
  ['next_of_kin', 'next of kin', 'next of kin'],
  ['account_flags', 'account flag', 'account flags'],
  ['account_holder_links', 'family account link', 'family account links'],
  ['patient_list_members', 'list or recall', 'lists and recalls'],
  ['payment_promises', 'payment promise', 'payment promises'],
  ['credit_control_notes', 'credit-control note', 'credit-control notes'],
  ['claim_rejections', 'claim rejection', 'claim rejections'],
  ['remittance_lines', 'fund payment line', 'fund payment lines'],
  ['legacy_claim_lines', 'Eminance claim line', 'Eminance claim lines'],
  ['stock_dispensings', 'dispensed medicine', 'dispensed medicines'],
  ['dental_chart_entries', 'tooth chart entry', 'tooth chart entries'],
  ['optometry_prescriptions', 'eye prescription', 'eye prescriptions'],
  ['practice_sms_logs', 'SMS', 'SMS messages'],
  ['practice_email_logs', 'email', 'emails']
];

const LABEL_ORDER = new Map(RECORD_LABELS.map(([table], index) => [table, index]));
const LABELS = new Map(RECORD_LABELS.map(([table, singular, plural]) => [table, { singular, plural }]));

const counted = (count: number, singular: string, plural: string): string => `${count} ${count === 1 ? singular : plural}`;

const joinWords = (parts: readonly string[]): string =>
  parts.length <= 1 ? (parts[0] ?? '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;

/**
 * "12 visits, 8 invoices, 5 receipts and 9 other records": the record types reception knows first, at most `named` of
 * them, the rest counted together; "nothing" when no rows are counted.
 */
export function describeRecordCounts(counts: Readonly<Record<string, number>> | null | undefined, named = 4): string {
  const entries = Object.entries(counts ?? {}).filter(([, count]) => Number(count) > 0);
  if (entries.length === 0) return 'nothing';
  const known = entries
    .filter(([table]) => LABELS.has(table))
    .sort(([a], [b]) => (LABEL_ORDER.get(a) ?? 0) - (LABEL_ORDER.get(b) ?? 0));
  const shown = known.slice(0, named);
  const rest = entries.filter(entry => !shown.includes(entry)).reduce((sum, [, count]) => sum + Number(count), 0);
  const parts = shown.flatMap(([table, count]) => {
    const label = LABELS.get(table);
    return label ? [counted(Number(count), label.singular, label.plural)] : [];
  });
  if (rest > 0) parts.push(counted(rest, shown.length > 0 ? 'other record' : 'record', shown.length > 0 ? 'other records' : 'records'));
  return joinWords(parts);
}

/** Visits, invoices and claims of one file (patient_record_counts) */
export interface FileRecordCounts {
  visits: number;
  invoices: number;
  claims: number;
}

export interface MergeCandidate {
  id: string;
  id_number: string | null;
  system_patient_reference_number?: number | null;
}

/**
 * The file to suggest keeping: the one with more history (visits, invoices and claims), so fewer rows move and the
 * practice keeps the reference its claims and statements already carry; then a complete file over one booked with a
 * name and cell only; then the older file (lower OneHealth reference). The administrator can always choose the other.
 */
export function suggestKeptFile(
  a: MergeCandidate,
  b: MergeCandidate,
  counts: ReadonlyMap<string, FileRecordCounts> | null | undefined
): string {
  const history = (file: MergeCandidate): number => {
    const count = counts?.get(file.id);
    return count ? count.visits + count.invoices + count.claims : 0;
  };
  if (history(a) !== history(b)) return history(a) > history(b) ? a.id : b.id;
  const incompleteA = patientFileStatus(a).incomplete;
  if (incompleteA !== patientFileStatus(b).incomplete) return incompleteA ? b.id : a.id;
  const reference = (file: MergeCandidate): number => file.system_patient_reference_number ?? Number.MAX_SAFE_INTEGER;
  return reference(b) < reference(a) ? b.id : a.id;
}

/**
 * What undo_patient_merge says was added to the kept file since the merge (its error detail, {"visits": 1}), or null
 * when the detail is not that.
 */
export function parseAddedRecords(detail: string | null | undefined): Record<string, number> | null {
  if (!detail) return null;
  try {
    const parsed: unknown = JSON.parse(detail);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const entries = Object.entries(parsed as Record<string, unknown>).filter(([, value]) => typeof value === 'number' && value > 0);
    return entries.length > 0 ? Object.fromEntries(entries) as Record<string, number> : null;
  } catch {
    return null;
  }
}
