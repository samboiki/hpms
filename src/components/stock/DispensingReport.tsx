import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { EmptyState, ErrorState, FilterPill, LoadingState, SectionCard } from '../finance/FinanceUI';
import { patientListsLink, patientMedicinesLink, stockItemLink } from '../billing/invoiceLinks';
import { loadBilledStockByVisit, loadDispensings, loadPatientNames } from '../../services/stock/stockService';
import { addDaysToKey, todayKey } from '../../utils/billing/dates';
import { dispensingBilling, type VisitBill } from '../../utils/stock/dispensingStatus';
import { dueText, summarizeScripts, type DispensingRecord } from '../../utils/stock/repeats';
import { BillingChip } from './dispensingUi';
import type { StockContext } from './stockContext';
import { LINK, STOCK_COLOR, day, errorText, units } from './stockUi';

type View = 'recent' | 'not_billed' | 'repeats';

/**
 * Medicines dispensed across the practice: the latest, those handed over but not on any bill (so they are not
 * forgotten), and the repeats falling due in the next week (the same patients the "Repeat medicine due" list holds).
 */
export const DispensingReport: React.FC<{ context: StockContext }> = ({ context }) => {
  const [records, setRecords] = useState<DispensingRecord[] | null>(null);
  const [bills, setBills] = useState<Map<string, VisitBill>>(new Map());
  const [patients, setPatients] = useState<Map<string, string>>(new Map());
  const [failed, setFailed] = useState<string | null>(null);
  const [view, setView] = useState<View>('recent');
  const today = todayKey();

  const load = useCallback(async () => {
    setFailed(null);
    try {
      const rows = await loadDispensings({ practiceId: context.practiceId });
      const [billed, names] = await Promise.all([
        loadBilledStockByVisit(rows.flatMap(row => (row.billed && row.visitId ? [row.visitId] : []))),
        loadPatientNames(rows.map(row => row.patientId))
      ]);
      setRecords(rows);
      setBills(billed);
      setPatients(names);
    } catch (error) {
      setFailed(errorText(error, 'Could not load the medicines dispensed'));
    }
  }, [context.practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemName = (id: string) => context.items.find(item => item.id === id)?.name ?? 'Item';
  const itemUnit = (id: string) => context.items.find(item => item.id === id)?.unit ?? 'units';

  const notBilled = useMemo(() => (records ?? []).filter(record => dispensingBilling(record, bills).state === 'not_on_bill'), [records, bills]);
  const due = useMemo(() => summarizeScripts(records ?? [], today)
    .filter(script => script.nextDueOn !== null && script.nextDueOn <= addDaysToKey(today, 7)), [records, today]);

  if (failed) return <ErrorState title="Dispensing could not be loaded" message={failed} onRetry={() => void load()} />;
  if (records === null) return <LoadingState label="Loading dispensing" />;

  const list = view === 'not_billed' ? notBilled : records.slice(0, 100);

  return (
    <SectionCard title="Dispensing" subtitle="What was given to whom, whether it was billed, and the repeats coming up" icon="solar:pills-3-bold-duotone" tone={STOCK_COLOR.tone}>
      <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Show">
        <FilterPill active={view === 'recent'} onClick={() => setView('recent')} count={Math.min(records.length, 100)}>Latest</FilterPill>
        <FilterPill active={view === 'not_billed'} onClick={() => setView('not_billed')} count={notBilled.length}>Not on a bill</FilterPill>
        <FilterPill active={view === 'repeats'} onClick={() => setView('repeats')} count={due.length}>Repeats due this week</FilterPill>
      </div>
      {view === 'repeats' ? (
        due.length === 0 ? (
          <EmptyState
            compact
            icon="solar:calendar-mark-bold-duotone"
            title="No repeats due this week"
            message={
              <>
                To message these patients, create the &apos;Repeat medicine due&apos; list in{' '}
                <Link to={patientListsLink()} className={LINK}>
                  Messages &gt; Lists
                </Link>
                .
              </>
            }
          />
        ) : (
          <ul className="divide-y divide-gray-100">
            {due.map(script => (
              <li key={script.first.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0">
                  <Link to={patientMedicinesLink(script.first.patientId)} className={LINK}>{patients.get(script.first.patientId) ?? 'Patient'}</Link>
                  <span className="text-gray-500"> · {itemName(script.first.itemId)} · {script.repeatsLeft} repeat{script.repeatsLeft === 1 ? '' : 's'} left</span>
                </span>
                <span className={`text-xs font-medium ${script.nextDueOn && script.nextDueOn < today ? 'text-red-700' : 'text-amber-700'}`}>{dueText(script.nextDueOn, today, day)}</span>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <EmptyState compact icon="solar:pills-3-bold-duotone" title={view === 'not_billed' ? 'Everything dispensed for billing is on a bill' : 'Nothing dispensed yet'} />
      ) : (
        <ul className="divide-y divide-gray-100">
          {list.map(record => (
            <li key={record.id} className="flex flex-wrap items-start justify-between gap-2 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium text-gray-900">{day(record.dispensedOn)}</span>
                <span className="text-gray-500"> · {record.number} · </span>
                <Link to={patientMedicinesLink(record.patientId)} className={LINK}>{patients.get(record.patientId) ?? 'Patient'}</Link>
                <span className="block text-xs text-gray-500">
                  <Link to={stockItemLink(record.itemId)} className={LINK}>{itemName(record.itemId)}</Link> · {units(record.quantity, itemUnit(record.itemId))} · {record.directions}
                </span>
              </span>
              <BillingChip billing={dispensingBilling(record, bills)} />
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
};

export default DispensingReport;
