import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { format, isValid, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';
import { useSeesFinanceFigures } from '../../hooks/useScreenAccess';
import { invoiceLink } from '../billing/invoiceLinks';
import { formatNad, fromCents } from '../../utils/billing/money';
import InvoiceDetailsModal from '../modals/InvoiceDetailsModal';
import { ReceivePaymentDialog } from '../finance/receipts/ReceivePaymentDialog';
import { PatientStatementDialog } from '../finance/receipts/PatientStatementDialog';
import { PatientAccountPanel } from '../finance/debtors/PatientAccountPanel';
import PatientClaimRegisters from './registers/PatientClaimRegisters';
import PatientPlansPanel from '../billingExtras/PatientPlansPanel';
import PatientPayersRegister from './payers/PatientPayersRegister';
import PatientPriceRatePanel from './PatientPriceRatePanel';
import { useInvoicePayers } from './payers/useInvoicePayers';
import {
  formatNamibianDollars,
  isOutstandingInvoice,
  summarizePatientInvoices,
  toAmount,
  type PatientInvoice,
  type PatientInvoiceStatus
} from './patientBilling';
import type { PatientInvoicesResult } from './usePatientInvoices';

type InvoiceDetailsForModal = NonNullable<React.ComponentProps<typeof InvoiceDetailsModal>['invoice']>;

/** Visit fields shown next to an invoice (from the patient's already-loaded visits) */
export interface BillingVisitInfo {
  visit_date?: string | null;
  visit_time?: string | null;
  visit_number?: number | null;
  chief_complaint?: string | null;
}

interface InvoiceServiceRow {
  id: string;
  code?: string | null;
  description?: string | null;
  quantity?: number | string | null;
  unit_price?: number | string | null;
  total_price?: number | string | null;
  medical_aid_covered?: number | string | null;
  patient_portion?: number | string | null;
}

interface PatientBillingPanelProps {
  invoices: PatientInvoicesResult;
  visitsById: Map<string, BillingVisitInfo>;
  patient: { name: string; phone?: string | null; email?: string | null };
  medicalAidProvider?: string | null;
  onOpenVisit: (visitId: string) => void;
  /** When an account alert beside the patient's name was tapped (Date.now()): the account section comes into view */
  accountFocusKey?: number;
}

const STATUS_STYLES: Record<PatientInvoiceStatus, { label: string; className: string; icon: string }> = {
  paid: { label: 'Paid', className: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'solar:check-circle-bold-duotone' },
  pending: { label: 'Pending', className: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'solar:clock-circle-bold-duotone' },
  overdue: { label: 'Overdue', className: 'bg-red-50 text-red-700 border-red-200', icon: 'solar:danger-triangle-bold-duotone' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border-gray-200', icon: 'solar:close-circle-bold-duotone' }
};

const formatDate = (value?: string | null): string => {
  if (!value) return '-';
  const date = parseISO(value);
  return isValid(date) ? format(date, 'd MMM yyyy') : '-';
};

const toServiceLine = (service: InvoiceServiceRow): InvoiceDetailsForModal['services'][number] => ({
  id: service.id,
  code: service.code?.trim() || '-',
  description: service.description?.trim() || 'Service',
  quantity: toAmount(service.quantity),
  unit_price: toAmount(service.unit_price),
  total_price: toAmount(service.total_price),
  medical_aid_covered: toAmount(service.medical_aid_covered),
  patient_portion: toAmount(service.patient_portion)
});

const SummaryCard: React.FC<{ label: string; value: string; detail?: React.ReactNode; tone?: 'neutral' | 'due' | 'clear' }> = ({
  label,
  value,
  detail,
  tone = 'neutral'
}) => {
  const toneClass =
    tone === 'due' ? 'bg-amber-50 border-amber-200' : tone === 'clear' ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-gray-200';
  return (
    <div className={`rounded-xl border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
        {value}
      </p>
      {detail && <div className="mt-1 text-sm text-gray-600">{detail}</div>}
    </div>
  );
};

/**
 * Patient account: balance due, then every invoice (number, date, visit, total, medical aid and
 * patient share, status) with a read-only details view. Once receipts are in use, Receive payment
 * records money (part payments, overpayments as credit) and Statement shows the running balance.
 * Other writes (status, delete, email) stay in the existing invoice management table.
 */
const PatientBillingPanel: React.FC<PatientBillingPanelProps> = ({
  invoices: invoicesState,
  visitsById,
  patient,
  medicalAidProvider,
  onOpenVisit,
  accountFocusKey = 0
}) => {
  const { invoices, summary: wholeSummary, isLoading, hasLoaded, error, reload, money } = invoicesState;
  // Invoices a company or fund account pays (parity A14, A19) are marked and are not the patient's to pay
  const invoicePayers = useInvoicePayers(invoicesState.practiceId, invoices);
  const billedToAccounts = invoices.some(invoice => invoicePayers[invoice.id]);
  const summary = billedToAccounts
    ? summarizePatientInvoices(invoices.filter(invoice => !invoicePayers[invoice.id]), invoicesState.ledgerState === 'ready' ? invoicesState.ledgerBalances : undefined)
    : wholeSummary;
  const accountsOwe = Math.max(wholeSummary.balanceDue - summary.balanceDue, 0);
  const hasCredit = !!money && money.creditCents > 0;
  const [openingInvoiceId, setOpeningInvoiceId] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [details, setDetails] = useState<InvoiceDetailsForModal | null>(null);
  const [accountDialog, setAccountDialog] = useState<'pay' | 'statement' | null>(null);
  const user = useAuthStore(state => state.user);
  // The invoice in Finance (payments, credit notes, its claim batch and quote) for staff the practice lets into Finance
  const seesFinance = useSeesFinanceFigures();
  // Receipts (part payments, statements) need the receipts tables and a practice
  const canUseReceipts = invoicesState.ledgerState === 'ready' && !!invoicesState.practiceId && !!invoicesState.patientId;
  const practiceName = user?.practices?.name || 'HPMS practice';
  const navigate = useNavigate();

  const openDetails = async (invoice: PatientInvoice) => {
    if (openingInvoiceId) return;
    setOpeningInvoiceId(invoice.id);
    setDetailsError(null);
    try {
      const { data, error: servicesError } = await supabase
        .from('invoice_services')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });
      if (servicesError) throw servicesError;

      const visit = invoice.visitId ? visitsById.get(invoice.visitId) : undefined;
      setDetails({
        id: invoice.id,
        invoice_number: invoice.invoiceNumber ?? 'Not numbered',
        visit_date: visit?.visit_date ?? invoice.date ?? undefined,
        visit_time: visit?.visit_time?.slice(0, 5) ?? undefined,
        patient_name: patient.name,
        patient_phone: patient.phone ?? undefined,
        patient_email: patient.email ?? undefined,
        medical_aid_provider: medicalAidProvider ?? undefined,
        // The modal colours paid/pending/overdue; a cancelled invoice still shows its own label
        payment_status: invoice.status as InvoiceDetailsForModal['payment_status'],
        payment_method: invoice.paymentMethod ?? undefined,
        total: invoice.total,
        medical_aid_covered: invoice.medicalAidPortion,
        patient_portion: invoice.patientPortion,
        services: ((data ?? []) as unknown as InvoiceServiceRow[]).map(toServiceLine),
        chief_complaint: visit?.chief_complaint ?? undefined,
        created_at: invoice.createdAt ?? invoice.date ?? new Date().toISOString()
      });
    } catch (loadError) {
      console.error('[PatientBillingPanel] Failed to load invoice services:', loadError);
      setDetailsError(
        `${invoice.invoiceNumber ? `Could not open invoice #${invoice.invoiceNumber}.` : 'Could not open this invoice.'} Please try again.`
      );
    } finally {
      setOpeningInvoiceId(null);
    }
  };

  // A statement line's invoice: in Finance (its payments and credit notes) for staff who open Finance, else its details here
  const openStatementInvoice = (invoiceId: string) => {
    if (seesFinance) {
      navigate(invoiceLink(invoiceId));
      return;
    }
    const invoice = invoices.find(item => item.id === invoiceId);
    if (!invoice) return;
    setAccountDialog(null);
    void openDetails(invoice);
  };

  const isFirstLoad = isLoading && !hasLoaded;

  return (
    <div className="space-y-6">
      {/* Account summary */}
      {isFirstLoad ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="status" aria-label="Loading account summary">
          {[0, 1, 2].map((index) => (
            <div key={index} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4 motion-reduce:animate-none">
              <div className="h-3 w-24 rounded bg-gray-200" />
              <div className="mt-3 h-7 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : hasLoaded ? (
        <div className={`grid grid-cols-1 gap-4 ${hasCredit ? 'md:grid-cols-2 xl:grid-cols-4' : 'md:grid-cols-3'}`}>
          <SummaryCard
            label="Balance due"
            value={formatNamibianDollars(summary.balanceDue)}
            tone={summary.balanceDue > 0 ? 'due' : 'clear'}
            detail={
              summary.balanceDue > 0 ? (
                <>
                  <span className="block">
                    Medical aid {formatNamibianDollars(summary.balanceDueMedicalAid)} · Patient{' '}
                    {formatNamibianDollars(summary.balanceDuePatient)}
                  </span>
                  <span className="block text-xs text-gray-500">
                    {summary.outstandingCount} unpaid {summary.outstandingCount === 1 ? 'invoice' : 'invoices'}
                    {summary.overdueCount > 0 && `, ${summary.overdueCount} overdue`}
                  </span>
                  {accountsOwe > 0 && (
                    <span className="block text-xs text-gray-500">Not counted: {formatNamibianDollars(accountsOwe)} billed to company accounts</span>
                  )}
                </>
              ) : accountsOwe > 0 ? (
                `Nothing owed by the patient; ${formatNamibianDollars(accountsOwe)} is billed to company accounts`
              ) : (
                'Nothing owed'
              )
            }
          />
          <SummaryCard
            label="Total billed"
            value={formatNamibianDollars(summary.totalBilled)}
            detail={`${summary.invoiceCount} ${summary.invoiceCount === 1 ? 'invoice' : 'invoices'}`}
          />
          <SummaryCard
            label="Paid"
            value={formatNamibianDollars(summary.totalPaid)}
            detail={money?.lastPayment ? `Last payment ${formatNad(fromCents(money.lastPayment.amountCents))} on ${formatDate(money.lastPayment.receivedOn)}` : undefined}
          />
          {hasCredit && money && (
            <SummaryCard
              label="Credit"
              value={formatNad(fromCents(money.creditCents))}
              detail={
                seesFinance ? (
                  <>
                    Paid in but not yet used on an invoice. Allocate or refund it in{' '}
                    <Link to="/finance?tab=payments" className="font-medium text-cyan-700 hover:underline">
                      Finance &gt; Payments
                    </Link>
                    .
                  </>
                ) : (
                  'Paid in but not yet used on an invoice. Allocate or refund it in Finance > Payments.'
                )
              }
            />
          )}
        </div>
      ) : null}

      {/* Account: flags, family (who pays), promises and notes */}
      {canUseReceipts && invoicesState.practiceId && invoicesState.patientId && (
        <PatientAccountPanel practiceId={invoicesState.practiceId} patientId={invoicesState.patientId} patientName={patient.name} focusKey={accountFocusKey} />
      )}

      {/* Invoice list */}
      <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <header className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-50 text-cyan-700">
              <Icon icon="solar:bill-list-bold-duotone" className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">Invoices</h3>
              <p className="text-xs text-gray-500">This practice only. Click an invoice to see its services.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAccountDialog('pay')}
              disabled={!canUseReceipts}
              title={canUseReceipts ? 'Record money received and allocate it to invoices' : 'Receipts are not set up yet: mark invoices paid under Manage invoices'}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg text-white bg-gradient-to-r from-cyan-500 to-cyan-600 shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon="solar:hand-money-bold-duotone" className="w-4 h-4" aria-hidden="true" />
              Receive payment
            </button>
            <button
              type="button"
              onClick={() => setAccountDialog('statement')}
              disabled={!canUseReceipts}
              title={canUseReceipts ? 'Invoices, payments and adjustments with a running balance' : 'Receipts are not set up yet'}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon icon="solar:bill-list-bold-duotone" className="w-4 h-4" aria-hidden="true" />
              Statement
            </button>
            <button
              type="button"
              onClick={reload}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Icon
                icon="solar:refresh-bold-duotone"
                className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </header>
        {hasLoaded && invoicesState.ledgerState === 'not_set_up' && (
          <p className="mx-4 mt-3 text-xs text-gray-500">
            Receipts are not set up in this database yet, so part payments cannot be recorded: mark invoices paid under Manage invoices below.
          </p>
        )}

        {error && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert">
            <span className="flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
              {hasLoaded ? `${error} Showing the last loaded list.` : error}
            </span>
            <button type="button" onClick={reload} disabled={isLoading} className="font-medium underline hover:text-red-800 disabled:opacity-50">
              Retry
            </button>
          </div>
        )}

        {detailsError && (
          <div className="mx-4 mt-4 flex items-center justify-between gap-3 p-3 rounded-lg bg-red-50 text-sm text-red-700" role="alert">
            <span className="flex items-center gap-2">
              <Icon icon="solar:danger-triangle-bold-duotone" className="w-4 h-4" aria-hidden="true" />
              {detailsError}
            </span>
            <button type="button" onClick={() => setDetailsError(null)} className="font-medium underline hover:text-red-800">
              Dismiss
            </button>
          </div>
        )}

        <div className="p-4">
          {isFirstLoad ? (
            <div className="space-y-2" role="status" aria-label="Loading invoices">
              {[0, 1, 2].map((index) => (
                <div key={index} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
              ))}
            </div>
          ) : !hasLoaded ? null : invoices.length === 0 ? (
            <div className="py-8 text-center">
              <Icon icon="solar:bill-cross-bold-duotone" className="w-10 h-10 text-gray-300 mx-auto mb-2" aria-hidden="true" />
              <p className="text-sm text-gray-500">No invoices for this patient at this practice yet.</p>
              <p className="mt-1 text-xs text-gray-400">Invoices are created in the Billing tab of a visit.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {['Invoice', 'Date', 'Visit', 'Total', 'Medical aid', 'Patient', 'Status', ''].map((heading, index) => (
                      <th
                        key={heading || `col-${index}`}
                        scope="col"
                        className={`px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap ${
                          ['Total', 'Medical aid', 'Patient'].includes(heading) ? 'text-right' : 'text-left'
                        }`}
                      >
                        {heading || <span className="sr-only">Actions</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {invoices.map((invoice) => {
                    const visit = invoice.visitId ? visitsById.get(invoice.visitId) : undefined;
                    const status = STATUS_STYLES[invoice.status];
                    const isOpening = openingInvoiceId === invoice.id;
                    const isVoid = invoice.status === 'cancelled';
                    return (
                      <tr
                        key={invoice.id}
                        onClick={() => void openDetails(invoice)}
                        className={`cursor-pointer hover:bg-cyan-50/40 transition-colors ${isVoid ? 'text-gray-400' : ''}`}
                      >
                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-900">
                          {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : 'Not numbered'}
                          {invoicePayers[invoice.id] && (
                            <span className="block text-xs font-normal text-gray-500">Billed to {invoicePayers[invoice.id].name}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="text-gray-900">{formatDate(invoice.date)}</span>
                          {isOutstandingInvoice(invoice.status) && invoice.dueDate && (
                            <span className="block text-xs text-gray-500">Due {formatDate(invoice.dueDate)}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {invoice.visitId ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onOpenVisit(invoice.visitId as string);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-gray-100 hover:bg-gray-200 text-gray-700"
                              title="Open this visit"
                            >
                              <Icon icon="solar:stethoscope-bold-duotone" className="w-3.5 h-3.5" aria-hidden="true" />
                              {visit?.visit_number ? `Visit #${visit.visit_number}` : 'Open visit'}
                              {visit?.visit_date && <span className="text-gray-500">· {formatDate(visit.visit_date)}</span>}
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className={`px-3 py-2 whitespace-nowrap text-right font-semibold ${isVoid ? 'line-through' : 'text-gray-900'}`}>
                          {formatNamibianDollars(invoice.total)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-700">
                          {formatNamibianDollars(invoice.medicalAidPortion)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-700">
                          {formatNamibianDollars(invoice.patientPortion)}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          {invoice.partPaid ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium bg-amber-50 text-amber-800 border-amber-200">
                              <Icon icon="solar:wallet-money-bold-duotone" className="w-3.5 h-3.5" aria-hidden="true" />
                              Part paid
                            </span>
                          ) : (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${status.className}`}>
                              <Icon icon={status.icon} className="w-3.5 h-3.5" aria-hidden="true" />
                              {status.label}
                            </span>
                          )}
                          {(() => {
                            // What is still owed once receipts are in use (part payments, credit notes)
                            const balance = invoicesState.ledgerBalances[invoice.id];
                            if (!balance?.hasEntries || isVoid) return null;
                            const owed = Math.max(balance.outstandingMedicalAid, 0) + Math.max(balance.outstandingPatient, 0);
                            return owed > 0 ? <span className="block text-xs text-gray-500 mt-0.5">{formatNamibianDollars(owed)} owed</span> : null;
                          })()}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openDetails(invoice);
                            }}
                            disabled={!!openingInvoiceId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-cyan-700 hover:bg-cyan-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <Icon
                              icon={isOpening ? 'solar:refresh-bold-duotone' : 'solar:document-text-bold-duotone'}
                              className={`w-4 h-4 ${isOpening ? 'animate-spin' : ''}`}
                              aria-hidden="true"
                            />
                            {isOpening ? 'Opening...' : 'Details'}
                          </button>
                          {seesFinance && (
                            <Link
                              to={invoiceLink(invoice.id)}
                              onClick={(event) => event.stopPropagation()}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-cyan-700 hover:bg-cyan-50 font-medium"
                              title="This invoice in Finance: its payments, credit notes, claim batch and quote"
                              aria-label={`Open ${invoice.invoiceNumber ? `invoice ${invoice.invoiceNumber}` : 'this invoice'} in Finance`}
                            >
                              <Icon icon="solar:wallet-money-bold-duotone" className="w-4 h-4" aria-hidden="true" />
                              Finance
                            </Link>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* Payment plans and prepaid packages (parity D16, D17): opening the tab posts the instalments that are due */}
      {invoicesState.practiceId && invoicesState.patientId && (
        <PatientPlansPanel practiceId={invoicesState.practiceId} patientId={invoicesState.patientId} patientName={patient.name} onInvoicesChanged={reload} />
      )}

      {/* Referral letters and the medical aid's authorisations: the claims carry them (parity C10, D15) */}
      {invoicesState.practiceId && invoicesState.patientId && (
        <PatientClaimRegisters practiceId={invoicesState.practiceId} patientId={invoicesState.patientId} />
      )}

      {/* Injury on duty and road accident cases, and the companies that pay (parity A14, A19) */}
      {invoicesState.practiceId && invoicesState.patientId && (
        <PatientPayersRegister practiceId={invoicesState.practiceId} patientId={invoicesState.patientId} onInvoicesChanged={reload} />
      )}

      {/* The patient's price rate: private, staff or contract, on the usual prices (parity R28) */}
      {invoicesState.practiceId && invoicesState.patientId && (
        <PatientPriceRatePanel practiceId={invoicesState.practiceId} patientId={invoicesState.patientId} />
      )}

      <InvoiceDetailsModal isOpen={!!details} onClose={() => setDetails(null)} invoice={details} />

      {accountDialog === 'pay' && canUseReceipts && invoicesState.practiceId && invoicesState.patientId && (
        <ReceivePaymentDialog
          practiceId={invoicesState.practiceId}
          practiceName={practiceName}
          staffName={user?.name ?? null}
          initialPayer="patient"
          initialPatient={{ id: invoicesState.patientId, name: patient.name }}
          onClose={() => setAccountDialog(null)}
          onSaved={reload}
        />
      )}
      {accountDialog === 'statement' && canUseReceipts && invoicesState.practiceId && invoicesState.patientId && (
        <PatientStatementDialog
          practiceId={invoicesState.practiceId}
          practiceName={practiceName}
          patientId={invoicesState.patientId}
          patientName={patient.name}
          onClose={() => setAccountDialog(null)}
          onOpenInvoice={openStatementInvoice}
          onChanged={reload}
        />
      )}
    </div>
  );
};

export default PatientBillingPanel;
