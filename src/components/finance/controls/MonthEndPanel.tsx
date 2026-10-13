import React, { useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { format, parseISO, subMonths } from 'date-fns';
import { useAuthStore } from '../../../stores/authStore';
import { communicationService } from '../../../services/communicationService';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  DEFAULT_AGE_FILTER,
  buildAgeAnalysis,
  canClosePeriods,
  checkReopen,
  closeChecks,
  closedMonths,
  controlSummary,
  controlTotals,
  controlTotalsFromSnapshot,
  formatMonth,
  isInRange,
  monthRange,
  movementTotalsJson,
  previousMonthKey,
  toDateKey,
  type AgeAnalysisContext,
  type CloseCheck
} from '../../../services/ledgerService';
import type { FinanceDerived } from '../deriveFinance';
import type { FinanceWorkspace } from '../financeData';
import type { PeriodLabels } from '../financeNav';
import { downloadReportCsv, type ReportTable } from '../financeExport';
import { buildReport } from '../reports';
import { ActionButton, LoadingState, Notice, SectionCard } from '../FinanceUI';
import { ReportPreview } from '../ReportPreview';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { formatDay, printDocument } from '../receipts/receiptDocuments';
import { administratorOf } from '../debtors/debtorsContext';
import { closePeriod, loadMonthEnd, reopenPeriod, type MonthEndData } from './controlsService';
import { ageAnalysisTable, controlTotalsTable, packFromSnapshot, packToHtml, receiptsByMethodTable, turnoverTable } from './controlsDocuments';
import { CONTROLS_NOT_SET_UP_MESSAGE } from './controlsCopy';

interface MonthEndPanelProps {
  workspace: FinanceWorkspace;
  derived: FinanceDerived;
  labels: PeriodLabels;
  practiceName: string;
  ageContext: AgeAnalysisContext;
}

const CHECK_ICON = { ok: 'solar:check-circle-bold-duotone', warn: 'solar:danger-triangle-bold-duotone', fail: 'solar:close-circle-bold-duotone' };

/** The last 12 months, newest first, ending with last month (the month normally closed) */
function monthOptions(todayKey: string): string[] {
  const thisMonth = parseISO(`${todayKey.slice(0, 7)}-01`);
  return Array.from({ length: 13 }, (_, i) => format(subMonths(thisMonth, i), 'yyyy-MM'));
}

/**
 * Month end (Finance > Reports): the checks before a month is closed, its control totals, closing
 * and reopening (admins), and the month-end pack built from the same figures. A closed month's
 * pack is the one kept with the close, so a reprint is exactly what was signed off.
 */
