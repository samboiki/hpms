/**
 * Owner-designed screen: do not change the layout or look without the owner's explicit request.
 *
 * The patient file's Billing tab, exactly as the owner designed it (git bd02f25): his invoice table and nothing else
 * (CleanInvoiceTable: the four totals, Invoice History with Statement and the filters, and every invoice with its
 * visit, services, amount, status and the Email, Print and Change status actions). On 15 Oct 2026 he asked for it
 * back, then moved everything added since to its own Account tab next to Billing (PatientAccountTab.tsx). Invoices
 * are never deleted (owner, 13 Oct 2026), so his table has no Delete button.
 */
import React from 'react';
import CleanInvoiceTable from '../billing/CleanInvoiceTable';

interface PatientBillingTabProps {
  /** The owner's invoice table and its actions (status, email, print) */
  invoiceTable: React.ComponentProps<typeof CleanInvoiceTable>;
}

const PatientBillingTab: React.FC<PatientBillingTabProps> = ({ invoiceTable }) => (
  <div className="space-y-6">
    <CleanInvoiceTable {...invoiceTable} />
  </div>
);

export default PatientBillingTab;
