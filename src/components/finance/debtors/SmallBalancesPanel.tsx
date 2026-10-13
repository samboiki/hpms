import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  DEFAULT_SMALL_BALANCE_AGE_DAYS,
  DEFAULT_SMALL_BALANCE_MAX_CENTS,
  SMALL_BALANCE_AGES,
  SMALL_BALANCE_EXCLUSION_LABELS,
  SMALL_BALANCE_REASON_CODE,
  canApproveWriteOffs,
  centsToInput,
  parseAmountInput,
  planSmallBalances,
  runOutcome,
  runSmallBalanceWriteOffs,
  smallBalanceSelection,
  writeOffReasonLabel,
  type AgeAnalysisContext,
  type AgingReport,
  type SmallBalanceAccount,
  type SmallBalanceExclusion,
  type SmallBalanceLine,
  type SmallBalanceRun,
  type WriteOffResult
} from '../../../services/ledgerService';
import { useAuthStore } from '../../../stores/authStore';
import { invoiceLink, patientBillingLink } from '../../billing/invoiceLinks';
import { DataTable, type TableColumn } from '../DataTable';
import { EmptyState, Notice, SectionCard } from '../FinanceUI';
import { AmountInput, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass } from '../receipts/ArUi';
import { loadStaffNames } from '../receipts/arService';
import { errorText, loadSmallBalanceRuns, writeOffSmallBalance } from './debtorsService';

