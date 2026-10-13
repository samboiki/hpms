import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import DateInput from '../../ui/DateInput';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  describeDaybookEntry,
  isBackdated,
  printBanner,
  sequenceGaps,
  summarizeDaybook,
  toDateKey,
  type DaybookEntry
} from '../../../services/ledgerService';
import { downloadCsv, exportFileName, printReport, reportToCsv } from '../financeExport';
import { ActionButton, EmptyState, LoadingState, MiniStat, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { ErrorBox, SecondaryButton } from '../receipts/ArUi';
import { formatDay } from '../receipts/receiptDocuments';
import { loadDaybook, recordDaybookPrint, type DaybookData } from './controlsService';
import { daybookTable } from './controlsDocuments';
import { CONTROLS_NOT_SET_UP_MESSAGE } from './controlsCopy';
import { useReportOpener } from '../practiceReports/ReportOpener';
import type { ReportTarget } from '../practiceReports/reportTargets';

/** What a daybook line opens: its payment (receipt, refund, allocation), else its invoice, else the patient's file */
const daybookTarget = (entry: Pick<DaybookEntry, 'receiptId' | 'invoiceId' | 'patientId'>): ReportTarget | null =>
  entry.receiptId
    ? { kind: 'receipt', id: entry.receiptId }
    : entry.invoiceId
      ? { kind: 'invoice', id: entry.invoiceId }
      : entry.patientId
        ? { kind: 'patient', id: entry.patientId }
        : null;

const nad = (cents: number) => formatNad(fromCents(cents));

interface DaybookPanelProps {
  practiceId: string;
  practiceName: string;
  patientNames: Readonly<Record<string, string>>;
}

/**
 * The daybook (Finance > Payments > Daybook): every invoice, payment, allocation, adjustment and
 * reversal recorded on a day, numbered without gaps. It cannot be edited; every print and export
 * is logged, and every copy after the first says it is a reprint.
 */
export const DaybookPanel: React.FC<DaybookPanelProps> = ({ practiceId, practiceName, patientNames }) => {
  const [todayKey] = useState(() => toDateKey(new Date()));
  const [dayKey, setDayKey] = useState(todayKey);
  const [data, setData] = useState<DaybookData | null>(null);
  const [busy, setBusy] = useState<'print' | 'export' | null>(null);

  const load = useCallback(() => {
    let cancelled = false;
    setData(null);
    loadDaybook(practiceId, dayKey).then(result => { if (!cancelled) setData(result); });
    return () => { cancelled = true; };
  }, [practiceId, dayKey]);
  useEffect(() => load(), [load]);

  const summary = useMemo(() => summarizeDaybook(data?.entries ?? []), [data]);
  const gaps = useMemo(() => sequenceGaps(data?.entries ?? []), [data]);
  // Every line opens what it records (the lines carry their payment, invoice and patient but opened nothing)
  const opener = useReportOpener({ practiceId, practiceName, patientNames: { ...patientNames }, onChanged: load });

  const output = async (kind: 'print' | 'export') => {
    if (!data || data.state !== 'ready') return;
    setBusy(kind);
    try {
      const copy = await recordDaybookPrint(practiceId, dayKey, kind);
      const banner = printBanner({ copyNumber: copy.copy_number, fromNumber: copy.from_number, toNumber: copy.to_number }, data.prints, data.staffNames);
      // Print what the database says this copy covers (entries recorded since loading included)
      const fresh = await loadDaybook(practiceId, dayKey);
      const entries = fresh.state === 'ready' ? fresh.entries : data.entries;
      const report = daybookTable(entries, { dayLabel: formatDay(dayKey), banner, staffNames: data.staffNames, patientNames });
      if (kind === 'print') {
        if (!printReport(report, practiceName)) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
      } else {
        downloadCsv(exportFileName(`daybook ${dayKey} copy ${copy.copy_number}`), reportToCsv(report));
      }
      setData(fresh.state === 'ready' ? fresh : data);
    } catch (error) {
      toast.error(error instanceof Error ? plainWords(error.message) : 'The daybook could not be printed');
    } finally {
      setBusy(null);
    }
  };

  const columns: TableColumn<DaybookEntry>[] = [
    { key: 'number', header: 'No.', align: 'right', render: entry => <span className="font-mono">{entry.number}</span> },
    { key: 'time', header: 'Time', hideBelow: 'sm', render: entry => format(new Date(entry.recordedAt), 'HH:mm') },
    {
      key: 'entry',
      header: 'Entry',
      render: entry => (
        <div className="min-w-0">
          <p className="max-w-[260px] truncate text-gray-900 sm:max-w-none">{describeDaybookEntry(entry)}</p>
          <p className="text-xs text-gray-500">
            {(entry.patientId && patientNames[entry.patientId]) || ''}
            {isBackdated(entry) && <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-amber-800">counts on {formatDay(entry.businessDate)}</span>}
          </p>
        </div>
      )
    },
    { key: 'amount', header: 'Amount', align: 'right', render: entry => nad(entry.amountCents) },
    {
      key: 'effect',
      header: 'Effect on debtors',
      align: 'right',
      hideBelow: 'md',
      render: entry => (entry.effectCents === 0 ? <span className="text-gray-400">—</span> : <span className={entry.effectCents < 0 ? 'text-green-700' : 'text-gray-900'}>{nad(entry.effectCents)}</span>)
    },
    { key: 'by', header: 'By', hideBelow: 'lg', render: entry => <span className="text-xs text-gray-600">{(entry.actor && data?.staffNames[entry.actor]) || ''}</span> }
  ];

  const original = data?.prints.find(print => print.copyNumber === 1) ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <DateInput label="Day" value={dayKey} onChange={value => setDayKey(value || todayKey)} maxDate={todayKey} />
        </div>
        {dayKey !== todayKey && <SecondaryButton onClick={() => setDayKey(todayKey)} className="!py-2">Today</SecondaryButton>}
      </div>

      {!data && <LoadingState label="Loading the daybook" rows={4} />}
      {data?.state === 'not_set_up' && <Notice tone="info" title="The daybook is not set up yet">{CONTROLS_NOT_SET_UP_MESSAGE}</Notice>}
      {data?.state === 'error' && <ErrorBox>{data.error}</ErrorBox>}

      {data?.state === 'ready' && (
        <SectionCard
          title={`Daybook ${formatDay(dayKey)}`}
          subtitle={summary.firstNumber === null ? 'Nothing recorded on this day' : `Entries ${summary.firstNumber} to ${summary.lastNumber}, in the order they were recorded`}
          icon="solar:notebook-bold-duotone"
          actions={<>
            <ActionButton icon="solar:printer-minimalistic-bold-duotone" label={busy === 'print' ? 'Printing...' : data.prints.length > 0 ? 'Reprint' : 'Print'} onClick={() => void output('print')} disabled={busy !== null || data.entries.length === 0} />
            <ActionButton icon="solar:download-minimalistic-bold-duotone" label={busy === 'export' ? 'Exporting...' : 'Export CSV'} onClick={() => void output('export')} disabled={busy !== null || data.entries.length === 0} />
          </>}
        >
          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniStat icon="solar:list-check-bold-duotone" label="Entries" value={String(data.entries.length)} tone="cyan" />
            <MiniStat icon="solar:hand-money-bold-duotone" label="Money in, less refunds" value={nad(summary.netReceivedCents)} tone="green" />
            <MiniStat icon="solar:graph-up-bold-duotone" label="Change in debtors" value={nad(summary.netEffectCents)} tone="violet" />
            <MiniStat icon="solar:history-bold-duotone" label="Captured late" value={String(summary.backdatedCount)} tone="amber" />
          </div>

          {gaps.length > 0 ? (
            <Notice tone="error" title="Numbers are missing from this list">
              {gaps.map(gap => (gap.from === gap.to ? `${gap.from}` : `${gap.from} to ${gap.to}`)).join(', ')}. The daybook is numbered without gaps, so reload the page; if they stay missing, report it.
            </Notice>
          ) : data.entries.length > 0 ? (
            <p className="mb-3 flex items-center gap-1.5 text-xs text-green-700">
              <Icon icon="solar:shield-check-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              No gaps: every number from {summary.firstNumber} to {summary.lastNumber} is here, and none can be changed or deleted.
            </p>
          ) : null}

          <DataTable
            rows={data.entries}
            columns={columns}
            rowKey={entry => String(entry.number)}
            onRowClick={entry => {
              const target = daybookTarget(entry);
              if (target) opener.open(target);
            }}
            rowLabel={entry => `Open daybook entry ${entry.number}`}
            resetKey={dayKey}
            pageSize={50}
            itemLabel="entries"
            empty={<EmptyState compact icon="solar:notebook-bold-duotone" title="Nothing recorded on this day" message="Invoices, payments, allocations and adjustments appear here the moment they are saved." />}
          />

          {summary.byKind.length > 0 && (
            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                  <tr><th scope="col" className="px-3 py-2 text-left font-medium">Totals by type</th><th scope="col" className="px-3 py-2 text-right font-medium">Count</th><th scope="col" className="px-3 py-2 text-right font-medium">Amount</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {summary.byKind.map(kind => (
                    <tr key={kind.kind}><td className="px-3 py-1.5">{kind.label}</td><td className="px-3 py-1.5 text-right tabular-nums">{kind.count}</td><td className="px-3 py-1.5 text-right tabular-nums">{nad(kind.amountCents)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="mt-3 text-xs text-gray-500">
            {original
              ? `Printed or exported ${data.prints.length} ${data.prints.length === 1 ? 'time' : 'times'}; the original on ${format(new Date(original.printedAt), 'd MMM yyyy, HH:mm')}${original.printedBy ? ` by ${data.staffNames[original.printedBy] ?? 'a staff member'}` : ''}. Every later copy is marked as a reprint.`
              : 'Not printed yet: the first print or export of this day is the original.'}
          </p>
        </SectionCard>
      )}
      {opener.element}
    </div>
  );
};
