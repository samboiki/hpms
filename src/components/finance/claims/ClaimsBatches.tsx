import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../../stores/authStore';
import { formatNad } from '../../../utils/billing/money';
import { describeDeadline, getFundRule } from '../../../utils/billing/fundRules';
import BatchReview from './BatchReview';
import BatchHistory from './BatchHistory';
import UnbatchedInvoices from './UnbatchedInvoices';
import { batchStatus } from './status';
import { isOpenBatch, loadBatches, loadFunds, loadPracticeInfo, loadSubmissions } from './claimsService';
import type { BatchHeaderRow, BatchSubmissionRow, FundProvider, PracticeInfo } from './types';

interface ClaimsBatchesProps {
  practiceId: string;
}

type ClaimsTab = 'open' | 'unbatched' | 'history';

const TABS: Array<{ key: ClaimsTab; label: string; icon: string }> = [
  { key: 'open', label: 'Open batches', icon: 'solar:box-bold-duotone' },
  { key: 'unbatched', label: 'Not yet batched', icon: 'solar:document-add-bold-duotone' },
  { key: 'history', label: 'History', icon: 'solar:history-bold-duotone' }
];

/**
 * Medical aid claims for one practice: open batches per fund (review lines, confirm ICD-10 codes,
 * validate, preview/download the claim file, submit by email), medical aid invoices that missed
 * batching, and the batch and submission history.
 */
const ClaimsBatches: React.FC<ClaimsBatchesProps> = ({ practiceId }) => {
  const userId = useAuthStore(state => state.user?.id ?? null);
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [funds, setFunds] = useState<FundProvider[]>([]);
  const [batches, setBatches] = useState<BatchHeaderRow[]>([]);
  const [submissions, setSubmissions] = useState<BatchSubmissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<ClaimsTab>('open');
  const [reviewBatchId, setReviewBatchId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const practiceInfo = await loadPracticeInfo(practiceId);
      const [fundList, batchList] = await Promise.all([loadFunds(), loadBatches(practiceInfo)]);
      const submissionList = await loadSubmissions(batchList.map(batch => batch.id));
      setPractice(practiceInfo);
      setFunds(fundList);
      setBatches(batchList);
      setSubmissions(submissionList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the claims.');
    } finally {
      setLoading(false);
    }
  }, [practiceId]);

  useEffect(() => {
    setReviewBatchId(null);
    load();
  }, [load]);

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

  const openReview = (batch: BatchHeaderRow) => {
    setReviewBatchId(batch.id);
    setTab('open');
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

      {!practice.practice_number && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          This practice has no practice number. Claims cannot be submitted until it is set in the practice settings.
        </p>
      )}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>
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
            onChanged={load}
          />
        ) : openBatches.length === 0 ? (
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
              return (
                <div key={batch.id} className="flex flex-col rounded-xl border border-gray-200 p-4">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      {fund?.logo_url ? (
                        <img src={fund.logo_url} alt="" className="h-10 w-10 rounded-lg object-contain" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyan-50 text-xs font-semibold text-cyan-700">
                          {batch.medical_aid_reference.slice(0, 4)}
                        </div>
                      )}
                      <div>
                        <p className="font-semibold text-gray-900">{fund?.name ?? batch.medical_aid_reference}</p>
                        <p className="text-xs text-gray-500">Batch {batch.batch_number} - opened {batch.batch_date}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                  </div>
                  {/* Labels take their own width so values (e.g. the claims email) get the rest of the card */}
                  <dl className="mb-4 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm tabular-nums">
                    <dt className="text-gray-500">Invoices</dt>
                    <dd className="text-right text-gray-900">{batch.total_invoices ?? '-'}</dd>
                    <dt className="text-gray-500">Total</dt>
                    <dd className="text-right font-medium text-gray-900">
                      {batch.total_amount !== null ? formatNad(Number(batch.total_amount)) : '-'}
                    </dd>
                    <dt className="text-gray-500">Deadline</dt>
                    <dd className="text-right text-gray-900">{describeDeadline(rule)}</dd>
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
                    Review and submit
                  </button>
                </div>
              );
            })}
          </div>
        ))}

      {tab === 'unbatched' && <UnbatchedInvoices practice={practice} funds={funds} onAdded={load} />}

      {tab === 'history' && (
        <BatchHistory batches={batches} submissions={submissions} fundByReference={fundByReference} onOpen={openReview} />
      )}
    </div>
  );
};

export default ClaimsBatches;
