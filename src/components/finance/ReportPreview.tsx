import React from 'react';
import { displayValue, type CsvCell, type ReportTable } from './financeExport';
import { EmptyState } from './FinanceUI';
import { DataTable, type TableColumn } from './DataTable';

interface PreviewRow {
  key: string;
  cells: CsvCell[];
}

interface ReportPreviewProps {
  report: ReportTable;
  empty: { title: string; hint: string };
  pageSize?: number;
  /** A row that opens what it counts (a report's own links); the print and the CSV never carry it */
  onRowClick?: (index: number) => void;
  /** Its accessible name, e.g. "Open invoice INV-1" */
  rowLabel?: (index: number) => string;
  /** Back to page 1 when the report's filters change (the title alone may stay the same) */
  resetKey?: string;
}

/** A report table on screen, as it prints and exports: rows, a totals row and its notes */
export const ReportPreview: React.FC<ReportPreviewProps> = ({ report, empty, pageSize, onRowClick, rowLabel, resetKey }) => {
  const rows: PreviewRow[] = report.rows.map((cells, index) => ({ key: String(index), cells }));
  const columns: TableColumn<PreviewRow>[] = report.columns.map((column, index) => ({
    key: `${index}`,
    header: column.header,
    align: column.type === 'money' || column.type === 'count' || column.type === 'percent' ? 'right' : 'left',
    render: row => displayValue(row.cells[index], column.type)
  }));
  return (
    <>
      <DataTable
        rows={rows}
        columns={columns}
        rowKey={row => row.key}
        resetKey={resetKey ?? report.title}
        onRowClick={onRowClick ? row => onRowClick(Number(row.key)) : undefined}
        rowLabel={rowLabel ? row => rowLabel(Number(row.key)) : undefined}
        itemLabel="rows"
        pageSize={pageSize}
        totals={report.totals?.map((cell, index) => (cell === null || cell === undefined || cell === '' ? '' : displayValue(cell, report.columns[index].type)))}
        empty={<EmptyState compact icon="solar:document-text-bold-duotone" title={empty.title} message={empty.hint} />}
      />
      {report.notes && report.notes.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs text-gray-500 list-disc pl-4">
          {report.notes.map(note => <li key={note}>{note}</li>)}
        </ul>
      )}
    </>
  );
};
