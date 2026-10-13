import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { Chip } from '../stock/stockParts';
import { LINK, QUIET, day, errorText } from '../stock/stockUi';
import { invoiceLink, patientEyesLink, stockDeliveryLink } from '../billing/invoiceLinks';
import { loadPatientNames } from '../../services/stock/stockService';
import { actOnFrameUnit, addFrameUnits, loadFrameUnitEvents } from '../../services/optometry/frameUnitsService';
import type { FrameRow } from '../../services/optometry/optometryService';
import {
  FRAME_UNIT_STATUS_LABELS,
  UNIT_ACTION_LABELS,
  barcodeCheck,
  isOnHandStatus,
  unitActions,
  unitStory,
  type FrameUnit,
  type FrameUnitEvent,
  type FrameUnitStatus,
  type UnitAction
} from '../../utils/optometry/frameUnits';
import { AddBarcodesSheet, HoldSheet, SellerSheet, WriteOffSheet } from './FrameUnitSheets';

const UNIT_TONES: Readonly<Record<FrameUnitStatus, 'gray' | 'green' | 'amber' | 'red' | 'cyan' | 'violet'>> = {
  in_stock: 'green',
  reserved: 'violet',
  sold: 'gray',
  returned: 'cyan',
  written_off: 'red'
};

const by = (name: string | null): string => (name ? ` by ${name}` : '');

interface FrameUnitsListProps {
  frame: FrameRow;
  /** This frame's barcodes, any status */
  units: readonly FrameUnit[];
  role: string | null;
  staff: ReadonlyArray<{ id: string; name: string }>;
  /** The barcode just scanned into the search */
  highlightId: string | null;
  onChanged: () => void;
  /** Opens "Send frames back to the supplier" with these frames chosen */
  onReturn: (unitIds: string[]) => void;
  onPrint: (barcodes: string[]) => void;
}

type Dialog = { kind: 'hold' | 'lost' | 'seller'; unit: FrameUnit } | { kind: 'add' } | null;

/**
 * One frame's barcodes under its row on the Frames tab: each physical frame with its status, who changed it and when,
 * the patient it is kept for or sold to, its history, and what can be done with it. The stock count (the ledger) is
 * the truth for how many are on the shelf: a frame without a barcode, or a barcode the count no longer has, shows
 * here with the step that puts it right.
 */
