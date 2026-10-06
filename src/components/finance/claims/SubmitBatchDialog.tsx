import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { formatNad } from '../../../utils/billing/money';
import type { ClaimFile } from '../../../utils/billing/claimFile';
import { submitBatch } from './claimsService';
import type { BatchHeaderRow, FundProvider, PracticeInfo, SubmitBatchResult } from './types';

interface SubmitBatchDialogProps {
  practice: PracticeInfo;
  batch: BatchHeaderRow;
  fund: FundProvider | undefined;
  file: ClaimFile;
  warningCount: number;
  /** Last day by which every line in the batch is still within the fund deadline. */
  submitBy: string | null;
  userId: string | null;
  onClose: () => void;
  onSubmitted: (result: SubmitBatchResult) => void;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Final check before a claim file is emailed to a fund. Sending needs the fund's claims address
 * on record and an explicit confirmation; the batch is re-checked so it is never sent twice.
 */
const SubmitBatchDialog: React.FC<SubmitBatchDialogProps> = ({
  practice,
  batch,
  fund,
  file,
  warningCount,
  submitBy,
  userId,
  onClose,
  onSubmitted
}) => {
  const [confirmed, setConfirmed] = useState(false);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<SubmitBatchResult | null>(null);
  const recipient = (fund?.email ?? '').trim();
  const recipientOk = EMAIL_PATTERN.test(recipient);
  const fundName = fund?.name ?? batch.medical_aid_reference;

  const send = async () => {
    if (!confirmed || !recipientOk || sending) return;
    setSending(true);
    try {
      const outcome = await submitBatch({ practice, batch, file, recipientEmail: recipient, fundName, submittedBy: userId });
      setResult(outcome);
      onSubmitted(outcome);
    } catch (error) {
      setResult({ status: 'failed', message: error instanceof Error ? error.message : 'The batch could not be submitted.' });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={sending ? undefined : onClose}>
      <div
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="submit-batch-title"
        onClick={event => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-lg bg-cyan-100 p-2">
            <Icon icon="solar:letter-bold-duotone" className="h-6 w-6 text-cyan-700" />
          </div>
          <div>
            <h3 id="submit-batch-title" className="text-lg font-semibold text-gray-900">
              Submit batch {batch.batch_number} to {fundName}
            </h3>
            <p className="text-sm text-gray-500">The claim file is emailed through the practice email gateway.</p>
          </div>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Claims address</dt>
          <dd className={recipientOk ? 'font-medium text-gray-900' : 'font-medium text-red-700'}>
            {recipient || 'Not set for this fund'}
          </dd>
          <dt className="text-gray-500">File</dt>
          <dd className="font-mono text-gray-900">{file.fileName}</dd>
          <dt className="text-gray-500">Claim lines</dt>
          <dd className="text-gray-900">{file.lineCount}</dd>
          <dt className="text-gray-500">Total claimed</dt>
          <dd className="font-semibold text-gray-900">{formatNad(file.totalCents / 100)}</dd>
          {submitBy && (
            <>
              <dt className="text-gray-500">Fund deadline</dt>
              <dd className="text-gray-900">Earliest line must be received by {submitBy}</dd>
            </>
          )}
        </dl>

        {!recipientOk && (
          <p className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
            This fund has no valid claims email address on record (medical aid providers). Ask an administrator to add
            the fund&apos;s claims address before submitting.
          </p>
        )}
        {warningCount > 0 && (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {warningCount} warning(s) remain. They do not block the claim, but check them first.
          </p>
        )}

        {result ? (
          <div
            className={`mb-4 rounded-lg border p-3 text-sm ${
              result.status === 'sent'
                ? 'border-green-200 bg-green-50 text-green-800'
                : result.status === 'sent_not_recorded'
                  ? 'border-amber-300 bg-amber-50 text-amber-900'
                  : 'border-red-200 bg-red-50 text-red-700'
            }`}
            role="status"
          >
            {result.message}
          </div>
        ) : (
          <label className="mb-4 flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={event => setConfirmed(event.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600"
            />
            I have reviewed the {file.lineCount} claim line(s) and want to send this batch to {fundName} now.
          </label>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {result ? 'Close' : 'Cancel'}
          </button>
          {!result && (
            <button
              type="button"
              onClick={send}
              disabled={!confirmed || !recipientOk || sending}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon={sending ? 'solar:refresh-bold-duotone' : 'solar:plain-bold-duotone'} className={`h-4 w-4 ${sending ? 'animate-spin' : ''}`} />
              {sending ? 'Sending...' : 'Send to fund'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubmitBatchDialog;
