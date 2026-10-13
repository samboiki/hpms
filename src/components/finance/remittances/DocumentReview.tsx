import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { todayKey } from '../../../utils/billing/dates';
import { FUND_IDENTITIES, fundLabel } from '../../../utils/remittance/funds';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import { matchRemittance, summarizeMatches, type ClaimCandidate, type VisitGroup } from '../../../utils/remittance/matching';
import { reconciliationStatus } from '../../../utils/remittance/parseRemittance';
import { buildPostingPlan, paymentKeyOf, policyFor, type FundPolicy, type LineDecision, type PostingPlan } from '../../../utils/remittance/posting';
import { classifyLineReasons } from '../../../utils/remittance/reasonCodes';
import { displayTariff } from '../../../utils/remittance/text';
import { KIND_LABELS, LINE_STATUS_LABELS, type RemittanceDocument, type RemittanceLine } from '../../../utils/remittance/types';
import { ChoiceGroup, ErrorBox, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass } from '../receipts/ArUi';
import { ActionButton, ErrorState, FilterPill, LoadingState, Notice, SectionCard } from '../FinanceUI';
import { MatchPicker } from './MatchPicker';
import { buildMatchesPayload, buildPostPayload, buildSavePayload } from './postPayload';
import {
  attachHistory,
  fundProviderName,
  isPaymentPosted,
  loadClaimCandidates,
  loadInvoiceBalances,
  postDocument,
  saveDocument,
  saveMatches,
  type ImportContext,
  type PostResult,
  type SetupState
} from './remittanceService';
import { Chip, ConfidenceChip, formatDateKey, nad } from './remittanceUi';

interface DocumentReviewProps {
  practiceId: string;
  practiceName: string;
  context: ImportContext;
  setup: SetupState;
  fileName: string;
  sha256: string;
  partNumber: number;
  doc: RemittanceDocument;
  onBack: () => void;
  onPosted: () => void;
}

type Filter = 'all' | 'check' | 'unmatched' | 'unpaid';
const PAGE = 25;

/**
 * One fund document: how its lines match the claims sent, what posting will do line by line, and
 * the Post button. Exact matches post as they are; a "Check" match posts only once someone confirms
 * it or picks the invoice; unmatched money stays on the receipt as credit.
 */
