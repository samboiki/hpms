import React from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import type { MethodCollections } from '../../../services/ledgerService';
import { PAYMENT_METHOD_META } from '../financeTheme';
import { formatCount, formatNad, formatPercent } from '../financeFormat';
import { ChartTooltipCard, LegendItem } from '../FinanceUI';

interface MethodDonutProps {
  methods: MethodCollections[];
  total: number;
  centerLabel?: string;
}

/** Collections by payment method: donut with the total in the centre and a labelled legend */
export const MethodDonut: React.FC<MethodDonutProps> = ({ methods, total, centerLabel = 'Collected' }) => (
  <div>
    <div className="relative">
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{formatNad(total)}</p>
          <p className="text-sm text-gray-600">{centerLabel}</p>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <defs>
            {methods.map(({ method }) => (
              <linearGradient key={method} id={`finance-method-${method}`} x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={PAYMENT_METHOD_META[method].color} stopOpacity={0.85} />
                <stop offset="100%" stopColor={PAYMENT_METHOD_META[method].color} stopOpacity={1} />
              </linearGradient>
            ))}
          </defs>
          <Pie data={methods} dataKey="amount" nameKey="method" cx="50%" cy="50%" innerRadius={80} outerRadius={115} paddingAngle={2} isAnimationActive={false}>
            {methods.map(({ method }) => <Cell key={method} fill={`url(#finance-method-${method})`} stroke="#ffffff" strokeWidth={2} />)}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              const datum = payload?.[0]?.payload as MethodCollections | undefined;
              if (!active || !datum) return null;
              return (
                <ChartTooltipCard
                  title={PAYMENT_METHOD_META[datum.method].label}
                  rows={[
                    { label: 'Collected', value: formatNad(datum.amount), color: PAYMENT_METHOD_META[datum.method].color },
                    { label: 'Share', value: formatPercent(datum.share) },
                    { label: 'Invoices', value: formatCount(datum.count) }
                  ]}
                />
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
      {methods.map(({ method, amount, share }) => (
        <LegendItem
          key={method}
          color={PAYMENT_METHOD_META[method].color}
          tint={PAYMENT_METHOD_META[method].tint}
          label={PAYMENT_METHOD_META[method].label}
          value={`${formatNad(amount)} (${formatPercent(share)})`}
        />
      ))}
    </div>
  </div>
);
