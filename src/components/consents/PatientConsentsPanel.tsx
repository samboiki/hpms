import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { toast } from 'react-hot-toast';
import { ConsentsNotSetUpError, listConsents, type ConsentRecord } from '../../services/patientConsentsService';
import { openRecord } from '../../services/recordFiles';
import { signerRoleLine } from '../../utils/clinical/consent';
import { formatSafetyDate } from '../patients/safety/safetyFormat';
import { QUIET_BUTTON, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { ConsentDialog } from './ConsentDialog';

interface PatientConsentsPanelProps {
  practiceId: string;
  patientId: string;
  /** The visit the forms are signed for (its own forms are listed); null on the patient file (all the patient's forms) */
  visitId: string | null;
  title?: string;
  /** On the patient file: opens the visit a form was signed for (the visit lists its forms too) */
  onOpenVisit?: (visitId: string) => void;
}

type State = { status: 'loading' } | { status: 'not_set_up' } | { status: 'error'; message: string } | { status: 'ready'; consents: ConsentRecord[] };

/** Signed consent forms: get one signed on the screen, and open any signed form as the PDF that was kept. */
export const PatientConsentsPanel: React.FC<PatientConsentsPanelProps> = ({ practiceId, patientId, visitId, title = 'Consent forms', onOpenVisit }) => {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [signing, setSigning] = useState(false);

  const load = useCallback(async () => {
    try {
      setState({ status: 'ready', consents: await listConsents(patientId, { visitId }) });
    } catch (error) {
      setState(error instanceof ConsentsNotSetUpError ? { status: 'not_set_up' } : { status: 'error', message: error instanceof Error ? error.message : 'Could not load the consent forms.' });
    }
  }, [patientId, visitId]);

  useEffect(() => {
    setState({ status: 'loading' });
    void load();
  }, [load]);

  const open = async (consent: ConsentRecord) => {
    try {
      await openRecord(consent.filePath);
    } catch {
      toast.error('The signed form could not be opened. Please try again.');
    }
  };

  const consents = state.status === 'ready' ? state.consents : [];
  const headingId = `consents-${visitId ?? patientId}`;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={headingId}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-purple-100 p-2 text-purple-600">
            <Icon icon="solar:pen-new-square-bold-duotone" className="h-5 w-5" aria-hidden="true" />
          </div>
          <h3 id={headingId} className="text-base font-semibold text-gray-900">
            {title}
          </h3>
        </div>
        {state.status !== 'not_set_up' && (
          <button type="button" className={SECONDARY_BUTTON} onClick={() => setSigning(true)}>
            <Icon icon="solar:pen-bold-duotone" className="h-4 w-4 text-purple-600" aria-hidden="true" />
            Get consent signed
          </button>
        )}
      </div>

      <div className="mt-4 space-y-2">
        {state.status === 'loading' && <p className="text-sm text-gray-500">Loading consent forms...</p>}
        {state.status === 'not_set_up' && <p className="text-sm text-gray-500">Consent forms are not set up in this database yet.</p>}
        {state.status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            {state.message}{' '}
            <button type="button" className="font-medium underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {state.status === 'ready' && consents.length === 0 && (
          <p className="text-sm text-gray-500">No signed consent forms{visitId ? ' for this visit' : ''} yet.</p>
        )}
        {consents.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {consents.map(consent => (
              <li key={consent.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-gray-900">{consent.title}</p>
                  <p className="text-gray-500">
                    {[
                      formatSafetyDate(consent.signedAt),
                      `signed by ${consent.signerName}${consent.signedBy === 'patient' ? '' : ` (${signerRoleLine(consent.signedBy, 'the patient').toLowerCase()})`}`,
                      consent.obtainedByName ? `witness ${consent.obtainedByName}` : null
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-1 self-start sm:self-auto">
                  {onOpenVisit && consent.visitId && (
                    <button type="button" className={`${QUIET_BUTTON} whitespace-nowrap`} onClick={() => onOpenVisit(consent.visitId as string)}>
                      <Icon icon="solar:calendar-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                      Open the visit
                    </button>
                  )}
                  <button type="button" className={`${QUIET_BUTTON} whitespace-nowrap`} onClick={() => void open(consent)}>
                    <Icon icon="solar:file-text-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                    Open the PDF
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConsentDialog
        open={signing}
        onClose={() => setSigning(false)}
        practiceId={practiceId}
        patientId={patientId}
        visitId={visitId}
        onSigned={() => void load()}
      />
    </section>
  );
};

export default PatientConsentsPanel;
