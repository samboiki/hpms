import React, { useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { formatMonthKey } from '../financeFormat';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { itemGroup, monthGroup, profitBy, profitGroupTable, profitLineTable, profitNotes, soldLines, type SoldLine } from './grossProfit';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { staffName } from './reportTargets';
import { loadGrossProfit } from './stockReportsService';
import { useReportLoad } from './useReportLoad';

type View = 'item' | 'practitioner' | 'month' | 'list';

const VIEWS = [
  { value: 'item' as const, label: 'Per item', icon: 'solar:box-bold-duotone' },
  { value: 'practitioner' as const, label: 'Per practitioner', icon: 'solar:stethoscope-bold-duotone' },
  { value: 'month' as const, label: 'Per month', icon: 'solar:calendar-bold-duotone' },
  { value: 'list' as const, label: 'Every line', icon: 'solar:list-bold-duotone' }
];

const EXPORT_KEYS: Record<View, string> = { item: 'gross_profit_items', practitioner: 'gross_profit_practitioners', month: 'gross_profit_months', list: 'gross_profit_lines' };

const NO_PRACTITIONER = 'none';

type Filters = { item: string; practitioner: string; month: string };
const NO_FILTERS: Filters = { item: '', practitioner: '', month: '' };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/** Gross profit per item, practitioner and month (parity R9): stock billed against its cost; a line opens its invoice */
export const GrossProfitReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadGrossProfit(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Stock is not set up in this database yet (proposals/2026-10-07-dispensing-and-stock.sql).'
  );
  const [view, setView] = useState<View>('item');
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: {}, onChanged: retry });

  const practitionerName = useMemo(() => (id: string | null) =>
    (id ? staffName(id, staffNames, 'Practitioner not on the staff list') : 'No practitioner recorded'), [staffNames]);
  const practitionerGroup = useMemo(() => (line: SoldLine) =>
    ({ key: line.practitionerId ?? NO_PRACTITIONER, label: practitionerName(line.practitionerId) }), [practitionerName]);

  const lines = useMemo(() => (data
    ? soldLines({ lines: data.lines, invoices: data.invoices, movements: data.saleMovements, items: data.items, defaultVatRate: data.defaultVatRate, range })
    : []), [data, range]);
  const notes = useMemo(() => (data ? profitNotes(lines, { defaultVatRate: data.defaultVatRate, dispensedCostCents: data.dispensedCostCents }) : []), [data, lines]);
  const byItem = useMemo(() => profitBy(lines, itemGroup), [lines]);
  const byPractitioner = useMemo(() => profitBy(lines, practitionerGroup), [lines, practitionerGroup]);
  const byMonth = useMemo(() => profitBy(lines, monthGroup, true), [lines]);
  const groupsOf = (which: View) => (which === 'item' ? byItem : which === 'practitioner' ? byPractitioner : byMonth);

  const report = useMemo(() => {
    if (!data) return null;
    const basis = `Stock billed ${labels.current}`;
    if (view === 'item') return profitGroupTable(byItem, { title: 'Gross profit per item', header: 'Item', basis, notes });
    if (view === 'practitioner') return profitGroupTable(byPractitioner, { title: 'Gross profit per practitioner', header: 'Practitioner', basis, notes });
    if (view === 'month') return profitGroupTable(byMonth, { title: 'Gross profit per month', header: 'Month', basis, notes });
    const shown = lines.filter(line =>
      (!filters.item || line.itemId === filters.item) &&
      (!filters.practitioner || (line.practitionerId ?? NO_PRACTITIONER) === filters.practitioner) &&
      (!filters.month || line.monthKey === filters.month));
    const chosen = [
      filters.item ? byItem.find(group => group.key === filters.item)?.label : null,
      filters.practitioner ? byPractitioner.find(group => group.key === filters.practitioner)?.label : null,
      filters.month ? formatMonthKey(filters.month, 'MMMM yyyy') : null
    ].filter(Boolean).join(' · ');
    return profitLineTable(shown, { basis: `${basis}${chosen ? ` · ${chosen}` : ''}`, notes, practitionerName });
  }, [data, view, byItem, byPractitioner, byMonth, lines, filters, labels, notes, practitionerName]);

  const setFilter = (key: keyof Filters, value: string) => setFilters(previous => ({ ...previous, [key]: value }));

  return (
    <>
      <ReportFrame
        title="Gross profit"
        subtitle={`Stock billed ${labels.current}`}
        icon="solar:money-bag-bold-duotone"
        tone="green"
        exportKey={EXPORT_KEYS[view]}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ item: filters.item || null, practitioner: filters.practitioner || null, month: filters.month || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'No stock billed in this period', hint: 'Medicines and other stock items billed on invoices appear here once Stock takes them off (Stock > Items).' }}
        onOpen={open}
        resetKey={`${view}|${filters.item}|${filters.practitioner}|${filters.month}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Gross profit views" />
            {view === 'list' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Item" htmlFor="gross-profit-item">
                  <select id="gross-profit-item" className={inputClass} value={filters.item} onChange={event => setFilter('item', event.target.value)}>
                    <option value="">Every item</option>
                    {byItem.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}
                  </select>
                </Field>
                <Field label="Practitioner" htmlFor="gross-profit-practitioner">
                  <select id="gross-profit-practitioner" className={inputClass} value={filters.practitioner} onChange={event => setFilter('practitioner', event.target.value)}>
                    <option value="">Everyone</option>
                    {byPractitioner.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}
                  </select>
                </Field>
                {byMonth.length > 1 && (
                  <Field label="Month" htmlFor="gross-profit-month">
                    <select id="gross-profit-month" className={inputClass} value={filters.month} onChange={event => setFilter('month', event.target.value)}>
                      <option value="">Every month</option>
                      {byMonth.map(group => <option key={group.key} value={group.key}>{group.label}</option>)}
                    </select>
                  </Field>
                )}
              </div>
            )}
          </div>
        }
        onRowClick={view === 'list' ? undefined : index => {
          const key = groupsOf(view)[index]?.key;
          if (!key) return;
          setFilters({ ...NO_FILTERS, [view]: key });
          setView('list');
        }}
        rowLabel={view === 'list' ? undefined : index => `List the lines of ${groupsOf(view)[index]?.label ?? 'this row'}`}
      />
      {element}
    </>
  );
};
