import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { canStock } from '../../utils/stock/stockRoles';
import { INPUT, LINK, PRIMARY, QUIET, SECONDARY, nad } from '../stock/stockUi';
import { stockItemLink, stockLink } from '../billing/invoiceLinks';
import { LabelPrintSheet } from '../labels/LabelPrintSheet';
import { loadStaffNames } from '../../services/stock/stockService';
import { loadFrames, type FrameRow } from '../../services/optometry/optometryService';
import { loadFrameUnits, type NewUnit } from '../../services/optometry/frameUnitsService';
import { FRAME_STATUS_LABELS, type FrameStatus } from '../../utils/optometry/frames';
import { barcodeCheck, isOnHandStatus, sameBarcode, type FrameUnit } from '../../utils/optometry/frameUnits';
import { frameLabel } from '../../utils/labels/labelContent';
import type { LabelData } from '../../utils/labels/labelSheet';
import { EyesNotSetUp, FrameStatusChip } from './optometryParts';
import FrameSheet from './FrameSheet';
import FrameUnitsList from './FrameUnitsList';
import ReceiveFramesSheet from './ReceiveFramesSheet';
import ReturnFramesSheet from './ReturnFramesSheet';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; frames: FrameRow[] };
/** The frames' barcodes (proposals/2026-10-13-optometry-frames-and-exam.sql): the frames work without them */
type UnitsState = { status: 'ready'; units: FrameUnit[] } | { status: 'not_set_up' } | { status: 'error'; message: string };

const FILTERS: ReadonlyArray<FrameStatus | 'all'> = ['all', 'in_stock', 'on_order', 'sold', 'none'];

/** One label per barcode, with the frame's brand, model, colour, size and price */
const labelsFor = (frame: FrameRow, barcodes: readonly string[]): LabelData[] =>
  barcodes.map(code => frameLabel({
    code,
    brand: frame.details?.brand ?? frame.item.name,
    model: frame.details?.model ?? null,
    colour: frame.details?.colour ?? null,
    size: frame.details?.size ?? null,
    priceCents: frame.item.sellingPriceCents
  }));

/**
 * The practice's frames (stock items in the Frames group) with their status from the stock ledger and the open lab
 * orders: in stock, on order for a patient, sold. Each frame on the wall has its own barcode (Barcodes under the
 * frame): received with one, put aside, sold, sent back or written off, with who did it and when. Scanning a barcode
 * into the search finds the frame. Stock takes are on the Stock page, as for any item.
 */
