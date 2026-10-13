import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { claimRejectionsLink } from '../../billing/invoiceLinks';
import { summarizeOpenRejections, type PatientRejectionSummary } from '../../../utils/remittance/patientRejections';
import { Notice } from '../FinanceUI';
import { loadPatientOpenRejections } from './remittanceService';
import { formatDateKey, nad } from './remittanceUi';

interface PatientClaimsNoticeProps {
  practiceId: string | null | undefined;
  patientId: string | null | undefined;
}

/**
 * In the patient file: the medical aid claims of this patient that a fund did not pay and that still need someone,
 * with one tap to them in the rejection queue. Shows nothing when there are none, or before the queue is set up.
 */
export const PatientClaimsNotice: React.FC<PatientClaimsNoticeProps> = ({ practiceId, patientId }) => {
  const [summary, setSummary] = useState<PatientRejectionSummary | null>(null);

  useEffect(() => {
    setSummary(null);
    if (!practiceId || !patientId) return;
    let cancelled = false;
    loadPatientOpenRejections(practiceId, patientId)
      .then(rows => {
        if (!cancelled && rows) setSummary(summarizeOpenRejections(rows));
      })
      .catch(error => {
        // A notice that cannot load must not get in the way of the billing tab; the queue itself still shows the items
        console.warn('[PatientClaimsNotice]', error instanceof Error ? error.message : error);
      });
    return () => {
      cancelled = true;
    };
  }, [practiceId, patientId]);

  if (!summary || summary.count === 0 || !patientId) return null;

  const claims = summary.count === 1 ? '1 medical aid claim needs' : `${summary.count} medical aid claims need`;
  return (
    <Notice
      tone="warning"
      title={`${claims} attention`}
      action={(
        <Link
          to={claimRejectionsLink(patientId)}
          className="inline-flex shrink-0 items-center rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
        >
          Open
        </Link>
      )}
    >
      The fund did not pay {nad(summary.atStakeCents)}
      {summary.nextDeadline ? `; resubmit by ${formatDateKey(summary.nextDeadline)}` : ''}.
    </Notice>
  );
};
