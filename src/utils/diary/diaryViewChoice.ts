/**
 * The diary opens in time slots, practitioners side by side, as Eminance users expect, unless this
 * user last chose the cards. The choice is remembered per user in this browser, since one front-desk
 * computer often serves several people (whose bookings the diary opens on is kept on the server:
 * diaryDefaultView.ts). When the browser blocks storage (a private window, strict settings) the diary
 * simply opens in time slots.
 */

/** 'timeline': the time grid with practitioner columns; 'grid': one card per booking */
export type DiaryLayout = 'timeline' | 'grid';

export const DEFAULT_DIARY_LAYOUT: DiaryLayout = 'timeline';

const KEY_PREFIX = 'hpms:diary-layout:';

const browserStorage = (): Storage | null => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

/** The layout this user last chose in this browser, else the time slots. */
export function readDiaryLayout(userId: string | null | undefined, storage: Pick<Storage, 'getItem'> | null = browserStorage()): DiaryLayout {
  if (!userId || !storage) return DEFAULT_DIARY_LAYOUT;
  try {
    const value = storage.getItem(`${KEY_PREFIX}${userId}`);
    return value === 'timeline' || value === 'grid' ? value : DEFAULT_DIARY_LAYOUT;
  } catch {
    return DEFAULT_DIARY_LAYOUT;
  }
}

/** Remembers the user's choice; a browser that refuses (full or blocked storage) just forgets it. */
export function saveDiaryLayout(userId: string | null | undefined, layout: DiaryLayout, storage: Pick<Storage, 'setItem'> | null = browserStorage()): void {
  if (!userId || !storage) return;
  try {
    storage.setItem(`${KEY_PREFIX}${userId}`, layout);
  } catch {
    // Only a convenience: the diary works the same without it
  }
}
