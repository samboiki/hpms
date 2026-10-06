import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';

export interface TableColumn<T> {
  key: string;
  header: string;
  align?: 'left' | 'right' | 'center';
  render: (row: T) => React.ReactNode;
  /** Hide on small screens to keep the table readable on a phone */
  hideBelow?: 'sm' | 'md' | 'lg';
}

interface DataTableProps<T> {
  rows: T[];
  columns: TableColumn<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  /** Accessible name of a clickable row, e.g. "Open invoice INV-001" */
  rowLabel?: (row: T) => string;
  /** Rows per page; 0 shows every row */
  pageSize?: number;
  /** Changing this returns to page 1 (pass a string of the active filters) */
  resetKey?: string;
  /** Cells aligned with the columns, shown as a totals row */
  totals?: React.ReactNode[];
  itemLabel?: string;
  empty?: React.ReactNode;
}

const HIDE_CLASSES = { sm: 'hidden sm:table-cell', md: 'hidden md:table-cell', lg: 'hidden lg:table-cell' };
const ALIGN_CLASSES = { left: 'text-left', right: 'text-right tabular-nums', center: 'text-center' };

/** Patients-style table with pagination; used by every Finance list and ledger */
export function DataTable<T>({ rows, columns, rowKey, onRowClick, rowLabel, pageSize = 25, resetKey, totals, itemLabel = 'rows', empty }: DataTableProps<T>) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey]);

  if (rows.length === 0 && empty) return <>{empty}</>;

  const pageCount = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, pageCount);
  const start = pageSize > 0 ? (currentPage - 1) * pageSize : 0;
  const visible = pageSize > 0 ? rows.slice(start, start + pageSize) : rows;
  const cellClass = (column: TableColumn<T>) =>
    `${ALIGN_CLASSES[column.align ?? 'left']} ${column.hideBelow ? HIDE_CLASSES[column.hideBelow] : ''}`;

  return (
    <div>
      {/* One scroll container (its rounded corners clip the table): wide tables scroll sideways on
          small screens instead of being cut off by a clipping wrapper */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {columns.map(column => (
                  <th key={column.key} scope="col" className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${cellClass(column)}`}>
                    {column.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {visible.map(row => (
                <tr
                  key={rowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  onKeyDown={onRowClick ? event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onRowClick(row);
                    }
                  } : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  aria-label={onRowClick && rowLabel ? rowLabel(row) : undefined}
                  className={onRowClick ? 'cursor-pointer hover:bg-cyan-50/40 focus:bg-cyan-50/60 focus:outline-none transition-colors' : 'hover:bg-gray-50 transition-colors'}
                >
                  {columns.map(column => (
                    <td key={column.key} className={`px-4 py-3 text-sm text-gray-700 whitespace-nowrap ${cellClass(column)}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {totals && (
              <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                <tr>
                  {columns.map((column, i) => (
                    <td key={column.key} className={`px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap ${cellClass(column)}`}>
                      {totals[i] ?? ''}
                    </td>
                  ))}
                </tr>
              </tfoot>
            )}
          </table>
      </div>

      {pageSize > 0 && rows.length > pageSize && (
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-gray-600">
            Showing {start + 1} to {Math.min(start + pageSize, rows.length)} of {rows.length.toLocaleString('en-NA')} {itemLabel}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4 mr-1" aria-hidden="true" />
              Previous
            </button>
            <span className="text-sm text-gray-600 px-2">Page {currentPage} of {pageCount}</span>
            <button
              type="button"
              onClick={() => setPage(Math.min(pageCount, currentPage + 1))}
              disabled={currentPage === pageCount}
              className="inline-flex items-center px-3 py-2 text-sm font-medium rounded-lg bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4 ml-1" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
