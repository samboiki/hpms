import React from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AGING_BUCKETS, type AgingBucket, type AgingReport } from '../../../services/ledgerService';
import { AGING_COLORS, CHART, FUNDER_META } from '../financeTheme';
import { formatCount, formatNad, formatNadCompact } from '../financeFormat';
import { ChartTooltipCard } from '../FinanceUI';

interface AgingDatum {
  bucket: AgingBucket;
  label: string;
  description: string;
  amount: number;
  medicalAid: number;
  patient: number;
  count: number;
}

interface AgingChartProps {
  aging: AgingReport;
  /** 'severity' colours each bucket by age; 'funder' stacks medical aid and patient */
  mode?: 'severity' | 'funder';
  onSelectBucket?: (bucket: AgingBucket) => void;
  height?: number;
}

export const AgingChart: React.FC<AgingChartProps> = ({ aging, mode = 'severity', onSelectBucket, height = 260 }) => {
  const data: AgingDatum[] = AGING_BUCKETS.map(({ key, label, description }) => ({ bucket: key, label, description, ...aging.byBucket[key] }));
  const handleClick = onSelectBucket
    ? (entry: unknown) => {
        const bucket = (entry as { payload?: AgingDatum } | undefined)?.payload?.bucket;
        if (bucket) onSelectBucket(bucket);
      }
    : undefined;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid vertical={false} stroke={CHART.grid} />
        <XAxis dataKey="label" tick={CHART.tick} tickLine={false} axisLine={false} interval={0} />
        <YAxis tick={CHART.tick} tickLine={false} axisLine={false} width={64} tickFormatter={value => formatNadCompact(Number(value))} />
        <Tooltip
          cursor={{ fill: 'rgba(234, 88, 12, 0.06)' }}
          content={({ active, payload }) => {
            const datum = payload?.[0]?.payload as AgingDatum | undefined;
            if (!active || !datum) return null;
            return (
              <ChartTooltipCard
                title={`${datum.label} (${datum.description.toLowerCase()})`}
                rows={[
                  { label: 'Owed', value: formatNad(datum.amount), color: AGING_COLORS[datum.bucket] },
                  { label: 'Medical aid', value: formatNad(datum.medicalAid), color: FUNDER_META.medical_aid.color },
                  { label: 'Patient', value: formatNad(datum.patient), color: FUNDER_META.patient.color },
                  { label: 'Invoices', value: formatCount(datum.count) }
                ]}
              />
            );
          }}
        />
        {mode === 'severity' && (
          <Bar dataKey="amount" radius={[4, 4, 0, 0]} name="Owed" onClick={handleClick} cursor={onSelectBucket ? 'pointer' : undefined} isAnimationActive={false}>
            {data.map(d => <Cell key={d.bucket} fill={AGING_COLORS[d.bucket]} />)}
          </Bar>
        )}
        {mode === 'funder' && (
          <Bar dataKey="medicalAid" stackId="funder" fill={FUNDER_META.medical_aid.color} stroke="#ffffff" strokeWidth={1} name="Medical aid" onClick={handleClick} cursor={onSelectBucket ? 'pointer' : undefined} isAnimationActive={false} />
        )}
        {mode === 'funder' && (
          <Bar dataKey="patient" stackId="funder" fill={FUNDER_META.patient.color} stroke="#ffffff" strokeWidth={1} radius={[4, 4, 0, 0]} name="Patient" onClick={handleClick} cursor={onSelectBucket ? 'pointer' : undefined} isAnimationActive={false} />
        )}
      </BarChart>
    </ResponsiveContainer>
  );
};
