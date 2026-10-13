import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { DANGER, LINK, PRIMARY, QUIET, SECONDARY, errorText } from '../stock/stockUi';
import { daysBetweenKeys, formatServiceDate } from '../../utils/billing/dates';
import { setLabOrderStatus, type SlipHeading } from '../../services/optometry/optometryService';
import {
  LAB_EYES_LABELS,
  LAB_STATUS_ACTIONS,
  LAB_STATUS_LABELS,
  LENS_MATERIAL_LABELS,
  LENS_TYPE_LABELS,
  NEXT_LAB_STATUSES,
  daysWaiting,
  isOpenLabOrder,
  labStatusNeedsReason,
  type LabOrderStatus
} from '../../utils/optometry/labOrders';
import type { LabOrderRecord, PrescriptionRecord } from '../../utils/optometry/records';
import { stockItemLink, supplierLink } from '../billing/invoiceLinks';
import { LabStatusChip } from './optometryParts';
import ReasonSheet from './ReasonSheet';
import { labOrderSlipHtml, printSlip, type SlipPatient } from './slips';

interface LabOrderCardProps {
  order: LabOrderRecord;
  today: string;
  /** For the printed slip; null while it loads (printing waits) */
  heading: SlipHeading | null;
  patient: SlipPatient;
  prescription: PrescriptionRecord | null;
  onChanged: () => void;
  /** Change the order (only while it has not gone to the lab) */
  onEdit?: () => void;
  /** Across the practice: the patient's file, where the order sits */
  patientLink?: string | null;
}

/** The step that moves an order forward is the main button; the others sit beside it. */
const FORWARD: Readonly<Partial<Record<LabOrderStatus, LabOrderStatus>>> = { ordered: 'received', received: 'fitted', fitted: 'collected', remake: 'received' };

/**
 * One lab order: what was ordered, where it is and for how long, its next steps (a remake or a cancellation asks
 * why), the slip for the lab and every step taken so far.
 */