const nad = (cents: number) => formatNad(fromCents(cents));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;
const whenText = (iso: string): string =>
  iso ? new Date(iso).toLocaleString('en-NA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const newRunId = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;

interface SmallBalancesPanelProps {
  practiceId: string;
  aging: AgingReport;
  context: AgeAnalysisContext;
  /** Who pays for each patient (a family is one account) */
  accountOf: (patientId: string) => string;
  /** Write-offs change balances: Finance reloads after a run */
  onChanged: () => void;
}

interface Run {
  runId: string;
  reason: string;
  results: WriteOffResult[];
}

/**
 * Small balances (Finance > Debtors): choose the largest amount and how old the debt must be, see
 * every account with a total, untick any, and write them off with one reason. Only administrators
 * and doctors run it (the database approves each write-off again); every balance is its own
 * write-off, and anything the database refuses is listed with its reason and can be tried again.
 */
export const SmallBalancesPanel: React.FC<SmallBalancesPanelProps> = ({ practiceId, aging, context, accountOf, onChanged }) => {
  const user = useAuthStore(state => state.user);
  const canRun = canApproveWriteOffs(user?.role);
  const [maxText, setMaxText] = useState(centsToInput(DEFAULT_SMALL_BALANCE_MAX_CENTS));
  const [minAgeDays, setMinAgeDays] = useState(DEFAULT_SMALL_BALANCE_AGE_DAYS);
  const [unticked, setUnticked] = useState<Set<string>>(() => new Set());
  const [reason, setReason] = useState(writeOffReasonLabel(SMALL_BALANCE_REASON_CODE));
  const [confirming, setConfirming] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [run, setRun] = useState<Run | null>(null);
  const [runs, setRuns] = useState<SmallBalanceRun[] | null>(null);
  const [runNames, setRunNames] = useState<{ patients: Record<string, string>; staff: Record<string, string> }>({ patients: {}, staff: {} });
  const [runsError, setRunsError] = useState<string | null>(null);
  const [openRunId, setOpenRunId] = useState<string | null>(null);
  const [runsKey, setRunsKey] = useState(0);

  // The runs so far (each write-off links to its patient and invoice)
  useEffect(() => {
    let cancelled = false;
    loadSmallBalanceRuns(practiceId)
      .then(async loaded => {
        const staff = await loadStaffNames(practiceId, loaded.runs.map(item => item.by)).catch(() => ({} as Record<string, string>));
        if (cancelled) return;
        setRuns(loaded.runs);
        setRunNames({ patients: loaded.patientNames, staff });
        setRunsError(null);
      })
      .catch(loadError => { if (!cancelled) setRunsError(errorText(loadError, 'The earlier runs could not be loaded')); });
    return () => { cancelled = true; };
  }, [practiceId, runsKey]);

  const maxCents = parseAmountInput(maxText);
  const plan = useMemo(
    () => (maxCents === null ? null : planSmallBalances({
      items: aging.items,
      accountOf,
      names: context.patientNames,
      creditByPatient: context.creditByPatient,
      flagsByPatient: context.flagsByPatient,
      maxCents,
      minAgeDays
    })),
    [aging.items, accountOf, context.patientNames, context.creditByPatient, context.flagsByPatient, maxCents, minAgeDays]
  );
  const selection = useMemo(() => (plan ? smallBalanceSelection(plan.accounts, unticked) : null), [plan, unticked]);
  const excluded = Object.entries(plan?.excluded ?? {}) as Array<[SmallBalanceExclusion, number]>;
  const reasonProblem = reason.trim().length < 3 ? 'Give the reason: it is kept with each write-off and shown on the account' : null;
  const patientName = (patientId: string | null) => (patientId ? context.patientNames[patientId] ?? runNames.patients[patientId] ?? 'Patient' : 'Patient');

  const toggle = (accountId: string) => setUnticked(previous => {
    const next = new Set(previous);
    if (next.has(accountId)) next.delete(accountId);
    else next.add(accountId);
    return next;
  });

  const writeOff = useCallback(async (runId: string, runReason: string, lines: readonly SmallBalanceLine[]) => {
    setProgress({ done: 0, total: lines.length });
    const results = await runSmallBalanceWriteOffs(
      lines,
      line => writeOffSmallBalance({ practiceId, runId, line, reason: runReason }),
      (done, total) => setProgress({ done, total })
    );
    setProgress(null);
    // A retry replaces the earlier result of the same balances
    setRun(previous => {
      if (!previous || previous.runId !== runId) return { runId, reason: runReason, results };
      const retried = new Map(results.map(result => [result.line.invoiceId, result]));
      return { ...previous, results: previous.results.map(result => retried.get(result.line.invoiceId) ?? result) };
    });
    setRunsKey(key => key + 1);
    if (results.some(result => result.ok)) onChanged();
  }, [practiceId, onChanged]);

  const start = () => {
    if (!selection || selection.lines.length === 0 || reasonProblem) return;
    void writeOff(newRunId(), reason.trim(), selection.lines).finally(() => setConfirming(false));
  };

  const columns: TableColumn<SmallBalanceAccount>[] = [
    {
      key: 'tick',
      header: 'Write off',
      render: account => (
        <input
          type="checkbox"
          className="h-4 w-4 rounded border-gray-300 text-cyan-600"
          checked={!unticked.has(account.accountId)}
          onChange={() => toggle(account.accountId)}
          aria-label={`Write off ${account.name}`}
          disabled={progress !== null}
        />
      )
    },
    {
      key: 'account',
      header: 'Account',
      render: account => (
        <Link to={patientBillingLink(account.accountId)} className="font-medium text-cyan-700 hover:underline">{account.name}</Link>
      )
    },
    {
      key: 'invoices',
      header: 'Invoices',
      hideBelow: 'sm',
      render: account => (
        <span className="flex flex-wrap gap-x-2">
          {account.lines.map(line => (
            <Link key={line.invoiceId} to={invoiceLink(line.invoiceId)} className="text-cyan-700 hover:underline" title={`${patientName(line.patientId)}: ${nad(line.amountCents)}`}>
              {line.invoiceNumber}
            </Link>
          ))}
        </span>
      )
    },
    {
      key: 'age',
      header: 'Owed for',
      hideBelow: 'md',
      render: account => {
        const ages = account.lines.map(line => line.ageDays).filter((days): days is number => days !== null);
        return ages.length > 0 ? `${Math.min(...ages)}+ days` : 'Undated';
      }
    },
    { key: 'amount', header: 'Amount', align: 'right', render: account => <span className="font-semibold text-gray-900">{nad(account.owedCents)}</span> }
  ];

  const outcome = run ? runOutcome(run.results) : null;

  return (
    <SectionCard
      title="Small balances"
      subtitle="Write off what costs more to chase than it is worth, with one reason"
      icon="solar:eraser-bold-duotone"
      tone="amber"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Balances of at most" htmlFor="small-balance-max" error={maxText.trim() && maxCents === null ? 'Enter an amount like 10.00' : null}>
            <AmountInput id="small-balance-max" value={maxText} onChange={event => setMaxText(event.target.value)} invalid={!!maxText.trim() && maxCents === null} disabled={progress !== null} />
          </Field>
          <Field label="Owed for at least" htmlFor="small-balance-age" hint="Every part of the balance must be this old">
            <select id="small-balance-age" className={inputClass} value={minAgeDays} onChange={event => setMinAgeDays(Number(event.target.value))} disabled={progress !== null}>
              {SMALL_BALANCE_AGES.map(days => <option key={days} value={days}>{days} days</option>)}
            </select>
          </Field>
          {canRun && (
            <Field label="Reason (kept with each write-off)" htmlFor="small-balance-reason" error={reasonProblem && reason.length > 0 ? reasonProblem : null} className="sm:col-span-2 lg:col-span-1">
              <input id="small-balance-reason" className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={200} disabled={progress !== null} />
            </Field>
          )}
        </div>

        {!canRun && (
          <Notice tone="info" title="Only a practice administrator or doctor can write off balances">
            You can see the list. Ask one of them to run it: each write-off is approved in their name.
          </Notice>
        )}

        {!plan || !selection ? null : plan.accounts.length === 0 ? (
          <EmptyState
            compact
            icon="solar:check-circle-bold-duotone"
            title="No small balances to write off"
            message={`No account owes ${maxCents === null ? 'that' : nad(maxCents)} or less on balances ${minAgeDays} days or older.`}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-700">
                <span className="font-semibold text-gray-900">{nad(selection.totalCents)}</span> on {plural(selection.accounts.length, 'account', 'accounts')} ({plural(selection.lines.length, 'balance', 'balances')})
                {selection.accounts.length < plan.accounts.length ? `, ${plan.accounts.length - selection.accounts.length} unticked` : ''}.
              </p>
              <div className="flex flex-wrap gap-2">
                <SecondaryButton
                  className="!px-2.5 !py-1"
                  onClick={() => setUnticked(previous => (previous.size === 0 ? new Set(plan.accounts.map(account => account.accountId)) : new Set()))}
                  disabled={progress !== null}
                >
                  {unticked.size === 0 ? 'Untick all' : 'Tick all'}
                </SecondaryButton>
                {canRun && (
                  <PrimaryButton
                    icon="solar:eraser-bold-duotone"
                    onClick={() => setConfirming(true)}
                    disabled={selection.lines.length === 0 || !!reasonProblem || progress !== null}
                  >
                    Write off {nad(selection.totalCents)}
                  </PrimaryButton>
                )}
              </div>
            </div>
            <DataTable
              rows={plan.accounts}
              columns={columns}
              rowKey={account => account.accountId}
              itemLabel="accounts"
              resetKey={`${maxCents}|${minAgeDays}`}
              totals={['', 'Ticked', '', '', nad(selection.totalCents)]}
            />
          </>
        )}

        {excluded.length > 0 && (
          <p className="text-xs text-gray-500">
            Left out: {excluded.map(([reasonKey, count]) => `${SMALL_BALANCE_EXCLUSION_LABELS[reasonKey]} (${count})`).join(', ')}.
          </p>
        )}

        <RunsList
          runs={runs}
          error={runsError}
          openRunId={openRunId}
          onToggle={runId => setOpenRunId(current => (current === runId ? null : runId))}
          patientName={patientName}
          staffName={id => (id ? runNames.staff[id] ?? 'Staff member' : 'Staff member')}
        />
      </div>

      {confirming && selection && !run && (
        <Sheet
          open
          onClose={() => setConfirming(false)}
          busy={progress !== null}
          size="md"
          title={`Write off ${nad(selection.totalCents)}?`}
          icon="solar:eraser-bold-duotone"
          tone="amber"
          footer={
            <>
              <SecondaryButton onClick={() => setConfirming(false)} disabled={progress !== null}>Back</SecondaryButton>
              <PrimaryButton onClick={start} busy={progress !== null}>
                {progress ? `Writing off ${progress.done} of ${progress.total}...` : `Write off ${plural(selection.lines.length, 'balance', 'balances')}`}
              </PrimaryButton>
            </>
          }
        >
          <div className="space-y-3 text-sm text-gray-700">
            <p>
              {plural(selection.accounts.length, 'account', 'accounts')}, {plural(selection.lines.length, 'balance', 'balances')}. Each balance gets its own write-off with the reason
              &quot;{reason.trim()}&quot;, approved in your name. The database checks each one again; anything it refuses is listed with the reason.
            </p>
            <p className="text-xs text-gray-500">A write-off can be reversed from its invoice if it was wrong: the balance is then owed again.</p>
          </div>
        </Sheet>
      )}

      {run && outcome && (
        <Sheet
          open
          onClose={() => { if (!progress) { setRun(null); setConfirming(false); } }}
          busy={progress !== null}
          size="lg"
          title={outcome.failed.length === 0 ? 'Small balances written off' : 'Not everything was written off'}
          icon={outcome.failed.length === 0 ? 'solar:check-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'}
          tone={outcome.failed.length === 0 ? 'green' : 'amber'}
          footer={
            <>
              {outcome.failed.length > 0 && (
                <SecondaryButton
                  icon="solar:refresh-bold-duotone"
                  onClick={() => void writeOff(run.runId, run.reason, outcome.failed.map(result => result.line))}
                  disabled={progress !== null}
                >
                  {progress
                    ? `Trying ${progress.done} of ${progress.total}...`
                    : outcome.failed.length === 1 ? 'Try the refused one again' : `Try the ${outcome.failed.length} refused ones again`}
                </SecondaryButton>
              )}
              <PrimaryButton onClick={() => { setRun(null); setConfirming(false); }} disabled={progress !== null}>Done</PrimaryButton>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-sm font-medium text-gray-900" role="status">{outcome.headline}</p>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 space-y-1">
              <SummaryRow label="Written off" value={nad(outcome.doneCents)} strong tone="good" />
              {outcome.failed.length > 0 && <SummaryRow label="Not written off" value={nad(outcome.failedCents)} tone="warning" />}
            </div>
            {outcome.failed.length > 0 && (
              <ul className="divide-y divide-gray-100 rounded-xl border border-amber-200" aria-label="Balances not written off">
                {outcome.failed.map(result => (
                  <li key={result.line.invoiceId} className="space-y-0.5 px-3 py-2 text-sm">
                    <p className="flex flex-wrap items-center gap-x-2">
                      <Link to={patientBillingLink(result.line.patientId)} className="font-medium text-cyan-700 hover:underline">{patientName(result.line.patientId)}</Link>
                      <Link to={invoiceLink(result.line.invoiceId)} className="text-cyan-700 hover:underline">{result.line.invoiceNumber}</Link>
                      <span className="tabular-nums text-gray-700">{nad(result.line.amountCents)}</span>
                    </p>
                    <p className="text-xs text-amber-800">{result.error}</p>
                  </li>
                ))}
              </ul>
            )}
            {outcome.failed.length > 0 && <ErrorBox>Nothing was guessed: the balances above still stand. Fix the reason given and try them again, or leave them.</ErrorBox>}
          </div>
        </Sheet>
      )}
    </SectionCard>
  );
};

const RunsList: React.FC<{
  runs: SmallBalanceRun[] | null;
  error: string | null;
  openRunId: string | null;
  onToggle: (runId: string) => void;
  patientName: (patientId: string | null) => string;
  staffName: (userId: string | null) => string;
}> = ({ runs, error, openRunId, onToggle, patientName, staffName }) => {
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!runs || runs.length === 0) return null;
  return (
    <section aria-labelledby="small-balance-runs">
      <h4 id="small-balance-runs" className="mb-2 text-sm font-semibold text-gray-800">Runs</h4>
      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 text-sm">
        {runs.slice(0, 12).map(item => {
          const open = openRunId === item.runId;
          return (
            <li key={item.runId} className="px-3 py-2">
              <button
                type="button"
                onClick={() => onToggle(item.runId)}
                aria-expanded={open}
                className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 rounded"
              >
                <span className="font-medium text-gray-900">{whenText(item.at)}</span>
                <span className="text-gray-600">{plural(item.lines.length - item.reversedCount, 'balance', 'balances')}, {nad(item.totalCents)}</span>
                <span className="text-gray-500">by {staffName(item.by)}</span>
                {item.reversedCount > 0 && <span className="text-xs text-red-700">{item.reversedCount} reversed</span>}
                <span className="ml-auto text-xs font-medium text-cyan-700">{open ? 'Hide' : 'Show'}</span>
              </button>
              {open && (
                <div className="mt-2 space-y-2">
                  <p className="text-xs text-gray-500">Reason: {item.reason}</p>
                  <ul className="space-y-1">
                    {item.lines.map(line => (
                      <li key={line.adjustmentId} className="flex flex-wrap items-center gap-x-3 text-sm">
                        <span className="font-mono text-xs text-gray-500">{line.number}</span>
                        {line.patientId
                          ? <Link to={patientBillingLink(line.patientId)} className="text-cyan-700 hover:underline">{patientName(line.patientId)}</Link>
                          : <span>{patientName(null)}</span>}
                        <Link to={invoiceLink(line.invoiceId)} className="text-cyan-700 hover:underline">{line.invoiceNumber}</Link>
                        <span className={`tabular-nums ${line.reversed ? 'text-gray-400 line-through' : 'text-gray-800'}`}>{nad(line.amountCents)}</span>
                        {line.reversed && <span className="text-xs text-red-700">Reversed</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};
