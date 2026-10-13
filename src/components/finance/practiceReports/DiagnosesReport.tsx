import React, { useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { diagnosisSummary, diagnosisTable, practitionerOf } from './diagnosisSummary';
import { loadDiagnosisLines } from './practiceReportsService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'practitioners' | 'practice';

const VIEWS = [
  { value: 'practitioners' as const, label: 'By practitioner', icon: 'solar:users-group-rounded-bold-duotone' },
  { value: 'practice' as const, label: 'Whole practice', icon: 'solar:buildings-2-bold-duotone' }
];

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/** ICD-10 diagnosis summaries (parity R30): main diagnosis against all codes, per practitioner; each row opens its visits */
export const DiagnosesReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadDiagnosisLines(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'ICD-10 codes on invoice lines are not set up in this database yet (proposals/2026-10-08-invoice-line-codes.sql).'
  );
  const [view, setView] = useState<View>('practitioners');
  const [practitioner, setPractitioner] = useState('');
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: {}, onChanged: retry });

  const summary = useMemo(() => diagnosisSummary(data?.lines ?? []), [data]);
  const practitioners = useMemo(() => [...new Set(summary.rows.map(row => row.practitioner))], [summary]);
  const report = useMemo(() => {
    if (!data) return null;
    const perPractitioner = view === 'practitioners';
    const rows = perPractitioner ? summary.rows.filter(row => !practitioner || row.practitioner === practitioner) : summary.practice;
    return diagnosisTable({ rows, periodLabel: labels.current, descriptions: data.descriptions, names: staffNames, perPractitioner, linesWithoutVisit: summary.linesWithoutVisit });
  }, [data, view, summary, practitioner, labels, staffNames]);

  return (
    <>
      <ReportFrame
        title="ICD-10 diagnoses"
        subtitle={`Invoices dated ${labels.current}`}
        icon="solar:stethoscope-bold-duotone"
        tone="blue"
        exportKey={view === 'practitioners' ? 'diagnoses_by_practitioner' : 'diagnoses'}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ practitioner: practitioner || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'No ICD-10 codes on this period\'s invoices', hint: 'Codes put on invoice lines (when billing a visit or reviewing a claim) appear here.' }}
        onOpen={open}
        resetKey={`${view}|${practitioner}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Diagnosis views" />
            {view === 'practitioners' && practitioners.length > 1 && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Practitioner" htmlFor="diagnoses-practitioner">
                  <select id="diagnoses-practitioner" className={inputClass} value={practitioner} onChange={event => setPractitioner(event.target.value)}>
                    <option value="">Every practitioner</option>
                    {practitioners.map(key => <option key={key} value={key}>{practitionerOf(key, staffNames)}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        }
      />
      {element}
    </>
  );
};
