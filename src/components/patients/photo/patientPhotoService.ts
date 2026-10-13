/**
 * Storing, removing and showing patient photos (parity A12). Lists ask for many photos at once: the requests made in
 * the same moment are read with one query of patients.photo_path and one batch of short-lived links, and kept for a
 * little less than the links last. Nothing is asked before patients.photo_path exists
 * (proposals/2026-10-13-patient-photo-and-referral-source.sql): every patient then shows their initials as before.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '../../../lib/supabase';
import { RECORDS_BUCKET, RECORD_LINK_SECONDS } from '../../../services/recordPaths';
import { hasPatientPhotoColumn } from '../../forms/patientExtrasColumns';
import { isPatientPhotoPath, patientPhotoPath } from './patientPhoto';

// Untyped: the generated types do not know patients.photo_path before the proposal is applied
const untypedDb = supabase as unknown as SupabaseClient;

/** A link is reused until a minute before it stops working */
const LINK_REUSE_MS = (RECORD_LINK_SECONDS - 60) * 1000;
const BATCH_SIZE = 100;

export const PATIENT_PHOTO_CHANGED = 'onehealth:patient-photo-changed';

interface CachedPhoto {
  path: string | null;
  url: string | null;
  until: number;
}

const cache = new Map<string, CachedPhoto>();
const waiting = new Map<string, Array<(url: string | null) => void>>();
let flushScheduled = false;

const now = () => Date.now();

async function linksFor(paths: string[]): Promise<Map<string, string>> {
  const links = new Map<string, string>();
  if (paths.length === 0) return links;
  const { data, error } = await supabase.storage.from(RECORDS_BUCKET).createSignedUrls(paths, RECORD_LINK_SECONDS);
  if (error) throw error;
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) links.set(item.path, item.signedUrl);
  }
  return links;
}

async function readBatch(ids: string[]): Promise<Map<string, CachedPhoto>> {
  const result = new Map<string, CachedPhoto>();
  const { data, error } = await untypedDb.from('patients').select('id, photo_path').in('id', ids);
  if (error) throw error;
  const rows = (data ?? []) as Array<{ id: string; photo_path: string | null }>;
  const withPhoto = rows.filter(row => isPatientPhotoPath(row.photo_path, row.id));
  const links = await linksFor(withPhoto.map(row => row.photo_path as string));
  const until = now() + LINK_REUSE_MS;
  for (const id of ids) {
    const row = withPhoto.find(candidate => candidate.id === id);
    const path = row?.photo_path ?? null;
    result.set(id, { path, url: path ? links.get(path) ?? null : null, until });
  }
  return result;
}

async function flush(): Promise<void> {
  flushScheduled = false;
  const requests = new Map(waiting);
  waiting.clear();
  const ids = [...requests.keys()];
  const answer = (id: string, url: string | null) => requests.get(id)?.forEach(resolve => resolve(url));
  let ready = false;
  try {
    ready = await hasPatientPhotoColumn();
  } catch {
    ready = false;
  }
  if (!ready) {
    ids.forEach(id => answer(id, null));
    return;
  }
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const batch = ids.slice(start, start + BATCH_SIZE);
    try {
      const read = await readBatch(batch);
      for (const id of batch) {
        const photo = read.get(id) ?? { path: null, url: null, until: now() + LINK_REUSE_MS };
        cache.set(id, photo);
        answer(id, photo.url);
      }
    } catch (error) {
      // Initials instead of a photo; asked again next time
      console.error('Could not read patient photos:', error);
      batch.forEach(id => answer(id, null));
    }
  }
}

/** A link to the patient's photo, or null when there is none (or photos are not set up yet) */
export function patientPhotoUrl(patientId: string): Promise<string | null> {
  const cached = cache.get(patientId);
  if (cached && cached.until > now()) return Promise.resolve(cached.url);
  return new Promise(resolve => {
    const list = waiting.get(patientId) ?? [];
    list.push(resolve);
    waiting.set(patientId, list);
    if (!flushScheduled) {
      flushScheduled = true;
      setTimeout(() => void flush(), 0);
    }
  });
}

/** The photo path on file now (null when none), read fresh */
async function currentPhotoPath(patientId: string): Promise<string | null> {
  const { data, error } = await untypedDb.from('patients').select('photo_path').eq('id', patientId).maybeSingle();
  if (error) throw error;
  return (data as { photo_path?: string | null } | null)?.photo_path ?? null;
}

function announce(patientId: string, path: string | null, url: string | null): void {
  cache.set(patientId, { path, url, until: now() + LINK_REUSE_MS });
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(PATIENT_PHOTO_CHANGED, { detail: patientId }));
}

const removeStored = (path: string | null, patientId: string) => {
  if (!isPatientPhotoPath(path, patientId)) return;
  void supabase.storage.from(RECORDS_BUCKET).remove([path as string]).then(({ error }) => {
    if (error) console.error('The old photo file was not removed:', error);
  });
};

/**
 * Stores a prepared photo (compressPhoto) and puts it on the file. The previous photo's file is removed afterwards; if
 * the file cannot be updated, the new upload is removed again, so storage never holds a photo no file points to.
 */
export async function savePatientPhoto(input: { practiceId: string | null; patientId: string; photo: Blob }): Promise<void> {
  const previous = await currentPhotoPath(input.patientId);
  const path = patientPhotoPath(input.practiceId, input.patientId);
  const { error: uploadError } = await supabase.storage.from(RECORDS_BUCKET).upload(path, input.photo, {
    contentType: 'image/jpeg',
    upsert: false
  });
  if (uploadError) throw uploadError;
  const { error: updateError } = await untypedDb.from('patients').update({ photo_path: path }).eq('id', input.patientId);
  if (updateError) {
    removeStored(path, input.patientId);
    throw updateError;
  }
  if (previous !== path) removeStored(previous, input.patientId);
  let url: string | null = null;
  try {
    url = (await linksFor([path])).get(path) ?? null;
  } catch (error) {
    console.error('The new photo was saved but could not be shown yet:', error);
  }
  announce(input.patientId, path, url);
}

/** Takes the photo off the file and removes its stored file; the patient shows their initials again */
export async function removePatientPhoto(patientId: string): Promise<void> {
  const previous = await currentPhotoPath(patientId);
  const { error } = await untypedDb.from('patients').update({ photo_path: null }).eq('id', patientId);
  if (error) throw error;
  removeStored(previous, patientId);
  announce(patientId, null, null);
}

/** For tests: forget every photo and pending request. */
export function resetPatientPhotoCache(): void {
  cache.clear();
  waiting.clear();
  flushScheduled = false;
}
