import React, { useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { formatNad, pluralize } from '../financeFormat';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { patientName } from './patientDemographics';
import { loadPatientSpend } from './patientReportsService';
import { NO_PATIENT, averageCents, patientSpendTable, spendByTown, spendPerPatient, townSpendTable } from './patientSpend';
import { TOWN_NOT_RECORDED, townNote, townReader } from './patientTowns';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'town' | 'patient';

const VIEWS = [
  { value: 'town' as const, label: 'Per town', icon: 'solar:map-point-bold-duotone' },
  { value: 'patient' as const, label: 'Per patient', icon: 'solar:users-group-rounded-bold-duotone' }
];

const EXPORT_KEYS: Record<View, string> = { town: 'spend_by_town', patient: 'spend_per_patient' };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
}

/** Average spend per patient and patients by town (parity R28): per town, or per patient; a patient opens their file */
export const SpendByTownReport: React.FC<Props> = ({ practiceId, practiceName, labels }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadPatientSpend(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Patient files could not be read in this database.'
  );
  const [view, setView] = useState<View>('town');
  const [town, setTown] = useState('');
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: {}, onChanged: retry });

  const records = useMemo(() => new Map((data?.records ?? []).map(record => [record.id, record])), [data]);
  // Each patient's town, read once (a place on the Namibian towns list is looked up once for all patients)
  const townOf = useMemo(() => {
    const reader = townReader();
    const towns = new Map([...records.values()].map(record => [record.id, reader.town(record)]));
    return (patientId: string) => towns.get(patientId) ?? TOWN_NOT_RECORDED;
  }, [records]);
  const summary = useMemo(() => spendPerPatient(data?.invoices ?? [], range), [data, range]);
  const towns = useMemo(() => {
    const onFile = new Map<string, number>();
    for (const record of records.keys()) {
      const name = townOf(record);
      onFile.set(name, (onFile.get(name) ?? 0) + 1);
    }
    return spendByTown(summary, townOf, onFile);
  }, [records, townOf, summary]);

  const notes = useMemo(() => {
    const withPatient = summary.billedCents - (summary.patients.find(row => row.key === NO_PATIENT)?.billedCents ?? 0);
    const perPatient = averageCents(withPatient, summary.patientsBilled);
    const perInvoice = averageCents(summary.billedCents, summary.invoices);
    return [
      `Billed: uncancelled invoices dated ${labels.current}, the whole invoice (medical aid and patient portions), as Overview's Billed: ${formatNad(summary.billedCents / 100)}.`,
      perPatient === null
        ? 'No patient was billed in this period.'
        : `On average ${formatNad(perPatient / 100)} per patient billed (${pluralize(summary.patientsBilled, 'patient')}) and ${formatNad((perInvoice ?? 0) / 100)} per invoice.`,
      'Patients on file counts every patient file of the practice in each town, billed or not; files merged into another are left out.',
      townNote(data?.townField ?? false)
    ];
  }, [summary, labels, data]);

  const report = useMemo(() => {
    if (!data) return null;
    const basis = `Invoices dated ${labels.current}`;
    if (view === 'town') return townSpendTable(towns, summary, { basis, notes });
    const patients = town ? summary.patients.filter(row => row.key !== NO_PATIENT && townOf(row.key) === town) : summary.patients;
    return patientSpendTable(patients, {
      basis: `${basis}${town ? ` · ${town}` : ''}`,
      notes,
      nameOf: patientId => {
        const record = records.get(patientId);
        return record ? patientName(record) : 'Patient not found';
      },
      townOf
    });
  }, [data, view, towns, summary, labels, notes, town, townOf, records]);

  const townRow = view === 'town' ? (index: number) => towns[index]?.town ?? '' : null;

  return (
    <>
      <ReportFrame
        title="Spend and patients by town"
        subtitle={`Invoices dated ${labels.current}`}
        icon="solar:map-point-bold-duotone"
        tone="amber"
        exportKey={EXPORT_KEYS[view]}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ town: town || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'Nothing billed in this period', hint: 'Invoices issued in this period appear here, per town and per patient.' }}
        onOpen={open}
        resetKey={`${view}|${town}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Spend views" />
            {view === 'patient' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Town" htmlFor="spend-town">
                  <select id="spend-town" className={inputClass} value={town} onChange={event => setTown(event.target.value)}>
                    <option value="">Every town</option>
                    {towns.filter(row => row.patientsBilled > 0).map(row => <option key={row.town} value={row.town}>{row.town}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        }
        onRowClick={townRow ? index => {
          const name = townRow(index);
          if (!name || towns[index]?.patientsBilled === 0) return;
          setTown(name);
          setView('patient');
        } : undefined}
        rowLabel={townRow ? index => `List the patients billed in ${townRow(index)}` : undefined}
      />
      {element}
    </>
  );
};
