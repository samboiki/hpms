import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { isNotesNotSetUp, loadFollowUpsDue, notesErrorMessage, setFollowUpDone } from '../../services/patientNotesService';
import { loadPracticeStaff } from '../../services/invoiceContextService';
import type { StaffMember } from '../../utils/billing/invoiceRights';
import { windhoekClock } from '../../utils/patientLists/listDates';
import { dueFollowUps, dueForMeCount, type DueFollowUp } from '../patients/notes/patientNotes';

export interface FollowUpsDue {
  status: 'idle' | 'loading' | 'ready' | 'not_set_up' | 'error';
  error: string | null;
  /** Due today and overdue: the signed-in person's own first, then anyone's, then colleagues' */
  items: DueFollowUp[];
  /** Their own and anyone's (the number on "To Dos") */
  dueForMe: number;
  myUserId: string | null;
  staff: StaffMember[];
  reload: () => Promise<void>;
  /** Marks one done; it leaves the list */
  markDone: (noteId: string) => Promise<void>;
}

/** The follow-ups of patient notes that are due, for the dashboard's "To Dos". */
export function useFollowUpsDue(): FollowUpsDue {
  const user = useAuthStore(state => state.user);
  const { practiceId } = usePractice();
  const myUserId = user?.id ?? null;
  const [status, setStatus] = useState<FollowUpsDue['status']>('idle');
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<DueFollowUp[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const todayKey = windhoekClock(new Date()).dateKey;

  const reload = useCallback(async () => {
    if (!practiceId || !myUserId) {
      setStatus('idle');
      return;
    }
    setStatus(current => (current === 'ready' ? current : 'loading'));
    try {
      const [due, team] = await Promise.all([
        loadFollowUpsDue(practiceId, windhoekClock(new Date()).dateKey),
        loadPracticeStaff(practiceId).catch(() => [] as StaffMember[])
      ]);
      setRows(due);
      setStaff(team);
      setError(null);
      setStatus('ready');
    } catch (loadError) {
      if (isNotesNotSetUp(loadError)) {
        setStatus('not_set_up');
        return;
      }
      setError(notesErrorMessage(loadError, 'Could not load the follow-ups.'));
      setStatus('error');
    }
  }, [practiceId, myUserId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const markDone = useCallback(async (noteId: string) => {
    try {
      await setFollowUpDone(noteId, true);
      setRows(current => current.filter(row => row.noteId !== noteId));
      toast.success('Follow-up done.');
    } catch (doneError) {
      toast.error(doneError instanceof Error ? doneError.message : 'Could not mark the follow-up done.');
    }
  }, []);

  const items = useMemo(() => dueFollowUps(rows, myUserId, todayKey), [rows, myUserId, todayKey]);
  const dueForMe = useMemo(() => dueForMeCount(rows, myUserId, todayKey), [rows, myUserId, todayKey]);

  return { status, error, items, dueForMe, myUserId, staff, reload, markDone };
}
