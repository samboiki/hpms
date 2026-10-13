import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { EmptyState, ErrorState, LoadingState, MiniStat, SectionCard } from '../finance/FinanceUI';
import { downloadReportCsv } from '../finance/financeExport';
import { inventoryCategoryLabel } from '../finance/financeTheme';
import { loadValuations, takeValuation } from '../../services/stock/stockService';
import { todayKey } from '../../utils/billing/dates';
import { toCents } from '../../utils/billing/money';
import { expiryState } from '../../utils/stock/ledger';
import type { Valuation } from '../../utils/stock/stockRows';
import { canStock, whoCan } from '../../utils/stock/stockRoles';
import { valuationTable } from './stockDocuments';
import { stockLevelOf, type StockContext } from './stockContext';
import { Chip } from './stockParts';
import { PRIMARY, QUIET, SECONDARY, STOCK_COLOR, day, errorText, nad, printOrSay } from './stockUi';

/**
 * Stock value now (at cost, excl. VAT, from the ledger) by category, with what has expired or expires within three
 * months; and the valuations kept: one is kept automatically when a month is closed in Finance, or by hand here.
 */
export const ValuationReport: React.FC<{ context: StockContext }> = ({ context }) => {
  const [kept, setKept] = useState<Valuation[] | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const today = todayKey();

  const reload = useCallback(() => {
    setFailed(null);
    loadValuations(context.practiceId).then(setKept).catch(error => setFailed(errorText(error, 'Could not load the valuations')));
  }, [context.practiceId]);
  useEffect(reload, [reload]);

  const now = useMemo(() => {
    const lines = context.items.flatMap(item => {
      const level = stockLevelOf(item, context.levels);
      return level.onHand !== 0 || level.valueCents !== 0
        ? [{ item, name: item.name, unit: item.unit, onHand: level.onHand, valueCents: level.valueCents, expiry: expiryState(item.expiryDate, today) }]
        : [];
    }).sort((a, b) => b.valueCents - a.valueCents);
    const byCategory = new Map<string, number>();
    for (const line of lines) byCategory.set(line.item.category, (byCategory.get(line.item.category) ?? 0) + line.valueCents);
    return {
      lines,
      totalCents: lines.reduce((sum, line) => sum + line.valueCents, 0),
      expiredCents: lines.filter(line => line.expiry === 'expired').reduce((sum, line) => sum + line.valueCents, 0),
      expiringCents: lines.filter(line => line.expiry === 'soon').reduce((sum, line) => sum + line.valueCents, 0),
      byCategory: [...byCategory.entries()].sort((a, b) => b[1] - a[1])
    };
  }, [context.items, context.levels, today]);

  const reportNow = () => valuationTable('Stock valuation', `As at ${day(today)}`, now.lines);

  const keep = async () => {
    setBusy(true);
    try {
      const result = await takeValuation(context.practiceId, today);
      toast.success(`Valuation of ${day(today)} kept: ${nad(toCents(Number(result.total_value)))}.`);
      reload();
    } catch (error) {
      toast.error(errorText(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniStat icon="solar:wallet-money-bold-duotone" label="Stock value now" value={nad(now.totalCents)} tone="green" />
        <MiniStat icon="solar:box-bold-duotone" label="Items with stock" value={String(now.lines.length)} tone={STOCK_COLOR.tone} />
        <MiniStat icon="solar:hourglass-line-bold-duotone" label="Expires within 3 months" value={nad(now.expiringCents)} tone="amber" />
        <MiniStat icon="solar:danger-triangle-bold-duotone" label="Expired" value={nad(now.expiredCents)} tone="red" />
      </div>

      <SectionCard
        title="Stock value now"
        subtitle="At the average cost of what is on hand, excluding VAT"
        icon="solar:wallet-money-bold-duotone"
        tone={STOCK_COLOR.tone}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => printOrSay(reportNow(), context.practiceName)} className={SECONDARY}>
              <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Print
            </button>
            <button type="button" onClick={() => downloadReportCsv(reportNow())} className={SECONDARY}>
              <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              CSV
            </button>
            <button type="button" onClick={() => void keep()} disabled={busy || !canStock(context.role, 'keep_valuation')} className={PRIMARY}
              title={canStock(context.role, 'keep_valuation') ? 'Keep today\'s figures as they are' : whoCan('keep_valuation')}>
              Keep this valuation
            </button>
          </div>
        }
      >
        {now.byCategory.length === 0 ? (
          <EmptyState compact icon="solar:box-bold-duotone" title="No stock on hand" />
        ) : (
          <ul className="space-y-2">
            {now.byCategory.map(([category, cents]) => (
              <li key={category}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-700">{inventoryCategoryLabel(category)}</span>
                  <span className="font-semibold tabular-nums text-gray-900">{nad(cents)}</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-gray-100">
                  <div className={`h-2 rounded-full bg-gradient-to-r ${STOCK_COLOR.from} ${STOCK_COLOR.to}`} style={{ width: `${now.totalCents > 0 ? Math.max((cents / now.totalCents) * 100, 1) : 0}%` }} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard title="Kept valuations" subtitle="One is kept when a month is closed (Finance > Reports > Month end), so a month's stock figure never changes" icon="solar:archive-bold-duotone" tone={STOCK_COLOR.tone}>
        {failed ? (
          <ErrorState title="Valuations could not be loaded" message={failed} onRetry={reload} />
        ) : kept === null ? (
          <LoadingState label="Loading valuations" rows={2} />
        ) : kept.length === 0 ? (
          <EmptyState compact icon="solar:archive-bold-duotone" title="None kept yet" message="Close a month in Finance, or keep one here." />
        ) : (
          <ul className="divide-y divide-gray-100">
            {kept.map(valuation => (
              <li key={valuation.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                <span>
                  <span className="font-medium text-gray-900">{day(valuation.asAt)}</span>
                  <span className="ml-2"><Chip tone={valuation.kind === 'month_end' ? 'violet' : 'gray'}>{valuation.kind === 'month_end' ? 'Month end' : 'Kept by hand'}</Chip></span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="font-semibold tabular-nums">{nad(valuation.totalCents)}</span>
                  <button
                    type="button"
                    onClick={() => printOrSay(valuationTable('Stock valuation', `As at ${day(valuation.asAt)} (${valuation.kind === 'month_end' ? 'month end' : 'kept by hand'})`, valuation.lines), context.practiceName)}
                    className={QUIET}
                    aria-label={`Print the valuation of ${day(valuation.asAt)}`}
                  >
                    <Icon icon="solar:printer-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
};

export default ValuationReport;
