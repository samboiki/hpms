import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { DataTable, type TableColumn } from '../finance/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../finance/FinanceUI';
import { ListSheet } from '../patientLists/ListSheet';
import { consignmentLink, payablesLink, stockItemLink, supplierLink } from '../billing/invoiceLinks';
import { loadDeliveries, loadDeliveriesByIds, loadDeliveryMovements, loadPayableStatuses, reverseDelivery } from '../../services/stock/stockService';
import { todayKey } from '../../utils/billing/dates';
import type { Delivery, StockMovement } from '../../utils/stock/stockRows';
import { canStock } from '../../utils/stock/stockRoles';
import { DeliverySheet, type DeliveryMode } from './DeliverySheet';
import type { StockContext } from './stockContext';
import { Chip, Field } from './stockParts';
import { DANGER, INPUT, LINK, PRIMARY, SECONDARY, day, errorText, nad, units } from './stockUi';

type Payables = Map<string, { status: string; dueDate: string | null }>;

const PAYABLE_TONES: Record<string, 'green' | 'amber' | 'red' | 'gray'> = { paid: 'green', pending: 'amber', scheduled: 'amber', overdue: 'red', cancelled: 'gray' };

const PayableChip: React.FC<{ delivery: Delivery; payables: Payables }> = ({ delivery, payables }) => {
  if (delivery.kind === 'returned') return <Chip tone="cyan">Credit {nad(delivery.inclVatCents)} due from supplier</Chip>;
  if (!delivery.expenseId) return <span className="text-xs text-gray-400">No payable</span>;
  const payable = payables.get(delivery.expenseId);
  if (!payable) return <span className="text-xs text-gray-400">Payable</span>;
  const overdue = payable.status !== 'paid' && payable.status !== 'cancelled' && payable.dueDate !== null && payable.dueDate < todayKey();
  const status = overdue ? 'overdue' : payable.status;
  return <Chip tone={PAYABLE_TONES[status] ?? 'gray'}>{status.charAt(0).toUpperCase() + status.slice(1)}{payable.dueDate && status !== 'paid' && status !== 'cancelled' ? `, due ${day(payable.dueDate)}` : ''}</Chip>;
};