export const DocumentReview: React.FC<DocumentReviewProps> = ({ practiceId, context, setup, fileName, sha256, partNumber, doc, onBack, onPosted }) => {
  const [fundCode, setFundCode] = useState<string | null>(doc.fundCode);
  const effectiveDoc = useMemo<RemittanceDocument>(() => ({ ...doc, fundCode }), [doc, fundCode]);
  const [candidates, setCandidates] = useState<ClaimCandidate[] | null>(null);
  const [loadWarnings, setLoadWarnings] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [overrides, setOverrides] = useState<Record<string, string | null>>({});
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [balances, setBalances] = useState<Record<string, { medicalAidOutstandingCents: number; patientOutstandingCents: number }>>({});
  // The invoices the balances were read for: posting waits until they match the current matches
  const [balancesKey, setBalancesKey] = useState<string | null>(null);
  const [paymentPosted, setPaymentPosted] = useState(false);
  const [rateChoice, setRateChoice] = useState<FundPolicy['rateShortfall'] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(PAGE);
  const [picking, setPicking] = useState<VisitGroup | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [result, setResult] = useState<PostResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    setCandidates(null);
    setLoadError(null);
    (async () => {
      try {
        const loaded = await loadClaimCandidates(context, effectiveDoc);
        const withHistory = setup === 'ready' ? await attachHistory(loaded.candidates) : loaded.candidates;
        const posted = setup === 'ready' ? await isPaymentPosted(practiceId, paymentKeyOf(effectiveDoc)) : false;
        if (cancelled) return;
        setCandidates(withHistory);
        setLoadWarnings(loaded.warnings);
        setPaymentPosted(posted);
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Could not load the claims to match against.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [context, effectiveDoc, practiceId, setup, reloadKey]);

  const matches = useMemo(() => matchRemittance(effectiveDoc, candidates ?? [], { invoiceByGroup: overrides }), [effectiveDoc, candidates, overrides]);
  const matchBySeq = useMemo(() => new Map(matches.lines.map(line => [line.seq, line])), [matches]);
  const invoiceIdsKey = useMemo(() => [...new Set(matches.lines.map(line => line.invoiceId).filter((id): id is string => !!id))].sort().join(','), [matches]);

  useEffect(() => {
    if (setup !== 'ready' || !invoiceIdsKey) return;
    let cancelled = false;
    loadInvoiceBalances(invoiceIdsKey.split(','))
      .then(rows => {
        if (cancelled) return;
        setBalances(rows);
        setBalancesKey(invoiceIdsKey);
      })
      .catch(error => {
        if (cancelled) return;
        setBalances({});
        setBalancesKey(null);
        setPostError(error instanceof Error ? error.message : 'What the invoices still owe could not be read.');
      });
    return () => {
      cancelled = true;
    };
  }, [invoiceIdsKey, setup]);

  const policy = useMemo<FundPolicy>(() => {
    const base = policyFor(fundCode);
    return { ...base, rateShortfall: rateChoice ?? base.rateShortfall };
  }, [fundCode, rateChoice]);
  const plan = useMemo(() => buildPostingPlan({
    doc: effectiveDoc,
    matches,
    confirmedGroups: confirmed,
    balances,
    policy,
    canApproveWriteOffs: context.canApproveWriteOffs,
    today: todayKey(),
    paymentAlreadyPosted: paymentPosted
  }), [effectiveDoc, matches, confirmed, balances, policy, context.canApproveWriteOffs, paymentPosted]);

  const invoiceInfo = useMemo(() => {
    const info = new Map<string, { invoiceNumber: string; patientName: string }>();
    (candidates ?? []).forEach(candidate => {
      if (candidate.invoiceId && !info.has(candidate.invoiceId)) info.set(candidate.invoiceId, { invoiceNumber: candidate.invoiceNumber, patientName: candidate.patientName });
    });
    return info;
  }, [candidates]);

  const summary = summarizeMatches(matches);
  const reconciliation = reconciliationStatus(effectiveDoc);
  const decisionBySeq = new Map(plan.decisions.map(decision => [decision.seq, decision]));
  const lineBySeq = new Map(effectiveDoc.lines.map(line => [line.seq, line]));
  const hasRateShortfall = plan.decisions.some(decision => decision.writeOffCode === 'scheme_rate' || (decision.shortfallReason ?? '').includes('own rate'));
  const fundUnknown = !doc.fundCode || doc.warnings.some(warning => /does not name the fund/.test(warning));

  const groups = matches.groups.filter(group => {
    if (filter === 'check') return group.confidence === 'likely' && !confirmed.has(group.key) && !group.manual;
    if (filter === 'unmatched') return group.confidence === 'none';
    if (filter === 'unpaid') return group.seqs.some(seq => {
      const line = lineBySeq.get(seq);
      return line && (line.status === 'rejected' || line.status === 'pended' || line.status === 'part_paid');
    });
    return true;
  });
  const unconfirmed = matches.groups.filter(group => group.confidence === 'likely' && !confirmed.has(group.key) && !group.manual);
  const balancesLoaded = !invoiceIdsKey || balancesKey === invoiceIdsKey;
  const canPost = setup === 'ready' && plan.blockers.length === 0 && !result && candidates !== null && balancesLoaded;

  const post = async () => {
    setPosting(true);
    setPostError(null);
    try {
      const saved = await saveDocument(buildSavePayload({ practiceId, fileName, sha256, partNumber, doc: effectiveDoc }));
      if (saved.status === 'posted') {
        toast.success('This document was posted before; nothing was posted again.');
        setConfirming(false);
        onPosted();
        return;
      }
      const lineIds = Object.fromEntries(saved.lines.map(line => [line.seq, line.id]));
      await saveMatches(saved.document_id, buildMatchesPayload(matches, confirmed, lineIds));
      const outcome = await postDocument(saved.document_id, buildPostPayload({
        practiceId,
        documentId: saved.document_id,
        lineIds,
        fundName: fundProviderName(context.funds, effectiveDoc),
        doc: effectiveDoc,
        matches,
        confirmedGroups: confirmed,
        plan
      }));
      setResult(outcome);
      setConfirming(false);
      toast.success(outcome.receipt_number ? `Posted as receipt ${outcome.receipt_number}` : 'Outcomes recorded');
      onPosted();
    } catch (error) {
      setPostError(error instanceof Error ? error.message : 'Posting failed. Nothing was saved.');
    } finally {
      setPosting(false);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <ErrorState title="The claims could not be loaded" message={loadError} onRetry={() => setReloadKey(key => key + 1)} />
        <div className="pb-6 text-center"><SecondaryButton icon="solar:arrow-left-bold-duotone" onClick={onBack}>Back to files</SecondaryButton></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <SecondaryButton icon="solar:arrow-left-bold-duotone" onClick={onBack}>Back to files</SecondaryButton>
        <MedicalAidLogo name={fundCode ?? doc.fundName} size="md" labelled />
        <p className="min-w-0 break-all text-sm text-gray-500">{fileName}{partNumber > 1 ? ` (payment ${partNumber})` : ''}</p>
      </div>

      <SectionCard
        title={`${fundLabel(fundCode, doc.fundName)}: ${KIND_LABELS[doc.kind].toLowerCase()}`}
        subtitle={[
          doc.paymentDate ? `Paid ${formatDateKey(doc.paymentDate)}` : doc.documentDate ? formatDateKey(doc.documentDate) : null,
          doc.paymentReference ?? doc.statementNumber,
          doc.bankAccountLast4 ? `into account ending ${doc.bankAccountLast4}` : null
        ].filter(Boolean).join(' · ')}
        icon="solar:bill-check-bold-duotone"
        tone={reconciliation.ok ? 'green' : 'red'}
        actions={reconciliation.ok
          ? <Chip tone="green" icon="solar:check-circle-bold-duotone">Totals match ({effectiveDoc.checks.length} {effectiveDoc.checks.length === 1 ? 'check' : 'checks'})</Chip>
          : <Chip tone="red" icon="solar:danger-triangle-bold-duotone">Does not add up</Chip>}
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Lines" value={String(effectiveDoc.lines.length)} />
          <Stat label="Matched" value={String(summary.exact)} tone="green" />
          <Stat label="To check" value={String(summary.likely)} tone="amber" />
          <Stat label="Unmatched" value={String(summary.none)} tone="red" />
        </div>
        {!reconciliation.ok && reconciliation.message && (
          <div className="mt-4"><ErrorBox>
            {reconciliation.message}
            <ul className="mt-1 list-disc pl-5">
              {reconciliation.failed.slice(0, 5).map(check => (
                <li key={check.label}>{check.label}: printed {check.unit === 'count' ? check.expectedCents : nad(check.expectedCents)}, lines add up to {check.unit === 'count' ? check.actualCents : nad(check.actualCents)}</li>
              ))}
            </ul>
          </ErrorBox></div>
        )}
        {fundUnknown && (
          <div className="mt-4 max-w-sm">
            <label htmlFor="remittance-fund" className="mb-1 block text-sm font-medium text-gray-700">Which fund is this from?</label>
            <select id="remittance-fund" className={inputClass} value={fundCode ?? ''} onChange={event => { setFundCode(event.target.value || null); setOverrides({}); setConfirmed(new Set()); }}>
              <option value="">Not known</option>
              {FUND_IDENTITIES.map(fund => <option key={fund.code} value={fund.code}>{fund.label}</option>)}
            </select>
          </div>
        )}
        {[...effectiveDoc.warnings, ...loadWarnings].filter(warning => !/does not name the fund/.test(warning)).map(warning => (
          <p key={warning} className="mt-3 text-sm text-amber-700">{warning}</p>
        ))}
      </SectionCard>

      {candidates === null ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6"><LoadingState label="Finding the claims this document pays" rows={4} /></div>
      ) : (
        <>
          <OutcomeSummary plan={plan} doc={effectiveDoc} />
          {hasRateShortfall && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-2 text-sm font-medium text-gray-700">The fund paid its own (lower) rate on some lines. The difference above it:</p>
              <ChoiceGroup<FundPolicy['rateShortfall']>
                label="Rate shortfalls"
                value={policy.rateShortfall}
                onChange={setRateChoice}
                options={[{ value: 'bill_patient', label: 'Bill the patient' }, { value: 'write_off', label: 'Write off (not billed)' }]}
              />
            </div>
          )}

          <SectionCard
            title="Lines by visit"
            subtitle="The fund's lines grouped per patient and date, with the claim each was matched to"
            icon="solar:list-check-bold-duotone"
            actions={unconfirmed.length > 0 ? (
              <ActionButton icon="solar:check-read-bold-duotone" label={`Confirm ${unconfirmed.length} to check`} onClick={() => setConfirmed(current => new Set([...current, ...unconfirmed.map(group => group.key)]))} />
            ) : undefined}
          >
            <div className="mb-4 flex flex-wrap gap-2">
              <FilterPill active={filter === 'all'} onClick={() => { setFilter('all'); setShown(PAGE); }} count={matches.groups.length}>All</FilterPill>
              <FilterPill active={filter === 'check'} onClick={() => { setFilter('check'); setShown(PAGE); }} count={unconfirmed.length}>To check</FilterPill>
              <FilterPill active={filter === 'unmatched'} onClick={() => { setFilter('unmatched'); setShown(PAGE); }} count={matches.groups.filter(group => group.confidence === 'none').length}>Unmatched</FilterPill>
              <FilterPill active={filter === 'unpaid'} onClick={() => { setFilter('unpaid'); setShown(PAGE); }}>Not fully paid</FilterPill>
            </div>
            {groups.length === 0 ? (
              <p className="py-6 text-center text-sm text-gray-500">Nothing to show with this filter.</p>
            ) : (
              <ul className="space-y-3">
                {groups.slice(0, shown).map(group => (
                  <GroupCard
                    key={group.key}
                    group={group}
                    lines={group.seqs.map(seq => lineBySeq.get(seq)).filter((line): line is RemittanceLine => !!line)}
                    decisions={decisionBySeq}
                    invoice={group.invoiceId ? invoiceInfo.get(group.invoiceId) ?? null : null}
                    confirmed={confirmed.has(group.key)}
                    lineConfidence={seq => matchBySeq.get(seq)?.confidence ?? 'none'}
                    administrator={effectiveDoc.administrator}
                    legend={effectiveDoc.reasonLegend}
                    onConfirm={() => setConfirmed(current => new Set([...current, group.key]))}
                    onPick={() => setPicking(group)}
                  />
                ))}
              </ul>
            )}
            {groups.length > shown && (
              <div className="mt-4 text-center">
                <SecondaryButton icon="solar:alt-arrow-down-bold-duotone" onClick={() => setShown(count => count + PAGE)}>Show {Math.min(PAGE, groups.length - shown)} more of {groups.length - shown}</SecondaryButton>
              </div>
            )}
          </SectionCard>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
            {result ? (
              <Notice tone="info" title={result.receipt_number ? `Posted: receipt ${result.receipt_number}` : 'Outcomes recorded'}>
                {result.closed_month && result.posted_on ? `${result.closed_month} is closed, so this payment counts on ${formatDateKey(result.posted_on)}. ` : ''}
                {result.rejections_created > 0 ? `${result.rejections_created} line(s) went to the rejection queue. ` : ''}
                {result.resolved > 0 ? `${result.resolved} earlier rejection(s) settled by this payment.` : ''}
              </Notice>
            ) : (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm text-gray-600">
                  {setup !== 'ready'
                    ? 'Posting starts once remittance import is set up in the database.'
                    : !balancesLoaded
                      ? (postError ?? 'Reading what the matched invoices still owe...')
                      : plan.blockers[0] ?? (unconfirmed.length > 0 && plan.mode === 'receipt' ? `${unconfirmed.length} visit(s) still to check: their money stays unallocated until confirmed.` : plan.mode === 'receipt' ? 'Ready to post.' : 'Ready to record the outcomes: no money moves with this document.')}
                </div>
                <PrimaryButton icon={plan.mode === 'receipt' ? 'solar:hand-money-bold-duotone' : 'solar:clipboard-check-bold-duotone'} disabled={!canPost} onClick={() => setConfirming(true)} className="w-full sm:w-auto">
                  {plan.mode === 'receipt' ? `Post ${nad(plan.receiptAmountCents)}` : 'Record outcomes'}
                </PrimaryButton>
              </div>
            )}
          </div>
        </>
      )}

      {picking && candidates && (
        <MatchPicker
          group={picking}
          candidates={candidates}
          onClose={() => setPicking(null)}
          onChoose={invoiceId => {
            setOverrides(current => ({ ...current, [picking.key]: invoiceId }));
            setPicking(null);
          }}
          onReset={() => {
            setOverrides(current => {
              const next = { ...current };
              delete next[picking.key];
              return next;
            });
            setPicking(null);
          }}
        />
      )}

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        busy={posting}
        title={plan.mode === 'receipt' ? 'Post this payment' : 'Record these outcomes'}
        subtitle={(
          <span className="inline-flex items-center gap-2">
            <MedicalAidLogo name={fundCode ?? doc.fundName} />
            {`${fundLabel(fundCode, doc.fundName)} · ${doc.paymentReference ?? doc.statementNumber ?? fileName}`}
          </span>
        )}
        icon="solar:hand-money-bold-duotone"
        footer={(
          <>
            <SecondaryButton onClick={() => setConfirming(false)} disabled={posting}>Cancel</SecondaryButton>
            <PrimaryButton busy={posting} icon="solar:check-circle-bold-duotone" onClick={post}>{plan.mode === 'receipt' ? 'Post' : 'Record'}</PrimaryButton>
          </>
        )}
      >
        <div className="space-y-2">
          {plan.mode === 'receipt' && <SummaryRow strong label={`One receipt from ${fundProviderName(context.funds, effectiveDoc)}`} value={nad(plan.receiptAmountCents)} />}
          {plan.mode === 'receipt' && <SummaryRow label={`Allocated to ${new Set(plan.allocations.map(item => item.invoiceId)).size} invoice(s)`} value={nad(plan.totals.allocatedCents)} />}
          {plan.totals.suspenseCents > 0 && <SummaryRow tone="warning" label="Kept as unallocated credit (to match later)" value={nad(plan.totals.suspenseCents)} />}
          {plan.shortfalls.length > 0 && <SummaryRow label={`Moved to ${plan.shortfalls.length} patient account(s)`} value={nad(plan.totals.shortfallCents)} />}
          {plan.writeOffs.length > 0 && <SummaryRow label={`Written off on ${plan.writeOffs.length} invoice(s)`} value={nad(plan.totals.writeOffCents)} />}
          {plan.reversals.length > 0 && <SummaryRow label="Earlier shortfalls or write-offs undone (paid after all)" value={String(plan.reversals.length)} />}
          {plan.resolves.length > 0 && <SummaryRow tone="good" label="Earlier rejections settled" value={String(plan.resolves.length)} />}
          {plan.rejections.length > 0 && <SummaryRow label="Lines to the rejection queue" value={String(plan.rejections.length)} />}
        </div>
        {plan.warnings.length > 0 && (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {plan.warnings.map(warning => <li key={warning}>{warning}</li>)}
          </ul>
        )}
        <p className="mt-4 text-sm text-gray-500">Everything is saved together or not at all. Posting the same payment again changes nothing.</p>
        {postError && <div className="mt-4"><ErrorBox>{postError}</ErrorBox></div>}
      </Sheet>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string; tone?: 'green' | 'amber' | 'red' }> = ({ label, value, tone }) => (
  <div className={`rounded-lg border p-3 text-center ${tone === 'green' ? 'border-green-200 bg-green-50' : tone === 'amber' ? 'border-amber-200 bg-amber-50' : tone === 'red' ? 'border-red-200 bg-red-50' : 'border-gray-200 bg-gray-50'}`}>
    <p className="text-xs text-gray-600">{label}</p>
    <p className="text-lg font-bold text-gray-900">{value}</p>
  </div>
);

const OutcomeSummary: React.FC<{ plan: PostingPlan; doc: RemittanceDocument }> = ({ plan, doc }) => {
  const money = doc.kind === 'payment' || doc.kind === 'month_summary';
  return (
    <SectionCard title="What posting will do" subtitle="Worked out from the matches and the funds' reason codes" icon="solar:calculator-minimalistic-bold-duotone" tone="cyan">
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 md:grid-cols-2">
        {money && plan.mode === 'receipt' && <SummaryRow strong label="Fund receipt" value={nad(plan.receiptAmountCents)} />}
        {money && plan.mode === 'receipt' && <SummaryRow label="Allocated to invoices" value={nad(plan.totals.allocatedCents)} />}
        {money && plan.totals.suspenseCents > 0 && <SummaryRow tone="warning" label="Unallocated (suspense)" value={nad(plan.totals.suspenseCents)} />}
        {plan.totals.shortfallCents > 0 && <SummaryRow label="Patient portions to bill" value={`${plan.shortfalls.length} · ${nad(plan.totals.shortfallCents)}`} />}
        {plan.totals.writeOffCents > 0 && <SummaryRow label="Written off" value={nad(plan.totals.writeOffCents)} />}
        <SummaryRow label="To fix and resubmit" value={String(plan.totals.toResubmit)} />
        <SummaryRow label="Waiting for the fund" value={String(plan.totals.onHold)} />
        <SummaryRow label="Patient may be billed (queue)" value={String(plan.totals.toBill)} />
        <SummaryRow label="Write-offs to approve (queue)" value={String(plan.totals.toWriteOff)} />
        <SummaryRow label="Need a decision" value={String(plan.totals.toReview)} />
        {plan.totals.duplicates > 0 && <SummaryRow label="Already paid earlier" value={String(plan.totals.duplicates)} />}
      </div>
      {plan.warnings.length > 0 && (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-amber-800">
          {plan.warnings.map(warning => <li key={warning}>{warning}</li>)}
        </ul>
      )}
    </SectionCard>
  );
};

interface GroupCardProps {
  group: VisitGroup;
  lines: RemittanceLine[];
  decisions: Map<number, LineDecision>;
  invoice: { invoiceNumber: string; patientName: string } | null;
  confirmed: boolean;
  lineConfidence: (seq: number) => 'exact' | 'likely' | 'none';
  administrator: RemittanceDocument['administrator'];
  legend: Record<string, string>;
  onConfirm: () => void;
  onPick: () => void;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, lines, decisions, invoice, confirmed, lineConfidence, administrator, legend, onConfirm, onPick }) => {
  const needsConfirm = group.confidence === 'likely' && !confirmed && !group.manual;
  return (
    <li className="rounded-xl border border-gray-200 p-3 sm:p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium text-gray-900">
            {group.label.patientName ?? 'Patient not named'}
            <span className="font-normal text-gray-500"> · {formatDateKey(group.label.serviceDate)}</span>
          </p>
          <p className="text-xs text-gray-500">
            {group.label.memberNumber ? `Member ${group.label.memberNumber}` : ''}
            {group.label.reference ? `${group.label.memberNumber ? ' · ' : ''}Ref ${group.label.reference}` : ''}
          </p>
          <p className="mt-1 text-sm text-gray-700">
            <Icon icon="solar:arrow-right-bold-duotone" className="mr-1 inline h-4 w-4 text-gray-400" aria-hidden="true" />
            {invoice ? `Invoice ${invoice.invoiceNumber} · ${invoice.patientName}` : 'No claim found'}
          </p>
          <p className="text-xs text-gray-500">{group.rule}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ConfidenceChip confidence={group.confidence} confirmed={confirmed || group.manual} />
          {needsConfirm && <ActionButton icon="solar:check-circle-bold-duotone" label="Confirm" onClick={onConfirm} />}
          <ActionButton icon="solar:pen-bold-duotone" label={group.invoiceId ? 'Change' : 'Choose invoice'} onClick={onPick} />
        </div>
      </div>
      <ul className="mt-3 divide-y divide-gray-100 border-t border-gray-100">
        {lines.map(line => {
          const decision = decisions.get(line.seq);
          const reasons = classifyLineReasons(administrator, line.reasonCodes, line.reasonTexts, legend, line.status === 'paid');
          const confidence = lineConfidence(line.seq);
          return (
            <li key={line.seq} className="grid grid-cols-1 gap-1 py-2 text-sm md:grid-cols-[minmax(0,1.2fr)_auto_minmax(0,1.6fr)] md:items-center md:gap-4">
              <div className="min-w-0">
                <span className="font-mono font-medium text-gray-900">{line.tariffRaw ? displayTariff(line.tariffRaw) : 'Claim'}</span>
                {line.reasonCodes.length > 0 && <span className="ml-2 text-xs text-gray-500" title={line.reasonTexts.join(' / ') || undefined}>code {line.reasonCodes.join('/')}</span>}
                {confidence !== group.confidence && <span className="ml-2"><ConfidenceChip confidence={confidence} confirmed={confirmed} /></span>}
                {reasons.primary && (
                  <p className="text-xs text-gray-600" title={reasons.primary.fundText ?? undefined}>{reasons.primary.meaning}</p>
                )}
              </div>
              <div className="flex gap-4 tabular-nums text-gray-700 md:justify-end">
                <span><span className="text-xs text-gray-500">Claimed </span>{nad(line.claimedCents ?? 0)}</span>
                <span className={line.paidCents < (line.claimedCents ?? 0) ? 'text-amber-800' : 'text-green-700'}><span className="text-xs text-gray-500">{LINE_STATUS_LABELS[line.status]} </span>{nad(line.paidCents)}</span>
              </div>
              <p className="text-xs text-gray-600">{decision?.explanation}</p>
            </li>
          );
        })}
      </ul>
    </li>
  );
};
