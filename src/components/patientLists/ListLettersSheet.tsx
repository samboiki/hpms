import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import type { PatientListRecord } from '../../services/patientListService';
import { LetterTemplatesNotSetUpError, loadLetterTemplates } from '../../services/letterTemplatesService';
import { LettersNotSetUpError, createLetters, loadListLetterSource, type ListLetterSource } from '../../services/patientLettersService';
import { buildMergedLetter, formatLetterDate, type LetterDocument } from '../../utils/clinical/letters';
import { windhoekClock } from '../../utils/patientLists/listDates';
import type { ListMember } from '../../utils/patientLists/listRules';
import { appointmentMergeValues, patientMergeValues, practiceMergeValues, type MergeValues } from '../../utils/templates/mergeFields';
import { isLetterKind, letterKindInfo, listLetterProblem, type LetterTemplate } from '../../utils/templates/letterTemplates';
import { planListLetters, type PlannedLetter } from '../../utils/templates/listLetters';
import { openPdf, renderLetterPdf, renderLettersPdf } from '../letters/letterPdf';
import { ListSheet } from './ListSheet';
import { INPUT, LABEL, PRIMARY_BUTTON, SECONDARY_BUTTON } from './listStyles';

interface ListLettersSheetProps {
  /** Mount the sheet when it opens: templates and patient details are read once, for that moment */
  open: boolean;
  onClose: () => void;
  list: PatientListRecord;
  members: readonly ListMember[];
  practiceId: string;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
const pause = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms));

/**
 * O8: one of the practice's letter templates merged for everyone on the list, printed as one run or saved as a PDF
 * per patient, and kept on each patient's file. A patient whose letter would have a gap gets none, with the reason.
 */
