import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  DEFAULT_INTEREST_SETTINGS,
  INTEREST_EXCLUSION_LABELS,
  centsToInput,
  checkInterestSettings,
  formatMonth,
  interestInvoices,
  parseAmountInput,
  planInterestRun,
  rateBasisPoints,
  type AgeAnalysisContext,
  type AgingReport,
  type InterestExclusionReason,
  type InterestLine,
  type InterestSettings
} from '../../../services/ledgerService';
import { useAuthStore } from '../../../stores/authStore';
import { EmptyState, Notice, SectionCard } from '../FinanceUI';
import { DataTable, type TableColumn } from '../DataTable';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { formatDay } from '../receipts/receiptDocuments';
import {
  errorText,
  loadInterestCharged,
  loadInterestRuns,
  loadInterestSettings,
  postInterestRun,
  reverseInterestRun,
  saveInterestSettings,
  type InterestRun
} from './debtorsService';

const nad = (cents: number) => formatNad(fromCents(cents));

interface InterestPanelProps {
  practiceId: string;
  aging: AgingReport;
  context: AgeAnalysisContext;
  todayKey: string;
  /** Interest journals change balances: Finance reloads after a run or a reversal */
  onChanged: () => void;
}

/**
 * Interest on overdue private accounts. Off unless an admin turns it on; one run a month, at the
 * practice's yearly rate, simple (never on interest), never on disputed or handed-over accounts,
 * on medical aid portions only when the practice says so, and never more than the capital owed.
 * Each charge is a correction journal on the invoice, so a run can be reversed.
 */
