import React, { useEffect, useMemo, useRef, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { getSmsLength } from '../messages/messageText';
import { patientListService, type PatientListRecord } from '../../services/patientListService';
import {
  MAX_TEMPLATE_LENGTH,
  validateAutomation,
  type ListAutomationSettings,
  type RepeatGuard,
  type SendSchedule
} from '../../utils/patientLists/listAutomation';
import {
  LIST_TEMPLATE_VARIABLES,
  buildMessageValues,
  describeMissingVariable,
  findUnknownVariables,
  renderListMessage,
  type MessageValues,
  type PracticeDetails
} from '../../utils/patientLists/listMessages';
import type { ListMember } from '../../utils/patientLists/listRules';
import { SendNowSheet } from './SendNowSheet';
import { SCHEDULER_NOT_RUNNING_NOTICE } from '../../utils/automations/processorHealth';
import { REPEAT_LABELS, automaticSendLine, automaticSendState, lastRunText, scheduleSummary } from './listDisplay';
import { CARD, INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from './listStyles';

interface ListMessagePanelProps {
  list: PatientListRecord;
  members: readonly ListMember[];
  practice: PracticeDetails;
  todayKey: string;
  onSaved: (list: PatientListRecord) => void;
  /** After a send: reload who was messaged */
  onSent: () => void;
}

const SCHEDULE_OPTIONS: Array<{ value: SendSchedule; title: string; hint: string; icon: string }> = [
  { value: 'manual', title: 'Only when I press Send now', hint: 'Nothing goes out by itself', icon: 'solar:plain-bold-duotone' },
  { value: 'daily', title: 'Every day at a set time', hint: 'New people on the list get it the same day', icon: 'solar:calendar-bold-duotone' },
  {
    value: 'birthday_morning',
    title: "On each patient's birthday",
    hint: 'Greets everyone on their own day',
    icon: 'solar:gift-bold-duotone'
  }
];

const REPEAT_ORDER: RepeatGuard[] = ['ever', 'year', 'month', 'week', 'day'];

const EXAMPLE_VALUES = Object.fromEntries(
  LIST_TEMPLATE_VARIABLES.map((variable) => [variable.key, variable.example])
) as MessageValues;

const sameSettings = (a: ListAutomationSettings, b: ListAutomationSettings): boolean =>
  a.template === b.template &&
  a.schedule === b.schedule &&
  a.sendTime === b.sendTime &&
  a.quietStart === b.quietStart &&
  a.quietEnd === b.quietEnd &&
  a.repeat === b.repeat;

/** The list's SMS: text with variables, live preview for a real member, schedule and Send now. */
export const ListMessagePanel: React.FC<ListMessagePanelProps> = ({ list, members, practice, todayKey, onSaved, onSent }) => {
  const [draft, setDraft] = useState<ListAutomationSettings>(list.automation);
  const [enabled, setEnabled] = useState(list.automationEnabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string>('');
  const [sendOpen, setSendOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Another list was opened, or the saved settings changed: start from what is saved
  useEffect(() => {
    setDraft(list.automation);
    setEnabled(list.automationEnabled);
    setError(null);
  }, [list.id, list.automation, list.automationEnabled]);

  const dirty = !sameSettings(draft, list.automation) || enabled !== list.automationEnabled;
  const length = getSmsLength(draft.template.trim());
  const unicode = length.parts > 0 && (length.capacity === 70 || length.capacity % 67 === 0);
  const unknown = findUnknownVariables(draft.template);

  const previewMember = members.find((member) => member.patientId === previewId) ?? members[0] ?? null;
  const preview = useMemo(() => {
    const values = previewMember ? buildMessageValues(previewMember.facts, practice, todayKey) : EXAMPLE_VALUES;
    return renderListMessage(draft.template, values);
  }, [draft.template, previewMember, practice, todayKey]);

  const update = (changes: Partial<ListAutomationSettings>) => {
    setDraft((previous) => ({ ...previous, ...changes }));
    setError(null);
  };

  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const element = textareaRef.current;
    const start = element?.selectionStart ?? draft.template.length;
    const end = element?.selectionEnd ?? start;
    update({ template: draft.template.slice(0, start) + token + draft.template.slice(end) });
    requestAnimationFrame(() => {
      element?.focus();
      element?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = async (): Promise<PatientListRecord | null> => {
    if (unknown.length > 0) {
      const message = `Fix ${unknown.map((name) => `{{${name}}}`).join(', ')}: use the buttons to add details.`;
      setError(message);
      toast.error(message);
      return null;
    }
    const validation = validateAutomation(draft, enabled);
    if (!validation.ok) {
      setError(validation.error);
      toast.error(validation.error);
      return null;
    }
    setSaving(true);
    try {
      const saved = await patientListService.updateList(list.id, {
        automation: validation.settings,
        automationEnabled: enabled
      });
      onSaved(saved);
      toast.success(enabled ? `Saved. ${automaticSendLine(saved, new Date())}.` : 'Message settings saved.');
      return saved;
    } catch (saveError) {
      const message = saveError instanceof Error ? plainWords(saveError.message) : 'Could not save the message.';
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const openSend = async () => {
    if (!draft.template.trim()) {
      toast.error('Write the message first.');
      return;
    }
    if (dirty && !(await save())) return;
    setSendOpen(true);
  };

  const lastRun = lastRunText(list.lastRunSummary);
  const showsTime = draft.schedule !== 'manual';
  // Switched on is not sending: only a run of the automatic sender is (none runs until support starts the scheduler)
  const notRunning = automaticSendState({ automation: draft, automationEnabled: enabled, lastRunOn: list.lastRunOn }, new Date()) === 'not_running';

  return (
    <div className="space-y-4">
      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="list-message-heading">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 id="list-message-heading" className="text-sm font-semibold text-gray-900">
            Message
          </h3>
          <span className={`text-xs tabular-nums ${length.parts > 2 ? 'text-amber-600' : 'text-gray-500'}`}>
            {length.used} characters · {length.parts === 0 ? 'empty' : `${length.parts} SMS`}
          </span>
        </div>
        <textarea
          ref={textareaRef}
          value={draft.template}
          onChange={(event) => update({ template: event.target.value })}
          rows={4}
          maxLength={MAX_TEMPLATE_LENGTH + 50}
          className={`${INPUT} resize-y leading-relaxed`}
          aria-label="Message text"
          placeholder="Hi {{first_name}}, ..."
        />
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Add a detail to the message">
          {LIST_TEMPLATE_VARIABLES.map((variable) => (
            <button
              key={variable.key}
              type="button"
              onClick={() => insertVariable(variable.key)}
              className="rounded-full border border-purple-100 bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
              title={`Adds {{${variable.key}}}, e.g. "${variable.example}"`}
            >
              + {variable.label}
            </button>
          ))}
        </div>
        {unknown.length > 0 && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-red-600">
            <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {unknown.map((name) => describeMissingVariable(name)).join('; ')}. Use the buttons above to add details.
          </p>
        )}
        {unicode && (
          <p className="mt-2 text-xs text-amber-700">
            The message has an emoji or special character, so each SMS holds 70 characters instead of 160.
          </p>
        )}
      </section>

      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="list-preview-heading">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 id="list-preview-heading" className="text-sm font-semibold text-gray-900">
            Preview
          </h3>
          {members.length > 0 ? (
            <select
              value={previewMember?.patientId ?? ''}
              onChange={(event) => setPreviewId(event.target.value)}
              className={`${INPUT} sm:w-64`}
              aria-label="Preview the message for"
            >
              {members.slice(0, 200).map((member) => (
                <option key={member.patientId} value={member.patientId}>
                  {`${member.facts.firstName} ${member.facts.lastName}`.trim() || 'Unnamed patient'}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-xs text-gray-500">Example details (nobody is on the list yet)</span>
          )}
        </div>
        <div className="rounded-2xl bg-gray-50 p-3 sm:p-4">
          {preview.text ? (
            <p className="max-w-md whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm text-gray-800 shadow-sm ring-1 ring-gray-100">
              {preview.text}
            </p>
          ) : (
            <p className="text-sm text-gray-500">Write a message to see how it reads.</p>
          )}
          {preview.missing.length > 0 && previewMember && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-amber-700">
              <Icon icon="solar:info-circle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {previewMember.facts.firstName || 'This patient'} would be skipped:{' '}
              {preview.missing.map((name) => describeMissingVariable(name)).join(', ')}.
            </p>
          )}
        </div>
      </section>

      <section className={`${CARD} p-4 sm:p-5`} aria-labelledby="list-schedule-heading">
        <h3 id="list-schedule-heading" className="mb-3 text-sm font-semibold text-gray-900">
          When to send
        </h3>
        <div className="grid grid-cols-1 gap-2 md:grid-cols-3" role="radiogroup" aria-labelledby="list-schedule-heading">
          {SCHEDULE_OPTIONS.map((option) => {
            const active = draft.schedule === option.value;
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => {
                  update({ schedule: option.value });
                  if (option.value === 'manual') setEnabled(false);
                }}
                className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                  active ? 'border-purple-300 bg-purple-50/60 ring-1 ring-purple-200' : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <Icon
                  icon={option.icon}
                  className={`mt-0.5 h-5 w-5 shrink-0 ${active ? 'text-purple-600' : 'text-gray-400'}`}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900">{option.title}</span>
                  <span className="block text-xs text-gray-500">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {showsTime && (
            <div>
              <label htmlFor="list-send-time" className={LABEL}>
                Send time (Windhoek)
              </label>
              <input
                id="list-send-time"
                type="time"
                step={900}
                value={draft.sendTime}
                onChange={(event) => update({ sendTime: event.target.value })}
                className={INPUT}
              />
            </div>
          )}
          <div>
            <label htmlFor="list-repeat" className={LABEL}>
              One patient gets this message at most
            </label>
            <select
              id="list-repeat"
              value={draft.repeat}
              onChange={(event) => update({ repeat: event.target.value as RepeatGuard })}
              className={INPUT}
            >
              {REPEAT_ORDER.map((repeat) => (
                <option key={repeat} value={repeat}>
                  {REPEAT_LABELS[repeat]}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="sm:col-span-2">
            <legend className={LABEL}>Quiet hours: never send between</legend>
            <div className="flex items-center gap-2">
              <input
                type="time"
                step={900}
                value={draft.quietStart}
                onChange={(event) => update({ quietStart: event.target.value })}
                className={INPUT}
                aria-label="Quiet hours start"
              />
              <span className="text-sm text-gray-500">and</span>
              <input
                type="time"
                step={900}
                value={draft.quietEnd}
                onChange={(event) => update({ quietEnd: event.target.value })}
                className={INPUT}
                aria-label="Quiet hours end"
              />
            </div>
          </fieldset>
        </div>

        <div className="mt-4 flex items-start justify-between gap-4 rounded-xl bg-gray-50 p-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900">Send automatically</p>
            {notRunning ? (
              <p className="text-xs font-medium text-amber-800">
                {SCHEDULER_NOT_RUNNING_NOTICE}. Nothing goes out by itself until then: use Send now.
              </p>
            ) : (
              <p className="text-xs text-gray-500">
                {draft.schedule === 'manual'
                  ? 'Choose a daily time or birthdays above to send automatically.'
                  : enabled
                    ? `${scheduleSummary(draft, true)}, outside quiet hours.`
                    : 'Off: nothing is sent until you switch this on.'}
              </p>
            )}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label="Send automatically"
            disabled={draft.schedule === 'manual'}
            onClick={() => {
              setEnabled(!enabled);
              setError(null);
            }}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 ${
              enabled ? 'bg-gradient-to-r from-purple-500 to-indigo-600' : 'bg-gray-300'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-5' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
        {lastRun && <p className="mt-2 text-xs text-gray-500">{lastRun}</p>}
      </section>

      {error && (
        <p className="flex items-start gap-1.5 rounded-xl bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100" role="alert">
          <Icon icon="solar:danger-triangle-bold-duotone" className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={() => void openSend()} disabled={saving} className={SECONDARY_BUTTON}>
          <Icon icon="solar:plain-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          {dirty ? 'Save and send now…' : 'Send now…'}
        </button>
        <button type="button" onClick={() => void save()} disabled={!dirty || saving} className={PRIMARY_BUTTON}>
          {saving ? (
            <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
          )}
          {dirty ? 'Save' : 'Saved'}
        </button>
      </div>

      {sendOpen && (
        <SendNowSheet
          open={sendOpen}
          onClose={() => setSendOpen(false)}
          list={list}
          members={members}
          practice={practice}
          onSent={onSent}
        />
      )}
    </div>
  );
};

export default ListMessagePanel;
