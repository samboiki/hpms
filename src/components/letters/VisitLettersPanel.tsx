import React, { useCallback, useEffect, useState } from 'react';
import { plainWords } from '../../utils/plainErrors';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import {
  LettersNotSetUpError,
  listLetters,
  listSickNotes,
  type LetterRecord,
  type SickNoteRecord
} from '../../services/patientLettersService';
import { QUIET_BUTTON, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { formatSafetyDate } from '../patients/safety/safetyFormat';
import { LetterActions } from './LetterActions';
import { LetterComposer, type ComposerKind } from './LetterComposer';
import { buildSickNoteDocument } from './sickNoteDocument';

interface VisitLettersPanelProps {
  practiceId: string;
  patientId: string;
  /** The visit the letters are written from; null on the patient file (all the patient's letters) */
  visitId: string | null;
  /** The patient's email, offered when a letter is emailed to the patient */
  patientEmail?: string | null;
  title?: string;
  /** Also list the issued sick notes (the patient file; the visit lists its own above) */
  includeSickNotes?: boolean;
  /** The patient file: a letter or sick note written from a visit opens that visit (on its Letters tab) */
  onOpenVisit?: (visitId: string) => void;
}

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; letters: LetterRecord[] }
  | { status: 'not_set_up' }
  | { status: 'error'; message: string };

const isIssued = (note: SickNoteRecord) => (note.status ?? '').toLowerCase() === 'issued';

/** Referral letters and other letters (and on the file, sick notes): write one, then print or email it. */
export const VisitLettersPanel: React.FC<VisitLettersPanelProps> = ({
  practiceId,
  patientId,
  visitId,
  patientEmail = null,
  title = 'Referral letters and other letters',
  includeSickNotes = false,
  onOpenVisit
}) => {
  // On the patient file only (visitId null): the visit a letter was written from, one tap away
  const openVisitButton = (fromVisitId: string | null) =>
    onOpenVisit && !visitId && fromVisitId ? (
      <button type="button" className={`${QUIET_BUTTON} whitespace-nowrap`} onClick={() => onOpenVisit(fromVisitId)}>
        <Icon icon="solar:calendar-bold-duotone" className="h-4 w-4" aria-hidden="true" />
        Open the visit
      </button>
    ) : null;
  const { user } = useAuthStore();
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [sickNotes, setSickNotes] = useState<SickNoteRecord[]>([]);
  const [composerKind, setComposerKind] = useState<ComposerKind | null>(null);

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', letters: await listLetters(patientId, visitId) });
    } catch (error) {
      if (error instanceof LettersNotSetUpError) setState({ status: 'not_set_up' });
      else setState({ status: 'error', message: error instanceof Error ? plainWords(error.message) : 'Could not load the letters.' });
    }
  }, [patientId, visitId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!includeSickNotes) return;
    let active = true;
    listSickNotes(patientId)
      .then(notes => {
        if (active) setSickNotes(notes.filter(isIssued));
      })
      .catch(() => {
        // The sick notes stay reachable from each visit; the file simply does not list them
        if (active) setSickNotes([]);
      });
    return () => {
      active = false;
    };
  }, [includeSickNotes, patientId]);

  const letters = state.status === 'ready' ? state.letters : [];
  const nothingYet = state.status !== 'loading' && state.status !== 'error' && letters.length === 0 && sickNotes.length === 0;
  const headingId = `letters-${visitId ?? patientId}`;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Icon icon="solar:letter-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 id={headingId} className="text-base font-semibold text-gray-900">
            {title}
          </h3>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setComposerKind('template')}>
            <Icon icon="solar:document-add-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
            From a template
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setComposerKind('referral')}>
            <Icon icon="solar:file-send-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
            Referral letter
          </button>
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setComposerKind('letter')}>
            <Icon icon="solar:document-text-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
            Other letter
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {state.status === 'loading' && <p className="text-sm text-gray-500">Loading letters...</p>}
        {state.status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            {state.message}{' '}
            <button type="button" className="font-medium underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {state.status === 'not_set_up' && (
          <p className="text-sm text-gray-500">
            Letters can be written, printed and emailed. They are kept on the patient file once OneHealth support switches this on.
          </p>
        )}
        {nothingYet && state.status === 'ready' && <p className="text-sm text-gray-500">No letters yet.</p>}

        {(letters.length > 0 || sickNotes.length > 0) && (
          <ul className="divide-y divide-gray-100">
            {letters.map(letter => (
              <li key={letter.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-900">{letter.title}</p>
                  <p className="text-gray-500">
                    {[
                      formatSafetyDate(letter.letterDate),
                      letter.authorName,
                      letter.sentAt ? `emailed to ${letter.sentTo ?? 'recipient'} on ${formatSafetyDate(letter.sentAt)}` : null,
                      letter.validUntil ? `valid until ${formatSafetyDate(letter.validUntil)}` : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {openVisitButton(letter.visitId)}
                  <LetterActions
                    compact
                    getDocument={async () => letter.document}
                    practiceId={practiceId}
                    patientId={patientId}
                    visitId={letter.visitId}
                    letterId={letter.id}
                    defaultEmail={letter.recipientEmail ?? patientEmail}
                    recipientName={letter.recipientName}
                    onEmailed={() => void load()}
                  />
                </div>
              </li>
            ))}
            {sickNotes.map(note => (
              <li key={note.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-900">Sick note{note.formNumber ? ` no ${note.formNumber}` : ''}</p>
                  <p className="text-gray-500">
                    {[formatSafetyDate(note.fromDate), note.toDate !== note.fromDate ? `to ${formatSafetyDate(note.toDate)}` : null].filter(Boolean).join(' ')}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {openVisitButton(note.visitId)}
                  <LetterActions
                    compact
                    getDocument={() =>
                      buildSickNoteDocument({
                        practiceId,
                        patientId,
                        visitId: note.visitId,
                        signedInUserId: user?.id ?? '',
                        note: {
                          formNumber: note.formNumber,
                          fromDate: note.fromDate,
                          toDate: note.toDate,
                          diagnosis: note.diagnosis,
                          diagnosisCode: note.diagnosisCode,
                          doctorId: note.doctorId,
                          issueDate: note.issueDate
                        }
                      })
                    }
                    practiceId={practiceId}
                    patientId={patientId}
                    visitId={note.visitId}
                    defaultEmail={patientEmail}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <LetterComposer
        open={composerKind !== null}
        onClose={() => setComposerKind(null)}
        practiceId={practiceId}
        patientId={patientId}
        visitId={visitId}
        initialKind={composerKind ?? 'referral'}
        onCreated={() => void load()}
      />
    </section>
  );
};

export default VisitLettersPanel;
