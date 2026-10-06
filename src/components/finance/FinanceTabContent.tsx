import React, { useState } from 'react';
import { motion } from 'framer-motion';
import type { AgingBucket, LedgerInvoice } from '../../services/ledgerService';
import type { FinanceTab } from './FinanceTabBar';
import type { FinancePageState } from './useFinancePage';
import type { LedgerView, NavigateFn } from './financeNav';
import { EmptyState, ErrorState, LoadingState } from './FinanceUI';
import { OverviewTab } from './OverviewTab';
import { InvoicingTab } from './InvoicingTab';
import { PaymentsTab } from './PaymentsTab';
import { LedgersTab } from './LedgersTab';
import { ReportsTab } from './ReportsTab';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface FinanceTabContentProps {
  tab: Exclude<FinanceTab, 'batch-management'>;
  page: FinancePageState;
  practiceName: string;
  onTabChange: (tab: FinanceTab) => void;
}

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">{children}</div>
);

/** The Overview, Invoicing, Payments, Ledgers and Reports tabs, with shared loading/error states and invoice drill-down */
export const FinanceTabContent: React.FC<FinanceTabContentProps> = ({ tab, page, practiceName, onTabChange }) => {
  const [ledgerView, setLedgerView] = useState<LedgerView>('summary');
  const [agingBucket, setAgingBucket] = useState<AgingBucket | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<LedgerInvoice | null>(null);
  const { workspace, derived, labels } = page;

  const navigate: NavigateFn = target => {
    if (target.ledger) setLedgerView(target.ledger);
    setAgingBucket(target.agingBucket ?? null);
    onTabChange(target.tab);
  };

  if (!page.practiceId) {
    return <Panel><EmptyState icon="solar:buildings-2-bold-duotone" title="No practice selected" message="Choose a practice to see its finances." /></Panel>;
  }
  if (page.error) {
    return <Panel><ErrorState title="Could not load finance data" message={page.error} onRetry={page.refresh} /></Panel>;
  }
  if (!workspace || !derived) {
    return <Panel><LoadingState label="Loading finance data" rows={6} /></Panel>;
  }
  if (workspace.invoices.error) {
    return (
      <Panel>
        <ErrorState
          title="Invoices could not be loaded"
          message={`${workspace.invoices.error}. No finance figures are shown until invoices load, so nothing on this page is a guess.`}
          onRetry={page.refresh}
        />
      </Panel>
    );
  }

  const patientId = selectedInvoice?.patientId ?? null;
  const doctorId = selectedInvoice?.practitionerId ?? null;

  return (
    <>
      <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} aria-busy={page.loading}>
        {tab === 'overview' && <OverviewTab derived={derived} workspace={workspace} labels={labels} onNavigate={navigate} />}
        {tab === 'invoicing' && <InvoicingTab workspace={workspace} labels={labels} onOpenInvoice={setSelectedInvoice} />}
        {tab === 'payments' && <PaymentsTab workspace={workspace} derived={derived} labels={labels} onOpenInvoice={setSelectedInvoice} onNavigate={navigate} />}
        {tab === 'ledgers' && (
          <LedgersTab
            view={ledgerView}
            onViewChange={view => {
              setLedgerView(view);
              setAgingBucket(null);
            }}
            agingBucket={agingBucket}
            derived={derived}
            workspace={workspace}
            labels={labels}
            onOpenInvoice={setSelectedInvoice}
            onRetry={page.refresh}
          />
        )}
        {tab === 'reports' && <ReportsTab derived={derived} workspace={workspace} labels={labels} practiceName={practiceName} />}
      </motion.div>

      <InvoiceDetailModal
        invoice={selectedInvoice}
        patientName={(patientId && workspace.patientNames[patientId]) || 'Unknown patient'}
        doctorName={doctorId ? workspace.doctorNames[doctorId] ?? null : null}
        scheme={(patientId && workspace.schemeByPatient[patientId]) || null}
        todayKey={labels.todayKey}
        onClose={() => setSelectedInvoice(null)}
      />
    </>
  );
};
