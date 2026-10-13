import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_DIARY_SETTINGS,
  forgetDiarySettings,
  loadDiarySettings,
  loadWorkingHours,
  type DiarySettings,
  type DiarySettingsLoad,
  type WorkingHoursLoad
} from '../services/diarySettingsService';
import { forgetDiaryLists, loadAppointmentTypes, loadDiaryStatuses } from '../services/diaryListsService';
import type { AppointmentType } from '../utils/diary/appointmentTypes';
import type { DiaryStatus } from '../utils/diary/diaryStatuses';
import type { WorkingHoursRow } from '../utils/diary/workingHours';

const NO_HOURS: WorkingHoursRow[] = [];
const NO_STATUSES: DiaryStatus[] = [];
const NO_TYPES: AppointmentType[] = [];

export interface DiarySettingsState {
  /** 'not_enabled': the diary update (proposals/2026-10-07-diary-2.sql) is not applied yet; the defaults apply */
  status: 'idle' | 'loading' | DiarySettingsLoad['state'];
  settings: DiarySettings;
  /** Practitioner working hours ([] = everyone works the practice's opening hours) */
  hours: WorkingHoursRow[];
  hoursStatus: 'idle' | 'loading' | WorkingHoursLoad['state'];
  /** The practice's own booking statuses, removed ones included ([] before they load or are set up) */
  statuses: DiaryStatus[];
  /** The practice's own appointment types, removed ones included */
  appointmentTypes: AppointmentType[];
  /** Read again after a save */
  reload: () => void;
}

/**
 * Booking lengths, slots, reminder settings, working hours, statuses and appointment types of the practice, for the
 * diary and the booking form.
 */
export function useDiarySettings(practiceId: string | null | undefined): DiarySettingsState {
  const [settingsLoad, setSettingsLoad] = useState<DiarySettingsLoad | null>(null);
  const [hoursLoad, setHoursLoad] = useState<WorkingHoursLoad | null>(null);
  const [statuses, setStatuses] = useState<DiaryStatus[]>(NO_STATUSES);
  const [appointmentTypes, setAppointmentTypes] = useState<AppointmentType[]>(NO_TYPES);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    setSettingsLoad(null);
    setHoursLoad(null);
    if (!practiceId) {
      setStatuses(NO_STATUSES);
      setAppointmentTypes(NO_TYPES);
      return;
    }
    let cancelled = false;
    loadDiarySettings(practiceId).then((loaded) => {
      if (!cancelled) setSettingsLoad(loaded);
    });
    loadWorkingHours(practiceId).then((loaded) => {
      if (!cancelled) setHoursLoad(loaded);
    });
    // Optional extras: until they load (or are set up) the diary shows the fixed stages and visit types only
    loadDiaryStatuses(practiceId).then((loaded) => {
      if (!cancelled) setStatuses(loaded.items.length > 0 ? loaded.items : NO_STATUSES);
    });
    loadAppointmentTypes(practiceId).then((loaded) => {
      if (!cancelled) setAppointmentTypes(loaded.items.length > 0 ? loaded.items : NO_TYPES);
    });
    return () => {
      cancelled = true;
    };
  }, [practiceId, version]);

  const reload = useCallback(() => {
    if (practiceId) {
      forgetDiarySettings(practiceId);
      forgetDiaryLists(practiceId);
    }
    setVersion((current) => current + 1);
  }, [practiceId]);

  return {
    status: !practiceId ? 'idle' : settingsLoad?.state ?? 'loading',
    settings: settingsLoad?.settings ?? DEFAULT_DIARY_SETTINGS,
    hours: hoursLoad?.rows ?? NO_HOURS,
    hoursStatus: !practiceId ? 'idle' : hoursLoad?.state ?? 'loading',
    statuses,
    appointmentTypes,
    reload
  };
}