const FrameUnitsList: React.FC<FrameUnitsListProps> = ({ frame, units, role, staff, highlightId, onChanged, onReturn, onPrint }) => {
  const [showAll, setShowAll] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [history, setHistory] = useState<{ unitId: string; events: FrameUnitEvent[] | null; error: string | null } | null>(null);
  const [patients, setPatients] = useState<Map<string, string>>(new Map());

  const inPractice = useMemo(() => units.filter(unit => isOnHandStatus(unit.status)), [units]);
  const others = units.length - inPractice.length;
  const highlighted = units.find(unit => unit.id === highlightId) ?? null;
  const shown = showAll || (highlighted && !isOnHandStatus(highlighted.status)) ? units : inPractice;
  const check = barcodeCheck(frame.onHand, units);

  const patientKey = units.flatMap(unit => (unit.patientId ? [unit.patientId] : [])).sort().join(',');
  useEffect(() => {
    if (!patientKey) return;
    let cancelled = false;
    loadPatientNames(patientKey.split(','))
      .then(names => !cancelled && setPatients(names))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [patientKey]);

  const act = async (unit: FrameUnit, action: Exclude<UnitAction, 'return'>, payload: Record<string, unknown> = {}, done?: string) => {
    await actOnFrameUnit(unit.id, action, payload);
    toast.success(done ?? `${unit.barcode}: ${UNIT_ACTION_LABELS[action].toLowerCase()}.`);
    onChanged();
  };

  const quick = async (unit: FrameUnit, action: 'release' | 'found') => {
    setBusyId(unit.id);
    try {
      await act(unit, action, {}, action === 'release' ? `${unit.barcode} is back on the shelf.` : `${unit.barcode} is back in stock.`);
    } catch (failure) {
      toast.error(errorText(failure));
    } finally {
      setBusyId(null);
    }
  };

  const openHistory = (unit: FrameUnit) => {
    if (history?.unitId === unit.id) {
      setHistory(null);
      return;
    }
    setHistory({ unitId: unit.id, events: null, error: null });
    loadFrameUnitEvents(unit.id)
      .then(events => setHistory(current => (current?.unitId === unit.id ? { unitId: unit.id, events: unitStory(events), error: null } : current)))
      .catch((failure: unknown) => setHistory(current => (current?.unitId === unit.id ? { unitId: unit.id, events: null, error: errorText(failure) } : current)));
  };

  const run = (unit: FrameUnit, action: UnitAction) => {
    if (action === 'return') onReturn([unit.id]);
    else if (action === 'release' || action === 'found') void quick(unit, action);
    else setDialog({ kind: action, unit });
  };

  const patient = (unit: FrameUnit) =>
    unit.patientId ? (
      <Link to={patientEyesLink(unit.patientId)} className={LINK}>{patients.get(unit.patientId) ?? 'the patient'}</Link>
    ) : null;

  const detail = (unit: FrameUnit): React.ReactNode => {
    switch (unit.status) {
      case 'in_stock':
        return <>Since {day(unit.statusOn)}{by(unit.statusChangedBy)}</>;
      case 'reserved':
        return (
          <>
            Since {day(unit.statusOn)}{by(unit.statusChangedBy)}
            {unit.patientId && <> · for {patient(unit)}</>}
            {unit.labOrderId && ' (spectacles order)'}
            {unit.note && <>: {unit.note}</>}
          </>
        );
      case 'sold':
        return (
          <>
            {day(unit.soldOn ?? unit.statusOn)}
            {unit.soldBy ? `, sold by ${unit.soldBy}` : ', salesperson not known'}
            {unit.patientId && <> · to {patient(unit)}</>}
            {unit.invoiceId && <> · <Link to={invoiceLink(unit.invoiceId)} className={LINK}>invoice</Link></>}
          </>
        );
      case 'returned':
        return (
          <>
            {day(unit.statusOn)}{by(unit.statusChangedBy)}
            {unit.returnedDeliveryId && <> · <Link to={stockDeliveryLink(unit.returnedDeliveryId)} className={LINK}>return note</Link></>}
          </>
        );
      case 'written_off':
        return <>{day(unit.statusOn)}{by(unit.statusChangedBy)}{unit.note && <>: {unit.note}</>}</>;
    }
  };

  const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

  return (
    <div className="space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3" aria-label={`Barcodes of ${frame.item.name}`}>
      {check.withoutBarcode > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-amber-900" role="status">
          <span>{plural(check.withoutBarcode, 'frame on the shelf has', 'frames on the shelf have')} no barcode yet.</span>
          {role && (
            <button type="button" className={QUIET} onClick={() => setDialog({ kind: 'add' })}>
              Give {check.withoutBarcode === 1 ? 'it a barcode' : 'them barcodes'}
            </button>
          )}
        </div>
      )}
      {check.extraBarcodes > 0 && (
        <p className="text-sm text-amber-900" role="status">
          {plural(check.extraBarcodes, 'barcode is', 'barcodes are')} in stock but the stock count has {frame.onHand} on the shelf: find the frame
          {check.extraBarcodes === 1 ? '' : 's'} by scanning, then mark the missing {check.extraBarcodes === 1 ? 'one' : 'ones'} lost or damaged.
        </p>
      )}

      {units.length === 0 ? (
        <p className="text-sm text-gray-500">No barcodes yet.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {shown.map(unit => {
            const actions = unitActions(unit.status, role);
            return (
              <li key={unit.id} className={`space-y-1 py-2 ${unit.id === highlightId ? 'rounded-lg bg-cyan-50/60 px-2' : ''}`}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-sm font-semibold text-gray-900 tabular-nums">{unit.barcode}</span>
                  <Chip tone={UNIT_TONES[unit.status]}>{FRAME_UNIT_STATUS_LABELS[unit.status]}</Chip>
                  <span className="min-w-[12rem] flex-1 text-xs text-gray-600">{detail(unit)}</span>
                  <div className="flex flex-wrap gap-1">
                    {actions.map(action => (
                      <button key={action} type="button" className={QUIET} disabled={busyId === unit.id} onClick={() => run(unit, action)}>
                        {UNIT_ACTION_LABELS[action]}
                      </button>
                    ))}
                    <button type="button" className={QUIET} aria-expanded={history?.unitId === unit.id} onClick={() => openHistory(unit)}>
                      History
                    </button>
                  </div>
                </div>
                {history?.unitId === unit.id && (
                  <div className="pl-1 text-xs text-gray-600">
                    {history.error ? (
                      <p className="text-red-700" role="alert">{history.error}</p>
                    ) : history.events === null ? (
                      <p role="status">Loading the history...</p>
                    ) : history.events.length === 0 ? (
                      <p>No history recorded.</p>
                    ) : (
                      <ol className="space-y-0.5">
                        {history.events.map((event, index) => (
                          <li key={`${event.changedAt}-${index}`}>
                            <span className="font-medium text-gray-800">{day(event.on)}</span> · {FRAME_UNIT_STATUS_LABELS[event.status]}
                            {event.reason ? `: ${event.reason}` : ''}
                            {by(event.changedBy)}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap gap-1">
        {inPractice.length > 0 && (
          <button type="button" className={QUIET} onClick={() => onPrint(inPractice.map(unit => unit.barcode))}>
            Print labels ({inPractice.length})
          </button>
        )}
        {others > 0 && (
          <button type="button" className={QUIET} aria-pressed={showAll} onClick={() => setShowAll(value => !value)}>
            {showAll ? 'Only the frames in the practice' : `Also sold and returned (${others})`}
          </button>
        )}
      </div>

      <HoldSheet
        open={dialog?.kind === 'hold'}
        barcode={dialog && dialog.kind !== 'add' ? dialog.unit.barcode : ''}
        onClose={() => setDialog(null)}
        onConfirm={note => (dialog && dialog.kind !== 'add' ? act(dialog.unit, 'hold', { note }, `${dialog.unit.barcode} is put aside.`) : Promise.resolve())}
      />
      <WriteOffSheet
        open={dialog?.kind === 'lost'}
        barcode={dialog && dialog.kind !== 'add' ? dialog.unit.barcode : ''}
        onClose={() => setDialog(null)}
        onConfirm={(code, note) => (dialog && dialog.kind !== 'add' ? act(dialog.unit, 'lost', { reason_code: code, note }, `${dialog.unit.barcode} is written off.`) : Promise.resolve())}
      />
      <SellerSheet
        open={dialog?.kind === 'seller'}
        barcode={dialog && dialog.kind !== 'add' ? dialog.unit.barcode : ''}
        staff={staff}
        current={dialog && dialog.kind !== 'add' ? dialog.unit.soldById : null}
        onClose={() => setDialog(null)}
        onConfirm={userId => (dialog && dialog.kind !== 'add' ? act(dialog.unit, 'seller', { user_id: userId }, 'Salesperson saved.') : Promise.resolve())}
      />
      <AddBarcodesSheet
        open={dialog?.kind === 'add'}
        frameName={frame.item.name}
        missing={check.withoutBarcode}
        onClose={() => setDialog(null)}
        onConfirm={async (barcodes, count) => {
          const added = await addFrameUnits(frame.item.id, barcodes.length > 0 ? null : count, barcodes);
          toast.success(`${added.length} frame${added.length === 1 ? ' has' : 's have'} a barcode now.`);
          onChanged();
          // Numbers the practice gave need a label on the frame
          if (barcodes.length === 0 && added.length > 0) onPrint(added.map(unit => unit.barcode));
        }}
      />
    </div>
  );
};

export default FrameUnitsList;
