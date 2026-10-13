import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { normalizeInvoice, type AgeAnalysisFilter, type AgingBucket, type LedgerInvoice, type RawInvoiceRow } from '../../services/ledgerService';
import type { FinanceTab } from './FinanceTabBar';
import type { FinancePageState } from './useFinancePage';
import { isDebtorsView, isLedgerView, type DebtorsView, type LedgerView, type NavigateFn, type PaymentsView } from './financeNav';
import { EmptyState, ErrorState, LoadingState } from './FinanceUI';
import { OverviewTab } from './OverviewTab';
import { InvoicingTab } from './InvoicingTab';
import { PaymentsTab } from './PaymentsTab';
import { DebtorsTab } from './debtors/DebtorsTab';
import { LedgersTab } from './LedgersTab';
import { ReportsTab } from './ReportsTab';
import { InvoiceDetailModal } from './InvoiceDetailModal';

interface FinanceTabContentProps {
  tab: Exclude<FinanceTab, 'batch-management'>;
  page: FinancePageState;
  practiceName: string;
  onTabChange: (tab: FinanceTab) => void;
}

/** One invoice of the practice by id, for a link to an invoice outside the period on screen; null when not found. */
async function loadLinkedInvoice(invoiceId: string, practiceId: string): Promise<LedgerInvoice | null> {
  const { data, error } = await supabase
    .from('invoices_enhanced')
    .select('id, invoice_number, patient_id, visit_id, practitioner_id, batch_id, issue_date, due_date, total, medical_aid_total, patient_total, payment_status, payment_method, updated_at, created_at')
    .eq('id', invoiceId)
    .eq('practice_id', practiceId)
    .maybeSingle();
  return error || !data ? null : normalizeInvoice(data as RawInvoiceRow);
}

const Panel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">{children}</div>
);

/** The Overview, Invoicing, Payments, Debtors, Ledgers and Reports tabs, with shared loading/error states and invoice drill-down */
export const FinanceTabContent: React.FC<FinanceTabContentProps> = ({ tab, page, practiceName, onTabChange }) => {
  const [ledgerView, setLedgerView] = useState<LedgerView>('summary');
  const [agingBucket, setAgingBucket] = useState<AgingBucket | null>(null);
  const [paymentsView, setPaymentsView] = useState<PaymentsView>('receipts');
  const [debtorsView, setDebtorsView] = useState<DebtorsView>('ages');
  const [linkedCompanyId, setLinkedCompanyId] = useState<string | null>(null);
  // Debtors > Age analysis opened on a grouping by a report card (the key opens it afresh each time)
  const [agePreset, setAgePreset] = useState<{ filter: Partial<AgeAnalysisFilter>; key: number } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<LedgerInvoice | null>(null);
  const { workspace, derived, labels } = page;

  // A link to one invoice (?invoice=<id>, from a visit, a claim line or a receipt) opens its details once loaded
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedInvoiceId = searchParams.get('invoice');
  useEffect(() => {
    if (!linkedInvoiceId || !workspace) return;
    let cancelled = false;
    const clearLink = () => {
      const next = new URLSearchParams(searchParams);
      next.delete('invoice');
      setSearchParams(next, { replace: true });
    };
    const loaded = workspace.invoices.rows.find(row => row.id === linkedInvoiceId);
    if (loaded) {
      setSelectedInvoice(loaded);
      clearLink();
      return;
    }
    // Older paid invoices are not in the period's rows: read that one invoice (RLS keeps it to the practice)
    loadLinkedInvoice(linkedInvoiceId, workspace.practiceId).then(invoice => {
      if (cancelled) return;
      if (invoice) setSelectedInvoice(invoice);
      // A link to an invoice that is not there (deleted, or another practice's) said nothing at all
      else toast.error('That invoice could not be found. It may have been deleted, or belong to another practice.');
      clearLink();
    });
    return () => {
      cancelled = true;
    };
  }, [linkedInvoiceId, workspace, searchParams, setSearchParams]);

  // A link to a part of Debtors or Ledgers opens it: ?view= (companies, credit, expenses, ...) and ?account=<id> for one
  // company or fund account (from the patient file); read once, like ?invoice=
  const linkedView = searchParams.get('view');
  const linkedAccount = searchParams.get('account');
  const linkedTab = searchParams.get('tab');
  useEffect(() => {
    if (!linkedView && !linkedAccount) return;
    // A link followed while Finance shows another tab: wait until the page has switched to the link's tab
    if (linkedTab && linkedTab !== tab) return;
    if (tab === 'ledgers' && isLedgerView(linkedView)) setLedgerView(linkedView);
    if (tab === 'debtors' && isDebtorsView(linkedView)) setDebtorsView(linkedView);
    if (tab === 'debtors' && linkedAccount) {
      setDebtorsView('companies');
      setLinkedCompanyId(linkedAccount);
    }
    const next = new URLSearchParams(searchParams);
    next.delete('view');
    next.delete('account');
    setSearchParams(next, { replace: true });
  }, [tab, linkedTab, linkedView, linkedAccount, searchParams, setSearchParams]);
  // The linked account (and a report card's age analysis grouping) opens once: coming back to Debtors later does not
  // open it again
  useEffect(() => {
    if (tab !== 'debtors') {
      setLinkedCompanyId(null);
      setAgePreset(null);
    }
  }, [tab]);

  const navigate: NavigateFn = target => {
    if (target.ledger) setLedgerView(target.ledger);
    if (target.paymentsView) setPaymentsView(target.paymentsView);
    if (target.debtorsView) setDebtorsView(target.debtorsView);
    if (target.ageFilter) setAgePreset({ filter: target.ageFilter, key: Date.now() });
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
        {tab === 'overview' && <OverviewTab derived={derived} workspace={workspace} labels={labels} onNavigate={navigate} onRefresh={page.refresh} />}
        {tab === 'invoicing' && <InvoicingTab workspace={workspace} labels={labels} onOpenInvoice={setSelectedInvoice} />}
        {tab === 'payments' && (
          <PaymentsTab
            workspace={workspace}
            derived={derived}
            labels={labels}
            onOpenInvoice={setSelectedInvoice}
            onNavigate={navigate}
            practiceName={practiceName}
            onRefresh={page.refresh}
            view={paymentsView}
            onViewChange={setPaymentsView}
          />
        )}
        {tab === 'debtors' && (
          <DebtorsTab
            workspace={workspace}
            derived={derived}
            labels={labels}
            practiceName={practiceName}
            onRefresh={page.refresh}
            view={debtorsView}
            onViewChange={setDebtorsView}
            linkedCompanyId={linkedCompanyId}
            agePreset={agePreset}
          />
        )}
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
        {tab === 'reports' && (
          <ReportsTab
            derived={derived}
            workspace={workspace}
            labels={labels}
            practiceName={practiceName}
            openReport={searchParams.get('report')}
            onNavigate={navigate}
            onChanged={page.refresh}
          />
        )}
      </motion.div>

      <InvoiceDetailModal
        invoice={selectedInvoice}
        patientName={(patientId && workspace.patientNames[patientId]) || 'Unknown patient'}
        doctorName={doctorId ? workspace.doctorNames[doctorId] ?? null : null}
        scheme={(patientId && workspace.schemeByPatient[patientId]) || null}
        todayKey={labels.todayKey}
        onClose={() => setSelectedInvoice(null)}
        ledger={{
          state: workspace.ar?.state ?? 'not_set_up',
          practiceId: workspace.practiceId,
          practiceName,
          patientNames: workspace.patientNames,
          onChanged: page.refresh
        }}
      />
    </>
  );
};
