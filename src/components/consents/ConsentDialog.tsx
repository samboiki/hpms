import React, { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { loadLetterContext, type LoadedLetterContext } from '../../services/patientLettersService';
import { loadLetterTemplates } from '../../services/letterTemplatesService';
import { ConsentsNotSetUpError, loadVisitPractitionerName, recordConsent } from '../../services/patientConsentsService';
import { CONSENT_SIGNERS, buildConsentDocument, consentSignatureProblems, type ConsentSigner } from '../../utils/clinical/consent';
import { fieldLabel, fieldsIn, mergeTemplate, type MergeValues } from '../../utils/templates/mergeFields';
import { templateParts, type LetterTemplate } from '../../utils/templates/letterTemplates';
import { mergeLetterParts } from '../../utils/templates/listLetters';
import { windhoekClock } from '../../utils/patientLists/listDates';
import type { LetterDocument } from '../../utils/clinical/letters';
import { ClinicalDialog } from '../patients/safety/ClinicalDialog';
import { LetterPreview } from '../letters/LetterPreview';
import { openPdf, renderLetterPdf } from '../letters/letterPdf';
import { INPUT, LABEL, PRIMARY_BUTTON, QUIET_BUTTON, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { SignaturePad } from './SignaturePad';

interface ConsentDialogProps {
  open: boolean;
  onClose: () => void;
  practiceId: string;
  patientId: string;
  /** The visit the form is signed for; null from the patient file */
  visitId: string | null;
  /** After a form is signed and kept */
  onSigned?: () => void;
}

type Phase = 'prepare' | 'sign' | 'done';

/**
 * A consent form from one of the practice's consent templates (Messages > Templates): filled from the patient file and
 * the visit, read and signed on the screen by the patient (or a parent or guardian), then kept as a PDF on the file,
 * linked to the visit. The signed-in staff member is the witness.
 */
export const ConsentDialog: React.FC<ConsentDialogProps> = ({ open, onClose, practiceId, patientId, visitId, onSigned }) => {
  const { user } = useAuthStore();
  const [phase, setPhase] = useState<Phase>('prepare');
  const [loaded, setLoaded] = useState<LoadedLetterContext | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<LetterTemplate[] | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [practitioner, setPractitioner] = useState('');
  const [signedBy, setSignedBy] = useState<ConsentSigner>('patient');
  const [signerName, setSignerName] = useState('');
  const [signature, setSignature] = useState<string | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [signedDocument, setSignedDocument] = useState<LetterDocument | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const baseId = useId();
  const letterDate = windhoekClock(new Date()).dateKey;

  // A fresh form each time the dialog opens, with the record read fresh
  useEffect(() => {
    if (!open) return;
    setPhase('prepare');
    setLoaded(null);
    setLoadError(null);
    setTemplates(null);
    setTemplateId('');
    setBodyDraft('');
    setTyped({});
    setSignedBy('patient');
    setSignerName('');
    setSignature(null);
    setProblems([]);
    setSignedDocument(null);
    setShowPreview(false);
    if (!user?.id) {
      setLoadError('Sign in again to make consent forms.');
      return;
    }
    let active = true;
    Promise.all([
      loadLetterContext({ practiceId, patientId, visitId, authorId: user.id, letterDate }),
      visitId ? loadVisitPractitionerName(visitId).catch(() => null) : Promise.resolve(null)
    ])
      .then(([result, visitPractitioner]) => {
        if (!active) return;
        setLoaded(result);
        // The form names who treats: the visit's practitioner, else the signed-in practitioner (changeable below)
        setPractitioner(visitPractitioner ?? result.merge.practitionerName ?? '');
        setSignerName(result.context.patient.name);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'Could not read the patient record.');
      });
    loadLetterTemplates(practiceId)
      .then(list => {
        if (active) setTemplates(list.filter(template => template.kind === 'consent'));
      })
      .catch(() => {
        if (active) setTemplates([]);
      });
    return () => {
      active = false;
    };
  }, [open, practiceId, patientId, visitId, user?.id, letterDate]);

  const template = templates?.find(item => item.id === templateId) ?? null;
  // Asked for only while the form (as worded now) names the practitioner
  const usesPractitioner = template ? fieldsIn(templateParts({ ...template, body: bodyDraft }).join('\n')).includes('practitionerName') : false;
  // The practitioner who treats comes from its own box (blank stops signing), never silently from the signed-in user
  const values: MergeValues = { ...(loaded?.merge ?? {}), practitionerName: practitioner.trim() || null, ...(typed as MergeValues) };
  const merged = template && loaded ? mergeLetterParts({ ...template, body: bodyDraft }, values) : null;
  const missing = merged ? merged.missing.filter(name => name !== 'practitionerName' || !usesPractitioner) : [];

  const chooseTemplate = (id: string) => {
    setTemplateId(id);
    setTyped({});
    setProblems([]);
    const chosen = templates?.find(item => item.id === id);
    // The record's values go into the wording to edit; {{practitionerName}} stays, filled from its box when signing
    setBodyDraft(chosen && loaded ? mergeTemplate(chosen.body, { ...loaded.merge, practitionerName: null }).text : '');
  };

  const unsignedDocument = template && merged && loaded ? buildConsentDocument({ name: template.name, parts: merged.parts }, loaded.context, null) : null;

  const toSigning = () => {
    if (!template || !merged) {
      setProblems(['Choose a consent form.']);
      return;
    }
    const gaps = [...missing, ...(usesPractitioner && !practitioner.trim() ? ['practitionerName'] : [])];
    if (gaps.length > 0) {
      setProblems([`Fill in ${gaps.map(name => fieldLabel(name).toLowerCase()).join(', ')} first.`]);
      return;
    }
    setProblems([]);
    setPhase('sign');
  };

  const onSignature = useCallback((image: string | null) => {
    setSignature(image);
    setProblems([]);
  }, []);

  const save = async () => {
    if (!template || !merged || !loaded) return;
    const signer = { signedBy, signerName, image: signature ?? '', signedAt: new Date() };
    const issues = consentSignatureProblems(signer);
    setProblems(issues);
    if (issues.length > 0) return;
    const document = buildConsentDocument({ name: template.name, parts: merged.parts }, loaded.context, signer);
    setSaving(true);
    try {
      await recordConsent({
        practiceId,
        patientId,
        visitId,
        templateId: template.id,
        document,
        signedBy,
        signerName,
        dateKey: windhoekClock(signer.signedAt).dateKey
      });
      setSignedDocument(document);
      setPhase('done');
      onSigned?.();
    } catch (error) {
      if (error instanceof ConsentsNotSetUpError) setProblems([error.message]);
      else toast.error(error instanceof Error ? error.message : 'The signed form could not be kept.', { duration: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const title = phase === 'done' ? 'Consent form signed' : phase === 'sign' ? 'Read and sign' : 'Get consent signed';

  const footer =
    phase === 'done' ? (
      <div className="flex flex-wrap justify-end gap-2">
        {signedDocument && (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => openPdf(renderLetterPdf(signedDocument), signedDocument.fileName)}>
            <Icon icon="solar:printer-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
            Open the PDF
          </button>
        )}
        <button type="button" className={PRIMARY_BUTTON} onClick={onClose}>
          Done
        </button>
      </div>
    ) : phase === 'sign' ? (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON} onClick={() => setPhase('prepare')} disabled={saving}>
          Back
        </button>
        <button type="button" className={PRIMARY_BUTTON} onClick={() => void save()} disabled={saving || !signature}>
          {saving ? 'Saving...' : 'Save signed form'}
        </button>
      </div>
    ) : (
      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" className={SECONDARY_BUTTON} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className={PRIMARY_BUTTON} onClick={toSigning} disabled={!loaded || !template}>
          Continue to signing
        </button>
      </div>
    );

  return (
    <ClinicalDialog
      open={open}
      onClose={onClose}
      title={title}
      subtitle={loaded ? `For ${loaded.context.patient.name}` : undefined}
      size="lg"
      // While the patient signs, a stray tap outside must not close the form and lose the signature
      dismissible={phase !== 'sign' && !saving}
      footer={footer}
    >
      {loadError && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
          {loadError}
        </p>
      )}
      {!loadError && !loaded && <p className="text-sm text-gray-500">Reading the patient record...</p>}

      {problems.length > 0 && (
        <ul className="mb-3 list-disc space-y-1 rounded-xl bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800" role="alert">
          {problems.map(problem => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {loaded && phase === 'prepare' && (
        <div className="space-y-4">
          {templates === null ? (
            <p className="text-sm text-gray-500">Reading the practice&apos;s consent forms...</p>
          ) : templates.length === 0 ? (
            <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">
              The practice has no consent forms yet. A practice administrator adds them in{' '}
              <Link to="/communications?tab=templates" className="font-medium text-purple-700 underline" onClick={onClose}>
                Messages &gt; Templates
              </Link>{' '}
              (kind: Consent form), starting from an example.
            </p>
          ) : (
            <>
              <div>
                <label htmlFor={`${baseId}-template`} className={LABEL}>
                  Consent form
                </label>
                <select id={`${baseId}-template`} className={INPUT} value={templateId} onChange={event => chooseTemplate(event.target.value)}>
                  <option value="">Choose a consent form...</option>
                  {templates.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              {template && merged && (
                <>
                  {(missing.length > 0 || usesPractitioner) && (
                    <fieldset className="space-y-2 rounded-xl bg-amber-50 p-3">
                      <legend className="sr-only">Details this form needs</legend>
                      <p className="text-sm text-amber-900">Fill in for this form:</p>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {usesPractitioner && (
                          <div>
                            <label htmlFor={`${baseId}-practitioner`} className={LABEL}>
                              Practitioner who treats
                            </label>
                            <input
                              id={`${baseId}-practitioner`}
                              className={INPUT}
                              maxLength={120}
                              value={practitioner}
                              onChange={event => setPractitioner(event.target.value)}
                            />
                          </div>
                        )}
                        {missing.map(name => (
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
                  <div>
                    <label htmlFor={`${baseId}-body`} className={LABEL}>
                      Wording
                    </label>
                    <textarea
                      id={`${baseId}-body`}
                      className={`${INPUT} min-h-[10rem]`}
                      maxLength={8000}
                      value={bodyDraft}
                      onChange={event => setBodyDraft(event.target.value)}
                    />
                    <p className="mt-1 text-xs text-gray-500">Change the wording for this patient if needed; the template stays as it is.</p>
                  </div>
                  {unsignedDocument && (
                    <div>
                      <button type="button" className={QUIET_BUTTON} aria-expanded={showPreview} onClick={() => setShowPreview(value => !value)}>
                        <Icon icon="solar:eye-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                        {showPreview ? 'Hide the preview' : 'Show the preview'}
                      </button>
                      {showPreview && (
                        <div className="mt-2">
                          <LetterPreview document={unsignedDocument} />
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {loaded && phase === 'sign' && unsignedDocument && (
        <div className="space-y-4">
          <LetterPreview document={unsignedDocument} />
          <fieldset>
            <legend className={LABEL}>Who signs</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Who signs">
              {CONSENT_SIGNERS.map(option => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={signedBy === option.value}
                  onClick={() => {
                    setSignedBy(option.value);
                    setSignerName(option.value === 'patient' ? loaded.context.patient.name : '');
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ring-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 ${
                    signedBy === option.value ? 'bg-purple-50 text-purple-800 ring-purple-300' : 'bg-white text-gray-700 ring-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          <div className="max-w-sm">
            <label htmlFor={`${baseId}-signer`} className={LABEL}>
              Name of the person who signs
            </label>
            <input id={`${baseId}-signer`} className={INPUT} maxLength={120} value={signerName} onChange={event => setSignerName(event.target.value)} />
          </div>
          <SignaturePad onChange={onSignature} signerLabel={signedBy === 'patient' ? 'the patient' : 'the person signing'} disabled={saving} />
          <p className="text-xs text-gray-500">
            You witness the signature: your name, the date and the time are printed on the form, and the signed PDF is kept on the
            patient file{visitId ? ' with this visit' : ''}.
          </p>
        </div>
      )}

      {phase === 'done' && signedDocument && (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 px-3 py-3 text-sm text-emerald-900" role="status">
          <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="font-semibold">{signedDocument.recordTitle}</p>
            <p>Signed and kept as a PDF on the patient file (Consent forms){visitId ? ', with this visit' : ''}.</p>
          </div>
        </div>
      )}
    </ClinicalDialog>
  );
};

export default ConsentDialog;