export const ListLettersSheet: React.FC<ListLettersSheetProps> = ({ open, onClose, list, members, practiceId }) => {
  const user = useAuthStore(state => state.user);
  const [todayKey] = useState(() => windhoekClock(new Date()).dateKey);
  const [templates, setTemplates] = useState<LetterTemplate[] | null>(null);
  const [notSetUp, setNotSetUp] = useState(false);
  const [source, setSource] = useState<ListLetterSource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState<'print' | 'files' | null>(null);
  const [kept, setKept] = useState<number | null>(null);
  const [openReason, setOpenReason] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) {
      setError('Sign in again to make letters.');
      return;
    }
    let active = true;
    Promise.all([
      loadLetterTemplates(practiceId).catch((loadError: unknown) => {
        if (loadError instanceof LetterTemplatesNotSetUpError) {
          if (active) setNotSetUp(true);
          return [];
        }
        throw loadError;
      }),
      loadListLetterSource(practiceId, user.id, members.map(member => member.patientId))
    ])
      .then(([list, loaded]) => {
        if (!active) return;
        setTemplates(list.filter(template => isLetterKind(template.kind)));
        setSource(loaded);
      })
      .catch((loadError: unknown) => {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not prepare the letters.');
      });
    return () => {
      active = false;
    };
    // Read once when the sheet opens (the parent mounts it on open)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const template = templates?.find(item => item.id === templateId) ?? null;
  const problem = template ? listLetterProblem(template) : null;

  const plan = useMemo(() => {
    if (!template || problem || !source) return null;
    const shared: MergeValues = {
      ...practiceMergeValues({
        name: source.practice.name,
        phone: source.practice.contactPhone,
        email: source.practice.contactEmail,
        address: source.practice.address,
        city: source.practice.city
      }),
      practitionerName: source.author.name,
      today: formatLetterDate(todayKey) || null
    };
    const patients = members.map(member => {
      const details = source.patients.get(member.patientId) ?? { firstName: member.facts.firstName, lastName: member.facts.lastName, dateOfBirth: member.facts.dateOfBirth };
      return {
        patientId: member.patientId,
        name: `${member.facts.firstName} ${member.facts.lastName}`.trim() || 'Patient',
        values: { ...patientMergeValues(details, todayKey), ...appointmentMergeValues(member.facts) }
      };
    });
    return planListLetters(template, patients, shared);
  }, [template, problem, source, members, todayKey]);

  const documents = (letters: readonly PlannedLetter[]): Array<{ letter: PlannedLetter; document: LetterDocument }> =>
    !template || !source
      ? []
      : letters.map(letter => {
          const details = source.patients.get(letter.patientId);
          const document = buildMergedLetter(
            { kind: template.kind === 'referral' ? 'referral' : 'letter', name: template.name, ...letter.parts },
            {
              practice: source.practice,
              author: source.author,
              patient: { name: letter.name, dateOfBirth: details?.dateOfBirth ?? null, idNumber: null },
              letterDate: todayKey
            }
          );
          return { letter, document };
        });

  /** Keeps each letter on its patient's file once, whichever way it was printed */
  const keepOnFiles = async (made: Array<{ letter: PlannedLetter; document: LetterDocument }>) => {
    if (kept !== null || !template) return;
    try {
      const count = await createLetters(
        made.map(({ letter, document }) => ({
          practiceId,
          patientId: letter.patientId,
          visitId: null,
          kind: template.kind === 'referral' ? 'referral' : 'letter',
          document,
          recipientName: document.recipientLines[0] ?? null,
          recipientEmail: null,
          letterDate: todayKey,
          validUntil: null,
          templateId: template.id
        }))
      );
      setKept(count);
    } catch (keepError) {
      if (keepError instanceof LettersNotSetUpError) {
        setKept(0);
        toast('The letters were made, but are not kept on the patient files yet: OneHealth support switches this on.', { duration: 8000 });
      } else {
        toast.error(keepError instanceof Error ? keepError.message : 'The letters were made but could not be kept on the patient files.');
      }
    }
  };

  const printAll = async () => {
    if (!plan || plan.letters.length === 0) return;
    setBusy('print');
    try {
      const made = documents(plan.letters);
      openPdf(renderLettersPdf(made.map(item => item.document)), `${list.name.replace(/[^A-Za-z0-9]+/g, '-')}-letters-${todayKey}.pdf`);
      await keepOnFiles(made);
    } catch (printError) {
      toast.error(printError instanceof Error ? printError.message : 'Could not make the letters.');
    } finally {
      setBusy(null);
    }
  };

  const savePerPatient = async () => {
    if (!plan || plan.letters.length === 0) return;
    setBusy('files');
    try {
      const made = documents(plan.letters);
      for (const { document } of made) {
        renderLetterPdf(document).save(document.fileName);
        // A moment between files, so the browser keeps up (it may ask once to allow several downloads)
        await pause(250);
      }
      toast.success(`${plural(made.length, 'PDF')} saved.`);
      await keepOnFiles(made);
    } catch (saveError) {
      toast.error(saveError instanceof Error ? saveError.message : 'Could not save the letters.');
    } finally {
      setBusy(null);
    }
  };

  const skippedByReason = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const skipped of plan?.skipped ?? []) groups.set(skipped.reason, [...(groups.get(skipped.reason) ?? []), skipped.name]);
    return [...groups.entries()];
  }, [plan]);

  const count = plan?.letters.length ?? 0;
  const footer = (
    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
      <button type="button" onClick={onClose} className={SECONDARY_BUTTON} disabled={busy !== null}>
        {kept !== null ? 'Done' : 'Cancel'}
      </button>
      <button type="button" onClick={() => void savePerPatient()} className={SECONDARY_BUTTON} disabled={busy !== null || count === 0}>
        <Icon icon="solar:download-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        {busy === 'files' ? 'Saving...' : 'A PDF per patient'}
      </button>
      <button type="button" onClick={() => void printAll()} className={PRIMARY_BUTTON} disabled={busy !== null || count === 0}>
        <Icon icon="solar:printer-minimalistic-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        {busy === 'print' ? 'Making...' : count > 0 ? `Print ${plural(count, 'letter')}` : 'Print letters'}
      </button>
    </div>
  );

  return (
    <ListSheet open={open} onClose={onClose} dismissible={busy === null} size="lg" title={`Letters for "${list.name}"`} subtitle="One letter per patient, from one of the practice's templates." footer={footer}>
      <div className="space-y-4">
        {error && (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
            {error}
          </p>
        )}
        {!error && (templates === null || source === null) && <p className="text-sm text-gray-500">Reading the templates and the patients on the list...</p>}
        {!error && templates !== null && source !== null && templates.length === 0 && (
          <p className="rounded-xl bg-gray-50 px-3 py-3 text-sm text-gray-700">
            {notSetUp
              ? 'Letter templates are not set up yet: OneHealth support switches them on.'
              : 'The practice has no letter templates yet. A practice administrator adds recall and other letters in Messages > Templates.'}
          </p>
        )}
        {!error && templates !== null && source !== null && templates.length > 0 && (
          <>
            <div>
              <label htmlFor="list-letter-template" className={LABEL}>
                Letter
              </label>
              <select
                id="list-letter-template"
                className={INPUT}
                value={templateId}
                onChange={event => {
                  setTemplateId(event.target.value);
                  setKept(null);
                  setOpenReason(null);
                }}
              >
                <option value="">Choose a template...</option>
                {templates.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({letterKindInfo(item.kind).label})
                  </option>
                ))}
              </select>
            </div>

            {problem && (
              <p className="rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900" role="alert">
                {problem}
              </p>
            )}

            {plan && (
              <>
                <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-purple-50 to-indigo-50 p-4 ring-1 ring-purple-100">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm">
                    <Icon icon="solar:document-text-bold-duotone" className="h-6 w-6 text-purple-600" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-2xl font-semibold tabular-nums text-gray-900">{plan.letters.length}</p>
                    <p className="text-sm text-gray-600">
                      {plan.letters.length === 1 ? 'letter' : 'letters'}, signed by {source.author.name}
                    </p>
                  </div>
                </div>

                {skippedByReason.length > 0 && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-900">{plural(plan.skipped.length, 'patient')} will not get one</p>
                    <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200">
                      {skippedByReason.map(([reason, names]) => (
                        <li key={reason}>
                          <button
                            type="button"
                            onClick={() => setOpenReason(openReason === reason ? null : reason)}
                            aria-expanded={openReason === reason}
                            className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
                          >
                            <span className="text-gray-700">{reason.charAt(0).toUpperCase() + reason.slice(1)}</span>
                            <span className="flex items-center gap-1 tabular-nums text-gray-500">
                              {names.length}
                              <Icon
                                icon="solar:alt-arrow-down-bold-duotone"
                                className={`h-4 w-4 motion-safe:transition-transform ${openReason === reason ? 'rotate-180' : ''}`}
                                aria-hidden="true"
                              />
                            </span>
                          </button>
                          {openReason === reason && <p className="px-3 pb-3 text-sm text-gray-600">{names.join(', ')}</p>}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {kept !== null && kept > 0 && (
                  <p className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
                    <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
                    Kept on {plural(kept, 'patient file')} (Letters and sick notes).
                  </p>
                )}
                <p className="text-xs text-gray-500">
                  Print opens all the letters in one PDF, each on its own page. A PDF per patient saves a file for each, named after the patient.
                </p>
              </>
            )}
          </>
        )}
      </div>
    </ListSheet>
  );
};

export default ListLettersSheet;
