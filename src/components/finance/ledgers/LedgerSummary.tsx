import React from 'react';
import type { FinanceDerived } from '../deriveFinance';
import type { PeriodLabels } from '../financeNav';
import { formatNad } from '../financeFormat';
import { downloadCsv, exportFileName, toCsv } from '../financeExport';
import { ActionButton, Notice, SectionCard } from '../FinanceUI';
import { PnlTable } from '../PnlTable';

interface BalanceLine {
  account: string;
  kind: 'Asset' | 'Liability' | 'Income' | 'Expense';
  basis: string;
  side: 'debit' | 'credit';
  /** null when its source could not be loaded */
  amount: number | null;
}

/** "Trial balance" style summary derived from HPMS records, plus the period P&L */
export const LedgerSummary: React.FC<{ derived: FinanceDerived; labels: PeriodLabels }> = ({ derived, labels }) => {
  const asAt = `As at ${labels.today}`;
  const period = labels.current;
  const lines: BalanceLine[] = [
    { account: 'Accounts receivable (unpaid invoices)', kind: 'Asset', basis: asAt, side: 'debit', amount: derived.aging.total },
    { account: 'Inventory and equipment at cost', kind: 'Asset', basis: asAt, side: 'debit', amount: derived.inventory?.total ?? null },
    { account: 'Practice expenses', kind: 'Expense', basis: period, side: 'debit', amount: derived.expenses?.total ?? null },
    { account: 'Payroll (gross pay)', kind: 'Expense', basis: period, side: 'debit', amount: derived.payroll?.gross ?? null },
    { account: 'Revenue billed', kind: 'Income', basis: period, side: 'credit', amount: derived.revenue.billed },
    { account: 'Accounts payable (unpaid expenses)', kind: 'Liability', basis: asAt, side: 'credit', amount: derived.payables?.total ?? null }
  ];
  const complete = lines.every(line => line.amount !== null);
  const cents = (side: BalanceLine['side']) => lines.reduce((sum, line) => sum + (line.side === side ? Math.round((line.amount ?? 0) * 100) : 0), 0);
  const debit = cents('debit') / 100;
  const credit = cents('credit') / 100;
  const balancing = (cents('credit') - cents('debit')) / 100;

  const exportCsv = () => downloadCsv(
    exportFileName('derived trial balance'),
    toCsv(
      [{ header: 'Account', type: 'text' }, { header: 'Type', type: 'text' }, { header: 'Basis', type: 'text' }, { header: 'Debit', type: 'money' }, { header: 'Credit', type: 'money' }],
      [
        ...lines.map(line => [line.account, line.kind, line.basis, line.side === 'debit' ? line.amount : null, line.side === 'credit' ? line.amount : null]),
        ['Total of HPMS records', '', '', debit, credit]
      ]
    )
  );

  const cell = (line: BalanceLine, side: BalanceLine['side']) => {
    if (line.side !== side) return '';
    return line.amount === null ? <span className="text-gray-400">Unavailable</span> : formatNad(line.amount);
  };

  return (
    <div className="space-y-6">
      <SectionCard
        title="Trial balance (derived from HPMS records)"
        subtitle={`Income and costs for ${period}; balances as at ${labels.today}`}
        icon="solar:scale-bold-duotone"
        tone="violet"
        actions={<ActionButton icon="solar:download-minimalistic-bold-duotone" label="Export CSV" onClick={exportCsv} />}
      >
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th scope="col" className="px-4 py-3 text-left font-medium">Account</th>
                <th scope="col" className="px-4 py-3 text-left font-medium hidden md:table-cell">Type</th>
                <th scope="col" className="px-4 py-3 text-left font-medium hidden lg:table-cell">Basis</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Debit</th>
                <th scope="col" className="px-4 py-3 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white text-gray-700">
              {lines.map(line => (
                <tr key={line.account}>
                  <th scope="row" className="px-4 py-3 text-left font-medium text-gray-900">{line.account}</th>
                  <td className="px-4 py-3 hidden md:table-cell">{line.kind}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-xs text-gray-500">{line.basis}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{cell(line, 'debit')}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{cell(line, 'credit')}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 text-gray-900">
              <tr className="font-semibold border-t-2 border-gray-200">
                <th scope="row" className="px-4 py-3 text-left" colSpan={1}>Total of HPMS records</th>
                <td className="hidden md:table-cell" />
                <td className="hidden lg:table-cell" />
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{complete ? formatNad(debit) : 'Incomplete'}</td>
                <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">{complete ? formatNad(credit) : 'Incomplete'}</td>
              </tr>
              {complete && (
                <tr className="text-gray-500">
                  <th scope="row" className="px-4 py-3 text-left font-normal text-xs" colSpan={1}>
                    Balancing figure: cash and bank, VAT, depreciation, loans and owner's equity are not recorded in HPMS
                  </th>
                  <td className="hidden md:table-cell" />
                  <td className="hidden lg:table-cell" />
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-xs">{balancing > 0 ? formatNad(balancing) : ''}</td>
                  <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap text-xs">{balancing < 0 ? formatNad(-balancing) : ''}</td>
                </tr>
              )}
            </tfoot>
          </table>
        </div>
        <div className="mt-4">
          <Notice tone="warning" title="Derived view, not a double-entry ledger yet">
            These balances are calculated from invoices, practice expenses, payslips and inventory in HPMS. HPMS does not keep
            a chart of accounts or journals yet, so this will not balance like your accountant's trial balance and it does not
            replace it. Payments, part-payments and credit notes are not tracked as separate entries.
          </Notice>
        </div>
      </SectionCard>

      <SectionCard title="Profit and loss" subtitle={`${period} compared with ${labels.previous}`} icon="solar:calculator-bold-duotone" tone="violet">
        <PnlTable current={derived.summary} previous={derived.previousSummary} currentLabel={period} previousLabel={labels.previous} />
      </SectionCard>
    </div>
  );
};
