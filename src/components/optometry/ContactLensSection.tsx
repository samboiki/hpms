import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { PRIMARY, QUIET, SECONDARY, DANGER, errorText } from '../stock/stockUi';
import { daysBetweenKeys, formatServiceDate } from '../../utils/billing/dates';
import { setSupplyStatus } from '../../services/optometry/optometryService';
import { REPLACEMENT_LABELS, runOutState, type RunOutState } from '../../utils/optometry/contactLenses';
import { currentPrescriptions, type PrescriptionRecord, type SupplyRecord } from '../../utils/optometry/records';
import { Facts, RxTable, Section, SupplyStatusChip } from './optometryParts';
import ContactLensSheet, { CollectSupplySheet } from './ContactLensSheet';
import ReasonSheet from './ReasonSheet';

interface ContactLensSectionProps {
  practiceId: string;
  patientId: string;
  prescriptions: readonly PrescriptionRecord[];
  supplies: readonly SupplyRecord[];
  today: string;
  onChanged: () => void;
}

const RUN_OUT_TONE: Readonly<Record<RunOutState, string>> = {
  ok: 'text-gray-700',
  soon: 'text-amber-800',
  out: 'text-red-700'
};

const runOutText = (runsOutOn: string, today: string): string => {
  const days = daysBetweenKeys(today, runsOutOn);
  if (days < 0) return `Ran out on ${formatServiceDate(runsOutOn)} (${-days} day${days === -1 ? '' : 's'} ago)`;
  if (days === 0) return 'Runs out today';
  return `Runs out on ${formatServiceDate(runsOutOn)} (in ${days} day${days === 1 ? '' : 's'})`;
};

/**
 * Patient file > Eyes > Contact lenses: the latest contact-lens prescription, when the lenses the patient has run
 * out, supplies on order (arrived, collected, cancelled) and the supply history.
 */
const ContactLensSection: React.FC<ContactLensSectionProps> = ({ practiceId, patientId, prescriptions, supplies, today, onChanged }) => {
  const [recording, setRecording] = useState(false);
  const [collecting, setCollecting] = useState<SupplyRecord | null>(null);
  const [cancelling, setCancelling] = useState<SupplyRecord | null>(null);
  const [showAll, setShowAll] = useState(false);
  const clPrescriptions = currentPrescriptions(prescriptions, 'contact_lenses');
  const latestRx = clPrescriptions[0] ?? null;
  const withPatient = supplies.filter(supply => supply.status === 'collected' && supply.runsOutOn);
  // The patient has lenses until the latest run-out day (the "running out" list uses the same day)
  const runsOutOn = withPatient.reduce<string | null>((latest, supply) => (supply.runsOutOn && (!latest || supply.runsOutOn > latest) ? supply.runsOutOn : latest), null);
  const state = runOutState(runsOutOn, today);
  const open = supplies.filter(supply => supply.status === 'ordered' || supply.status === 'received');

  const arrived = async (supply: SupplyRecord) => {
    try {
      await setSupplyStatus(supply.id, 'received');
      toast.success('Marked as arrived.');
      onChanged();
    } catch (failure) {
      toast.error(errorText(failure));
    }
  };

  if (!latestRx && supplies.length === 0) {
    return (
      <Section title="Contact lenses" icon="solar:eye-scan-bold-duotone" action={<button type="button" className={SECONDARY} onClick={() => setRecording(true)}>Record contact lenses</button>}>
        <p className="text-sm text-gray-500">No contact lenses recorded. A contact-lens fit is recorded in the visit&apos;s eye exam.</p>
        <ContactLensSheet open={recording} onClose={() => setRecording(false)} practiceId={practiceId} patientId={patientId} prescriptions={clPrescriptions} onSaved={onChanged} />
      </Section>
    );
  }

  return (
    <Section
      title="Contact lenses"
      icon="solar:eye-scan-bold-duotone"
      subtitle={runsOutOn ? <span className={RUN_OUT_TONE[state ?? 'ok']}>{runOutText(runsOutOn, today)}</span> : undefined}
      action={
        <button type="button" className={PRIMARY} onClick={() => setRecording(true)}>
          <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          Record contact lenses
        </button>
      }
    >
      {latestRx && (
        <div className="mb-3 space-y-2">
          <RxTable rx={latestRx} kind="contact_lenses" caption="Latest contact-lens prescription" />
          <Facts
            items={[
              ['Prescribed', formatServiceDate(latestRx.prescribedOn)],
              ['Lenses', latestRx.lensName],
              ['Valid until', latestRx.validUntil ? formatServiceDate(latestRx.validUntil) : null],
              ['By', latestRx.recordedBy]
            ]}
          />
        </div>
      )}

      {open.length > 0 && (
        <ul className="mb-3 space-y-2">
          {open.map(supply => (
            <li key={supply.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 p-3 text-sm">
              <span className="font-medium text-gray-900">{supply.lensName}</span>
              <SupplyStatusChip status={supply.status} />
              <span className="text-xs text-gray-500">
                {REPLACEMENT_LABELS[supply.replacement]}, {supply.lensesPerEye} for each eye
                {supply.orderedOn ? ` · ordered ${formatServiceDate(supply.orderedOn)}` : ''}
                {supply.supplierName ? ` · ${supply.supplierName}` : ''}
              </span>
              <span className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
                {supply.status === 'ordered' && (
                  <button type="button" className={SECONDARY} onClick={() => void arrived(supply)}>
                    Arrived
                  </button>
                )}
                <button type="button" className={PRIMARY} onClick={() => setCollecting(supply)}>
                  Collected
                </button>
                <button type="button" className={DANGER} onClick={() => setCancelling(supply)}>
                  Cancel
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {supplies.length > 0 && (
        <button type="button" className={QUIET} aria-expanded={showAll} onClick={() => setShowAll(value => !value)}>
          <Icon icon="solar:history-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {showAll ? 'Hide supplies' : `All supplies (${supplies.length})`}
        </button>
      )}
      {showAll && (
        <ul className="mt-2 divide-y divide-gray-100 text-sm">
          {supplies.map(supply => (
            <li key={supply.id} className="flex flex-wrap items-center gap-2 py-2">
              <span className="font-medium text-gray-800">{supply.lensName}</span>
              <SupplyStatusChip status={supply.status} />
              <span className="text-xs text-gray-500">
                {REPLACEMENT_LABELS[supply.replacement]}, {supply.lensesPerEye} for each eye
                {supply.collectedOn ? ` · collected ${formatServiceDate(supply.collectedOn)}` : ''}
                {supply.runsOutOn ? ` · runs out ${formatServiceDate(supply.runsOutOn)}` : ''}
                {supply.cancelReason ? ` · ${supply.cancelReason}` : ''}
              </span>
            </li>
          ))}
        </ul>
      )}

      <ContactLensSheet open={recording} onClose={() => setRecording(false)} practiceId={practiceId} patientId={patientId} prescriptions={clPrescriptions} onSaved={onChanged} />
      <CollectSupplySheet supply={collecting} onClose={() => setCollecting(null)} onSaved={onChanged} />
      <ReasonSheet
        open={cancelling !== null}
        title="Cancel the contact lens order"
        description="It stays in the history, marked cancelled."
        label="Why it is cancelled"
        confirmLabel="Cancel the order"
        danger
        onClose={() => setCancelling(null)}
        onConfirm={async reason => {
          if (!cancelling) return;
          await setSupplyStatus(cancelling.id, 'cancelled', { reason });
          toast.success('Contact lens order cancelled.');
          onChanged();
        }}
      />
    </Section>
  );
};

export default ContactLensSection;
