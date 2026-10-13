import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  AUTOMATION_PLACEHOLDERS,
  AUTOMATION_REPLY_INVITES,
  SAMPLE_AUTOMATION_VALUES,
  checkAutomationMessages,
  htmlToPlainText,
  looksLikeHtml,
  renderAutomationText,
  type AutomationMessages,
  type AutomationSetting
} from '../../../../supabase/functions/process-automation-queue/automationRules.ts';
import { withReplyInvite } from '../../../../supabase/functions/_shared/smsMessagePolicy.ts';
import { INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../../patientLists/listStyles';

export interface AutomationMessageSheetProps {
  name: string;
  setting: AutomationSetting;
  /** Staff who are not practice administrators see the message but cannot change it */
  readOnly: boolean;
  /** The practice's SMS replies are collected: only then does the SMS end with its reply line */
  repliesLive: boolean;
  saving: boolean;
  onClose: () => void;
  onSave: (messages: AutomationMessages) => void;
}

/** SMS parts as the gateway bills them: 160 characters for one, 153 per part after that. */
const smsParts = (length: number): number => (length <= 160 ? 1 : Math.ceil(length / 153));

const CHECKBOX = 'h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500';

/**
 * The message of one automation: SMS, email or both, with buttons for the details OneHealth fills in and a preview
 * with invented example values. Saving keeps the automation on or off as it is (the switch is on the card).
 */
export const AutomationMessageSheet: React.FC<AutomationMessageSheetProps> = ({ name, setting, readOnly, repliesLive, saving, onClose, onSave }) => {
  const titleId = useId();
  const emailWasHtml = looksLikeHtml(setting.emailBody);
  const [form, setForm] = useState<AutomationMessages>(() => ({
    smsEnabled: setting.smsEnabled,
    emailEnabled: setting.emailEnabled,
    smsTemplate: setting.smsTemplate,
    emailSubject: setting.emailSubject,
    emailBody: emailWasHtml ? htmlToPlainText(setting.emailBody) : setting.emailBody
  }));
  const [errors, setErrors] = useState<string[]>([]);
  const panelRef = useRef<HTMLDivElement>(null);
  const smsRef = useRef<HTMLTextAreaElement>(null);
  const emailRef = useRef<HTMLTextAreaElement>(null);
  const placeholders = AUTOMATION_PLACEHOLDERS[setting.automationId];

  // Keyboard users land in the sheet, and Escape closes it
  useEffect(() => {
    panelRef.current?.focus();
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const change = (patch: Partial<AutomationMessages>) => {
    setForm((current) => ({ ...current, ...patch }));
    setErrors([]);
  };

  /** Puts {{name}} where the cursor is in the SMS or the email */
  const insert = (target: 'sms' | 'email', placeholder: string) => {
    const field = target === 'sms' ? smsRef.current : emailRef.current;
    const current = target === 'sms' ? form.smsTemplate : form.emailBody;
    const token = `{{${placeholder}}}`;
    const start = field?.selectionStart ?? current.length;
    const end = field?.selectionEnd ?? current.length;
    const next = `${current.slice(0, start)}${token}${current.slice(end)}`;
    change(target === 'sms' ? { smsTemplate: next } : { emailBody: next });
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    const checked = checkAutomationMessages(setting.automationId, form, repliesLive);
    if (!checked.ok) {
      setErrors(checked.errors);
      return;
    }
    onSave(checked.messages);
  };

  const preview = (template: string) => renderAutomationText(template, SAMPLE_AUTOMATION_VALUES);
  const replyInvite = AUTOMATION_REPLY_INVITES[setting.automationId];
  const smsPreview = preview(withReplyInvite(form.smsTemplate, replyInvite, repliesLive));

  const placeholderButtons = (target: 'sms' | 'email') => (
    <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Insert a detail OneHealth fills in">
      {placeholders.map((placeholder) => (
        <button
          key={placeholder.name}
          type="button"
          onClick={() => insert(target, placeholder.name)}
          className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
        >
          + {placeholder.label}
        </button>
      ))}
    </div>
  );

  const header = (
    <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">{name}: the message</h2>
        <p className="mt-0.5 text-sm text-gray-500">The preview uses invented example details.</p>
      </div>
      <button type="button" onClick={onClose} disabled={saving} className={QUIET_BUTTON} aria-label="Close">
        <Icon icon="solar:close-circle-bold-duotone" className="h-6 w-6" aria-hidden="true" />
      </button>
    </div>
  );

  const smsSection = form.smsEnabled && (
    <div>
      <label htmlFor={`${titleId}-sms`} className={LABEL}>SMS</label>
      <textarea
        id={`${titleId}-sms`}
        ref={smsRef}
        rows={4}
        value={form.smsTemplate}
        onChange={(event) => change({ smsTemplate: event.target.value })}
        className={`${INPUT} resize-y`}
      />
      {!readOnly && placeholderButtons('sms')}
      <div className="mt-3 rounded-xl bg-purple-50 px-3 py-2 text-sm text-gray-800">
        <p className="whitespace-pre-wrap break-words">{smsPreview || 'The SMS will show here.'}</p>
        <p className="mt-1 text-xs text-gray-500">
          {smsPreview.length} characters, about {smsParts(smsPreview.length)} SMS per patient
        </p>
      </div>
      <p className="mt-2 text-xs text-gray-500">
        {repliesLive
          ? `OneHealth adds "${replyInvite}" because your patients' SMS replies are collected.`
          : "Patients' SMS replies are not collected yet, so the SMS does not ask them to reply. OneHealth support switches replies on."}
      </p>
    </div>
  );

  const emailSection = form.emailEnabled && (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${titleId}-subject`} className={LABEL}>Email subject</label>
        <input
          id={`${titleId}-subject`}
          type="text"
          value={form.emailSubject}
          onChange={(event) => change({ emailSubject: event.target.value })}
          className={INPUT}
        />
      </div>
      <div>
        <label htmlFor={`${titleId}-email`} className={LABEL}>Email</label>
        {emailWasHtml && !readOnly && (
          <p className="mb-2 text-xs text-gray-500">This email was saved as a web page earlier. It shows here as text and is saved as text.</p>
        )}
        <textarea
          id={`${titleId}-email`}
          ref={emailRef}
          rows={8}
          value={form.emailBody}
          onChange={(event) => change({ emailBody: event.target.value })}
          className={`${INPUT} resize-y`}
        />
        {!readOnly && placeholderButtons('email')}
      </div>
      <div className="rounded-xl bg-blue-50 px-3 py-2 text-sm text-gray-800">
        <p className="font-medium">{preview(form.emailSubject) || 'The subject will show here.'}</p>
        <p className="mt-1 whitespace-pre-wrap break-words">{preview(form.emailBody)}</p>
      </div>
    </div>
  );

  const fields = (
    <fieldset disabled={readOnly || saving} className="min-w-0 space-y-5">
      {readOnly && <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-600">Only a practice administrator can change this message.</p>}
      <div className="flex flex-wrap gap-4">
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" className={CHECKBOX} checked={form.smsEnabled} onChange={(event) => change({ smsEnabled: event.target.checked })} />
          Send an SMS
        </label>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" className={CHECKBOX} checked={form.emailEnabled} onChange={(event) => change({ emailEnabled: event.target.checked })} />
          Send an email
        </label>
      </div>
      {smsSection}
      {emailSection}
      {errors.length > 0 && (
        <ul className="space-y-1 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {errors.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </fieldset>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl focus:outline-none sm:max-w-2xl sm:rounded-2xl"
      >
        {header}
        <form onSubmit={save} noValidate className="flex min-h-0 flex-1 flex-col">
          {/* The scrolling box is a div: a fieldset does not shrink in a flex column, so it would run under the buttons */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{fields}</div>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-white px-4 py-3 sm:flex-row sm:justify-end sm:px-6">
            <button type="button" onClick={onClose} disabled={saving} className={SECONDARY_BUTTON}>
              {readOnly ? 'Close' : 'Cancel'}
            </button>
            {!readOnly && (
              <button type="submit" disabled={saving} className={PRIMARY_BUTTON}>
                <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5" aria-hidden="true" />
                {saving ? 'Saving...' : 'Save the message'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

export default AutomationMessageSheet;
