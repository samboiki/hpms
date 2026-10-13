import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../../stores/authStore';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { deadlineCaveat, describeDeadline, getFundRule } from '../../../utils/billing/fundRules';
import { formatServiceDate, todayKey } from '../../../utils/billing/dates';
import { fundLabel } from '../../../utils/remittance/funds';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import BatchReview from './BatchReview';
import BatchHistory from './BatchHistory';
import ClaimReportSheet from './ClaimReportSheet';
import FundStatementSheet, { type FinanceFigures } from './FundStatementSheet';
import UnbatchedInvoices from './UnbatchedInvoices';
import ReversalsToSend from './ReversalsToSend';
import UnpaidClaimLines from './UnpaidClaimLines';
import { isCreditBatch } from './claimCorrections';
import { batchStatus } from './status';
import { SILENT_FUND_DEFAULTS, fundCodeOf, silentBatches, silentFunds, type SilentFundDays } from './batchFollowUp';
import { SilentFundSettings } from './SilentFundSettings';
import {
  isOpenBatch,
  loadBatchById,
  loadBatches,
  loadFunds,
  loadOwedByBatch,
  loadPracticeInfo,
  loadSilentFundDays,
  loadSubmissions,
  saveSilentFundDays
} from './claimsService';
import type { BatchHeaderRow, BatchSubmissionRow, FundProvider, PracticeInfo } from './types';

interface ClaimsBatchesProps {
  practiceId: string;
  /** The Finance page's figures, for the statement of outstanding claims per fund; null while they load */
  finance?: FinanceFigures | null;
  /** A batch was sent or changed (invoices added or taken out, a credit file, a line corrected): Finance reloads its figures */
  onChanged?: () => void;
}

type ClaimsTab = 'open' | 'unbatched' | 'unpaid' | 'history';

const TABS: Array<{ key: ClaimsTab; label: string; icon: string }> = [
  { key: 'open', label: 'Open batches', icon: 'solar:box-bold-duotone' },
  { key: 'unbatched', label: 'Not yet batched', icon: 'solar:document-add-bold-duotone' },
  { key: 'unpaid', label: 'Unpaid lines', icon: 'solar:hourglass-bold-duotone' },
  { key: 'history', label: 'History', icon: 'solar:history-bold-duotone' }
];

/**
 * Medical aid claims for one practice: open batches per fund (review lines, confirm ICD-10 codes,
 * validate, preview/download the claim file, submit by email), medical aid invoices that missed
 * batching, and the batch and submission history.
 */
