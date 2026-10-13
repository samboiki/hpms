/**
 * Where patient and staff records are stored: prescriptions, sick notes, visit invoices, patient documents and
 * media, lab and imaging results, practice documents, timesheets and leave documents.
 *
 * They live in the private bucket "records" under <practice id>/<kind>/...: the storage rules read the practice from
 * the first folder and let only that practice's staff in (proposals/2026-10-08-records-bucket.sql). A record is never
 * given a public link: rows store the path, and a link that works for a few minutes is made when someone opens the
 * file (recordFiles.ts). Practice logos, staff avatars and signatures stay in the public bucket "documents", because
 * printouts and practice websites show them.
 *
 * No imports on purpose: the move script (scripts/storage/move-records.ts) uses these rules outside the app.
 */

export const RECORDS_BUCKET = 'records';
/** The public bucket every record went to before 2026-10-08: rows written then still point there until moved */
export const LEGACY_RECORDS_BUCKET = 'documents';
/** How long an opened link works: long enough to load or print the file, short enough that a forwarded link dies */
export const RECORD_LINK_SECONDS = 600;

export const RECORD_KINDS = [
  'prescriptions',
  'leave_forms',
  'invoices',
  'patient-documents',
  'patient-media',
  'lab-results',
  'imaging-results',
  'practice-documents',
  'timesheets',
  'leave-documents'
] as const;
export type RecordKind = (typeof RECORD_KINDS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RecordPathError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RecordPathError';
  }
}

/**
 * One folder or file name inside a record path: no "/" (a name cannot reach into another folder), no "." or "..",
 * and only characters the storage server accepts in a path.
 */
export function safePathSegment(part: string): string {
  const cleaned = part
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9._ ()-]+/g, '_')
    .replace(/_{2,}/g, '_')
    .trim();
  return /^\.+$/.test(cleaned) ? '_' : cleaned;
}

/**
 * Where a record of this practice is stored: <practice id>/<kind>/<parts...>. A record without a known practice is
 * refused rather than stored where nobody (or the wrong practice) can reach it.
 */
export function recordPath(practiceId: string | null | undefined, kind: RecordKind, ...parts: string[]): string {
  if (!practiceId || !UUID.test(practiceId)) {
    throw new RecordPathError('This file cannot be saved because your practice is not known. Sign out, sign in again and try once more.');
  }
  const rest = parts.map(safePathSegment).filter(part => part !== '');
  if (rest.length === 0) throw new RecordPathError('This file cannot be saved without a name.');
  return [practiceId.toLowerCase(), kind, ...rest].join('/');
}

/** A path this version wrote in "records" (<practice id>/<kind>/...), not one written in "documents" before the move */
export function isRecordPath(path: string): boolean {
  const [practice = '', kind = '', ...rest] = path.split('/');
  return UUID.test(practice) && (RECORD_KINDS as readonly string[]).includes(kind) && rest.length > 0 && rest.every(part => part !== '');
}

/**
 * The bucket a stored path is in: the row's own bucket column when it has one, otherwise "records" for a path this
 * version wrote and "documents" for one written before the move (<patient id>/..., invoices/..., ...).
 */
export function bucketOf(path: string, bucketColumn?: string | null): string {
  return bucketColumn || (isRecordPath(path) ? RECORDS_BUCKET : LEGACY_RECORDS_BUCKET);
}

/** A file to sign now, or a link to open as it is */
export type StoredFileTarget = { bucket: string; path: string } | { link: string };

const STORAGE_LINK = /\/storage\/v1\/object\/(public|sign|authenticated)\/([^/?#]+)\/([^?#]+)/;

const decodePath = (path: string): string =>
  path.split('/').map(part => {
    try {
      return decodeURIComponent(part);
    } catch {
      return part;
    }
  }).join('/');

/**
 * What a stored reference points at. Rows written by this version hold a path. Rows written before the move may hold a
 * whole link: a public link keeps working until its file is moved (the move repoints the row), so it is opened as it
 * is; a signed link has long expired, so its file is signed again.
 */
export function storedFileTarget(ref: string, bucketColumn?: string | null): StoredFileTarget {
  if (!/^https?:\/\//i.test(ref)) return { bucket: bucketOf(ref, bucketColumn), path: ref };
  const match = STORAGE_LINK.exec(ref);
  if (match && (match[1] !== 'public' || match[2] === RECORDS_BUCKET)) {
    return { bucket: decodeURIComponent(match[2]), path: decodePath(match[3]) };
  }
  return { link: ref };
}
