import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { DataTable, type TableColumn } from '../finance/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../finance/FinanceUI';
import { ListSheet } from '../patientLists/ListSheet';
import { stockItemLink, stockStoreLink } from '../billing/invoiceLinks';
import { cancelTransfer, loadTransfer, loadTransfers, receiveTransfer, sendTransfer } from '../../services/stock/storeService';
import type { StockItem } from '../../utils/stock/items';
import type { ItemLevel } from '../../utils/stock/stockRows';
import {
  MAIN_STORE,
  TRANSFER_STATUS_LABELS,
  defaultStoreFor,
  findTransfer,
  locationIdOf,
  storeChoices,
  storeFromParam,
  storeName,
  transferProblem,
  transfersOfStore,
  type StockTransfer
} from '../../utils/stock/stores';
import { dayOf } from '../../utils/stock/supplierLedger';
import { ItemPicker } from './ItemPicker';
import type { StockContext } from './stockContext';
import { Chip, Field } from './stockParts';
import { StorePicker } from './storeParts';
import { DANGER, INPUT, LINK, PRIMARY, QUIET, SECONDARY, day, dayTime, errorText, nad, units } from './stockUi';

const STATUS_TONES = { sent: 'amber', received: 'green', cancelled: 'gray' } as const;

/** One store's stock as ItemPicker reads it (on hand per item) */
function storeItemLevels(context: StockContext, key: string): Map<string, ItemLevel> {
  const levels = context.storeLevels.get(key) ?? new Map();
  return new Map([...levels].map(([itemId, level]) => [itemId, { onHand: level.onHand, valueCents: level.valueCents, lastMovementOn: null, lastReceivedOn: null }]));
}

interface LineDraft {
  key: number;
  item: StockItem | null;
  quantity: string;
}

let nextKey = 1;