export const InterestPanel: React.FC<InterestPanelProps> = ({ practiceId, aging, context, todayKey, onChanged }) => {
  const user = useAuthStore(state => state.user);
  const isAdmin = user?.role === 'admin';
  const [settings, setSettings] = useState<InterestSettings | null>(null);
  const [runs, setRuns] = useState<InterestRun[]>([]);
  const [charged, setCharged] = useState<Record<string, number> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reversing, setReversing] = useState<InterestRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const monthKey = todayKey.slice(0, 7);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadInterestSettings(practiceId), loadInterestRuns(practiceId)])
      .then(([loaded, runRows]) => {
        if (cancelled) return;
        setSettings(loaded ?? DEFAULT_INTEREST_SETTINGS);
        setRuns(runRows);
        setError(null);
      })
      .catch(loadError => { if (!cancelled) setError(errorText(loadError, 'Could not load the interest settings')); });
    return () => { cancelled = true; };
  }, [practiceId, reloadKey]);

  // Interest already standing on each invoice (only needed when interest is on)
  const invoiceIds = useMemo(() => aging.items.filter(item => item.patient > 0 || item.medicalAid > 0).map(item => item.invoice.id), [aging]);
  useEffect(() => {
    if (!settings?.enabled) return;
    let cancelled = false;
    loadInterestCharged(invoiceIds)
      .then(result => { if (!cancelled) setCharged(result); })
      .catch(loadError => { if (!cancelled) setError(errorText(loadError, 'Could not load the interest already charged')); });
    return () => { cancelled = true; };
  }, [settings?.enabled, invoiceIds, reloadKey]);

  const plan = useMemo(
    () => (settings?.enabled && charged ? planInterestRun(interestInvoices(aging, charged), settings, context.flagsByPatient ?? {}) : null),
    [settings, charged, aging, context.flagsByPatient]
  );
  const thisMonth = runs.find(run => run.monthKey === monthKey && !run.reversedAt) ?? null;
  const excluded = useMemo(() => {
    const counts: Partial<Record<InterestExclusionReason, number>> = {};
    for (const item of plan?.excluded ?? []) if (item.reason !== 'nothing_owed') counts[item.reason] = (counts[item.reason] ?? 0) + 1;
    return Object.entries(counts) as Array<[InterestExclusionReason, number]>;
  }, [plan]);

  const post = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      const result = await postInterestRun(practiceId, plan.lines);
      toast.success(`Interest for ${formatMonth(monthKey)} charged on ${result.line_count} ${result.line_count === 1 ? 'invoice' : 'invoices'}`);
      setConfirming(false);
      setReloadKey(key => key + 1);
      onChanged();
    } catch (postError) {
      toast.error(errorText(postError, 'The interest was not charged'));
    } finally {
      setBusy(false);
    }
  };

  const reverse = async (reason: string) => {
    if (!reversing) return;
    setBusy(true);
    try {
      await reverseInterestRun(reversing.id, reason);
      toast.success(`Interest for ${formatMonth(reversing.monthKey)} reversed`);
      setReversing(null);
      setReloadKey(key => key + 1);
      onChanged();
    } catch (reverseError) {
      toast.error(errorText(reverseError, 'The run was not reversed'));
    } finally {
      setBusy(false);
    }
  };

  if (error && !settings) return <ErrorBox>{error}</ErrorBox>;
  if (!settings) return <div className="h-24 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Loading the interest settings" />;

  const columns: TableColumn<InterestLine>[] = [
    { key: 'patient', header: 'Patient', render: line => <span className="font-medium text-gray-900">{context.patientNames[line.patientId] ?? 'Patient'}</span> },
    { key: 'invoice', header: 'Invoice', hideBelow: 'sm', render: line => line.invoiceNumber },
    { key: 'base', header: 'Owed', align: 'right', hideBelow: 'md', render: line => nad(line.baseCents) },
    { key: 'interest', header: 'Interest', align: 'right', render: line => <span className="font-semibold">{nad(line.interestCents)}{line.capped ? ' *' : ''}</span> }
  ];

  return (
    <SectionCard
      title="Interest"
      subtitle={settings.enabled ? `${settings.annualRatePercent}% a year, charged monthly on debts ${settings.minAgeDays} days or older` : 'Off: no interest is charged'}
      icon="solar:graph-up-bold-duotone"
      tone="violet"
      actions={isAdmin ? <SecondaryButton icon="solar:settings-bold-duotone" onClick={() => setEditing(true)}>Settings</SecondaryButton> : undefined}
    >
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        {!settings.enabled ? (
          <EmptyState compact icon="solar:graph-up-bold-duotone" title="Interest is off" message={isAdmin ? 'Turn it on in Settings if your practice charges interest on overdue accounts, and say so on your terms of payment.' : 'An admin can turn it on if the practice charges interest.'} />
        ) : thisMonth ? (
          <Notice tone="info" title={`Interest for ${formatMonth(monthKey)} is charged`}
            action={isAdmin ? <SecondaryButton className="!px-2.5 !py-1" onClick={() => setReversing(thisMonth)}>Reverse</SecondaryButton> : undefined}>
            {nad(thisMonth.totalCents)} on {thisMonth.lineCount} {thisMonth.lineCount === 1 ? 'invoice' : 'invoices'}, on {formatDay(thisMonth.runOn)}. The next run is next month.
          </Notice>
        ) : !plan ? (
          <div className="h-24 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Working out the interest" />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                {formatMonth(monthKey)}: <span className="font-semibold text-gray-900">{nad(plan.totalCents)}</span> on {plan.lines.length} {plan.lines.length === 1 ? 'invoice' : 'invoices'}
                {settings.includeMedicalAidPortion ? ', medical aid portions included (charged to the patient)' : ', on what patients owe'}.
              </p>
              {isAdmin && <PrimaryButton icon="solar:graph-up-bold-duotone" onClick={() => setConfirming(true)} disabled={plan.lines.length === 0}>Charge interest</PrimaryButton>}
            </div>
            <DataTable
              rows={plan.lines}
              columns={columns}
              rowKey={line => line.invoiceId}
              itemLabel="invoices"
              totals={['Total', '', '', nad(plan.totalCents)]}
              empty={<EmptyState compact icon="solar:check-circle-bold-duotone" title="No interest to charge this month" message="Nothing is old enough, or every overdue account is excluded." />}
            />
            {plan.lines.some(line => line.capped) && <p className="text-xs text-gray-500">* Less than a full month: interest may not exceed what is still owed.</p>}
            {excluded.length > 0 && (
              <p className="text-xs text-gray-500">Not charged: {excluded.map(([reason, count]) => `${INTEREST_EXCLUSION_LABELS[reason].toLowerCase()} (${count})`).join(', ')}.</p>
            )}
          </>
        )}

        {runs.length > 0 && (
          <div>
            <h4 className="mb-2 text-sm font-semibold text-gray-800">Runs</h4>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
              {runs.slice(0, 12).map(run => (
                <li key={run.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                  <span className="font-medium text-gray-900">{formatMonth(run.monthKey)}</span>
                  <span className="text-gray-600">{nad(run.totalCents)} on {run.lineCount} at {run.annualRatePercent}%</span>
                  {run.reversedAt && <span className="text-xs text-red-700">Reversed: {run.reversalReason}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {editing && <InterestSettingsSheet practiceId={practiceId} settings={settings} onClose={() => setEditing(false)} onSaved={() => { setEditing(false); setReloadKey(key => key + 1); }} />}
      {confirming && plan && (
        <Sheet open onClose={() => setConfirming(false)} busy={busy} size="md" title={`Charge interest for ${formatMonth(monthKey)}?`} icon="solar:graph-up-bold-duotone" tone="violet"
          footer={<><SecondaryButton onClick={() => setConfirming(false)} disabled={busy}>Back</SecondaryButton><PrimaryButton onClick={() => void post()} busy={busy}>Charge {nad(plan.totalCents)}</PrimaryButton></>}>
          <p className="text-sm text-gray-700">
            {plan.lines.length} {plan.lines.length === 1 ? 'invoice gets' : 'invoices get'} an interest line, shown on the next statement. The database checks each amount again.
            A run can be reversed (with a reason) if it was wrong.
          </p>
        </Sheet>
      )}
      {reversing && <ReverseSheet run={reversing} busy={busy} onClose={() => setReversing(null)} onConfirm={reason => void reverse(reason)} />}
    </SectionCard>
  );
};

const ReverseSheet: React.FC<{ run: InterestRun; busy: boolean; onClose: () => void; onConfirm: (reason: string) => void }> = ({ run, busy, onClose, onConfirm }) => {
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title={`Reverse the interest for ${formatMonth(run.monthKey)}?`} icon="solar:undo-left-round-bold-duotone" tone="red"
      footer={<>
        <SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton>
        <PrimaryButton tone="red" busy={busy} onClick={() => { if (reason.trim().length < 3) setError('Say why the interest is reversed'); else onConfirm(reason); }}>Reverse {nad(run.totalCents)}</PrimaryButton>
      </>}>
      <div className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <p className="text-sm text-gray-700">Every interest line of the run is reversed on today&apos;s date. The run stays on record with your reason.</p>
        <Field label="Why?" htmlFor="interest-reverse-reason">
          <input id="interest-reverse-reason" className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={200} />
        </Field>
      </div>
    </Sheet>
  );
};

const InterestSettingsSheet: React.FC<{ practiceId: string; settings: InterestSettings; onClose: () => void; onSaved: () => void }> = ({ practiceId, settings, onClose, onSaved }) => {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [rate, setRate] = useState(settings.annualRatePercent > 0 ? String(settings.annualRatePercent) : '');
  const [minAgeDays, setMinAgeDays] = useState(settings.minAgeDays);
  const [includeMedicalAid, setIncludeMedicalAid] = useState(settings.includeMedicalAidPortion);
  const [minimum, setMinimum] = useState(centsToInput(settings.minimumChargeCents));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const minimumCents = minimum.trim() ? parseAmountInput(minimum) : 0;
    if (minimumCents === null) { setError('Enter the smallest charge in N$'); return; }
    const typed = Number(rate.replace(',', '.')) || 0;
    // Turned off, a half-typed rate is not kept
    const annualRatePercent = enabled || rateBasisPoints(typed) !== null ? typed : 0;
    const next: InterestSettings = { enabled, annualRatePercent, minAgeDays, includeMedicalAidPortion: includeMedicalAid, minimumChargeCents: minimumCents };
    const check = checkInterestSettings(next);
    if (!check.ok) { setError(check.error); return; }
    setBusy(true);
    try {
      await saveInterestSettings(practiceId, next);
      toast.success(enabled ? 'Interest settings saved' : 'Interest is off');
      onSaved();
    } catch (saveError) {
      setError(errorText(saveError, 'Not saved'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} busy={busy} size="md" title="Interest settings" subtitle="Only admins change these" icon="solar:settings-bold-duotone" tone="violet"
      footer={<><SecondaryButton onClick={onClose} disabled={busy}>Back</SecondaryButton><PrimaryButton onClick={() => void save()} busy={busy}>Save</PrimaryButton></>}>
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600" checked={enabled} onChange={() => setEnabled(value => !value)} />
          <span><span className="font-medium text-gray-900">Charge interest on overdue accounts</span><br /><span className="text-gray-600">Patients must have been told (terms of payment) before interest is charged.</span></span>
        </label>
        {enabled && (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Yearly rate (%)" htmlFor="interest-rate"><input id="interest-rate" className={inputClass} inputMode="decimal" value={rate} onChange={event => setRate(event.target.value)} /></Field>
              <Field label="On debts at least" htmlFor="interest-age">
                <select id="interest-age" className={inputClass} value={minAgeDays} onChange={event => setMinAgeDays(Number(event.target.value))}>
                  {[30, 60, 90, 120].map(days => <option key={days} value={days}>{days} days old</option>)}
                </select>
              </Field>
              <Field label="Smallest charge" htmlFor="interest-minimum"><input id="interest-minimum" className={inputClass} inputMode="decimal" value={minimum} onChange={event => setMinimum(event.target.value)} /></Field>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-violet-600" checked={includeMedicalAid} onChange={() => setIncludeMedicalAid(value => !value)} />
              <span><span className="font-medium text-gray-900">Also on medical aid portions not paid</span><br /><span className="text-gray-600">Charged to the patient. Leave off unless your terms say so.</span></span>
            </label>
          </>
        )}
      </div>
    </Sheet>
  );
};
