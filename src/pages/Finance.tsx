import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { FinanceHeader } from '../components/finance/FinanceHeader';
import { FinanceTabBar, type FinanceTab } from '../components/finance/FinanceTabBar';
import { FinanceTabContent } from '../components/finance/FinanceTabContent';
import { useFinancePage } from '../components/finance/useFinancePage';
import ClaimsBatches from '../components/finance/claims/ClaimsBatches';
import { QuotesTab } from '../components/quotes/QuotePanels';
import { RemittancesTab } from '../components/finance/remittances/RemittancesTab';
import { useSearchParams } from 'react-router-dom';

const FINANCE_TABS: readonly FinanceTab[] = ['overview', 'invoicing', 'quotes', 'payments', 'debtors', 'ledgers', 'reports', 'batch-management', 'remittances'];

const Finance: React.FC = () => {
  const { user, selectedPracticeId } = useAuthStore();

  // Links such as /finance?tab=batch-management open that tab directly
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as FinanceTab | null;
  const [activeTab, setActiveTab] = useState<FinanceTab>(
    requestedTab && FINANCE_TABS.includes(requestedTab) ? requestedTab : 'overview'
  );
  // A link followed while Finance is already open (a claim line's invoice, an invoice's batch) switches the tab too
  useEffect(() => {
    if (requestedTab && FINANCE_TABS.includes(requestedTab)) setActiveTab(requestedTab);
  }, [requestedTab, searchParams]);
  // A tab chosen on the page is written to the address (dropping the last link's invoice, batch or filter): an older
  // ?tab= left there took the page back to that tab whenever a report row opened an invoice, and Back from a patient
  // file opened from Finance returns to the tab staff were on
  const changeTab = (tab: FinanceTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };
  // Every finance figure is scoped to the selected practice (super admins) or the user's own
  const financePracticeId = selectedPracticeId || user?.practice_id || null;
  const financePage = useFinancePage(financePracticeId);
  const practiceName = (financePracticeId && financePracticeId === user?.practice_id && user?.practices?.name) || 'HPMS practice';

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 xl:px-8 py-4 md:py-6 space-y-4 md:space-y-6">
        <FinanceHeader
          period={financePage.period}
          ranges={financePage.labels.ranges}
          onPeriodChange={financePage.setPeriod}
          showPeriod={activeTab !== 'batch-management' && activeTab !== 'quotes' && activeTab !== 'remittances'}
          loadedAt={financePage.workspace?.loadedAt ?? null}
          refreshing={financePage.loading}
          onRefresh={financePage.refresh}
        />

        <FinanceTabBar active={activeTab} onChange={changeTab} />

        {activeTab === 'batch-management' ? (
          <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
            <div className="p-6">
              <motion.div
                key="batch-management"
                variants={tabVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
              >
                <ClaimsBatches practiceId={financePracticeId || ''} finance={financePage.workspace && financePage.derived ? { workspace: financePage.workspace, derived: financePage.derived, todayKey: financePage.labels.todayKey } : null} onChanged={financePage.refresh} />
              </motion.div>
            </div>
          </div>
        ) : activeTab === 'quotes' ? (
          // Quotes do not depend on the period or the finance workspace: they load on their own. A quote made into an
          // invoice (and every save on the remittance and batch tabs) reloads the figures of the other tabs
          <QuotesTab practiceId={financePracticeId} onChanged={financePage.refresh} />
        ) : activeTab === 'remittances' ? (
          // Remittances load on their own (claims, receipts and the remittance tables)
          <RemittancesTab practiceId={financePracticeId} practiceName={practiceName} onChanged={financePage.refresh} />
        ) : (
          <FinanceTabContent tab={activeTab} page={financePage} practiceName={practiceName} onTabChange={changeTab} />
        )}
      </div>
    </div>
  );
};

export default Finance;