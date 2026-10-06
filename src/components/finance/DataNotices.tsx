import React from 'react';
import type { FinanceWorkspace } from './financeData';
import { pluralize } from './financeFormat';
import { Notice } from './FinanceUI';

/** Tells the user which figures are missing or approximate, instead of silently showing zeros */
export const DataNotices: React.FC<{ workspace: FinanceWorkspace; unrecognisedStatusCount: number }> = ({ workspace, unrecognisedStatusCount }) => {
  const failures = [
    { label: 'Payroll', error: workspace.payslips.error },
    { label: 'Practice expenses', error: workspace.expenses.error },
    { label: 'Inventory', error: workspace.inventory.error },
    { label: 'Invoice line items', error: workspace.lineItems.error },
    { label: 'Claim batches', error: workspace.claims.error }
  ].filter(failure => !!failure.error);

  if (failures.length === 0 && workspace.lookupWarnings.length === 0 && unrecognisedStatusCount === 0) return null;

  return (
    <div className="space-y-3">
      {failures.length > 0 && (
        <Notice tone="warning" title="Some figures are unavailable">
          <ul className="list-disc pl-4 space-y-0.5">
            {failures.map(failure => <li key={failure.label}><strong>{failure.label}:</strong> {failure.error}</li>)}
          </ul>
          <p className="mt-1">Sections that depend on these show "Unavailable" instead of N$0.00. Use Refresh to try again.</p>
        </Notice>
      )}
      {workspace.lookupWarnings.length > 0 && (
        <Notice tone="info">{workspace.lookupWarnings.join('. ')}. Amounts are not affected; names may show as unknown.</Notice>
      )}
      {unrecognisedStatusCount > 0 && (
        <Notice tone="info">
          {pluralize(unrecognisedStatusCount, 'invoice has', 'invoices have')} a payment status HPMS does not recognise; they are counted as unpaid.
        </Notice>
      )}
    </div>
  );
};