const ClaimsBatches: React.FC<ClaimsBatchesProps> = ({ practiceId, finance = null, onChanged }) => {
  const userId = useAuthStore(state => state.user?.id ?? null);
  // Practice administrators change when a fund counts as not answering (the practice_settings admin-only policies agree)
  const canEditSettings = useAuthStore(state => state.user?.role === 'admin' || !!state.user?.is_super_admin);
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [funds, setFunds] = useState<FundProvider[]>([]);
  const [batches, setBatches] = useState<BatchHeaderRow[]>([]);
  const [submissions, setSubmissions] = useState<BatchSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ClaimsTab>('open');
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);
  const [reportBatch, setReportBatch] = useState<BatchHeaderRow | null>(null);
  const [showStatement, setShowStatement] = useState(false);
  // What the funds still owe on the sent batches old enough to be "silent", and why it may be unknown
  const [owedByBatch, setOwedByBatch] = useState<Map<string, number> | null>(new Map());
  const [owedWarning, setOwedWarning] = useState<string | null>(null);
  const [openSilentFund, setOpenSilentFund] = useState<string | null>(null);
  const [silentSettings, setSilentSettings] = useState<SilentFundDays>(SILENT_FUND_DEFAULTS);
  const [today] = useState(() => todayKey());
  // Goes up with every load, so the reversals waiting for a credit file follow the batches
  const [loadCount, setLoadCount] = useState(0);
  // Batches a link opened that are older than the newest 300 the list reads: every load reads them again by id, so
  // their review stays open (and current) after a change
  const olderBatchIds = useRef<Set<string>>(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const practiceInfo = await loadPracticeInfo(practiceId);
      const [fundList, newest, waits] = await Promise.all([loadFunds(), loadBatches(practiceInfo), loadSilentFundDays(practiceInfo.id)]);
      const missing = [...olderBatchIds.current].filter(id => !newest.some(batch => batch.id === id));
      // One that cannot be read again only drops out of the list: the newest batches still show
      const older = (await Promise.all(missing.map(id => loadBatchById(practiceInfo, id).catch(() => null))))
        .filter((batch): batch is BatchHeaderRow => batch !== null);
      const batchList = [...newest, ...older];
      // Only sent batches without an answer for their fund's wait need the amount still owed
      const silentCandidates = silentBatches(batchList, null, today, waits.settings).map(item => item.batch.id);
      const [submissionList, owed] = await Promise.all([
        loadSubmissions(batchList.map(batch => batch.id)),
        loadOwedByBatch(practiceInfo.id, silentCandidates)
      ]);
      setPractice(practiceInfo);
      setFunds(fundList);
      setBatches(batchList);
      setSubmissions(submissionList);
      setSilentSettings(waits.settings);
      setOwedByBatch(owed.owed);
      setOwedWarning([waits.error ? `When to warn could not be read (${waits.error}); the usual waits are used.` : null, owed.warning].filter(Boolean).join(' ') || null);
      setLoadCount(count => count + 1);
    } catch (err) {
      setError(err instanceof Error ? plainWords(err.message) : 'Could not load the claims.');
    } finally {
      setLoading(false);
    }
  }, [practiceId, today]);

  useEffect(() => {
    setReviewBatchId(null);
    load();
  }, [load]);

  // A change made here (a batch sent, invoices added or taken out, a credit file made, a line corrected) changes what
  // the funds owe in Finance's figures: the claims reload, then Finance
  const changed = useCallback(async () => {
    await load();
    onChanged?.();
  }, [load, onChanged]);

  const fundByReference = useMemo(
    () =>
      new Map(
        funds
          .filter(fund => fund.medical_aid_reference)
          .map(fund => [(fund.medical_aid_reference ?? '').toUpperCase(), fund] as const)
      ),
    [funds]
  );
  const openBatches = useMemo(() => batches.filter(isOpenBatch), [batches]);
  const reviewBatch = batches.find(batch => batch.id === reviewBatchId) ?? null;
  // Funds that have not answered sent batches within the wait set for them while still owing money on them
  const silent = useMemo(() => silentBatches(batches, owedByBatch, today, silentSettings), [batches, owedByBatch, today, silentSettings]);
  const hasSentBatches = useMemo(() => batches.some(batch => !isOpenBatch(batch)), [batches]);
  const saveWaits = async (next: SilentFundDays) => {
    if (!practice) return;
    setSilentSettings(await saveSilentFundDays(practice.id, next));
    // Other batches may now be due (or no longer): reload what the funds still owe on them
    await load();
  };
  const silentByFund = useMemo(() => silentFunds(silent), [silent]);
  const silentDays = useMemo(() => new Map(silent.map(item => [item.batch.id, item.daysSinceSent])), [silent]);
  const fundNameOf = (code: string): string =>
    funds.find(fund => fundCodeOf(fund.medical_aid_reference) === code)?.name ?? fundLabel(code);

  // A link from an invoice or a claim line (?batch=<id>) opens that batch once the batches are loaded
  const [searchParams, setSearchParams] = useSearchParams();
  const linkedBatchId = searchParams.get('batch');
  useEffect(() => {
    if (!linkedBatchId || !batches.some(batch => batch.id === linkedBatchId)) return;
    setReviewBatchId(linkedBatchId);
    setTab('open');
    const next = new URLSearchParams(searchParams);
    next.delete('batch');
    setSearchParams(next, { replace: true });
  }, [linkedBatchId, batches, searchParams, setSearchParams]);
  // A linked batch older than the newest 300 is read by id and added to the list (the effect above then opens it);
  // one that is not the practice's, or no longer exists, says so instead of leaving the link doing nothing
  useEffect(() => {
    if (!linkedBatchId || !practice || loading || batches.some(batch => batch.id === linkedBatchId)) return;
    if (olderBatchIds.current.has(linkedBatchId)) return;
    olderBatchIds.current.add(linkedBatchId);
    const dropLink = (message: string) => {
      olderBatchIds.current.delete(linkedBatchId);
      toast.error(message);
      setSearchParams(previous => {
        const next = new URLSearchParams(previous);
        next.delete('batch');
        return next;
      }, { replace: true });
    };
    loadBatchById(practice, linkedBatchId)
      .then(batch => {
        if (batch) setBatches(current => (current.some(item => item.id === batch.id) ? current : [...current, batch]));
        else dropLink('That claim batch could not be found. It may have been deleted, or belong to another practice.');
      })
      .catch(err => dropLink(err instanceof Error ? plainWords(err.message) : 'Could not open the claim batch.'));
  }, [linkedBatchId, practice, loading, batches, setSearchParams]);

  const openReview = (batch: BatchHeaderRow) => {
    setReviewBatchId(batch.id);
    setTab('open');
  };

  // A credit file made from the waiting reversals, or a batch named from the unpaid lines: reload, then open it
  const openAfterLoad = async (batchId: string | null) => {
    await changed();
    if (batchId) {
      setReviewBatchId(batchId);
      setTab('open');
    }
  };

  if (loading && !practice) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <div className="mr-3 h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-600" />
        <span className="text-gray-600">Loading claims...</span>
      </div>
    );
  }

  if (!practice) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        <p className="mb-2">{error ?? 'The practice could not be loaded.'}</p>
        <button type="button" onClick={load} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 hover:bg-red-100">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Medical aid claims</h2>
          <p className="text-sm text-gray-500">
            {practice.name}
            {practice.practice_number ? ` - practice number ${practice.practice_number}` : ' - no practice number set'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* What each fund still owes on the claims sent to it, to print or download for the fund (parity F22) */}
          <button
            type="button"
            onClick={() => setShowStatement(true)}
            disabled={!finance}
            title={finance ? 'Statement of outstanding claims per fund' : 'The Finance figures are still loading'}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" />
            Fund statement
          </button>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Icon icon="solar:refresh-bold-duotone" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {!practice.practice_number && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          This practice has no practice number. Claims cannot be submitted until it is set in the practice settings.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>
      )}

      {silentByFund.length > 0 && (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" aria-labelledby="silent-funds-title">
          <div className="mb-2 flex items-start gap-2">
            <Icon icon="solar:bell-off-bold-duotone" className="mt-0.5 h-5 w-5 flex-none text-amber-700" aria-hidden="true" />
            <div>
              <h3 id="silent-funds-title" className="font-semibold text-amber-900">Funds that have not answered</h3>
              <p className="text-sm text-amber-800">
                Batches with no payment or response recorded after the wait set for their fund, while the fund still owes on them.
                Ask the fund about them, or import its remittance.
              </p>
            </div>
          </div>
          <div className="mb-3">
            <SilentFundSettings settings={silentSettings} funds={funds} canEdit={canEditSettings} onSave={saveWaits} />
          </div>
          {owedWarning && <p className="mb-2 text-xs text-amber-800">{owedWarning}</p>}
          <ul className="space-y-2">
            {silentByFund.map(group => {
              const expanded = openSilentFund === group.fundCode;
              const name = fundNameOf(group.fundCode);
              return (
                <li key={group.fundCode} className="rounded-lg border border-amber-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenSilentFund(expanded ? null : group.fundCode)}
                    aria-expanded={expanded}
                    className="flex w-full flex-wrap items-center gap-3 px-3 py-2 text-left text-sm hover:bg-amber-50"
                  >
                    <MedicalAidLogo name={name} />
                    <span className="font-medium text-gray-900">{name}</span>
                    <span className="text-gray-700">
                      {group.batches.length} {group.batches.length === 1 ? 'batch' : 'batches'}, oldest {group.oldestDays} days
                    </span>
                    <span className="ml-auto flex items-center gap-2">
                      <span className="tabular-nums font-medium text-gray-900">
                        {group.owedCents === null ? 'amount not known' : `${formatNad(fromCents(group.owedCents))} still owed`}
                      </span>
                      <Icon icon={expanded ? 'solar:alt-arrow-up-linear' : 'solar:alt-arrow-down-linear'} className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    </span>
                  </button>
                  {expanded && (
                    <ul className="divide-y divide-amber-100 border-t border-amber-100">
                      {group.batches.map(item => (
                        <li key={item.batch.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <button type="button" onClick={() => openReview(item.batch)} className="font-medium text-cyan-700 hover:underline">
                            Batch {item.batch.batch_number}
                          </button>
                          <span className="text-gray-600">
                            sent {item.batch.sent_at ? formatServiceDate(new Date(item.batch.sent_at)) : '-'}, {item.daysSinceSent} days ago
                          </span>
                          <span className="ml-auto tabular-nums text-gray-900">
                            {item.owedCents === null ? '' : `${formatNad(fromCents(item.owedCents))} owed`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {silentByFund.length === 0 && hasSentBatches && (
        <div className="rounded-lg border border-gray-200 bg-white px-3 py-2">
          <SilentFundSettings settings={silentSettings} funds={funds} canEdit={canEditSettings} onSave={saveWaits} />
        </div>
      )}

      <div className="flex gap-1 rounded-xl bg-gray-100 p-1" role="tablist">
        {TABS.map(item => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => {
              setTab(item.key);
              if (item.key !== 'open') setReviewBatchId(null);
            }}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              tab === item.key ? 'bg-white text-cyan-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Icon icon={item.icon} className="h-4 w-4" />
            {item.label}
            {item.key === 'open' && openBatches.length > 0 && (
              <span className="rounded-full bg-cyan-600 px-2 text-xs text-white">{openBatches.length}</span>
            )}
          </button>
        ))}
      </div>

      {tab === 'open' &&
        (reviewBatch ? (
          <BatchReview
            practice={practice}
            batch={reviewBatch}
            fund={fundByReference.get(reviewBatch.medical_aid_reference.toUpperCase())}
            userId={userId}
            onBack={() => setReviewBatchId(null)}
            onChanged={() => void changed()}
          />
        ) : (
          <div className="space-y-5">
            <ReversalsToSend
              practiceId={practice.id}
              fundNameOf={reference => fundByReference.get(reference.toUpperCase())?.name ?? fundLabel(fundCodeOf(reference))}
              onMade={batchId => void openAfterLoad(batchId)}
              reloadKey={loadCount}
            />
            {openBatches.length === 0 ? (
          <div className="py-10 text-center text-gray-500">
            <Icon icon="solar:box-minimalistic-bold-duotone" className="mx-auto mb-2 h-10 w-10 text-gray-300" />
            No open claim batches. Medical aid invoices are added to a batch per fund automatically; check
            &quot;Not yet batched&quot; for any that were missed.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {openBatches.map(batch => {
              const fund = fundByReference.get(batch.medical_aid_reference.toUpperCase());
              const rule = getFundRule(batch.medical_aid_reference, fund?.name);
              const status = batchStatus(batch);
              const credit = isCreditBatch(batch);
              return (
                <div key={batch.id} className={`flex flex-col rounded-xl border p-4 ${credit ? 'border-violet-200 bg-violet-50/40' : 'border-gray-200'}`}>
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <MedicalAidLogo name={fund?.name ?? batch.medical_aid_reference} size="md" />
                      <div>
                        <p className="font-semibold text-gray-900">{fund?.name ?? batch.medical_aid_reference}</p>
                        <p className="text-xs text-gray-500">
                          {credit ? 'Credit file' : 'Batch'} {batch.batch_number} - opened {formatServiceDate(batch.batch_date)}
                        </p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  {/* Labels take their own width so values (e.g. the claims email) get the rest of the card */}
                  <dl className="mb-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm tabular-nums">
                    <dt className="text-gray-500">{credit ? 'Reversals of invoices' : 'Invoices'}</dt>
                    <dd className="text-right text-gray-900">{batch.total_invoices ?? '-'}</dd>
                    <dt className="text-gray-500">{credit ? 'Total credited' : 'Total'}</dt>
                    <dd className="text-right font-medium text-gray-900">
                      {batch.total_amount !== null ? formatNad(Number(batch.total_amount)) : '-'}
                    </dd>
                    <dt className="text-gray-500">Deadline</dt>
                    <dd className="text-right text-gray-900">
                      {credit ? 'None (a reversal is never late)' : `${describeDeadline(rule)}${deadlineCaveat(rule) ? `, ${deadlineCaveat(rule)}` : ''}`}
                    </dd>
                    <dt className="text-gray-500">Claims email</dt>
                    <dd className={`truncate text-right ${fund?.email ? 'text-gray-900' : 'text-red-600'}`} title={fund?.email ?? ''}>
                      {fund?.email ?? 'Not set'}
                    </dd>
                  </dl>
                  <button
                    type="button"
                    onClick={() => openReview(batch)}
                    className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700"
                  >
                    <Icon icon="solar:checklist-minimalistic-bold-duotone" className="h-4 w-4" />
                    {credit ? 'Review and send' : 'Review and submit'}
                  </button>
                </div>
              );
            })}
          </div>
            )}
          </div>
        ))}

      {tab === 'unbatched' && <UnbatchedInvoices practice={practice} funds={funds} onAdded={() => void changed()} />}

      {tab === 'unpaid' && (
        <UnpaidClaimLines
          practiceId={practice.id}
          batches={batches}
          settings={silentSettings}
          today={today}
          fundNameOf={fundNameOf}
          onOpenBatch={batchId => {
            setReviewBatchId(batchId);
            setTab('open');
          }}
          onChanged={() => void changed()}
        />
      )}

      {tab === 'history' && (
        <BatchHistory
          batches={batches}
          submissions={submissions}
          fundByReference={fundByReference}
          silentDays={silentDays}
          onOpen={openReview}
          onReport={setReportBatch}
        />
      )}

      {showStatement && finance && (
        <FundStatementSheet practice={practice} finance={finance} onClose={() => setShowStatement(false)} />
      )}

      {reportBatch && (
        <ClaimReportSheet
          practice={practice}
          batch={reportBatch}
          fund={fundByReference.get(reportBatch.medical_aid_reference.toUpperCase())}
          onClose={() => setReportBatch(null)}
        />
      )}
    </div>
  );
};

export default ClaimsBatches;
