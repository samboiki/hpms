import { useCallback, useEffect, useState } from 'react';
import { loadDiaryDefault, saveDiaryDefault, type DiaryDefaultLoad, type DiaryDefaultSave } from '../services/diaryDefaultService';
import type { DiaryView } from '../utils/diary/diaryDefaultView';

export interface DiaryDefaultState {
  /** 'not_enabled': the column is not in the database yet (nothing can be saved) */
  status: 'idle' | 'loading' | DiaryDefaultLoad['state'];
  /** The saved default: null = nothing saved, [] = all practitioners */
  saved: DiaryView | null;
  save: (view: DiaryView) => Promise<DiaryDefaultSave>;
}

// A default saved in the booking form reaches the diary on the same screen (and the other way round)
const listeners = new Set<(userId: string, view: DiaryView) => void>();

/** The signed-in user's saved diary default (src/utils/diary/diaryDefaultView.ts decides what it means). */
export function useDiaryDefault(userId: string | null | undefined): DiaryDefaultState {
  const [load, setLoad] = useState<DiaryDefaultLoad | null>(null);

  useEffect(() => {
    setLoad(null);
    if (!userId) return;
    let cancelled = false;
    loadDiaryDefault(userId).then((loaded) => {
      if (!cancelled) setLoad(loaded);
    });
    const listener = (savedFor: string, view: DiaryView) => {
      if (savedFor === userId) setLoad({ state: 'ready', saved: view });
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, [userId]);

  const save = useCallback(
    async (view: DiaryView): Promise<DiaryDefaultSave> => {
      if (!userId) return { ok: false, message: 'Sign in again to save your default.' };
      const result = await saveDiaryDefault(userId, view);
      if (result.ok) listeners.forEach((listener) => listener(userId, view));
      return result;
    },
    [userId]
  );

  return {
    status: !userId ? 'idle' : load?.state ?? 'loading',
    saved: load?.state === 'ready' ? load.saved : null,
    save
  };
}
