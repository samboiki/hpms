import React from 'react';
import type { AgingBucket, LedgerInvoice } from '../../services/ledgerService';
import type { FinanceDerived } from './deriveFinance';
import type { FinanceWorkspace } from './financeData';
import type { LedgerView, PeriodLabels } from './financeNav';
import { SectionCard, SegmentedTabs, type SegmentOption } from './FinanceUI';
import { LedgerSummary } from './ledgers/LedgerSummary';
import { ReceivablesLedger } from './ledgers/ReceivablesLedger';
import { RevenueLedger } from './ledgers/RevenueLedger';
import { CollectionsLedger } from './ledgers/CollectionsLedger';
import { PayrollLedger } from './ledgers/PayrollLedger';
import { ExpensesLedger } from './ledgers/ExpensesLedger';
import { InventoryLedger } from './ledgers/InventoryLedger';

const LEDGER_OPTIONS: SegmentOption<LedgerView>[] = [
  { value: 'summary', label: 'Summary', icon: 'solar:scale-bold-duotone' },
  { value: 'receivables', label: 'Receivables', icon: 'solar:clock-circle-bold-duotone' },
  { value: 'revenue', label: 'Revenue', icon: 'solar:graph-up-bold-duotone' },
  { value: 'collections', label: 'Collections', icon: 'solar:hand-money-bold-duotone' },
  { value: 'payroll', label: 'Payroll', icon: 'solar:users-group-two-rounded-bold-duotone' },
  { value: 'expenses', label: 'Expenses', icon: 'solar:card-transfer-bold-duotone' },
  { value: 'inventory', label: 'Inventory & assets', icon: 'solar:box-bold-duotone' }
];

interface LedgersTabProps {
  view: LedgerView;
  onViewChange: (view: LedgerView) => void;
  agingBucket: AgingBucket | null;
  derived: FinanceDerived;
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
  onOpenInvoice: (invoice: LedgerInvoice) => void;
  onRetry: () => void;
}

/** Read-only ledgers derived from HPMS records, each with drill-down lists and CSV export */
export const LedgersTab: React.FC<LedgersTabProps> = ({ view, onViewChange, agingBucket, derived, workspace, labels, onOpenInvoice, onRetry }) => (
  <div className="space-y-6">
    <SectionCard
      title="Ledgers"
      subtitle="Read-only books built from invoices, payslips, practice expenses and inventory"
      icon="solar:notebook-bold-duotone"
      bodyClassName="pt-4"
    >
      <SegmentedTabs value={view} onChange={onViewChange} options={LEDGER_OPTIONS} ariaLabel="Ledger" />
    </SectionCard>

    {view === 'summary' && <LedgerSummary derived={derived} labels={labels} />}
    {view === 'receivables' && (
      <ReceivablesLedger key={agingBucket ?? 'all'} derived={derived} workspace={workspace} labels={labels} initialBucket={agingBucket} onOpenInvoice={onOpenInvoice} />
    )}
    {view === 'revenue' && <RevenueLedger derived={derived} workspace={workspace} labels={labels} />}
    {view === 'collections' && <CollectionsLedger derived={derived} labels={labels} />}
    {view === 'payroll' && <PayrollLedger derived={derived} workspace={workspace} labels={labels} onRetry={onRetry} />}
    {view === 'expenses' && <ExpensesLedger derived={derived} workspace={workspace} labels={labels} onRetry={onRetry} />}
    {view === 'inventory' && <InventoryLedger derived={derived} workspace={workspace} labels={labels} onRetry={onRetry} />}
  </div>
);
