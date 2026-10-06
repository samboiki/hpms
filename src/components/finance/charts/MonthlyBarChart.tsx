import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { monthKeyOf, type DateRange } from '../../../services/ledgerService';
import { CHART } from '../financeTheme';
import { formatMonthKey, formatNad, formatNadCompact } from '../financeFormat';
import { ChartTooltipCard, type TooltipRow } from '../FinanceUI';

export interface MonthlyBarDatum {
  monthKey: string;
  value: number;
  /** Extra tooltip lines, e.g. invoice count */
  details?: TooltipRow[];
}

interface MonthlyBarChartProps {
  data: MonthlyBarDatum[];
  seriesLabel: string;
  highlight: DateRange;
  height?: number;
}

/** One money series per month; months in the selected period are emphasised */
export const MonthlyBarChart: React.FC<MonthlyBarChartProps> = ({ data, seriesLabel, highlight, height = 240 }) => {
  const first = monthKeyOf(highlight.startKey);
  const last = monthKeyOf(highlight.endKey);
  const rows = data.map(d => ({ ...d, label: formatMonthKey(d.monthKey, 'MMM yy'), inPeriod: d.monthKey >= first && d.monthKey <= last }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="22%">
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tick={CHART.tick} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={CHART.tick} tickLine={false} axisLine={false} width={64} tickFormatter={value => formatNadCompact(Number(value))} />
        <Tooltip
          cursor={{ fill: 'rgba(8, 145, 178, 0.06)' }}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as (MonthlyBarDatum & { label: string }) | undefined;
            if (!active || !datum) return null;
            return (
              <ChartTooltipCard
                title={formatMonthKey(datum.monthKey, 'MMMM yyyy')}
                rows={[{ label: seriesLabel, value: formatNad(datum.value), color: CHART.accent }, ...(datum.details ?? [])]}
              />
            );
          }}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]} name={seriesLabel} isAnimationActive={false}>
          {rows.map(d => <Cell key={d.monthKey} fill={d.inPeriod ? CHART.accent : CHART.muted} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
