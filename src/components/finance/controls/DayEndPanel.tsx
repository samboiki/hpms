import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import DateInput from '../../ui/DateInput';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  cashVariance,
  cashierReport,
  changesSinceCashUp,
  checkCashCount,
  controlSummary,
  formatMonth,
  parseAmountInput,
  snapshotJson,
  snapshotOf,
  toDateKey
} from '../../../services/ledgerService';
import { downloadReportCsv, printReport, type ReportTable } from '../financeExport';
import { ActionButton, LoadingState, Notice, SectionCard } from '../FinanceUI';
import { ReportPreview } from '../ReportPreview';
import { AmountInput, ErrorBox, Field, PrimaryButton, SecondaryButton, SummaryRow, inputClass } from '../receipts/ArUi';
import { formatDay } from '../receipts/receiptDocuments';
import { loadDayEnd, recordCashUp, type DayEndData } from './controlsService';
import { cashierTable, daySheetTable } from './controlsDocuments';
import { CONTROLS_NOT_SET_UP_MESSAGE } from './controlsCopy';
import { DepositSlips } from './DepositSlips';
import { CashierCashUps } from './CashierCashUps';
import { useAuthStore } from '../../../stores/authStore';

const nad = (cents: number) => formatNad(fromCents(cents));
const ZERO = /^\s*(N\$)?\s*0+([.,]0*)?\s*$/i;

interface DayEndPanelProps {
  practiceId: string;
  practiceName: string;
  patientNames: Readonly<Record<string, string>>;
}

/**
 * Day end (Finance > Payments > Day end): the day sheet with month to date, the cashier report,
 * the till count that closes the day, and deposit slips. A closed day keeps its figures; anything
 * recorded for that day later is shown as a change since the cash-up.
 */
export const DayEndPanel: React.FC<DayEndPanelProps> = ({ practiceId, practiceName, patientNames }) => {
  const [todayKey] = useState(() => toDateKey(new Date()));
  const [dayKey, setDayKey] = useState(todayKey);
  const [data, setData] = useState<DayEndData | null>(null);
  // Owner, 13 Oct 2026: each cashier cashes up their own takings; the administrator signs the day off (closes it)
  const myId = useAuthStore(state => state.user?.id ?? null);
  const isAdmin = useAuthStore(state => state.user?.role === 'admin');
  const [stillToCount, setStillToCount] = useState<string[]>([]);

  const load = useCallback(() => {
    let cancelled = false;
    setData(null);
    loadDayEnd(practiceId, dayKey).then(result => { if (!cancelled) setData(result); });
    return () => { cancelled = true; };
  }, [practiceId, dayKey]);
  useEffect(() => load(), [load]);

  const day = useMemo(() => ({ startKey: dayKey, endKey: dayKey }), [dayKey]);
  const figures = useMemo(() => {
    if (!data || data.state !== 'ready') return null;
    const monthToDate = { startKey: `${dayKey.slice(0, 7)}-01`, endKey: dayKey };
    return {
      day: controlSummary(data.entries, day),
      monthToDate: controlSummary(data.entries, monthToDate),
      cashier: cashierReport(data.entries.receipts, data.entries.adjustments.filter(adjustment => adjustment.kind === 'refund'), day)
    };
  }, [data, day, dayKey]);

  const dayLabel = formatDay(dayKey);
  const sheet: ReportTable | null = figures ? daySheetTable(figures.day, figures.monthToDate, dayLabel) : null;
  const cashier: ReportTable | null = figures && data ? cashierTable(figures.cashier, data.staffNames, `Receipts dated ${dayLabel}`) : null;
  const print = (report: ReportTable) => {
    if (!printReport(report, practiceName)) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <DateInput label="Day" value={dayKey} onChange={value => setDayKey(value || todayKey)} maxDate={todayKey} />
        </div>
        {dayKey !== todayKey && <SecondaryButton onClick={() => setDayKey(todayKey)} className="!py-2">Today</SecondaryButton>}
        <ActionButton icon="solar:refresh-bold-duotone" label="Refresh" onClick={load} />
      </div>

      {!data && <LoadingState label="Loading the day" rows={3} />}
      {data?.state === 'not_set_up' && <Notice tone="info" title="Day end is not set up yet">{CONTROLS_NOT_SET_UP_MESSAGE}</Notice>}
      {data?.state === 'error' && <ErrorBox>{data.error}</ErrorBox>}

      {data?.state === 'ready' && figures && sheet && cashier && (
        <>
          <CashierCashUps
            practiceId={practiceId}
            dayKey={dayKey}
            lines={figures.cashier.lines}
            staffNames={data.staffNames}
            myId={myId}
            isAdmin={isAdmin}
            locked={!!data.lockedBy}
            onStillToCount={setStillToCount}
          />

          {isAdmin ? (
            <CashCount practiceId={practiceId} dayKey={dayKey} data={data} figures={figures} stillToCount={stillToCount} onSaved={load} />
          ) : (
            <p className="text-sm text-gray-500">An administrator closes the day once every cashier has cashed up.</p>
          )}

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SectionCard
              title="Day sheet"
              subtitle={`${dayLabel}, with month to date`}
              icon="solar:checklist-minimalistic-bold-duotone"
              actions={<>
                <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => downloadReportCsv(sheet)} />
                <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" onClick={() => print(sheet)} />
              </>}
            >
              <ReportPreview report={sheet} empty={{ title: 'Nothing on this day', hint: 'Invoices, payments and adjustments of the day appear here.' }} pageSize={0} />
            </SectionCard>

            <SectionCard
              title="Cashier report"
              subtitle={`Who captured which payments, ${dayLabel}`}
              icon="solar:users-group-rounded-bold-duotone"
              tone="violet"
              actions={<>
                <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => downloadReportCsv(cashier)} />
                <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print" onClick={() => print(cashier)} />
              </>}
            >
              <ReportPreview report={cashier} empty={{ title: 'No payments on this day', hint: 'Payments received with Receive payment appear here per person.' }} pageSize={0} />
            </SectionCard>
          </div>

          <DepositSlips practiceId={practiceId} practiceName={practiceName} upToKey={dayKey} patientNames={patientNames} staffNames={data.staffNames} />
        </>
      )}
    </div>
  );
};

