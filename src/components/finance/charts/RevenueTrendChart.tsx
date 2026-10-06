import React, { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthKeyOf, type DateRange, type MonthlyRevenueRow } from '../../../services/ledgerService';
import { CHART, FUNDER_META } from '../financeTheme';
import { formatCount, formatMonthKey, formatNad, formatNadCompact } from '../financeFormat';
import { ChartTooltipCard, FilterPill, LegendItem } from '../FinanceUI';

type Metric = 'billed' | 'collected' | 'invoices';

interface TrendDatum extends MonthlyRevenueRow {
  label: string;
  inPeriod: boolean;
}

interface RevenueTrendChartProps {
  rows: MonthlyRevenueRow[];
  /** Months overlapping this range are emphasised; the rest give context */
  highlight: DateRange;
}

/** Monthly revenue (by funder), collections or invoice volume over the trend window */
export const RevenueTrendChart: React.FC<RevenueTrendChartProps> = ({ rows, highlight }) => {
  const [metric, setMetric] = useState<Metric>('billed');
  const firstMonth = monthKeyOf(highlight.startKey);
  const lastMonth = monthKeyOf(highlight.endKey);
  const data: TrendDatum[] = useMemo(
    () => rows.map(row => ({ ...row, label: formatMonthKey(row.monthKey, 'MMM yy'), inPeriod: row.monthKey >= firstMonth && row.monthKey <= lastMonth })),
    [rows, firstMonth, lastMonth]
  );
  const singleKey = metric === 'collected' ? 'collected' : 'invoiceCount';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPill active={metric === 'billed'} onClick={() => setMetric('billed')} icon="solar:bill-list-bold-duotone">Billed</FilterPill>
          <FilterPill active={metric === 'collected'} onClick={() => setMetric('collected')} icon="solar:hand-money-bold-duotone">Collected</FilterPill>
          <FilterPill active={metric === 'invoices'} onClick={() => setMetric('invoices')} icon="solar:document-text-bold-duotone">Invoices</FilterPill>
        </div>
        {metric === 'billed' && (
          <div className="flex items-center gap-2">
            <LegendItem color={FUNDER_META.medical_aid.color} label="Medical aid" tint="bg-transparent" />
            <LegendItem color={FUNDER_META.patient.color} label="Patient" tint="bg-transparent" />
          </div>
        )}
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
          <CartesianGrid vertical={false} stroke={CHART.grid} />
          <XAxis dataKey="label" tick={CHART.tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis
            tick={CHART.tick}
            tickLine={false}
            axisLine={false}
            width={64}
            allowDecimals={metric !== 'invoices'}
            tickFormatter={value => (metric === 'invoices' ? formatCount(Number(value)) : formatNadCompact(Number(value)))}
          />
          <Tooltip
            cursor={{ fill: 'rgba(8, 145, 178, 0.06)' }}
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as TrendDatum | undefined;
              if (!active || !datum) return null;
              return (
                <ChartTooltipCard
                  title={formatMonthKey(datum.monthKey, 'MMMM yyyy')}
                  rows={[
                    { label: 'Medical aid', value: formatNad(datum.medicalAid), color: FUNDER_META.medical_aid.color },
                    { label: 'Patient', value: formatNad(datum.patient), color: FUNDER_META.patient.color },
                    { label: 'Billed', value: formatNad(datum.billed) },
                    { label: 'Collected', value: formatNad(datum.collected) },
                    { label: 'Invoices', value: formatCount(datum.invoiceCount) }
                  ]}
                />
              );
            }}
          />
          {metric === 'billed' && (
            <Bar dataKey="medicalAid" stackId="billed" fill={FUNDER_META.medical_aid.color} stroke="#ffffff" strokeWidth={1} name="Medical aid" isAnimationActive={false}>
              {data.map(d => <Cell key={d.monthKey} fillOpacity={d.inPeriod ? 1 : 0.35} />)}
            </Bar>
          )}
          {metric === 'billed' && (
            <Bar dataKey="patient" stackId="billed" fill={FUNDER_META.patient.color} stroke="#ffffff" strokeWidth={1} radius={[4, 4, 0, 0]} name="Patient" isAnimationActive={false}>
              {data.map(d => <Cell key={d.monthKey} fillOpacity={d.inPeriod ? 1 : 0.35} />)}
            </Bar>
          )}
          {metric !== 'billed' && (
            <Bar dataKey={singleKey} radius={[4, 4, 0, 0]} name={metric === 'collected' ? 'Collected' : 'Invoices'} isAnimationActive={false}>
              {data.map(d => <Cell key={d.monthKey} fill={d.inPeriod ? CHART.accent : CHART.muted} />)}
            </Bar>
          )}
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-400 mt-2">Stronger bars are months in the selected period; months are grouped by invoice date.</p>
    </div>
  );
};
