import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { toast } from 'react-hot-toast';
import { Icon } from '@iconify/react';
import { addDays, parseISO } from 'date-fns';
import DateInput from '../../ui/DateInput';
import { formatNad, fromCents } from '../../../utils/billing/money';
import {
  checkDepositSlip,
  checkMarkDeposited,
  depositAmountCents,
  depositCandidates,
  depositWarnings,
  toDateKey,
  type BankDeposit
} from '../../../services/ledgerService';
import { ActionButton, EmptyState, Notice, SectionCard } from '../FinanceUI';
import { ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, inputClass } from '../receipts/ArUi';
import { formatDay, printDocument } from '../receipts/receiptDocuments';
import { isArNotSetUp } from '../receipts/arService';
import { cancelDeposit, loadDeposits, markDeposited, prepareDeposit, type DepositData } from './controlsService';
import { depositSlipHtml } from './controlsDocuments';
import { CONTROLS_NOT_SET_UP_MESSAGE } from './controlsCopy';

const nad = (cents: number) => formatNad(fromCents(cents));

/** How far back unbanked cash is looked for */
const LOOK_BACK_DAYS = 120;

const STATUS_STYLE: Record<BankDeposit['status'], { label: string; className: string }> = {
  prepared: { label: 'Not banked yet', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  deposited: { label: 'Deposited', className: 'bg-green-50 text-green-700 border-green-200' },
  cancelled: { label: 'Cancelled', className: 'bg-gray-100 text-gray-600 border-gray-200' }
};

interface DepositSlipsProps {
  practiceId: string;
  practiceName: string;
  /** Cash received up to this day goes on the slip */
  upToKey: string;
  patientNames: Readonly<Record<string, string>>;
  staffNames: Readonly<Record<string, string>>;
}

/**
 * Deposit slips: the cash waiting to be banked (cash receipts not on a slip, less cash refunds paid
 * from the till), a printable slip, and "deposited" with the bank's reference once it is banked.
 */
export const DepositSlips: React.FC<DepositSlipsProps> = ({ practiceId, practiceName, upToKey, patientNames, staffNames }) => {
  const [data, setData] = useState<DepositData | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'not_set_up' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [banking, setBanking] = useState<BankDeposit | null>(null);
  const [cancelling, setCancelling] = useState<BankDeposit | null>(null);
  const todayKey = toDateKey(new Date());

  const load = useCallback(() => {
    let cancelled = false;
    setState(current => (current === 'ready' ? current : 'loading'));
    loadDeposits(practiceId, toDateKey(addDays(parseISO(upToKey), -LOOK_BACK_DAYS)))
      .then(result => { if (!cancelled) { setData(result); setState('ready'); setError(null); } })
      .catch(loadError => {
        if (cancelled) return;
        if (isArNotSetUp(loadError)) { setState('not_set_up'); return; }
        setError(loadError instanceof Error ? plainWords(loadError.message) : 'Could not load the deposit slips');
        setState('error');
      });
    return () => { cancelled = true; };
  }, [practiceId, upToKey]);
  useEffect(() => load(), [load]);

  const candidates = useMemo(() => (data ? depositCandidates(data.receipts, data.refunds, data.deposits, upToKey) : null), [data, upToKey]);
  useEffect(() => setExcluded(new Set()), [candidates]);
  const chosenReceipts = candidates?.receipts.filter(receipt => !excluded.has(receipt.id)) ?? [];
  const chosenRefunds = candidates?.refunds.filter(refund => !excluded.has(refund.id)) ?? [];
  const check = checkDepositSlip(chosenReceipts, chosenRefunds);
  const receiptsById = useMemo(() => new Map((data?.receipts ?? []).map(receipt => [receipt.id, receipt])), [data]);
  const refundsById = useMemo(() => new Map((data?.refunds ?? []).map(refund => [refund.id, refund])), [data]);

  const toggle = (id: string) => setExcluded(current => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const print = (deposit: BankDeposit) => {
    const html = depositSlipHtml(
      deposit,
      deposit.receiptIds.map(id => receiptsById.get(id)).filter((receipt): receipt is NonNullable<typeof receipt> => !!receipt),
      deposit.refundIds.map(id => refundsById.get(id)).filter((refund): refund is NonNullable<typeof refund> => !!refund),
      { practiceName, payerNames: patientNames, preparedBy: deposit.preparedBy ? staffNames[deposit.preparedBy] ?? null : null }
    );
    if (!printDocument(html)) toast.error('Your browser blocked the print window. Allow pop-ups for this site and try again.');
  };

  const prepare = async () => {
    if (!check.ok) return;
    setSaving(true);
    try {
      const result = await prepareDeposit(practiceId, chosenReceipts.map(receipt => receipt.id), chosenRefunds.map(refund => refund.id), notes);
      toast.success(`Deposit slip ${result.number} prepared: ${nad(depositAmountCents(chosenReceipts, chosenRefunds))} to bank`);
      setNotes('');
      load();
    } catch (saveError) {
      toast.error(saveError instanceof Error ? plainWords(saveError.message) : 'The slip was not prepared');
    } finally {
      setSaving(false);
    }
  };

  if (state === 'not_set_up') return <Notice tone="info" title="Deposit slips are not set up yet">{CONTROLS_NOT_SET_UP_MESSAGE}</Notice>;

  return (
    <SectionCard
      title="Deposit slips"
      subtitle={`Cash received up to ${formatDay(upToKey)} that is not banked yet`}
      icon="solar:banknote-2-bold-duotone"
      tone="green"
      actions={<ActionButton icon="solar:refresh-bold-duotone" label="Refresh" onClick={load} />}
    >
      {state === 'error' && <ErrorBox>{error}</ErrorBox>}
      {state === 'loading' && <div className="h-24 animate-pulse rounded-lg bg-gray-100" role="status" aria-label="Loading deposit slips" />}
      {state === 'ready' && candidates && (
        <div className="space-y-5">
          {candidates.receipts.length === 0 ? (
            <EmptyState compact icon="solar:check-circle-bold-duotone" title="All cash is banked" message="Cash receipts appear here until they are on a deposit slip." />
          ) : (
            <div className="space-y-3">
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200" aria-label="Cash to bank">
                {candidates.receipts.map(receipt => (
                  <li key={receipt.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      checked={!excluded.has(receipt.id)}
                      onChange={() => toggle(receipt.id)}
                      aria-label={`Bank receipt ${receipt.number}`}
                    />
                    <span className="font-mono text-cyan-700">{receipt.number}</span>
                    <span className="hidden text-gray-500 sm:inline">{formatDay(receipt.receivedOn)}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-700">{(receipt.patientId && patientNames[receipt.patientId]) || receipt.payerName || ''}</span>
                    <span className="font-medium tabular-nums">{nad(receipt.amountCents)}</span>
                  </li>
                ))}
                {candidates.refunds.map(refund => (
                  <li key={refund.id} className="flex items-center gap-3 bg-gray-50 px-3 py-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-cyan-600 focus:ring-cyan-500"
                      checked={!excluded.has(refund.id)}
                      onChange={() => toggle(refund.id)}
                      aria-label={`Take cash refund ${refund.number} off the slip`}
                    />
                    <span className="font-mono text-gray-600">{refund.number}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-600">Cash refund paid from the till</span>
                    <span className="font-medium tabular-nums text-gray-700">-{nad(refund.amountCents)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Note on the slip (optional)" htmlFor="deposit-notes" className="min-w-0 flex-1">
                  <input id="deposit-notes" className={inputClass} value={notes} onChange={event => setNotes(event.target.value)} maxLength={200} />
                </Field>
                <PrimaryButton icon="solar:banknote-2-bold-duotone" onClick={() => void prepare()} busy={saving} disabled={!check.ok}>
                  Prepare slip: {nad(depositAmountCents(chosenReceipts, chosenRefunds))}
                </PrimaryButton>
              </div>
              {!check.ok && chosenReceipts.length > 0 && <p className="text-xs text-red-600" role="alert">{check.error}</p>}
            </div>
          )}

          {data && data.deposits.length > 0 && (
            <div>
              <h4 className="mb-2 text-sm font-semibold text-gray-800">Recent slips</h4>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {data.deposits.slice(0, 12).map(deposit => {
                  const warnings = depositWarnings(deposit, receiptsById, refundsById);
                  const style = STATUS_STYLE[deposit.status];
                  return (
                    <li key={deposit.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-sm">
                      <span className="font-mono font-medium text-gray-900">{deposit.number}</span>
                      <span className="text-gray-500">{formatDay(deposit.preparedOn)}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}>{style.label}</span>
                      {deposit.status === 'deposited' && <span className="text-xs text-gray-500">Banked {formatDay(deposit.depositedOn)} · ref {deposit.bankReference}</span>}
                      <span className="ml-auto font-medium tabular-nums">{nad(deposit.amountCents)}</span>
                      <span className="flex w-full flex-wrap gap-2 sm:w-auto">
                        <SecondaryButton icon="solar:printer-minimalistic-bold-duotone" onClick={() => print(deposit)} className="!px-2.5 !py-1">Print</SecondaryButton>
                        {deposit.status === 'prepared' && (
                          <>
                            <SecondaryButton icon="solar:check-circle-bold-duotone" onClick={() => setBanking(deposit)} className="!px-2.5 !py-1">Deposited</SecondaryButton>
                            <SecondaryButton icon="solar:close-circle-bold-duotone" onClick={() => setCancelling(deposit)} className="!px-2.5 !py-1">Cancel</SecondaryButton>
                          </>
                        )}
                      </span>
                      {warnings.map(warning => <p key={warning} className="w-full text-xs text-red-700" role="alert">{warning}</p>)}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      )}

      {banking && <MarkDepositedSheet deposit={banking} todayKey={todayKey} onClose={() => setBanking(null)} onDone={() => { setBanking(null); load(); }} />}
      {cancelling && <CancelDepositSheet deposit={cancelling} onClose={() => setCancelling(null)} onDone={() => { setCancelling(null); load(); }} />}
    </SectionCard>
  );
};

const MarkDepositedSheet: React.FC<{ deposit: BankDeposit; todayKey: string; onClose: () => void; onDone: () => void }> = ({ deposit, todayKey, onClose, onDone }) => {
  const [reference, setReference] = useState('');
  const [depositedOn, setDepositedOn] = useState(todayKey);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const check = checkMarkDeposited({ status: deposit.status, bankReference: reference, depositedOn, preparedOn: deposit.preparedOn, todayKey });
  const save = async () => {
    if (!check.ok) { setError(check.error); return; }
    setSaving(true);
    try {
      await markDeposited(deposit.id, reference, depositedOn);
      toast.success(`${deposit.number} marked deposited`);
      onDone();
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'Not saved');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open onClose={onClose} busy={saving} size="md" title={`Deposited: ${deposit.number}`} subtitle={`${nad(deposit.amountCents)} prepared ${formatDay(deposit.preparedOn)}`} icon="solar:banknote-2-bold-duotone" tone="green"
      footer={<><SecondaryButton onClick={onClose} disabled={saving}>Back</SecondaryButton><PrimaryButton onClick={() => void save()} busy={saving}>Mark deposited</PrimaryButton></>}>
      <div className="space-y-4">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Bank reference" htmlFor="deposit-reference" hint="From the deposit slip stamp or the bank app">
          <input id="deposit-reference" className={inputClass} value={reference} onChange={event => setReference(event.target.value)} maxLength={60} />
        </Field>
        <DateInput label="Banked on" value={depositedOn} onChange={setDepositedOn} maxDate={todayKey} minDate={deposit.preparedOn ?? undefined} />
      </div>
    </Sheet>
  );
};

const CancelDepositSheet: React.FC<{ deposit: BankDeposit; onClose: () => void; onDone: () => void }> = ({ deposit, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async () => {
    if (reason.trim().length < 3) { setError('Say why the slip is cancelled'); return; }
    setSaving(true);
    try {
      await cancelDeposit(deposit.id, reason);
      toast.success(`${deposit.number} cancelled: its receipts can go on a new slip`);
      onDone();
    } catch (saveError) {
      setError(saveError instanceof Error ? plainWords(saveError.message) : 'Not cancelled');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open onClose={onClose} busy={saving} size="md" title={`Cancel ${deposit.number}?`} subtitle="Its receipts go back to the cash waiting to be banked" icon="solar:close-circle-bold-duotone" tone="red"
      footer={<><SecondaryButton onClick={onClose} disabled={saving}>Back</SecondaryButton><PrimaryButton tone="red" icon="solar:close-circle-bold-duotone" onClick={() => void save()} busy={saving}>Cancel the slip</PrimaryButton></>}>
      <div className="space-y-3">
        {error && <ErrorBox>{error}</ErrorBox>}
        <Field label="Reason" htmlFor="deposit-cancel-reason">
          <input id="deposit-cancel-reason" className={inputClass} value={reason} onChange={event => setReason(event.target.value)} maxLength={200} />
        </Field>
        <p className="flex items-start gap-2 text-xs text-gray-500"><Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 flex-shrink-0" aria-hidden="true" />A slip that is banked cannot be cancelled. The slip stays in the list as cancelled.</p>
      </div>
    </Sheet>
  );
};
