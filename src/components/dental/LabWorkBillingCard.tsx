import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import type { ServiceSelection } from '../../types/billing';
import { useAuthStore } from '../../stores/authStore';
import { billLabOrder, isDentalLabNotSetUp, loadPatientLabOrders } from '../../services/dental/labOrderService';
import { formatNad, fromCents, toCents } from '../../utils/billing/money';
import { isDentalPractice } from '../../utils/billing/tariffRules';
import { describeLabWork } from '../../utils/dental/labOrders';
import type { DentalLabOrder } from '../../utils/dental/labOrderRecords';
import { LAB_FEE_CODE, labSlipTotalCents, matchLabSlips } from '../../utils/dental/labSlips';
import { buildTariffLine, changeLineFee, type VisitTariff } from '../visits/visitBillingLines';
import LabSlipSheet from './LabSlipSheet';

export interface LabWorkBillingCardProps {
  practiceId: string | null;
  /** practices.practice_type: the card is for dental practices only (isDentalPractice) */
  practiceType: string | null;
  patientId: string;
  visitId: string;
  /** The codes that may be billed on the visit date (the Billing tab's list): 8099 among them */
  tariffs: readonly VisitTariff[];
  /** The visit's lines */
  lines: readonly ServiceSelection[];
  hasMedicalAid: boolean;
  /** A line's fee can be set: billing rights, the database keeps changed fees and the invoice is not locked */
  feeEditable: boolean;
  /** Why lines cannot be added yet (the patient's fund prices are loading or unclear) */
  disabledReason: string | null;
  onApply: (lines: ServiceSelection[]) => void;
}

const smallButton =
  'inline-flex items-center gap-1 rounded border border-cyan-600 bg-white px-2 py-1 text-xs font-medium text-cyan-700 hover:bg-cyan-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 disabled:cursor-not-allowed disabled:opacity-50';
const linkButton = 'font-medium text-cyan-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded disabled:opacity-50';

const nad = (cents: number) => formatNad(fromCents(cents));
const orderLabel = (order: DentalLabOrder) => `order ${order.orderNo} (${describeLabWork(order).toLowerCase()}${order.labName ? `, ${order.labName}` : ''})`;

/**
 * The visit's lab work on its Billing tab (parity D28), dental practices only: the lab's invoice is billed as one 8099
 * line at its total, and the medical aid gets the invoice's lines with it. Here an order back from the lab is billed in
 * one tap (the 8099 line priced at the invoice's total, its reason recorded), each 8099 line says whether a lab invoice
 * adds up to it, and an invoice still to be typed opens here. Shown only when the visit has an 8099 line or the patient
 * has lab work to bill.
 */
