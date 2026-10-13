import React, { useMemo, useState } from 'react';
import type { PeriodLabels } from '../financeNav';
import { formatRangeLabel } from '../financeFormat';
import { SegmentedTabs } from '../FinanceUI';
import { loadYearToDate } from './periodReportsService';
import { ReportFrame } from './ReportFrame';
import { staffName } from './reportTargets';
import { useReportLoad } from './useReportLoad';
import {
  NO_PRACTITIONER,
  yearToDateByFund,
  yearToDateByPractitioner,
  yearToDateByTariff,
  yearToDateRange,
  yearToDateTable,
  type YearToDateView
} from './yearToDate';

const VIEWS = [
  { value: 'tariff' as const, label: 'Per tariff code', icon: 'solar:tag-price-bold-duotone' },
  { value: 'fund' as const, label: 'Per fund', icon: 'solar:shield-check-bold-duotone' },
  { value: 'practitioner' as const, label: 'Per practitioner', icon: 'solar:stethoscope-bold-duotone' }
];

/** A matrix row is a total of many invoices: it opens nothing */
const opensNothing = (): void => undefined;

const SETUP: Record<YearToDateView, { title: string; header: string; exportKey: string }> = {
  tariff: { title: 'Year to date per tariff code', header: 'Tariff code', exportKey: 'year_to_date_tariff' },
  fund: { title: 'Year to date per fund', header: 'Medical aid fund', exportKey: 'year_to_date_fund' },
  practitioner: { title: 'Year to date per practitioner', header: 'Practitioner', exportKey: 'year_to_date_practitioner' }
};

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
  staffNames: Record<string, string>;
}

/**
 * Year to date per tariff code, fund and practitioner (parity R21): what was billed from 1 January to the last day of
 * the period chosen at the top of the page, one column per month.
 */
export const YearToDateReport: React.FC<Props> = ({ practiceId, practiceName, labels, staffNames }) => {
  const range = useMemo(() => yearToDateRange(labels.ranges.current.endKey), [labels]);
  const { status, data, retry } = useReportLoad(
    () => loadYearToDate(practiceId, range),
    `${practiceId}|${range.startKey}|${range.endKey}`,
    'The year to date is not set up in this database yet.'
  );
  const [view, setView] = useState<YearToDateView>('tariff');
  const period = formatRangeLabel(range);

  const report = useMemo(() => {
    if (!data) return null;
    const matrix = view === 'tariff'
      ? yearToDateByTariff(data.lines, data.invoices, range)
      : view === 'fund'
        ? yearToDateByFund(data.invoices, range, data.schemeByPatient)
        : yearToDateByPractitioner(data.invoices, data.visits, range);
    return yearToDateTable(matrix, {
      title: SETUP[view].title,
      header: SETUP[view].header,
      basis: `Billed ${period}`,
      label: row => view !== 'practitioner'
        ? row.label
        : row.key === NO_PRACTITIONER ? 'No practitioner recorded' : staffName(row.key, staffNames, 'Practitioner not on the staff list')
    });
  }, [data, view, range, period, staffNames]);

  return (
    <>
      <ReportFrame
        title="Year to date"
        subtitle={`Billed ${period}`}
        icon="solar:calendar-date-bold-duotone"
        tone="indigo"
        exportKey={SETUP[view].exportKey}
        practiceId={practiceId}
        practiceName={practiceName}
        range={range}
        status={status}
        onRetry={retry}
        report={report}
        empty={{ title: 'Nothing billed this year yet', hint: 'Invoices issued from 1 January appear here, one column per month.' }}
        onOpen={opensNothing}
        resetKey={view}
        controls={<SegmentedTabs value={view} onChange={setView} options={VIEWS} ariaLabel="Year to date views" />}
      />
    </>
  );
};