const LabOrderCard: React.FC<LabOrderCardProps> = ({ order, today, heading, patient, prescription, onChanged, onEdit, patientLink = null }) => {
  const [busy, setBusy] = useState<LabOrderStatus | null>(null);
  const [asking, setAsking] = useState<LabOrderStatus | null>(null);
  const [showSteps, setShowSteps] = useState(false);
  const waiting = daysWaiting(order.status, order.statusOn, today);
  const overdue = order.requiredBy !== null && isOpenLabOrder(order.status) && order.requiredBy < today;

  // Errors are shown by the caller: a toast for a button, the reason sheet's own message for a remake or cancellation
  const move = async (status: LabOrderStatus, reason: string | null) => {
    setBusy(status);
    try {
      await setLabOrderStatus(order.id, status, reason, null);
      toast.success(`Order ${order.orderNo}: ${LAB_STATUS_LABELS[status].toLowerCase()}.`);
      onChanged();
    } finally {
      setBusy(null);
    }
  };
  const step = (status: LabOrderStatus) => void move(status, null).catch((failure: unknown) => toast.error(errorText(failure)));

  const print = () => {
    if (!heading) return;
    if (!printSlip(labOrderSlipHtml(heading, patient, order, prescription))) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };

  const steps = NEXT_LAB_STATUSES[order.status];
  const forward = FORWARD[order.status];
  const since = waiting === null ? null : waiting === 0 ? 'today' : `${waiting} day${waiting === 1 ? '' : 's'}`;

  return (
    <article className="rounded-xl border border-gray-200 p-3" aria-label={`Lab order ${order.orderNo}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900">Order {order.orderNo}</h4>
        <LabStatusChip status={order.status} />
        {since && <span className="text-xs text-gray-500">{order.status === 'ordered' || order.status === 'remake' ? 'At the lab' : 'Waiting'} {since === 'today' ? 'since today' : `for ${since}`}</span>}
        {patientLink && (
          <Link to={patientLink} className={`${LINK} text-sm`}>
            {patient.name}
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-700">
        {LENS_TYPE_LABELS[order.lensType]}, {LENS_MATERIAL_LABELS[order.material].toLowerCase()} · {LAB_EYES_LABELS[order.eyes].toLowerCase()}
        {order.tintPercent ? ` · tint ${order.tintPercent} %` : ''}
      </p>
      <p className="text-xs text-gray-600">
        Ordered {formatServiceDate(order.orderedOn)}
        {order.supplierName && order.supplierId ? (
          <>
            {' · '}
            <Link to={supplierLink(order.supplierId)} className={LINK}>{order.supplierName}</Link>
          </>
        ) : null}
        {order.labReference ? ` · lab ref. ${order.labReference}` : ''}
        {order.requiredBy ? (
          <span className={overdue ? 'font-medium text-red-700' : ''}>
            {` · needed by ${formatServiceDate(order.requiredBy)}`}
            {overdue ? ` (${daysBetweenKeys(order.requiredBy, today)} days late)` : ''}
          </span>
        ) : null}
      </p>
      <p className="text-xs text-gray-600">
        Frame:{' '}
        {order.frameItemId ? <Link to={stockItemLink(order.frameItemId)} className={LINK}>{order.frameName ?? 'from stock'}</Link> : order.frameName ?? ''}
        {order.frameNote ? `${order.frameItemId || order.frameName ? ' · ' : ''}${order.frameNote}` : ''}
      </p>

      <div className="mt-2 flex flex-wrap gap-2">
        {forward && steps.includes(forward) && (
          <button type="button" className={PRIMARY} disabled={busy !== null} onClick={() => step(forward)}>
            {busy === forward && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {LAB_STATUS_ACTIONS[forward]}
          </button>
        )}
        {steps.filter(next => next !== forward).map(next => (
          <button
            key={next}
            type="button"
            className={next === 'cancelled' ? DANGER : SECONDARY}
            disabled={busy !== null}
            onClick={() => (labStatusNeedsReason(next) ? setAsking(next) : step(next))}
          >
            {LAB_STATUS_ACTIONS[next]}
          </button>
        ))}
        <button type="button" className={QUIET} onClick={print} disabled={!heading}>
          <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Slip for the lab
        </button>
        {onEdit && order.status === 'ordered' && (
          <button type="button" className={QUIET} onClick={onEdit}>
            <Icon icon="solar:pen-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Change
          </button>
        )}
        <button type="button" className={QUIET} aria-expanded={showSteps} onClick={() => setShowSteps(value => !value)}>
          <Icon icon="solar:history-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Steps ({order.events.length})
        </button>
      </div>

      {showSteps && (
        <ol className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3 text-xs text-gray-600">
          {order.events.map(event => (
            <li key={`${event.changedAt}-${event.status}`}>
              <span className="font-medium text-gray-800">{LAB_STATUS_LABELS[event.status]}</span> · {formatServiceDate(event.on)}
              {event.changedBy ? ` · ${event.changedBy}` : ''}
              {event.reason ? ` · ${event.reason}` : ''}
            </li>
          ))}
        </ol>
      )}

      <ReasonSheet
        open={asking !== null}
        title={asking === 'remake' ? `Send order ${order.orderNo} for a remake` : `Cancel order ${order.orderNo}`}
        description={asking === 'remake' ? 'The lenses go back to the lab. The reason is kept with the order and counts in the report.' : 'The order stays in the history, marked cancelled.'}
        label={asking === 'remake' ? 'What is wrong' : 'Why it is cancelled'}
        placeholder={asking === 'remake' ? 'E.g. axis of the right lens out' : 'E.g. the patient changed their mind'}
        confirmLabel={asking === 'remake' ? 'Send for a remake' : 'Cancel the order'}
        danger={asking === 'cancelled'}
        onClose={() => setAsking(null)}
        onConfirm={reason => (asking ? move(asking, reason) : Promise.resolve())}
      />
    </article>
  );
};

export default LabOrderCard;
