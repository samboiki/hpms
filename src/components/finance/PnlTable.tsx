import React from 'react';
import { percentChange, type FinanceSummary } from '../../services/ledgerService';
import { formatChange, formatNad } from './financeFormat';

interface PnlTableProps {
  current: FinanceSummary;
  previous: FinanceSummary;
  currentLabel: string;
  previousLabel: string;
}

interface PnlLine {
  label: string;
  current: number | null;
  previous: number | null;
  /** Costs: a rise is bad */
  isCost?: boolean;
  isTotal?: boolean;
}

const changeClass = (change: number | null, isCost?: boolean) => {
  if (change === null || Math.abs(change) < 0.05) return 'text-gray-500';
  return (change > 0) !== !!isCost ? 'text-green-700' : 'text-red-700';
};

/** Profit and loss for the period and the comparison period (derived from HPMS records) */
export const PnlTable: React.FC<PnlTableProps> = ({ current, previous, currentLabel, previousLabel }) => {
  const lines: PnlLine[] = [
    { label: 'Income (billed)', current: current.income, previous: previous.income },
    { label: 'Practice expenses', current: current.practiceExpenses, previous: previous.practiceExpenses, isCost: true },
    { label: 'Payroll (gross)', current: current.payroll, previous: previous.payroll, isCost: true },
    { label: 'Net result', current: current.netResult, previous: previous.netResult, isTotal: true }
  ];
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-xs uppercase tracking-wider text-gray-500">
            <th scope="col" className="text-left font-medium py-2 pr-3" />
            <th scope="col" className="text-right font-medium py-2 px-3">{currentLabel}</th>
            <th scope="col" className="text-right font-medium py-2 px-3">{previousLabel}</th>
            <th scope="col" className="text-right font-medium py-2 pl-3">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {lines.map(line => {
            const change = line.current !== null && line.previous !== null ? percentChange(line.current, line.previous) : null;
            return (
              <tr key={line.label} className={line.isTotal ? 'border-t-2 border-gray-200 font-semibold text-gray-900' : 'text-gray-700'}>
                <th scope="row" className="text-left font-medium py-2.5 pr-3">{line.isCost ? `Less ${line.label.toLowerCase()}` : line.label}</th>
                <td className="text-right tabular-nums py-2.5 px-3 whitespace-nowrap">{line.current === null ? <span className="text-gray-400">Unavailable</span> : formatNad(line.current)}</td>
                <td className="text-right tabular-nums py-2.5 px-3 whitespace-nowrap text-gray-500">{line.previous === null ? 'Unavailable' : formatNad(line.previous)}</td>
                <td className={`text-right tabular-nums py-2.5 pl-3 whitespace-nowrap ${changeClass(change, line.isCost)}`}>{formatChange(change)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
