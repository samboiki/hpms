import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { DataTable, type TableColumn } from '../finance/DataTable';
import { EmptyState, FilterPill, MiniStat } from '../finance/FinanceUI';
import { inventoryCategoryLabel } from '../finance/financeTheme';
import { todayKey } from '../../utils/billing/dates';
import { expiryState } from '../../utils/stock/ledger';
import { normalizeNappi, type StockItem } from '../../utils/stock/items';
import { canStock } from '../../utils/stock/stockRoles';
import { locationIdOf, storeChoices, storeFromParam, usesStores } from '../../utils/stock/stores';
import { stockStoreTransfersLink } from '../billing/invoiceLinks';
import { AdjustSheet } from './AdjustSheet';
import { DeliverySheet } from './DeliverySheet';
import { ItemDetailSheet } from './ItemDetailSheet';
import { ItemFormSheet } from './ItemFormSheet';
import { StockLabelsSheet } from './StockLabelsSheet';
import { priceOf, stockLevelOf, type StockContext } from './stockContext';
import { Chip } from './stockParts';
import { INPUT, LINK, PRIMARY, SECONDARY, STOCK_COLOR, day, nad, units } from './stockUi';

/** The item a scanned or typed code names: its barcode, else its NAPPI code, else its product code (what labels carry) */
export function itemForCode(items: readonly StockItem[], code: string): StockItem | null {
  const typed = code.trim();
  if (!typed) return null;
  const nappi = normalizeNappi(typed);
  return items.find(item => item.barcode === typed)
    ?? items.find(item => item.nappiCode !== null && item.nappiCode === nappi)
    ?? items.find(item => item.sku !== null && item.sku.toLowerCase() === typed.toLowerCase())
    ?? null;
}

type Filter = 'all' | 'low' | 'expiring' | 'scheduled' | 'unused';

interface Row {
  item: StockItem;
  onHand: number;
  valueCents: number;
  low: boolean;
  expiry: ReturnType<typeof expiryState>;
}

/**
 * The stock list: what is on hand, its value and price, what is low or expiring; add items and receive stock. A link
 * can open it on one store's stock (?store=, e.g. from a transfer), which links to that store's transfers.
 */
