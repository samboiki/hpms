import React, { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import { ClinicalDialog } from '../patients/safety/ClinicalDialog';
import { CHIP, QUIET_BUTTON } from '../patientLists/listStyles';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { formatServiceDate } from '../../utils/billing/dates';
import { NOTE_TYPE_LABELS, followUpGroup, followUpStatus, noteLink, staffLabel, type FollowUpGroup } from '../patients/notes/patientNotes';
import { FOLLOW_UP_STYLE, NOTE_TYPE_STYLE } from '../patients/notes/noteTypeStyle';
import type { FollowUpsDue } from './useFollowUpsDue';

const GROUPS: ReadonlyArray<{ group: FollowUpGroup; title: string }> = [
  { group: 'mine', title: 'Yours' },
  { group: 'anyone', title: 'For anyone' },
  { group: 'others', title: 'For colleagues' }
];

interface FollowUpsDueDialogProps {
  open: boolean;
  onClose: () => void;
  followUps: FollowUpsDue;
}

/**
 * The dashboard's "To Dos": follow-ups of patient notes due today and overdue, the signed-in person's own first. Each
 * opens the patient file at its note, or is marked done here.
 */
export const FollowUpsDueDialog: React.FC<FollowUpsDueDialogProps> = ({ open, onClose, followUps }) => {
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const { reload } = followUps;
  const todayKey = windhoekClock(new Date()).dateKey;
  const staffById = useMemo(() => new Map(followUps.staff.map(member => [member.id, member])), [followUps.staff]);

  // Fresh each time it opens: colleagues may have done some since the dashboard loaded
  useEffect(() => {
    if (open) void reload();
  }, [open, reload]);

  const groups = GROUPS.map(entry => ({
    ...entry,
    items: followUps.items.filter(item => followUpGroup(item, followUps.myUserId) === entry.group)
  })).filter(entry => entry.items.length > 0);

  const markDone = async (noteId: string) => {
    setBusyId(noteId);
    try {
      await followUps.markDone(noteId);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <ClinicalDialog open={open} onClose={onClose} title="Follow-ups due" subtitle="Today and overdue, yours first." size="lg">
      {followUps.status === 'loading' && <p className="text-sm text-gray-500">Loading follow-ups...</p>}
      {followUps.status === 'not_set_up' && (
        <p className="text-sm text-gray-600">Follow-ups come from patient notes, which are not set up in this database yet.</p>
      )}
      {followUps.status === 'error' && (
        <p className="text-sm text-red-700" role="alert">
          {followUps.error}{' '}
          <button type="button" className="font-medium underline" onClick={() => void reload()}>
            Try again
          </button>
        </p>
      )}
      {followUps.status === 'ready' && groups.length === 0 && (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 ring-1 ring-emerald-200">
          <Icon icon="solar:check-circle-bold-duotone" className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
          <p>Nothing to follow up today. A follow-up is added to a note on the patient&apos;s file (Notes, on the Overview).</p>
        </div>
      )}

      <div className="space-y-5">
        {groups.map(entry => (
          <section key={entry.group} aria-labelledby={`follow-ups-${entry.group}`}>
            <h3 id={`follow-ups-${entry.group}`} className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {entry.title} ({entry.items.length})
            </h3>
            <ul className="mt-2 space-y-2">
              {entry.items.map(item => {
                const status = followUpStatus({ followUpOn: item.followUpOn, followUpDoneAt: null }, todayKey);
                return (
                  <li key={item.noteId} className="rounded-xl border border-gray-200 bg-white p-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-gray-900">{item.patientName}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-gray-700">
                          <span className={`${CHIP} ${NOTE_TYPE_STYLE[item.type].chip}`}>{NOTE_TYPE_LABELS[item.type]}</span>
                          <span className="min-w-0 break-words">{item.header}</span>
                        </p>
                        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                          <span className={`${CHIP} ${status.state === 'none' ? '' : FOLLOW_UP_STYLE[status.state]}`}>{status.label}</span>
                          {status.state === 'overdue' && <span>({formatServiceDate(item.followUpOn)})</span>}
                          {entry.group === 'others' && <span>· {staffLabel(item.followUpUserId, staffById, followUps.myUserId)}</span>}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1">
                        <button
                          type="button"
                          className={QUIET_BUTTON}
                          onClick={() => {
                            onClose();
                            navigate(noteLink(item.patientId, item.noteId, { returnToDashboard: true }));
                          }}
                        >
                          <Icon icon="solar:notebook-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          Open note
                        </button>
                        <button type="button" className={QUIET_BUTTON} disabled={busyId === item.noteId} onClick={() => void markDone(item.noteId)}>
                          <Icon icon="solar:check-circle-bold-duotone" className="h-4 w-4" aria-hidden="true" />
                          {busyId === item.noteId ? 'Saving...' : 'Mark done'}
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </ClinicalDialog>
  );
};

export default FollowUpsDueDialog;
