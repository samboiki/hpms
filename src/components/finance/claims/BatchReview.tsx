import React, { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { buildClaimFile, type ClaimFileHeader } from '../../../utils/billing/claimFile';
import { validateClaimBatch, type LineValidation } from '../../../utils/billing/claimValidation';
import { describeDeadline, getFundRule } from '../../../utils/billing/fundRules';
import { formatNad, toCents } from '../../../utils/billing/money';
import { todayKey } from '../../../utils/billing/dates';
import { COMMON_ICD10_CODES, isValidIcd10Format, normalizeIcd10, type Icd10Selection } from '../../../utils/billing/icd10';
import Icd10CodeInput from '../../billing/Icd10CodeInput';
import { buildClaimLines, initialIcd10Draft, linesOfInvoice } from './buildClaimLines';
import { isOpenBatch, loadBatchLineSources, removeInvoiceFromBatch, saveLineDiagnoses } from './claimsService';
import ClaimFilePreview from './ClaimFilePreview';
import SubmitBatchDialog from './SubmitBatchDialog';
import { downloadTextFile } from './download';
import type { BatchHeaderRow, BatchLineSources, FundProvider, Icd10Draft, PracticeInfo, SubmitBatchResult } from './types';

interface BatchReviewProps {
  practice: PracticeInfo;
  batch: BatchHeaderRow;
  fund: FundProvider | undefined;
  userId: string | null;
  onBack: () => void;
  /** Called after something was saved or submitted, so the batch list reloads. */
  onChanged: () => void;
}

type LineFilter = 'all' | 'errors' | 'warnings';
const PAGE_SIZE = 100;

/**
 * Review of one batch before submission: every line is validated (member, patient, practice,
 * HPCNA number, tariff code, ICD-10, fund deadline, amounts), ICD-10 codes are confirmed per line,
 * and the claim file can be previewed, downloaded and submitted once there are no errors.
 */
const BatchReview: React.FC<BatchReviewProps> = ({ practice, batch, fund, userId, onBack, onChanged }) => {
  const datalistId = useId();
  const [sources, setSources] = useState<BatchLineSources | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Icd10Draft>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [filter, setFilter] = useState<LineFilter>('all');
  const [page, setPage] = useState(0);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showSubmit, setShowSubmit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingInvoiceId, setRemovingInvoiceId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const editable = isOpenBatch(batch);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadBatchLineSources(batch, practice)
      .then(result => {
        if (cancelled) return;
        setSources(result);
        setDrafts(
          Object.fromEntries(
            result.details.map(detail => [
              detail.id,
              initialIcd10Draft(detail, detail.visit_id ? result.visits.get(detail.visit_id) : undefined)
            ])
          )
        );
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

  const fundRule = getFundRule(batch.medical_aid_reference, fund?.name);
  const lines = useMemo(() => (sources ? buildClaimLines(sources, drafts) : []), [sources, drafts]);
  const validation = useMemo(
    () =>
      validateClaimBatch(lines, {
        today: todayKey(),
        fundRule,
        practiceNumber: practice.practice_number,
        storedTotal: batch.total_amount
      }),
    [lines, fundRule, practice.practice_number, batch.total_amount]
  );
  const resultByKey = useMemo(() => new Map(validation.lines.map(result => [result.key, result])), [validation]);
  const file = useMemo(() => {
    const header: ClaimFileHeader = {
      practiceNumber: batch.practice_number,
      batchNumber: batch.batch_number,
      batchDate: batch.batch_date,
      fundReference: batch.medical_aid_reference,
      systemIdentification: batch.system_identification,
      transactionType: batch.transaction_type,
      sourceSoftware: batch.source_software,
      sourceSoftwareVersion: batch.source_software_version
    };
    return buildClaimFile(header, lines);
  }, [lines, batch]);

  const submitBy = useMemo(() => {
    const days = validation.lines.map(result => result.deadline.lastDay).filter((day): day is string => Boolean(day));
    return days.length > 0 ? days.sort()[0] : null;
  }, [validation]);

  const visibleLines = useMemo(() => {
    const matches = (result: LineValidation | undefined) =>
      filter === 'all' ||
      (filter === 'errors' && (result?.errors.length ?? 0) > 0) ||
      (filter === 'warnings' && (result?.warnings.length ?? 0) > 0);
    return lines.filter(line => matches(resultByKey.get(line.key)));
  }, [lines, resultByKey, filter]);
  const pageCount = Math.max(1, Math.ceil(visibleLines.length / PAGE_SIZE));
  const pageLines = visibleLines.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const savedCodeOf = (key: string) => normalizeIcd10(sources?.details.find(detail => detail.id === key)?.diagnostic_code ?? '');
  const unsavedCodes = lines.filter(line => {
    const draft = drafts[line.key];
    const primary = normalizeIcd10(draft?.primary ?? '');
    return draft?.confirmed && isValidIcd10Format(primary) && primary !== savedCodeOf(line.key);
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

  const saveCodes = async () => {
    if (unsavedCodes.length === 0 || saving) return;
    if (!window.confirm(`Save the confirmed ICD-10 codes on ${unsavedCodes.length} line(s) of batch ${batch.batch_number}?`)) return;
    setSaving(true);
    setNotice(null);
    try {
      await saveLineDiagnoses(
        batch.id,
        unsavedCodes.map(line => ({ detailId: line.key, primary: normalizeIcd10(drafts[line.key].primary) }))
      );
      setNotice(`Saved ICD-10 codes on ${unsavedCodes.length} line(s). Secondary codes are kept on this screen only until the database has a column for them.`);
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
      <datalist id={datalistId}>
        {COMMON_ICD10_CODES.map(entry => (
          <option key={entry.code} value={entry.code}>{`${entry.code} - ${entry.description}`}</option>
        ))}
      </datalist>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="mb-2 flex items-center gap-1 text-sm text-cyan-700 hover:underline">
            <Icon icon="solar:arrow-left-linear" className="h-4 w-4" />
            All batches
          </button>
          <h3 className="text-lg font-semibold text-gray-900">
            Batch {batch.batch_number} - {fund?.name ?? batch.medical_aid_reference}
          </h3>
          <p className="text-sm text-gray-500">
            {lines.length} line(s), {formatNad(validation.totalCents / 100)}. Deadline: {fundRule.label} ({describeDeadline(fundRule)} from the service date)
            {submitBy ? `; submit by ${submitBy}` : ''}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
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
              title={validation.canSubmit ? 'Email the claim file to the fund' : 'Fix the errors before submitting'}
              className="flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Icon icon="solar:plain-bold-duotone" className="h-4 w-4" />
              Submit to fund
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
          <p className="text-xs text-gray-500">Total claimed</p>
          <p className="text-xl font-semibold text-gray-900">{formatNad(validation.totalCents / 100)}</p>
        </div>
      </div>

      {!editable && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-600">
          This batch was already submitted ({batch.status ?? 'sent'}{batch.sent_at ? `, ${batch.sent_at.slice(0, 10)}` : ''}); it can be viewed and downloaded but not changed.
        </p>
      )}
      {notice && <p className="rounded-lg border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-800">{notice}</p>}
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          The batch could not be refreshed: {error}
        </p>
      )}
      {[...sources.warnings, ...validation.batchIssues.map(issue => issue.message)].length > 0 && (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
          {sources.warnings.map(message => (
            <li key={message} className="text-amber-800">{message}</li>
          ))}
          {validation.batchIssues.map(issue => (
            <li key={issue.message} className={issue.severity === 'error' ? 'text-red-700' : 'text-amber-800'}>{issue.message}</li>
          ))}
        </ul>
      )}

      {editable && invoiceGroups.length > 0 && (
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

      <div className="flex items-center gap-2 text-sm">
        <span className="text-gray-600">Show</span>
        {(['all', 'errors', 'warnings'] as const).map(option => (
          <button
            key={option}
            type="button"
            onClick={() => {
              setFilter(option);
              setPage(0);
            }}
            className={`rounded-full px-3 py-1 ${filter === option ? 'bg-cyan-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {option === 'all' ? `All lines (${lines.length})` : option === 'errors' ? 'Lines with errors' : 'Lines with warnings'}
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
              return (
                <React.Fragment key={line.key}>
                  <tr className={errorCount > 0 ? 'bg-red-50/40' : ''}>
                    <td className="px-3 py-2 font-mono text-gray-700">{line.transactionNumber}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900">{line.invoiceNumber}</div>
                      <div className="text-xs text-gray-500">{line.patientName || 'Unknown patient'}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700">{line.serviceDate ?? '-'}</td>
                    <td className="px-3 py-2">
                      <span className="font-mono">{line.tariffCode}</span>
                      {line.toothNumbers && <span className="ml-1 text-xs text-gray-500">tooth {line.toothNumbers}</span>}
                    </td>
                    <td className="px-3 py-2 text-right">{line.quantity}</td>
                    <td className="px-3 py-2 text-right">{Number.isFinite(line.amount) ? formatNad(line.amount) : '-'}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          list={datalistId}
                          value={draft?.primary ?? ''}
                          disabled={!editable}
                          placeholder="e.g. J06.9"
                          aria-label={`ICD-10 code for line ${line.transactionNumber}`}
                          onChange={event => setDraft(line.key, { primary: event.target.value.toUpperCase(), secondary: draft?.secondary ?? [] })}
                          onBlur={() => draft && setDraft(line.key, { primary: normalizeIcd10(draft.primary), secondary: draft.secondary })}
                          className="w-24 rounded border border-gray-300 px-2 py-1 font-mono text-xs disabled:bg-gray-100"
                        />
                        {draft && draft.secondary.length > 0 && (
                          <span className="text-xs text-gray-500" title={draft.secondary.join(', ')}>+{draft.secondary.length}</span>
                        )}
                        {editable && (
                          <button
                            type="button"
                            onClick={() => setExpandedKey(expandedKey === line.key ? null : line.key)}
                            className="text-xs text-cyan-700 hover:underline"
                          >
                            {expandedKey === line.key ? 'Close' : 'More'}
                          </button>
                        )}
                      </div>
                      {draft?.source === 'visit-notes' && !draft.confirmed && editable && (
                        <button type="button" onClick={() => confirmDraft(line.key)} className="mt-1 text-xs font-medium text-amber-700 hover:underline">
                          From visit notes - confirm
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
                    <tr className={errorCount > 0 ? 'bg-red-50/40' : ''}>
                      <td />
                      <td colSpan={7} className="px-3 pb-2">
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
                  {expandedKey === line.key && editable && draft && (
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
          note={validation.canSubmit ? undefined : `Draft: ${validation.errorCount} error(s) must be fixed before this file can be submitted.`}
          onClose={() => setShowPreview(false)}
        />
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
    </div>
  );
};

export default BatchReview;
