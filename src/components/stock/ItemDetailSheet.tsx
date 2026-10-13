import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ListSheet } from '../patientLists/ListSheet';
import { inventoryCategoryLabel } from '../finance/financeTheme';
import { invoiceLink, patientMedicinesLink, stockCountLink, stockDeliveryLink, stockLink, stockStoreLink, stockTransferLink, supplierLink } from '../billing/invoiceLinks';
import { deleteStockItem, loadItemMovements, loadPatientNames, setStockItemActive } from '../../services/stock/stockService';
import { todayKey } from '../../utils/billing/dates';
import { MOVEMENT_LABELS, adjustmentReasonLabel, averageCostCents, batchesOnHand, expiryState, isTransferMovement, withRunningBalance } from '../../utils/stock/ledger';
import type { StockItem } from '../../utils/stock/items';
import type { StockMovement } from '../../utils/stock/stockRows';
import { canStock } from '../../utils/stock/stockRoles';
import { itemByStore, locationIdOf, usesStores } from '../../utils/stock/stores';
import { priceOf, stockLevelOf, type StockContext } from './stockContext';
import { Chip } from './stockParts';
import { ReferencePriceFact } from './ReferencePriceFact';
import { DANGER, LINK, QUIET, SECONDARY, day, errorText, nad, units } from './stockUi';

interface ItemDetailSheetProps {
  context: StockContext;
  item: StockItem;
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onAdjust: () => void;
  /** Print barcode or shelf labels for this item (L14) */
  onLabels?: () => void;
  onChanged: () => void;
}

/** Where a movement came from, as a link to its document (invoice, delivery, the patient's medicines, the count, the transfer) */
const MovementSource: React.FC<{ movement: StockMovement; patientName: string | null }> = ({ movement, patientName }) => {
  const label = movement.documentRef ?? MOVEMENT_LABELS[movement.kind];
  if (movement.deliveryId) return <Link to={stockDeliveryLink(movement.deliveryId)} className={LINK}>{label}</Link>;
  if (movement.invoiceId) return <Link to={invoiceLink(movement.invoiceId)} className={LINK}>{label}</Link>;
  if (movement.dispensingId && movement.patientId) {
    return <Link to={patientMedicinesLink(movement.patientId)} className={LINK}>{patientName ? `${label} · ${patientName}` : label}</Link>;
  }
  if (movement.countId) return <Link to={stockCountLink(movement.countId)} className={LINK}>{label}</Link>;
  // A transfer's movements carry its TRF number: the transfer opens with who sent and received it
  if (isTransferMovement(movement.kind) && movement.documentRef) return <Link to={stockTransferLink(movement.documentRef)} className={LINK}>{label}</Link>;
  return <span>{label}</span>;
};

