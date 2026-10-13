import React, { useCallback, useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { formatNad } from '../../utils/billing/money';
import { isOutstandingInvoice, summarizePatientInvoices, type PatientInvoiceStatus } from '../../components/patients/patientBilling';
import { usePortal, usePortalLoad } from '../portalContext';
import { formatDay, type LinkedPatient, type StatusTone } from '../portalModel';
import { loadInvoiceLines, loadInvoices, type PortalInvoice, type PortalLoad } from '../portalService';
import { Card, DetailRow, EmptyBlock, ErrorBlock, LoadingBlock, NotEnabledBlock, PageTitle, SectionTitle, StatusPill } from '../components/PortalUi';

const STATUS: Record<PatientInvoiceStatus, { label: string; tone: StatusTone }> = {
  paid: { label: 'Paid', tone: 'green' },
  pending: { label: 'To pay', tone: 'amber' },
  overdue: { label: 'Overdue', tone: 'red' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
};

const copy = async (value: string, what: string) => {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${what} copied`);
  } catch {
    toast.error('Could not copy. Please write it down.');
  }
};

const CopyButton: React.FC<{ value: string; what: string }> = ({ value, what }) => (
  <button type="button" onClick={() => void copy(value, what)} className="ml-2 text-cyan-700" aria-label={`Copy ${what.toLowerCase()}`}>
    <Icon icon="solar:copy-bold-duotone" className="inline w-4 h-4" aria-hidden="true" />
  </button>
);

/**
 * How to pay: the practice's bank details (only when the invoice is from the patient's own practice, whose
 * details we have) and the invoice number as the payment reference.
 */
const PayCard: React.FC<{ patient: LinkedPatient; invoice?: PortalInvoice }> = ({ patient, invoice }) => {
  const samePractice = !invoice || !invoice.practiceId || invoice.practiceId === patient.practiceId;
  const bank = samePractice ? patient.bank : null;
  const practiceName = invoice?.practiceName ?? patient.practiceName ?? 'the practice';
  return (
    <Card className="space-y-2">
      <div className="flex items-center gap-2">
        <Icon icon="solar:card-transfer-bold-duotone" className="w-5 h-5 text-cyan-700" aria-hidden="true" />
        <h2 className="font-semibold text-gray-900">How to pay</h2>
      </div>
      {bank ? (
        <>
          <DetailRow label="Bank" value={bank.bankName} />
          {bank.accountHolder && <DetailRow label="Account name" value={bank.accountHolder} />}
          <DetailRow label="Account number" value={<>{bank.accountNumber}<CopyButton value={bank.accountNumber} what="Account number" /></>} />
          {bank.accountType && <DetailRow label="Account type" value={bank.accountType} />}
          {bank.branchCode && <DetailRow label="Branch code" value={bank.branchCode} />}
          {invoice?.invoiceNumber ? (
            <DetailRow
              label="Payment reference"
              value={<>{invoice.invoiceNumber}<CopyButton value={invoice.invoiceNumber} what="Reference" /></>}
            />
          ) : (
            <p className="text-sm text-gray-600">Use the invoice number as the payment reference.</p>
          )}
        </>
      ) : (
        <p className="text-sm text-gray-600">Please ask {practiceName} how to pay. You can also pay at reception.</p>
      )}
    </Card>
  );
};

const InvoiceRow: React.FC<{ invoice: PortalInvoice }> = ({ invoice }) => {
  const status = STATUS[invoice.status];
  return (
    <Link to={`/me/invoices/${invoice.id}`} className="block">
      <Card className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">{invoice.invoiceNumber ?? 'Invoice'}</p>
          <p className="text-sm text-gray-500">
            {formatDay(invoice.date) ?? ''}
            {invoice.practiceName ? ` - ${invoice.practiceName}` : ''}
          </p>
        </div>
        <div className="text-right flex-shrink-0 space-y-1">
          <p className="font-semibold text-gray-900">{formatNad(invoice.patientPortion)}</p>
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
        </div>
      </Card>
    </Link>
  );
};

const useInvoices = (patientId: string | null) => {
  const loader = useCallback(
    (): Promise<PortalLoad<PortalInvoice[]>> => (patientId ? loadInvoices(patientId) : Promise.resolve({ state: 'ready', data: [] })),
    [patientId]
  );
  return usePortalLoad(loader);
};

/** Invoices of the chosen person: what is still to pay and how. */
export const InvoicesPage: React.FC = () => {
  const { selected } = usePortal();
  const { view, reload } = useInvoices(selected?.patientId ?? null);
  const summary = useMemo(() => (view.state === 'ready' ? summarizePatientInvoices(view.data) : null), [view]);
  if (!selected) return null;

  return (
    <div>
      <PageTitle icon="solar:bill-list-bold-duotone" title="Invoices" subtitle={selected.firstName} />
      {view.state === 'loading' && <LoadingBlock />}
      {view.state === 'not_enabled' && <NotEnabledBlock />}
      {view.state === 'error' && <ErrorBlock message={view.message} onRetry={reload} />}

      {view.state === 'ready' && summary && (
        <>
          <div className="rounded-2xl bg-gradient-to-r from-cyan-600 to-sky-600 text-white shadow-sm p-4">
            <p className="text-sm opacity-90">You owe</p>
            <p className="text-3xl font-semibold">{formatNad(summary.balanceDuePatient)}</p>
            {summary.balanceDueMedicalAid > 0 && (
              <p className="mt-1 text-sm opacity-90">Medical aid still to pay: {formatNad(summary.balanceDueMedicalAid)}</p>
            )}
            {summary.overdueCount > 0 && (
              <p className="mt-1 text-sm font-medium">
                {summary.overdueCount} overdue {summary.overdueCount === 1 ? 'invoice' : 'invoices'}
              </p>
            )}
          </div>

          {summary.balanceDuePatient > 0 && (
            <div className="mt-3">
              <PayCard patient={selected} />
            </div>
          )}

          <SectionTitle>All invoices</SectionTitle>
          {view.data.length === 0 ? (
            <Card>
              <EmptyBlock icon="solar:bill-check-bold-duotone" title="No invoices yet" />
            </Card>
          ) : (
            <div className="space-y-3">
              {view.data.map((invoice) => (
                <InvoiceRow key={invoice.id} invoice={invoice} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

/** One invoice: the services, who pays what, and how to pay. */
export const InvoiceDetailPage: React.FC = () => {
  const { invoiceId = '' } = useParams();
  const navigate = useNavigate();
  const { selected, patients } = usePortal();
  const { view, reload } = useInvoices(selected?.patientId ?? null);
  const linesLoader = useCallback(() => loadInvoiceLines(invoiceId), [invoiceId]);
  const { view: linesView } = usePortalLoad(linesLoader);
  if (!selected) return null;

  const invoice = view.state === 'ready' ? view.data.find((row) => row.id === invoiceId) ?? null : null;

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => navigate('/me/invoices')} className="flex items-center gap-1 text-sm font-medium text-cyan-700">
        <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4" aria-hidden="true" />
        Invoices
      </button>
      {view.state === 'loading' && <LoadingBlock />}
      {view.state === 'not_enabled' && <NotEnabledBlock />}
      {view.state === 'error' && <ErrorBlock message={view.message} onRetry={reload} />}
      {view.state === 'ready' && !invoice && (
        <Card>
          <EmptyBlock icon="solar:bill-cross-bold-duotone" title="Invoice not found">
            {patients.length > 1 ? 'It may belong to another person on this phone. Choose them at the top.' : 'It is not on this file.'}
          </EmptyBlock>
        </Card>
      )}

      {invoice && (
        <>
          <Card>
            <div className="flex items-start justify-between gap-3 mb-2">
              <div>
                <h1 className="text-lg font-semibold text-gray-900">{invoice.invoiceNumber ?? 'Invoice'}</h1>
                {invoice.practiceName && <p className="text-sm text-gray-500">{invoice.practiceName}</p>}
              </div>
              <StatusPill tone={STATUS[invoice.status].tone}>{STATUS[invoice.status].label}</StatusPill>
            </div>
            <DetailRow label="Date" value={formatDay(invoice.date) ?? '-'} />
            {invoice.dueDate && <DetailRow label="Pay by" value={formatDay(invoice.dueDate) ?? '-'} />}
          </Card>

          <Card>
            <h2 className="font-semibold text-gray-900 mb-2">Services</h2>
            {linesView.state === 'loading' && <LoadingBlock />}
            {linesView.state === 'error' && <ErrorBlock message={linesView.message} />}
            {linesView.state === 'not_enabled' && <p className="text-sm text-gray-500">The services on this invoice are not available yet.</p>}
            {linesView.state === 'ready' && linesView.data.length === 0 && <p className="text-sm text-gray-500">No services listed.</p>}
            {linesView.state === 'ready' &&
              linesView.data.map((line) => (
                <div key={line.id} className="flex justify-between gap-3 py-2 border-b border-gray-50 last:border-0 text-sm">
                  <div className="min-w-0">
                    <p className="text-gray-900 break-words">{line.description}</p>
                    <p className="text-xs text-gray-500">
                      {[line.code, line.toothNumber ? `tooth ${line.toothNumber}` : null, line.quantity !== 1 ? `x ${line.quantity}` : null]
                        .filter(Boolean)
                        .join(' - ')}
                    </p>
                  </div>
                  <span className="text-gray-900 flex-shrink-0">{formatNad(line.totalPrice)}</span>
                </div>
              ))}
            <div className="mt-3 pt-2 border-t border-gray-100">
              <DetailRow label="Total" value={formatNad(invoice.total)} />
              {invoice.medicalAidPortion > 0 && <DetailRow label="Medical aid pays" value={formatNad(invoice.medicalAidPortion)} />}
              <DetailRow label="You pay" value={<span className="font-semibold">{formatNad(invoice.patientPortion)}</span>} />
            </div>
          </Card>

          {isOutstandingInvoice(invoice.status) && invoice.patientPortion > 0 && <PayCard patient={selected} invoice={invoice} />}
        </>
      )}
    </div>
  );
};
