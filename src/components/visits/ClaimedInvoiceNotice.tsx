import React from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { claimedInvoiceNotice, type SentClaim } from '../../utils/invoiceLock';
import { claimBatchLink, claimRejectionsLink, invoiceLink } from '../billing/invoiceLinks';

interface ClaimedInvoiceNoticeProps {
  claim: SentClaim;
  invoiceId: string;
  patientId: string | null | undefined;
}

/**
 * Shown beside Save while the visit's invoice is in a sent claim batch: the fund keeps what it received, so a change
 * here is not sent to it. Links to the batch, to the invoice (credit note) and to the fund's rejections (resubmission).
 */
export const ClaimedInvoiceNotice: React.FC<ClaimedInvoiceNoticeProps> = ({ claim, invoiceId, patientId }) => (
  <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900" role="note">
    <Icon icon="solar:lock-keyhole-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <div className="min-w-0">
      <p>{claimedInvoiceNotice(claim)}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-medium">
        <Link to={claimBatchLink(claim.batchId)} className="underline hover:text-amber-950">
          Open the batch
        </Link>
        <Link to={invoiceLink(invoiceId)} className="underline hover:text-amber-950">
          Credit note on the invoice
        </Link>
        <Link to={claimRejectionsLink(patientId)} className="underline hover:text-amber-950">
          Rejections
        </Link>
      </p>
    </div>
  </div>
);

export default ClaimedInvoiceNotice;
