import React, { useEffect, useMemo, useState } from 'react';
import { plainWords } from '../../../utils/plainErrors';
import { Link } from 'react-router-dom';
import { formatNad, fromCents } from '../../../utils/billing/money';
import { formatServiceDate } from '../../../utils/billing/dates';
import { centsToInput } from '../../../services/ledgerService';
import { claimBatchLink } from '../../billing/invoiceLinks';
import { checkCreditNote, leftToCredit, type CreditableLine } from './creditNoteLines';
import { loadCreditableLines, postCreditNoteLines, type SavedCreditNote } from './creditNoteService';
import { AmountInput, ErrorBox, Field, PrimaryButton, SecondaryButton, Sheet, SummaryRow, inputClass } from './ArUi';

export interface CreditNoteLinesDialogProps {
  practiceId: string;
  invoice: { id: string; invoiceNumber: string; patientName?: string | null };
  onClose: () => void;
  /** Credit an amount on a portion instead (the credit note before lines; also while lines are not set up) */
  onUseAmount: () => void;
  onSaved: (notes: SavedCreditNote[], reversals: number) => void;
}

const nad = (cents: number) => formatNad(fromCents(cents));

/**
 * A credit note on chosen invoice lines with one reason (parity D24): tick the lines, keep or lower each amount, say
 * why, check and save. A line the medical aid was sent goes back to the fund as a reversal in its next credit file
 * (parity F16); a line still waiting in an unsent batch is corrected there instead. The database checks every limit
 * again (credit_note_post_lines).
 */
