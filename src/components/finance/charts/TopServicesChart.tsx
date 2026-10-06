import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { TariffRevenueRow } from '../../../services/ledgerService';
import { CHART } from '../financeTheme';
import { formatCount, formatNad, formatNadCompact, formatPercent } from '../financeFormat';
import { ChartTooltipCard } from '../FinanceUI';

const HIGHLIGHT_TOP = 3;

/** Tariff codes by line-item revenue; the top three are emphasised (Communications top-N style) */
export const TopServicesChart: React.FC<{ rows: TariffRevenueRow[] }> = ({ rows }) => {
  const data = rows.map(row => ({ ...row, label: row.code || 'No code' }));
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 38 + 24)}>
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }} barCategoryGap="24%">
        <CartesianGrid horizontal={false} stroke={CHART.grid} />
        <XAxis type="number" tick={CHART.tick} tickLine={false} axisLine={false} tickFormatter={value => formatNadCompact(Number(value))} />
        <YAxis type="category" dataKey="label" tick={{ ...CHART.tick, fill: '#4B5563' }} tickLine={false} axisLine={false} width={72} />
        <Tooltip
          cursor={{ fill: 'rgba(8, 145, 178, 0.06)' }}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as (TariffRevenueRow & { label: string }) | undefined;
            if (!active || !datum) return null;
            return (
              <ChartTooltipCard
                title={`${datum.label} · ${datum.description}`}
                rows={[
                  { label: 'Revenue', value: formatNad(datum.revenue) },
                  { label: 'Share', value: formatPercent(datum.share) },
                  { label: 'Quantity', value: formatCount(datum.quantity) },
                  { label: 'Invoices', value: formatCount(datum.invoiceCount) }
                ]}
              />
            );
          }}
        />
        <Bar dataKey="revenue" radius={[0, 4, 4, 0]} name="Revenue" isAnimationActive={false}>
          {data.map((d, index) => <Cell key={`${d.label}-${index}`} fill={index < HIGHLIGHT_TOP ? CHART.accent : CHART.muted} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