interface CashCountProps {
  practiceId: string;
  dayKey: string;
  data: DayEndData;
  figures: { day: ReturnType<typeof controlSummary> };
  /** Cashiers with takings who have not cashed up yet */
  stillToCount: readonly string[];
  onSaved: () => void;
}

/** The till count that closes a day; a day closed before shows its count and what changed since */
const CashCount: React.FC<CashCountProps> = ({ practiceId, dayKey, data, figures, stillToCount, onSaved }) => {
  const active = data.cashUps.find(record => !record.supersededAt) ?? null;
  const [counting, setCounting] = useState(!active);
  const [counted, setCounted] = useState('');
  const [notes, setNotes] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCounting(!active);
    setCounted('');
    setNotes('');
    setReplaceReason('');
    setError(null);
  }, [active, dayKey]);

  const expected = figures.day.cash.expectedCents;
  // An empty till is a valid count: "0" or "0.00" is zero, anything else must be an amount
  const countedCents = counted.trim() === '' ? null : ZERO.test(counted) ? 0 : parseAmountInput(counted);
  const variance = countedCents === null ? null : cashVariance(expected, countedCents);
  const now = snapshotOf(figures.day);
  const changes = active ? changesSinceCashUp(active.snapshot, now) : [];
  const locked = data.lockedBy;

  const save = async () => {
    const check = checkCashCount({ countedCents, expectedCents: expected, notes, replacing: !!active, replaceReason });
    if (!check.ok) { setError(check.error); return; }
    setSaving(true);
    setError(null);
    try {
      const result = await recordCashUp(practiceId, dayKey, { countedCents: countedCents ?? 0, notes, totals: snapshotJson(now), replaceReason });
      toast.success(`${formatDay(dayKey)} cashed up${Number(result.difference) === 0 ? ': the till balances' : ''}`);
      onSaved();
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'The day was not closed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SectionCard
      title={active ? 'Day closed' : 'Close the day'}
      subtitle={active ? `Cashed up ${active.closedAt ? new Date(active.closedAt).toLocaleString('en-NA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}${active.closedBy ? ` by ${data.staffNames[active.closedBy] ?? 'a staff member'}` : ''}` : 'Count the cash in the till against what the receipts say'}
      icon={active ? 'solar:lock-keyhole-bold-duotone' : 'solar:wad-of-money-bold-duotone'}
      tone={active ? 'green' : 'amber'}
    >
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <SummaryRow label="Cash received (standing receipts)" value={nad(figures.day.cash.receivedCents)} />
          <SummaryRow label="Cash refunds paid from the till" value={`-${nad(figures.day.cash.refundedCents)}`} />
          <SummaryRow label="Cash expected in the till" value={nad(expected)} strong />
          {active && (
            <>
              <SummaryRow label="Counted" value={nad(active.countedCashCents)} />
              <SummaryRow
                label={active.differenceCents === 0 ? 'The till balanced' : active.differenceCents > 0 ? 'Over' : 'Short'}
                value={nad(Math.abs(active.differenceCents))}
                tone={active.differenceCents === 0 ? 'good' : 'warning'}
              />
              {active.notes && <p className="pt-1 text-xs text-gray-600">Note: {active.notes}</p>}
            </>
          )}
        </div>

        <div className="space-y-3">
          {locked && <Notice tone="info">{formatMonth(locked.monthKey)} is closed, so this day cannot be counted again.</Notice>}
          {!active && stillToCount.length > 0 && (
            <Notice tone="warning" title="Not every cashier has cashed up">Still to count: {stillToCount.join(', ')}.</Notice>
          )}
          {active && changes.length > 0 && (
            <Notice tone="warning" title="Changed since the cash-up">
              <ul className="list-disc pl-4">
                {changes.map(change => <li key={change.label}>{change.label}: {nad(change.beforeCents)} then, {nad(change.nowCents)} now</li>)}
              </ul>
              <p className="mt-1">Something was recorded for this day after it was closed. Count again if the cash changed.</p>
            </Notice>
          )}
          {active && !counting && !locked && (
            <SecondaryButton icon="solar:refresh-bold-duotone" onClick={() => setCounting(true)}>Count again</SecondaryButton>
          )}
          {counting && !locked && (
            <>
              {error && <ErrorBox>{error}</ErrorBox>}
              <Field label="Cash counted in the till" htmlFor="cash-counted" hint="Enter 0 when there is no cash">
                <AmountInput id="cash-counted" value={counted} onChange={event => setCounted(event.target.value)} invalid={counted.trim() !== '' && countedCents === null} />
              </Field>
              {variance && (
                <p className={`flex items-center gap-1.5 text-sm ${variance.status === 'balanced' ? 'text-green-700' : 'text-amber-800'}`}>
                  <Icon icon={variance.status === 'balanced' ? 'solar:check-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
                  {variance.status === 'balanced' ? 'The till balances' : `The till is ${variance.status} by ${nad(Math.abs(variance.differenceCents))}`}
                </p>
              )}
              <Field label={variance && variance.status !== 'balanced' ? 'Why is the till over or short?' : 'Note (optional)'} htmlFor="cash-notes">
                <textarea id="cash-notes" rows={2} className={inputClass} value={notes} onChange={event => setNotes(event.target.value)} maxLength={500} />
              </Field>
              {active && (
                <Field label="Why count again?" htmlFor="cash-replace">
                  <input id="cash-replace" className={inputClass} value={replaceReason} onChange={event => setReplaceReason(event.target.value)} maxLength={200} />
                </Field>
              )}
              <div className="flex flex-wrap gap-2">
                <PrimaryButton icon="solar:lock-keyhole-bold-duotone" onClick={() => void save()} busy={saving}>Close {formatDay(dayKey)}</PrimaryButton>
                {active && <SecondaryButton onClick={() => setCounting(false)} disabled={saving}>Keep the earlier count</SecondaryButton>}
              </div>
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
};
