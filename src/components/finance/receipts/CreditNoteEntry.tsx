import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { claimBatchLink } from '../../billing/invoiceLinks';
import { downloadCreditNotePdf } from '../../../services/creditNoteDocumentService';
import { REVERSAL_STATE_META } from '../claims/claimCorrections';
import type { CreditNoteDetail } from './creditNoteService';

interface CreditNoteEntryProps {
  adjustmentId: string;
  /** Its lines and reversals; null for a credit note on a whole portion (or while credit notes per line are not set up) */
  detail: CreditNoteDetail | null;
}

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * Under a credit note in an invoice's payments: the lines it credited, where each reversal to the fund stands (with
 * the claim batch the line was sent in and the credit file the reversal goes or went in), and the printable credit
 * note, styled like the invoice.
 */
export const CreditNoteEntry: React.FC<CreditNoteEntryProps> = ({ adjustmentId, detail }) => {
  const [printing, setPrinting] = useState(false);

  const print = async () => {
    setPrinting(true);
    try {
      await downloadCreditNotePdf(adjustmentId);
    } catch (error) {
      toast.error(`Could not make the credit note PDF: ${error instanceof Error ? error.message : 'unknown error'}`);
    } finally {
      setPrinting(false);
    }
  };

  return (
    <div className="mt-1 space-y-1">
      {detail && detail.lines.length > 0 && (
        <p className="text-xs text-gray-600 break-words">
          Credited {detail.lines.map(line => `${line.code} ${nad(line.amountCents)}`).join(', ')}
        </p>
      )}
      {detail?.reversals.map(reversal => {
        const meta = REVERSAL_STATE_META[reversal.state];
        return (
          <p key={reversal.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${meta.chip}`}>
              <Icon icon={meta.icon} className="h-3.5 w-3.5" aria-hidden="true" />
              {meta.label}
            </span>
            <span className="text-gray-600">
              {reversal.lineCode} {nad(reversal.amountCents)} to {reversal.fundReference}: sent in{' '}
              <Link to={claimBatchLink(reversal.claimBatchId)} className="font-medium text-cyan-700 hover:underline">batch {reversal.claimBatchNumber ?? ''}</Link>
              {reversal.creditBatchId && (
                <>
                  , reversed in{' '}
                  <Link to={claimBatchLink(reversal.creditBatchId)} className="font-medium text-cyan-700 hover:underline">credit file {reversal.creditBatchNumber ?? ''}</Link>
                </>
              )}
            </span>
          </p>
        );
      })}
      <button
        type="button"
        onClick={() => void print()}
        disabled={printing}
        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline disabled:opacity-60"
      >
        <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-3.5 w-3.5" aria-hidden="true" />
        {printing ? 'Making the PDF...' : 'Credit note PDF'}
      </button>
    </div>
  );
};
