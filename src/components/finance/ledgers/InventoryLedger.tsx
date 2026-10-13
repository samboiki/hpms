import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  EQUIPMENT_CATEGORY,
  inventoryItemValue,
  isExpired,
  isExpiringSoon,
  isLowStock,
  sumAmounts,
  type InventoryCategoryRow,
  type LedgerInventoryItem
} from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { CHART, inventoryCategoryLabel } from '../financeTheme';
import { formatCount, formatDateKey, formatNad } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, EmptyState, ErrorState, FilterPill, MiniStat, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { inventoryBasis } from '../stockInventory';
import { stockItemLink, stockLink } from '../../billing/invoiceLinks';

type ItemFilter = 'all' | 'expired' | 'expiring' | 'low' | 'equipment';

/** Stock and equipment at cost (Stock's own ledger once stock is tracked), highlighting expired and low stock */
export const InventoryLedger: React.FC<{ derived: FinanceDerived; workspace: FinanceWorkspace; labels: PeriodLabels; onRetry: () => void }> = ({ derived, workspace, labels, onRetry }) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<ItemFilter>('all');
  const todayKey = labels.todayKey;
  const items = useMemo(() => {
    const matches: Record<ItemFilter, (item: LedgerInventoryItem) => boolean> = {
      all: () => true,
      expired: item => isExpired(item, todayKey),
      expiring: item => isExpiringSoon(item, todayKey),
      low: isLowStock,
      equipment: item => item.category === EQUIPMENT_CATEGORY
    };
    return workspace.inventory.rows.filter(matches[filter]).sort((a, b) => inventoryItemValue(b) - inventoryItemValue(a));
  }, [workspace.inventory.rows, filter, todayKey]);

  if (workspace.inventory.error || !derived.inventory) {
    return <ErrorState title="Inventory could not be loaded" message={`${workspace.inventory.error ?? 'Unknown error'}. No stock values are shown rather than zeros.`} onRetry={onRetry} />;
  }

  const valuation = derived.inventory;
  // Items (equipment too), deliveries and stock takes live on the Stock page
  const manage = <ActionButton icon="solar:settings-bold-duotone" label="Manage inventory" title="Stock > Items" onClick={() => navigate(stockLink('items'))} />;

  if (valuation.count === 0) {
    return <EmptyState icon="solar:box-bold-duotone" title="No inventory recorded" message="Stock and equipment (such as computers) are recorded in Stock > Items." action={manage} />;
  }

  const largest = Math.max(...valuation.byCategory.map(c => c.value), 1);
  const expiryBadge = (item: LedgerInventoryItem) => {
    if (isExpired(item, todayKey)) return <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-800 font-medium">Expired {formatDateKey(item.expiryDate)}</span>;
    if (isExpiringSoon(item, todayKey)) return <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-medium">Expires {formatDateKey(item.expiryDate)}</span>;
    return <span className="text-xs text-gray-500">{item.expiryDate ? formatDateKey(item.expiryDate) : 'No expiry'}</span>;
  };

  const categoryColumns: TableColumn<InventoryCategoryRow>[] = [
    {
      key: 'category',
      header: 'Category',
      render: row => (
        <div className="min-w-[160px]">
          <p className="font-medium text-gray-900">{inventoryCategoryLabel(row.category)}</p>
          <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
            <div className="h-1.5 rounded-full" style={{ width: `${(row.value / largest) * 100}%`, backgroundColor: CHART.accent }} />
          </div>
        </div>
      )
    },
    { key: 'count', header: 'Items', align: 'right', render: row => formatCount(row.count) },
    { key: 'low', header: 'Low stock', align: 'right', hideBelow: 'sm', render: row => formatCount(row.lowStockCount) },
    { key: 'expired', header: 'Expired value', align: 'right', hideBelow: 'sm', render: row => formatNad(row.expiredValue) },
    { key: 'value', header: 'Value at cost', align: 'right', render: row => <span className="font-semibold text-gray-900">{formatNad(row.value)}</span> }
  ];

  const itemColumns: TableColumn<LedgerInventoryItem>[] = [
    {
      key: 'name',
      header: 'Item',
      render: item => (
        <div>
          <p className="font-medium text-gray-900 truncate max-w-[220px]">{item.name}</p>
          <p className="text-xs text-gray-500">{inventoryCategoryLabel(item.category)}{item.location ? ` · ${item.location}` : ''}</p>
        </div>
      )
    },
    {
      key: 'quantity',
      header: 'Quantity',
      align: 'right',
      render: item => (
        <span className={isLowStock(item) ? 'text-amber-700 font-medium' : ''}>
          {formatCount(item.quantity)} {item.unit}{isLowStock(item) ? ' (low)' : ''}
        </span>
      )
    },
    { key: 'unitCost', header: 'Unit cost', align: 'right', hideBelow: 'md', render: item => (item.unitCost > 0 ? formatNad(item.unitCost) : '—') },
    { key: 'expiry', header: 'Expiry', hideBelow: 'sm', render: expiryBadge },
    { key: 'value', header: 'Value', align: 'right', render: item => <span className="font-semibold text-gray-900">{formatNad(inventoryItemValue(item))}</span> }
  ];

  const exportItems = () => downloadCsv(
    exportFileName(`inventory valuation ${todayKey}`),
    toCsv(
      [
        { header: 'Item', type: 'text' },
        { header: 'Category', type: 'text' },
        { header: 'Location', type: 'text' },
        { header: 'Quantity', type: 'count' },
        { header: 'Unit', type: 'text' },
        { header: 'Unit cost', type: 'money' },
        { header: 'Value at cost', type: 'money' },
        { header: 'Expiry', type: 'date' },
        { header: 'Expired', type: 'text' },
        { header: 'Low stock', type: 'text' }
      ],
      items.map(item => [item.name, inventoryCategoryLabel(item.category), item.location, item.quantity, item.unit, item.unitCost, inventoryItemValue(item), item.expiryDate, isExpired(item, todayKey) ? 'yes' : 'no', isLowStock(item) ? 'yes' : 'no'])
    )
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon="solar:box-bold-duotone" label="Total at cost" value={formatNad(valuation.total)} tone="cyan" />
        <MiniStat icon="solar:monitor-bold-duotone" label="Equipment" value={formatNad(valuation.equipmentValue)} tone="indigo" />
        <MiniStat icon="solar:danger-circle-bold-duotone" label={`Expired (${formatCount(valuation.expiredCount)} items)`} value={formatNad(valuation.expiredValue)} tone="red" />
        <MiniStat icon="solar:clock-circle-bold-duotone" label={`Low stock / expiring in 30 days`} value={`${formatCount(valuation.lowStockCount)} / ${formatCount(valuation.expiringSoonCount)}`} tone="amber" />
      </div>

      <SectionCard title="Valuation by category" subtitle={`As at ${labels.today}: ${inventoryBasis(workspace.inventory.source)}`} icon="solar:layers-bold-duotone" actions={manage}>
        <DataTable
          rows={valuation.byCategory}
          columns={categoryColumns}
          rowKey={row => row.category}
          pageSize={0}
          totals={['Total', formatCount(valuation.count), formatCount(valuation.lowStockCount), formatNad(valuation.expiredValue), formatNad(valuation.total)]}
        />
        <p className="text-xs text-gray-500 mt-3">
          Consumable stock {formatNad(valuation.stockValue)}; equipment {formatNad(valuation.equipmentValue)} at cost (no depreciation is recorded in HPMS).
        </p>
      </SectionCard>

      <SectionCard
        title="Items"
        subtitle="Highest value first"
        icon="solar:checklist-minimalistic-bold-duotone"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportItems} disabled={items.length === 0} />}
      >
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <FilterPill active={filter === 'all'} onClick={() => setFilter('all')} count={valuation.count}>All</FilterPill>
          <FilterPill active={filter === 'expired'} onClick={() => setFilter('expired')} count={valuation.expiredCount} icon="solar:danger-circle-bold-duotone">Expired</FilterPill>
          <FilterPill active={filter === 'expiring'} onClick={() => setFilter('expiring')} count={valuation.expiringSoonCount} icon="solar:clock-circle-bold-duotone">Expiring in 30 days</FilterPill>
          <FilterPill active={filter === 'low'} onClick={() => setFilter('low')} count={valuation.lowStockCount} icon="solar:box-minimalistic-bold-duotone">Low stock</FilterPill>
          <FilterPill active={filter === 'equipment'} onClick={() => setFilter('equipment')} icon="solar:monitor-bold-duotone">Equipment</FilterPill>
        </div>
        <DataTable
          rows={items}
          columns={itemColumns}
          rowKey={item => item.id}
          // An item opens on the Stock page with its history (what came in and went out), once stock is tracked there
          onRowClick={workspace.inventory.source === 'stock_ledger' ? item => navigate(stockItemLink(item.id)) : undefined}
          rowLabel={item => `Open ${item.name} on the Stock page`}
          itemLabel="items"
          resetKey={filter}
          totals={['Total', '', '', '', formatNad(sumAmounts(items.map(inventoryItemValue)))]}
          empty={<EmptyState compact icon="solar:box-minimalistic-bold-duotone" title="No items in this selection" />}
        />
      </SectionCard>
    </div>
  );
};
