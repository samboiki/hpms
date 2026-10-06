import React from 'react';
import { PageTabs, type PageTab } from '../ui/PageTabs';

export type FinanceTab = 'overview' | 'invoicing' | 'payments' | 'ledgers' | 'reports' | 'batch-management';

const FINANCE_TABS: readonly PageTab<FinanceTab>[] = [
  { key: 'overview', label: 'Overview', icon: 'solar:chart-square-bold-duotone' },
  { key: 'invoicing', label: 'Invoicing', icon: 'solar:document-text-bold-duotone' },
  { key: 'payments', label: 'Payments', icon: 'solar:wallet-bold-duotone' },
  { key: 'ledgers', label: 'Ledgers', icon: 'solar:notebook-bold-duotone' },
  { key: 'reports', label: 'Reports', icon: 'solar:graph-new-up-bold-duotone' },
  { key: 'batch-management', label: 'Batches', icon: 'solar:box-bold-duotone' }
];

/** Main tab bar, same pattern as the Patients and Communications pages */
export const FinanceTabBar: React.FC<{ active: FinanceTab; onChange: (tab: FinanceTab) => void }> = ({ active, onChange }) => (
  <PageTabs
    tabs={FINANCE_TABS}
    active={active}
    onChange={onChange}
    label="Finance sections"
    activeClassName="bg-gradient-to-r from-cyan-500 to-cyan-600"
  />
);
