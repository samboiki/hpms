import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { EmptyState, ErrorState, LoadingState, SectionCard } from '../finance/FinanceUI';
import { printDocument } from '../finance/receipts/receiptDocuments';
import { stockItemLink, supplierLink } from '../billing/invoiceLinks';
import { cancelOrder, loadOrders, loadPracticeHeading, saveOrder } from '../../services/stock/stockService';
import { reorderReport } from '../../utils/stock/reorder';
import type { SupplierOrder } from '../../utils/stock/stockRows';
import { DeliverySheet } from './DeliverySheet';
import { orderHtml } from './stockDocuments';
import { stockLevelOf, type StockContext } from './stockContext';
import { Chip } from './stockParts';
import { INPUT, LINK, PRIMARY, QUIET, SECONDARY, STOCK_COLOR, day, errorText, nad, units } from './stockUi';

/** Print an order (the supplier, the lines at the last cost, the practice's account number) */
async function printOrder(context: StockContext, order: SupplierOrder): Promise<void> {
  const supplier = context.suppliers.find(entry => entry.id === order.supplierId);
  const heading = await loadPracticeHeading(context.practiceId);
  const opened = printDocument(orderHtml({
    practiceName: heading.name,
    practicePhone: heading.phone,
    practiceAddress: heading.address,
    supplierName: supplier?.name ?? 'Supplier',
    accountNumber: supplier?.accountNumber ?? null,
    number: order.number,
    orderedOn: order.orderedOn,
    notes: order.notes,
    lines: order.lines
  }));
  if (!opened) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
}

/**
 * The reorder report (items at or below their minimum, the quantity to get back to the most to hold, by supplier)
 * and the supplier orders made from it, which can be printed and received as a delivery.
 */