const LabWorkBillingCard: React.FC<LabWorkBillingCardProps> = props => {
  const { practiceId, practiceType, patientId, visitId, tariffs, lines, hasMedicalAid, feeEditable, disabledReason, onApply } = props;
  const id = useId();
  const dental = isDentalPractice(practiceType);
  const userId = useAuthStore(state => state.user?.id ?? null);
  const [orders, setOrders] = useState<DentalLabOrder[] | null>(null);
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<boolean | null>(null);
  const [slipFor, setSlipFor] = useState<DentalLabOrder | null>(null);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    if (!dental || !practiceId || !patientId) return;
    let cancelled = false;
    loadPatientLabOrders(patientId)
      .then(result => {
        // Before the lab update there is nothing to bill or check here
        if (!cancelled) setOrders(result.status === 'ready' ? result.orders : null);
      })
      .catch(() => {
        // Unread orders say nothing reliable about the 8099 lines: claim review checks them again before sending
        if (!cancelled) setOrders(null);
      });
    return () => {
      cancelled = true;
    };
  }, [dental, practiceId, patientId, version]);

  const feeLines = useMemo(() => lines.filter(line => line.code.trim() === LAB_FEE_CODE), [lines]);
  const view = useMemo(() => {
    const live = (orders ?? []).filter(order => order.status !== 'cancelled');
    const billedHere = live.filter(order => order.billedVisitId === visitId);
    const match = matchLabSlips(
      feeLines.map(line => ({ key: line.id, cents: toCents(line.totalPrice) })),
      billedHere.map(order => ({ ...order, lines: order.slipLines }))
    );
    return {
      match,
      toBill: live.filter(order => order.billedVisitId === null && order.slipLines.length > 0),
      awaitingInvoice: live.filter(order => order.billedVisitId === null && order.slipLines.length === 0 && (order.status === 'received' || order.status === 'fitted'))
    };
  }, [orders, feeLines, visitId]);

  if (!dental || orders === null) return null;
  const { match, toBill, awaitingInvoice } = view;
  if (feeLines.length === 0 && match.unpairedOrders.length === 0 && toBill.length === 0 && awaitingInvoice.length === 0) return null;

  const tariff = tariffs.find(item => item.code.trim() === LAB_FEE_CODE) ?? null;
  // An order billed here that no 8099 line carries; one with an invoice is named on an 8099 line left without one
  const ordersWithoutLine = match.unpairedOrders.filter(order => match.unpairedLines.length === 0 || order.slipLines.length === 0);
  const problems = match.unpairedLines.length + ordersWithoutLine.length;
  const summary =
    problems > 0
      ? `${problems} to put right before the claim can go`
      : match.paired.size > 0
        ? `${match.paired.size} lab invoice${match.paired.size === 1 ? '' : 's'} billed under ${LAB_FEE_CODE} on this visit`
        : `${toBill.length + awaitingInvoice.length} back from the lab, to bill`;
  const expanded = open ?? true;
  const canBill = feeEditable && !disabledReason && tariff !== null && Boolean(userId);
  const whyNot = disabledReason
    ? disabledReason
    : tariff === null
      ? `Code ${LAB_FEE_CODE} (dental technician fees, at cost) is not in the practice's tariff list: an administrator adds it under Admin, Tariffs, Practice tariff.`
      : !feeEditable
        ? 'Billing lab work needs billing rights and an invoice that is not locked.'
        : null;

  /** The visit's lines with an 8099 line (or `lineId`'s) priced at the order's invoice total, the reason recorded. */
  const priced = (order: DentalLabOrder, lineId: string | null): ServiceSelection[] | string => {
    if (!tariff || !userId) return whyNot ?? 'This line cannot be billed.';
    const totalCents = labSlipTotalCents(order.slipLines);
    let next = [...lines];
    let target = lineId;
    if (!target) {
      const built = buildTariffLine(tariff, 1, '', hasMedicalAid);
      if (!built.ok) return built.message;
      const note = `Lab work: ${describeLabWork(order)}${order.labName ? `, ${order.labName}` : ''}${order.slipNumber ? `, invoice ${order.slipNumber}` : ''}`.slice(0, 200);
      next = [...next, { ...built.service, notes: note }];
      target = built.service.id;
    }
    const current = next.find(line => line.id === target);
    // One 8099 line carries one lab invoice: its amount is the invoice's total
    if (current && current.quantity !== 1) return `Set the ${LAB_FEE_CODE} line to quantity 1 first: it carries the lab's whole invoice.`;
    if (current && toCents(current.unitPrice) === totalCents) return next;
    const reason = `The lab's invoice${order.slipNumber ? ` ${order.slipNumber}` : ''} for lab order ${order.orderNo}`;
    const result = changeLineFee(next, target, { unitPrice: fromCents(totalCents), reason, by: userId, at: new Date().toISOString() }, tariffs, hasMedicalAid);
    return result.error ?? result.services;
  };

  const bill = async (order: DentalLabOrder) => {
    const next = priced(order, null);
    if (typeof next === 'string') {
      toast.error(next, { duration: 8000 });
      return;
    }
    setBusy(order.id);
    try {
      await billLabOrder(order.id, visitId);
      onApply(next);
      toast.success(`Lab order ${order.orderNo} billed under ${LAB_FEE_CODE}: ${nad(labSlipTotalCents(order.slipLines))}. Save the visit to keep it.`);
      reload();
    } catch (failure) {
      toast.error(isDentalLabNotSetUp(failure) ? 'Lab work is not set up yet.' : failure instanceof Error ? failure.message : 'Could not bill the lab work.');
    } finally {
      setBusy(null);
    }
  };

  const applyTotal = (order: DentalLabOrder, lineId: string) => {
    const next = priced(order, lineId);
    if (typeof next === 'string') toast.error(next, { duration: 8000 });
    else onApply(next);
  };

  const unbill = async (order: DentalLabOrder) => {
    setBusy(order.id);
    try {
      await billLabOrder(order.id, null);
      reload();
    } catch (failure) {
      toast.error(failure instanceof Error ? failure.message : 'Could not change where the order is billed.');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen(!expanded)}
        aria-expanded={expanded}
        aria-controls={`${id}-body`}
        className="flex w-full items-start gap-3 p-4 text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <Icon icon="solar:box-bold-duotone" className="mt-0.5 h-5 w-5 flex-shrink-0 text-cyan-700" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-gray-900">Lab work</span>
          <span className={`block text-xs break-words ${problems > 0 ? 'text-amber-800' : 'text-gray-600'}`}>{summary}</span>
        </span>
        <Icon icon={expanded ? 'solar:alt-arrow-up-bold-duotone' : 'solar:alt-arrow-down-bold-duotone'} className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
      </button>

      {expanded && (
        <div id={`${id}-body`} className="space-y-2 border-t border-gray-100 p-4 text-xs text-gray-600">
          <ul className="space-y-2">
            {feeLines.map(line => {
              const order = match.paired.get(line.id);
              const other = match.unpairedOrders.find(item => item.slipLines.length > 0);
              return (
                <li key={line.id} className="flex items-start gap-1">
                  <Icon
                    icon={order ? 'solar:check-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
                    className={`mt-px h-3.5 w-3.5 flex-shrink-0 ${order ? 'text-green-600' : 'text-amber-700'}`}
                    aria-hidden="true"
                  />
                  <span className={order ? '' : 'text-amber-800'}>
                    {LAB_FEE_CODE}, {nad(toCents(line.totalPrice))}:{' '}
                    {order
                      ? `carries the lab's invoice of ${orderLabel(order)}: ${order.slipLines.length} line${order.slipLines.length === 1 ? '' : 's'} that add up.`
                      : other
                        ? `the lab's invoice of ${orderLabel(other)} adds up to ${nad(labSlipTotalCents(other.slipLines))}. The medical aid refuses ${LAB_FEE_CODE} unless they are equal.`
                        : `no lab order billed at this visit carries the lab's lines. The medical aid refuses ${LAB_FEE_CODE} without them: bill the order below, or take this line off.`}{' '}
                    {!order && other && canBill && (
                      <button type="button" className={linkButton} onClick={() => applyTotal(other, line.id)}>
                        Use {nad(labSlipTotalCents(other.slipLines))}
                      </button>
                    )}
                  </span>
                </li>
              );
            })}
            {ordersWithoutLine.map(order => (
              <li key={order.id} className="flex items-start gap-1">
                <Icon icon="solar:danger-triangle-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0 text-amber-700" aria-hidden="true" />
                <span className="text-amber-800">
                  {order.slipLines.length === 0
                    ? `${orderLabel(order).replace(/^order/, 'Order')} is billed at this visit, but the lab's invoice is not typed in yet. `
                    : `${orderLabel(order).replace(/^order/, 'Order')} is billed at this visit (${nad(labSlipTotalCents(order.slipLines))}), but no ${LAB_FEE_CODE} line carries it. `}
                  {order.slipLines.length === 0 ? (
                    <button type="button" className={linkButton} onClick={() => setSlipFor(order)}>
                      The lab&apos;s invoice
                    </button>
                  ) : (
                    canBill && (
                      <button type="button" className={linkButton} disabled={busy !== null} onClick={() => void bill(order)}>
                        Bill it under {LAB_FEE_CODE}
                      </button>
                    )
                  )}{' '}
                  <button type="button" className={linkButton} disabled={busy !== null} onClick={() => void unbill(order)}>
                    Not billed here
                  </button>
                </span>
              </li>
            ))}
            {toBill.map(order => (
              <li key={order.id} className="flex items-start gap-1">
                <Icon icon="solar:box-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0 text-cyan-700" aria-hidden="true" />
                <span>
                  {orderLabel(order).replace(/^order/, 'Order')}: the lab&apos;s invoice{order.slipNumber ? ` ${order.slipNumber}` : ''}, {nad(labSlipTotalCents(order.slipLines))}{' '}
                  <button type="button" className={`${smallButton} mt-1`} disabled={!canBill || busy !== null} onClick={() => void bill(order)}>
                    {busy === order.id && <Icon icon="solar:refresh-bold-duotone" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                    Bill under {LAB_FEE_CODE} at this visit
                  </button>
                </span>
              </li>
            ))}
            {awaitingInvoice.map(order => (
              <li key={order.id} className="flex items-start gap-1">
                <Icon icon="solar:box-bold-duotone" className="mt-px h-3.5 w-3.5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                <span>
                  {orderLabel(order).replace(/^order/, 'Order')} is back from the lab: type in the lab&apos;s invoice to bill it.{' '}
                  <button type="button" className={linkButton} onClick={() => setSlipFor(order)}>
                    The lab&apos;s invoice
                  </button>
                </span>
              </li>
            ))}
          </ul>
          {whyNot && (toBill.length > 0 || match.unpairedLines.length > 0) && <p className="text-gray-500">{whyNot}</p>}
          {!hasMedicalAid && feeLines.length > 0 && <p className="text-gray-500">This patient pays privately: the lab&apos;s lines show on the slip, not on a claim.</p>}
        </div>
      )}
      <LabSlipSheet order={slipFor} onClose={() => setSlipFor(null)} onSaved={reload} />
    </div>
  );
};

export default LabWorkBillingCard;
