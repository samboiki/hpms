import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ErrorState, FilterPill, LoadingState, SectionCard } from '../finance/FinanceUI';
import { downloadReportCsv, printReport, type ReportTable } from '../finance/financeExport';
import { ReportPreview } from '../finance/ReportPreview';
import { loadMovements } from '../../services/stock/stockService';
import { loadTransfersSent } from '../../services/stock/storeService';
import { todayKey } from '../../utils/billing/dates';
import { priceUnitText } from '../../utils/labels/labelContent';
import type { StockItem } from '../../utils/stock/items';
import { goodsReceivedTable, priceListTable, salesTable, transfersTable, usageByItem, usageTable, type ReportItem } from '../../utils/stock/stockReports';
import { storeName, usesStores } from '../../utils/stock/stores';
import { dayOf } from '../../utils/stock/supplierLedger';
import { countSheetTable } from './stockDocuments';
import { priceOf, type StockContext } from './stockContext';
import { Field } from './stockParts';
import { INPUT, SECONDARY, STOCK_COLOR, day, errorText } from './stockUi';
import { useSupplierLedger } from './useSupplierLedger';

type List = 'prices' | 'count' | 'sales' | 'usage' | 'received' | 'transfers';

const LISTS: ReadonlyArray<{ value: List; label: string; icon: string; subtitle: string }> = [
  { value: 'prices', label: 'Price list', icon: 'solar:tag-price-bold-duotone', subtitle: 'Items in use with their selling price' },
  { value: 'count', label: 'Count sheet', icon: 'solar:checklist-minimalistic-bold-duotone', subtitle: 'A blank sheet to count the shelves by hand' },
  { value: 'sales', label: 'Sales', icon: 'solar:cart-check-bold-duotone', subtitle: 'What was billed from stock in a period' },
  { value: 'usage', label: 'Usage', icon: 'solar:graph-down-bold-duotone', subtitle: 'Everything that went out of stock in a period' },
  { value: 'received', label: 'Goods received', icon: 'solar:delivery-bold-duotone', subtitle: 'Deliveries and returns to suppliers in a period' },
  { value: 'transfers', label: 'Transfers', icon: 'solar:transfer-horizontal-bold-duotone', subtitle: 'Stock moved between your stores in a period' }
];

const reportItemOf = (item: StockItem): ReportItem => ({
  id: item.id,
  name: item.name,
  unit: item.unit,
  group: item.group,
  category: item.category,
  code: item.nappiCode?.trim() || item.sku?.trim() || item.barcode?.trim() || null,
  isActive: item.isActive
});

type Loaded<T> = { status: 'loading' } | { status: 'ready'; data: T } | { status: 'error'; message: string };

/** Loads once per key (a newer key wins over a slower, older load) */
function useLoaded<T>(key: string, load: () => Promise<T>): Loaded<T> & { retry: () => void } {
  const [state, setState] = useState<Loaded<T>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;
  useEffect(() => {
    let active = true;
    setState({ status: 'loading' });
    loadRef.current().then(
      data => active && setState({ status: 'ready', data }),
      (error: unknown) => active && setState({ status: 'error', message: errorText(error, 'Could not load the report') })
    );
    return () => {
      active = false;
    };
  }, [key, attempt]);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  return { ...state, retry };
}

type FrameState = { status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string; retry: () => void } | { status: 'not_set_up'; message: string };

/** One list: its card with Print and CSV, its filters and the table as it prints */
const ListFrame: React.FC<{
  list: List;
  practiceName: string;
  report: ReportTable | null;
  state: FrameState;
  controls: React.ReactNode;
  empty: { title: string; hint: string };
}> = ({ list, practiceName, report, state, controls, empty }) => {
  const meta = LISTS.find(option => option.value === list) ?? LISTS[0];
  const ready = state.status === 'ready' && report !== null;
  const print = () => {
    if (report && !printReport(report, practiceName)) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };
  return (
    <SectionCard
      title={meta.label}
      subtitle={ready && report ? report.basis : meta.subtitle}
      icon={meta.icon}
      tone={STOCK_COLOR.tone}
      actions={
        <div className="flex gap-2">
          <button type="button" disabled={!ready} onClick={print} className={SECONDARY}>
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
          <button type="button" disabled={!ready} onClick={() => report && downloadReportCsv(report)} className={SECONDARY}>
            <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            CSV
          </button>
        </div>
      }
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">{controls}</div>
      {state.status === 'loading' && <LoadingState label={`Loading ${meta.label.toLowerCase()}`} rows={4} />}
      {state.status === 'error' && <ErrorState title={`${meta.label} could not be loaded`} message={state.message} onRetry={state.retry} />}
      {state.status === 'not_set_up' && <p className="text-sm text-gray-600">{state.message}</p>}
      {ready && report && <ReportPreview report={report} empty={empty} resetKey={`${report.title}:${report.basis}`} />}
    </SectionCard>
  );
};

