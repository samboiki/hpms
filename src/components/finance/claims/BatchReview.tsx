import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { buildClaimFile, joinDiagnosisCodes, splitDiagnosisCodes } from '../../../utils/billing/claimFile';
import { validateClaimBatch, type LineValidation } from '../../../utils/billing/claimValidation';
import { describeDeadline, getFundRule } from '../../../utils/billing/fundRules';
import { formatNad, toCents } from '../../../utils/billing/money';
import { formatServiceDate, todayKey } from '../../../utils/billing/dates';
import { isValidIcd10Format, normalizeIcd10, type Icd10Selection } from '../../../utils/billing/icd10';
import Icd10CodeInput from '../../billing/Icd10CodeInput';
import Icd10SearchInput from '../../billing/Icd10SearchInput';
import { useIcd10Entries } from '../../../hooks/useIcd10Search';
import { loadTariffIcd10Defaults } from '../../../services/icd10DefaultsService';
import { buildClaimLines, linesOfInvoice, matchInvoiceServices } from './buildClaimLines';
import {
  isOpenBatch,
  loadBatchLineSources,
  loadInvoiceClaimPlaces,
  loadLineOutcomes,
  removeInvoiceFromBatch,
  saveInvoiceLineCodes,
  saveLineDiagnoses,
  type LineOutcomeRow
} from './claimsService';
import { KEPT_ON_CLAIM_TEXT, initialDrafts, planCodeWriteBack } from './reviewCodes';
import ClaimFilePreview from './ClaimFilePreview';
import ClaimReportSheet from './ClaimReportSheet';
import { claimFileHeaderOf, storedClaimFile } from './claimReport';
import { outcomeCounts } from './batchFollowUp';
import { LINE_OUTCOME_META, batchStatus, type ClaimLineOutcome } from './status';
import { MedicalAidLogo } from '../../ui/MedicalAidLogo';
import SubmitBatchDialog from './SubmitBatchDialog';
import { downloadTextFile } from './download';
import { mergePreSendIssues, preSendIssues, type PreSendHistory } from './preSendChecks';
import { loadPreSendHistory, type PreSendHistoryLoad } from './preSendHistory';
import { claimBatchLink, invoiceLink, visitLink } from '../../billing/invoiceLinks';
import CorrectClaimLineSheet from './CorrectClaimLineSheet';
import { REVERSAL_STATE_META, claimedPractitionerOf, isCreditBatch, type SentLineValues } from './claimCorrections';
import { loadReversals, type ReversalRow } from './claimCorrectionsService';
import type { ClaimLine } from '../../../utils/billing/claimLine';
import { parseToothList } from '../../../utils/billing/pricing';
import { lineTeethLabel } from '../../../utils/dental/lineTeeth';
import { ClaimLineStoryButton } from '../practiceReports/ClaimLineStorySheet';
import { useBatchLabSlips } from '../../dental/useBatchLabSlips';
import type { BatchHeaderRow, BatchLineSources, FundProvider, Icd10Draft, PracticeInfo, SubmitBatchResult } from './types';

// Until remittances are imported (or while they load) only the checks that need no history run: dependant code, membership
const NO_HISTORY: PreSendHistory = { remittanceLines: null, earlierRejections: new Map() };

interface BatchReviewProps {
  practice: PracticeInfo;
  batch: BatchHeaderRow;
  fund: FundProvider | undefined;
  userId: string | null;
  onBack: () => void;
  /** Called after something was saved or submitted, so the batch list reloads. */
  onChanged: () => void;
}

/** Open batches filter by the checks; sent batches by what the fund answered on each line */
type LineFilter = 'all' | 'errors' | 'warnings' | ClaimLineOutcome | 'none';
const PAGE_SIZE = 100;
const OUTCOME_FILTERS: ReadonlyArray<ClaimLineOutcome | 'none'> = ['paid', 'part_paid', 'rejected', 'waiting', 'none'];

