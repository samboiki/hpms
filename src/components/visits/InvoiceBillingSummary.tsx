import React from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { formatNad, fromCents } from '../../utils/billing/money';
import { describeCopayRule, type CopayRule } from '../../utils/billing/lineSplit';
import type { DuplicateWarning } from '../../utils/billing/invoiceDuplicates';
import { INVOICE_LOCK_MESSAGES, claimedInvoiceNotice } from '../../utils/invoiceLock';
import { useAuthStore } from '../../stores/authStore';
import { claimBatchLink, invoiceLink, quoteLink } from '../billing/invoiceLinks';
import type { VisitInvoice } from './useInvoiceContext';

export interface BillingTotals {
  totalCents: number;
  fundCents: number;
  patientCents: number;
  discountCents: number;
  /** The fund's levy charged on this invoice (part of patientCents) */
  levyCents?: number;
  /** Lines the patient pays all of, never claimed (part of patientCents) */
  patientOnlyCents?: number;
}

/** Admin > Tariffs, on the tab with the co-payments and levies */
export const COPAYMENT_SETTINGS_LINK = '/admin/tariffs?tab=contracts';

interface InvoiceBillingSummaryProps {
  totals: BillingTotals;
  hasMedicalAid: boolean;
  /** The co-payment applied to this patient's fund, if any */
  copay: CopayRule | null;
  invoice: VisitInvoice | null;
  duplicates: readonly DuplicateWarning[];
  /** Parts of the billing context that could not be loaded */
  problems: readonly string[];
}

const Amount: React.FC<{ label: string; cents: number; strong?: boolean; tone?: string }> = ({ label, cents, strong, tone }) => (
  <div className="min-w-0">
    <p className="text-xs text-gray-500">{label}</p>
    <p className={`tabular-nums ${strong ? 'text-lg font-bold' : 'text-base font-semibold'} ${tone ?? 'text-gray-900'}`}>{formatNad(fromCents(cents))}</p>
  </div>
);

/**
 * Below a visit's billing lines: what the invoice comes to and who pays what (fund and patient, with the
 * co-payment), the invoice and where it went (claim batch, the quote it came from), and any service that looks
 * billed twice. Every name links to its own screen.
 */
const InvoiceBillingSummary: React.FC<InvoiceBillingSummaryProps> = ({ totals, hasMedicalAid, copay, invoice, duplicates, problems }) => {
  // Practice administrators change co-payments and levies; everyone else only sees them
  const canChangeSettings = useAuthStore(state => state.user?.role === 'admin' || state.user?.is_super_admin === true);
  const patientOnlyCents = totals.patientOnlyCents ?? 0;
  const levyCents = totals.levyCents ?? 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-4">
        <Amount label="Invoice total" cents={totals.totalCents} strong />
        {hasMedicalAid && <Amount label="Medical aid pays" cents={totals.fundCents} />}
        <Amount label="Patient pays" cents={totals.patientCents} strong tone={totals.patientCents > 0 ? 'text-amber-700' : 'text-gray-900'} />
        {totals.discountCents > 0 && <Amount label="Discount given" cents={totals.discountCents} tone="text-emerald-700" />}
        {hasMedicalAid && (copay || patientOnlyCents > 0 || canChangeSettings) && (
          <div className="col-span-2 space-y-1 self-center text-xs text-gray-600 sm:col-span-4">
            {copay && (
              <p>
                {copay.fundReference}
                {copay.planOption ? `, ${copay.planOption}` : ''}: the patient pays {describeCopayRule(copay)}
                {levyCents > 0 ? ` (levy on this visit ${formatNad(fromCents(levyCents))})` : ''}. The medical aid is claimed for the whole of each line and pays the rest.
              </p>
            )}
            {patientOnlyCents > 0 && (
              <p>
                Lines marked &quot;patient pays all&quot; ({formatNad(fromCents(patientOnlyCents))}) are not sent to the medical aid.
              </p>
            )}
            {canChangeSettings && (
              <Link to={COPAYMENT_SETTINGS_LINK} className="inline-flex items-center gap-1 font-medium text-cyan-700 hover:underline">
                <Icon icon="solar:hand-money-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
                Co-payment and levy settings
              </Link>
            )}
          </div>
        )}
      </div>

      {invoice && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <Link to={invoiceLink(invoice.id)} className="inline-flex items-center gap-1.5 font-medium text-cyan-700 hover:underline">
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Invoice {invoice.invoiceNumber}
          </Link>
          {invoice.batchId && (
            <Link to={claimBatchLink(invoice.batchId)} className="inline-flex items-center gap-1.5 text-cyan-700 hover:underline">
              <Icon icon="solar:box-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Medical aid claim batch
            </Link>
          )}
          {invoice.quote && (
            <Link to={quoteLink(invoice.quote.id)} className="inline-flex items-center gap-1.5 text-cyan-700 hover:underline">
              <Icon icon="solar:bill-list-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              From quote {invoice.quote.number}
            </Link>
          )}
          {invoice.lock && (
            <span className="inline-flex items-center gap-1.5 text-amber-800">
              <Icon icon="solar:lock-keyhole-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {/* A claimed invoice says which batch and when, the same words as beside Save */}
              Locked: {invoice.lock === 'claim-sent' && invoice.claim ? claimedInvoiceNotice(invoice.claim) : INVOICE_LOCK_MESSAGES[invoice.lock]}
            </span>
          )}
        </div>
      )}

      {duplicates.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status">
          {duplicates.map(warning => (
            <li key={`${warning.key}-${warning.invoiceId}`} className="flex flex-wrap items-start gap-x-2">
              <Icon icon="solar:copy-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              <span className="min-w-0 flex-1">{warning.message}</span>
              <Link to={invoiceLink(warning.invoiceId)} className="font-medium text-amber-900 underline">
                Open {warning.invoiceNumber}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {problems.length > 0 && (
        <ul className="space-y-0.5 text-xs text-gray-500">
          {problems.map(problem => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default InvoiceBillingSummary;
