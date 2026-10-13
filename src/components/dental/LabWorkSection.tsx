import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { useSearchParams } from 'react-router-dom';
import { primaryButton, secondaryButton } from '../quotes/QuoteBits';
import { loadPatientBasics, loadSlipHeading, type SlipHeading } from '../../services/optometry/optometryService';
import { loadPatientLabOrders } from '../../services/dental/labOrderService';
import type { ChartModel } from '../../utils/dental/chart';
import { isAtLab, isOpenDentalLabOrder } from '../../utils/dental/labOrders';
import type { DentalLabOrder } from '../../utils/dental/labOrderRecords';
import type { SlipPatient } from '../optometry/slips';
import DentalLabOrderCard from './DentalLabOrderCard';
import DentalLabOrderSheet from './DentalLabOrderSheet';
import LabSlipSheet from './LabSlipSheet';
import LabWorkTracking from './LabWorkTracking';

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'not_set_up' } | { status: 'ready'; orders: DentalLabOrder[] };

export interface LabWorkSectionProps {
  practiceId: string;
  patientId: string;
  /** Opened from a visit: a new order is started at it, and links that leave the visit are text */
  visitId: string | null;
  navigation: boolean;
  today: string;
  /** A practitioner, nurse or practice admin: may order lab work and change an order */
  canChart: boolean;
  model: ChartModel;
  dateOfBirth: string | null;
  /** "Send to the lab" on a tooth: opens a new order with these teeth (a new nonce each time) */
  orderRequest: { teeth: string[]; nonce: number } | null;
}

/**
 * Patient file > Teeth > Lab work (parity N5): the patient's lab orders, open ones first, each with its next step,
 * the lab's invoice and the slip; earlier orders one tap away. "All lab work" shows the practice's lab tracking
 * (parity R36). Dental practices only (the Teeth view is).
 */