/** The fund's answer on one line, as a word with an icon (never colour alone) */
const OutcomeChip: React.FC<{ row: LineOutcomeRow | undefined; amount: number }> = ({ row, amount }) => {
  const meta = LINE_OUTCOME_META[row?.outcome ?? 'none'];
  const paid = row && row.outcome === 'part_paid' ? ` ${formatNad(row.paidCents / 100)} of ${Number.isFinite(amount) ? formatNad(amount) : '-'}` : '';
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${meta.chip}`}
      title={row?.answeredOn ? `Answered ${formatServiceDate(row.answeredOn)}${row.answers > 1 ? ` (${row.answers} answers)` : ''}` : undefined}
    >
      <Icon icon={meta.icon} className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
      {paid}
    </span>
  );
};

/**
 * Review of one batch before submission: every line is validated (member, patient, practice,
 * HPCNA number, tariff code, ICD-10, fund deadline, amounts) and checked against what the funds
 * paid and refused before (preSendChecks.ts), ICD-10 codes are confirmed per line, and the claim
 * file can be previewed, downloaded and submitted once there are no errors. On a sent batch each line shows what the
 * fund answered and any reversal of it, and can be corrected and sent again (CorrectClaimLineSheet); a credit file
 * (header transaction type C) lists the reversals it carries, each linked to its credit note and the batch it reverses.
 */
const BatchReview: React.FC<BatchReviewProps> = ({ practice, batch, fund, userId, onBack, onChanged }) => {
  const [sources, setSources] = useState<BatchLineSources | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Icd10Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<LineFilter>('all');
  const [page, setPage] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  // What the fund answered per line (sent batches); null until loaded or while not set up
  const [outcomes, setOutcomes] = useState<Map<string, LineOutcomeRow> | null>(null);
  const [outcomesNote, setOutcomesNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [removingInvoiceId, setRemovingInvoiceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // What the funds paid and refused before, for the learned checks (loads after the lines; none until remittances exist)
  const [preSend, setPreSend] = useState<PreSendHistoryLoad | null>(null);
  const editable = isOpenBatch(batch);
  // A credit file (transaction type C) reverses lines claimed before: its codes come with the claims it reverses
  const credit = isCreditBatch(batch);
  const codesEditable = editable && !credit;
  // Reversals of this batch's lines (a sent batch) or in this credit file; null until loaded or while not set up
  const [reversals, setReversals] = useState<ReversalRow[] | null>(null);
  const [correctingKey, setCorrectingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // The practice's usual code per tariff code is suggested first, as on the visit's Billing tab (never throws)
    Promise.all([loadBatchLineSources(batch, practice), loadTariffIcd10Defaults(practice.id)])
      .then(([result, usual]) => {
        if (cancelled) return;
        setSources(usual.message ? { ...result, warnings: [...result.warnings, usual.message] } : result);
        loadPreSendHistory(practice.id, result.details)
          .then(history => {
            if (!cancelled) setPreSend(history);
          })
          .catch(err => {
            if (!cancelled) {
              setPreSend({ history: NO_HISTORY, note: `Earlier fund answers could not be read (${err instanceof Error ? err.message : 'unknown error'}), so those checks were skipped.` });
            }
          });
        setDrafts(initialDrafts(result, usual.status === 'ready' ? usual.defaults : null));
      })
      .catch(err => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the batch lines.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batch, practice, reloadKey]);

  useEffect(() => {
    if (editable) return;
    let cancelled = false;
    loadLineOutcomes([batch.id])
      .then(result => {
        if (cancelled) return;
        setOutcomes(result ?? new Map());
        setOutcomesNote(result === null ? "The funds' answers per line are not set up in this database yet (proposals/2026-10-08-claims-follow-up.sql)." : null);
      })
      .catch(err => {
        if (!cancelled) setOutcomesNote(`The funds' answers could not be loaded (${err instanceof Error ? err.message : 'unknown error'}).`);
      });
    return () => {
      cancelled = true;
    };
  }, [batch.id, editable, reloadKey]);

  useEffect(() => {
    if (editable && !credit) return;
    let cancelled = false;
    loadReversals(credit ? { creditBatchIds: [batch.id] } : { claimBatchIds: [batch.id] })
      .then(rows => {
        if (!cancelled) setReversals(rows);
      })
      .catch(() => {
        if (!cancelled) setReversals(null);
      });
    return () => {
      cancelled = true;
    };
  }, [batch.id, editable, credit, reloadKey]);

  const fundRule = getFundRule(batch.medical_aid_reference, fund?.name);
  const lines = useMemo(() => (sources ? buildClaimLines(sources, drafts) : []), [sources, drafts]);
  // What the medical aids' ICD-10 list says about every code on the batch, read in one query (none until it is read)
  const batchCodes = useMemo(() => lines.flatMap(line => [line.icd10Primary, ...line.icd10Secondary]), [lines]);
  const icd10List = useIcd10Entries(batchCodes);
  const icd10Master = icd10List.status === 'ready' ? icd10List.entries : null;
  // Dental 8099 lines need the lab's invoice lines that add up to them; the file writes them after the line (D28)
  const labSlips = useBatchLabSlips({ practiceType: practice.practice_type, lines, enabled: editable && !credit });
  // The claim rules (the NAMAF dental rules only for dental practices), then what the funds' answers taught
  const validation = useMemo(
    () =>
      mergePreSendIssues(
        validateClaimBatch(lines, {
          today: todayKey(),
          fundRule,
          practiceNumber: practice.practice_number,
          practiceType: practice.practice_type,
          storedTotal: batch.total_amount,
          transactionType: batch.transaction_type,
          icd10Master
        }),
        // The learned checks are about claims the fund may refuse; a reversal takes a claim back
        [...(credit ? [] : preSendIssues(lines, preSend?.history ?? NO_HISTORY)), ...labSlips.issues]
      ),
    [lines, fundRule, practice.practice_number, practice.practice_type, batch.total_amount, batch.transaction_type, icd10Master, credit, preSend, labSlips.issues]
  );
  // Reversals by the line they reverse (a sent batch) or by their line in this credit file
  const reversalsByLine = useMemo(() => {
    const byLine = new Map<string, ReversalRow[]>();
    (reversals ?? []).forEach(row => {
      const key = credit ? row.creditLineId : row.claimLineId;
      if (key) byLine.set(key, [...(byLine.get(key) ?? []), row]);
    });
    return byLine;
  }, [reversals, credit]);
  // What the fund received on a line, for "Correct and send again": as the claim was built (the invoice line's date, else
  // the visit's; the practitioner it was claimed under, as claim_line_correct takes it) with the codes and authorisation
  // the batch line holds
  const sentValuesOf = (line: ClaimLine): SentLineValues => {
    const detail = sources?.details.find(item => item.id === line.key);
    const invoiceLine = sources ? matchInvoiceServices(sources.details, sources.invoiceServices).get(line.key) : undefined;
    const saved = splitDiagnosisCodes(detail?.diagnostic_code);
    return {
      serviceDate: line.serviceDate,
      patientId: detail?.patient_id ?? null,
      icd10: saved.primary ? [saved.primary, ...saved.secondary] : [],
      practitionerId: claimedPractitionerOf(invoiceLine?.practitioner_id, detail?.invoice_id ? sources?.invoicePractitioners?.get(detail.invoice_id) : null),
      authorisationNumber: (detail?.authorisation_number ?? '').trim(),
      // Claim field 29 as the file carries it: a correction to another practitioner may move it (partner billing)
      practiceNumber: line.practiceNumber
    };
  };
  const patientIdByLine = useMemo(() => new Map((sources?.details ?? []).map(detail => [detail.id, detail.patient_id])), [sources]);
  const resultByKey = useMemo(() => new Map(validation.lines.map(result => [result.key, result])), [validation]);
  // A sent batch shows, downloads and reports the file exactly as it was sent when the batch kept it
  const file = useMemo(
    () => (!editable ? storedClaimFile(batch) : null) ?? buildClaimFile(claimFileHeaderOf(batch), labSlips.fileLines),
    [labSlips.fileLines, batch, editable]
  );
  const counts = useMemo(() => outcomeCounts(lines.map(line => line.key), key => outcomes?.get(key)?.outcome), [lines, outcomes]);

  const submitBy = useMemo(() => {
    // A credit file has no deadline: a reversal is never late
    if (credit) return null;
    const days = validation.lines.map(result => result.deadline.lastDay).filter((day): day is string => Boolean(day));
    return days.length > 0 ? days.sort()[0] : null;
  }, [validation, credit]);

  const visibleLines = useMemo(() => {
    const matches = (key: string, result: LineValidation | undefined) =>
      filter === 'all' ||
      (filter === 'errors' && (result?.errors.length ?? 0) > 0) ||
      (filter === 'warnings' && (result?.warnings.length ?? 0) > 0) ||
      (filter !== 'errors' && filter !== 'warnings' && (outcomes?.get(key)?.outcome ?? 'none') === filter);
    return lines.filter(line => matches(line.key, resultByKey.get(line.key)));
  }, [lines, resultByKey, filter, outcomes]);
  const pageCount = Math.max(1, Math.ceil(visibleLines.length / PAGE_SIZE));
  const pageLines = visibleLines.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // A line is unsaved when its confirmed codes (primary and secondary) differ from what the batch line holds
  const savedCodesOf = (key: string) => {
    const saved = splitDiagnosisCodes(sources?.details.find(detail => detail.id === key)?.diagnostic_code);
    return joinDiagnosisCodes(saved.primary, saved.secondary);
  };
  const unsavedCodes = lines.filter(line => {
    const draft = drafts[line.key];
    const primary = normalizeIcd10(draft?.primary ?? '');
    return draft?.confirmed && isValidIcd10Format(primary) && joinDiagnosisCodes(primary, draft.secondary) !== savedCodesOf(line.key);
  });

  const setDraft = (key: string, selection: Icd10Selection) =>
    setDrafts(previous => ({
      ...previous,
      [key]: { primary: selection.primary, secondary: selection.secondary, confirmed: true, source: 'entered' }
    }));

  const confirmDraft = (key: string) =>
    setDrafts(previous => ({ ...previous, [key]: { ...previous[key], confirmed: true } }));

  const applyToInvoice = (key: string) => {
    const source = drafts[key];
    const line = lines.find(item => item.key === key);
    if (!source || !line) return;
    const keys = linesOfInvoice(lines, line.invoiceId);
    setDrafts(previous => {
      const next = { ...previous };
      keys.forEach(other => {
        next[other] = { primary: source.primary, secondary: [...source.secondary], confirmed: true, source: 'entered' };
      });
      return next;
    });
    setNotice(`Codes applied to ${keys.length} line(s) of invoice ${line.invoiceNumber}.`);
  };

  // Puts codes just saved on the claim on the invoice lines too (reviewCodes.ts says which); returns what to tell staff
  const copyCodesToInvoices = async (current: BatchLineSources, saved: Map<string, Icd10Selection>): Promise<string> => {
    if (!current.lineCodes) return ' The invoice lines cannot hold ICD-10 codes until proposals/2026-10-08-invoice-line-codes.sql is applied.';
    try {
      const plan = planCodeWriteBack({
        batch,
        lines,
        details: current.details,
        saved,
        invoiceLines: matchInvoiceServices(current.details, current.invoiceServices),
        places: await loadInvoiceClaimPlaces(unsavedCodes.map(line => line.invoiceId).filter((id): id is string => Boolean(id)))
      });
      const result = await saveInvoiceLineCodes(batch.id, plan.copies);
      return [
        result.copied > 0 ? ` The invoice lines now carry the same codes (${result.copied} invoice line(s) updated).` : '',
        ...plan.kept.map(item => ` Invoice ${item.invoiceNumber} keeps them on the claim only: ${KEPT_ON_CLAIM_TEXT[item.reason]}.`),
        ...result.failed.map(item => ` Invoice ${item.invoiceNumber}: its lines could not take the codes (${item.message}).`),
        ...result.left.map(
          number => ` Invoice ${number} is no longer in this batch: the database batched it again when its lines changed (check the patient's medical aid and "Do not claim").`
        )
      ].join('');
    } catch (err) {
      return ` The codes could not be put on the invoice lines: ${err instanceof Error ? err.message : 'unknown error'}.`;
    }
  };

  const saveCodes = async () => {
    if (!editable || !sources || unsavedCodes.length === 0 || saving) return;
    const alsoInvoice = sources.lineCodes ? ' They also go on the invoice lines, so the invoice and a later resubmission carry the same codes.' : '';
    if (!window.confirm(`Save the confirmed ICD-10 codes on ${unsavedCodes.length} line(s) of batch ${batch.batch_number}?${alsoInvoice}`)) return;
    setSaving(true);
    setNotice(null);
    try {
      const saved = new Map(unsavedCodes.map(line => [line.key, { primary: normalizeIcd10(drafts[line.key].primary), secondary: drafts[line.key].secondary }]));
      const { shortened } = await saveLineDiagnoses(batch.id, [...saved].map(([detailId, codes]) => ({ detailId, ...codes })));
      setNotice(
        `Saved ICD-10 codes on ${unsavedCodes.length} line(s).` +
          (shortened > 0
            ? ` ${shortened} line(s) kept only their first codes: the database holds 20 characters per line until the column is widened (proposals/2026-10-07-claim-diagnoses.sql).`
            : '') +
          (await copyCodesToInvoices(sources, saved))
      );
      setReloadKey(key => key + 1);
      onChanged();
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The ICD-10 codes could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitted = (result: SubmitBatchResult) => {
    if (result.status === 'sent' || result.status === 'sent_not_recorded') onChanged();
  };

  // One row per invoice in the batch, for "remove this invoice from the batch"
  const invoiceGroups = useMemo(() => {
    const groups = new Map<string, { invoiceId: string | null; invoiceNumber: string; patientName: string; lineCount: number; totalCents: number }>();
    lines.forEach(line => {
      const key = line.invoiceId ?? `number:${line.invoiceNumber}`;
      const group = groups.get(key) ?? { invoiceId: line.invoiceId, invoiceNumber: line.invoiceNumber, patientName: line.patientName, lineCount: 0, totalCents: 0 };
      group.lineCount += 1;
      group.totalCents += Number.isFinite(line.amount) ? toCents(line.amount) : 0;
      groups.set(key, group);
    });
    return [...groups.values()];
  }, [lines]);

  const removeInvoice = async (group: { invoiceId: string | null; invoiceNumber: string; lineCount: number; totalCents: number }) => {
    if (!group.invoiceId || removingInvoiceId) return;
    const confirmed = window.confirm(
      `Remove invoice ${group.invoiceNumber} (${group.lineCount} line(s), ${formatNad(group.totalCents / 100)}) from batch ${batch.batch_number}?\n\n` +
        'It will not be claimed in this batch. Use this to correct the invoice: when its billing lines are saved again it is ' +
        'normally added to the fund\'s open batch automatically; otherwise add it from "Not yet batched".'
    );
    if (!confirmed) return;
    setRemovingInvoiceId(group.invoiceId);
    setNotice(null);
    try {
      const result = await removeInvoiceFromBatch(batch, group.invoiceId, group.invoiceNumber);
      setNotice(result.message);
      if (result.status !== 'blocked') {
        setReloadKey(key => key + 1);
        onChanged();
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'The invoice could not be removed from the batch.');
    } finally {
      setRemovingInvoiceId(null);
    }
  };

  // A reload after saving or submitting keeps the screen (and any open dialog) in place
  if (loading && !sources) {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <div className="mr-3 h-8 w-8 animate-spin rounded-full border-b-2 border-cyan-600" />
        <span className="text-gray-600">Loading batch {batch.batch_number}...</span>
      </div>
    );
  }

  if (!sources) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
        <p className="mb-3">{error ?? 'The batch could not be loaded.'}</p>
        <div className="flex gap-2">
          <button type="button" onClick={() => setReloadKey(key => key + 1)} className="rounded-lg bg-white px-3 py-1.5 border border-red-200 hover:bg-red-100">
            Retry
          </button>
          <button type="button" onClick={onBack} className="rounded-lg bg-white px-3 py-1.5 border border-gray-200 hover:bg-gray-100 text-gray-700">
            Back to batches
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-cyan-700 hover:underline">
            <Icon icon="solar:arrow-left-linear" className="h-4 w-4" />
            All batches
          </button>
          <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-gray-900">
            <MedicalAidLogo name={fund?.name ?? batch.medical_aid_reference} size="md" />
            <span>{credit ? 'Credit file' : 'Batch'} {batch.batch_number} - {fund?.name ?? batch.medical_aid_reference}</span>
            {!editable && (
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${batchStatus(batch).className}`} title={batchStatus(batch).hint}>
                {batchStatus(batch).label}
              </span>
            )}
          </h3>
          {credit ? (
            <p className="text-sm text-gray-500">
              {lines.length} reversal(s), {formatNad(validation.totalCents / 100)} credited. A credit file (transaction type C) takes back lines
              the fund was claimed for; it has no deadline.
            </p>
          ) : (
            <p className="text-sm text-gray-500">
              {lines.length} line(s), {formatNad(validation.totalCents / 100)}. Deadline: {fundRule.label} ({describeDeadline(fundRule)} from the service date)
              {submitBy ? `; submit by ${formatServiceDate(submitBy)}` : ''}.
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {codesEditable && (
            <button
              type="button"
              onClick={saveCodes}
              disabled={unsavedCodes.length === 0 || saving}
              className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Icon icon="solar:diskette-bold-duotone" className="h-4 w-4" />
              {saving ? 'Saving...' : `Save ICD-10 codes (${unsavedCodes.length})`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon icon="solar:eye-bold-duotone" className="h-4 w-4" />
            Preview file
          </button>
          <button
            type="button"
            onClick={() => setShowReport(true)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Claim report
          </button>
          <button
            type="button"
            onClick={() => downloadTextFile(file.fileName, file.content)}
            className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" />
            Download
          </button>
          {editable && (
            <button
              type="button"
              onClick={() => setShowSubmit(true)}
              disabled={!validation.canSubmit}
              title={validation.canSubmit ? `Email the ${credit ? 'credit' : 'claim'} file to the fund` : 'Fix the errors before submitting'}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon="solar:plain-bold-duotone" className="h-4 w-4" />
              {credit ? 'Send to fund' : 'Submit to fund'}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Lines ready</p>
          <p className="text-xl font-semibold text-gray-900">{validation.validLineCount} / {lines.length}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Errors (block submission)</p>
          <p className={`text-xl font-semibold ${validation.errorCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{validation.errorCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">Warnings</p>
          <p className={`text-xl font-semibold ${validation.warningCount > 0 ? 'text-amber-600' : 'text-gray-900'}`}>{validation.warningCount}</p>
        </div>
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs text-gray-500">{credit ? 'Total credited' : 'Total claimed'}</p>
          <p className="text-xl font-semibold text-gray-900">{formatNad(validation.totalCents / 100)}</p>
        </div>
      </div>

      {!editable && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          This batch was already submitted ({batchStatus(batch).label.toLowerCase()}{batch.sent_at ? `, sent ${formatServiceDate(new Date(batch.sent_at))}` : ''}); it can be viewed and downloaded but not changed.
          {!credit && ' A line that was wrong can be corrected and sent again (resubmission R) without waiting for the fund.'}
        </p>
      )}
      {notice && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{notice}</p>}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          The batch could not be refreshed: {error}
        </p>
      )}
      {[...sources.warnings, ...(preSend?.note ? [preSend.note] : []), ...(labSlips.note ? [labSlips.note] : []), ...validation.batchIssues.map(issue => issue.message)].length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          {[...sources.warnings, ...(preSend?.note ? [preSend.note] : []), ...(labSlips.note ? [labSlips.note] : [])].map(message => (
            <li key={message} className="text-amber-800">{message}</li>
          ))}
          {validation.batchIssues.map(issue => (
            <li key={issue.message} className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-800'}>{issue.message}</li>
          ))}
        </ul>
      )}

      {codesEditable && invoiceGroups.length > 0 && (
        <details className="rounded-lg border border-gray-200">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-medium text-gray-700">
            Invoices in this batch ({invoiceGroups.length}) - remove an invoice to correct its billing
          </summary>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {invoiceGroups.map(group => (
                <tr key={group.invoiceId ?? group.invoiceNumber}>
                  <td className="px-3 py-2 font-medium text-gray-900">{group.invoiceNumber}</td>
                  <td className="px-3 py-2 text-gray-600">{group.patientName || 'Unknown patient'}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{group.lineCount} line(s)</td>
                  <td className="px-3 py-2 text-right text-gray-900">{formatNad(group.totalCents / 100)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => removeInvoice(group)}
                      disabled={!group.invoiceId || removingInvoiceId !== null}
                      title={group.invoiceId ? undefined : 'These lines are not linked to an invoice'}
                      className="text-xs font-medium text-red-700 hover:underline disabled:opacity-40"
                    >
                      {removingInvoiceId !== null && removingInvoiceId === group.invoiceId ? 'Removing...' : 'Remove from batch'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {outcomesNote && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{outcomesNote}</p>}

      <div className="flex flex-wrap items-center gap-2 text-sm" role="group" aria-label="Show lines">
        <span className="text-gray-600">{editable ? 'Show' : "The fund's answer"}</span>
        {(editable ? (['all', 'errors', 'warnings'] as LineFilter[]) : (['all', ...OUTCOME_FILTERS.filter(option => counts[option] > 0)] as LineFilter[])).map(option => (
          <button
            key={option}
            type="button"
            aria-pressed={filter === option}
            onClick={() => {
              setFilter(option);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 ${filter === option ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {option === 'all'
              ? `All lines (${lines.length})`
              : option === 'errors'
                ? 'Lines with errors'
                : option === 'warnings'
                  ? 'Lines with warnings'
                  : `${LINE_OUTCOME_META[option].label} (${counts[option]})`}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-3 py-2">Line</th>
              <th className="px-3 py-2">Invoice / patient</th>
              <th className="px-3 py-2">Service date</th>
              <th className="px-3 py-2">Code</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Amount</th>
              {!editable && <th className="px-3 py-2">Fund&apos;s answer</th>}
              <th className="px-3 py-2">ICD-10</th>
              <th className="px-3 py-2">Checks</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {pageLines.map(line => {
              const result = resultByKey.get(line.key);
              const draft = drafts[line.key];
              const errorCount = result?.errors.length ?? 0;
              const warningCount = result?.warnings.length ?? 0;
              const answer = outcomes?.get(line.key);
              return (
                <React.Fragment key={line.key}>
                  <tr className={errorCount > 0 && editable ? 'bg-red-50/40' : !editable ? LINE_OUTCOME_META[answer?.outcome ?? 'none'].row : ''}>
                    <td className="px-3 py-2 font-mono text-gray-700">{line.transactionNumber}</td>
                    <td className="px-3 py-2">
                      {line.invoiceId ? (
                        <Link to={invoiceLink(line.invoiceId)} className="font-medium text-cyan-700 hover:underline" title="Open the invoice in Finance">
                          {line.invoiceNumber}
                        </Link>
                      ) : credit && reversalsByLine.get(line.key)?.[0] ? (
                        <Link to={invoiceLink(reversalsByLine.get(line.key)?.[0]?.invoiceId ?? '')} className="font-medium text-cyan-700 hover:underline" title="Open the invoice and its credit note">
                          {line.invoiceNumber}
                        </Link>
                      ) : (
                        <div className="font-medium text-gray-900">{line.invoiceNumber}</div>
                      )}
                      <div className="text-xs text-gray-500">{line.patientName || 'Unknown patient'}</div>
                      {/* Who treated (their HPCNA number goes on the line) and who bills: a partner's own practice number (D31) */}
                      {line.treatingPractitionerName && <div className="text-xs text-gray-500">Treated by {line.treatingPractitionerName}</div>}
                      {line.practiceNumber && line.practiceNumber === line.practitionerPracticeNumber && (
                        <div className="text-xs font-medium text-cyan-700">Bills under own practice no {line.practiceNumber}</div>
                      )}
                      {credit && reversalsByLine.get(line.key)?.map(reversal => (
                        <div key={reversal.id} className="text-xs text-gray-600">
                          {reversal.creditNoteNumber} reverses{' '}
                          <Link to={claimBatchLink(reversal.claimBatchId)} className="text-cyan-700 hover:underline">batch {reversal.claimBatchNumber ?? ''}</Link>
                        </div>
                      ))}
                      {line.visitId && patientIdByLine.get(line.key) && (
                        <Link to={visitLink(patientIdByLine.get(line.key) as string, line.visitId)} className="text-xs text-cyan-700 hover:underline">
                          Open visit
                        </Link>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-700">{formatServiceDate(line.serviceDate)}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono">{line.tariffCode}</span>
                      {(line.toothNumbers || line.toothQuadrant) && (
                        <span className="ml-1 text-xs text-gray-500">
                          {lineTeethLabel({ teeth: parseToothList(line.toothNumbers), surfaces: line.toothSurfaces, quadrant: line.toothQuadrant })}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">{line.quantity}</td>
                    <td className="px-3 py-2 text-right">{Number.isFinite(line.amount) ? formatNad(line.amount) : '-'}</td>
                    {!editable && (
                      <td className="px-3 py-2">
                        <OutcomeChip row={answer} amount={line.amount} />
                        {!credit && reversalsByLine.get(line.key)?.map(reversal => (
                          <span key={reversal.id} className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${REVERSAL_STATE_META[reversal.state].chip}`}>
                            <Icon icon={REVERSAL_STATE_META[reversal.state].icon} className="h-3.5 w-3.5" aria-hidden="true" />
                            {reversal.creditNoteNumber}: {REVERSAL_STATE_META[reversal.state].label.toLowerCase()}
                          </span>
                        ))}
                        {!credit && line.invoiceId && answer?.outcome !== 'paid' && answer?.outcome !== 'part_paid' && (
                          <button
                            type="button"
                            onClick={() => setCorrectingKey(line.key)}
                            className="mt-1 block text-xs font-medium text-cyan-700 hover:underline"
                          >
                            Correct and send again
                          </button>
                        )}
                        {/* Sent, answered, corrected, sent again, reversed and paid, on one timeline (F10) */}
                        <ClaimLineStoryButton claimLineId={line.key} />
                      </td>
                    )}
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <Icd10SearchInput
                          value={draft?.primary ?? ''}
                          disabled={!codesEditable}
                          placeholder="e.g. J06.9"
                          ariaLabel={`ICD-10 code for line ${line.transactionNumber}`}
                          onChange={text => setDraft(line.key, { primary: text.toUpperCase(), secondary: draft?.secondary ?? [] })}
                          onPick={option => setDraft(line.key, { primary: option.code, secondary: draft?.secondary ?? [] })}
                          onBlur={() => draft && setDraft(line.key, { primary: normalizeIcd10(draft.primary), secondary: draft.secondary })}
                          className="w-24 rounded border border-gray-300 px-2 py-1 font-mono text-xs disabled:bg-gray-100"
                        />
                        {draft && draft.secondary.length > 0 && (
                          <span className="text-xs text-gray-500" title={draft.secondary.join(', ')}>+{draft.secondary.length}</span>
                        )}
                        {codesEditable && (
                          <button
                            type="button"
                            onClick={() => setExpandedKey(expandedKey === line.key ? null : line.key)}
                            className="text-xs text-cyan-700 hover:underline"
                          >
                            {expandedKey === line.key ? 'Close' : 'More'}
                          </button>
                        )}
                      </div>
                      {(draft?.source === 'visit-notes' || draft?.source === 'usual-for-code' || draft?.source === 'code-default') &&
                        !draft.confirmed &&
                        codesEditable && (
                          <button type="button" onClick={() => confirmDraft(line.key)} className="mt-1 text-xs font-medium text-amber-700 hover:underline">
                            {draft.source === 'visit-notes'
                              ? 'From visit notes'
                              : draft.source === 'usual-for-code'
                                ? `Usual code for ${line.tariffCode}`
                                : `Suggested for ${line.tariffCode}`}{' '}
                            - confirm
                          </button>
                        )}
                    </td>
                    <td className="px-3 py-2">
                      {errorCount === 0 && warningCount === 0 ? (
                        <span className="flex items-center gap-1 text-xs text-green-700">
                          <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" /> Ready
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 text-xs">
                          {errorCount > 0 && <span className="text-red-700">{errorCount} error(s)</span>}
                          {warningCount > 0 && <span className="text-amber-700">{warningCount} warning(s)</span>}
                        </span>
                      )}
                    </td>
                  </tr>
                  {(errorCount > 0 || warningCount > 0) && (
                    <tr className={errorCount > 0 && editable ? 'bg-red-50/40' : ''}>
                      <td />
                      <td colSpan={editable ? 7 : 8} className="px-3 pb-2">
                        <ul className="space-y-0.5 text-xs">
                          {result?.errors.map(issue => (
                            <li key={`e-${issue.field}-${issue.message}`} className="text-red-700">{issue.message}</li>
                          ))}
                          {result?.warnings.map(issue => (
                            <li key={`w-${issue.field}-${issue.message}`} className="text-amber-700">{issue.message}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                  {expandedKey === line.key && codesEditable && draft && (
                    <tr>
                      <td />
                      <td colSpan={7} className="px-3 pb-3">
                        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                          <Icd10CodeInput value={{ primary: draft.primary, secondary: draft.secondary }} onChange={selection => setDraft(line.key, selection)} />
                          <button type="button" onClick={() => applyToInvoice(line.key)} className="mt-2 text-xs font-medium text-cyan-700 hover:underline">
                            Use these codes for every line of invoice {line.invoiceNumber}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {visibleLines.length === 0 && <p className="p-4 text-center text-sm text-gray-500">No lines to show.</p>}
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">
            Previous
          </button>
          <span className="text-gray-600">Page {page + 1} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)} className="rounded-lg border px-3 py-1 disabled:opacity-40">
            Next
          </button>
        </div>
      )}

      {showPreview && (
        <ClaimFilePreview
          file={file}
          note={!editable || validation.canSubmit ? undefined : `Draft: ${validation.errorCount} error(s) must be fixed before this file can be submitted.`}
          onShowReport={() => {
            setShowPreview(false);
            setShowReport(true);
          }}
          onClose={() => setShowPreview(false)}
        />
      )}
      {showReport && (
        <ClaimReportSheet practice={practice} batch={batch} fund={fund} file={file} details={sources.details} onClose={() => setShowReport(false)} />
      )}
      {showSubmit && (
        <SubmitBatchDialog
          practice={practice}
          batch={batch}
          fund={fund}
          file={file}
          warningCount={validation.warningCount}
          submitBy={submitBy}
          userId={userId}
          onClose={() => setShowSubmit(false)}
          onSubmitted={handleSubmitted}
        />
      )}
      {correctingKey && (() => {
        const line = lines.find(item => item.key === correctingKey);
        if (!line) return null;
        return (
          <CorrectClaimLineSheet
            practiceId={practice.id}
            line={{
              id: line.key,
              batchNumber: batch.batch_number,
              lineNumber: line.transactionNumber,
              tariffCode: line.tariffCode,
              invoiceNumber: line.invoiceNumber,
              membershipNumber: line.membershipNumber,
              patientName: line.patientName
            }}
            sent={sentValuesOf(line)}
            fundName={fund?.name ?? batch.medical_aid_reference}
            onClose={() => setCorrectingKey(null)}
            onDone={message => {
              setCorrectingKey(null);
              setNotice(message);
              setReloadKey(key => key + 1);
              onChanged();
            }}
          />
        );
      })()}
    </div>
  );
};

export default BatchReview;
