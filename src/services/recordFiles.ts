/**
 * Opening patient and staff records: a link that works for RECORD_LINK_SECONDS is made at the moment someone opens a
 * file, never stored and never public. Where records are stored, and how old rows are read: recordPaths.ts.
 */
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { RECORD_LINK_SECONDS, storedFileTarget } from './recordPaths';

export {
  RECORDS_BUCKET,
  RECORD_LINK_SECONDS,
  bucketOf,
  isRecordPath,
  recordPath,
  type RecordKind
} from './recordPaths';

/**
 * The practice the signed-in staff member is working in. Records they upload are stored under it: the storage rules
 * let staff write only under their own practice.
 */
export function currentPracticeId(): string | null {
  const { selectedPracticeId, user } = useAuthStore.getState();
  return selectedPracticeId || user?.practice_id || null;
}

/** A link to a stored record (a path, or a link saved before the move), made now */
export async function recordLink(ref: string, bucketColumn?: string | null): Promise<string> {
  const target = storedFileTarget(ref, bucketColumn);
  if ('link' in target) return target.link;
  const { data, error } = await supabase.storage.from(target.bucket).createSignedUrl(target.path, RECORD_LINK_SECONDS);
  if (error || !data?.signedUrl) throw error ?? new Error('The file could not be opened.');
  return data.signedUrl;
}

/**
 * Opens a stored record in a new tab with a fresh link. The tab is opened straight from the click, before the link
 * exists: browsers block a window opened after waiting on the network. If the link cannot be made the empty tab is
 * closed and the error goes to the caller, which says so.
 */
export async function openRecord(ref: string, bucketColumn?: string | null): Promise<void> {
  const tab = window.open('', '_blank');
  try {
    const link = await recordLink(ref, bucketColumn);
    if (tab && !tab.closed) {
      tab.opener = null;
      tab.location.href = link;
      return;
    }
    // Pop-ups blocked: a link click still opens a tab
    const anchor = document.createElement('a');
    anchor.href = link;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } catch (error) {
    tab?.close();
    throw error;
  }
}
