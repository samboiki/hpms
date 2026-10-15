import type { ReportTable } from '../financeExport';

/**
 * What a row of a Finance report opens (bi-directional links: every row opens what it counts). The report screens
 * turn a target into a link or a sheet (useReportOpener); the CSV and the print never carry it.
 */
export type ReportTarget =
  /** The patient's file, on its Account tab unless another tab says more (Billing: 'billing', Change history: 'audit') */
  | { kind: 'patient'; id: string; tab?: 'billing' | 'audit' }
  | { kind: 'invoice'; id: string }
  | { kind: 'receipt'; id: string }
  | { kind: 'batch'; id: string }
  | { kind: 'batches'; ids: string[]; label: string }
  | { kind: 'claim_line'; id: string }
  | { kind: 'claim_lines'; ids: string[]; label: string }
  | { kind: 'visits'; ids: string[]; label: string }
  /** The records behind a summary row (a fund's invoices, a day's payments, a category's stock items), each opening its own */
  | { kind: 'records'; label: string; items: RecordItem[] }
  /** A place elsewhere in the app where the record is kept (a stock item, Settings > Users for payslips) */
  | { kind: 'link'; href: string };

/** One record in a list a report row opens: what it is, a line about it, its amount and what it opens */
export interface RecordItem {
  key: string;
  /** "Invoice INV-1", "Receipt RC-000001", "Paracetamol 500 mg" */
  title: string;
  /** "Example Patient · 3 Oct 2026" */
  detail?: string;
  /** N$; negative for money paid out (a refund) */
  amount?: number | null;
  target: ReportTarget | null;
}

/** A report table with what each row opens (null: the row opens nothing, e.g. a fund payment not linked to a file) */
export interface LinkedReport {
  table: ReportTable;
  targets: Array<ReportTarget | null>;
  /** What each row is called in its link's accessible name ("Open invoice INV-1"); else its first text cell */
  names?: string[];
}

/** The words of a row's link for screen readers: "Open invoice INV-1" */
export function targetLabel(target: ReportTarget, rowName: string): string {
  switch (target.kind) {
    case 'patient':
      return `Open the patient file of ${rowName}`;
    case 'invoice':
      return `Open invoice ${rowName}`;
    case 'receipt':
      return `Open payment ${rowName}`;
    case 'batch':
      return `Open claim batch ${rowName}`;
    case 'batches':
      return `Open the claim batches of ${rowName}`;
    case 'claim_line':
      return `Open the story of claim line ${rowName}`;
    case 'claim_lines':
      return `Open the claim lines of ${rowName}`;
    case 'visits':
      return `Open the visits of ${rowName}`;
    case 'records':
      return `Open the ${target.label}`;
    case 'link':
      return `Open ${rowName}`;
  }
}

/** Staff and practitioner names by user id, for reports that name who did or treated something */
export type StaffNames = Readonly<Record<string, string>>;

/** A person's name as the practice's staff list has it; someone no longer listed is said so, never shown as an id */
export const staffName = (userId: string | null | undefined, names: StaffNames, fallback = 'Someone not on the staff list'): string =>
  (userId && names[userId]?.trim()) || fallback;
