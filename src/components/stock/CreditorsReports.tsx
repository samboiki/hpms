import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { EmptyState, ErrorState, FilterPill, LoadingState, MiniStat, SectionCard } from '../finance/FinanceUI';
import { downloadReportCsv, printReport, type ReportTable } from '../finance/financeExport';
import { ReportPreview } from '../finance/ReportPreview';
import { supplierLink } from '../billing/invoiceLinks';
import { todayKey } from '../../utils/billing/dates';
import { creditorsTransactionsTable, supplierAgeTable, vatOnPurchasesTable } from '../../utils/stock/creditorsReports';
import { ledgerEntries, supplierAgeAnalysis, vatOnPurchases } from '../../utils/stock/supplierLedger';
import type { StockContext } from './stockContext';
import { Field } from './stockParts';
import { INPUT, SECONDARY, STOCK_COLOR, nad } from './stockUi';
import { useSupplierLedger } from './useSupplierLedger';

type View = 'age' | 'transactions' | 'vat';

const VIEWS: ReadonlyArray<{ value: View; label: string; icon: string }> = [
  { value: 'age', label: 'Age analysis', icon: 'solar:hourglass-line-bold-duotone' },
  { value: 'transactions', label: 'Transactions', icon: 'solar:list-check-bold-duotone' },
  { value: 'vat', label: 'VAT on purchases', icon: 'solar:bill-list-bold-duotone' }
];

const SUBTITLES: Readonly<Record<View, string>> = {
  age: 'What is owed to each supplier, by the age of its invoices',
  transactions: 'Supplier invoices, credits for returns and payments in a period',
  vat: 'VAT on supplier invoices less VAT on stock returned, per month'
};

/**
 * R24: the creditors reports, from the supplier ledger (L12): the supplier age analysis (today), the transactions of a
 * period (one supplier or all) and VAT on purchases. Each shown, printed and exported as CSV.
 */
export const CreditorsReports: React.FC<{ context: StockContext }> = ({ context }) => {
  const navigate = useNavigate();
  const ledger = useSupplierLedger(context.practiceId);
  const ledgerData = ledger.status === 'ready' ? ledger.data : null;
  const today = todayKey();
  const [view, setView] = useState<View>('age');
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [supplierId, setSupplierId] = useState('');

  const nameOf = useMemo(() => {
    const names = new Map(context.suppliers.map(supplier => [supplier.id, supplier.name]));
    return (id: string) => names.get(id) ?? 'A supplier';
  }, [context.suppliers]);

  const analysis = useMemo(() => (ledgerData ? supplierAgeAnalysis(context.suppliers, ledgerData, today) : null), [ledgerData, context.suppliers, today]);

  const report = useMemo((): ReportTable | null => {
    if (!ledgerData || from > to) return null;
    if (view === 'age') return analysis ? supplierAgeTable(analysis, today) : null;
    if (view === 'transactions') {
      const terms = new Map(context.suppliers.map(supplier => [supplier.id, supplier.paymentTermsDays]));
      const entries = ledgerEntries(ledgerData, id => terms.get(id) ?? 30).filter(entry => !supplierId || entry.supplierId === supplierId);
      return creditorsTransactionsTable(entries, nameOf, from, to);
    }
    const vat = vatOnPurchases(ledgerData.deliveries, from, to);
    return vatOnPurchasesTable(vat.months, vat.total, from, to);
  }, [ledgerData, view, analysis, today, from, to, supplierId, context.suppliers, nameOf]);

  if (ledger.status === 'not_set_up') {
    return (
      <EmptyState
        icon="solar:shop-2-bold-duotone"
        title="The supplier ledger is not set up yet"
        message="Payments to suppliers and the creditors reports start once the stores and suppliers update is applied to the practice's database."
      />
    );
  }

  const print = () => {
    if (report && !printReport(report, context.practiceName)) toast.error('The print window was blocked. Allow pop-ups for this site and try again.');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Creditors report">
        {VIEWS.map(option => (
          <FilterPill key={option.value} active={view === option.value} onClick={() => setView(option.value)} icon={option.icon}>{option.label}</FilterPill>
        ))}
      </div>

      {view === 'age' && analysis && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MiniStat icon="solar:wallet-money-bold-duotone" label="Owed to suppliers" value={nad(analysis.totals.owedCents)} tone={STOCK_COLOR.tone} />
          <MiniStat icon="solar:danger-triangle-bold-duotone" label="Overdue" value={nad(analysis.totals.overdueCents)} tone="red" />
          <MiniStat icon="solar:card-recive-bold-duotone" label="Credit not used yet" value={nad(analysis.totals.creditCents)} tone="green" />
          <MiniStat icon="solar:bill-list-bold-duotone" label="Unpaid invoices" value={String(analysis.totals.openInvoices)} tone="amber" />
        </div>
      )}

      <SectionCard
        title={VIEWS.find(option => option.value === view)?.label ?? ''}
        subtitle={report ? report.basis : SUBTITLES[view]}
        icon={VIEWS.find(option => option.value === view)?.icon ?? 'solar:shop-2-bold-duotone'}
        tone={STOCK_COLOR.tone}
        actions={
          <div className="flex gap-2">
            <button type="button" disabled={!report} onClick={print} className={SECONDARY}>
              <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Print
            </button>
            <button type="button" disabled={!report} onClick={() => report && downloadReportCsv(report)} className={SECONDARY}>
              <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
          </div>
        }
      >
        {view !== 'age' && (
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {view === 'transactions' && (
              <Field label="Supplier">
                {props => (
                  <select {...props} value={supplierId} onChange={event => setSupplierId(event.target.value)} className={INPUT}>
                    <option value="">All suppliers</option>
                    {context.suppliers.map(supplier => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                  </select>
                )}
              </Field>
            )}
            <Field label="From">
              {props => <input {...props} type="date" value={from} max={to} onChange={event => setFrom(event.target.value)} className={INPUT} />}
            </Field>
            <Field label="To">
              {props => <input {...props} type="date" value={to} min={from} max={today} onChange={event => setTo(event.target.value)} className={INPUT} />}
            </Field>
          </div>
        )}
        {ledger.status === 'error' ? (
          <ErrorState title="The supplier ledger could not be loaded" message={ledger.message} onRetry={ledger.reload} />
        ) : ledger.status === 'loading' ? (
          <LoadingState label="Loading the supplier ledger" rows={4} />
        ) : report ? (
          <ReportPreview
            report={report}
            resetKey={`${view}:${from}:${to}:${supplierId}`}
            empty={
              view === 'age'
                ? { title: 'Nothing is owed to suppliers', hint: 'Supplier invoices (deliveries received on account, consignment frames sold) appear here until they are paid.' }
                : view === 'transactions'
                  ? { title: 'Nothing in this period', hint: 'Supplier invoices, credits for returns and payments dated in the period appear here.' }
                  : { title: 'No VAT in this period', hint: 'The VAT typed from supplier invoices and credit notes on Stock > Deliveries appears here.' }
            }
            onRowClick={view === 'age' && analysis ? index => {
              const row = analysis.rows[index];
              if (row) navigate(supplierLink(row.supplierId));
            } : undefined}
            rowLabel={view === 'age' && analysis ? index => `Open ${analysis.rows[index]?.name ?? 'the supplier'}` : undefined}
          />
        ) : (
          <p className="text-sm text-gray-500">Choose a period that starts before it ends.</p>
        )}
      </SectionCard>
    </div>
  );
};

export default CreditorsReports;