export const ReorderReport: React.FC<{ context: StockContext }> = ({ context }) => {
  const [orders, setOrders] = useState<SupplierOrder[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [receiving, setReceiving] = useState<SupplierOrder | null>(null);

  const reload = useCallback(() => {
    setFailed(null);
    loadOrders(context.practiceId).then(setOrders).catch(error => setFailed(errorText(error, 'Could not load the orders')));
  }, [context.practiceId]);
  useEffect(reload, [reload]);

  const groups = useMemo(() => reorderReport(context.items.map(item => ({
    id: item.id,
    name: item.name,
    unit: item.unit,
    onHand: stockLevelOf(item, context.levels).onHand,
    minimum: item.minimum,
    maximum: item.maximum,
    packSize: item.packSize,
    supplierId: item.preferredSupplierId,
    unitCostCents: item.unitCostCents,
    isActive: item.isActive
  }))), [context.items, context.levels]);

  const onOrder = useMemo(() => {
    const open = new Set<string>();
    for (const order of orders ?? []) if (order.status === 'ordered') for (const line of order.lines) open.add(line.itemId);
    return open;
  }, [orders]);

  const quantityOf = (itemId: string, suggested: number): number => {
    const typed = quantities[itemId];
    return typed === undefined ? suggested : /^\d+$/.test(typed.trim()) ? Number(typed) : 0;
  };

  const makeOrder = async (supplierId: string, lines: Array<{ itemId: string; quantity: number }>) => {
    const chosen = lines.filter(line => line.quantity > 0);
    if (chosen.length === 0) {
      toast.error('Every quantity is 0: nothing to order.');
      return;
    }
    setBusy(supplierId);
    try {
      const result = await saveOrder({ practice_id: context.practiceId, supplier_id: supplierId, lines: chosen.map(line => ({ item_id: line.itemId, quantity: line.quantity })) });
      toast.success(`Order ${result.number} saved.`);
      const fresh = await loadOrders(context.practiceId);
      setOrders(fresh);
      const order = fresh.find(entry => entry.id === result.id);
      if (order) await printOrder(context, order);
    } catch (error) {
      toast.error(errorText(error, 'Could not save the order.'));
    } finally {
      setBusy(null);
    }
  };

  const cancel = async (order: SupplierOrder) => {
    const reason = window.prompt(`Why is order ${order.number} cancelled?`);
    if (!reason || reason.trim().length < 3) return;
    try {
      await cancelOrder(order.id, reason.trim());
      toast.success(`Order ${order.number} cancelled.`);
      reload();
    } catch (error) {
      toast.error(errorText(error));
    }
  };

  const supplierName = (id: string | null) => (id ? context.suppliers.find(entry => entry.id === id)?.name ?? 'Supplier' : 'No supplier set');

  return (
    <div className="space-y-4">
      <SectionCard title="Reorder" subtitle="Items at or below their minimum, filled up to the most to hold in whole packs." icon="solar:cart-large-2-bold-duotone" tone={STOCK_COLOR.tone}>
        {groups.length === 0 ? (
          <EmptyState compact icon="solar:check-circle-bold-duotone" title="Nothing to reorder" message="No item is at or below its minimum. Set minimums on items to use this report." />
        ) : (
          <div className="space-y-4">
            {groups.map(group => (
              <div key={group.supplierId ?? 'none'} className="rounded-2xl border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
                  <p className="text-sm font-semibold text-gray-900">
                    {group.supplierId ? <Link to={supplierLink(group.supplierId)} className={LINK}>{supplierName(group.supplierId)}</Link> : supplierName(null)}
                  </p>
                  {group.supplierId ? (
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void makeOrder(group.supplierId!, group.lines.map(line => ({ itemId: line.item.id, quantity: quantityOf(line.item.id, line.quantity) })))}
                      className={PRIMARY}
                    >
                      <Icon icon="solar:cart-check-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                      Make order and print
                    </button>
                  ) : (
                    <span className="text-xs text-gray-500">Set a preferred supplier on these items to order them here.</span>
                  )}
                </div>
                <ul className="divide-y divide-gray-100">
                  {group.lines.map(line => (
                    <li key={line.item.id} className="flex flex-wrap items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <Link to={stockItemLink(line.item.id)} className={LINK}>{line.item.name}</Link>
                        <span className="block text-xs text-gray-500">
                          {units(line.item.onHand, line.item.unit)} on hand · minimum {line.item.minimum}{line.item.maximum ? ` · most ${line.item.maximum}` : ''}
                          {onOrder.has(line.item.id) ? ' · already on an open order' : ''}
                        </span>
                      </span>
                      <label className="flex items-center gap-2 text-xs text-gray-600">
                        Order
                        <input
                          value={quantities[line.item.id] ?? String(line.quantity)}
                          onChange={event => setQuantities(current => ({ ...current, [line.item.id]: event.target.value }))}
                          inputMode="numeric"
                          className={`${INPUT} w-24 text-right`}
                          aria-label={`Quantity of ${line.item.name} to order`}
                        />
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="px-3 py-2 text-right text-xs text-gray-500">Estimate at the last cost: {nad(group.lines.reduce((sum, line) => sum + quantityOf(line.item.id, line.quantity) * line.item.unitCostCents, 0))} excl. VAT</p>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      <SectionCard title="Orders" subtitle="Supplier orders, newest first. Receive one when it arrives." icon="solar:cart-large-minimalistic-bold-duotone" tone={STOCK_COLOR.tone}>
        {failed ? (
          <ErrorState title="Orders could not be loaded" message={failed} onRetry={reload} />
        ) : orders === null ? (
          <LoadingState label="Loading orders" rows={2} />
        ) : orders.length === 0 ? (
          <EmptyState compact icon="solar:cart-large-minimalistic-bold-duotone" title="No orders yet" />
        ) : (
          <ul className="divide-y divide-gray-100">
            {orders.map(order => (
              <li key={order.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium text-gray-900">{order.number}</span>
                  <span className="text-gray-500"> · {supplierName(order.supplierId)} · {day(order.orderedOn)} · {order.lines.length} line{order.lines.length === 1 ? '' : 's'}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <Chip tone={order.status === 'ordered' ? 'amber' : order.status === 'received' ? 'green' : 'gray'}>
                    {order.status === 'ordered' ? 'Ordered' : order.status === 'received' ? 'Received' : 'Cancelled'}
                  </Chip>
                  <button type="button" onClick={() => void printOrder(context, order)} className={QUIET} aria-label={`Print order ${order.number}`}>
                    <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                  {order.status === 'ordered' && (
                    <>
                      <button type="button" onClick={() => setReceiving(order)} className={SECONDARY}>Receive</button>
                      <button type="button" onClick={() => void cancel(order)} className={QUIET}>Cancel</button>
                    </>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {receiving && (
        <DeliverySheet
          context={context}
          mode="receive"
          open
          fromOrder={receiving}
          onClose={() => setReceiving(null)}
          onSaved={() => {
            setReceiving(null);
            context.reload();
            reload();
          }}
        />
      )}
    </div>
  );
};

export default ReorderReport;