export const StockItemsTab: React.FC<{ context: StockContext; openItemId: string | null; openStore?: string | null }> = ({ context, openItemId, openStore = null }) => {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(openItemId);
  const [editing, setEditing] = useState<{ item: StockItem | null } | null>(null);
  const [adjusting, setAdjusting] = useState<StockItem | null>(null);
  const [receiving, setReceiving] = useState(false);
  const [labelling, setLabelling] = useState<StockItem[] | null>(null);
  // L10: with more than one store, whose stock the list shows ('all' = the whole practice)
  const multiStore = usesStores(context.stores);
  const [where, setWhere] = useState<string>(() => storeFromParam(openStore, context.stores) ?? 'all');
  const today = todayKey();
  useEffect(() => setSelectedId(openItemId), [openItemId]);
  // A link's store applies once (as soon as the stores are known): choosing another store afterwards stays chosen
  const linkedStore = useRef<string | null>(where !== 'all' ? openStore : null);
  useEffect(() => {
    if (!openStore || linkedStore.current === openStore) return;
    const linked = storeFromParam(openStore, context.stores);
    if (linked === null) return;
    linkedStore.current = openStore;
    setWhere(linked);
  }, [openStore, context.stores]);

  const rows = useMemo<Row[]>(() => context.items.map(item => {
    const level = stockLevelOf(item, context.levels);
    const inStore = multiStore && where !== 'all' ? context.storeLevels.get(where)?.get(item.id) ?? { onHand: 0, valueCents: 0 } : null;
    return {
      item,
      onHand: inStore ? inStore.onHand : level.onHand,
      valueCents: inStore ? inStore.valueCents : level.valueCents,
      // The minimum is the practice's: "low" looks at all its stores together
      low: item.isActive && item.minimum !== null && level.onHand <= item.minimum,
      expiry: level.onHand > 0 ? expiryState(item.expiryDate, today) : null
    };
  }), [context.items, context.levels, context.storeLevels, multiStore, where, today]);

  const counts = useMemo(() => ({
    low: rows.filter(row => row.low).length,
    expiring: rows.filter(row => row.expiry === 'soon' || row.expiry === 'expired').length,
    scheduled: rows.filter(row => row.item.isScheduled && row.item.isActive).length,
    unused: rows.filter(row => !row.item.isActive).length
  }), [rows]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rows.filter(row => {
      if (filter === 'unused' ? row.item.isActive : !row.item.isActive) return false;
      if (filter === 'low' && !row.low) return false;
      if (filter === 'expiring' && row.expiry !== 'soon' && row.expiry !== 'expired') return false;
      if (filter === 'scheduled' && !row.item.isScheduled) return false;
      if (!needle) return true;
      return row.item.name.toLowerCase().includes(needle)
        || (row.item.nappiCode ?? '').toLowerCase().includes(needle)
        || (row.item.barcode ?? '') === needle
        || (row.item.group ?? '').toLowerCase().includes(needle)
        || (row.item.sku ?? '').toLowerCase().includes(needle);
    });
  }, [rows, filter, query]);

  const activeRows = rows.filter(row => row.item.isActive);
  const totalValue = activeRows.reduce((sum, row) => sum + row.valueCents, 0);
  const selected = context.items.find(item => item.id === selectedId) ?? null;

  const columns: TableColumn<Row>[] = [
    {
      key: 'item',
      header: 'Item',
      render: row => (
        <div className="min-w-0">
          <p className="truncate font-medium text-gray-900">{row.item.name}</p>
          <p className="text-xs text-gray-500">
            {[inventoryCategoryLabel(row.item.category), row.item.group, row.item.nappiCode ? `NAPPI ${row.item.nappiCode}` : null].filter(Boolean).join(' · ')}
          </p>
        </div>
      )
    },
    {
      key: 'on_hand',
      header: 'On hand',
      align: 'right',
      render: row => (
        <div className="flex flex-col items-end gap-1">
          <span className={`font-semibold ${row.onHand <= 0 ? 'text-red-700' : 'text-gray-900'}`}>{units(row.onHand, row.item.unit)}</span>
          {row.low && <Chip tone="amber">Low</Chip>}
        </div>
      )
    },
    { key: 'value', header: 'Value', align: 'right', hideBelow: 'sm', render: row => nad(row.valueCents) },
    {
      key: 'price',
      header: 'Sells at',
      align: 'right',
      hideBelow: 'md',
      render: row => {
        const quantity = row.item.packSize ?? 1;
        const price = priceOf(row.item, quantity, context.settings, context.levels);
        return price ? <span>{nad(price.totalCents)}<span className="block text-xs text-gray-500">for {units(quantity, row.item.unit)}</span></span> : <span className="text-xs text-gray-400">No price</span>;
      }
    },
    {
      key: 'expiry',
      header: 'Expires',
      hideBelow: 'lg',
      render: row => (row.item.expiryDate && row.onHand > 0
        ? <Chip tone={row.expiry === 'expired' ? 'red' : row.expiry === 'soon' ? 'amber' : 'gray'}>{day(row.item.expiryDate)}</Chip>
        : <span className="text-xs text-gray-400">–</span>)
    }
  ];

  const filters: Array<{ key: Filter; label: string; icon: string; count?: number }> = [
    { key: 'all', label: 'In use', icon: 'solar:box-bold-duotone', count: activeRows.length },
    { key: 'low', label: 'Low', icon: 'solar:danger-triangle-bold-duotone', count: counts.low },
    { key: 'expiring', label: 'Expiring', icon: 'solar:hourglass-line-bold-duotone', count: counts.expiring },
    { key: 'scheduled', label: 'Scheduled', icon: 'solar:lock-keyhole-bold-duotone', count: counts.scheduled },
    { key: 'unused', label: 'Not used', icon: 'solar:archive-bold-duotone', count: counts.unused }
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon="solar:box-bold-duotone" label="Items in use" value={String(activeRows.length)} tone={STOCK_COLOR.tone} />
        <MiniStat icon="solar:wallet-money-bold-duotone" label="Stock value (cost)" value={nad(totalValue)} tone="green" />
        <MiniStat icon="solar:danger-triangle-bold-duotone" label="Low: reorder" value={String(counts.low)} tone="amber" />
        <MiniStat icon="solar:hourglass-line-bold-duotone" label="Expiring within 3 months" value={String(counts.expiring)} tone="red" />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-md">
          <Icon icon="solar:magnifer-bold-duotone" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key !== 'Enter') return;
              // A scanned label carries the barcode, else the NAPPI or product code (L14)
              const scanned = itemForCode(context.items, query);
              if (scanned) {
                setSelectedId(scanned.id);
                setQuery('');
              }
            }}
            placeholder="Find by name, NAPPI, group or scan a barcode"
            aria-label="Find a stock item"
            className={`${INPUT} pl-9`}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setLabelling(visible.map(row => row.item))} disabled={visible.length === 0} className={SECONDARY}
            title="Barcode or shelf labels for the items listed">
            <Icon icon="solar:sticker-square-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Labels
          </button>
          {canStock(context.role, 'edit_items') && (
            <button type="button" onClick={() => setEditing({ item: null })} className={SECONDARY}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Add item
            </button>
          )}
          <button type="button" onClick={() => setReceiving(true)} className={PRIMARY}>
            <Icon icon="solar:inbox-in-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Receive stock
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Show">
        {filters.map(option => (
          <FilterPill key={option.key} active={filter === option.key} onClick={() => setFilter(option.key)} icon={option.icon} count={option.count}>
            {option.label}
          </FilterPill>
        ))}
      </div>
      {multiStore && (
        <label className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          Stock at
          <select value={where} onChange={event => setWhere(event.target.value)} className={`${INPUT} w-auto py-1.5`} aria-label="Whose stock the list shows">
            <option value="all">All stores</option>
            {storeChoices(context.stores).map(choice => <option key={choice.value || 'main'} value={choice.value}>{choice.label}</option>)}
          </select>
          {/* One store's stock opens the transfers it sent and received (each transfer opens this store again) */}
          {where !== 'all' && <Link to={stockStoreTransfersLink(locationIdOf(where))} className={LINK}>Transfers to and from this store</Link>}
        </label>
      )}

      <DataTable
        rows={visible}
        columns={columns}
        rowKey={row => row.item.id}
        onRowClick={row => setSelectedId(row.item.id)}
        rowLabel={row => `Open ${row.item.name}`}
        itemLabel="items"
        resetKey={`${filter}|${query}`}
        empty={
          <EmptyState
            icon="solar:box-bold-duotone"
            title={context.items.length === 0 ? 'No stock items yet' : 'Nothing matches'}
            message={context.items.length === 0 ? 'Add the medicines and consumables you keep, then record deliveries as they arrive.' : 'Try another name or filter.'}
          />
        }
      />

      {/* One sheet at a time: changing or adjusting an item replaces its details, which come back (reloaded) after */}
      {selected && !editing && !adjusting && !labelling && (
        <ItemDetailSheet
          key={selected.id}
          context={context}
          item={selected}
          open
          onClose={() => setSelectedId(null)}
          onEdit={() => setEditing({ item: selected })}
          onAdjust={() => setAdjusting(selected)}
          onLabels={() => setLabelling([selected])}
          onChanged={context.reload}
        />
      )}
      {editing && (
        <ItemFormSheet
          key={editing.item?.id ?? 'new'}
          context={context}
          item={editing.item}
          open
          onClose={() => setEditing(null)}
          onSaved={id => {
            setEditing(null);
            context.reload();
            setSelectedId(id);
          }}
        />
      )}
      {adjusting && (
        <AdjustSheet
          context={context}
          item={adjusting}
          open
          onClose={() => setAdjusting(null)}
          onSaved={() => {
            setAdjusting(null);
            context.reload();
          }}
        />
      )}
      {receiving && (
        <DeliverySheet
          context={context}
          mode="receive"
          open
          onClose={() => setReceiving(false)}
          onSaved={() => {
            setReceiving(false);
            context.reload();
          }}
        />
      )}
      {labelling && <StockLabelsSheet context={context} items={labelling} onClose={() => setLabelling(null)} />}
    </div>
  );
};

export default StockItemsTab;
