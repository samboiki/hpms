import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { ListSheet } from '../patientLists/ListSheet';
import { stockItemLink } from '../billing/invoiceLinks';
import { loadCountLines, loadCountMovements } from '../../services/stock/stockService';
import { closedCountReport } from '../../utils/stock/stockTake';
import type { StockCount, StockMovement } from '../../utils/stock/stockRows';
import { varianceTable } from './stockDocuments';
import type { StockContext } from './stockContext';
import { Chip } from './stockParts';
import { LINK, SECONDARY, dayTime, errorText, nad, printOrSay, units } from './stockUi';

export const COUNT_STATUS_TONES = { counting: 'cyan', posted: 'green', cancelled: 'gray' } as const;
export const COUNT_STATUS_LABELS: Readonly<Record<StockCount['status'], string>> = { counting: 'Counting', posted: 'Posted', cancelled: 'Cancelled' };

type Loaded = { lines: Map<string, { expected: number; counted: number }>; movements: StockMovement[] };

/**
 * L6: a stock count already posted or cancelled, read only. Each counted item with what the ledger expected, what was
 * counted and the difference (valued as the count posted it), who started it and who posted or cancelled it and when,
 * and its variance report to print again. Opened from Stock take's earlier counts and from an item's history.
 */
export const CountDetailSheet: React.FC<{
  context: StockContext;
  count: StockCount;
  /** The store counted, when the practice has more than one */
  storeName: string | null;
  onClose: () => void;
}> = ({ context, count, storeName, onClose }) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const who = (userId: string | null | undefined) => (userId ? context.staffNames.get(userId) ?? 'A staff member' : 'A staff member');
  const posted = count.status === 'posted';

  useEffect(() => {
    let active = true;
    setLoaded(null);
    setFailed(null);
    Promise.all([loadCountLines(count.id), posted ? loadCountMovements(count.id) : Promise.resolve<StockMovement[]>([])])
      .then(([lines, movements]) => active && setLoaded({ lines, movements }))
      .catch((error: unknown) => active && setFailed(errorText(error, 'Could not load the count')));
    return () => {
      active = false;
    };
  }, [count.id, posted]);

  const report = useMemo(() => {
    if (!loaded) return null;
    const names = new Map(context.items.map(item => [item.id, item] as const));
    return closedCountReport([...loaded.lines].map(([itemId, line]) => ({
      itemId,
      name: names.get(itemId)?.name ?? 'Item',
      unit: names.get(itemId)?.unit ?? 'units',
      expected: line.expected,
      counted: line.counted
    })), loaded.movements);
  }, [loaded, context.items]);

  return (
    <ListSheet
      open
      onClose={onClose}
      title={`Stock count ${count.number}`}
      subtitle={[count.group ? `Group ${count.group}` : 'Every item', storeName].filter(Boolean).join(' · ')}
      size="lg"
      footer={
        <div className="flex justify-end">
          <button
            type="button"
            disabled={!report || report.counted === 0}
            onClick={() => report && printOrSay(varianceTable(`Variance report ${count.number}`, report, posted), context.practiceName)}
            className={SECONDARY}
          >
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Print the variance report
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={COUNT_STATUS_TONES[count.status]}>{COUNT_STATUS_LABELS[count.status]}</Chip>
          {posted && count.valueChangeCents !== null && (
            <span className="text-sm tabular-nums text-gray-700">Stock value changed by {nad(count.valueChangeCents)}</span>
          )}
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Started</dt>
            <dd className="text-gray-800">{dayTime(count.startedAt)} by {who(count.startedBy)}</dd>
          </div>
          {posted && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Posted</dt>
              <dd className="text-gray-800">{dayTime(count.closedAt)} by {who(count.closedBy)}</dd>
            </div>
          )}
          {count.status === 'cancelled' && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Cancelled</dt>
              <dd className="text-gray-800">{dayTime(count.closedAt)} by {who(count.closedBy)}: {count.cancelReason}</dd>
            </div>
          )}
        </dl>
        {count.note && <p className="text-sm text-gray-600">{count.note}</p>}
        {failed ? (
          <p className="text-sm text-red-600" role="alert">{failed}</p>
        ) : !report ? (
          <p className="text-sm text-gray-500" role="status">Loading the counts…</p>
        ) : report.counted === 0 ? (
          <p className="text-sm text-gray-500">Nothing was counted.</p>
        ) : (
          <>
            <p className="text-sm text-gray-600">
              {report.counted} counted, {report.changed} different: {report.unitsShort} short, {report.unitsOver} over
              {posted ? `, ${nad(report.valueCents)} at cost as posted` : ' (nothing was changed on the shelf)'}.
            </p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {report.rows.map(row => (
                <li key={row.itemId} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    {context.items.some(item => item.id === row.itemId) ? <Link to={stockItemLink(row.itemId)} className={LINK}>{row.name}</Link> : row.name}
                    <span className="block text-xs text-gray-500">expected {units(row.expected, row.unit)}, counted {row.counted}</span>
                  </span>
                  <span className={`text-right tabular-nums ${row.difference < 0 ? 'text-red-700' : row.difference > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                    {row.difference > 0 ? '+' : ''}{row.difference}
                    {posted && <span className="block text-xs">{nad(row.valueCents)}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ListSheet>
  );
};

export default CountDetailSheet;