export const CreditNoteLinesDialog: React.FC<CreditNoteLinesDialogProps> = ({ practiceId, invoice, onClose, onUseAmount, onSaved }) => {
  const [lines, setLines] = useState<CreditableLine[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [amounts, setAmounts] = useState<Map<string, string>>(new Map());
  const [reason, setReason] = useState('');
  const [step, setStep] = useState<'edit' | 'confirm'>('edit');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadCreditableLines(invoice.id)
      .then(result => {
        if (cancelled) return;
        // Before credit notes per line are set up, the credit note on an amount is the one there is
        if (result.state === 'not_set_up') onUseAmount();
        else setLines(result.lines);
      })
      .catch(error => {
        if (!cancelled) setLoadError(error instanceof Error ? plainWords(error.message) : 'The invoice lines could not be loaded');
      });
    return () => {
      cancelled = true;
    };
    // onUseAmount is a parent callback; reloading on its identity would reload the lines on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id]);

  const result = useMemo(() => checkCreditNote(lines ?? [], { amounts, reason }), [lines, amounts, reason]);
  const fundWillBeTold = result.reversals > 0;

  const toggle = (line: CreditableLine) =>
    setAmounts(previous => {
      const next = new Map(previous);
      if (next.has(line.id)) next.delete(line.id);
      else next.set(line.id, centsToInput(leftToCredit(line)));
      return next;
    });

  const save = async () => {
    if (!result.ok || !confirmed) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await postCreditNoteLines({ practiceId, invoiceId: invoice.id, reason, lines: result.lines });
      onSaved(saved.creditNotes, saved.reversals);
    } catch (error) {
      setSaveError(error instanceof Error ? plainWords(error.message) : 'The credit note could not be saved');
      setStep('edit');
      setConfirmed(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open
      onClose={onClose}
      busy={saving}
      title={`Credit note: invoice ${invoice.invoiceNumber}`}
      subtitle={invoice.patientName ?? undefined}
      icon="solar:document-add-bold-duotone"
      tone="violet"
      size="lg"
      footer={step === 'edit' ? (
        <>
          <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
          <PrimaryButton icon="solar:arrow-right-bold-duotone" disabled={!result.ok} onClick={() => setStep('confirm')}>Review</PrimaryButton>
        </>
      ) : (
        <>
          <SecondaryButton onClick={() => { setStep('edit'); setConfirmed(false); }} disabled={saving}>Back</SecondaryButton>
          <PrimaryButton icon="solar:document-add-bold-duotone" busy={saving} disabled={!confirmed || !result.ok} onClick={() => void save()}>
            {saving ? 'Saving...' : 'Issue credit note'}
          </PrimaryButton>
        </>
      )}
    >
      {step === 'edit' ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Tick the lines to credit and keep or lower each amount. The invoice itself is not changed. A line the medical aid was
            already sent is reversed with the fund in its next credit file.
          </p>
          {loadError && <ErrorBox>{loadError}</ErrorBox>}
          {lines === null && !loadError && <div className="h-24 animate-pulse rounded-xl bg-gray-100" role="status" aria-label="Loading the invoice lines" />}
          {lines !== null && lines.length === 0 && <p className="text-sm text-gray-500">This invoice has no lines to credit.</p>}
          {lines !== null && lines.length > 0 && (
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
              {lines.map(line => {
                const left = leftToCredit(line);
                const chosen = amounts.has(line.id);
                const lineError = result.lineErrors[line.id];
                const inputId = `credit-${line.id}`;
                return (
                  <li key={line.id} className="space-y-2 px-3 py-2">
                    <div className="flex items-start gap-3">
                      <input
                        id={`${inputId}-pick`}
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-cyan-600"
                        checked={chosen}
                        disabled={left <= 0 || saving}
                        onChange={() => toggle(line)}
                      />
                      <div className="min-w-0 flex-1">
                        <label htmlFor={`${inputId}-pick`} className="block cursor-pointer text-sm font-medium text-gray-900">
                          <span className="font-mono">{line.code}</span> {line.description}
                        </label>
                        <p className="text-xs text-gray-500">
                          {formatServiceDate(line.serviceDate)}
                          {line.tooth ? ` · tooth ${line.tooth}` : ''}
                          {line.quantity > 1 ? ` · ${line.quantity} units` : ''}
                          {` · ${nad(line.totalCents)}`}
                          {line.creditedCents > 0 ? ` · ${nad(line.creditedCents)} credited before` : ''}
                        </p>
                        {line.claimedIn && (
                          <p className="mt-0.5 text-xs text-gray-600">
                            Sent to the medical aid in{' '}
                            <Link to={claimBatchLink(line.claimedIn.batchId)} className="font-medium text-cyan-700 hover:underline">batch {line.claimedIn.batchNumber}</Link>
                          </p>
                        )}
                        {line.waitingIn !== null && <p className="mt-0.5 text-xs text-amber-800">Waiting to be claimed in batch {line.waitingIn} (not sent yet)</p>}
                      </div>
                      <span className="whitespace-nowrap text-sm tabular-nums text-gray-700">{left > 0 ? `${nad(left)} left` : 'Credited'}</span>
                    </div>
                    {chosen && (
                      <div className="ml-7 max-w-xs">
                        <label htmlFor={inputId} className="sr-only">Amount to credit on line {line.code}</label>
                        <AmountInput
                          id={inputId}
                          value={amounts.get(line.id) ?? ''}
                          onChange={event => {
                            const value = event.target.value;
                            setAmounts(previous => new Map(previous).set(line.id, value));
                          }}
                          invalid={!!lineError}
                          disabled={saving}
                        />
                        {lineError && <p className="mt-1 text-xs text-red-600" role="alert">{lineError}</p>}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          <Field label="Reason" htmlFor="credit-reason" hint="Printed on the credit note and kept with it">
            <textarea id="credit-reason" rows={2} className={inputClass} value={reason} onChange={event => setReason(event.target.value)} disabled={saving} />
          </Field>
          {amounts.size > 0 && result.errors.length > 0 && <ErrorBox>{result.errors.join(' ')}</ErrorBox>}
          {saveError && <ErrorBox>{saveError}</ErrorBox>}
          <button type="button" onClick={onUseAmount} className="text-xs font-medium text-cyan-700 hover:underline" disabled={saving}>
            Credit an amount instead (not tied to lines)
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-1 rounded-xl border border-gray-200 bg-gray-50 p-3">
            <SummaryRow strong label="Credit" value={nad(result.medicalAidCents + result.patientCents)} />
            {result.medicalAidCents > 0 && <SummaryRow label="Off what the medical aid owes" value={nad(result.medicalAidCents)} />}
            {result.patientCents > 0 && <SummaryRow label="Off what the patient owes" value={nad(result.patientCents)} />}
          </div>
          {fundWillBeTold && (
            <p className="text-sm text-gray-700">
              {result.reversals === 1 ? 'One line was' : `${result.reversals} lines were`} already sent to the medical aid: a reversal waits in
              Claims for the fund&apos;s next credit file.
            </p>
          )}
          <p className="text-sm text-gray-600"><span className="font-medium text-gray-700">Reason: </span>{reason.trim()}</p>
          <p className="text-xs text-gray-500">
            {result.medicalAidCents > 0 && result.patientCents > 0
              ? 'Two credit notes are made, one for each portion. '
              : ''}
            It is recorded with your name and the time, and can be reversed later with a reason. A line credited in full returns its stock.
          </p>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input type="checkbox" className="mt-0.5 h-4 w-4 rounded border-gray-300 text-cyan-600" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} disabled={saving} />
            I have checked the lines, the amounts and the reason.
          </label>
        </div>
      )}
    </Sheet>
  );
};