/** Send stock from one store to another: it leaves the first store now and is "on the way" until received */
const SendSheet: React.FC<{ context: StockContext; onClose: () => void; onSent: (id: string) => void }> = ({ context, onClose, onSent }) => {
  const mine = defaultStoreFor(context.stores, context.userBranchId);
  const choices = storeChoices(context.stores);
  const [from, setFrom] = useState(mine);
  const [to, setTo] = useState(() => choices.find(choice => choice.value !== mine)?.value ?? MAIN_STORE);
  const [lines, setLines] = useState<LineDraft[]>([{ key: nextKey++, item: null, quantity: '' }]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const fromLevels = useMemo(() => storeItemLevels(context, from), [context, from]);
  const update = (key: number, changes: Partial<LineDraft>) => setLines(current => current.map(line => (line.key === key ? { ...line, ...changes } : line)));

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const drafts = lines.map(line => ({ itemId: line.item?.id ?? null, quantity: /^\d+$/.test(line.quantity.trim()) ? Number(line.quantity) : null }));
    const problem = transferProblem({ from, to, lines: drafts }, itemId => fromLevels.get(itemId)?.onHand ?? 0,
      itemId => context.items.find(item => item.id === itemId)?.name ?? 'the item');
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    try {
      const result = await sendTransfer({
        practice_id: context.practiceId,
        from_location_id: locationIdOf(from),
        to_location_id: locationIdOf(to),
        notes: notes.trim() || null,
        lines: drafts.map(line => ({ item_id: line.itemId as string, quantity: line.quantity as number }))
      });
      toast.success(`${result.number} sent to ${storeName(context.stores, locationIdOf(to))}. It shows as on the way until it is received there.`);
      onSent(result.id);
    } catch (error) {
      toast.error(errorText(error, 'Could not send the stock.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      title="Send stock to another store"
      subtitle="It leaves this store now; the other store receives it when it arrives."
      size="lg"
      dismissible={!saving}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={onClose} className={SECONDARY}>Cancel</button>
          <button type="submit" form="stock-transfer-form" disabled={saving} className={PRIMARY}>
            {saving && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            Send
          </button>
        </div>
      }
    >
      <form id="stock-transfer-form" onSubmit={send} className="space-y-5" noValidate>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <StorePicker stores={context.stores} value={from} onChange={setFrom} label="From" />
          <StorePicker stores={context.stores} value={to} onChange={setTo} label="To" />
        </div>
        <ol className="space-y-3" aria-label="Items to send">
          {lines.map((line, index) => (
            <li key={line.key} className="rounded-2xl border border-gray-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Line {index + 1}</span>
                {lines.length > 1 && (
                  <button type="button" onClick={() => setLines(current => current.filter(other => other.key !== line.key))} className={QUIET} aria-label={`Remove line ${index + 1}`}>
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>
              <ItemPicker items={context.items} levels={fromLevels} value={line.item} onChange={item => update(line.key, { item })} showOnHand />
              <div className="mt-3 max-w-[12rem]">
                <Field label={`How many${line.item ? ` (${line.item.unit})` : ''}`}>
                  {props => <input {...props} value={line.quantity} onChange={event => update(line.key, { quantity: event.target.value })} className={INPUT} inputMode="numeric" />}
                </Field>
              </div>
            </li>
          ))}
        </ol>
        <button type="button" onClick={() => setLines(current => [...current, { key: nextKey++, item: null, quantity: '' }])} className={SECONDARY}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Add a line
        </button>
        <Field label="Note for the other store">
          {props => <input {...props} value={notes} onChange={event => setNotes(event.target.value)} className={INPUT} maxLength={500} placeholder="e.g. Sent with the courier at 10:00" />}
        </Field>
      </form>
    </ListSheet>
  );
};

/** One transfer: what went, who sent and received it and when; receive it, or cancel it if nothing arrived */
const TransferDetail: React.FC<{ context: StockContext; transfer: StockTransfer; onClose: () => void; onChanged: () => void }> = ({ context, transfer, onClose, onChanged }) => {
  const [busy, setBusy] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState('');
  const who = (userId: string | null) => (userId ? context.staffNames.get(userId) ?? 'A staff member' : 'A staff member');
  const at = dayTime;
  const from = storeName(context.stores, transfer.fromLocationId);
  const to = storeName(context.stores, transfer.toLocationId);
  // Each side opens its store's stock (the sending and the receiving store), whose page links back to its transfers
  const route = (
    <>
      <Link to={stockStoreLink(transfer.fromLocationId)} className={LINK}>{from}</Link> to <Link to={stockStoreLink(transfer.toLocationId)} className={LINK}>{to}</Link>
    </>
  );

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(done);
      onChanged();
      onClose();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ListSheet
      open
      onClose={onClose}
      title={`Transfer ${transfer.number}`}
      subtitle={route}
      size="lg"
      dismissible={!busy}
      footer={transfer.status === 'sent' ? (
        cancelling ? (
          <div className="space-y-2">
            <Field label="Why is it cancelled?" hint={`The stock goes back to ${from}.`}>
              {props => <input {...props} value={reason} onChange={event => setReason(event.target.value)} className={INPUT} maxLength={200} autoFocus />}
            </Field>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCancelling(false)} className={SECONDARY}>Keep it</button>
              <button type="button" disabled={busy || reason.trim().length < 3} className={DANGER}
                onClick={() => void run(() => cancelTransfer(transfer.id, reason.trim()), `${transfer.number} cancelled: the stock is back in ${from}.`)}>
                Cancel {transfer.number}
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
            <button type="button" onClick={() => setCancelling(true)} className={SECONDARY}>Nothing arrived? Cancel it</button>
            <button type="button" disabled={busy} className={PRIMARY}
              onClick={() => void run(() => receiveTransfer(transfer.id), `${transfer.number} received in ${to}.`)}>
              <Icon icon="solar:inbox-in-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Received in {to}
            </button>
          </div>
        )
      ) : undefined}
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Chip tone={STATUS_TONES[transfer.status]}>{TRANSFER_STATUS_LABELS[transfer.status]}</Chip>
        </div>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Sent</dt>
            <dd className="text-gray-800">{at(transfer.sentAt)} by {who(transfer.sentBy)}</dd>
          </div>
          {transfer.status === 'received' && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Received</dt>
              <dd className="text-gray-800">{at(transfer.receivedAt)} by {who(transfer.receivedBy)}</dd>
            </div>
          )}
          {transfer.status === 'cancelled' && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">Cancelled</dt>
              <dd className="text-gray-800">{at(transfer.cancelledAt)} by {who(transfer.cancelledBy)}: {transfer.cancelReason}</dd>
            </div>
          )}
        </dl>
        {transfer.notes && <p className="text-sm text-gray-600">{transfer.notes}</p>}
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {transfer.lines.map(line => (
            <li key={line.itemId} className="flex items-start justify-between gap-2 px-3 py-2 text-sm">
              <span className="min-w-0">
                {context.items.some(item => item.id === line.itemId) ? <Link to={stockItemLink(line.itemId)} className={LINK}>{line.name}</Link> : line.name}
                <span className="block text-xs text-gray-500">{units(line.quantity, line.unit)}</span>
              </span>
              <span className="text-right tabular-nums text-gray-700">{nad(line.valueCents)}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-gray-500">Values at the average cost when it was sent. The practice&apos;s stock value does not change with a transfer.</p>
      </div>
    </ListSheet>
  );
};

/**
 * L10: stock sent between the practice's stores, newest first; send stock, receive it, or cancel it. A link opens one
 * transfer (?transfer=, its id or TRF number: an item's history) or one store's transfers (?store=, from that store's
 * stock), so every side of a transfer opens the others.
 */
export const TransfersTab: React.FC<{ context: StockContext; openTransfer?: string | null; storeFilter?: string | null }> = ({
  context,
  openTransfer = null,
  storeFilter = null
}) => {
  const [transfers, setTransfers] = useState<StockTransfer[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  // One store's transfers ('' = the main store), or every transfer (null). A link's store applies once (as soon as the
  // practice's stores are known), so "Show every store" stays chosen when the stores are read again after a change
  const [only, setOnly] = useState<string | null>(() => storeFromParam(storeFilter, context.stores));
  const filtered = useRef<string | null>(only !== null ? storeFilter : null);
  useEffect(() => {
    if (!storeFilter || filtered.current === storeFilter) return;
    const key = storeFromParam(storeFilter, context.stores);
    if (key === null) return;
    filtered.current = storeFilter;
    setOnly(key);
  }, [storeFilter, context.stores]);

  const load = useCallback(async () => {
    setFailed(null);
    try {
      setTransfers(await loadTransfers(context.practiceId));
    } catch (error) {
      setFailed(errorText(error, 'Could not load the transfers'));
    }
  }, [context.practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // A link opens its transfer once; one older than the newest 200 is read and added
  const linked = useRef<string | null>(null);
  useEffect(() => {
    if (!openTransfer || transfers === null || linked.current === openTransfer) return;
    linked.current = openTransfer;
    const known = findTransfer(transfers, openTransfer);
    if (known) {
      setOpenId(known.id);
      return;
    }
    loadTransfer(context.practiceId, openTransfer)
      .then(found => {
        if (!found) {
          toast.error('That transfer could not be found.');
          return;
        }
        setTransfers(current => (current && !current.some(transfer => transfer.id === found.id) ? [...current, found] : current));
        setOpenId(found.id);
      })
      .catch(error => toast.error(errorText(error, 'That transfer could not be opened')));
  }, [openTransfer, transfers, context.practiceId]);

  const open = transfers?.find(transfer => transfer.id === openId) ?? null;
  const shown = useMemo(() => (transfers && only !== null ? transfersOfStore(transfers, only) : transfers), [transfers, only]);
  const onTheWay = (shown ?? []).filter(transfer => transfer.status === 'sent').length;

  // On a phone one column: the status and the day go with the transfer, and long store names wrap
  const columns: TableColumn<StockTransfer>[] = [
    { key: 'date', header: 'Sent', hideBelow: 'sm', render: row => day(dayOf(row.sentAt)) },
    {
      key: 'number',
      header: 'Transfer',
      render: row => (
        <div>
          <p className="font-medium text-gray-900">
            {row.number}
            <span className="ml-2 sm:hidden"><Chip tone={STATUS_TONES[row.status]}>{TRANSFER_STATUS_LABELS[row.status]}</Chip></span>
          </p>
          <p className="whitespace-normal text-xs text-gray-500">
            {storeName(context.stores, row.fromLocationId)} to {storeName(context.stores, row.toLocationId)}
            <span className="sm:hidden"> · {day(dayOf(row.sentAt))}</span>
          </p>
        </div>
      )
    },
    { key: 'items', header: 'Items', align: 'right', hideBelow: 'sm', render: row => String(row.lines.length) },
    { key: 'status', header: 'Status', hideBelow: 'sm', render: row => <Chip tone={STATUS_TONES[row.status]}>{TRANSFER_STATUS_LABELS[row.status]}</Chip> },
    { key: 'who', header: 'Sent by', hideBelow: 'md', render: row => (row.sentBy ? context.staffNames.get(row.sentBy) ?? 'A staff member' : '–') }
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {only !== null
            ? <>Sent from or to <Link to={stockStoreLink(locationIdOf(only))} className={LINK}>{storeName(context.stores, locationIdOf(only))}</Link>.</>
            : 'Stock moved between your stores.'}
          {onTheWay > 0 ? ` ${onTheWay} on the way: receive ${onTheWay === 1 ? 'it' : 'them'} when ${onTheWay === 1 ? 'it arrives' : 'they arrive'}.` : ''}
          {only !== null && <>{' '}<button type="button" onClick={() => setOnly(null)} className={LINK}>Show every store</button></>}
        </p>
        <button type="button" onClick={() => setSending(true)} className={PRIMARY}>
          <Icon icon="solar:transfer-horizontal-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Send stock
        </button>
      </div>
      {failed ? (
        <ErrorState title="Transfers could not be loaded" message={failed} onRetry={() => void load()} />
      ) : shown === null ? (
        <LoadingState label="Loading transfers" />
      ) : (
        <DataTable
          rows={shown}
          columns={columns}
          rowKey={row => row.id}
          onRowClick={row => setOpenId(row.id)}
          rowLabel={row => `Open ${row.number}`}
          itemLabel="transfers"
          empty={<EmptyState icon="solar:transfer-horizontal-bold-duotone" title={only !== null ? 'No transfers from or to this store' : 'No transfers yet'} message="Send stock to another store: it shows as on the way until the other store receives it." />}
        />
      )}
      {sending && (
        <SendSheet
          context={context}
          onClose={() => setSending(false)}
          onSent={id => {
            setSending(false);
            context.reload();
            void load().then(() => setOpenId(id));
          }}
        />
      )}
      {open && <TransferDetail context={context} transfer={open} onClose={() => setOpenId(null)} onChanged={() => { void load(); context.reload(); }} />}
    </div>
  );
};

export default TransfersTab;
