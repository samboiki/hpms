import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { EmptyState, ErrorState, LoadingState, SectionCard } from '../finance/FinanceUI';
import { cancelCount, loadCount, loadCountLines, loadCounts, postCount, recordCounts, startCount } from '../../services/stock/stockService';
import { loadCountStores, startCountInStore } from '../../services/stock/storeService';
import { varianceReport } from '../../utils/stock/stockTake';
import type { StockCount } from '../../utils/stock/stockRows';
import { canStock, whoCan } from '../../utils/stock/stockRoles';
import { defaultStoreFor, locationIdOf, storeKey, storeName, usesStores } from '../../utils/stock/stores';
import { COUNT_STATUS_LABELS, COUNT_STATUS_TONES, CountDetailSheet } from './CountDetailSheet';
import { countSheetTable, varianceTable } from './stockDocuments';
import { stockLevelOf, type StockContext } from './stockContext';
import { Chip, Field } from './stockParts';
import { StorePicker } from './storeParts';
import { DANGER, INPUT, LINK, PRIMARY, SECONDARY, STOCK_COLOR, day, errorText, nad, printOrSay, units } from './stockUi';

/**
 * Stock takes. Counted blind (the screen does not show what the ledger expects), then the differences are listed
 * and valued, and an admin or doctor posts them. Each count keeps what was expected when it was typed, so stock
 * sold while counting does not show as a loss. A posted or cancelled count opens read only (CountDetailSheet), from
 * the earlier counts or a link (?count=, e.g. from an item's history).
 */