/** One delivery or return: its lines (each item linked), the supplier, the payable, and reversing it */
const DeliveryDetail: React.FC<{ context: StockContext; delivery: Delivery; payables: Payables; onClose: () => void; onChanged: () => void }> = ({ context, delivery, payables, onClose, onChanged }) => {
  const [lines, setLines] = useState<StockMovement[] | null>(null);
  const [reversing, setReversing] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const supplier = context.suppliers.find(entry => entry.id === delivery.supplierId);
  const itemOf = (id: string) => context.items.find(item => item.id === id);

  useEffect(() => {
    let active = true;
    loadDeliveryMovements(delivery.id).then(rows => active && setLines(rows)).catch(error => {
      if (active) {
        setLines([]);
        toast.error(errorText(error));
      }
    });
    return () => {
      active = false;
    };
  }, [delivery.id]);

  const reverse = async () => {
    if (reason.trim().length < 3) {
      toast.error('Say why it is reversed. It stays with the delivery.');
      return;
    }
    setBusy(true);
    try {
      const result = await reverseDelivery(delivery.id, reason.trim());
      // A consignment invoice reversed puts its frames back to owed (Stock > Reports > Consignment frames)
      const frames = delivery.consignment ? ' Its frames are owed to the supplier again.' : '';
      toast.success(result.payable_already_paid
        ? `${delivery.number} reversed. The supplier invoice was already marked paid: ask the supplier for a credit.${frames}`
        : `${delivery.number} reversed${delivery.expenseId ? ' and its payable cancelled' : ''}.${frames}`);
      onChanged();
      onClose();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  const original = (lines ?? []).filter(line => line.kind === 'received' || line.kind === 'returned');

  return (
    <ListSheet
      open
      onClose={onClose}
      title={`${delivery.consignment ? 'Consignment invoice' : delivery.kind === 'received' ? 'Delivery' : 'Return'} ${delivery.number}`}
      subtitle={`${supplier?.name ?? 'Supplier'} · ${delivery.kind === 'received' ? 'invoice' : 'reference'} ${delivery.supplierReference} · ${day(delivery.documentDate)}`}
      size="lg"
      dismissible={!busy}
      footer={canStock(context.role, 'reverse_delivery') && !delivery.reversedAt ? (
        reversing ? (
          <div className="space-y-2">
            <Field label="Why is it reversed?" hint={delivery.consignment
              ? 'Its frames are owed to the supplier again, to be put on the right invoice; a payable not yet paid is cancelled.'
              : 'Every line comes off (or goes back on) the shelf; a payable not yet paid is cancelled.'}>
              {props => <input {...props} value={reason} onChange={event => setReason(event.target.value)} className={INPUT} maxLength={200} autoFocus />}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setReversing(false)} className={SECONDARY}>Keep it</button>
              <button type="button" onClick={() => void reverse()} disabled={busy} className={DANGER}>Reverse {delivery.number}</button>
            </div>
          </div>
        ) : (
          <div className="flex justify-end">
            <button type="button" onClick={() => setReversing(true)} className={SECONDARY}>
              <Icon icon="solar:undo-left-round-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Captured by mistake? Reverse it
            </button>
          </div>
        )
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <PayableChip delivery={delivery} payables={payables} />
          {delivery.reversedAt && <Chip tone="red" icon="solar:undo-left-round-bold-duotone">Reversed: {delivery.reversalReason}</Chip>}
          {supplier && <Link to={supplierLink(supplier.id)} className={`${LINK} text-sm`}>Supplier details</Link>}
          {delivery.expenseId && <Link to={payablesLink()} className={`${LINK} text-sm`}>Payables in Finance</Link>}
        </div>
        {delivery.reason && <p className="text-sm text-gray-700">Reason: {delivery.reason}</p>}
        {delivery.consignment ? (
          <p className="text-sm text-gray-700">
            The supplier&apos;s invoice for consignment frames sold: no stock came in with it.{' '}
            <Link to={consignmentLink()} className={LINK}>The frames are in Stock &gt; Reports &gt; Consignment frames</Link>
          </p>
        ) : lines === null ? (
          <p className="text-sm text-gray-500" role="status">Loading the lines…</p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
            {original.map(line => {
              const item = itemOf(line.itemId);
              return (
                <li key={line.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                  <span className="min-w-0">
                    {item ? <Link to={stockItemLink(item.id)} className={LINK}>{item.name}</Link> : 'Item'}
                    <span className="block text-xs text-gray-500">
                      {units(Math.abs(line.quantity), item?.unit ?? 'units')}
                      {line.batchNo ? ` · batch ${line.batchNo}` : ''}
                      {line.expiryDate ? ` · expires ${day(line.expiryDate)}` : ''}
                    </span>
                  </span>
                  <span className="text-right tabular-nums">
                    {nad(Math.abs(line.valueCents))}
                    <span className="block text-xs text-gray-500">+ VAT {nad(line.vatCents ?? 0)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <dl className="ml-auto grid w-full max-w-xs grid-cols-2 gap-1 text-sm">
          <dt className="text-gray-500">Excl. VAT</dt><dd className="text-right tabular-nums">{nad(delivery.exclVatCents)}</dd>
          <dt className="text-gray-500">VAT</dt><dd className="text-right tabular-nums">{nad(delivery.vatCents)}</dd>
          <dt className="font-semibold text-gray-900">Total</dt><dd className="text-right font-semibold tabular-nums">{nad(delivery.inclVatCents)}</dd>
        </dl>
        {delivery.notes && <p className="text-sm text-gray-600">{delivery.notes}</p>}
      </div>
    </ListSheet>
  );
};

/** Deliveries received and stock returned to suppliers, newest first, each with its payable */
export const DeliveriesTab: React.FC<{ context: StockContext; openDeliveryId: string | null }> = ({ context, openDeliveryId }) => {
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [payables, setPayables] = useState<Payables>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const [mode, setMode] = useState<DeliveryMode | null>(null);
  const [openId, setOpenId] = useState<string | null>(openDeliveryId);
  useEffect(() => setOpenId(openDeliveryId), [openDeliveryId]);

  const load = useCallback(async () => {
    setFailed(null);
    try {
      const rows = await loadDeliveries(context.practiceId);
      setDeliveries(rows);
      setPayables(await loadPayableStatuses(rows.flatMap(row => (row.expenseId ? [row.expenseId] : []))));
    } catch (error) {
      setFailed(errorText(error, 'Could not load the deliveries'));
    }
  }, [context.practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // The list holds the newest 200: a link to an older delivery (a supplier's invoice, an item's history, a frame's
  // return note) reads that one and adds it, so the link still opens it
  useEffect(() => {
    if (!openId || !deliveries || deliveries.some(delivery => delivery.id === openId)) return;
    let cancelled = false;
    loadDeliveriesByIds([openId])
      .then(async found => {
        if (cancelled) return;
        if (found.length === 0) {
          toast.error('That delivery could not be found.');
          return;
        }
        setDeliveries(current => (current && !current.some(delivery => delivery.id === found[0].id) ? [...current, found[0]] : current));
        const expenseIds = found.flatMap(row => (row.expenseId ? [row.expenseId] : []));
        if (expenseIds.length === 0) return;
        const extra = await loadPayableStatuses(expenseIds);
        if (!cancelled) setPayables(current => new Map([...current, ...extra]));
      })
      .catch(error => toast.error(errorText(error, 'That delivery could not be opened')));
    return () => {
      cancelled = true;
    };
  }, [openId, deliveries]);

  const suppliers = useMemo(() => new Map(context.suppliers.map(supplier => [supplier.id, supplier.name])), [context.suppliers]);
  const open = deliveries?.find(delivery => delivery.id === openId) ?? null;

  const columns: TableColumn<Delivery>[] = [
    { key: 'date', header: 'Date', render: row => day(row.documentDate) },
    {
      key: 'number',
      header: 'Document',
      render: row => (
        <div>
          <p className="font-medium text-gray-900">{row.number}{row.reversedAt && <span className="ml-2 text-xs font-normal text-red-600">reversed</span>}</p>
          <p className="text-xs text-gray-500">{row.consignment ? 'Consignment' : row.kind === 'received' ? 'Received' : 'Returned'} · {row.supplierReference}</p>
        </div>
      )
    },
    { key: 'supplier', header: 'Supplier', hideBelow: 'sm', render: row => suppliers.get(row.supplierId) ?? 'Supplier' },
    { key: 'total', header: 'Total incl. VAT', align: 'right', render: row => nad(row.inclVatCents) },
    { key: 'payable', header: 'Payable', hideBelow: 'md', render: row => <PayableChip delivery={row} payables={payables} /> }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Each delivery is typed from the supplier&apos;s invoice; its total goes to payables, where it is marked paid.</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setMode('return')} className={SECONDARY}>
            <Icon icon="solar:inbox-out-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Return to supplier
          </button>
          <button type="button" onClick={() => setMode('receive')} className={PRIMARY}>
            <Icon icon="solar:inbox-in-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Receive stock
          </button>
        </div>
      </div>

      {failed ? (
        <ErrorState title="Deliveries could not be loaded" message={failed} onRetry={() => void load()} />
      ) : deliveries === null ? (
        <LoadingState label="Loading deliveries" />
      ) : (
        <DataTable
          rows={deliveries}
          columns={columns}
          rowKey={row => row.id}
          onRowClick={row => setOpenId(row.id)}
          rowLabel={row => `Open ${row.number}`}
          itemLabel="deliveries"
          empty={<EmptyState icon="solar:delivery-bold-duotone" title="No deliveries yet" message="Record a delivery when stock arrives: the shelf, its value and the supplier's payable update together." />}
        />
      )}

      {open && <DeliveryDetail context={context} delivery={open} payables={payables} onClose={() => setOpenId(null)} onChanged={() => { void load(); context.reload(); }} />}
      {mode && (
        <DeliverySheet
          context={context}
          mode={mode}
          open
          onClose={() => setMode(null)}
          onSaved={id => {
            setMode(null);
            context.reload();
            void load().then(() => setOpenId(id));
          }}
        />
      )}
    </div>
  );
};

export default DeliveriesTab;
