import { format, isValid, parseISO } from 'date-fns';
import { formatCount, formatDateKey, formatNad, formatPercent } from './financeFormat';

export type ColumnType = 'text' | 'date' | 'money' | 'count' | 'percent';
export type CsvCell = string | number | null | undefined;

export interface ExportColumn {
  header: string;
  type: ColumnType;
}

/** A finished report table, shared by the on-screen preview, CSV export and print */
export interface ReportTable {
  title: string;
  /** What the figures cover, e.g. "Issued 1-6 Oct 2026" or "As at 6 Oct 2026" */
  basis: string;
  columns: ExportColumn[];
  rows: CsvCell[][];
  totals?: CsvCell[];
  notes?: string[];
}

// A cell starting with one of these is run as a formula by spreadsheet apps (CSV injection)
const FORMULA_START = /^[=+\-@\t\r]/;

function csvValue(value: CsvCell, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return '';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '';
    if (type === 'money') return value.toFixed(2);
    if (type === 'percent') return (value * 100).toFixed(1);
    return String(value);
  }
  let text = value;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV for spreadsheets: money as plain 2-decimal numbers (no N$ or thousands separators),
 * percentages as numbers (45.2 = 45.2%), dates as yyyy-MM-dd. Text that would run as a
 * formula is prefixed with an apostrophe.
 */
export function toCsv(columns: ExportColumn[], rows: CsvCell[][]): string {
  const header = columns.map(column => csvValue(column.header, 'text')).join(',');
  const body = rows.map(row => columns.map((column, i) => csvValue(row[i], column.type)).join(','));
  return [header, ...body].join('\r\n');
}

export const reportToCsv = (report: ReportTable): string =>
  toCsv(report.columns, report.totals ? [...report.rows, report.totals] : report.rows);

/** File-name friendly slug: "AR aging (6 Oct)" -> "ar-aging-6-oct" */
export const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

export const exportFileName = (title: string, date = new Date()): string =>
  `${slugify(title)}-${format(date, 'yyyy-MM-dd')}.csv`;

/** Start a CSV download (UTF-8 with BOM so Excel keeps accents in names) */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

export const downloadReportCsv = (report: ReportTable): void =>
  downloadCsv(exportFileName(report.title), reportToCsv(report));

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Human-readable cell text (on screen and in print) */
export function displayValue(value: CsvCell, type: ColumnType): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    if (type === 'money') return formatNad(value);
    if (type === 'percent') return formatPercent(value);
    return formatCount(value);
  }
  // Text in a date column that is not a date (the "Total" label of a report listed by day) is shown as written
  return type === 'date' && isValid(parseISO(value)) ? formatDateKey(value) : value;
}

const isNumeric = (type: ColumnType) => type === 'money' || type === 'count' || type === 'percent';

/** A self-contained, escaped HTML document for printing a report */
export function reportToHtml(report: ReportTable, practiceName: string, generatedAt = new Date()): string {
  const cell = (value: CsvCell, type: ColumnType, tag: 'td' | 'th' = 'td') =>
    `<${tag} class="${isNumeric(type) ? 'num' : ''}">${escapeHtml(displayValue(value, type))}</${tag}>`;
  const head = report.columns
    .map(column => `<th class="${isNumeric(column.type) ? 'num' : ''}">${escapeHtml(column.header)}</th>`)
    .join('');
  const body = report.rows.map(row => `<tr>${report.columns.map((c, i) => cell(row[i], c.type)).join('')}</tr>`).join('');
  const totals = report.totals
    ? `<tfoot><tr>${report.columns.map((c, i) => cell(report.totals?.[i], c.type, 'th')).join('')}</tr></tfoot>`
    : '';
  const notes = (report.notes ?? []).map(note => `<p class="note">${escapeHtml(note)}</p>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(report.title)}</title>
<style>
body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#111827;margin:32px}
h1{font-size:20px;margin:0 0 4px}.meta{color:#6B7280;font-size:12px;margin:0 0 16px}
table{width:100%;border-collapse:collapse;font-size:12px}th,td{padding:6px 8px;border-bottom:1px solid #E5E7EB;text-align:left}
thead th{background:#F9FAFB;color:#4B5563;text-transform:uppercase;font-size:10px;letter-spacing:.04em}
tfoot th{border-top:2px solid #9CA3AF}.num{text-align:right;font-variant-numeric:tabular-nums}
.note{color:#6B7280;font-size:11px;margin:12px 0 0}
</style></head><body>
<h1>${escapeHtml(report.title)}</h1>
<p class="meta">${escapeHtml(practiceName)} &middot; ${escapeHtml(report.basis)} &middot; Generated ${escapeHtml(format(generatedAt, 'd MMM yyyy, HH:mm'))}</p>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody>${totals}</table>${notes}
</body></html>`;
}

/** Open the report in a print window. Returns false when the browser blocked the window. */
export function printReport(report: ReportTable, practiceName: string): boolean {
  const printWindow = window.open('', '_blank', 'width=960,height=720');
  if (!printWindow) return false;
  printWindow.document.open();
  printWindow.document.write(reportToHtml(report, practiceName));
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
  return true;
}