const FramesPanel: React.FC<{ practiceId: string }> = ({ practiceId }) => {
  const role = useAuthStore(state => state.user?.role ?? null);
  const canEditFrames = canStock(role, 'edit_items');
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [unitsState, setUnitsState] = useState<UnitsState | null>(null);
  const [staff, setStaff] = useState<Array<{ id: string; name: string }>>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FrameStatus | 'all'>('all');
  const [editing, setEditing] = useState<{ open: boolean; frame: FrameRow | null }>({ open: false, frame: null });
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [receiving, setReceiving] = useState<{ open: boolean; itemId: string | null }>({ open: false, itemId: null });
  const [returning, setReturning] = useState<{ open: boolean; unitIds: string[] }>({ open: false, unitIds: [] });
  const [printing, setPrinting] = useState<{ title: string; labels: LabelData[] } | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    loadFrames(practiceId)
      .then(result => !cancelled && setLoad(result.status === 'not_set_up' ? { status: 'not_set_up' } : { status: 'ready', frames: result.frames }))
      .catch((error: unknown) => !cancelled && setLoad({ status: 'error', message: error instanceof Error ? error.message : 'Could not read the frames.' }));
    loadFrameUnits(practiceId)
      .then(result => !cancelled && setUnitsState(result.status === 'ready' ? { status: 'ready', units: result.data } : { status: 'not_set_up' }))
      .catch((error: unknown) => !cancelled && setUnitsState({ status: 'error', message: error instanceof Error ? error.message : 'Could not read the frame barcodes.' }));
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  useEffect(() => {
    let cancelled = false;
    loadStaffNames(practiceId)
      .then(names => !cancelled && setStaff([...names].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [practiceId]);

  const units = useMemo(() => (unitsState?.status === 'ready' ? unitsState.units : null), [unitsState]);
  const unitsByItem = useMemo(() => {
    const byItem = new Map<string, FrameUnit[]>();
    for (const unit of units ?? []) byItem.set(unit.itemId, [...(byItem.get(unit.itemId) ?? []), unit]);
    return byItem;
  }, [units]);
  // A frame's own barcode scanned into the search
  const scanned = useMemo(() => {
    const text = search.trim();
    return text && units ? units.find(unit => sameBarcode(unit.barcode, text)) ?? null : null;
  }, [search, units]);

  const shown = useMemo(() => {
    if (load.status !== 'ready') return [];
    const text = search.trim().toLowerCase();
    return load.frames
      .filter(frame => filter === 'all' || frame.status === filter || frame.item.id === scanned?.itemId)
      .filter(frame => !text || frame.item.name.toLowerCase().includes(text) || (frame.item.barcode ?? '').toLowerCase() === text || frame.item.id === scanned?.itemId)
      .sort((a, b) => a.item.name.localeCompare(b.item.name));
  }, [load, search, filter, scanned]);

  const toggle = (itemId: string) =>
    setExpanded(current => {
      const next = new Set(current);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });

  const printReceived = (received: NewUnit[]) => {
    if (load.status !== 'ready' || received.length === 0) return;
    const labels = load.frames.flatMap(frame => labelsFor(frame, received.filter(unit => unit.itemId === frame.item.id).map(unit => unit.barcode)));
    setPrinting({ title: 'Labels for the frames received', labels });
  };

  if (load.status === 'loading') return <p className="py-6 text-center text-sm text-gray-500" role="status">Loading the frames...</p>;
  if (load.status === 'not_set_up') return <EyesNotSetUp compact />;
  if (load.status === 'error') {
    return (
      <div className="space-y-2 py-4 text-center" role="alert">
        <p className="text-sm text-red-700">{load.message}</p>
        <button type="button" className={SECONDARY} onClick={reload}>Try again</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 text-sm">
          <span className="mb-1.5 block font-medium text-gray-700">Find a frame</span>
          <input className={INPUT} value={search} onChange={event => setSearch(event.target.value)} placeholder="Scan a barcode, or type a brand or model" autoComplete="off" />
        </label>
        {units && load.frames.length > 0 && (
          <>
            <button type="button" className={SECONDARY} onClick={() => setReceiving({ open: true, itemId: null })}>
              <Icon icon="solar:delivery-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Receive frames
            </button>
            <button type="button" className={SECONDARY} onClick={() => setReturning({ open: true, unitIds: [] })}>
              Send back
            </button>
          </>
        )}
        {/* Adding or changing a frame is changing a stock item: the database lets a practice admin, doctor or nurse
            do it, as the Stock page's Add item (a receptionist filled the form in only to be refused) */}
        {canEditFrames && (
          <button type="button" className={PRIMARY} onClick={() => setEditing({ open: true, frame: null })}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Add a frame
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Show frames">
        {FILTERS.map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => setFilter(option)}
            className={`rounded-full px-3 py-1 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 ${filter === option ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {option === 'all' ? `All (${load.frames.length})` : FRAME_STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      {unitsState?.status === 'not_set_up' && (
        <p className="text-xs text-gray-500">A barcode per frame is not set up yet: frames work as before.</p>
      )}
      {unitsState?.status === 'error' && (
        <p className="text-xs text-red-700" role="alert">{unitsState.message}</p>
      )}
      {shown.length === 0 ? (
        <p className="py-4 text-center text-sm text-gray-500">
          {load.frames.length === 0 ? 'No frames in stock yet.' : 'No frame matches.'}{' '}
          <Link to={stockLink('deliveries')} className={LINK}>Deliveries are recorded on the Stock page</Link>.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
          {shown.map(frame => {
            const frameUnits = unitsByItem.get(frame.item.id) ?? [];
            const check = units ? barcodeCheck(frame.onHand, frameUnits) : null;
            const open = expanded.has(frame.item.id) || scanned?.itemId === frame.item.id;
            return (
              <li key={frame.item.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3">
                <div className="min-w-0 flex-1">
                  <Link to={stockItemLink(frame.item.id)} className={`${LINK} text-sm`}>{frame.item.name}</Link>
                  <p className="text-xs text-gray-500">
                    {frame.onHand} on hand · {frame.onOrder} on order · {frame.sold} sold
                    {frame.item.barcode ? ` · barcode ${frame.item.barcode}` : ''}
                    {frame.item.sellingPriceCents !== null ? ` · ${nad(frame.item.sellingPriceCents)}` : ''}
                    {!frame.details ? ' · brand and model not recorded' : ''}
                    {frame.consignment ? ' · consignment' : ''}
                    {check && check.withoutBarcode > 0 ? ` · ${check.withoutBarcode} without a barcode` : ''}
                    {check && check.extraBarcodes > 0 ? ' · barcodes to check' : ''}
                  </p>
                </div>
                <FrameStatusChip status={frame.status} />
                {canEditFrames && (
                  <button type="button" className={QUIET} onClick={() => setEditing({ open: true, frame })}>
                    Change
                  </button>
                )}
                {units && (
                  // On a phone on its own line, so the frame's name keeps the room it had
                  <div className="basis-full sm:basis-auto">
                    <button type="button" className={QUIET} aria-expanded={open} onClick={() => toggle(frame.item.id)}>
                      Barcodes ({frameUnits.filter(unit => isOnHandStatus(unit.status)).length})
                    </button>
                  </div>
                )}
                {units && open && (
                  <div className="basis-full">
                    <FrameUnitsList
                      frame={frame}
                      units={frameUnits}
                      role={role}
                      staff={staff}
                      highlightId={scanned?.itemId === frame.item.id ? scanned.id : null}
                      onChanged={reload}
                      onReturn={unitIds => setReturning({ open: true, unitIds })}
                      onPrint={barcodes => setPrinting({ title: `Labels: ${frame.item.name}`, labels: labelsFor(frame, barcodes) })}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <FrameSheet open={editing.open} practiceId={practiceId} frame={editing.frame} onClose={() => setEditing({ open: false, frame: null })} onSaved={reload} />
      {units && (
        <>
          <ReceiveFramesSheet
            open={receiving.open}
            practiceId={practiceId}
            frames={load.frames}
            startItemId={receiving.itemId}
            onClose={() => setReceiving({ open: false, itemId: null })}
            onReceived={result => {
              reload();
              printReceived(result.units);
            }}
          />
          <ReturnFramesSheet
            open={returning.open}
            practiceId={practiceId}
            frames={load.frames}
            units={units}
            startUnitIds={returning.unitIds}
            onClose={() => setReturning({ open: false, unitIds: [] })}
            onReturned={reload}
          />
        </>
      )}
      <LabelPrintSheet open={printing !== null} onClose={() => setPrinting(null)} title={printing?.title ?? 'Frame labels'} purpose="frame" look="cyan" labels={printing?.labels ?? null} />
    </div>
  );
};

export default FramesPanel;
