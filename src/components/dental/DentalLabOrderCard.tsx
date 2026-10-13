import React, { useEffect, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supplierLink, visitLink } from '../billing/invoiceLinks';
import { inputClass, primaryButton, secondaryButton } from '../quotes/QuoteBits';
import type { SlipHeading } from '../../services/optometry/optometryService';
import { isDentalLabNotSetUp, setDentalLabStatus } from '../../services/dental/labOrderService';
import { formatServiceDate } from '../../utils/billing/dates';
import { formatNad, fromCents } from '../../utils/billing/money';
import {
  DENTAL_LAB_STATUS_ACTIONS,
  DENTAL_LAB_STATUS_LABELS,
  NEXT_DENTAL_LAB_STATUSES,
  REASON_MAX,
  daysInStep,
  daysLate,
  describeLabWork,
  dueState,
  dentalLabStatusNeedsReason,
  type DentalLabStatus
} from '../../utils/dental/labOrders';
import type { DentalLabOrder } from '../../utils/dental/labOrderRecords';
import { LAB_FEE_CODE, labSlipTotalCents } from '../../utils/dental/labSlips';
import { printSlip, type SlipPatient } from '../optometry/slips';
import { dentalLabSlipHtml } from './labSlipPrint';

export interface DentalLabOrderCardProps {
  order: DentalLabOrder;
  today: string;
  /** For the printed slip; null while it loads (printing waits) */
  heading: SlipHeading | null;
  patient: SlipPatient;
  /** Links that leave the screen are text (inside a visit with unsaved changes) */
  navigation: boolean;
  onChanged: () => void;
  /** The lab's invoice lines (any staff member) */
  onEditSlip: () => void;
  /** Change the order (practitioners, nurses and practice admins, while it is at the lab) */
  onEdit?: () => void;
  /** Across the practice: the patient's file, with this order */
  patientLink?: string | null;
  /** Opened from a link to this order: it is shown first and highlighted */
  highlighted?: boolean;
}

/** The step that moves the work forward is the main button; the others sit beside it. */
const FORWARD: Readonly<Partial<Record<DentalLabStatus, DentalLabStatus>>> = { sent: 'received', received: 'fitted', remake: 'received' };

const STATUS_CHIPS: Readonly<Record<DentalLabStatus, string>> = {
  sent: 'bg-blue-50 text-blue-800',
  received: 'bg-amber-50 text-amber-800',
  fitted: 'bg-green-50 text-green-800',
  remake: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-700'
};

const smallButton =
  'inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';

