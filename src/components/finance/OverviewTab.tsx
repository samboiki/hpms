import React from 'react';
import { percentChange } from '../../services/ledgerService';
import type { FinanceDerived } from './deriveFinance';
import type { FinanceWorkspace } from './financeData';
import type { NavigateFn, PeriodLabels } from './financeNav';
import { formatCount, formatNad, formatPercent, pluralize } from './financeFormat';
import { ActionButton, EmptyState, MiniStat, Notice, SectionCard, StatTile, SummaryStrip } from './FinanceUI';
import { RevenueTrendChart } from './charts/RevenueTrendChart';
import { PayerMixCard } from './charts/PayerMixCard';
import { AgingChart } from './charts/AgingChart';
import { TopServicesChart } from './charts/TopServicesChart';
import { PnlTable } from './PnlTable';
import { DataNotices } from './DataNotices';

interface OverviewTabProps {
  derived: FinanceDerived;
  workspace: FinanceWorkspace;
  labels: PeriodLabels;
  onNavigate: NavigateFn;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({ derived, workspace, labels, onNavigate }) => {
  const { revenue, previousRevenue, collections, previousCollections, aging, summary, previousSummary, tariffs } = derived;
  const netUnavailable = [workspace.expenses.error && 'practice expenses', workspace.payslips.error && 'payroll'].filter(Boolean).join(' and ');

  return (
    <div className="space-y-6">
      <DataNotices workspace={workspace} unrecognisedStatusCount={derived.unrecognisedStatusCount} />

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile
          label="Billed"
          value={formatNad(revenue.billed)}
          icon="solar:bill-list-bold-duotone"
          caption={pluralize(revenue.invoiceCount, 'invoice')}
          change={{ percent: percentChange(revenue.billed, previousRevenue.billed), comparisonLabel: labels.previous }}
          onClick={() => onNavigate({ tab: 'invoicing' })}
        />
        <StatTile
          label="Collected (paid invoices)"
          value={formatNad(collections.collected)}
          icon="solar:hand-money-bold-duotone"
          tone="green"
          caption={`${formatPercent(collections.collectionRate)} of billed`}
          change={{ percent: percentChange(collections.collected, previousCollections.collected), comparisonLabel: labels.previous }}
          onClick={() => onNavigate({ tab: 'payments' })}
        />
        <StatTile
          label="Outstanding receivables"
          value={formatNad(aging.total)}
          icon="solar:clock-circle-bold-duotone"
          tone="orange"
          caption={`As at ${labels.today}`}
          footnote={`${formatNad(aging.pastDue)} past due · ${pluralize(aging.count, 'invoice')}`}
          onClick={() => onNavigate({ tab: 'ledgers', ledger: 'receivables' })}
        />
        <StatTile
          label="Net result (billed less costs)"
          value={summary.netResult === null ? 'Unavailable' : formatNad(summary.netResult)}
          icon="solar:calculator-bold-duotone"
          tone="violet"
          caption={labels.current}
          change={summary.netResult !== null && previousSummary.netResult !== null
            ? { percent: percentChange(summary.netResult, previousSummary.netResult), comparisonLabel: labels.previous }
            : undefined}
          footnote={summary.netResult === null ? `Needs ${netUnavailable}, which could not be loaded.` : undefined}
          onClick={() => onNavigate({ tab: 'ledgers', ledger: 'summary' })}
        />
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-3">
        <SectionCard className="xl:col-span-2" title="Revenue trend" subtitle="Last 12 months by invoice date" icon="solar:chart-2-bold-duotone">
          <RevenueTrendChart rows={derived.monthly} highlight={labels.ranges.current} />
          <SummaryStrip>
            <strong>Billed {labels.current}:</strong> {formatNad(revenue.billed)} from {pluralize(revenue.invoiceCount, 'invoice')}
            {revenue.cancelledCount > 0 && ` (${pluralize(revenue.cancelledCount, 'cancelled invoice')} worth ${formatNad(revenue.cancelledAmount)} excluded)`}.
          </SummaryStrip>
        </SectionCard>
        <SectionCard title="Payer mix" subtitle={`Billed ${labels.current}`} icon="solar:pie-chart-2-bold-duotone" tone="indigo">
          <PayerMixCard mix={derived.payerMix} />
        </SectionCard>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <SectionCard
          title="Receivables aging"
          subtitle={`As at ${labels.today}, by days past due date`}
          icon="solar:clock-circle-bold-duotone"
          tone="orange"
          actions={<ActionButton icon="solar:notebook-bold-duotone" label="Open ledger" onClick={() => onNavigate({ tab: 'ledgers', ledger: 'receivables' })} />}
        >
          {aging.count === 0 ? (
            <EmptyState compact icon="solar:check-circle-bold-duotone" title="Nothing outstanding" message="Every invoice is paid or cancelled." />
          ) : (
            <>
              <AgingChart aging={aging} onSelectBucket={bucket => onNavigate({ tab: 'ledgers', ledger: 'receivables', agingBucket: bucket })} />
              <SummaryStrip tone="orange">
                <strong>{formatNad(aging.total)}</strong> outstanding on {pluralize(aging.count, 'invoice')}, of which {formatNad(aging.pastDue)} is past due.
                Medical aids owe {formatNad(aging.medicalAid)}; patients owe {formatNad(aging.patient)}. Click a bar to see the invoices.
              </SummaryStrip>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Top services by tariff code"
          subtitle={`Line-item revenue ${labels.current}`}
          icon="solar:tag-price-bold-duotone"
          actions={<ActionButton icon="solar:notebook-bold-duotone" label="Revenue ledger" onClick={() => onNavigate({ tab: 'ledgers', ledger: 'revenue' })} />}
        >
          {tariffs === null ? (
            <Notice tone="error" title="Line items could not be loaded">{workspace.lineItems.error}</Notice>
          ) : tariffs.length === 0 ? (
            <EmptyState compact icon="solar:tag-price-bold-duotone" title="No billed services in this period" message="Services appear here once invoices with tariff codes are issued." />
          ) : (
            <>
              <TopServicesChart rows={tariffs.slice(0, 8)} />
              <SummaryStrip>
                <strong>{tariffs[0].code || 'No code'}</strong> ({tariffs[0].description}) earned {formatNad(tariffs[0].revenue)}, {formatPercent(tariffs[0].share)} of line-item revenue
                across {pluralize(tariffs.length, 'tariff code')}.
              </SummaryStrip>
            </>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-2">
        <SectionCard title="Profit and loss snapshot" subtitle={`${labels.current} compared with ${labels.previous}`} icon="solar:calculator-bold-duotone" tone="violet">
          <PnlTable current={summary} previous={previousSummary} currentLabel="This period" previousLabel="Previous" />
          <p className="text-xs text-gray-500 mt-3">Derived from HPMS invoices, practice expenses and payslips. Not a double-entry ledger.</p>
        </SectionCard>

        <SectionCard title="Claims and collection health" subtitle={labels.current} icon="solar:shield-check-bold-duotone" tone="blue">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat
              icon="solar:box-bold-duotone"
              label="Claims sent, awaiting payment"
              value={workspace.claims.error ? 'Unavailable' : formatNad(workspace.claims.amount)}
              tone="blue"
            />
            <MiniStat icon="solar:hand-money-bold-duotone" label="Collection rate" value={formatPercent(collections.collectionRate)} tone="green" />
            <MiniStat icon="solar:document-text-bold-duotone" label="Average invoice" value={formatNad(revenue.averageInvoice)} tone="cyan" />
            <MiniStat icon="solar:heart-pulse-bold-duotone" label="Medical aid share" value={formatPercent(derived.payerMix.medicalAidShare)} tone="indigo" />
          </div>
          <p className="text-xs text-gray-500 mt-3">
            {workspace.claims.error
              ? `Claim batches could not be loaded: ${workspace.claims.error}`
              : `${formatCount(workspace.claims.count)} claim ${workspace.claims.count === 1 ? 'batch is' : 'batches are'} marked sent. Manage them on the Batches tab.`}
          </p>
        </SectionCard>
      </div>
    </div>
  );
};
