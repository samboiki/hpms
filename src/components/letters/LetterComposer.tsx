import React, { useEffect, useId, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { windhoekClock } from '../../utils/patientLists/listDates';
import {
  URGENCY_LABELS,
  buildGeneralLetter,
  buildMergedLetter,
  buildReferralLetter,
  validateGeneralLetter,
  validateReferral,
  type GeneralLetterInput,
  type LetterDocument,
  type ReferralInput,
  type ReferralUrgency
} from '../../utils/clinical/letters';
import {
  LettersNotSetUpError,
  createLetter,
  loadLetterContext,
  type LetterRecord,
  type LoadedLetterContext,
  type StoredLetterKind
} from '../../services/patientLettersService';
import { loadLetterTemplates } from '../../services/letterTemplatesService';
import { fieldLabel, mergeTemplate, type MergeValues } from '../../utils/templates/mergeFields';
import { isLetterKind, letterKindInfo, type LetterTemplate } from '../../utils/templates/letterTemplates';
import { mergeLetterParts } from '../../utils/templates/listLetters';
import { ClinicalDialog } from '../patients/safety/ClinicalDialog';
import { INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { LetterActions } from './LetterActions';
import { LetterPreview } from './LetterPreview';

/** A referral, another letter, or a letter from one of the practice's templates */
export type ComposerKind = StoredLetterKind | 'template';

interface LetterComposerProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  patientId: string;
  /** The visit it is written from; null from the patient file */
  visitId: string | null;
  initialKind?: ComposerKind;
  /** After a letter is made (kept on the file when the letters table exists) */
  onCreated?: (record: LetterRecord | null) => void;
}

const KIND_OPTIONS: ReadonlyArray<{ kind: ComposerKind; label: string }> = [
  { kind: 'template', label: 'From a template' },
  { kind: 'referral', label: 'Referral letter' },
  { kind: 'letter', label: 'Other letter' }
];

const emptyReferral = (): ReferralInput => ({
  toName: '',
  toPractice: '',
  toSpecialty: '',
  toEmail: '',
  urgency: 'routine',
  reason: '',
  history: '',
  includeDiagnosis: true,
  includeMedicines: true,
  includeAllergies: true,
  includeProblems: true,
  validUntil: ''
});

const emptyLetter = (): GeneralLetterInput => ({ toName: '', toEmail: '', subject: '', body: '' });

interface Made {
  document: LetterDocument;
  record: LetterRecord | null;
  notKept: boolean;
  email: string | null;
  recipientName: string | null;
}

/** Writes a referral letter, another letter or a letter from a template on the practice letterhead, then prints or emails it. */
export const LetterComposer: React.FC<LetterComposerProps> = ({ open, onClose, practiceId, patientId, visitId, initialKind = 'referral', onCreated }) => {
  const { user } = useAuthStore();
  const [kind, setKind] = useState<ComposerKind>(initialKind);
  const [referral, setReferral] = useState<ReferralInput>(emptyReferral);
  const [letter, setLetter] = useState<GeneralLetterInput>(emptyLetter);
  const [loaded, setLoaded] = useState<LoadedLetterContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [made, setMade] = useState<Made | null>(null);
  // A letter from a template: the practice's templates (no sick note: it is made on the visit's Sick note tab), the
  // "To" lines and text with the record's values filled in (staff can change them), and values typed for the rest
  const [templates, setTemplates] = useState<LetterTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [recipientDraft, setRecipientDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [templateEmail, setTemplateEmail] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const letterDate = windhoekClock(new Date()).dateKey;

  // A fresh letter each time the dialog opens, with the record read fresh
  useEffect(() => {
    if (!open) return;
    setKind(initialKind);
    setReferral(emptyReferral());
    setLetter(emptyLetter());
    setProblems([]);
    setMade(null);
    setLoaded(null);
    setLoadError(null);
    setTemplates(null);
    setTemplateId('');
    setTyped({});
    setTemplateEmail('');
    setShowPreview(false);
    if (!user?.id) {
      setLoadError('Sign in again to write letters.');
      return;
    }
    let active = true;
    loadLetterContext({ practiceId, patientId, visitId, authorId: user.id, letterDate })
      .then(result => {
        if (active) setLoaded(result);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not read the patient record.');
      });
    // Before the letter templates update (or when they cannot be read) there are simply none to choose from
    loadLetterTemplates(practiceId)
      .then(list => {
        if (active) setTemplates(list.filter(template => isLetterKind(template.kind)));
      })
      .catch(() => {
        if (active) setTemplates([]);
      });
    return () => {
      active = false;
    };
  }, [open, initialKind, practiceId, patientId, visitId, user?.id, letterDate]);

  const template = templates?.find(item => item.id === templateId) ?? null;
  const values: MergeValues = { ...(loaded?.merge ?? {}), ...(typed as MergeValues) };
  const merged = template
    ? mergeLetterParts({ title: template.title, recipient: recipientDraft, subject: template.subject, greeting: template.greeting, body: bodyDraft }, values)
    : null;
  const templateDocument =
    template && merged && loaded
      ? buildMergedLetter({ kind: template.kind === 'referral' ? 'referral' : 'letter', name: template.name, ...merged.parts }, loaded.context)
      : null;

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    setTyped({});
    setProblems([]);
    const chosen = templates?.find(item => item.id === id);
    setRecipientDraft(chosen && loaded ? mergeTemplate(chosen.recipient, loaded.merge).text : '');
    setBodyDraft(chosen && loaded ? mergeTemplate(chosen.body, loaded.merge).text : '');
  };

  const makeFromTemplate = async () => {
    if (!loaded) return;
    if (!template || !merged || !templateDocument) {
      setProblems(['Choose a template.']);
      return;
    }
    if (merged.missing.length > 0) {
      setProblems([`Fill in ${merged.missing.map(name => fieldLabel(name).toLowerCase()).join(', ')} before making the letter.`]);
      return;
    }
    if (templateEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(templateEmail.trim())) {
      setProblems(['The email address is not complete.']);
      return;
    }
    setProblems([]);
    const recipientName = templateDocument.recipientLines[0] ?? null;
    const recipientEmail = templateEmail.trim() || null;
    setSaving(true);
    let record: LetterRecord | null = null;
    let notKept = false;
    try {
      record = await createLetter({
        practiceId,
        patientId,
        visitId,
        kind: template.kind === 'referral' ? 'referral' : 'letter',
        document: templateDocument,
        recipientName,
        recipientEmail,
        letterDate,
        validUntil: null,
        templateId: template.id
      });
    } catch (error) {
      if (error instanceof LettersNotSetUpError) {
        notKept = true;
      } else {
        toast.error(error instanceof Error ? error.message : 'Could not keep the letter on the file.');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setMade({ document: templateDocument, record, notKept, email: recipientEmail ?? loaded.patientEmail, recipientName });
    onCreated?.(record);
  };

  const make = async () => {
    if (!loaded) return;
    if (kind === 'template') {
      await makeFromTemplate();
      return;
    }
    const issues = kind === 'referral' ? validateReferral(referral, letterDate) : validateGeneralLetter(letter);
    setProblems(issues);
    if (issues.length > 0) return;
    const document = kind === 'referral' ? buildReferralLetter(referral, loaded.context) : buildGeneralLetter(letter, loaded.context);
    const recipientName = (kind === 'referral' ? referral.toName : letter.toName).trim() || null;
    const recipientEmail = (kind === 'referral' ? referral.toEmail : letter.toEmail).trim() || null;
    setSaving(true);
    let record: LetterRecord | null = null;
    let notKept = false;
    try {
      record = await createLetter({
        practiceId,
        patientId,
        visitId,
        kind,
        document,
        recipientName,
        recipientEmail,
        letterDate,
        validUntil: kind === 'referral' && referral.validUntil ? referral.validUntil : null
      });
    } catch (error) {
      if (error instanceof LettersNotSetUpError) {
        notKept = true;
      } else {
        toast.error(error instanceof Error ? error.message : 'Could not keep the letter on the file.');
        setSaving(false);
        return;
      }
    }
    setSaving(false);
    setMade({ document, record, notKept, email: recipientEmail ?? loaded.patientEmail, recipientName });
    onCreated?.(record);
  };

  // Text fields of the referral (the checkboxes use `check` below)
  const field = (key: 'toName' | 'toPractice' | 'toSpecialty' | 'toEmail' | 'urgency' | 'reason' | 'history' | 'validUntil') => ({
    value: referral[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setReferral(current => ({ ...current, [key]: event.target.value }) as ReferralInput)
  });
  const check = (key: 'includeDiagnosis' | 'includeMedicines' | 'includeAllergies' | 'includeProblems') => ({
    checked: referral[key],
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => setReferral(current => ({ ...current, [key]: event.target.checked }))
  });

  const title = made ? (made.document.kind === 'referral' ? 'Referral letter ready' : 'Letter ready') : 'Write a letter';

  return (
    <ClinicalDialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={loaded ? `For ${loaded.context.patient.name}` : undefined}
      size="lg"
      dismissible={!saving}
      initialFocus={firstFieldRef}
      footer={
        made ? (
          <div className="flex justify-end">
            <button type="button" className={PRIMARY_BUTTON} onClick={onClose}>
              Done
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" className={SECONDARY_BUTTON} onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="button" className={PRIMARY_BUTTON} onClick={() => void make()} disabled={saving || !loaded}>
              {saving ? 'Making...' : 'Make letter'}
            </button>
          </div>
        )
      }
    >
      {loadError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      )}

      {!loadError && !loaded && <p className="text-sm text-gray-500">Reading the patient record...</p>}

      {loaded && made && (
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900">
            <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
            <div>
              <p className="font-semibold">{made.document.recordTitle}</p>
              <p>
                {made.notKept
                  ? 'Print or email it now: letters are not kept on the patient file yet (OneHealth support switches this on).'
                  : 'Kept on the patient file. Print it or email it as a PDF.'}
              </p>
            </div>
          </div>
          <LetterActions
            getDocument={async () => made.document}
            practiceId={practiceId}
            patientId={patientId}
            visitId={visitId}
            letterId={made.record?.id ?? null}
            defaultEmail={made.email}
            recipientName={made.recipientName}
          />
        </div>
      )}

      {loaded && !made && (
        <div className="space-y-4">
          <div role="radiogroup" aria-label="Kind of letter" className="inline-flex max-w-full flex-wrap rounded-xl bg-gray-100 p-1">
            {KIND_OPTIONS.map(option => (
              <button
                key={option.kind}
                type="button"
                role="radio"
                aria-checked={kind === option.kind}
                onClick={() => {
                  setKind(option.kind);
                  setProblems([]);
                }}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium ${kind === option.kind ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {problems.length > 0 && (
            <ul className="list-disc space-y-1 rounded-xl bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800" role="alert">
              {problems.map(problem => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          {kind === 'template' ? (
            templates === null ? (
              <p className="text-sm text-gray-500">Reading the practice&apos;s letter templates...</p>
            ) : templates.length === 0 ? (
              <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">
                The practice has no letter templates yet. A practice administrator adds certificates, referral and recall letters
                in Messages &gt; Templates; until then, write a referral or another letter here.
              </p>
            ) : (
              <div className="space-y-3">
                <div>
                  <label htmlFor={`${baseId}-template`} className={LABEL}>
                    Template
                  </label>
                  <select id={`${baseId}-template`} className={INPUT} value={templateId} onChange={event => chooseTemplate(event.target.value)}>
                    <option value="">Choose a template...</option>
                    {templates.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({letterKindInfo(item.kind).label})
                      </option>
                    ))}
                  </select>
                </div>
                {template && merged && (
                  <>
                    {merged.missing.length > 0 && (
                      <fieldset className="space-y-2 rounded-xl bg-amber-50 p-3">
                        <legend className="sr-only">Details this letter needs</legend>
                        <p className="text-sm text-amber-900">Not on file for this patient: fill in for this letter.</p>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {merged.missing.map(name => (
                            <div key={name}>
                              <label htmlFor={`${baseId}-fill-${name}`} className={LABEL}>
                                {fieldLabel(name)}
                              </label>
                              <input
                                id={`${baseId}-fill-${name}`}
                                className={INPUT}
                                maxLength={200}
                                value={typed[name] ?? ''}
                                onChange={event => setTyped(current => ({ ...current, [name]: event.target.value }))}
                              />
                            </div>
                          ))}
                        </div>
                      </fieldset>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label htmlFor={`${baseId}-template-to`} className={LABEL}>
                          To <span className="font-normal text-gray-500">(optional, one line each)</span>
                        </label>
                        <textarea
                          id={`${baseId}-template-to`}
                          className={`${INPUT} min-h-[4rem]`}
                          maxLength={300}
                          value={recipientDraft}
                          onChange={event => setRecipientDraft(event.target.value)}
                        />
                      </div>
                      <div>
                        <label htmlFor={`${baseId}-template-email`} className={LABEL}>
                          Their email <span className="font-normal text-gray-500">(optional)</span>
                        </label>
                        <input
                          id={`${baseId}-template-email`}
                          type="email"
                          className={INPUT}
                          autoComplete="off"
                          value={templateEmail}
                          onChange={event => setTemplateEmail(event.target.value)}
                        />
                      </div>
                    </div>
                    <div>
                      <label htmlFor={`${baseId}-template-body`} className={LABEL}>
                        Letter
                      </label>
                      <textarea
                        id={`${baseId}-template-body`}
                        className={`${INPUT} min-h-[10rem]`}
                        maxLength={8000}
                        value={bodyDraft}
                        onChange={event => setBodyDraft(event.target.value)}
                      />
                      <p className="mt-1 text-xs text-gray-500">Change the wording for this letter if needed; the template stays as it is.</p>
                    </div>
                    {templateDocument && (
                      <div>
                        <button type="button" className={QUIET_BUTTON} aria-expanded={showPreview} onClick={() => setShowPreview(value => !value)}>
                          <Icon icon="solar:eye-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          {showPreview ? 'Hide the preview' : 'Show the preview'}
                        </button>
                        {showPreview && (
                          <div className="mt-2">
                            <LetterPreview document={templateDocument} />
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )
          ) : kind === 'referral' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${baseId}-to`} className={LABEL}>
                  Refer to
                </label>
                <input id={`${baseId}-to`} ref={firstFieldRef} className={INPUT} placeholder="e.g. Dr M Iipinge" maxLength={120} {...field('toName')} />
              </div>
              <div>
                <label htmlFor={`${baseId}-specialty`} className={LABEL}>
                  Specialty <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input id={`${baseId}-specialty`} className={INPUT} placeholder="e.g. Cardiology" maxLength={80} {...field('toSpecialty')} />
              </div>
              <div>
                <label htmlFor={`${baseId}-practice`} className={LABEL}>
                  Practice or hospital <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input id={`${baseId}-practice`} className={INPUT} maxLength={120} {...field('toPractice')} />
              </div>
              <div>
                <label htmlFor={`${baseId}-email`} className={LABEL}>
                  Their email <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input id={`${baseId}-email`} type="email" className={INPUT} autoComplete="off" {...field('toEmail')} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`${baseId}-reason`} className={LABEL}>
                  Reason for referral
                </label>
                <textarea id={`${baseId}-reason`} className={`${INPUT} min-h-[4rem]`} maxLength={1000} {...field('reason')} />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`${baseId}-history`} className={LABEL}>
                  History and findings <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <textarea id={`${baseId}-history`} className={`${INPUT} min-h-[4rem]`} maxLength={2000} {...field('history')} />
              </div>
              <div>
                <label htmlFor={`${baseId}-urgency`} className={LABEL}>
                  How soon
                </label>
                <select id={`${baseId}-urgency`} className={INPUT} {...field('urgency')}>
                  {(Object.keys(URGENCY_LABELS) as ReferralUrgency[]).map(option => (
                    <option key={option} value={option}>
                      {URGENCY_LABELS[option]}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor={`${baseId}-valid`} className={LABEL}>
                  Valid until <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input id={`${baseId}-valid`} type="date" className={INPUT} min={letterDate} {...field('validUntil')} />
              </div>
              <fieldset className="sm:col-span-2">
                <legend className={LABEL}>Include from the record</legend>
                <div className="grid grid-cols-1 gap-2 text-sm text-gray-700 sm:grid-cols-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-purple-600" {...check('includeDiagnosis')} disabled={!loaded.context.diagnosis} />
                    Diagnosis of this visit{loaded.context.diagnosis ? '' : ' (none recorded)'}
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-purple-600" {...check('includeProblems')} />
                    Active problems ({loaded.context.problems?.length ?? 0})
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-purple-600" {...check('includeMedicines')} />
                    Current medicines ({loaded.context.medicines?.length ?? 0})
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="h-4 w-4 accent-purple-600" {...check('includeAllergies')} />
                    Allergies
                  </label>
                </div>
              </fieldset>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor={`${baseId}-letter-to`} className={LABEL}>
                  To <span className="font-normal text-gray-500">(empty: "To whom it may concern")</span>
                </label>
                <input
                  id={`${baseId}-letter-to`}
                  ref={firstFieldRef}
                  className={INPUT}
                  maxLength={120}
                  value={letter.toName}
                  onChange={event => setLetter(current => ({ ...current, toName: event.target.value }))}
                />
              </div>
              <div>
                <label htmlFor={`${baseId}-letter-email`} className={LABEL}>
                  Their email <span className="font-normal text-gray-500">(optional)</span>
                </label>
                <input
                  id={`${baseId}-letter-email`}
                  type="email"
                  className={INPUT}
                  autoComplete="off"
                  value={letter.toEmail}
                  onChange={event => setLetter(current => ({ ...current, toEmail: event.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`${baseId}-subject`} className={LABEL}>
                  Subject
                </label>
                <input
                  id={`${baseId}-subject`}
                  className={INPUT}
                  maxLength={120}
                  placeholder="e.g. Fit to travel"
                  value={letter.subject}
                  onChange={event => setLetter(current => ({ ...current, subject: event.target.value }))}
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor={`${baseId}-body`} className={LABEL}>
                  Letter
                </label>
                <textarea
                  id={`${baseId}-body`}
                  className={`${INPUT} min-h-[8rem]`}
                  maxLength={4000}
                  value={letter.body}
                  onChange={event => setLetter(current => ({ ...current, body: event.target.value }))}
                />
                <p className="mt-1 text-xs text-gray-500">The letterhead, date, patient, greeting and your signature are added for you.</p>
              </div>
            </div>
          )}
        </div>
      )}
    </ClinicalDialog>
  );
};

export default LetterComposer;