interface Period {
  from: string;
  to: string;
}

const PeriodFields: React.FC<{ period: Period; onChange: (period: Period) => void }> = ({ period, onChange }) => {
  const today = todayKey();
  return (
    <>
      <Field label="From">
        {props => <input {...props} type="date" value={period.from} max={period.to} onChange={event => onChange({ ...period, from: event.target.value })} className={INPUT} />}
      </Field>
      <Field label="To">
        {props => <input {...props} type="date" value={period.to} min={period.from} max={today} onChange={event => onChange({ ...period, to: event.target.value })} className={INPUT} />}
      </Field>
    </>
  );
};

const BAD_PERIOD: FrameState = { status: 'not_set_up', message: 'Choose a period that starts before it ends.' };

/** Sales or usage: from the stock ledger's movements of the period */
const MovementList: React.FC<{ context: StockContext; list: 'sales' | 'usage'; period: Period; controls: React.ReactNode }> = ({ context, list, period, controls }) => {
  const valid = period.from <= period.to;
  const movements = useLoaded(`${context.practiceId}:${period.from}:${period.to}`, () =>
    valid ? loadMovements(context.practiceId, { from: period.from, to: period.to }) : Promise.resolve([]));
  const items = useMemo(() => context.items.map(reportItemOf), [context.items]);
  const loaded = movements.status === 'ready' ? movements.data : null;
  const report = useMemo(() => {
    if (!loaded) return null;
    const rows = usageByItem(loaded, items);
    return list === 'sales' ? salesTable(rows, period.from, period.to) : usageTable(rows, period.from, period.to);
  }, [loaded, items, list, period]);
  const state: FrameState = !valid ? BAD_PERIOD
    : movements.status === 'error' ? { status: 'error', message: movements.message, retry: movements.retry }
      : movements.status === 'loading' ? { status: 'loading' } : { status: 'ready' };
  return (
    <ListFrame
      list={list}
      practiceName={context.practiceName}
      report={report}
      state={state}
      controls={controls}
      empty={list === 'sales'
        ? { title: 'Nothing billed from stock', hint: 'Invoice lines for stock items dated in the period appear here.' }
        : { title: 'Nothing went out of stock', hint: 'Billing, dispensing, adjustments and stock-take differences in the period appear here.' }}
    />
  );
};

/** Goods received and returned: from the supplier documents (the creditors ledger's deliveries) */
const ReceivedList: React.FC<{ context: StockContext; period: Period; controls: React.ReactNode }> = ({ context, period, controls }) => {
  const ledger = useSupplierLedger(context.practiceId);
  const nameOf = useMemo(() => {
    const names = new Map(context.suppliers.map(supplier => [supplier.id, supplier.name]));
    return (id: string) => names.get(id) ?? 'A supplier';
  }, [context.suppliers]);
  const valid = period.from <= period.to;
  const deliveries = ledger.status === 'ready' ? ledger.data.deliveries : null;
  const report = useMemo(
    () => (deliveries && valid ? goodsReceivedTable(deliveries, nameOf, period.from, period.to) : null),
    [deliveries, valid, nameOf, period]
  );
  const state: FrameState = ledger.status === 'not_set_up'
    ? { status: 'not_set_up', message: 'This list starts once the stores and suppliers update is applied to the practice\'s database. Until then, see Stock > Deliveries.' }
    : ledger.status === 'error' ? { status: 'error', message: ledger.message, retry: ledger.reload }
      : ledger.status === 'loading' ? { status: 'loading' } : !valid ? BAD_PERIOD : { status: 'ready' };
  return (
    <ListFrame
      list="received"
      practiceName={context.practiceName}
      report={report}
      state={state}
      controls={controls}
      empty={{ title: 'No deliveries or returns', hint: 'Deliveries and returns to suppliers dated in the period appear here.' }}
    />
  );
};

