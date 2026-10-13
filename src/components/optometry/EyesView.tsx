import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { useScreenAccess } from '../../hooks/useScreenAccess';
import { OPTOMETRY_FOLLOWS, screenGate } from '../../utils/auth/screenAccess';
import { Chip } from '../stock/stockParts';
import { PRIMARY, QUIET, SECONDARY } from '../stock/stockUi';
import { formatServiceDate, todayKey } from '../../utils/billing/dates';
import {
  loadEyeRecords,
  loadPatientBasics,
  loadSlipHeading,
  voidPrescription,
  type EyeRecords,
  type PatientBasics,
  type SlipHeading
} from '../../services/optometry/optometryService';
import { RX_KIND_LABELS, compareEye, eyeSummary, isExpired } from '../../utils/optometry/prescription';
import { isOpenLabOrder } from '../../utils/optometry/labOrders';
import { byNewest, currentPrescriptions, previousPrescription, type LabOrderRecord, type PrescriptionRecord } from '../../utils/optometry/records';
import { ChangeLine, EyesNotSetUp, Facts, RxTable, Section } from './optometryParts';
import { useOptometryPractice } from './useOptometryPractice';
import ContactLensSection from './ContactLensSection';
import ExamHistory from './ExamHistory';
import LabOrderCard from './LabOrderCard';
import LabOrderSheet from './LabOrderSheet';
import OpticalBenefitNote from './OpticalBenefitNote';
import OptometryPracticePanel from './OptometryPracticePanel';
import PrescriptionSheet from './PrescriptionSheet';
import ReasonSheet from './ReasonSheet';
import { prescriptionSlipHtml, printSlip } from './slips';

export interface EyesViewProps {
  practiceId: string | null | undefined;
  patientId: string;
  /** Opens one of the patient's visits (the patient file) */
  onOpenVisit?: (visitId: string) => void;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'not_set_up' }
  | ({ status: 'ready'; patient: PatientBasics; heading: SlipHeading } & EyeRecords);

/** Practitioners, nurses and practice admins record and correct prescriptions (the database checks the same roles). */
const CLINICAL_ROLES = new Set(['doctor', 'nurse', 'admin']);

/**
 * Patient file > Eyes (optometry practices): the current spectacle prescription with what changed since the last
 * one, the printed prescription, lab orders and their steps, contact lenses and when they run out, and the eye
 * exams (recorded in the visits).
 */
