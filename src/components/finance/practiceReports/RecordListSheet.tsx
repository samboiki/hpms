import React from 'react';
import { Icon } from '@iconify/react';
import { formatNad } from '../financeFormat';
import { EmptyState } from '../FinanceUI';
import { Sheet } from '../receipts/ArUi';
import type { RecordItem, ReportTarget } from './reportTargets';

const capitalised = (text: string): string => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/**
 * The records behind one row of a report (a fund's invoices, a day's payments, a category's stock items): a list in the
 * look of the claim batch list, each opening its own record. The list closes when one is opened.
 */
export const RecordListSheet: React.FC<{ label: string; items: readonly RecordItem[]; onOpen: (target: ReportTarget) => void; onClose: () => void }> = ({ label, items, onOpen, onClose }) => (
  <Sheet open onClose={onClose} title={capitalised(label)} subtitle="Open one to see it in full" icon="solar:list-bold-duotone" size="lg">
    {items.length === 0 ? (
      <EmptyState compact icon="solar:list-bold-duotone" title="Nothing to open" message="No record is behind this figure." />
    ) : (
      <ul className="divide-y divide-gray-100">
        {items.map(item => {
          const body = (
            <>
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{item.title}</span>
                {item.detail && <span className="ml-2 text-xs text-gray-500">{item.detail}</span>}
              </span>
              <span className="inline-flex items-center gap-1 tabular-nums text-gray-700">
                {typeof item.amount === 'number' ? formatNad(item.amount) : ''}
                {item.target && <Icon icon="solar:alt-arrow-right-bold-duotone" className="h-4 w-4 text-gray-400" aria-hidden="true" />}
              </span>
            </>
          );
          const target = item.target;
          return (
            <li key={item.key}>
              {target ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpen(target);
                  }}
                  className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left text-sm hover:bg-cyan-50/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                >
                  {body}
                </button>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    )}
  </Sheet>
);

export default RecordListSheet;
