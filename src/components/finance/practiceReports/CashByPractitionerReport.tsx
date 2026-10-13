import React, { useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { cashByPractitioner, cashDetailTable, cashKey, cashKeyLabel, cashSummaryTable } from './cashByPractitioner';
import { loadCashParts } from './practiceReportsService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'summary' | 'payments';

const VIEWS = [
  { value: 'summary' as const, label: 'Per practitioner', icon: 'solar:users-group-rounded-bold-duotone' },
  { value: 'payments' as const, label: 'Every payment', icon: 'solar:list-bold-duotone' }
];

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/** Cash flow per practitioner (parity R7): money received per practitioner by the day it came in */
export const CashByPractitionerReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadCashParts(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Cash flow per practitioner is not set up in this database yet (proposals/2026-10-12-finance-reports.sql).'
  );
  const [view, setView] = useState<View>('summary');
  const [who, setWho] = useState('');
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: data?.patientNames ?? {}, onChanged: retry });

  const summary = useMemo(() => cashByPractitioner(data?.parts ?? []), [data]);
  const report = useMemo(() => {
    if (!data) return null;
    if (view === 'summary') return cashSummaryTable(summary, labels.current, staffNames);
    const parts = who ? data.parts.filter(part => cashKey(part) === who) : data.parts;
    return cashDetailTable(parts, `${labels.current}${who ? ` · ${cashKeyLabel(who, staffNames)}` : ''}`, staffNames, data.patientNames);
  }, [data, view, who, summary, labels, staffNames]);

  return (
    <>
      <ReportFrame
        title="Cash flow per practitioner"
        subtitle={`Payments received ${labels.current}`}
        icon="solar:wad-of-money-bold-duotone"
        tone="green"
        exportKey={view === 'summary' ? 'cash_by_practitioner' : 'cash_by_practitioner_payments'}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ practitioner: who || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'No payments in this period', hint: 'Payments received with Receive payment, and fund payments posted, appear here on the day they came in.' }}
        onOpen={open}
        resetKey={`${view}|${who}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Cash flow views" />
            {view === 'payments' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Practitioner" htmlFor="cash-practitioner">
                  <select id="cash-practitioner" className={inputClass} value={who} onChange={event => setWho(event.target.value)}>
                    <option value="">Everyone</option>
                    {summary.rows.map(row => <option key={row.key} value={row.key}>{cashKeyLabel(row.key, staffNames)}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        }
        onRowClick={view === 'summary' ? index => {
          const key = summary.rows[index]?.key;
          if (key) {
            setWho(key);
            setView('payments');
          }
        } : undefined}
        rowLabel={view === 'summary' ? index => `Show the payments of ${cashKeyLabel(summary.rows[index]?.key ?? '', staffNames)}` : undefined}
      />
      {element}
    </>
  );
};