export const MonthEndPanel: React.FC<MonthEndPanelProps> = ({ workspace, derived, labels, practiceName, ageContext }) => {
  const user = useAuthStore(state => state.user);
  const [todayKey] = useState(() => toDateKey(new Date()));
  const options = useMemo(() => monthOptions(todayKey), [todayKey]);
  const [monthKey, setMonthKey] = useState(() => previousMonthKey(todayKey.slice(0, 7)));
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<MonthEndData | null>(null);
  const [explanations, setExplanations] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState('');
  const [sheet, setSheet] = useState<'close' | 'reopen' | 'email' | null>(null);

  const load = (key = monthKey) => {
    setData(null);
    loadMonthEnd(workspace.practiceId, monthRange(key)).then(setData);
  };

  const view = useMemo(() => {
    if (!data || data.state !== 'ready' || !data.aggregates) return null;
    const range = monthRange(monthKey);
    const inForce = closedMonths(data.closes);
    const close = inForce.get(monthKey) ?? null;
    const previous = inForce.get(previousMonthKey(monthKey)) ?? null;
    const totals = close ? controlTotalsFromSnapshot(monthKey, close.snapshot) ?? controlTotals(monthKey, data.aggregates, previous) : controlTotals(monthKey, data.aggregates, previous);
    const summary = controlSummary(data.entries, range);
    const cashDays = [
      ...data.entries.receipts.map(receipt => receipt.receivedOn),
      ...data.entries.adjustments.filter(adjustment => adjustment.kind === 'refund').map(adjustment => adjustment.effectiveOn)
    ].filter((day): day is string => !!day && isInRange(day, range));
    const result = closeChecks({
      monthKey, todayKey, role: user?.role, closes: data.closes, unallocatedReceipts: data.unallocated, explanations,
      cashDays, cashedUpDays: data.cashedUpDays, totals, loadedMovements: summary.movements
    });
    const label = formatMonth(monthKey);
    const accounts = buildAgeAnalysis(derived.aging, DEFAULT_AGE_FILTER, ageContext);
    const funds = buildAgeAnalysis(derived.aging, { ...DEFAULT_AGE_FILTER, grouping: 'fund', portion: 'medical_aid', excludeFlags: [] }, ageContext);
    // Practices that keep stock get its valuation in the pack, kept with the close as the month-end snapshot
    const stock = derived.inventory && derived.inventory.count > 0 ? buildReport('inventory_valuation', derived, workspace, labels).report : undefined;
    const livePack: ReportTable[] = [
      controlTotalsTable(totals, label),
      turnoverTable(data.entries.invoices.filter(invoice => isInRange(invoice.issueDate ?? (invoice.createdAt ?? '').slice(0, 10), range)), summary, workspace.doctorNames, label),
      receiptsByMethodTable(summary, label),
      ageAnalysisTable(accounts, { title: 'Age analysis', basis: `As at ${formatDay(todayKey)}`, rowHeader: 'Account' }),
      ageAnalysisTable({ ...funds, rows: funds.rows.map(row => ({ ...row, label: `${row.label} · ${administratorOf(row.label)}` })) }, { title: 'Debtors by medical aid fund', basis: `As at ${formatDay(todayKey)}: the medical aid portion`, rowHeader: 'Fund · administrator' }),
      ...(stock ? [stock] : [])
    ];
    const keptPack = close ? packFromSnapshot(close.snapshot?.pack) : [];
    return { range, close, totals, summary, result, label, pack: keptPack.length > 0 ? keptPack : livePack, packIsKept: keptPack.length > 0, livePack };
  }, [data, monthKey, todayKey, user?.role, explanations, derived, ageContext, workspace, labels]);

  const isAdmin = canClosePeriods(user?.role);
  const history = (data?.closes ?? []).filter(close => close.monthKey === monthKey);

  const printPack = () => {
    if (!view) return;
    const banner = view.packIsKept && view.close ? `As kept when ${view.label} was closed on ${format(new Date(view.close.closedAt), 'd MMM yyyy, HH:mm')}` : view.close ? null : 'Not closed: figures can still change';
    if (!printDocument(packToHtml(`Month-end pack ${view.label}`, view.pack, { practiceName, banner }))) {
      toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
    }
  };

  if (!open) {
    return (
      <SectionCard title="Month end" subtitle="Close a month after its checks, and print the month-end pack" icon="solar:calendar-mark-bold-duotone" tone="indigo">
        <div className="flex flex-wrap items-end gap-3">
          <MonthSelect value={monthKey} options={options} onChange={setMonthKey} />
          <PrimaryButton icon="solar:clipboard-check-bold-duotone" onClick={() => { setOpen(true); load(); }}>Open {formatMonth(monthKey)}</PrimaryButton>
        </div>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={`Month end: ${formatMonth(monthKey)}`}
      subtitle={view?.close ? `Closed on ${format(new Date(view.close.closedAt), 'd MMM yyyy')}${view.close.closedBy ? ` by ${data?.staffNames[view.close.closedBy] ?? 'an admin'}` : ''}: nothing dated in it can change` : 'Open: entries dated in this month can still be added or changed'}
      icon={view?.close ? 'solar:lock-keyhole-bold-duotone' : 'solar:calendar-mark-bold-duotone'}
      tone={view?.close ? 'green' : 'indigo'}
      actions={view && (
        <>
          <ActionButton icon="solar:printer-minimalistic-bold-duotone" label="Print pack" onClick={printPack} />
          <ActionButton icon="solar:letter-bold-duotone" label="Email pack" onClick={() => setSheet('email')} />
        </>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <MonthSelect value={monthKey} options={options} onChange={key => { setMonthKey(key); setExplanations({}); load(key); }} />
          <ActionButton icon="solar:refresh-bold-duotone" label="Refresh" onClick={() => load()} />
        </div>

        {!data && <LoadingState label="Loading the month" rows={4} />}
        {data?.state === 'not_set_up' && <Notice tone="info" title="Month end is not set up yet">{CONTROLS_NOT_SET_UP_MESSAGE}</Notice>}
        {data?.state === 'error' && <ErrorBox>{data.error}</ErrorBox>}
        {data?.state === 'ready' && !view && <ErrorBox>The database did not return the control totals. Refresh to try again.</ErrorBox>}

        {view && (
          <>
            {!view.close && (
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Checks</h4>
                <ul className="space-y-2">
                  {view.result.checks.map(check => <CheckRow key={check.key} check={check} />)}
                </ul>
              </div>
            )}

            {!view.close && data && data.unallocated.some(receipt => (receipt.receivedOn ?? '') <= view.range.endKey) && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-medium text-amber-900">Money received but not on an invoice</p>
                <p className="mb-3 text-xs text-amber-800">Allocate it on Payments, or say here why it stays as credit (kept with the close).</p>
                <ul className="space-y-2">
                  {data.unallocated.filter(receipt => (receipt.receivedOn ?? '') <= view.range.endKey).map(receipt => (
                    <li key={receipt.id} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[minmax(0,14rem)_1fr]">
                      <span className="text-sm text-gray-800">
                        <span className="font-mono">{receipt.number}</span> · {formatDay(receipt.receivedOn)} · {receipt.payerType === 'medical_aid' ? receipt.fundName : (receipt.patientId && workspace.patientNames[receipt.patientId]) || receipt.payerName}
                        <span className="block text-xs text-amber-800">{formatNad(fromCents(receipt.unallocatedCents))} unallocated</span>
                      </span>
                      <input
                        className={inputClass}
                        aria-label={`Why ${receipt.number} stays unallocated`}
                        placeholder="e.g. NHP payment, remittance not received yet"
                        value={explanations[receipt.id] ?? ''}
                        onChange={event => setExplanations(current => ({ ...current, [receipt.id]: event.target.value }))}
                        maxLength={200}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Control totals</h4>
                <ReportPreview report={view.livePack[0]} empty={{ title: 'Nothing this month', hint: '' }} pageSize={0} />
              </div>
              <div>
                <h4 className="mb-2 text-sm font-semibold text-gray-800">Month-end pack</h4>
                <p className="mb-3 text-xs text-gray-500">
                  {view.packIsKept ? 'As kept when the month was closed. ' : ''}Print it as one document, or open each part in Excel.
                </p>
                <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                  {view.pack.map(report => (
                    <li key={report.title} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                      <span className="min-w-0 truncate">{report.title}</span>
                      <ActionButton icon="solar:download-minimalistic-bold-duotone" label="CSV" onClick={() => downloadReportCsv(report)} />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {history.length > 0 && (
              <div className="text-xs text-gray-600">
                <p className="font-medium text-gray-700">History of {view.label}</p>
                <ul className="mt-1 space-y-0.5">
                  {history.map(close => (
                    <li key={close.id}>
                      Closed {format(new Date(close.closedAt), 'd MMM yyyy, HH:mm')}{close.closedBy ? ` by ${data?.staffNames[close.closedBy] ?? 'an admin'}` : ''}
                      {close.reopenedAt && ` · reopened ${format(new Date(close.reopenedAt), 'd MMM yyyy, HH:mm')}${close.reopenedBy ? ` by ${data?.staffNames[close.reopenedBy] ?? 'an admin'}` : ''}: ${close.reopenReason}`}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
              {!view.close && (
                // Only a practice admin can close a month (the database refuses anyone else): the button no longer
                // lets others fill in the close only to be refused
                <PrimaryButton icon="solar:lock-keyhole-bold-duotone" onClick={() => setSheet('close')} disabled={!view.result.canClose || !isAdmin}
                  title={!isAdmin ? 'Only a practice admin can close a month' : view.result.canClose ? undefined : 'Fix the checks marked with a cross first'}>
                  Close {view.label}
                </PrimaryButton>
              )}
              {view.close && isAdmin && (
                <SecondaryButton icon="solar:lock-keyhole-unlocked-bold-duotone" onClick={() => setSheet('reopen')}>Reopen {view.label}</SecondaryButton>
              )}
              {!isAdmin && <p className="text-xs text-gray-500">Only a practice admin can close or reopen a month.</p>}
            </div>
          </>
        )}
      </div>

      {sheet === 'close' && view && (
        <CloseSheet
          monthLabel={view.label}
          closingText={view.livePack[0]}
          notes={notes}
          onNotes={setNotes}
          onClose={() => setSheet(null)}
          onConfirm={async () => {
            await closePeriod(workspace.practiceId, view.range.startKey, {
              explanations: Object.fromEntries(Object.entries(explanations).filter(([, text]) => text.trim()).map(([id, text]) => [id, text.trim()])),
              notes: notes.trim() || null,
              screen_during: movementTotalsJson(view.summary.movements),
              pack: { sections: view.livePack, generated_at: new Date().toISOString() }
            });
            toast.success(`${view.label} is closed`);
            setSheet(null);
            load();
          }}
        />
      )}
      {sheet === 'reopen' && view?.close && (
        <ReopenSheet
          monthLabel={view.label}
          role={user?.role}
          close={view.close}
          onClose={() => setSheet(null)}
          onConfirm={async reason => {
            await reopenPeriod(workspace.practiceId, view.range.startKey, reason);
            toast.success(`${view.label} is open again`);
            setSheet(null);
            load();
          }}
        />
      )}
      {sheet === 'email' && view && (
        <EmailPackSheet
          defaultTo={user?.email ?? ''}
          monthLabel={view.label}
          onClose={() => setSheet(null)}
          onSend={async to => {
            const html = packToHtml(`Month-end pack ${view.label}`, view.pack, { practiceName, banner: view.close ? null : 'Not closed: figures can still change' });
            const result = await communicationService.sendEmail({
              practiceId: workspace.practiceId,
              recipientEmail: to,
              subject: `Month-end pack ${view.label}: ${practiceName}`,
              htmlContent: html,
              textContent: `The month-end pack of ${view.label} for ${practiceName}.`,
              emailType: 'report',
              metadata: { kind: 'month_end_pack', month: monthKey }
            });
            if (!result.success) throw new Error(result.error || 'The email was not sent');
            toast.success(`Month-end pack sent to ${to}`);
            setSheet(null);
          }}
        />
      )}
    </SectionCard>
  );
};

const MonthSelect: React.FC<{ value: string; options: readonly string[]; onChange: (value: string) => void }> = ({ value, options, onChange }) => (
  <Field label="Month" htmlFor="month-end-month" className="w-full sm:w-56">
    <select id="month-end-month" className={inputClass} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(key => <option key={key} value={key}>{formatMonth(key)}</option>)}
    </select>
  </Field>
);

const CheckRow: React.FC<{ check: CloseCheck }> = ({ check }) => {
  const state = check.ok ? 'ok' : check.blocking ? 'fail' : 'warn';
  const tone = state === 'ok' ? 'text-green-600' : state === 'fail' ? 'text-red-600' : 'text-amber-600';
  return (
    <li className="flex items-start gap-2 text-sm">
      <Icon icon={CHECK_ICON[state]} className={`mt-0.5 h-5 w-5 flex-shrink-0 ${tone}`} aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium text-gray-900">{check.title}<span className="sr-only">{state === 'ok' ? ': passed' : state === 'fail' ? ': must be fixed' : ': warning'}</span></p>
        <p className="text-gray-600">{check.detail}</p>
        {check.items.length > 0 && <p className="mt-0.5 text-xs text-gray-500">{check.items.slice(0, 8).join(' · ')}{check.items.length > 8 ? ` · and ${check.items.length - 8} more` : ''}</p>}
      </div>
    </li>
  );
};

const CloseSheet: React.FC<{ monthLabel: string; closingText: ReportTable; notes: string; onNotes: (value: string) => void; onClose: () => void; onConfirm: () => Promise<void> }> = ({
  monthLabel, closingText, notes, onNotes, onClose, onConfirm
}) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (closeError) {
      setError(closeError instanceof Error ? plainWords(closeError.message) : 'The month was not closed');
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title={`Close ${monthLabel}?`} subtitle="Nothing dated in it can then be added, changed or deleted until an admin reopens it" icon="solar:lock-keyhole-bold-duotone" tone="green"
      footer={<><SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton><PrimaryButton icon="solar:lock-keyhole-bold-duotone" onClick={() => void confirm()} busy={busy}>Close {monthLabel}</PrimaryButton></>}>
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        <ReportPreview report={closingText} empty={{ title: '', hint: '' }} pageSize={0} />
        <Field label="Note (optional)" htmlFor="month-end-notes" hint="Kept with the close, e.g. who checked the figures">
          <textarea id="month-end-notes" rows={2} className={inputClass} value={notes} onChange={event => onNotes(event.target.value)} maxLength={500} />
        </Field>
        <p className="text-xs text-gray-500">The month-end pack is kept with the close, so it can be reprinted exactly as it is now.</p>
      </div>
    </Sheet>
  );
};

const ReopenSheet: React.FC<{ monthLabel: string; role: string | undefined; close: NonNullable<MonthEndData['closes'][number]>; onClose: () => void; onConfirm: (reason: string) => Promise<void> }> = ({
  monthLabel, role, close, onClose, onConfirm
}) => {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = async () => {
    const check = checkReopen({ role, reason, close });
    if (!check.ok) { setError(check.error); return; }
    setBusy(true);
    try {
      await onConfirm(reason);
    } catch (reopenError) {
      setError(reopenError instanceof Error ? plainWords(reopenError.message) : 'The month was not reopened');
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title={`Reopen ${monthLabel}?`} subtitle="Entries dated in it can then be added or changed again. The close and this reason are kept." icon="solar:lock-keyhole-unlocked-bold-duotone" tone="amber"
      footer={<><SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton><PrimaryButton icon="solar:lock-keyhole-unlocked-bold-duotone" onClick={() => void confirm()} busy={busy}>Reopen {monthLabel}</PrimaryButton></>}>
      <div className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Why is the month reopened?" htmlFor="reopen-reason" hint="For example: the NHP remittance for September arrived after the close">
          <textarea id="reopen-reason" rows={3} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={500} />
        </Field>
      </div>
    </Sheet>
  );
};

const EmailPackSheet: React.FC<{ defaultTo: string; monthLabel: string; onClose: () => void; onSend: (to: string) => Promise<void> }> = ({ defaultTo, monthLabel, onClose, onSend }) => {
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async () => {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim())) { setError('Enter an email address'); return; }
    setBusy(true);
    setError(null);
    try {
      await onSend(to.trim());
    } catch (sendError) {
      setError(sendError instanceof Error ? plainWords(sendError.message) : 'The email was not sent');
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title={`Email the ${monthLabel} pack`} subtitle="Sent through the practice's email, and logged" icon="solar:letter-bold-duotone"
      footer={<><SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton><PrimaryButton icon="solar:letter-bold-duotone" onClick={() => void send()} busy={busy}>Send</PrimaryButton></>}>
      <div className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="To" htmlFor="pack-email">
          <input id="pack-email" type="email" className={inputClass} value={to} onChange={event => setTo(event.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
};