const LabWorkSection: React.FC<LabWorkSectionProps> = ({ practiceId, patientId, visitId, navigation, today, canChart, model, dateOfBirth, orderRequest }) => {
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  const [heading, setHeading] = useState<SlipHeading | null>(null);
  const [patient, setPatient] = useState<SlipPatient>({ name: 'Patient', dateOfBirth });
  const [sheet, setSheet] = useState<{ open: boolean; order: DentalLabOrder | null; teeth: string[] }>({ open: false, order: null, teeth: [] });
  const [slipFor, setSlipFor] = useState<DentalLabOrder | null>(null);
  const [showEarlier, setShowEarlier] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [focusId, setFocusId] = useState<string | null>(null);

  // A link to one order (from the practice's lab tracking) shows it first, highlighted; the link is used once, and only
  // by this patient's file: the file still on screen when another patient's order is clicked must leave it alone
  const linkedOrder = searchParams.get('labOrder');
  const linkedPatient = searchParams.get('patientId');
  useEffect(() => {
    if (!linkedOrder || (linkedPatient && linkedPatient !== patientId)) return;
    setFocusId(linkedOrder);
    const next = new URLSearchParams(searchParams);
    next.delete('labOrder');
    setSearchParams(next, { replace: true });
  }, [linkedOrder, linkedPatient, patientId, searchParams, setSearchParams]);

  useEffect(() => {
    let cancelled = false;
    setLoad(current => (current.status === 'ready' ? current : { status: 'loading' }));
    loadPatientLabOrders(patientId)
      .then(result => {
        if (!cancelled) setLoad(result.status === 'not_set_up' ? { status: 'not_set_up' } : { status: 'ready', orders: result.orders });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not read the lab orders.' });
      });
    return () => {
      cancelled = true;
    };
  }, [patientId, version]);

  useEffect(() => {
    let cancelled = false;
    loadSlipHeading(practiceId).then(found => !cancelled && setHeading(found), () => undefined);
    loadPatientBasics(patientId).then(found => !cancelled && setPatient(found), () => undefined);
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId]);

  // "Send to the lab" on a tooth
  useEffect(() => {
    if (orderRequest) setSheet({ open: true, order: null, teeth: orderRequest.teeth });
  }, [orderRequest]);

  const orders = load.status === 'ready' ? load.orders : [];
  const open = orders.filter(order => isOpenDentalLabOrder(order.status));
  const earlier = orders.filter(order => !isOpenDentalLabOrder(order.status));
  const atLab = open.filter(order => isAtLab(order.status)).length;
  // A linked order that is fitted or cancelled is among the earlier orders: they open
  const focusedEarlier = focusId !== null && earlier.some(order => order.id === focusId);
  useEffect(() => {
    if (focusedEarlier) setShowEarlier(true);
  }, [focusedEarlier]);
  const back = open.length - atLab;

  const card = (order: DentalLabOrder) => (
    <DentalLabOrderCard
      key={order.id}
      order={order}
      today={today}
      heading={heading}
      patient={patient}
      navigation={navigation}
      onChanged={reload}
      onEditSlip={() => setSlipFor(order)}
      onEdit={canChart ? () => setSheet({ open: true, order, teeth: order.teeth }) : undefined}
      highlighted={order.id === focusId}
    />
  );

  return (
    <section className="space-y-3" aria-labelledby="lab-work-title">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="lab-work-title" className="text-base font-semibold text-gray-900">
            Lab work
          </h3>
          <p className="text-xs text-gray-500">
            {load.status === 'ready'
              ? open.length === 0
                ? 'Nothing at the lab.'
                : [atLab > 0 ? `${atLab} at the lab` : '', back > 0 ? `${back} back from the lab, to be fitted` : ''].filter(Boolean).join(' · ')
              : 'Crowns, bridges, dentures and other work made by a lab.'}
          </p>
        </div>
        {load.status !== 'not_set_up' && (
          <div className="flex flex-wrap gap-2">
            {navigation && (
              <button type="button" className={secondaryButton} aria-expanded={practiceOpen} onClick={() => setPracticeOpen(value => !value)}>
                <Icon icon="solar:box-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {practiceOpen ? 'Hide the practice\'s lab work' : 'All lab work'}
              </button>
            )}
            {canChart && (
              <button type="button" className={primaryButton} onClick={() => setSheet({ open: true, order: null, teeth: [] })}>
                <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                New lab order
              </button>
            )}
          </div>
        )}
      </div>

      {practiceOpen && (
        <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
          <LabWorkTracking practiceId={practiceId} today={today} heading={heading} onChanged={reload} />
        </div>
      )}

      {load.status === 'loading' && (
        <div className="h-16 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none" role="status">
          <span className="sr-only">Loading the lab orders</span>
        </div>
      )}
      {load.status === 'not_set_up' && (
        <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900" role="status">
          <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
          <p>Lab work is not set up yet. Lab orders and the lab&apos;s invoices start working once your administrator applies the dental lab update.</p>
        </div>
      )}
      {load.status === 'error' && (
        <div className="space-y-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          <p>{load.message}</p>
          <button type="button" className={secondaryButton} onClick={reload}>
            Try again
          </button>
        </div>
      )}
      {load.status === 'ready' && orders.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 p-4 text-center">
          <p className="text-sm font-medium text-gray-800">No lab work</p>
          <p className="mt-1 text-xs text-gray-500">
            {canChart ? 'Tap a tooth and choose "Send to the lab", or use New lab order.' : 'A practitioner orders lab work from the tooth chart.'}
          </p>
        </div>
      )}
      {open.length > 0 && <div className="space-y-2">{open.map(card)}</div>}
      {earlier.length > 0 && (
        <>
          <button type="button" className={secondaryButton} aria-expanded={showEarlier} onClick={() => setShowEarlier(value => !value)}>
            <Icon icon="solar:history-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {showEarlier ? 'Hide earlier orders' : `Earlier orders (${earlier.length})`}
          </button>
          {showEarlier && <div className="space-y-2">{earlier.map(card)}</div>}
        </>
      )}

      {/* Mounted only while open: a closed dialog would release the page scroll of the visit's own dialog */}
      {sheet.open && (
        <DentalLabOrderSheet
          open
          onClose={() => setSheet(current => ({ ...current, open: false }))}
          practiceId={practiceId}
          patientId={patientId}
          visitId={visitId}
          order={sheet.order}
          initialTeeth={sheet.teeth}
          model={model}
          dateOfBirth={dateOfBirth}
          today={today}
          navigation={navigation}
          onSaved={reload}
        />
      )}
      <LabSlipSheet order={slipFor} onClose={() => setSlipFor(null)} onSaved={reload} />
    </section>
  );
};

export default LabWorkSection;