/** Transfers between stores sent in the period */
const TransferList: React.FC<{ context: StockContext; period: Period; controls: React.ReactNode }> = ({ context, period, controls }) => {
  const valid = period.from <= period.to;
  const transfers = useLoaded(`${context.practiceId}:${period.from}:${period.to}`, () =>
    valid ? loadTransfersSent(context.practiceId, period.from, period.to) : Promise.resolve([]));
  const loaded = transfers.status === 'ready' ? transfers.data : null;
  const report = useMemo(() => {
    if (!loaded) return null;
    const staff = (userId: string | null) => (userId ? context.staffNames.get(userId) ?? 'A staff member' : '–');
    return transfersTable(loaded, locationId => storeName(context.stores, locationId), staff, period.from, period.to, dayOf);
  }, [loaded, context.staffNames, context.stores, period]);
  const state: FrameState = !valid ? BAD_PERIOD
    : transfers.status === 'error' ? { status: 'error', message: transfers.message, retry: transfers.retry }
      : transfers.status === 'loading' ? { status: 'loading' } : { status: 'ready' };
  return (
    <ListFrame
      list="transfers"
      practiceName={context.practiceName}
      report={report}
      state={state}
      controls={controls}
      empty={{ title: 'No transfers', hint: 'Transfers sent between your stores in the period appear here.' }}
    />
  );
};

/**
 * R33: the stock lists: the price list, a count sheet, sales, usage, goods received and returned, and transfers between
 * stores (a practice with more than one store). Each shown, printed and exported as CSV.
 */
export const StockListsReport: React.FC<{ context: StockContext }> = ({ context }) => {
  const today = todayKey();
  const [list, setList] = useState<List>('prices');
  const [group, setGroup] = useState('');
  const [period, setPeriod] = useState<Period>({ from: `${today.slice(0, 7)}-01`, to: today });
  const multiStore = usesStores(context.stores);
  const lists = LISTS.filter(option => option.value !== 'transfers' || multiStore);
  const shown: List = list === 'transfers' && !multiStore ? 'prices' : list;

  const groups = useMemo(() => [...new Set(context.items.map(item => item.group).filter((value): value is string => !!value))].sort(), [context.items]);
  const inGroup = useMemo(
    () => context.items.filter(item => item.isActive && (!group || item.group === group)),
    [context.items, group]
  );

  const groupField = (
    <Field label="Stock group">
      {props => (
        <select {...props} value={group} onChange={event => setGroup(event.target.value)} className={INPUT}>
          <option value="">All groups</option>
          {groups.map(name => <option key={name} value={name}>{name}</option>)}
        </select>
      )}
    </Field>
  );
  const periodFields = <PeriodFields period={period} onChange={setPeriod} />;

  const fixedReport = useMemo((): ReportTable | null => {
    if (shown === 'prices') {
      const rows = inGroup.map(item => {
        // Priced as the bill would price it for the pack (or one unit): the total and its price per unit
        const price = priceOf(item, item.packSize && item.packSize > 0 ? item.packSize : 1, context.settings, context.levels);
        return {
          item: reportItemOf(item),
          sellsAs: priceUnitText({ unit: item.unit, packSize: item.packSize }),
          priceCents: price?.totalCents ?? null,
          unitPriceCents: price?.unitPriceCents ?? null
        };
      });
      return priceListTable(rows, `As at ${day(today)}${group ? ` · group ${group}` : ''}`);
    }
    if (shown === 'count') {
      // By where they are kept (items without a place last), then name: the order of a walk along the shelves
      const items = [...inGroup].sort((a, b) => Number(!a.location) - Number(!b.location)
        || (a.location ?? '').localeCompare(b.location ?? '') || a.name.localeCompare(b.name));
      return countSheetTable(group ? `Count sheet: ${group}` : 'Count sheet', items);
    }
    return null;
  }, [shown, inGroup, context.settings, context.levels, today, group]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Stock list">
        {lists.map(option => (
          <FilterPill key={option.value} active={shown === option.value} onClick={() => setList(option.value)} icon={option.icon}>{option.label}</FilterPill>
        ))}
      </div>
      {(shown === 'prices' || shown === 'count') && (
        <ListFrame
          list={shown}
          practiceName={context.practiceName}
          report={fixedReport}
          state={{ status: 'ready' }}
          controls={groupField}
          empty={{ title: 'No items', hint: 'Items in use (in this group) appear here.' }}
        />
      )}
      {(shown === 'sales' || shown === 'usage') && <MovementList context={context} list={shown} period={period} controls={periodFields} />}
      {shown === 'received' && <ReceivedList context={context} period={period} controls={periodFields} />}
      {shown === 'transfers' && <TransferList context={context} period={period} controls={periodFields} />}
    </div>
  );
};

export default StockListsReport;