export const DentalLabStatusChip: React.FC<{ status: DentalLabStatus }> = ({ status }) => (
  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${STATUS_CHIPS[status]}`}>{DENTAL_LAB_STATUS_LABELS[status]}</span>
);

/** When work at the lab is due: late (red), today (amber), soon, or its date. */
export const DueNote: React.FC<{ order: Pick<DentalLabOrder, 'status' | 'dueOn'>; today: string }> = ({ order, today }) => {
  const state = dueState(order, today);
  if (state === null || state === 'no_date') return null;
  if (state === 'overdue') {
    const late = daysLate(order.dueOn, today);
    return <span className="text-xs font-medium text-red-700">{late === 1 ? '1 day late' : `${late} days late`} (due {formatServiceDate(order.dueOn)})</span>;
  }
  if (state === 'due_today') return <span className="text-xs font-medium text-amber-800">Due back today</span>;
  return <span className="text-xs text-gray-500">Due back {formatServiceDate(order.dueOn)}</span>;
};

/**
 * One lab order: the work and where it is, its next steps (sending it back to be remade or cancelling it asks why), the
 * lab's invoice and where it is billed, the slip for the lab and every step so far.
 */
const DentalLabOrderCard: React.FC<DentalLabOrderCardProps> = ({ order, today, heading, patient, navigation, onChanged, onEditSlip, onEdit, patientLink = null, highlighted = false }) => {
  const [busy, setBusy] = useState<DentalLabStatus | null>(null);
  const [asking, setAsking] = useState<DentalLabStatus | null>(null);
  const [reason, setReason] = useState('');
  const [newDue, setNewDue] = useState('');
  const [showSteps, setShowSteps] = useState(false);
  const cardRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (highlighted) cardRef.current?.scrollIntoView?.({ block: 'center' });
  }, [highlighted]);

  const move = async (status: DentalLabStatus, options: { reason?: string; dueOn?: string } = {}) => {
    setBusy(status);
    try {
      await setDentalLabStatus(order.id, status, options);
      toast.success(`Order ${order.orderNo}: ${DENTAL_LAB_STATUS_LABELS[status].toLowerCase()}.`);
      setAsking(null);
      setReason('');
      setNewDue('');
      onChanged();
    } catch (failure) {
      toast.error(isDentalLabNotSetUp(failure) ? 'Lab work is not set up yet.' : failure instanceof Error ? plainWords(failure.message) : 'Could not change the order.');
    } finally {
      setBusy(null);
    }
  };

  const print = () => {
    if (!heading) return;
    if (!printSlip(dentalLabSlipHtml(heading, patient, order))) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };

  const steps = NEXT_DENTAL_LAB_STATUSES[order.status];
  const forward = FORWARD[order.status];
  const waiting = daysInStep(order.status, order.statusOn, today);
  const slipCents = labSlipTotalCents(order.slipLines);
  const visitRef = (visitId: string, label: string) =>
    navigation ? (
      <Link to={visitLink(order.patientId, visitId)} className="text-cyan-700 hover:underline">
        {label}
      </Link>
    ) : (
      <span>{label}</span>
    );

  return (
    <article
      ref={cardRef}
      className={`rounded-xl border p-3 ${highlighted ? 'border-cyan-300 ring-2 ring-cyan-100' : 'border-gray-200'}`}
      aria-label={`Lab order ${order.orderNo}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-gray-900">Order {order.orderNo}</h4>
        <DentalLabStatusChip status={order.status} />
        <DueNote order={order} today={today} />
        {waiting !== null && order.status === 'received' && (
          <span className="text-xs text-gray-500">{waiting === 0 ? 'Back today' : `Back for ${waiting} day${waiting === 1 ? '' : 's'}`}, waiting to be fitted</span>
        )}
        {patientLink && (
          <Link to={patientLink} className="text-sm text-cyan-700 hover:underline">
            {patient.name}
          </Link>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-800">
        {describeLabWork(order)}
        {order.shade ? ` · shade ${order.shade}` : ''}
      </p>
      <p className="text-xs text-gray-500">
        Sent {formatServiceDate(order.sentOn)}
        {order.labName && order.supplierId ? (
          <>
            {' to '}
            {navigation ? (
              <Link to={supplierLink(order.supplierId)} className="text-cyan-700 hover:underline">
                {order.labName}
              </Link>
            ) : (
              order.labName
            )}
          </>
        ) : null}
        {order.visitId && order.visitDate ? <> · started at the {visitRef(order.visitId, `visit of ${formatServiceDate(order.visitDate)}`)}</> : null}
        {order.createdBy ? ` · ${order.createdBy}` : ''}
      </p>
      {order.notes && <p className="mt-0.5 text-xs italic text-gray-600">{order.notes}</p>}
      {order.status !== 'cancelled' && (
        <p className="mt-1 text-xs text-gray-600">
          {order.slipLines.length > 0 ? (
            <>
              The lab&apos;s invoice{order.slipNumber ? ` ${order.slipNumber}` : ''}: {order.slipLines.length} line{order.slipLines.length === 1 ? '' : 's'},{' '}
              <span className="font-medium text-gray-900">{formatNad(fromCents(slipCents))}</span>
              {order.billedVisitId && order.billedVisitDate ? (
                <> · billed under {LAB_FEE_CODE} at the {visitRef(order.billedVisitId, `visit of ${formatServiceDate(order.billedVisitDate)}`)}</>
              ) : (
                ` · not billed yet: bill it under ${LAB_FEE_CODE} on the visit's Billing tab`
              )}
            </>
          ) : (
            "No invoice from the lab yet: enter its lines when the work comes back."
          )}
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {forward && steps.includes(forward) && (
          <button type="button" className={smallButton} disabled={busy !== null} onClick={() => void move(forward)}>
            <Icon
              icon={busy === forward ? 'solar:refresh-bold-duotone' : 'solar:check-circle-bold-duotone'}
              className={`h-3.5 w-3.5 text-green-600 ${busy === forward ? 'animate-spin motion-reduce:animate-none' : ''}`}
              aria-hidden="true"
            />
            {DENTAL_LAB_STATUS_ACTIONS[forward]}
          </button>
        )}
        {steps
          .filter(next => next !== forward)
          .map(next => (
            <button key={next} type="button" className={smallButton} disabled={busy !== null} onClick={() => (dentalLabStatusNeedsReason(next) ? setAsking(next) : void move(next))}>
              <Icon
                icon={next === 'cancelled' ? 'solar:close-circle-bold-duotone' : 'solar:restart-bold-duotone'}
                className={`h-3.5 w-3.5 ${next === 'cancelled' ? 'text-red-500' : 'text-amber-600'}`}
                aria-hidden="true"
              />
              {DENTAL_LAB_STATUS_ACTIONS[next]}
            </button>
          ))}
        {order.status !== 'cancelled' && (
          <button type="button" className={smallButton} onClick={onEditSlip}>
            <Icon icon="solar:bill-list-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            The lab&apos;s invoice
          </button>
        )}
        <button type="button" className={smallButton} onClick={print} disabled={!heading}>
          <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
          Slip for the lab
        </button>
        {onEdit && order.status === 'sent' && (
          <button type="button" className={smallButton} onClick={onEdit}>
            <Icon icon="solar:pen-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
            Change
          </button>
        )}
        <button type="button" className={smallButton} aria-expanded={showSteps} onClick={() => setShowSteps(value => !value)}>
          <Icon icon="solar:history-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
          Steps ({order.events.length})
        </button>
      </div>

      {asking && (
        <form
          className="mt-2 space-y-2 rounded-lg border border-red-200 bg-red-50 p-3"
          onSubmit={event => {
            event.preventDefault();
            void move(asking, { reason, dueOn: asking === 'remake' ? newDue : undefined });
          }}
        >
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-red-900">
              {asking === 'remake' ? `What is wrong? The work goes back to the lab, and the reason stays with order ${order.orderNo}.` : `Why is order ${order.orderNo} cancelled? It stays in the history.`}
            </span>
            <input
              className={inputClass}
              value={reason}
              maxLength={REASON_MAX}
              onChange={event => setReason(event.target.value)}
              placeholder={asking === 'remake' ? 'For example: margin open on the distal' : 'For example: the patient chose another option'}
            />
          </label>
          {asking === 'remake' && (
            <label className="block max-w-xs">
              <span className="mb-1 block text-xs font-medium text-red-900">The lab&apos;s new date (optional)</span>
              <input type="date" className={inputClass} value={newDue} min={today} onChange={event => setNewDue(event.target.value)} />
            </label>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={secondaryButton} onClick={() => setAsking(null)} disabled={busy !== null}>
              Keep it
            </button>
            <button type="submit" className={primaryButton} disabled={busy !== null || reason.trim().length < 3}>
              {DENTAL_LAB_STATUS_ACTIONS[asking]}
            </button>
          </div>
        </form>
      )}

      {showSteps && (
        <ol className="mt-2 space-y-1 border-l-2 border-gray-100 pl-3 text-xs text-gray-600">
          {order.events.map(event => (
            <li key={`${event.changedAt}-${event.status}`}>
              <span className="font-medium text-gray-800">{DENTAL_LAB_STATUS_LABELS[event.status]}</span> · {formatServiceDate(event.on)}
              {event.changedBy ? ` · ${event.changedBy}` : ''}
              {event.reason ? ` · ${event.reason}` : ''}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
};

export default DentalLabOrderCard;
