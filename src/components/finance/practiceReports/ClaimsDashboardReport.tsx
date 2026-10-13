import React, { useMemo } from 'react';
import type { PeriodLabels } from '../financeNav';
import { formatNad, formatPercent } from '../financeFormat';
import { Notice } from '../FinanceUI';
import {
  fundTable,
  monthFundRows,
  monthTable,
  reasonTable,
  rejectionsByReason,
  silentFundTable,
  totalOf,
  totalsByFund,
  totalsByMonth
} from './claimsDashboard';
import { loadClaimsDashboard } from './practiceReportsService';
import { ReportFrame, type FrameState } from './ReportFrame';
import { useReportOpener } from './ReportOpener';
import { useReportLoad } from './useReportLoad';

interface Props {
  practiceId: string;
  practiceName: string;
  labels: PeriodLabels;
}

const NOT_SET_UP = 'The claims dashboard is not set up in this database yet (proposals/2026-10-12-claims-dashboard-and-story.sql).';

/**
 * The claims dashboard (parity G10): claimed against paid per month and per fund, days to pay, refusals by reason and
 * the funds that have not answered. Each row opens its batches or claim lines.
 */
export const ClaimsDashboard: React.FC<Props> = ({ practiceId, practiceName, labels }) => {
  const range = labels.ranges.current;
  const { status, data, retry } = useReportLoad(
    () => loadClaimsDashboard(practiceId, range, labels.todayKey),
    `${practiceId}|${range.startKey}|${range.endKey}|${labels.todayKey}`,
    NOT_SET_UP
  );
  const { open, element } = useReportOpener({ practiceId, practiceName, patientNames: {}, onChanged: retry });

  const rows = useMemo(() => monthFundRows(data?.months ?? []), [data]);
  const all = useMemo(() => totalOf(rows), [rows]);
  const months = useMemo(() => monthTable(totalsByMonth(rows), labels.current), [rows, labels]);
  const funds = useMemo(() => fundTable(totalsByFund(rows), labels.current), [rows, labels]);
  const reasons = useMemo(() => reasonTable(rejectionsByReason(data?.rejections ?? []), labels.current), [data, labels]);
  const silent = useMemo(() => silentFundTable(data?.silent ?? [], labels.today), [data, labels]);
  const frame = { practiceId, practiceName, onOpen: open, onRetry: retry };
  const shared: FrameState = status;

  return (
    <div className="space-y-6">
      {status.state === 'ready' && (
        <p className="text-sm text-gray-700">
          {all.lines === 0
            ? `No claim batches were sent ${labels.current}.`
            : `Sent ${labels.current}: ${all.lines} claim lines for ${formatNad(all.claimedCents / 100)}; the funds have paid ${formatNad(all.paidCents / 100)} so far (${formatPercent(all.paidShare)}).`}
          {all.averageDaysToPay !== null ? ` On average a paid line took ${all.averageDaysToPay} days.` : ''}
          {all.resentLines > 0 ? ` ${all.resentLines} of the lines ${all.resentLines === 1 ? 'was a claim' : 'were claims'} sent again.` : ''}
        </p>
      )}
      <ReportFrame {...frame} title="Claimed and paid per month" subtitle={`Batches sent ${labels.current}`} icon="solar:chart-square-bold-duotone" tone="cyan"
        exportKey="claims_per_month" range={range} status={shared} report={status.state === 'ready' ? months : null}
        empty={{ title: 'No batches sent in this period', hint: 'Claim batches sent to the funds in the period appear here by month.' }} />
      <ReportFrame {...frame} title="Claimed and paid per fund" subtitle={`Batches sent ${labels.current}`} icon="solar:shield-check-bold-duotone" tone="cyan"
        exportKey="claims_per_fund" range={range} status={shared} report={status.state === 'ready' ? funds : null}
        empty={{ title: 'No batches sent in this period', hint: 'Each fund\'s claims, payments and days to pay appear here.' }} />
      <ReportFrame {...frame} title="Claims not paid, by reason" subtitle={`Refusals recorded ${labels.current}`} icon="solar:danger-triangle-bold-duotone" tone="amber"
        exportKey="claims_rejection_reasons" range={range} status={shared} report={status.state === 'ready' ? reasons : null}
        empty={{ title: 'No refusals recorded in this period', hint: 'Lines a fund refused or paid short, imported from its remittances, appear here by reason.' }} />
      <ReportFrame {...frame} title="Funds that have not answered" subtitle={`As at ${labels.today}`} icon="solar:hourglass-bold-duotone" tone="red"
        exportKey="claims_silent_funds" range={null} status={shared} report={status.state === 'ready' ? silent : null}
        empty={{ title: 'Every fund has answered', hint: 'Sent batches a fund leaves unanswered for too long, while it still owes money, appear here.' }}>
        {data?.silentWarning && <Notice tone="warning">{data.silentWarning}</Notice>}
      </ReportFrame>
      {element}
    </div>
  );
};
