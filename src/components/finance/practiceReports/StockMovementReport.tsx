import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockItemLink } from '../../billing/invoiceLinks';
import type { PeriodLabels } from '../financeNav';
import { formatDateKey } from '../financeFormat';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { ReportFrame } from './ReportFrame';
import { loadStockMovement } from './stockReportsService';
import { fastMovers, fastMoversTable, groupMovementTable, groupMovements, itemMovements, slowMovers, slowMoversTable } from './stockMovement';
import { useReportLoad } from './useReportLoad';

type View = 'groups' | 'fast' | 'slow';

const VIEWS = [
  { value: 'groups' as const, label: 'Per stock group', icon: 'solar:box-minimalistic-bold-duotone' },
  { value: 'fast' as const, label: 'Fast movers', icon: 'solar:graph-up-bold-duotone' },
  { value: 'slow' as const, label: 'Slow movers', icon: 'solar:graph-down-bold-duotone' }
];

const EXPORT_KEYS: Record<View, string> = { groups: 'stock_movement_groups', fast: 'stock_movement_fast', slow: 'stock_movement_slow' };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
}

/** Stock movement per stock group with fast and slow movers (parity R8); an item opens in Stock */
export const StockMovementReport: React.FC<Props> = ({ practiceId, practiceName, labels }) => {
  const navigate = useNavigate();
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadStockMovement(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Stock is not set up in this database yet (proposals/2026-10-07-dispensing-and-stock.sql).'
  );
  const [view, setView] = useState<View>('groups');
  const [group, setGroup] = useState('');

  const items = useMemo(() => (data ? itemMovements({ items: data.items, levels: data.levels, movements: data.movements, range }) : []), [data, range]);
  const groups = useMemo(() => groupMovements(items), [items]);
  const inGroup = useMemo(() => (group ? items.filter(item => item.groupKey === group) : items), [items, group]);
  const groupLabel = groups.find(entry => entry.key === group)?.label;
  const basis = `Stock ledger ${labels.current}${groupLabel ? ` · ${groupLabel}` : ''}`;

  const report = useMemo(() => {
    if (!data) return null;
    if (view === 'groups') return groupMovementTable(groups, `Stock ledger ${labels.current}`);
    if (view === 'fast') return fastMoversTable(fastMovers(inGroup), basis);
    return slowMoversTable(slowMovers(inGroup), basis, formatDateKey(range.startKey));
  }, [data, view, groups, inGroup, basis, labels, range]);

  const ids = report && 'ids' in report ? (report.ids as string[]) : null;

  return (
    <ReportFrame
      title="Stock movement per group"
      subtitle={`Stock ledger ${labels.current}`}
      icon="solar:box-minimalistic-bold-duotone"
      tone="indigo"
      exportKey={EXPORT_KEYS[view]}
      practiceId={practiceId}
      practiceName={practiceName}
      range={range}
      exportFilters={{ group: group || null }}
      status={status}
      onRetry={retry}
      report={report}
      empty={view === 'slow'
        ? { title: 'No stock on hand', hint: 'Items with stock on hand at the end of the period appear here, the slowest first.' }
        : { title: 'No stock moved in this period', hint: 'Deliveries, items billed or dispensed, adjustments and stock counts appear here (Stock).' }}
      onOpen={() => undefined}
      resetKey={`${view}|${group}`}
      controls={
        <div className="space-y-3">
          <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Stock movement views" />
          {view !== 'groups' && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Stock group" htmlFor="stock-movement-group">
                <select id="stock-movement-group" className={inputClass} value={group} onChange={event => setGroup(event.target.value)}>
                  <option value="">Every group</option>
                  {groups.map(entry => <option key={entry.key} value={entry.key}>{entry.label}</option>)}
                </select>
              </Field>
            </div>
          )}
        </div>
      }
      onRowClick={index => {
        if (view === 'groups') {
          const key = groups[index]?.key;
          if (!key) return;
          setGroup(key);
          setView('fast');
        } else if (ids?.[index]) {
          navigate(stockItemLink(ids[index]));
        }
      }}
      rowLabel={index => (view === 'groups'
        ? `Show the fast movers of ${groups[index]?.label ?? 'the group'}`
        : `Open ${report?.names?.[index] ?? 'the item'} in Stock`)}
    />
  );
};
