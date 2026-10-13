import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import type { FinanceWorkspace } from '../financeData';
import { formatDateKey } from '../financeFormat';
import type { PeriodLabels } from '../financeNav';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { fundInvoiceTable, fundSummaries, fundSummaryTable, invoicesPerFund, type BatchInfo } from './invoicesPerFund';
import { loadBatchInfo } from './practiceReportsService';
import { ReportFrame, type FrameState } from './ReportFrame';
import { useReportOpener } from './ReportOpener';

type View = 'funds' | 'invoices';

const VIEWS = [
  { value: 'funds' as const, label: 'Per fund', icon: 'solar:shield-check-bold-duotone' },
  { value: 'invoices' as const, label: 'Every invoice', icon: 'solar:list-bold-duotone' }
];

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  workspace: FinanceWorkspace;
}

/** Invoices per fund for a day or the period (parity R18), with where each claim stands; prints and downloads */
export const InvoicesPerFundReport: React.FC<Props> = ({ practiceId, practiceName, labels, workspace }) => {
  const period = labels.ranges.current;
  const [day, setDay] = useState('');
  const [view, setView] = useState<View>('funds');
  const [fund, setFund] = useState('');
  const [batches, setBatches] = useState<Map<string, BatchInfo> | null>(null);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: workspace.patientNames, onChanged: () => undefined });

  // A day of the period, or the whole period
  const oneDay = !!day && day >= period.startKey && day <= period.endKey;
  const range = useMemo(() => (oneDay ? { startKey: day, endKey: day } : period), [oneDay, day, period]);
  const rangeLabel = oneDay ? formatDateKey(day) : labels.current;
  const batchIds = useMemo(
    () => [...new Set(workspace.invoices.rows.map(invoice => invoice.batchId).filter((id): id is string => !!id))].sort().join(','),
    [workspace.invoices.rows]
  );

  useEffect(() => {
    let cancelled = false;
    setBatches(null);
    setBatchError(null);
    loadBatchInfo(batchIds ? batchIds.split(',') : [])
      .then(map => { if (!cancelled) setBatches(map); })
      .catch(error => { if (!cancelled) setBatchError(error instanceof Error ? plainWords(error.message) : 'Could not load the claim batches.'); });
    return () => {
      cancelled = true;
    };
  }, [batchIds, attempt]);

  const rows = useMemo(
    () => (batches ? invoicesPerFund({ invoices: workspace.invoices.rows, range, schemeByPatient: workspace.schemeByPatient, batchById: batches }) : []),
    [batches, workspace.invoices.rows, workspace.schemeByPatient, range]
  );
  const summaries = useMemo(() => fundSummaries(rows), [rows]);
  const fundLabelOf = (key: string) => summaries.find(summary => summary.fundKey === key)?.fund ?? key;
  const summaryReport = useMemo(() => fundSummaryTable(summaries, rangeLabel), [summaries, rangeLabel]);
  const report = !batches ? null
    : view === 'funds' ? summaryReport
      : fundInvoiceTable(fund ? rows.filter(row => row.fundKey === fund) : rows, rangeLabel, workspace.patientNames, fund ? fundLabelOf(fund) : null);
  const status: FrameState = batchError ? { state: 'error', error: batchError } : batches ? { state: 'ready' } : { state: 'loading' };

  return (
    <>
      <ReportFrame
        title="Invoices per fund"
        subtitle={`Invoices dated ${rangeLabel}`}
        icon="solar:shield-check-bold-duotone"
        tone="cyan"
        exportKey={view === 'funds' ? 'invoices_per_fund' : 'invoices_per_fund_detail'}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ fund: fund || null }}
        status={status}
        onRetry={() => setAttempt(n => n + 1)}
        report={report}
        empty={{ title: 'No invoices on these days', hint: 'Invoices dated in the period (or on the day chosen) appear here per fund.' }}
        onOpen={open}
        resetKey={`${view}|${fund}|${day}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Invoices per fund views" />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="One day only" htmlFor="fund-invoices-day" hint="Leave empty for the whole period">
                <input id="fund-invoices-day" type="date" className={inputClass} value={day} min={period.startKey} max={period.endKey}
                  onChange={event => setDay(event.target.value)} />
              </Field>
              {view === 'invoices' && (
                <Field label="Fund" htmlFor="fund-invoices-fund">
                  <select id="fund-invoices-fund" className={inputClass} value={fund} onChange={event => setFund(event.target.value)}>
                    <option value="">Every fund</option>
                    {summaries.map(summary => <option key={summary.fundKey} value={summary.fundKey}>{summary.fund}</option>)}
                  </select>
                </Field>
              )}
            </div>
          </div>
        }
        onRowClick={view === 'funds' ? index => {
          const key = summaryReport.keys[index];
          if (key) {
            setFund(key);
            setView('invoices');
          }
        } : undefined}
        rowLabel={view === 'funds' ? index => `Show the invoices of ${fundLabelOf(summaryReport.keys[index] ?? '')}` : undefined}
      />
      {element}
    </>
  );
};