/** One item: what is on hand, its value and price, the batches on the shelf and every movement with its document */
export const ItemDetailSheet: React.FC<ItemDetailSheetProps> = ({ context, item, open, onClose, onEdit, onAdjust, onLabels, onChanged }) => {
  const [movements, setMovements] = useState<StockMovement[] | null>(null);
  const [patients, setPatients] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const level = stockLevelOf(item, context.levels);
  const average = averageCostCents(level);
  const price = priceOf(item, item.packSize ?? 1, context.settings, context.levels);
  const today = todayKey();
  const supplier = context.suppliers.find(entry => entry.id === item.preferredSupplierId) ?? null;
  // L10: with more than one store, how much of it each store holds (and what is on the way)
  const whereItIs = usesStores(context.stores) ? itemByStore(item.id, context.storeLevels, context.stores) : [];

  useEffect(() => {
    if (!open) return;
    let active = true;
    setMovements(null);
    loadItemMovements(item.id)
      .then(async rows => {
        if (!active) return;
        setMovements(rows);
        const names = await loadPatientNames(rows.flatMap(row => (row.patientId ? [row.patientId] : [])));
        if (active) setPatients(names);
      })
      .catch(error => active && setFailed(errorText(error, 'Could not load the history')));
    return () => {
      active = false;
    };
  }, [open, item.id]);

  const history = useMemo(() => (movements ? withRunningBalance(movements).reverse() : []), [movements]);
  const batches = useMemo(() => batchesOnHand(
    (movements ?? [])
      .filter(row => row.expiryDate && ['opening', 'received', 'returned', 'delivery_reversed'].includes(row.kind))
      .map(row => ({ batchNo: row.batchNo, expiryDate: row.expiryDate, quantity: row.quantity })),
    level.onHand
  ), [movements, level.onHand]);

  const toggleActive = async () => {
    setBusy(true);
    try {
      await setStockItemActive(item.id, !item.isActive);
      toast.success(item.isActive ? `${item.name} is no longer used. Its history is kept.` : `${item.name} is in use again.`);
      onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete ${item.name}? It has never been used, so nothing else changes.`)) return;
    setBusy(true);
    try {
      await deleteStockItem(item.id);
      toast.success(`${item.name} deleted.`);
      onClose();
      onChanged();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const facts: Array<[string, React.ReactNode]> = [
    ['On hand', <strong key="on-hand" className={level.onHand <= 0 ? 'text-red-700' : 'text-gray-900'}>{units(level.onHand, item.unit)}</strong>],
    ['Value (cost, excl. VAT)', nad(level.valueCents)],
    ['Average cost', average === null ? 'Not known' : `${nad(Math.round(average))} per ${item.unit}`],
    ['Sells at', price ? `${nad(price.totalCents)} for ${units(item.packSize ?? 1, item.unit)}${price.source === 'fixed' ? ' (fixed price)' : ''}` : 'No price: give a cost or a fixed price'],
    // The most a medical aid pays a unit (medicines; parity E7)
    ...(item.category === 'medications' ? [['Fund reference price', <ReferencePriceFact key="reference" context={context} item={item} />] as [string, React.ReactNode]] : []),
    ['Minimum / most to hold', `${item.minimum ?? '–'} / ${item.maximum ?? '–'}`],
    ['Supplier', supplier ? <Link key="supplier" to={supplierLink(supplier.id)} className={LINK}>{supplier.name}</Link> : 'None']
  ];

  return (
    <ListSheet
      open={open}
      onClose={onClose}
      title={item.name}
      subtitle={[inventoryCategoryLabel(item.category), item.group, item.nappiCode ? `NAPPI ${item.nappiCode}` : null].filter(Boolean).join(' · ')}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            {canStock(context.role, 'edit_items') && (
              <button type="button" onClick={() => void toggleActive()} disabled={busy} className={QUIET}>
                <Icon icon={item.isActive ? 'solar:archive-bold-duotone' : 'solar:restart-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
                {item.isActive ? 'Stop using' : 'Use again'}
              </button>
            )}
            {canStock(context.role, 'edit_items') && movements !== null && movements.length === 0 && (
              <button type="button" onClick={() => void remove()} disabled={busy} className={DANGER}>Delete</button>
            )}
            {onLabels && (
              <button type="button" onClick={onLabels} className={QUIET}>
                <Icon icon="solar:sticker-square-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Labels
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {canStock(context.role, 'adjust') && (
              <button type="button" onClick={onAdjust} className={SECONDARY}>
                <Icon icon="solar:transfer-vertical-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Adjust
              </button>
            )}
            {canStock(context.role, 'edit_items') && (
              <button type="button" onClick={onEdit} className={SECONDARY}>
                <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Change
              </button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-1.5">
          {!item.isActive && <Chip tone="gray" icon="solar:archive-bold-duotone">No longer used</Chip>}
          {item.isScheduled && <Chip tone="violet" icon="solar:lock-keyhole-bold-duotone">Scheduled{item.scheduleLabel ? ` (${item.scheduleLabel})` : ''}</Chip>}
          {item.minimum !== null && level.onHand <= item.minimum && <Chip tone="amber" icon="solar:danger-triangle-bold-duotone">Low: reorder</Chip>}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          {facts.map(([term, value]) => (
            <div key={term}>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">{term}</dt>
              <dd className="text-sm text-gray-800">{value}</dd>
            </div>
          ))}
        </dl>

        {whereItIs.length > 0 && (
          <section aria-label="Where it is">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Where it is</h3>
            <ul className="space-y-1.5">
              {whereItIs.map(row => (
                <li key={row.key || 'main'} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                  {/* A store opens its own stock; what is on the way opens the transfers */}
                  <Link to={row.onTheWay ? stockLink('transfers') : stockStoreLink(locationIdOf(row.key))} className={LINK}>{row.name}</Link>
                  <span className={`tabular-nums ${row.onTheWay ? 'text-amber-800' : 'text-gray-900'}`}>{units(row.onHand, item.unit)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {batches.length > 0 && (
          <section aria-label="Batches on the shelf">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">Batches on the shelf</h3>
            <p className="mb-2 text-xs text-gray-500">Assuming the earliest expiry is used first.</p>
            <ul className="space-y-1.5">
              {batches.map(batch => {
                const state = expiryState(batch.expiryDate, today);
                return (
                  <li key={`${batch.batchNo}-${batch.expiryDate}`} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm">
                    <span className="text-gray-800">{batch.batchNo ? `Batch ${batch.batchNo}` : 'No batch number'} · about {units(batch.left, item.unit)}</span>
                    {batch.expiryDate && (
                      <Chip tone={state === 'expired' ? 'red' : state === 'soon' ? 'amber' : 'green'}>
                        {state === 'expired' ? 'Expired' : 'Expires'} {day(batch.expiryDate)}
                      </Chip>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-label="History">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">History</h3>
          {failed ? (
            <p className="text-sm text-red-600" role="alert">{failed}</p>
          ) : movements === null ? (
            <p className="text-sm text-gray-500" role="status">Loading the history…</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">Nothing in or out yet.</p>
          ) : (
            <ol className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {history.map(row => (
                <li key={row.id} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="font-medium text-gray-900">{MOVEMENT_LABELS[row.kind]}</span>
                    <span className="text-gray-500"> · {day(row.occurredOn)} · </span>
                    <MovementSource movement={row} patientName={row.patientId ? patients.get(row.patientId) ?? null : null} />
                  </span>
                  <span className={`text-right font-semibold tabular-nums ${row.quantity < 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {row.quantity > 0 ? '+' : ''}{row.quantity}
                  </span>
                  <span className="text-xs text-gray-500">
                    {row.kind === 'adjusted' ? `${adjustmentReasonLabel(row.reasonCode)}: ` : ''}{row.reason ?? ''}
                    {row.batchNo ? ` Batch ${row.batchNo}.` : ''}
                    {row.createdBy && context.staffNames.get(row.createdBy) ? ` By ${context.staffNames.get(row.createdBy)}.` : ''}
                  </span>
                  <span className="text-right text-xs text-gray-500 tabular-nums">left {row.balance}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </ListSheet>
  );
};

export default ItemDetailSheet;
