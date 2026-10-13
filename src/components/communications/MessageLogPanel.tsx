import { useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { patientOverviewLink } from '../billing/invoiceLinks';
import { MessageLogView } from './MessageLogView';

export interface MessageLogPanelProps {
  /** The practice whose messages are shown; nothing loads while it is empty */
  practiceId: string | null | undefined;
  /** One patient's messages, when Messages is opened from a patient file (?patient=) */
  patientId?: string | null;
  /** Shows every patient again */
  onClearPatient?: () => void;
}

/** Messages > Message log: every SMS and email the practice sent, searchable, in the look of the other inboxes. */
export function MessageLogPanel({ practiceId, patientId = null, onClearPatient }: MessageLogPanelProps) {
  const titleId = useId();
  const [version, setVersion] = useState(0);
  const [patientName, setPatientName] = useState<string | null>(null);

  // The patient's name for the heading when the log is opened for one patient
  useEffect(() => {
    setPatientName(null);
    if (!patientId) return;
    let active = true;
    void supabase
      .from('patients')
      .select('first_name, last_name')
      .eq('id', patientId)
      .maybeSingle()
      .then(({ data }) => {
        if (active && data) setPatientName([data.first_name, data.last_name].filter(Boolean).join(' ') || null);
      });
    return () => {
      active = false;
    };
  }, [patientId]);

  return (
    <section aria-labelledby={titleId} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 p-4 sm:p-5">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
            <Icon icon="solar:history-bold-duotone" className="h-6 w-6" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-semibold text-gray-900">
              Message log
            </h2>
            <p className="text-sm text-gray-600">
              {patientId
                ? `The SMS and emails sent to ${patientName ?? 'this patient'}, newest first.`
                : 'Every SMS and email the practice sent, newest first. Tap one to read it.'}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {patientId && onClearPatient && (
            <button
              type="button"
              onClick={onClearPatient}
              className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <Icon icon="solar:users-group-rounded-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Every patient
            </button>
          )}
          {/* Back to the file the log was opened from (its "Messages sent" opens this) */}
          {patientId && (
            <Link
              to={patientOverviewLink(patientId)}
              className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
            >
              <Icon icon="solar:user-id-bold-duotone" className="h-4 w-4" aria-hidden="true" />
              Patient file
            </Link>
          )}
          <button
            type="button"
            onClick={() => setVersion(value => value + 1)}
            disabled={!practiceId}
            className="inline-flex min-h-[2.5rem] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2 disabled:opacity-60"
          >
            <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>
      {practiceId ? (
        <MessageLogView key={`${version}-${patientId ?? 'all'}`} practiceId={practiceId} patientId={patientId} />
      ) : (
        <p className="px-4 py-10 text-center text-sm text-gray-600 sm:px-6">Choose a practice to see its messages.</p>
      )}
    </section>
  );
}

export default MessageLogPanel;
