import React, { useMemo, useState } from 'react';
import { PORTIONS, PORTION_LABELS, type Portion } from '../../../services/ledgerService';
import type { PeriodLabels } from '../financeNav';
import { SegmentedTabs } from '../FinanceUI';
import { Field, inputClass } from '../receipts/ArUi';
import { ROW_LABELS, agePartsTable, ageRows, ageSummaryTable, type AgeRowKey } from './allocationAges';
import { loadPaymentAges } from './periodReportsService';
import { ReportFrame } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

type View = 'bands' | 'list';

const VIEWS = [
  { value: 'bands' as const, label: 'Per age band', icon: 'solar:hourglass-bold-duotone' },
  { value: 'list' as const, label: 'Every allocation', icon: 'solar:list-bold-duotone' }
];

const EXPORT_KEYS: Record<View, string> = { bands: 'payments_by_age', list: 'payments_by_age_detail' };

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
}

/** Payments by the age of the debt they paid (parity R1): per age band, or every allocation; each payment opens */
export const AllocationsByAgeReport: React.FC<Props> = ({ practiceId, practiceName, labels }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadPaymentAges(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'Payments by age of debt needs receipts, which are not set up in this database yet (proposals/2026-10-07-receipts-and-allocations.sql).'
  );
  const [view, setView] = useState<View>('bands');
  const [band, setBand] = useState<AgeRowKey | ''>('');
  const [portion, setPortion] = useState<Portion | ''>('');
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: data?.patientNames ?? {}, onChanged: retry });

  const summary = useMemo(() => (data ? ageSummaryTable(data.parts, labels.current) : null), [data, labels]);
  const bands = useMemo(() => ageRows(data?.parts ?? []).filter(row => row.totalCents !== 0), [data]);
  const report = useMemo(() => {
    if (!data) return null;
    if (view === 'bands') return summary;
    const parts = data.parts.filter(part => (!band || part.rowKey === band) && (!portion || part.portion === portion));
    const filters = [band ? ROW_LABELS[band] : null, portion ? PORTION_LABELS[portion] : null].filter(Boolean).join(' · ');
    return agePartsTable(parts, `${labels.current}${filters ? ` · ${filters}` : ''}`, data.patientNames);
  }, [data, view, band, portion, summary, labels]);

  return (
    <>
      <ReportFrame
        title="Payments by age of debt"
        subtitle={`Payments received ${labels.current}`}
        icon="solar:hourglass-bold-duotone"
        tone="orange"
        exportKey={EXPORT_KEYS[view]}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        exportFilters={{ band: band || null, portion: portion || null }}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'No payments in this period', hint: 'Payments received with Receive payment, and fund payments posted, appear here with the age of the debt they paid.' }}
        onOpen={open}
        resetKey={`${view}|${band}|${portion}`}
        controls={
          <div className="space-y-3">
            <SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Payments by age views" />
            {view === 'list' && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="Age of the debt" htmlFor="payment-age-band">
                  <select id="payment-age-band" className={inputClass} value={band} onChange={event => setBand(event.target.value as AgeRowKey | '')}>
                    <option value="">Every age</option>
                    {bands.map(row => <option key={row.key} value={row.key}>{ROW_LABELS[row.key]}</option>)}
                  </select>
                </Field>
                <Field label="Portion" htmlFor="payment-age-portion">
                  <select id="payment-age-portion" className={inputClass} value={portion} onChange={event => setPortion(event.target.value as Portion | '')}>
                    <option value="">Both portions</option>
                    {PORTIONS.map(item => <option key={item} value={item}>{PORTION_LABELS[item]}</option>)}
                  </select>
                </Field>
              </div>
            )}
          </div>
        }
        onRowClick={view === 'bands' ? index => {
          const key = summary?.keys[index];
          if (!key) return;
          setBand(key);
          setPortion('');
          setView('list');
        } : undefined}
        rowLabel={view === 'bands' ? index => `List the payments in the row ${ROW_LABELS[summary?.keys[index] ?? 'current']}` : undefined}
      />
      {element}
    </>
  );
};
