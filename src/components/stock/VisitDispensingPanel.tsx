import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import {
  cancelDispensing,
  loadBilledStockByVisit,
  loadDispensings,
  loadPatientNames,
  loadPracticeHeading,
  loadStaffNames,
  loadStockItems,
  type PracticeHeading
} from '../../services/stock/stockService';
import type { ServiceSelection } from '../../types/billing';
import { todayKey } from '../../utils/billing/dates';
import { shorthandFromPrescription } from '../../utils/stock/dosage';
import type { StockItem } from '../../utils/stock/items';
import { dispensingBilling, type VisitBill } from '../../utils/stock/dispensingStatus';
import { dueText, summarizeScripts, type DispensingRecord } from '../../utils/stock/repeats';
import { canStock } from '../../utils/stock/stockRoles';
import type { ItemLevel, StockSettings } from '../../utils/stock/stockRows';
import { useAuthStore } from '../../stores/authStore';
import { stockItemLink } from '../billing/invoiceLinks';
import { DispenseSheet, type DispenseStart } from './DispenseSheet';
import { labelEntryFor, printLabels } from './dispensingLabels';
import { BillingChip } from './dispensingUi';
import { useStockSettings } from './useStockSettings';
import { Chip } from './stockParts';
import { CARD, LINK, QUIET, SECONDARY, STOCK_COLOR, day, errorText, units } from './stockUi';

/** A medicine on the visit's prescription (the Medications tab's list) */
export interface PrescribedMedicine {
  medication_name?: string | null;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
}

interface VisitDispensingPanelProps {
  practiceId: string | null | undefined;
  patientId: string;
  visitId: string;
  /** Who prescribes (the visit's practitioner); the person dispensing when unknown */
  prescriberId: string | null;
  prescribed: readonly PrescribedMedicine[];
  /** The visit's bill as it is on screen */
  billLines: readonly ServiceSelection[];
  hasMedicalAid: boolean;
  /** Why the bill cannot take lines now; null when it can */
  billingBlocked: string | null;
  onBill: (line: ServiceSelection) => void;
  /** The visit's allergy check */
  confirmMedicine: (medicine: string, proceed: () => void) => void;
}

interface Loaded {
  items: StockItem[];
  levels: Map<string, ItemLevel>;
  records: DispensingRecord[];
  bills: Map<string, VisitBill>;
  patientName: string;
  staffNames: Map<string, string>;
  heading: PracticeHeading;
}

const prescribedText = (medicine: PrescribedMedicine): string =>
  [medicine.medication_name, medicine.dosage, medicine.frequency, medicine.duration].map(part => (part ?? '').trim()).filter(Boolean).join(', ');

/**
 * Dispensing on the visit's Medications tab, for a practice that dispenses: the prescribed medicines and the
 * patient's repeats ready to dispense, and what this visit dispensed with its label and whether it is on the bill.
 * Renders nothing for a practice that does not dispense, or before the stock update is applied.
 */
