import React, { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { formatNad } from '../../../utils/billing/money';
import { claimFileName } from '../../../utils/billing/claimFile';
import { downloadTextFile } from './download';
import { batchStatus } from './status';
import type { BatchHeaderRow, BatchSubmissionRow, FundProvider } from './types';

interface BatchHistoryProps {
  batches: BatchHeaderRow[];
  submissions: BatchSubmissionRow[];
  fundByReference: Map<string, FundProvider>;
  onOpen: (batch: BatchHeaderRow) => void;
}

/** Every batch with its status and email submissions; the file that was sent can be downloaded again. */
const BatchHistory: React.FC<BatchHistoryProps> = ({ batches, submissions, fundByReference, onOpen }) => {
  const submissionsByBatch = useMemo(() => {
    const grouped = new Map<string, BatchSubmissionRow[]>();
    submissions.forEach(submission => {
      grouped.set(submission.batch_header_id, [...(grouped.get(submission.batch_header_id) ?? []), submission]);
    });
    return grouped;
  }, [submissions]);

  if (batches.length === 0) {
    return <p className="py-10 text-center text-gray-500">No claim batches yet.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
          <tr>
            <th className="px-3 py-2">Batch</th>
            <th className="px-3 py-2">Fund</th>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Invoices</th>
            <th className="px-3 py-2 text-right">Total</th>
            <th className="px-3 py-2">Submissions</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {batches.map(batch => {
            const status = batchStatus(batch);
            const fund = fundByReference.get(batch.medical_aid_reference.toUpperCase());
            const attempts = submissionsByBatch.get(batch.id) ?? [];
            const latest = attempts[0];
            return (
              <tr key={batch.id}>
                <td className="px-3 py-2 font-mono text-gray-900">{batch.batch_number}</td>
                <td className="px-3 py-2 text-gray-700">{fund?.name ?? batch.medical_aid_reference}</td>
                <td className="px-3 py-2 text-gray-700">{batch.batch_date}</td>
                <td className="px-3 py-2">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                  {batch.sent_at && <div className="mt-0.5 text-xs text-gray-500">sent {batch.sent_at.slice(0, 10)}</div>}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">{batch.total_invoices ?? '-'}</td>
                <td className="px-3 py-2 text-right text-gray-900">{batch.total_amount !== null ? formatNad(Number(batch.total_amount)) : '-'}</td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {latest ? (
                    <span title={attempts.map(a => `${a.submitted_at.slice(0, 16).replace('T', ' ')} ${a.status} to ${a.recipient_email}`).join('\n')}>
                      {attempts.length} attempt(s), last {latest.status} to {latest.recipient_email}
                    </span>
                  ) : (
                    'None'
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => onOpen(batch)} className="text-xs font-medium text-cyan-700 hover:underline">
                      Open
                    </button>
                    {batch.generated_file_content && (
                      <button
                        type="button"
                        onClick={() =>
                          downloadTextFile(
                            claimFileName({ practiceNumber: batch.practice_number, batchNumber: batch.batch_number, fundReference: batch.medical_aid_reference }),
                            batch.generated_file_content ?? ''
                          )
                        }
                        className="flex items-center gap-1 text-xs font-medium text-cyan-700 hover:underline"
                        title="Download the file exactly as it was sent"
                      >
                        <Icon icon="solar:download-minimalistic-bold-duotone" className="h-3.5 w-3.5" />
                        Sent file
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default BatchHistory;