const EyesView: React.FC<EyesViewProps> = ({ practiceId, patientId, onOpenVisit }) => {
  const isOptometry = useOptometryPractice(practiceId);
  const role = useAuthStore(state => state.user?.role ?? null);
  const clinical = role !== null && CLINICAL_ROLES.has(role);
  // The practice view is the same lens orders, frames and reports Stock shows: it follows Stock's access
  const user = useAuthStore(state => state.user);
  const screenAccess = useScreenAccess();
  const opensOptometryPage = screenGate(user, OPTOMETRY_FOLLOWS, screenAccess) === 'open';
  const today = todayKey();
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion(value => value + 1), []);
  const [rxSheet, setRxSheet] = useState<{ open: boolean; replaces: PrescriptionRecord | null }>({ open: false, replaces: null });
  const [voiding, setVoiding] = useState<PrescriptionRecord | null>(null);
  const [orderSheet, setOrderSheet] = useState<{ open: boolean; order: LabOrderRecord | null }>({ open: false, order: null });
  const [showHistory, setShowHistory] = useState(false);
  const [showMistakes, setShowMistakes] = useState(false);
  const [showEarlierOrders, setShowEarlierOrders] = useState(false);
  const [practiceOpen, setPracticeOpen] = useState(false);

  useEffect(() => {
    if (!practiceId || isOptometry !== true) return;
    let cancelled = false;
    setLoad(current => (current.status === 'ready' ? current : { status: 'loading' }));
    Promise.all([loadEyeRecords(patientId), loadPatientBasics(patientId), loadSlipHeading(practiceId)])
      .then(([records, patient, heading]) => {
        if (cancelled) return;
        setLoad(records.status === 'not_set_up' ? { status: 'not_set_up' } : { ...records, patient, heading });
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoad({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not load the eye records.' });
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId, isOptometry, version]);

  if (isOptometry === false || !practiceId) {
    return <p className="py-8 text-center text-sm text-gray-500">Eye records are for optometry practices.</p>;
  }
  if (isOptometry === null || load.status === 'loading') {
    return (
      <div className="space-y-3" role="status" aria-live="polite">
        <div className="h-40 animate-pulse rounded-xl bg-gray-100 motion-reduce:animate-none" />
        <span className="sr-only">Loading the eye records</span>
      </div>
    );
  }
  if (load.status === 'not_set_up') return <EyesNotSetUp />;
  if (load.status === 'error') {
    return (
      <div className="space-y-3 py-6 text-center" role="alert">
        <p className="text-sm text-red-700">{load.message}</p>
        <button type="button" className={SECONDARY} onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const spectacles = currentPrescriptions(load.prescriptions, 'spectacles');
  const latest = spectacles[0] ?? null;
  const previous = latest ? previousPrescription(load.prescriptions, latest) : null;
  const mistakes = load.prescriptions.filter(rx => rx.voidedAt);
  const history = [...load.prescriptions].filter(rx => showMistakes || !rx.voidedAt).sort(byNewest);
  const openOrders = load.orders.filter(order => isOpenLabOrder(order.status));
  const earlierOrders = load.orders.filter(order => !isOpenLabOrder(order.status));
  const slipPatient = { name: load.patient.name, dateOfBirth: load.patient.dateOfBirth };

  const print = (rx: PrescriptionRecord) => {
    if (!printSlip(prescriptionSlipHtml(load.heading, slipPatient, rx))) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };
  const rxOf = (order: LabOrderRecord) => load.prescriptions.find(rx => rx.id === order.prescriptionId) ?? null;
  const card = (order: LabOrderRecord) => (
    <LabOrderCard
      key={order.id}
      order={order}
      today={today}
      heading={load.heading}
      patient={slipPatient}
      prescription={rxOf(order)}
      onChanged={reload}
      onEdit={() => setOrderSheet({ open: true, order })}
    />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-gray-900">Eyes</h3>
          <p className="text-xs text-gray-500">Prescriptions, lab orders, contact lenses and eye exams. Exams are recorded in the visit.</p>
        </div>
        {opensOptometryPage && (
          <button type="button" className={QUIET} aria-expanded={practiceOpen} onClick={() => setPracticeOpen(value => !value)}>
            <Icon icon="solar:glasses-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {practiceOpen ? 'Hide the practice view' : 'All lab orders, frames and the report'}
          </button>
        )}
      </div>

      {practiceOpen && opensOptometryPage && <OptometryPracticePanel practiceId={practiceId} />}

      <OpticalBenefitNote practiceId={practiceId} patientId={patientId} />

      <Section
        title="Spectacle prescription"
        icon="solar:glasses-bold-duotone"
        subtitle={latest ? `${formatServiceDate(latest.prescribedOn)}${latest.recordedBy ? ` · ${latest.recordedBy}` : ''}` : undefined}
        action={
          latest ? (
            <>
              <button type="button" className={SECONDARY} onClick={() => print(latest)}>
                <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                Print for the patient
              </button>
              <button type="button" className={PRIMARY} onClick={() => setOrderSheet({ open: true, order: null })}>
                Order spectacles
              </button>
            </>
          ) : undefined
        }
      >
        {latest ? (
          <div className="space-y-2">
            <RxTable rx={latest} kind="spectacles" caption="Current spectacle prescription" />
            <div className="flex flex-wrap items-center gap-2">
              <Facts items={[['Valid until', latest.validUntil ? formatServiceDate(latest.validUntil) : 'No end date'], ['From', latest.outsideSource], ['Notes', latest.notes]]} />
              {isExpired(latest.validUntil, today) && <Chip tone="amber">Expired: time for an eye test</Chip>}
            </div>
            {previous && <ChangeLine since={formatServiceDate(previous.prescribedOn)} change={{ right: compareEye(previous.right, latest.right), left: compareEye(previous.left, latest.left) }} />}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No spectacle prescription yet. Record the refraction in the visit&apos;s Eye exam section{clinical ? ', or add one the patient brought' : ''}.</p>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {load.prescriptions.length > 0 && (
            <button type="button" className={QUIET} aria-expanded={showHistory} onClick={() => setShowHistory(value => !value)}>
              <Icon icon="solar:history-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {showHistory ? 'Hide all prescriptions' : `All prescriptions (${load.prescriptions.length - mistakes.length})`}
            </button>
          )}
          {clinical && (
            <button type="button" className={QUIET} onClick={() => setRxSheet({ open: true, replaces: null })}>
              <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Add a prescription
            </button>
          )}
        </div>
        {showHistory && (
          <div className="mt-2 space-y-2">
            <ul className="divide-y divide-gray-100">
              {history.map(rx => {
                const before = rx.voidedAt ? null : previousPrescription(load.prescriptions, rx);
                return (
                  <li key={rx.id} className="space-y-1 py-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className={`font-semibold ${rx.voidedAt ? 'text-gray-400 line-through' : 'text-gray-900'}`}>{formatServiceDate(rx.prescribedOn)}</span>
                      <Chip tone={rx.kind === 'spectacles' ? 'cyan' : 'violet'}>{RX_KIND_LABELS[rx.kind]}</Chip>
                      {rx.voidedAt && <Chip tone="red">Entered in error: {rx.voidReason}</Chip>}
                      {rx.outsideSource && <span className="text-xs text-gray-500">from {rx.outsideSource}</span>}
                      {rx.recordedBy && <span className="text-xs text-gray-500">{rx.recordedBy}</span>}
                    </div>
                    <p className={`text-sm ${rx.voidedAt ? 'text-gray-400' : 'text-gray-700'}`}>R {eyeSummary(rx.right)} · L {eyeSummary(rx.left)}</p>
                    {before && <ChangeLine since={formatServiceDate(before.prescribedOn)} change={{ right: compareEye(before.right, rx.right), left: compareEye(before.left, rx.left) }} />}
                    {!rx.voidedAt && (
                      <div className="flex flex-wrap gap-2">
                        <button type="button" className={QUIET} onClick={() => print(rx)}>Print</button>
                        {clinical && <button type="button" className={QUIET} onClick={() => setRxSheet({ open: true, replaces: rx })}>Correct</button>}
                        {clinical && <button type="button" className={QUIET} onClick={() => setVoiding(rx)}>Entered in error</button>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {mistakes.length > 0 && (
              <button type="button" className={QUIET} aria-pressed={showMistakes} onClick={() => setShowMistakes(value => !value)}>
                {showMistakes ? 'Hide entries made in error' : `Show entries made in error (${mistakes.length})`}
              </button>
            )}
          </div>
        )}
      </Section>

      <Section
        title="Lab orders"
        icon="solar:delivery-bold-duotone"
        subtitle={openOrders.length > 0 ? `${openOrders.length} open` : 'None open'}
        action={
          // "Order spectacles" (above) is the first order; a second pair is ordered here
          spectacles.length > 0 && openOrders.length > 0 ? (
            <button type="button" className={SECONDARY} onClick={() => setOrderSheet({ open: true, order: null })}>
              Another order
            </button>
          ) : undefined
        }
      >
        {openOrders.length === 0 ? (
          <p className="text-sm text-gray-500">{spectacles.length > 0 ? 'No order at the lab. Use "Order spectacles" above.' : 'Orders need a spectacle prescription first.'}</p>
        ) : (
          <div className="space-y-2">{openOrders.map(card)}</div>
        )}
        {earlierOrders.length > 0 && (
          <>
            <button type="button" className={`${QUIET} mt-2`} aria-expanded={showEarlierOrders} onClick={() => setShowEarlierOrders(value => !value)}>
              <Icon icon="solar:history-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {showEarlierOrders ? 'Hide earlier orders' : `Earlier orders (${earlierOrders.length})`}
            </button>
            {showEarlierOrders && <div className="mt-2 space-y-2">{earlierOrders.map(card)}</div>}
          </>
        )}
      </Section>

      <ContactLensSection practiceId={practiceId} patientId={patientId} prescriptions={load.prescriptions} supplies={load.supplies} today={today} onChanged={reload} />

      <ExamHistory exams={load.exams} prescriptions={load.prescriptions} onOpenVisit={onOpenVisit} />

      <PrescriptionSheet open={rxSheet.open} onClose={() => setRxSheet({ open: false, replaces: null })} patientId={patientId} replaces={rxSheet.replaces} onSaved={reload} />
      <LabOrderSheet
        open={orderSheet.open}
        onClose={() => setOrderSheet({ open: false, order: null })}
        practiceId={practiceId}
        patientId={patientId}
        prescriptions={spectacles}
        order={orderSheet.order}
        onSaved={reload}
      />
      <ReasonSheet
        open={voiding !== null}
        title="Entered in error"
        description="The prescription stays in the history, crossed out, with the reason. It is no longer printed, ordered or claimed."
        label="What was wrong"
        placeholder="E.g. typed for the wrong patient"
        confirmLabel="Mark as entered in error"
        danger
        onClose={() => setVoiding(null)}
        onConfirm={async reason => {
          if (!voiding) return;
          await voidPrescription(voiding.id, reason);
          toast.success('Prescription marked as entered in error.');
          reload();
        }}
      />
    </div>
  );
};

export default EyesView;
