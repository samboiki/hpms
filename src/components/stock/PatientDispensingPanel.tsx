import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import {
  loadDispensings,
  loadPatientNames,
  loadPracticeHeading,
  loadStaffNames,
  loadStockItems,
  type PracticeHeading
} from '../../services/stock/stockService';
import { todayKey } from '../../utils/billing/dates';
import type { StockItem } from '../../utils/stock/items';
import { SCRIPT_STATE_LABELS, dueText, summarizeScripts, type DispensingRecord } from '../../utils/stock/repeats';
import { stockItemLink } from '../billing/invoiceLinks';
import { labelEntryFor, printLabels } from './dispensingLabels';
import { useStockSettings } from './useStockSettings';
import { Chip } from './stockParts';
import { CARD, LINK, QUIET, STOCK_COLOR, day, errorText, units } from './stockUi';

interface Loaded {
  records: DispensingRecord[];
  items: StockItem[];
  patientName: string;
  staffNames: Map<string, string>;
  heading: PracticeHeading;
}

const HISTORY_SHOWN = 50;

/**
 * The medicines dispensed to a patient, on the patient file's Medications tab: their scripts with the repeats left and
 * when the next one is due, and every dispensing with its label. Dispensing itself happens in a visit. Renders nothing
 * for a practice that has never dispensed, or before the stock update is applied.
 */
export const PatientDispensingPanel: React.FC<{
  practiceId: string | null | undefined;
  patientId: string;
  /** Open one of the patient's visits (the patient file's visit screen) */
  onOpenVisit?: (visitId: string) => void;
}> = ({ practiceId, patientId, onOpenVisit }) => {
  const setup = useStockSettings(practiceId);
  const ready = setup.status === 'ready';
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const today = todayKey();

  const load = useCallback(async () => {
    if (!practiceId || !ready) return;
    setFailed(null);
    try {
      const records = await loadDispensings({ practiceId, patientId });
      if (records.length === 0) {
        setLoaded({ records, items: [], patientName: '', staffNames: new Map(), heading: { name: '', phone: null, address: null } });
        return;
      }
      const [stock, names, staffNames, heading] = await Promise.all([
        loadStockItems(practiceId),
        loadPatientNames([patientId]),
        loadStaffNames(practiceId),
        loadPracticeHeading(practiceId)
      ]);
      setLoaded({ records, items: stock.items, patientName: names.get(patientId) ?? 'Patient', staffNames, heading });
    } catch (error) {
      setFailed(errorText(error, 'Could not load the medicines dispensed'));
    }
  }, [practiceId, patientId, ready]);

  useEffect(() => {
    void load();
  }, [load]);

  const scripts = useMemo(() => summarizeScripts(loaded?.records ?? [], today).filter(script => script.first.repeatsAllowed > 0), [loaded, today]);

  if (setup.status !== 'ready') return null;
  const { settings } = setup;
  if (!settings.dispensingEnabled && (!loaded || loaded.records.length === 0) && !failed) return null;

  const itemOf = (id: string) => loaded?.items.find(item => item.id === id) ?? null;
  const print = (record: DispensingRecord) => {
    if (!loaded) return;
    printLabels(loaded.heading, settings, [labelEntryFor(record, { all: loaded.records, items: loaded.items, patientName: loaded.patientName, staffNames: loaded.staffNames })]);
  };

  return (
    <section className={`${CARD} p-4 sm:p-6`} aria-labelledby="patient-dispensing-title">
      <div className="mb-4 flex items-center gap-3">
        <span className={`rounded-lg p-2 shadow-md ${STOCK_COLOR.iconBox}`}>
          <Icon icon="solar:pill-bold-duotone" className="h-5 w-5 text-white" aria-hidden="true" />
        </span>
        <div>
          <h3 id="patient-dispensing-title" className="text-lg font-semibold text-gray-800">Medicines dispensed</h3>
          <p className="text-sm text-gray-600">Scripts, repeats and labels. To dispense, open a visit&apos;s Medications tab.</p>
        </div>
      </div>

      {failed ? (
        <p className="flex flex-wrap items-center gap-2 text-sm text-red-700" role="alert">
          {failed}
          <button type="button" className={QUIET} onClick={() => void load()}>Try again</button>
        </p>
      ) : !loaded ? (
        <p className="text-sm text-gray-500" role="status">Loading the medicines dispensed…</p>
      ) : loaded.records.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 px-3 py-4 text-center text-sm text-gray-500">Nothing dispensed to this patient yet.</p>
      ) : (
        <div className="space-y-5">
          {scripts.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-700">Scripts with repeats</h4>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {scripts.map(script => {
                  const item = itemOf(script.first.itemId);
                  const due = dueText(script.nextDueOn, today, day);
                  return (
                    <li key={script.first.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0">
                        <span className="font-medium text-gray-900">{item?.name ?? 'Medicine'}</span>
                        <span className="text-gray-500"> · {script.first.number} · from {day(script.first.dispensedOn)}</span>
                        <span className="block text-xs text-gray-600">
                          {script.repeats.length} of {script.first.repeatsAllowed} repeat{script.first.repeatsAllowed === 1 ? '' : 's'} dispensed
                          {script.first.validUntil ? ` · valid to ${day(script.first.validUntil)}` : ''}
                          {due ? ` · ${due}` : ''}
                        </span>
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {script.first.isChronic && <Chip tone="violet">Chronic</Chip>}
                        <Chip tone={script.state === 'repeats_left' ? 'green' : 'gray'}>{SCRIPT_STATE_LABELS[script.state]}</Chip>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-700">Every dispensing</h4>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {loaded.records.slice(0, HISTORY_SHOWN).map(record => {
                const item = itemOf(record.itemId);
                const visitId = record.visitId;
                return (
                  <li key={record.id} className={`flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm ${record.cancelledAt ? 'opacity-60' : ''}`}>
                    <span className="min-w-0">
                      <span className="font-medium text-gray-900">{day(record.dispensedOn)}</span>
                      <span className="text-gray-500"> · {record.number} · </span>
                      {item ? <Link to={stockItemLink(item.id)} className={LINK}>{item.name}</Link> : 'Medicine'}
                      <span className="text-gray-500"> · {units(record.quantity, item?.unit ?? 'units')}</span>
                      <span className="block text-xs text-gray-600">{record.directions}</span>
                      {record.cancelledAt && <span className="block text-xs text-gray-500">Cancelled{record.cancelReason ? `: ${record.cancelReason}` : ''}</span>}
                    </span>
                    <span className="flex items-center gap-1">
                      {visitId && onOpenVisit && (
                        <button type="button" className={QUIET} onClick={() => onOpenVisit(visitId)} aria-label={`Open the visit of ${record.number}`}>
                          <Icon icon="solar:clipboard-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Visit
                        </button>
                      )}
                      {!record.cancelledAt && (
                        <button type="button" className={QUIET} onClick={() => print(record)} aria-label={`Print the label for ${record.number}`}>
                          <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Label
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            {loaded.records.length > HISTORY_SHOWN && (
              <p className="mt-2 text-xs text-gray-500">The latest {HISTORY_SHOWN} of {loaded.records.length} are shown.</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default PatientDispensingPanel;
