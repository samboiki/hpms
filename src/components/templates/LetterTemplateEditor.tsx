import React, { useId, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { buildMergedLetter, buildSickNote, type LetterContext } from '../../utils/clinical/letters';
import { buildConsentDocument } from '../../utils/clinical/consent';
import { blankMissingFields, fieldsIn, mergeTemplate, sampleMergeValues, type MergeValues } from '../../utils/templates/mergeFields';
import { LETTER_KINDS, checkLetterTemplate, letterKindInfo, type LetterTemplate, type LetterTemplateDraft } from '../../utils/templates/letterTemplates';
import { mergeLetterParts } from '../../utils/templates/listLetters';
import { archiveLetterTemplate, saveLetterTemplate } from '../../services/letterTemplatesService';
import type { PracticeLetterhead } from '../quotes/quotePdf';
import { LetterPreview } from '../letters/LetterPreview';
import { MergeFieldChips } from './MergeFieldChips';
import { DANGER, INPUT, LABEL, PRIMARY, SECONDARY, insertAt } from './templatesUi';

type Part = 'title' | 'recipient' | 'subject' | 'greeting' | 'body';

interface LetterTemplateEditorProps {
  practiceId: string;
  /** The template being changed; null for a new one */
  template: LetterTemplate | null;
  initial: LetterTemplateDraft;
  letterhead: PracticeLetterhead | null;
  /** The signed-in user's name, as the preview's signature */
  signedBy: string | null;
  todayKey: string;
  canChange: boolean;
  onSaved: () => void;
  onClose: () => void;
}

/** The preview's invented patient and visit, on the practice's own letterhead */
function previewContext(letterhead: PracticeLetterhead | null, signedBy: string | null, todayKey: string): LetterContext {
  return {
    practice: {
      name: letterhead?.name ?? 'Example Family Practice',
      address: letterhead?.address ?? '1 Example Street',
      city: letterhead?.city ?? 'Windhoek',
      country: letterhead?.country ?? 'Namibia',
      postalCode: letterhead?.postalCode ?? null,
      contactPhone: letterhead?.contactPhone ?? '061 123 456',
      contactEmail: letterhead?.contactEmail ?? null,
      practiceNumber: letterhead?.practiceNumber ?? null,
      primaryColor: letterhead?.primaryColor ?? null
    },
    author: { name: signedBy ?? 'Dr A Nangolo', title: null, hpcnaNumber: null },
    patient: { name: 'Maria Shikongo', dateOfBirth: '1985-05-14', idNumber: '85051400123' },
    letterDate: todayKey,
    visitDate: todayKey
  };
}

/** Write or change a letter template: its parts with merge fields, checked as it is typed, and a live preview. */
export const LetterTemplateEditor: React.FC<LetterTemplateEditorProps> = ({
  practiceId,
  template,
  initial,
  letterhead,
  signedBy,
  todayKey,
  canChange,
  onSaved,
  onClose
}) => {
  const id = useId();
  const [draft, setDraft] = useState<LetterTemplateDraft>(initial);
  const [focused, setFocused] = useState<Part>('body');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [tried, setTried] = useState(false);
  const refs = useRef<Partial<Record<Part, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const problems = checkLetterTemplate(draft);
  const kind = letterKindInfo(draft.kind);

  const update = (part: keyof LetterTemplateDraft, value: string) => setDraft(current => ({ ...current, [part]: value }) as LetterTemplateDraft);

  const insert = (token: string) => {
    const element = refs.current[focused];
    const current = draft[focused];
    const start = element?.selectionStart ?? current.length;
    const { text, caret } = insertAt(current, start, element?.selectionEnd ?? start, token);
    update(focused, text);
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(caret, caret);
    });
  };

  const preview = useMemo(() => {
    const ctx = previewContext(letterhead, signedBy, todayKey);
    const values: MergeValues = sampleMergeValues({
      practiceName: ctx.practice.name,
      practicePhone: ctx.practice.contactPhone,
      practiceEmail: ctx.practice.contactEmail,
      practitionerName: ctx.author.name
    });
    if (draft.kind === 'sick_note') {
      const fill = (text: string) => blankMissingFields(mergeTemplate(text, values).text).trim();
      return buildSickNote(
        { formNumber: '0042', fromDate: todayKey, toDate: todayKey, diagnosis: null, diagnosisCode: null },
        ctx,
        { title: fill(draft.title), subject: fill(draft.subject), greeting: fill(draft.greeting), body: fill(draft.body), showsDiagnosis: fieldsIn(draft.body).includes('diagnosis') }
      );
    }
    const { parts } = mergeLetterParts(draft, values);
    // A consent form shows where the patient signs, as it prints before signing (src/utils/clinical/consent.ts)
    if (draft.kind === 'consent') return buildConsentDocument({ name: draft.name || kind.label, parts }, ctx, null);
    return buildMergedLetter({ kind: draft.kind === 'referral' ? 'referral' : 'letter', name: draft.name || kind.label, ...parts }, ctx);
  }, [draft, letterhead, signedBy, todayKey, kind.label]);

  const save = async () => {
    setTried(true);
    if (problems.length > 0 || !canChange) return;
    setBusy('save');
    try {
      await saveLetterTemplate(practiceId, draft, template?.id ?? null);
      toast.success(`"${draft.name.trim()}" saved.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save the template.', { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    if (!template) return;
    if (!window.confirm(`Remove the letter template "${template.name}"? Letters already made from it stay on the patient files.`)) return;
    setBusy('remove');
    try {
      await archiveLetterTemplate(template.id);
      toast.success(`"${template.name}" removed.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the template.', { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  const field = (part: Part) => ({
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => {
      refs.current[part] = element;
    },
    value: draft[part],
    onFocus: () => setFocused(part),
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => update(part, event.target.value),
    disabled: !canChange
  });

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
      <div className="space-y-4">
        {!canChange && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Only a practice administrator can change letter templates. You can read this one.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-kind`} className={LABEL}>
              Kind of letter
            </label>
            <select id={`${id}-kind`} className={INPUT} value={draft.kind} disabled={!canChange} onChange={event => update('kind', event.target.value)}>
              {LETTER_KINDS.map(option => (
                <option key={option.kind} value={option.kind}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-600">{kind.hint}</p>
          </div>
          <div>
            <label htmlFor={`${id}-name`} className={LABEL}>
              Template name
            </label>
            <input id={`${id}-name`} className={INPUT} maxLength={80} placeholder="e.g. Fit to return to work" value={draft.name} disabled={!canChange} onChange={event => update('name', event.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-title`} className={LABEL}>
              Title on the letterhead
            </label>
            <input id={`${id}-title`} className={INPUT} maxLength={60} {...field('title')} />
          </div>
          <div>
            <label htmlFor={`${id}-greeting`} className={LABEL}>
              Greeting <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input id={`${id}-greeting`} className={INPUT} maxLength={120} placeholder="To whom it may concern" {...field('greeting')} />
          </div>
          <div>
            <label htmlFor={`${id}-recipient`} className={LABEL}>
              To <span className="font-normal text-gray-500">(optional, one line each)</span>
            </label>
            <textarea id={`${id}-recipient`} className={`${INPUT} min-h-[4.5rem]`} maxLength={300} {...field('recipient')} />
          </div>
          <div>
            <label htmlFor={`${id}-subject`} className={LABEL}>
              Subject line <span className="font-normal text-gray-500">(optional)</span>
            </label>
            <input id={`${id}-subject`} className={INPUT} maxLength={200} placeholder="Re: {{patientName}}" {...field('subject')} />
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-body`} className={LABEL}>
            The letter
          </label>
          <textarea id={`${id}-body`} className={`${INPUT} min-h-[12rem]`} maxLength={8000} {...field('body')} />
          <p className="mt-1 text-xs text-gray-600">
            Leave a blank line between paragraphs. The letterhead, date and signature are added for you.
            {draft.kind === 'sick_note' && ' A diagnosis written on the sick note is added below the text, unless the text itself uses Diagnosis.'}
            {draft.kind === 'consent' && ' The patient signs on the screen below the text; who signed, the date and time and the witness are added for you.'}
          </p>
        </div>

        {tried && problems.length > 0 && (
          <ul className="list-disc space-y-1 rounded-lg bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800" role="alert">
            {problems.map(problem => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        )}

        <div className="flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          {template && canChange ? (
            <button type="button" className={DANGER} disabled={busy !== null} onClick={() => void remove()}>
              <Icon icon="solar:trash-bin-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              {busy === 'remove' ? 'Removing...' : 'Remove template'}
            </button>
          ) : (
            <span />
          )}
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <button type="button" className={SECONDARY} disabled={busy !== null} onClick={onClose}>
              {canChange ? 'Cancel' : 'Back'}
            </button>
            {canChange && (
              <button type="button" className={PRIMARY} disabled={busy !== null} onClick={() => void save()}>
                <Icon icon="solar:diskette-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                {busy === 'save' ? 'Saving...' : 'Save template'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {canChange && <MergeFieldChips use="letter" onInsert={insert} />}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-800">Preview</p>
          <LetterPreview document={preview} note="Filled in with an invented patient, as an example." />
        </div>
      </div>
    </div>
  );
};

export default LetterTemplateEditor;
