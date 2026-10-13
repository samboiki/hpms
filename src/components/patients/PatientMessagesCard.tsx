import React, { useCallback, useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import { formatSafetyDate } from './safety/safetyFormat';
import { OUTCOME_LABELS, loadPatientMessages, type PatientMessage } from './patientMessages';
import { ClinicalDialog } from './safety/ClinicalDialog';
import { QUIET_BUTTON, SECONDARY_BUTTON } from '../patientLists/listStyles';
import { MessageLogView } from '../communications/MessageLogView';
import { messageLogLink } from '../billing/invoiceLinks';

interface PatientMessagesCardProps {
  practiceId: string;
  patientId: string;
}

type State = { status: 'loading' } | { status: 'ready'; messages: PatientMessage[]; incomplete: boolean } | { status: 'error' };

const OUTCOME_CLASS: Readonly<Record<PatientMessage['outcome'], string>> = {
  delivered: 'text-emerald-700',
  sent: 'text-gray-600',
  waiting: 'text-amber-700',
  failed: 'text-red-700'
};

/** The latest SMS and emails sent to the patient (reminders, invoices, letters), newest first; all of them one tap away. */
export const PatientMessagesCard: React.FC<PatientMessagesCardProps> = ({ practiceId, patientId }) => {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const result = await loadPatientMessages(practiceId, patientId);
      setState({ status: 'ready', messages: result.messages, incomplete: result.incomplete });
    } catch {
      setState({ status: 'error' });
    }
  }, [practiceId, patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby={`messages-${patientId}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-blue-100 p-2 text-blue-600">
          <Icon icon="solar:chat-round-dots-bold-duotone" className="h-5 w-5" aria-hidden="true" />
        </div>
        <h3 id={`messages-${patientId}`} className="text-base font-semibold text-gray-900">
          Messages sent
        </h3>
      </div>
      <div className="mt-4">
        {state.status === 'loading' && <p className="text-sm text-gray-500">Loading messages...</p>}
        {state.status === 'error' && (
          <p className="text-sm text-red-700" role="alert">
            Could not load the messages.{' '}
            <button type="button" className="font-medium underline" onClick={() => void load()}>
              Try again
            </button>
          </p>
        )}
        {state.status === 'ready' && state.messages.length === 0 && (
          <p className="text-sm text-gray-500">No SMS or emails sent to this patient yet. Use Message or Email above to send one.</p>
        )}
        {state.status === 'ready' && state.messages.length > 0 && (
          <ul className="divide-y divide-gray-100">
            {state.messages.map(message => (
              <li key={message.id} className="flex items-start gap-3 py-2.5">
                <Icon
                  icon={message.channel === 'sms' ? 'solar:chat-round-line-bold-duotone' : 'solar:letter-bold-duotone'}
                  className="mt-0.5 h-5 w-5 shrink-0 text-gray-400"
                  aria-label={message.channel === 'sms' ? 'SMS' : 'Email'}
                />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="truncate text-gray-900" title={message.summary}>
                    {message.summary}
                  </p>
                  <p className="text-xs text-gray-500">
                    {[formatSafetyDate(message.at), message.to].filter(Boolean).join(' · ')}
                    {' · '}
                    <span className={OUTCOME_CLASS[message.outcome]}>{OUTCOME_LABELS[message.outcome]}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
        {state.status === 'ready' && state.incomplete && (
          <p className="mt-2 text-xs text-amber-700">Some messages could not be loaded, so this list may be incomplete.</p>
        )}
        {state.status === 'ready' && state.messages.length > 0 && (
          <button type="button" className={`${QUIET_BUTTON} mt-2`} onClick={() => setShowAll(true)}>
            <Icon icon="solar:history-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Show all messages
          </button>
        )}
      </div>

      <ClinicalDialog
        open={showAll}
        onClose={() => setShowAll(false)}
        title="All messages sent"
        subtitle="Every SMS and email sent to this patient, newest first. Tap one to read it."
        size="lg"
        footer={
          <div className="flex flex-wrap justify-between gap-2">
            <Link to={messageLogLink(patientId)} onClick={() => setShowAll(false)} className={SECONDARY_BUTTON}>
              <Icon icon="solar:letter-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Open in Messages
            </Link>
            <button type="button" className={SECONDARY_BUTTON} onClick={() => setShowAll(false)}>
              Close
            </button>
          </div>
        }
      >
        {showAll && (
          <div className="-mx-4 -my-4 sm:-mx-5">
            <MessageLogView practiceId={practiceId} patientId={patientId} onNavigate={() => setShowAll(false)} />
          </div>
        )}
      </ClinicalDialog>
    </section>
  );
};

export default PatientMessagesCard;
