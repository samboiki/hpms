import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { patientLabOrderLink, supplierLink } from '../billing/invoiceLinks';
import { secondaryButton } from '../quotes/QuoteBits';
import type { SlipHeading } from '../../services/optometry/optometryService';
import { loadPracticeOpenLabOrders, type PracticeLabOrder } from '../../services/dental/labOrderService';
import { formatServiceDate } from '../../utils/billing/dates';
import { describeLabWork, groupByLab, trackingCounts } from '../../utils/dental/labOrders';
import DentalLabOrderCard, { DentalLabStatusChip, DueNote } from './DentalLabOrderCard';
import LabSlipSheet from './LabSlipSheet';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; orders: PracticeLabOrder[] };

export interface LabWorkTrackingProps {
  practiceId: string;
  today: string;
  heading: SlipHeading | null;
  /** A change here also changes what the patient's own list shows */
  onChanged?: () => void;
}

/**
 * The practice's lab work (parity R36): everything out at a lab, back and waiting to be fitted, or being remade, by
 * lab, most urgent first (overdue, due back today, due soon). Each row opens its order (the next step, the lab's
 * invoice, the slip) and links to the patient's file with that order.
 */
const LabWorkTracking: React.FC<LabWorkTrackingProps> = ({ practiceId, today, heading, onChanged }) => {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [slipFor, setSlipFor] = useState<PracticeLabOrder | null>(null);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    loadPracticeOpenLabOrders(practiceId)
      .then(result => {
        if (!cancelled) setLoad(result.status === 'not_set_up' ? { status: 'not_set_up' } : { status: 'ready', orders: result.orders });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not read the lab work.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  const groups = useMemo(() => (load.status === 'ready' ? groupByLab(load.orders, today) : []), [load, today]);
  const changed = () => {
    reload();
    onChanged?.();
  };

  if (load.status === 'loading') return <p className="py-4 text-center text-sm text-gray-500" role="status">Loading the practice&apos;s lab work...</p>;
  if (load.status === 'not_set_up') return <p className="py-4 text-center text-sm text-gray-500">Lab work is not set up yet.</p>;
  if (load.status === 'error') {
    return (
      <div className="space-y-2 py-4 text-center" role="alert">
        <p className="text-sm text-red-700">{load.message}</p>
        <button type="button" className={secondaryButton} onClick={reload}>
          Try again
        </button>
      </div>
    );
  }
  if (load.orders.length === 0) return <p className="py-4 text-center text-sm text-gray-500">No lab work is out: nothing at a lab and nothing waiting to be fitted.</p>;

  const counts = trackingCounts(load.orders, today);
  const summary = [
    `${counts.atLab} at the lab`,
    counts.overdue > 0 ? `${counts.overdue} overdue` : '',
    counts.dueToday > 0 ? `${counts.dueToday} due back today` : '',
    counts.back > 0 ? `${counts.back} back, waiting to be fitted` : ''
  ].filter(Boolean);

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-700" aria-live="polite">
        {summary.join(' · ')}
      </p>
      {groups.map(group => (
        <section key={group.key || 'none'} className="rounded-xl border border-gray-200" aria-label={group.labName}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <Icon icon="solar:box-bold-duotone" className="h-4 w-4 text-cyan-600" aria-hidden="true" />
              <h4 className="text-sm font-semibold text-gray-900">
                {group.key ? (
                  <Link to={supplierLink(group.key)} className="hover:underline">
                    {group.labName}
                  </Link>
                ) : (
                  group.labName
                )}
              </h4>
            </div>
            <p className="text-xs text-gray-500">
              {group.counts.atLab} at the lab
              {group.counts.overdue > 0 && <span className="font-medium text-red-700"> · {group.counts.overdue} overdue</span>}
              {group.counts.back > 0 ? ` · ${group.counts.back} back` : ''}
            </p>
          </div>
          <ul className="divide-y divide-gray-100">
            {group.orders.map(order => {
              const expanded = openId === order.id;
              return (
                <li key={order.id} className="px-3 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <button
                      type="button"
                      aria-expanded={expanded}
                      onClick={() => setOpenId(expanded ? null : order.id)}
                      className="inline-flex min-w-0 items-center gap-1.5 rounded text-left text-sm font-medium text-gray-900 hover:text-cyan-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      <Icon icon={expanded ? 'solar:alt-arrow-up-bold-duotone' : 'solar:alt-arrow-down-bold-duotone'} className="h-4 w-4 flex-none text-gray-400" aria-hidden="true" />
                      Order {order.orderNo}
                    </button>
                    <Link to={patientLabOrderLink(order.patientId, order.id)} className="text-sm text-cyan-700 hover:underline">
                      {order.patientName}
                    </Link>
                    <DentalLabStatusChip status={order.status} />
                    <DueNote order={order} today={today} />
                  </div>
                  <p className="mt-0.5 text-xs text-gray-600">
                    {describeLabWork(order)} · sent {formatServiceDate(order.sentOn)}
                    {order.status === 'received' ? ` · back ${formatServiceDate(order.statusOn)}` : ''}
                  </p>
                  {expanded && (
                    <div className="mt-2">
                      <DentalLabOrderCard
                        order={order}
                        today={today}
                        heading={heading}
                        patient={{ name: order.patientName, dateOfBirth: order.patientDateOfBirth }}
                        navigation
                        onChanged={changed}
                        onEditSlip={() => setSlipFor(order)}
                        patientLink={patientLabOrderLink(order.patientId, order.id)}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <LabSlipSheet order={slipFor} onClose={() => setSlipFor(null)} onSaved={changed} />
    </div>
  );
};

export default LabWorkTracking;
