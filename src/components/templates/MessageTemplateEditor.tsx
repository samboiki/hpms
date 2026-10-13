import React, { useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { cn } from '../../utils/cn';
import { getSmsLength } from '../messages/messageText';
import { mergeTemplate, sampleMergeValues, type MergeValues } from '../../utils/templates/mergeFields';
import {
  CHANNEL_LABELS,
  MESSAGE_CATEGORIES,
  checkMessageTemplate,
  type MessageChannel,
  type MessageTemplate,
  type MessageTemplateDraft
} from '../../utils/templates/messageTemplates';
import { removeMessageTemplate, saveMessageTemplate } from '../../services/messageTemplatesService';
import { MergeFieldChips } from './MergeFieldChips';
import { DANGER, FILTER, FILTER_OFF, FILTER_ON, INPUT, LABEL, PRIMARY, SECONDARY, insertAt } from './templatesUi';

type Part = 'subject' | 'body';

interface MessageTemplateEditorProps {
  practiceId: string;
  template: MessageTemplate | null;
  initial: MessageTemplateDraft;
  /** The practice's own name and phone in the preview */
  practice: MergeValues;
  canChange: boolean;
  onSaved: () => void;
  onClose: () => void;
}

/** Write or change an SMS or email template the patient file's Message and Email windows offer. */
export const MessageTemplateEditor: React.FC<MessageTemplateEditorProps> = ({ practiceId, template, initial, practice, canChange, onSaved, onClose }) => {
  const id = useId();
  const [draft, setDraft] = useState<MessageTemplateDraft>(initial);
  const [focused, setFocused] = useState<Part>('body');
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);
  const [tried, setTried] = useState(false);
  const refs = useRef<Partial<Record<Part, HTMLInputElement | HTMLTextAreaElement | null>>>({});
  const problems = checkMessageTemplate(draft);
  const isSms = draft.channel !== 'email';
  const isEmail = draft.channel !== 'sms';
  const sample = sampleMergeValues(practice);
  const previewBody = mergeTemplate(draft.body, sample).text;
  const length = getSmsLength(previewBody);

  const update = (part: keyof MessageTemplateDraft, value: string) => setDraft(current => ({ ...current, [part]: value }) as MessageTemplateDraft);

  const insert = (token: string) => {
    const part: Part = isEmail ? focused : 'body';
    const element = refs.current[part];
    const current = draft[part];
    const start = element?.selectionStart ?? current.length;
    const { text, caret } = insertAt(current, start, element?.selectionEnd ?? start, token);
    update(part, text);
    window.requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(caret, caret);
    });
  };

  const save = async () => {
    setTried(true);
    if (problems.length > 0 || !canChange) return;
    setBusy('save');
    try {
      await saveMessageTemplate(practiceId, draft, template?.id ?? null);
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
    if (!window.confirm(`Remove the template "${template.name}"? The Message and Email windows stop offering it.`)) return;
    setBusy('remove');
    try {
      await removeMessageTemplate(practiceId, template.id);
      toast.success(`"${template.name}" removed.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not remove the template.', { duration: 8000 });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="space-y-4">
        {!canChange && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">Your role cannot change SMS and email templates. You can read this one.</p>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${id}-name`} className={LABEL}>
              Template name
            </label>
            <input id={`${id}-name`} className={INPUT} maxLength={80} placeholder="e.g. Results ready" value={draft.name} disabled={!canChange} onChange={event => update('name', event.target.value)} />
          </div>
          <div>
            <label htmlFor={`${id}-category`} className={LABEL}>
              Used for
            </label>
            <select id={`${id}-category`} className={INPUT} value={draft.category} disabled={!canChange} onChange={event => update('category', event.target.value)}>
              {MESSAGE_CATEGORIES.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div role="radiogroup" aria-label="Sent as" className="grid grid-cols-3 gap-1 rounded-lg bg-gray-100 p-1 sm:max-w-sm">
          {(['sms', 'email', 'both'] as MessageChannel[]).map(option => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={draft.channel === option}
              disabled={!canChange}
              onClick={() => update('channel', option)}
              className={cn(FILTER, draft.channel === option ? FILTER_ON : FILTER_OFF)}
            >
              {CHANNEL_LABELS[option]}
            </button>
          ))}
        </div>
        {isEmail && (
          <div>
            <label htmlFor={`${id}-subject`} className={LABEL}>
              Email subject
            </label>
            <input
              id={`${id}-subject`}
              ref={element => {
                refs.current.subject = element;
              }}
              className={INPUT}
              maxLength={150}
              value={draft.subject}
              disabled={!canChange}
              onFocus={() => setFocused('subject')}
              onChange={event => update('subject', event.target.value)}
            />
          </div>
        )}
        <div>
          <label htmlFor={`${id}-body`} className={LABEL}>
            Message
          </label>
          <textarea
            id={`${id}-body`}
            ref={element => {
              refs.current.body = element;
            }}
            className={`${INPUT} min-h-[9rem]`}
            maxLength={5000}
            value={draft.body}
            disabled={!canChange}
            onFocus={() => setFocused('body')}
            onChange={event => update('body', event.target.value)}
          />
          {isSms && (
            <p className={cn('mt-1 text-xs', length.parts > 1 ? 'text-amber-700' : 'text-gray-600')}>
              About {length.used} characters, {length.parts} SMS for each patient (with the example filled in).
            </p>
          )}
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
        {canChange && <MergeFieldChips use="message" onInsert={insert} />}
        <div>
          <p className="mb-2 text-sm font-medium text-gray-800">Preview</p>
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3" aria-label="Preview of the message">
            {isEmail && (
              <p className="text-sm">
                <span className="text-gray-500">Subject: </span>
                <span className="font-medium text-gray-900">{mergeTemplate(draft.subject, sample).text || '(no subject)'}</span>
              </p>
            )}
            <p className={cn('whitespace-pre-wrap break-words text-sm text-gray-900', isSms && !isEmail && 'rounded-xl rounded-tl-sm bg-cyan-50 px-3 py-2')}>
              {previewBody || '(empty)'}
            </p>
            <p className="text-xs text-gray-500">Filled in with an invented patient, as an example.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageTemplateEditor;
