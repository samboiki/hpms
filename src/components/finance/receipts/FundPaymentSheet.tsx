import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import DateInput from '../../ui/DateInput';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { formatNad, fromCents, toCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { toDateKey } from '../../../services/ledgerService';
import { claimBatchesLink } from '../../billing/invoiceLinks';
import { AmountInput, ChoiceGroup, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass, type Choice } from './ArUi';
import { AR_NOT_SET_UP_MESSAGE, FUND_NOT_RECORDED, fundKeyOf, isArNotSetUp, loadFundOpenClaims, loadStaffNames, type FundClaim, type FundSummary } from './arService';
import { FundKeyingList } from './FundKeyingList';
import {
  draftFromRow,
  draftKeyedCents,
  draftPayload,
  emptyDraft,
  rowKeysOf,
  summarizeKeying,
  type DraftRow,
  type KeyingClaim,
  type KeyingDraft,
  type KeyingMethod
} from './fundPaymentKeying';
import {
  DraftConflictError,
  KEYING_NOT_SET_UP_MESSAGE,
  discardDraft,
  loadDraft,
  loadDrafts,
  loadKeyingClaims,
  postDraft,
  saveDraft
} from './fundPaymentService';
import { ReceiptShareActions } from './ReceiptShareActions';
import type { ReceiptDocument } from './receiptDocuments';

export interface FundPaymentSheetProps {
  practiceId: string;
  practiceName: string;
  /** Who records it (printed on the receipt) */
  staffName?: string | null;
  overFullScreen?: boolean;
  /** Back to "Receive payment" for money from a patient or someone else */
  onPatientPayment?: () => void;
  onClose: () => void;
  /** A payment was posted (refresh lists and balances) */
  onSaved?: () => void;
}

const nad = (cents: number) => formatNad(fromCents(cents));

const METHOD_CHOICES: readonly Choice<KeyingMethod>[] = [
  { value: 'medical_aid', label: 'Medical aid', icon: 'solar:heart-pulse-bold-duotone' },
  { value: 'eft', label: 'EFT', icon: 'solar:transfer-horizontal-bold-duotone' }
];

const savedAt = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : `${formatServiceDate(date)} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
};

interface Posted {
  receiptId: string;
  document: ReceiptDocument;
  batchesMoved: number;
}

/**
 * Payments > "Medical aid payment": a fund's payment keyed line by line against its total, the way the remittance
 * lists it. Start a payment for a fund (grouped by the fund's code) or carry on one a colleague saved; the payment
 * posts as one receipt once the keyed lines and any credit kept on purpose add up to the amount received.
 */
export const FundPaymentSheet: React.FC<FundPaymentSheetProps> = ({ practiceId, practiceName, staffName, overFullScreen = false, onPatientPayment, onClose, onSaved }) => {
  const [today] = useState(() => toDateKey(new Date()));
  const [funds, setFunds] = useState<FundSummary[] | null>(null);
  const [claims, setClaims] = useState<FundClaim[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [keyingReady, setKeyingReady] = useState(true);
  const [staffNames, setStaffNames] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState<KeyingDraft | null>(null);
  const [keyingClaims, setKeyingClaims] = useState<KeyingClaim[] | null>(null);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState<'save' | 'post' | 'discard' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [posted, setPosted] = useState<Posted | null>(null);

  const loadStart = useCallback(async () => {
    setLoadError(null);
    try {
      const [open, saved] = await Promise.all([loadFundOpenClaims(practiceId), loadDrafts(practiceId)]);
      setFunds(open.funds);
      setClaims(open.claims);
      setDrafts(saved.drafts);
      setKeyingReady(saved.state === 'ready');
      const names = await loadStaffNames(practiceId, saved.drafts.map(row => row.updated_by)).catch(() => ({}));
      setStaffNames(names);
    } catch (error) {
      setFunds([]);
      setLoadError(isArNotSetUp(error) ? AR_NOT_SET_UP_MESSAGE : error instanceof Error ? plainWords(error.message) : 'Could not load the open claims.');
    }
  }, [practiceId]);

  useEffect(() => {
    void loadStart();
  }, [loadStart]);

  // The claim lines of the chosen fund's open claims
  const fundKey = draft ? draft.fundCode ?? FUND_NOT_RECORDED : null;
  useEffect(() => {
    if (!fundKey) {
      setKeyingClaims(null);
      return;
    }
    let cancelled = false;
    setKeyingClaims(null);
    loadKeyingClaims(claims.filter(claim => fundKeyOf(claim) === fundKey))
      .then(result => {
        if (!cancelled) setKeyingClaims(result);
      })
      .catch(error => {
        if (!cancelled) {
          setKeyingClaims([]);
          setLoadError(error instanceof Error ? plainWords(error.message) : 'Could not load the claim lines.');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [fundKey, claims]);

  const summary = useMemo(() => (draft ? summarizeKeying(draft, keyingClaims ?? []) : null), [draft, keyingClaims]);
  // Lines of a saved payment whose claims are no longer owed (paid another way): they are dropped when it is saved
  const droppedRows = useMemo(() => {
    if (!draft || !keyingClaims) return 0;
    const shown = new Set(keyingClaims.flatMap(rowKeysOf));
    return Object.entries(draft.paid).filter(([key, value]) => value.trim() && !shown.has(key)).length;
  }, [draft, keyingClaims]);

  const update = (changes: Partial<KeyingDraft>) => {
    setDraft(previous => (previous ? { ...previous, ...changes } : previous));
    setDirty(true);
    setNotice(null);
  };

  const close = () => {
    if (busy) return;
    if (dirty && draft && !window.confirm('What you keyed is not saved. Close without saving it?')) return;
    onClose();
  };

  const startFund = (fund: FundSummary) => {
    setDraft(emptyDraft(fund.fundCode, fund.key === FUND_NOT_RECORDED ? '' : fund.fund, today));
    setDirty(false);
    setActionError(null);
    setConflict(false);
  };

  const carryOn = (row: DraftRow) => {
    setDraft(draftFromRow(row));
    setDirty(false);
    setActionError(null);
    setConflict(false);
  };

  const fail = (error: unknown, fallback: string) => {
    setConflict(error instanceof DraftConflictError);
    setActionError(error instanceof Error ? plainWords(error.message) : fallback);
  };

  const persist = async (current: KeyingDraft): Promise<KeyingDraft> => {
    const saved = await saveDraft(draftPayload(current, practiceId, keyingClaims ?? []));
    const next = { ...current, id: saved.id, version: saved.version };
    setDraft(next);
    setDirty(false);
    setNotice(`Saved ${savedAt(saved.updated_at)}. You or a colleague can carry on from Payments > Medical aid payment.`);
    return next;
  };

  const save = async () => {
    if (!draft || busy) return;
    setBusy('save');
    setActionError(null);
    try {
      await persist(draft);
    } catch (error) {
      fail(error, 'The payment could not be saved.');
    } finally {
      setBusy(null);
    }
  };

  const post = async () => {
    if (!draft || !summary?.balanced || busy || summary.controlCents === null) return;
    const claimsPaid = [...summary.claims.values()].filter(item => item.paidCents > 0).length;
    if (!window.confirm(`Post ${nad(summary.controlCents)} from ${draft.fundName} as one receipt, paid on ${claimsPaid} claim(s)?`)) return;
    setBusy('post');
    setActionError(null);
    try {
      const current = dirty || !draft.id || draft.version === null ? await persist(draft) : draft;
      const result = await postDraft(current.id as string, current.version as number);
      const invoiceNumbers = new Map((keyingClaims ?? []).map(claim => [claim.invoiceId, claim.invoiceNumber]));
      setPosted({
        receiptId: result.receipt_id,
        batchesMoved: result.batches_moved ?? 0,
        document: {
          practiceName,
          receiptNumber: result.receipt_number,
          receivedOn: current.receivedOn,
          payer: current.fundName,
          method: current.method,
          amountCents: summary.controlCents,
          reference: current.reference.trim() || null,
          lines: [...summary.claims.entries()]
            .filter(([, item]) => item.paidCents > 0)
            .map(([invoiceId, item]) => ({ invoiceNumber: invoiceNumbers.get(invoiceId) ?? 'Invoice', portion: 'medical_aid' as const, amountCents: item.paidCents })),
          unallocatedCents: summary.unmatchedCents,
          receivedBy: staffName ?? null
        }
      });
      setDirty(false);
      onSaved?.();
    } catch (error) {
      fail(error, 'The payment could not be posted.');
    } finally {
      setBusy(null);
    }
  };

  const discard = async () => {
    if (!draft || busy) return;
    if (!draft.id || draft.version === null) {
      if (!dirty || window.confirm('Stop keying this payment? Nothing was saved.')) {
        setDraft(null);
        setDirty(false);
      }
      return;
    }
    if (!window.confirm(`Discard the payment from ${draft.fundName} being keyed? Everyone loses what was keyed on it.`)) return;
    setBusy('discard');
    setActionError(null);
    try {
      await discardDraft(draft.id, draft.version);
      setDraft(null);
      setDirty(false);
      await loadStart();
    } catch (error) {
      fail(error, 'The payment could not be discarded.');
    } finally {
      setBusy(null);
    }
  };

  const openTheirVersion = async () => {
    if (!draft?.id) return;
    try {
      const row = await loadDraft(draft.id);
      setConflict(false);
      setActionError(null);
      if (row) {
        setDraft(draftFromRow(row));
        setDirty(false);
        setNotice('This is the latest saved version.');
      } else {
        setDraft(null);
        setNotice('A colleague posted or discarded this payment.');
        await loadStart();
      }
    } catch (error) {
      fail(error, 'The payment could not be opened.');
    }
  };

  if (posted) {
    return (
      <Sheet
        open
        onClose={onClose}
        title={`Receipt ${posted.document.receiptNumber} saved`}
        subtitle={`${nad(posted.document.amountCents)} from ${posted.document.payer}`}
        icon="solar:check-circle-bold-duotone"
        tone="green"
        size="md"
        overFullScreen={overFullScreen}
        footer={<PrimaryButton icon="solar:close-circle-bold-duotone" onClick={onClose}>Done</PrimaryButton>}
      >
        <div className="space-y-4">
          <div className="space-y-1 rounded-xl border border-green-200 bg-green-50 p-4">
            <SummaryRow label="Received" value={nad(posted.document.amountCents)} strong />
            <SummaryRow label={`Paid on ${posted.document.lines.length} claim(s)`} value={nad(posted.document.amountCents - posted.document.unallocatedCents)} />
            {posted.document.unallocatedCents > 0 && <SummaryRow label="Kept as credit on the receipt" value={nad(posted.document.unallocatedCents)} tone="warning" />}
          </div>
          {posted.batchesMoved > 0 && (
            <p className="text-sm text-gray-600">
              {posted.batchesMoved} claim batch{posted.batchesMoved === 1 ? '' : 'es'} now show what the fund paid.{' '}
              <Link to={claimBatchesLink()} onClick={onClose} className="font-medium text-cyan-700 hover:underline">Open the batches</Link>
            </p>
          )}
          <ReceiptShareActions practiceId={practiceId} receiptId={posted.receiptId} document={posted.document} patientId={null} invoiceId={null} />
        </div>
      </Sheet>
    );
  }

  if (!draft) {
    return (
      <Sheet
        open
        onClose={close}
        title="Medical aid payment"
        subtitle="Key a fund's payment line by line against the total on its remittance"
        icon="solar:heart-pulse-bold-duotone"
        size="lg"
        overFullScreen={overFullScreen}
        footer={<SecondaryButton onClick={close}>Close</SecondaryButton>}
      >
        <div className="space-y-5">
          {loadError && <ErrorBox>{loadError}</ErrorBox>}
          {!keyingReady && <ErrorBox>{KEYING_NOT_SET_UP_MESSAGE}</ErrorBox>}
          {notice && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{notice}</p>}
          {drafts.length > 0 && (
            <section aria-labelledby="fund-drafts">
              <h3 id="fund-drafts" className="mb-2 text-sm font-semibold text-gray-900">Payments being keyed</h3>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                {drafts.map(row => (
                  <li key={row.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
                    {row.fund_code ? <MedicalAidLogo name={row.fund_code} size="md" /> : <Icon icon="solar:question-square-bold-duotone" className="h-6 w-6 flex-none text-gray-400" aria-hidden="true" />}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{row.fund_name}</p>
                      <p className="text-xs text-gray-500">
                        {row.amount !== null && Number.isFinite(Number(row.amount)) ? `${nad(toCents(Number(row.amount)))} received, ` : ''}
                        {nad(draftKeyedCents(row))} keyed · saved {savedAt(row.updated_at)}
                        {row.updated_by && staffNames[row.updated_by] ? ` by ${staffNames[row.updated_by]}` : ''}
                      </p>
                    </div>
                    <PrimaryButton icon="solar:pen-new-square-bold-duotone" onClick={() => carryOn(row)} className="!px-3 !py-1.5">Carry on</PrimaryButton>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="fund-choose">
            <h3 id="fund-choose" className="mb-2 text-sm font-semibold text-gray-900">{drafts.length > 0 ? 'Or start a new payment from' : 'Which fund paid?'}</h3>
            {funds === null ? (
              <div className="space-y-2" role="status" aria-label="Loading the funds">
                {[0, 1, 2].map(index => <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />)}
              </div>
            ) : funds.length === 0 ? (
              <p className="rounded-lg border border-dashed border-gray-200 p-4 text-center text-sm text-gray-500">No medical aid owes the practice anything.</p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {funds.map(fund => (
                  <li key={fund.key}>
                    <button
                      type="button"
                      onClick={() => startFund(fund)}
                      disabled={!keyingReady}
                      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-cyan-300 hover:bg-cyan-50 disabled:opacity-50"
                    >
                      {fund.fundCode ? <MedicalAidLogo name={fund.fund} size="md" /> : <Icon icon="solar:question-square-bold-duotone" className="h-6 w-6 text-gray-400" aria-hidden="true" />}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-gray-900">{fund.fund}</span>
                        <span className="block text-xs text-gray-500">
                          {fund.claimCount} open {fund.claimCount === 1 ? 'claim' : 'claims'}, {nad(fund.owedCents)}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {onPatientPayment && (
            <button type="button" onClick={onPatientPayment} className="text-sm font-medium text-cyan-700 hover:underline">
              Not a medical aid? Receive a payment from a patient or someone else
            </button>
          )}
        </div>
      </Sheet>
    );
  }

  const control = summary?.controlCents ?? null;
  const difference = summary?.differenceCents ?? null;
  const balanceText = control === null
    ? 'Type the amount received'
    : difference === 0
      ? 'Balanced: ready to post'
      : difference !== null && difference > 0
        ? `${nad(difference)} still to key`
        : `${nad(Math.abs(difference ?? 0))} keyed too much`;
  const balanceTone = control !== null && difference === 0 ? 'text-green-700' : difference !== null && difference < 0 ? 'text-red-700' : 'text-amber-800';

  return (
    <Sheet
      open
      onClose={close}
      busy={busy !== null}
      title={`Medical aid payment: ${draft.fundName || 'fund not named yet'}`}
      subtitle={draft.id ? 'Saved; you or a colleague can carry on later' : 'Not saved yet'}
      icon="solar:heart-pulse-bold-duotone"
      size="xl"
      overFullScreen={overFullScreen}
      footer={
        <>
          <span className={`mr-auto flex items-center gap-1.5 text-sm font-medium ${balanceTone}`} aria-live="polite">
            <Icon icon={control !== null && difference === 0 ? 'solar:check-circle-bold-duotone' : 'solar:danger-triangle-bold-duotone'} className="h-4 w-4" aria-hidden="true" />
            {balanceText}
          </span>
          <SecondaryButton icon="solar:trash-bin-minimalistic-bold-duotone" onClick={() => void discard()} disabled={busy !== null}>
            {draft.id ? 'Discard' : 'Cancel'}
          </SecondaryButton>
          <SecondaryButton icon="solar:diskette-bold-duotone" onClick={() => void save()} disabled={busy !== null || !draft.fundName.trim()}>
            {busy === 'save' ? 'Saving...' : 'Save and finish later'}
          </SecondaryButton>
          <PrimaryButton
            icon="solar:check-read-bold-duotone"
            busy={busy === 'post'}
            disabled={busy !== null || !summary?.balanced}
            title={summary?.balanced ? undefined : summary?.problems[0]}
            onClick={() => void post()}
          >
            {busy === 'post' ? 'Posting...' : `Post payment${control !== null ? ` of ${nad(control)}` : ''}`}
          </PrimaryButton>
        </>
      }
    >
      <div className="space-y-5">
        {loadError && <ErrorBox>{loadError}</ErrorBox>}
        {actionError && (
          <ErrorBox>
            {actionError}
            {conflict && (
              <button type="button" onClick={() => void openTheirVersion()} className="ml-2 font-medium underline">
                Open their version
              </button>
            )}
          </ErrorBox>
        )}
        {notice && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{notice}</p>}

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 sm:col-span-2">
            {draft.fundCode && <MedicalAidLogo name={draft.fundCode} size="md" />}
            {draft.fundCode ? (
              <p className="text-sm font-medium text-gray-900">{draft.fundName}</p>
            ) : (
              <Field label="Name of the fund that paid" htmlFor="fund-name" hint="These patients have no fund from the fund list on their file." className="flex-1">
                <input id="fund-name" className={inputClass} value={draft.fundName} onChange={event => update({ fundName: event.target.value })} disabled={busy !== null} />
              </Field>
            )}
          </div>
          <Field label="Amount received" htmlFor="fund-amount" hint="The total on the fund's remittance: the lines must add up to it">
            <AmountInput
              id="fund-amount"
              value={draft.amountText}
              onChange={event => update({ amountText: event.target.value })}
              placeholder="0.00"
              invalid={!!draft.amountText.trim() && control === null}
              disabled={busy !== null}
            />
          </Field>
          <Field label="Date received">
            <DateInput value={draft.receivedOn} onChange={value => update({ receivedOn: value })} maxDate={today} disabled={busy !== null} />
          </Field>
          <Field label="Reference" htmlFor="fund-reference" hint="Payment or remittance reference">
            <input id="fund-reference" className={inputClass} value={draft.reference} onChange={event => update({ reference: event.target.value })} disabled={busy !== null} />
          </Field>
          <Field label="How it was paid">
            <ChoiceGroup value={draft.method} onChange={method => update({ method })} options={METHOD_CHOICES} label="How it was paid" disabled={busy !== null} />
          </Field>
        </div>

        {summary && (
          <div className="space-y-1.5 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <SummaryRow label="Amount received" value={control !== null ? nad(control) : '—'} />
            <SummaryRow label={`Keyed on ${summary.keyedRows} line(s)`} value={nad(summary.keyedCents)} />
            {summary.unmatchedCents > 0 && <SummaryRow label="Kept as credit (not matched to a claim)" value={nad(summary.unmatchedCents)} />}
            <SummaryRow
              label={difference !== null && difference < 0 ? 'Keyed too much' : 'Still to key'}
              value={difference !== null ? nad(Math.abs(difference)) : '—'}
              strong
              tone={control !== null && difference === 0 ? 'good' : 'warning'}
            />
          </div>
        )}

        {droppedRows > 0 && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            {droppedRows} keyed line(s) are on claims the fund no longer owes (paid or moved another way since). They are left out when this payment is saved.
          </p>
        )}

        {keyingClaims === null ? (
          <div className="space-y-2" role="status" aria-label="Loading the claim lines">
            {[0, 1, 2].map(index => <div key={index} className="h-14 animate-pulse rounded-lg bg-gray-100 motion-reduce:animate-none" />)}
          </div>
        ) : summary ? (
          <FundKeyingList
            claims={keyingClaims}
            draft={draft}
            summary={summary}
            disabled={busy !== null}
            onPaid={values => update({ paid: { ...draft.paid, ...values } })}
            onRestToPatient={(invoiceId, on) =>
              update({ restToPatient: on ? [...new Set([...draft.restToPatient, invoiceId])] : draft.restToPatient.filter(id => id !== invoiceId) })
            }
          />
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Not matched to a claim (kept as credit)" htmlFor="fund-unmatched" hint="Money on the remittance you cannot match yet: it stays on the receipt to allocate later">
            <AmountInput
              id="fund-unmatched"
              value={draft.unmatchedText}
              onChange={event => update({ unmatchedText: event.target.value })}
              placeholder="0.00"
              disabled={busy !== null}
            />
          </Field>
          <Field label="Notes" htmlFor="fund-notes">
            <textarea id="fund-notes" rows={2} className={inputClass} value={draft.notes} onChange={event => update({ notes: event.target.value })} disabled={busy !== null} />
          </Field>
        </div>

        {summary && !summary.balanced && (
          <div className="rounded-lg border border-gray-200 p-3 text-sm text-gray-700">
            <p className="mb-1 font-medium">Before it can be posted</p>
            <ul className="list-disc space-y-0.5 pl-5">
              {summary.problems.map(problem => <li key={problem}>{problem}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
};
