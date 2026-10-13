import React from 'react';
import { SECTION_COLORS } from '../../config/sectionColors';
import { PageTabs, type PageTab } from '../ui/PageTabs';

export type FinanceTab = 'overview' | 'invoicing' | 'quotes' | 'payments' | 'debtors' | 'ledgers' | 'reports' | 'batch-management' | 'remittances';

const FINANCE_TABS: readonly PageTab<FinanceTab>[] = [
  { key: 'overview', label: 'Overview', icon: 'solar:chart-square-bold-duotone' },
  { key: 'invoicing', label: 'Invoicing', icon: 'solar:document-text-bold-duotone' },
  { key: 'quotes', label: 'Quotes', icon: 'solar:bill-list-bold-duotone' },
  { key: 'payments', label: 'Payments', icon: 'solar:wallet-bold-duotone' },
  { key: 'debtors', label: 'Debtors', icon: 'solar:hand-money-bold-duotone' },
  { key: 'ledgers', label: 'Ledgers', icon: 'solar:notebook-bold-duotone' },
  { key: 'reports', label: 'Reports', icon: 'solar:graph-new-up-bold-duotone' },
  { key: 'batch-management', label: 'Batches', icon: 'solar:box-bold-duotone' },
  { key: 'remittances', label: 'Remittances', icon: 'solar:inbox-in-bold-duotone' }
];

/** Main tab bar, same pattern as the Patients and Communications pages; the selected tab in Finance's colour */
export const FinanceTabBar: React.FC<{ active: FinanceTab; onChange: (tab: FinanceTab) => void }> = ({ active, onChange }) => (
  <PageTabs
    tabs={FINANCE_TABS}
    active={active}
    onChange={onChange}
    label="Finance sections"
    activeClassName={SECTION_COLORS.finance.activeTab}
  />
);