export const VisitDispensingPanel: React.FC<VisitDispensingPanelProps> = props => {
  const { practiceId, patientId, visitId } = props;
  const setup = useStockSettings(practiceId);
  const role = useAuthStore(state => state.user?.role ?? null);
  const enabled = setup.status === 'ready' && setup.settings.dispensingEnabled;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [start, setStart] = useState<DispenseStart | null>(null);
  const today = todayKey();

  const load = useCallback(async () => {
    if (!practiceId || !enabled) return;
    setFailed(null);
    try {
      const [stock, records, bills, patientNames, staffNames, heading] = await Promise.all([
        loadStockItems(practiceId),
        loadDispensings({ practiceId, patientId }),
        loadBilledStockByVisit([visitId]),
        loadPatientNames([patientId]),
        loadStaffNames(practiceId),
        loadPracticeHeading(practiceId)
      ]);
      setLoaded({ ...stock, records, bills, patientName: patientNames.get(patientId) ?? 'Patient', staffNames, heading });
    } catch (error) {
      setFailed(errorText(error, 'Could not load dispensing'));
    }
  }, [practiceId, patientId, visitId, enabled]);

  useEffect(() => {
    void load();
  }, [load]);

  const visitRecords = useMemo(() => (loaded?.records ?? []).filter(record => record.visitId === visitId), [loaded, visitId]);
  const repeatsReady = useMemo(
    // Not the scripts started, or repeated, in this visit: they are in "Dispensed in this visit"
    () => summarizeScripts(loaded?.records ?? [], today).filter(script =>
      script.state === 'repeats_left' && script.first.visitId !== visitId && !script.repeats.some(repeat => repeat.visitId === visitId)),
    [loaded, today, visitId]
  );
  const onBillNow = useMemo(() => {
    const itemIds = new Set((loaded?.items ?? []).map(item => item.id));
    return new Set(props.billLines.map(line => line.tariffId).filter(id => itemIds.has(id)));
  }, [loaded, props.billLines]);

  if (setup.status !== 'ready' || !setup.settings.dispensingEnabled || !practiceId) return null;
  const settings: StockSettings = setup.settings;
  const canDispense = canStock(role, 'dispense');

  const itemOf = (id: string) => loaded?.items.find(item => item.id === id) ?? null;
  const findItem = (name: string): StockItem | null => {
    const needle = name.trim().toLowerCase();
    const matches = (loaded?.items ?? []).filter(item => item.isActive && item.name.toLowerCase() === needle);
    return matches.length === 1 ? matches[0] : null;
  };

  const dispensePrescribed = (medicine: PrescribedMedicine) => {
    const name = (medicine.medication_name ?? '').trim();
    setStart({
      prescribedAs: prescribedText(medicine) || null,
      query: name.split(/\s+/)[0] ?? '',
      directions: shorthandFromPrescription(medicine) ?? '',
      item: findItem(name),
      quantity: null,
      repeatOf: null
    });
  };

  const dispenseRepeat = (first: DispensingRecord) => {
    const item = itemOf(first.itemId);
    if (!item || !item.isActive) {
      toast.error('That item is no longer used: dispense the medicine from stock instead.');
      return;
    }
    setStart({ prescribedAs: first.prescribedAs, query: '', directions: first.directionsCode ?? first.directions, item, quantity: first.quantity, repeatOf: first });
  };

  const cancel = async (record: DispensingRecord) => {
    const reason = window.prompt(`Cancel ${record.number}? Say why (it is kept with the record).`);
    if (reason === null) return;
    if (reason.trim().length < 3) {
      toast.error('Say why it is cancelled.');
      return;
    }
    try {
      const result = await cancelDispensing(record.id, reason.trim());
      toast.success(
        result.billed
          ? `${record.number} cancelled. Remove its line from the visit's bill as well (or credit the invoice if it was saved).`
          : `${record.number} cancelled: ${result.stock_returned} back on stock.`,
        { duration: 7000 }
      );
      void load();
    } catch (error) {
      toast.error(errorText(error, 'Could not cancel.'));
    }
  };

  const print = (records: readonly DispensingRecord[]) => {
    if (!loaded) return;
    printLabels(loaded.heading, settings, records.map(record =>
      labelEntryFor(record, { all: loaded.records, items: loaded.items, patientName: loaded.patientName, staffNames: loaded.staffNames })));
  };

  const prescribed = props.prescribed.filter(medicine => (medicine.medication_name ?? '').trim());
  const activeVisitRecords = visitRecords.filter(record => !record.cancelledAt);

  return (
    <section className={`${CARD} p-4 sm:p-6`} aria-labelledby="visit-dispensing-title">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`rounded-lg p-2 shadow-md ${STOCK_COLOR.iconBox}`}>
            <Icon icon="solar:pill-bold-duotone" className="h-5 w-5 text-white" aria-hidden="true" />
          </span>
          <div>
            <h3 id="visit-dispensing-title" className="text-lg font-semibold text-gray-800">Dispensing</h3>
            <p className="text-sm text-gray-600">From the practice&apos;s stock, with a label, repeats and the line on the bill</p>
          </div>
        </div>
        {canDispense && loaded && (
          <button type="button" className={SECONDARY} onClick={() => setStart({ prescribedAs: null, query: '', directions: '', item: null, quantity: null, repeatOf: null })}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Dispense from stock
          </button>
        )}
      </div>

      {failed ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
          {failed}
          <button type="button" className={QUIET} onClick={() => void load()}>Try again</button>
        </p>
      ) : !loaded ? (
        <p className="text-sm text-gray-500" role="status">Loading dispensing…</p>
      ) : (
        <div className="space-y-5">
          {!canDispense && <p className="text-sm text-gray-500">Doctors, nurses and practice admins dispense; you can see what was dispensed.</p>}

          {prescribed.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Prescribed in this visit</h4>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {prescribed.map((medicine, index) => {
                  const text = prescribedText(medicine);
                  const done = activeVisitRecords.find(record => record.prescribedAs === text);
                  return (
                    <li key={`${text}-${index}`} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 text-gray-800">{text}</span>
                      {done ? (
                        <Chip tone="green" icon="solar:check-circle-bold-duotone">Dispensed {done.number}</Chip>
                      ) : canDispense ? (
                        <button type="button" className={QUIET} onClick={() => dispensePrescribed(medicine)} aria-label={`Dispense ${medicine.medication_name ?? 'this medicine'}`}>
                          <Icon icon="solar:pill-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Dispense
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {repeatsReady.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Repeats on the patient&apos;s scripts</h4>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {repeatsReady.map(script => {
                  const item = itemOf(script.first.itemId);
                  const due = dueText(script.nextDueOn, today, day);
                  return (
                    <li key={script.first.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">{item?.name ?? 'Medicine'}</span>
                        <span className="text-gray-500"> · {script.repeatsLeft} repeat{script.repeatsLeft === 1 ? '' : 's'} left · {script.first.number}</span>
                        {due && <span className={`block text-xs ${script.nextDueOn && script.nextDueOn <= today ? 'text-amber-700' : 'text-gray-500'}`}>{due}</span>}
                      </span>
                      {canDispense && (
                        <button type="button" className={QUIET} onClick={() => dispenseRepeat(script.first)} aria-label={`Dispense a repeat of ${item?.name ?? script.first.number}`}>
                          <Icon icon="solar:refresh-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Dispense repeat
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-700">Dispensed in this visit</h4>
              {activeVisitRecords.length > 1 && (
                <button type="button" className={QUIET} onClick={() => print(activeVisitRecords)}>
                  <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  Print all labels
                </button>
              )}
            </div>
            {visitRecords.length === 0 ? (
              <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-500">Nothing dispensed in this visit yet.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {visitRecords.map(record => {
                  const item = itemOf(record.itemId);
                  return (
                    <li key={record.id} className={`flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm ${record.cancelledAt ? 'opacity-60' : ''}`}>
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">
                          {item ? <Link to={stockItemLink(item.id)} className={LINK}>{item.name}</Link> : 'Medicine'}
                        </span>
                        <span className="text-gray-500"> · {units(record.quantity, item?.unit ?? 'units')} · {record.number}</span>
                        <span className="block text-xs text-gray-600">{record.directions}</span>
                        <span className="mt-1 block"><BillingChip billing={dispensingBilling(record, loaded.bills, onBillNow)} /></span>
                      </span>
                      {!record.cancelledAt && (
                        <span className="flex items-center gap-1">
                          <button type="button" className={QUIET} onClick={() => print([record])} aria-label={`Print the label for ${record.number}`}>
                            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                            Label
                          </button>
                          {canDispense && (
                            <button type="button" className={QUIET} onClick={() => void cancel(record)} aria-label={`Cancel ${record.number}`}>
                              <Icon icon="solar:close-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                              Cancel
                            </button>
                          )}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {start && loaded && (
        <DispenseSheet
          open
          onClose={() => setStart(null)}
          practiceId={practiceId}
          patientId={patientId}
          visitId={visitId}
          prescriberId={props.prescriberId}
          settings={settings}
          items={loaded.items}
          levels={loaded.levels}
          start={start}
          billingBlocked={props.billingBlocked}
          hasMedicalAid={props.hasMedicalAid}
          onBill={props.onBill}
          confirmMedicine={props.confirmMedicine}
          onDispensed={() => {
            setStart(null);
            void load();
          }}
        />
      )}
    </section>
  );
};

export default VisitDispensingPanel;