export const StockTakeTab: React.FC<{ context: StockContext; openCountId?: string | null }> = ({ context, openCountId = null }) => {
  const [counts, setCounts] = useState<StockCount[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [saved, setSaved] = useState<Map<string, { expected: number; counted: number }>>(new Map());
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [group, setGroup] = useState('');
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  // L10: with more than one store, each store is counted on its own (one open count per store)
  const multiStore = usesStores(context.stores);
  const [store, setStore] = useState(() => defaultStoreFor(context.stores, context.userBranchId));
  const [countStores, setCountStores] = useState<Map<string, string | null>>(new Map());
  const inStore = useCallback((count: StockCount) => !multiStore || storeKey(countStores.get(count.id)) === store, [multiStore, countStores, store]);
  const open = counts?.find(count => count.status === 'counting' && inStore(count)) ?? null;

  const load = useCallback(async () => {
    setFailed(null);
    try {
      const [rows, where] = await Promise.all([loadCounts(context.practiceId), multiStore ? loadCountStores(context.practiceId) : Promise.resolve(new Map<string, string | null>())]);
      setCounts(rows);
      setCountStores(where);
      const current = rows.find(count => count.status === 'counting' && (!multiStore || storeKey(where.get(count.id)) === store));
      setSaved(current ? await loadCountLines(current.id) : new Map());
    } catch (error) {
      setFailed(errorText(error, 'Could not load the stock counts'));
    }
  }, [context.practiceId, multiStore, store]);

  useEffect(() => {
    void load();
  }, [load]);

  // L6: a count that is closed opens read only; one still being counted in another store opens that store's count
  const [viewing, setViewing] = useState<StockCount | null>(null);
  const openCount = useCallback((count: StockCount) => {
    if (count.status !== 'counting') setViewing(count);
    else if (multiStore) setStore(storeKey(countStores.get(count.id)));
  }, [multiStore, countStores]);
  // A link opens its count once (the list holds the newest 50: an older one is read by id)
  const linked = useRef<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!openCountId || counts === null || linked.current === openCountId) return;
    linked.current = openCountId;
    const known = counts.find(count => count.id === openCountId);
    if (known) {
      openCount(known);
      return;
    }
    loadCount(openCountId)
      .then(count => {
        if (!mounted.current) return;
        if (count) openCount(count);
        else toast.error('That stock count could not be found.');
      })
      .catch(error => mounted.current && toast.error(errorText(error, 'That stock count could not be opened')));
  }, [openCountId, counts, openCount]);
  // The store of a count is known for the newest 50 (an older one opened from a link names none rather than guess)
  const sheet = viewing && (
    <CountDetailSheet
      context={context}
      count={viewing}
      storeName={multiStore && countStores.has(viewing.id) ? storeName(context.stores, countStores.get(viewing.id) ?? null) : null}
      onClose={() => setViewing(null)}
    />
  );

  const groups = useMemo(() => [...new Set(context.items.map(item => item.group).filter((value): value is string => !!value))].sort(), [context.items]);
  const countItems = useMemo(
    () => context.items.filter(item => item.isActive && (!open?.group || item.group === open.group)),
    [context.items, open?.group]
  );

  const report = useMemo(() => varianceReport(countItems.flatMap(item => {
    const line = saved.get(item.id);
    return line ? [{ itemId: item.id, name: item.name, unit: item.unit, expected: line.expected, counted: line.counted, level: stockLevelOf(item, context.levels) }] : [];
  })), [countItems, saved, context.levels]);

  const start = async () => {
    setBusy(true);
    try {
      const result = multiStore
        ? await startCountInStore(context.practiceId, group || null, null, locationIdOf(store))
        : await startCount(context.practiceId, group || null, null);
      toast.success(`Stock count ${result.number} started.`);
      await load();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const saveCounts = async () => {
    if (!open) return;
    const lines = Object.entries(typed).flatMap(([itemId, value]): Array<{ item_id: string; counted: number | null }> => {
      const trimmed = value.trim();
      if (trimmed === '') return saved.has(itemId) ? [{ item_id: itemId, counted: null }] : [];
      return /^\d+$/.test(trimmed) ? [{ item_id: itemId, counted: Number(trimmed) }] : [];
    });
    const invalid = Object.values(typed).some(value => value.trim() !== '' && !/^\d+$/.test(value.trim()));
    if (invalid) {
      toast.error('Counts are whole numbers of units.');
      return;
    }
    if (lines.length === 0) {
      toast('Nothing new to save.');
      return;
    }
    setBusy(true);
    try {
      await recordCounts(open.id, lines);
      setTyped({});
      setSaved(await loadCountLines(open.id));
      toast.success(`${lines.length} count${lines.length === 1 ? '' : 's'} saved.`);
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const post = async () => {
    if (!open) return;
    if (!window.confirm(`Post ${open.number}? ${report.changed} item${report.changed === 1 ? '' : 's'} change by ${nad(report.valueCents)} at cost. Items not counted stay as they are.`)) return;
    setBusy(true);
    try {
      const result = await postCount(open.id);
      toast.success(`${open.number} posted: ${result.changed} item${result.changed === 1 ? '' : 's'} corrected.`);
      context.reload();
      await load();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!open || cancelReason.trim().length < 3) {
      toast.error('Say why the count is cancelled.');
      return;
    }
    setBusy(true);
    try {
      await cancelCount(open.id, cancelReason.trim());
      setCancelling(false);
      setCancelReason('');
      toast.success(`${open.number} cancelled. Nothing changed on the shelf.`);
      await load();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  if (failed) return <ErrorState title="Stock counts could not be loaded" message={failed} onRetry={() => void load()} />;
  if (counts === null) return <LoadingState label="Loading stock counts" />;

  const storeBar = multiStore ? (
    <div className="max-w-xs">
      <StorePicker stores={context.stores} value={store} onChange={next => { setStore(next); setTyped({}); }} label="Store being counted" />
    </div>
  ) : null;
  const countStoreName = (count: StockCount) => (multiStore ? ` · ${storeName(context.stores, countStores.get(count.id) ?? null)}` : '');

  if (!open) {
    return (
      <div className="space-y-4">
        {storeBar}
        <SectionCard title="Start a stock count" subtitle="Count what is on the shelf; the differences are posted at the end." icon="solar:checklist-minimalistic-bold-duotone" tone={STOCK_COLOR.tone}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field label="What to count" className="sm:w-72">
              {props => (
                <select {...props} value={group} onChange={event => setGroup(event.target.value)} className={INPUT}>
                  <option value="">Every item</option>
                  {groups.map(name => <option key={name} value={name}>Group: {name}</option>)}
                </select>
              )}
            </Field>
            <button type="button" onClick={() => void start()} disabled={busy || !canStock(context.role, 'count')} className={PRIMARY}>
              <Icon icon="solar:play-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Start counting
            </button>
          </div>
        </SectionCard>
        <SectionCard title="Earlier counts" icon="solar:history-bold-duotone" tone={STOCK_COLOR.tone}>
          {counts.length === 0 ? (
            <EmptyState compact icon="solar:checklist-minimalistic-bold-duotone" title="No stock counts yet" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {counts.map(count => (
                <li key={count.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span>
                    {/* Posted and cancelled counts open read only: their lines, who posted them and when */}
                    <button type="button" onClick={() => openCount(count)} className={LINK} aria-label={`Open stock count ${count.number}`}>{count.number}</button>
                    <span className="text-gray-500"> · {day(count.startedAt.slice(0, 10))}{count.group ? ` · ${count.group}` : ''}{countStoreName(count)}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {count.valueChangeCents !== null && <span className="tabular-nums text-gray-700">{nad(count.valueChangeCents)}</span>}
                    <Chip tone={COUNT_STATUS_TONES[count.status]}>{COUNT_STATUS_LABELS[count.status]}</Chip>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
        {sheet}
      </div>
    );
  }

  const countedCount = countItems.filter(item => saved.has(item.id)).length;

  return (
    <div className="space-y-4">
      {storeBar}
      <SectionCard
        title={`Counting: ${open.number}${countStoreName(open)}`}
        subtitle={`${open.group ? `Group ${open.group}` : 'Every item'} · started ${day(open.startedAt.slice(0, 10))} · ${countedCount} of ${countItems.length} counted`}
        icon="solar:checklist-minimalistic-bold-duotone"
        tone={STOCK_COLOR.tone}
        actions={
          <button type="button" onClick={() => printOrSay(countSheetTable(`Count sheet ${open.number}`, countItems), context.practiceName)} className={SECONDARY}>
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Print count sheet
          </button>
        }
      >
        <p className="mb-3 text-sm text-gray-600">Type what is on the shelf, then save. Leave an item empty if you did not count it: it stays as it is.</p>
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {countItems.map(item => {
            const current = typed[item.id] ?? (saved.has(item.id) ? String(saved.get(item.id)?.counted) : '');
            return (
              <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <label htmlFor={`count-${item.id}`} className="min-w-0 text-sm">
                  <span className="block truncate font-medium text-gray-900">{item.name}</span>
                  <span className="block text-xs text-gray-500">{[item.unit, item.location].filter(Boolean).join(' · ')}</span>
                </label>
                <input
                  id={`count-${item.id}`}
                  value={current}
                  onChange={event => setTyped(previous => ({ ...previous, [item.id]: event.target.value }))}
                  inputMode="numeric"
                  className={`${INPUT} w-24 text-right`}
                  aria-label={`Counted ${item.name}`}
                />
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={() => void saveCounts()} disabled={busy} className={PRIMARY}>
            {busy && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Save counts
          </button>
        </div>
      </SectionCard>

      <SectionCard
        title="Differences"
        subtitle={`${report.changed} of ${report.counted} counted items differ: ${report.unitsShort} short, ${report.unitsOver} over, ${nad(report.valueCents)} at cost`}
        icon="solar:transfer-vertical-bold-duotone"
        tone={STOCK_COLOR.tone}
        actions={
          <button type="button" onClick={() => printOrSay(varianceTable(`Variance report ${open.number}`, report), context.practiceName)} disabled={report.counted === 0} className={SECONDARY}>
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Print
          </button>
        }
      >
        {report.rows.filter(row => row.difference !== 0).length === 0 ? (
          <p className="text-sm text-gray-500">{report.counted === 0 ? 'Save some counts to see the differences.' : 'Every counted item matches the stock figures.'}</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {report.rows.filter(row => row.difference !== 0).map(row => (
              <li key={row.itemId} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <span className="font-medium text-gray-900">{row.name}</span>
                  <span className="block text-xs text-gray-500">expected {units(row.expected, row.unit)}, counted {row.counted}</span>
                </span>
                <span className={`text-right tabular-nums ${row.difference < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {row.difference > 0 ? '+' : ''}{row.difference}
                  <span className="block text-xs">{nad(row.valueCents)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          {cancelling ? (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Why cancel this count?" className="flex-1">
                {props => <input {...props} value={cancelReason} onChange={event => setCancelReason(event.target.value)} className={INPUT} maxLength={200} />}
              </Field>
              <button type="button" onClick={() => void cancel()} disabled={busy} className={DANGER}>Cancel count</button>
              <button type="button" onClick={() => setCancelling(false)} className={SECONDARY}>Keep counting</button>
            </div>
          ) : (
            <button type="button" onClick={() => setCancelling(true)} className={SECONDARY}>Cancel this count</button>
          )}
          <div className="text-right">
            <button
              type="button"
              onClick={() => void post()}
              disabled={busy || report.counted === 0 || !canStock(context.role, 'post_count') || Object.keys(typed).length > 0}
              className={PRIMARY}
              title={!canStock(context.role, 'post_count') ? whoCan('post_count') : Object.keys(typed).length > 0 ? 'Save the counts first' : undefined}
            >
              <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Post the count
            </button>
            {!canStock(context.role, 'post_count') && <p className="mt-1 text-xs text-gray-500">{whoCan('post_count')}</p>}
          </div>
        </div>
      </SectionCard>
      {sheet}
    </div>
  );
};

export default StockTakeTab;
