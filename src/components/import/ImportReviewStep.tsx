import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { AGE_BANDS } from '../../services/ledger/receivables';
import { formatServiceDate } from '../../utils/billing/dates';
import type { ImportPlan } from '../../utils/import/importPlan';
import { Notice } from '../finance/FinanceUI';
import { ErrorBox, PrimaryButton, SecondaryButton, SummaryRow } from '../finance/receipts/ArUi';
import { count, nad, plural } from './importText';
import { StepIntro } from './importUi';

interface ImportReviewStepProps {
  plan: ImportPlan;
  /** The day the age analysis was run; null when no balances are brought over */
  balancesAsOf: string | null;
  /** While the rows are being sent */
  sending: { sent: number; total: number } | null;
  error: string | null;
  onImport: () => void;
}

const Line: React.FC<{ icon: string; children: React.ReactNode }> = ({ icon, children }) => (
  <li className="flex items-start gap-3">
    <Icon icon={icon} className="mt-0.5 h-5 w-5 flex-none text-cyan-600" aria-hidden="true" />
    <span className="min-w-0 text-sm text-gray-700">{children}</span>
  </li>
);

/** Step 4: the dry run in plain words, then the import itself (asked twice: it creates many files at once) */
export const ImportReviewStep: React.FC<ImportReviewStepProps> = ({ plan, balancesAsOf, sending, error, onImport }) => {
  const [confirming, setConfirming] = useState(false);
  const { counts } = plan;
  const lists = plan.recallLists;
  return (
    <div className="space-y-5">
      <StepIntro title="This is what the import will do">Read it through. Nothing has been saved yet.</StepIntro>

      <ul className="space-y-3 rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
        <Line icon="solar:user-plus-bold-duotone">
          {plural(counts.newPatients, 'new patient file', 'new patient files')}, each with the Eminance account number
          {counts.noIdNumber > 0 && <> ({count(counts.noIdNumber)} without an ID number get a placeholder, NOID-..., until you add the number)</>}.
          {counts.withMedicalAid > 0 && <> {count(counts.withMedicalAid)} get their medical aid: fund, option, membership number, main member and dependant code.</>}
        </Line>
        {counts.existingPatients > 0 && (
          <Line icon="solar:user-check-bold-duotone">
            {plural(counts.existingPatients, 'patient is', 'patients are')} already in OneHealth: their file is kept as it is and gets the Eminance account number.
          </Line>
        )}
        {counts.skippedPatients > 0 && (
          <Line icon="solar:user-cross-bold-duotone">{plural(counts.skippedPatients, 'row is', 'rows are')} left out (the lists in the previous step say why).</Line>
        )}
        {counts.familyLinks > 0 && (
          <Line icon="solar:users-group-rounded-bold-duotone">{plural(counts.familyLinks, 'dependant is', 'dependants are')} linked to the main member who pays for them.</Line>
        )}
        {counts.balanceAccounts > 0 && balancesAsOf && (
          <Line icon="solar:wallet-money-bold-duotone">
            Opening balances of {nad(counts.balanceCents)} on {plural(counts.balanceAccounts, 'account', 'accounts')} (medical aid {nad(counts.medicalAidCents)},
            patients {nad(counts.patientCents)}), dated back from {formatServiceDate(balancesAsOf)} so the age analysis shows each amount at its Eminance age. An amount
            that would fall in a closed month is dated on the first open day instead.
          </Line>
        )}
        {counts.creditSetOffCents > 0 && (
          <Line icon="solar:card-transfer-bold-duotone">{nad(counts.creditSetOffCents)} of unallocated credit is set off against the same accounts&apos; oldest debts.</Line>
        )}
        {counts.creditAccounts > 0 && (
          <Line icon="solar:danger-triangle-bold-duotone">
            {plural(counts.creditAccounts, 'account is', 'accounts are')} in credit ({nad(counts.creditLeftCents)} in all): not brought over. Refund the money or record it in OneHealth yourself.
          </Line>
        )}
        {counts.recalls > 0 && (
          <Line icon="solar:calendar-mark-bold-duotone">
            {plural(counts.recalls, 'recall goes', 'recalls go')} on {plural(lists.length, 'patient list', 'patient lists')} (Messages &gt; Lists):{' '}
            {lists.map(list => `${list.name} (${count(list.count)})`).join(', ')}. Each is also set on the patient&apos;s file (one whose day has
            passed is due on the day of the import) and closes when they book.
          </Line>
        )}
        {counts.claimLines > 0 && (
          <Line icon="solar:history-bold-duotone">
            {plural(counts.claimLines, 'claim line is', 'claim lines are')} kept as read-only claim history on {plural(counts.claimPatients, "patient's file", "patients' files")}.
          </Line>
        )}
        <Line icon="solar:shield-check-bold-duotone">No SMS or email is sent: automations do not run for the imported files.</Line>
        <Line icon="solar:undo-left-round-bold-duotone">
          You can undo the whole import afterwards, until someone works with the imported files (a visit, invoice, payment, note or document) or a month is closed.
        </Line>
      </ul>

      {counts.balanceAccounts > 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
          <p className="mb-2 text-sm font-semibold text-gray-900">Opening balances by age</p>
          <div className="space-y-1.5">
            {AGE_BANDS.filter(band => counts.byBand[band.key] > 0).map(band => (
              <SummaryRow key={band.key} label={band.label} value={nad(counts.byBand[band.key])} />
            ))}
            <SummaryRow label="Total" value={nad(counts.balanceCents)} strong />
          </div>
        </div>
      )}

      {error && <ErrorBox>{error}</ErrorBox>}

      <div role="status" aria-live="polite">
        {sending && (
          <div className="space-y-2">
            <p className="text-sm text-gray-700">Sending the rows: {count(sending.sent)} of {count(sending.total)}</p>
            <div className="h-2 overflow-hidden rounded-full bg-gray-100">
              <div className="h-full rounded-full bg-cyan-500 motion-safe:transition-[width]" style={{ width: `${sending.total ? Math.round((sending.sent / sending.total) * 100) : 0}%` }} />
            </div>
          </div>
        )}
      </div>

      {!sending && (
        confirming ? (
          <Notice tone="warning" title="Import now?">
            <p>Keep this page open until it is done. If the connection drops while importing, open Settings &gt; Move over from Eminance again to continue.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <SecondaryButton onClick={() => setConfirming(false)}>Not yet</SecondaryButton>
              <PrimaryButton icon="solar:import-bold-duotone" onClick={onImport}>Yes, import</PrimaryButton>
            </div>
          </Notice>
        ) : (
          <div className="flex justify-end">
            <PrimaryButton icon="solar:import-bold-duotone" onClick={() => setConfirming(true)}>Import now</PrimaryButton>
          </div>
        )
      )}
    </div>
  );
};
