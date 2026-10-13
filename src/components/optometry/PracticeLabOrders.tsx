import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { SECONDARY } from '../stock/stockUi';
import { patientEyesLink } from '../billing/invoiceLinks';
import { loadPracticeLabOrders, loadSlipHeading, type PracticeLabOrder, type SlipHeading } from '../../services/optometry/optometryService';
import { EyesNotSetUp } from './optometryParts';
import LabOrderCard from './LabOrderCard';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; orders: PracticeLabOrder[] };

/**
 * Every open lab order of the practice, longest waiting first: the front desk sees what is at the lab, what came back
 * and what waits for the patient, moves orders on, prints slips and opens the patient's file.
 */
const PracticeLabOrders: React.FC<{ practiceId: string; today: string }> = ({ practiceId, today }) => {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [heading, setHeading] = useState<SlipHeading | null>(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);

  useEffect(() => {
    let cancelled = false;
    loadSlipHeading(practiceId).then(found => !cancelled && setHeading(found), () => undefined);
    loadPracticeLabOrders(practiceId, { openOnly: true })
      .then(result => {
        if (cancelled) return;
        if (result.status === 'not_set_up') return setLoad({ status: 'not_set_up' });
        const orders = [...result.orders].sort((a, b) => a.statusOn.localeCompare(b.statusOn) || a.orderNo - b.orderNo);
        setLoad({ status: 'ready', orders });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not read the lab orders.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  if (load.status === 'loading') return <p className="py-6 text-center text-sm text-gray-500" role="status">Loading the lab orders...</p>;
  if (load.status === 'not_set_up') return <EyesNotSetUp compact />;
  if (load.status === 'error') {
    return (
      <div className="space-y-2 py-4 text-center" role="alert">
        <p className="text-sm text-red-700">{load.message}</p>
        <button type="button" className={SECONDARY} onClick={reload}>Try again</button>
      </div>
    );
  }
  if (load.orders.length === 0) return <p className="py-6 text-center text-sm text-gray-500">No lab order is open.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">{load.orders.length} open, longest waiting first.</p>
      {load.orders.map(order => (
        <LabOrderCard
          key={order.id}
          order={order}
          today={today}
          heading={heading}
          patient={{ name: order.patientName, dateOfBirth: order.patientDateOfBirth ?? null }}
          prescription={order.prescription}
          onChanged={reload}
          patientLink={patientEyesLink(order.patientId)}
        />
      ))}
    </div>
  );
};

export default PracticeLabOrders;
