import React, { useCallback, useEffect, useId, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { isStaffAdmin } from '../settings/UserManagement/staffUtils';
import { AUTOMATION_CARDS } from '../../utils/automations/automationCatalog';
import { loadAutomations, type AutomationSettings } from '../../services/automations/automationSettingsService';
import { LetterTemplatesNotSetUpError, loadLetterTemplates } from '../../services/letterTemplatesService';
import { loadMessageTemplates } from '../../services/messageTemplatesService';
import { loadLetterhead } from '../quotes/quoteService';
import type { PracticeLetterhead } from '../quotes/quotePdf';
import {
  LETTER_KINDS,
  LETTER_TEMPLATE_EXAMPLES,
  blankLetterTemplate,
  letterKindInfo,
  type LetterTemplate,
  type LetterTemplateDraft
} from '../../utils/templates/letterTemplates';
import {
  CHANNEL_LABELS,
  MESSAGE_TEMPLATE_EXAMPLES,
  canChangeMessageTemplates,
  categoryLabel,
  type MessageTemplate,
  type MessageTemplateDraft
} from '../../utils/templates/messageTemplates';
import { LetterTemplateEditor } from './LetterTemplateEditor';
import { MessageTemplateEditor } from './MessageTemplateEditor';
import { CARD, FILTER, FILTER_OFF, FILTER_ON, PRIMARY, SECONDARY } from './templatesUi';

type Section = 'letters' | 'sms' | 'email';

type Editing =
  | { kind: 'letter'; template: LetterTemplate | null; initial: LetterTemplateDraft }
  | { kind: 'message'; template: MessageTemplate | null; initial: MessageTemplateDraft };

type Load<T> = { status: 'loading' } | { status: 'ready'; items: T } | { status: 'not_set_up' } | { status: 'error'; message: string };

interface TemplatesPanelProps {
  practiceId: string | null | undefined;
  /** Opens Messages > Automations, where the automatic messages are written */
  onOpenAutomations: () => void;
}

const firstLine = (text: string): string => text.replace(/\s+/g, ' ').trim().slice(0, 140);

const SECTIONS: ReadonlyArray<{ id: Section; label: string; icon: string }> = [
  { id: 'letters', label: 'Letters', icon: 'solar:document-text-bold-duotone' },
  { id: 'sms', label: 'SMS', icon: 'solar:chat-round-line-bold-duotone' },
  { id: 'email', label: 'Email', icon: 'solar:letter-bold-duotone' }
];

/** The messages the practice's automations send: written in Messages > Automations, marked here as in use. */
const SENDING_AUTOMATIONS = AUTOMATION_CARDS.filter(card => card.kind === 'sends');
const DIARY_REMINDERS = AUTOMATION_CARDS.find(card => card.id === 'appointment-reminder');

/**
 * Messages > Templates: one place for the practice's letter, SMS and email templates, each with the same merge fields
 * and a live preview. Letters are made from a visit, the patient file or a patient list; SMS and email templates are
 * offered when a message is sent from the patient file. The automatic messages are listed too, marked as used by
 * automations (they are written in Automations).
 */
export const TemplatesPanel: React.FC<TemplatesPanelProps> = ({ practiceId, onOpenAutomations }) => {
  const titleId = useId();
  const user = useAuthStore(state => state.user);
  const [section, setSection] = useState<Section>('letters');
  const [letters, setLetters] = useState<Load<LetterTemplate[]>>({ status: 'loading' });
  const [messages, setMessages] = useState<Load<MessageTemplate[]>>({ status: 'loading' });
  const [automations, setAutomations] = useState<AutomationSettings | null>(null);
  const [letterhead, setLetterhead] = useState<PracticeLetterhead | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const [todayKey] = useState(() => windhoekClock(new Date()).dateKey);
  const canChangeLetters = isStaffAdmin(user);
  const canChangeMessages = canChangeMessageTemplates(user);

  const load = useCallback(async () => {
    if (!practiceId) return;
    setLetters({ status: 'loading' });
    setMessages({ status: 'loading' });
    const [letterResult, messageResult, automationResult, letterheadResult] = await Promise.allSettled([
      loadLetterTemplates(practiceId),
      loadMessageTemplates(practiceId),
      loadAutomations(practiceId),
      loadLetterhead(practiceId)
    ]);
    if (letterResult.status === 'fulfilled') setLetters({ status: 'ready', items: letterResult.value });
    else if (letterResult.reason instanceof LetterTemplatesNotSetUpError) setLetters({ status: 'not_set_up' });
    else setLetters({ status: 'error', message: letterResult.reason instanceof Error ? letterResult.reason.message : 'Could not load the letter templates.' });
    if (messageResult.status === 'fulfilled') setMessages({ status: 'ready', items: messageResult.value });
    else setMessages({ status: 'error', message: messageResult.reason instanceof Error ? messageResult.reason.message : 'Could not load the templates.' });
    setAutomations(automationResult.status === 'fulfilled' && automationResult.value.state !== 'error' ? automationResult.value.settings : null);
    setLetterhead(letterheadResult.status === 'fulfilled' ? letterheadResult.value : null);
  }, [practiceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const practiceValues = {
    practiceName: letterhead?.name ?? null,
    practicePhone: letterhead?.contactPhone ?? null,
    practiceEmail: letterhead?.contactEmail ?? null
  };

  const messageItems = messages.status === 'ready' ? messages.items : [];
  const inSection = (template: MessageTemplate) => (section === 'sms' ? template.channel !== 'email' : template.channel !== 'sms');
  const count = (id: Section): number | null =>
    id === 'letters' ? (letters.status === 'ready' ? letters.items.length : null) : messages.status === 'ready' ? messageItems.filter(template => (id === 'sms' ? template.channel !== 'email' : template.channel !== 'sms')).length : null;

  const newTemplate = () => {
    if (section === 'letters') setEditing({ kind: 'letter', template: null, initial: blankLetterTemplate('certificate') });
    else setEditing({ kind: 'message', template: null, initial: { name: '', channel: section, category: 'custom', subject: '', body: '' } });
  };

  const closeEditor = () => setEditing(null);
  const saved = () => {
    setEditing(null);
    void load();
  };

  const canAdd = section === 'letters' ? canChangeLetters && letters.status === 'ready' : canChangeMessages && messages.status === 'ready';

  return (
    <section aria-labelledby={titleId} className={CARD}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Icon icon="solar:document-add-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              Templates
            </h2>
            <p className="text-sm text-gray-600">
              Letters, SMS and email with fields filled in for each patient: names, dates, the practitioner and the practice.
            </p>
          </div>
        </div>
        {!editing && canAdd && (
          <button type="button" className={PRIMARY} onClick={newTemplate}>
            <Icon icon="solar:add-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            New template
          </button>
        )}
      </header>

      {editing ? (
        <div>
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
            <button type="button" className={SECONDARY} onClick={closeEditor}>
              <Icon icon="solar:arrow-left-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              All templates
            </button>
            <h3 className="min-w-0 truncate text-base font-semibold text-gray-900">
              {editing.template ? editing.template.name : editing.kind === 'letter' ? 'New letter template' : `New ${CHANNEL_LABELS[editing.initial.channel]} template`}
            </h3>
          </div>
          {!editing.template && (
            <div className="flex flex-wrap items-center gap-1.5 border-b border-gray-100 px-4 py-3 text-sm sm:px-5">
              <span className="mr-1 text-gray-600">Start from an example:</span>
              {editing.kind === 'letter'
                ? LETTER_TEMPLATE_EXAMPLES.map(example => (
                    <button
                      key={example.name}
                      type="button"
                      onClick={() => setEditing({ kind: 'letter', template: null, initial: { ...example } })}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      {example.name}
                    </button>
                  ))
                : MESSAGE_TEMPLATE_EXAMPLES.filter(example => example.channel === editing.initial.channel || editing.initial.channel === 'both').map(example => (
                    <button
                      key={example.name}
                      type="button"
                      onClick={() => setEditing({ kind: 'message', template: null, initial: { ...example } })}
                      className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
                    >
                      {example.name}
                    </button>
                  ))}
            </div>
          )}
          {practiceId &&
            (editing.kind === 'letter' ? (
              <LetterTemplateEditor
                key={`${editing.template?.id ?? 'new'}-${editing.initial.name}`}
                practiceId={practiceId}
                template={editing.template}
                initial={editing.initial}
                letterhead={letterhead}
                signedBy={user?.name ?? null}
                todayKey={todayKey}
                canChange={canChangeLetters}
                onSaved={saved}
                onClose={closeEditor}
              />
            ) : (
              <MessageTemplateEditor
                key={`${editing.template?.id ?? 'new'}-${editing.initial.name}`}
                practiceId={practiceId}
                template={editing.template}
                initial={editing.initial}
                practice={practiceValues}
                canChange={canChangeMessages}
                onSaved={saved}
                onClose={closeEditor}
              />
            ))}
        </div>
      ) : (
        <>
          <div role="group" aria-label="Show templates" className="grid grid-cols-3 gap-1 border-b border-gray-100 p-2 sm:p-3">
            {SECTIONS.map(option => {
              const selected = option.id === section;
              const total = count(option.id);
              return (
                <button key={option.id} type="button" aria-pressed={selected} onClick={() => setSection(option.id)} className={cn(FILTER, selected ? FILTER_ON : FILTER_OFF)}>
                  <Icon icon={option.icon} className="h-4 w-4" aria-hidden="true" />
                  {option.label}
                  {total !== null && <span className={cn('rounded-full px-1.5 text-xs font-semibold', selected ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-700')}>{total}</span>}
                </button>
              );
            })}
          </div>

          {!practiceId && <p className="px-4 py-10 text-center text-sm text-gray-600 sm:px-6">Choose a practice to see its templates.</p>}

          {practiceId && section === 'letters' && (
            <LetterList
              load={letters}
              canChange={canChangeLetters}
              onOpen={template => setEditing({ kind: 'letter', template, initial: { ...template } })}
              onStart={example => setEditing({ kind: 'letter', template: null, initial: { ...example } })}
              onRetry={() => void load()}
            />
          )}

          {practiceId && section !== 'letters' && (
            <>
              <MessageList
                load={messages}
                items={messageItems.filter(inSection)}
                channel={section}
                onOpen={template => setEditing({ kind: 'message', template, initial: { ...template } })}
                onRetry={() => void load()}
              />
              <AutomationMarks channel={section} settings={automations} onOpenAutomations={onOpenAutomations} />
            </>
          )}
        </>
      )}
    </section>
  );
};

const Loading: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center justify-center gap-2 px-4 py-10 text-sm text-gray-600">
    <Icon icon="solar:refresh-bold-duotone" className="h-5 w-5 animate-spin text-cyan-600 motion-reduce:animate-none" aria-hidden="true" />
    {label}
  </div>
);

const Failed: React.FC<{ message: string; onRetry: () => void }> = ({ message, onRetry }) => (
  <div className="px-4 py-8 text-center sm:px-6" role="alert">
    <Icon icon="solar:danger-triangle-bold-duotone" className="mx-auto h-10 w-10 text-amber-500" aria-hidden="true" />
    <h3 className="mt-2 font-semibold text-gray-900">Could not load the templates</h3>
    <p className="mt-1 break-words text-sm text-gray-600">{message}</p>
    <button type="button" onClick={onRetry} className={cn(SECONDARY, 'mt-3')}>
      <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
      Try again
    </button>
  </div>
);

const LetterList: React.FC<{
  load: Load<LetterTemplate[]>;
  canChange: boolean;
  onOpen: (template: LetterTemplate) => void;
  onStart: (example: LetterTemplateDraft) => void;
  onRetry: () => void;
}> = ({ load, canChange, onOpen, onStart, onRetry }) => {
  if (load.status === 'loading') return <Loading label="Loading letter templates..." />;
  if (load.status === 'error') return <Failed message={load.message} onRetry={onRetry} />;
  if (load.status === 'not_set_up') {
    return (
      <div className="px-4 py-10 text-center sm:px-6">
        <Icon icon="solar:document-text-bold-duotone" className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
        <h3 className="mt-3 font-semibold text-gray-900">Letter templates are not set up yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
          Letters, referrals and sick notes keep working with their usual wording. OneHealth support switches templates on.
        </p>
      </div>
    );
  }
  if (load.items.length === 0) {
    return (
      <div className="px-4 py-10 text-center sm:px-6">
        <Icon icon="solar:document-text-bold-duotone" className="mx-auto h-12 w-12 text-gray-300" aria-hidden="true" />
        <h3 className="mt-3 font-semibold text-gray-900">No letter templates yet</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
          {canChange
            ? 'Start from an example: change the wording to your practice\'s and save it.'
            : 'A practice administrator adds the practice\'s certificates, referral and recall letters here.'}
        </p>
        {canChange && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {LETTER_TEMPLATE_EXAMPLES.map(example => (
              <button key={example.name} type="button" className={SECONDARY} onClick={() => onStart({ ...example })}>
                <Icon icon={letterKindInfo(example.kind).icon} className="h-4 w-4 text-cyan-600" aria-hidden="true" />
                {example.name}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {LETTER_KINDS.flatMap(info => load.items.filter(template => template.kind === info.kind)).map(template => {
        const info = letterKindInfo(template.kind);
        return (
          <li key={template.id}>
            <button
              type="button"
              onClick={() => onOpen(template)}
              className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 sm:px-5"
            >
              <Icon icon={info.icon} className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{template.name}</span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{info.label}</span>
                  {template.kind === 'sick_note' && (
                    <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">Used for every sick note</span>
                  )}
                </span>
                <span className="mt-0.5 block truncate text-sm text-gray-600">{firstLine(template.body)}</span>
              </span>
              <Icon icon="solar:alt-arrow-right-bold-duotone" className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
            </button>
          </li>
        );
      })}
    </ul>
  );
};

const MessageList: React.FC<{
  load: Load<MessageTemplate[]>;
  items: MessageTemplate[];
  channel: 'sms' | 'email';
  onOpen: (template: MessageTemplate) => void;
  onRetry: () => void;
}> = ({ load, items, channel, onOpen, onRetry }) => {
  if (load.status === 'loading') return <Loading label="Loading templates..." />;
  if (load.status === 'error') return <Failed message={load.message} onRetry={onRetry} />;
  if (items.length === 0) {
    return (
      <div className="px-4 py-8 text-center sm:px-6">
        <Icon icon={channel === 'sms' ? 'solar:chat-round-line-bold-duotone' : 'solar:letter-bold-duotone'} className="mx-auto h-10 w-10 text-gray-300" aria-hidden="true" />
        <h3 className="mt-2 font-semibold text-gray-900">No saved {channel === 'sms' ? 'SMS' : 'email'} templates</h3>
        <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">Saved templates are offered when someone sends a message from a patient file.</p>
      </div>
    );
  }
  return (
    <ul className="divide-y divide-gray-100">
      {items.map(template => (
        <li key={template.id}>
          <button
            type="button"
            onClick={() => onOpen(template)}
            className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500 sm:px-5"
          >
            <Icon icon={template.channel === 'sms' ? 'solar:chat-round-line-bold-duotone' : 'solar:letter-bold-duotone'} className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{template.name}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{categoryLabel(template.category)}</span>
                {template.channel === 'both' && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{CHANNEL_LABELS.both}</span>}
              </span>
              <span className="mt-0.5 block truncate text-sm text-gray-600">{firstLine(channel === 'email' && template.subject ? template.subject : template.body)}</span>
            </span>
            <Icon icon="solar:alt-arrow-right-bold-duotone" className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
};

/** The automatic messages, marked as used by automations: their words are changed in Automations (one place). */
const AutomationMarks: React.FC<{ channel: 'sms' | 'email'; settings: AutomationSettings | null; onOpenAutomations: () => void }> = ({ channel, settings, onOpenAutomations }) => (
  <div className="border-t border-gray-100">
    <p className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-gray-500 sm:px-5">Used by automations</p>
    <ul className="divide-y divide-gray-100">
      {SENDING_AUTOMATIONS.map(card => {
        const setting = settings ? settings[card.id as keyof AutomationSettings] : null;
        const text = setting ? (channel === 'sms' ? setting.smsTemplate : setting.emailSubject) : '';
        // Unknown when the automations could not be read: then no status is shown rather than a wrong one
        const on = setting ? setting.enabled && (channel === 'sms' ? setting.smsEnabled : setting.emailEnabled) : null;
        return (
          <li key={card.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
            <span className="flex min-w-0 flex-1 items-start gap-3">
              <Icon icon={card.icon} className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
              <span className="min-w-0">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">{card.name}</span>
                  <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">Automation</span>
                  {on !== null && (
                    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', on ? 'bg-emerald-50 text-emerald-800' : 'bg-gray-100 text-gray-700')}>
                      {on ? 'Sending' : 'Off'}
                    </span>
                  )}
                </span>
                {text && <span className="mt-0.5 block truncate text-sm text-gray-600">{firstLine(text)}</span>}
              </span>
            </span>
            <button type="button" className={SECONDARY} onClick={onOpenAutomations}>
              <Icon icon="solar:widget-add-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Change in Automations
            </button>
          </li>
        );
      })}
      {channel === 'sms' && DIARY_REMINDERS?.kind === 'elsewhere' && DIARY_REMINDERS.target.kind !== 'lists' && (
        <li className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:px-5">
          <span className="flex min-w-0 flex-1 items-start gap-3">
            <Icon icon={DIARY_REMINDERS.icon} className="mt-0.5 h-5 w-5 shrink-0 text-cyan-600" aria-hidden="true" />
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-gray-900">{DIARY_REMINDERS.name}</span>
                <span className="rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-800">Automation</span>
              </span>
              <span className="mt-0.5 block text-sm text-gray-600">Its text is set with the diary&apos;s reminder settings.</span>
            </span>
          </span>
          <Link to={DIARY_REMINDERS.target.href} className={SECONDARY}>
            <Icon icon="solar:calendar-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            {DIARY_REMINDERS.target.label}
          </Link>
        </li>
      )}
    </ul>
  </div>
);

export default TemplatesPanel;
