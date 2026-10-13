/**
 * Showing and storing patient photos (parity A12). A Patients list shows dozens of patients at once: their photos
 * must come from one query and one batch of short-lived links, not one request per row. Before the database has
 * patients.photo_path nothing may be asked (every patient keeps their initials), and a photo the file could not take
 * must not stay behind in storage. Invented ids only; no real photos.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const PRACTICE = '11111111-2222-3333-4444-555555555555';
const P1 = 'aaaaaaaa-0000-0000-0000-000000000001';
const P2 = 'aaaaaaaa-0000-0000-0000-000000000002';
const P3 = 'aaaaaaaa-0000-0000-0000-000000000003';
const photoOf = (id: string) => `${PRACTICE}/patient-media/${id}/photo-1.jpg`;

const state = vi.hoisted(() => ({
  columnReady: true,
  rows: [] as Array<{ id: string; photo_path: string | null }>,
  updateError: null as null | { code: string; message: string },
  calls: { inQueries: 0, signBatches: 0, uploads: [] as string[], removed: [] as string[][], updates: [] as unknown[] }
}));

vi.mock('../../../forms/patientExtrasColumns', () => ({
  hasPatientPhotoColumn: () => Promise.resolve(state.columnReady)
}));

vi.mock('../../../../lib/supabase', () => {
  const from = () => {
    const query = {
      select: () => query,
      in: (_column: string, ids: string[]) => {
        state.calls.inQueries += 1;
        return Promise.resolve({ data: state.rows.filter(row => ids.includes(row.id)), error: null });
      },
      eq: (_column: string, id: string) => ({
        maybeSingle: () => Promise.resolve({ data: state.rows.find(row => row.id === id) ?? null, error: null }),
        then: (resolve: (value: unknown) => void) => resolve({ error: state.updateError })
      }),
      update: (values: unknown) => {
        state.calls.updates.push(values);
        return query;
      }
    };
    return query;
  };
  const storage = {
    from: () => ({
      createSignedUrls: (paths: string[]) => {
        state.calls.signBatches += 1;
        return Promise.resolve({ data: paths.map(path => ({ path, signedUrl: `https://signed.test/${path}`, error: null })), error: null });
      },
      upload: (path: string) => {
        state.calls.uploads.push(path);
        return Promise.resolve({ error: null });
      },
      remove: (paths: string[]) => {
        state.calls.removed.push(paths);
        return Promise.resolve({ error: null });
      }
    })
  };
  return { supabase: { from, storage } };
});

import { patientPhotoUrl, removePatientPhoto, resetPatientPhotoCache, savePatientPhoto } from '../patientPhotoService';

beforeEach(() => {
  resetPatientPhotoCache();
  state.columnReady = true;
  state.updateError = null;
  state.rows = [{ id: P1, photo_path: photoOf(P1) }, { id: P2, photo_path: null }, { id: P3, photo_path: photoOf(P1) }];
  state.calls = { inQueries: 0, signBatches: 0, uploads: [], removed: [], updates: [] };
});

describe('showing photos in a list', () => {
  it('reads the photos of every row on screen with one query and one batch of links', async () => {
    const urls = await Promise.all([patientPhotoUrl(P1), patientPhotoUrl(P2), patientPhotoUrl(P1)]);
    expect(urls).toEqual([`https://signed.test/${photoOf(P1)}`, null, `https://signed.test/${photoOf(P1)}`]);
    expect(state.calls.inQueries).toBe(1);
    expect(state.calls.signBatches).toBe(1);
  });

  it('reuses the links while they still work, so scrolling back does not ask again', async () => {
    await patientPhotoUrl(P1);
    await patientPhotoUrl(P1);
    expect(state.calls.inQueries).toBe(1);
  });

  it("never signs a path that is not this patient's own photo (initials instead)", async () => {
    expect(await patientPhotoUrl(P3)).toBeNull();
  });

  it('asks nothing before the database has patients.photo_path: every patient keeps their initials', async () => {
    state.columnReady = false;
    expect(await patientPhotoUrl(P1)).toBeNull();
    expect(state.calls.inQueries).toBe(0);
  });
});

describe('storing a photo', () => {
  it("puts the new photo on the file and removes the previous photo's file", async () => {
    await savePatientPhoto({ practiceId: PRACTICE, patientId: P1, photo: new Blob(['x'], { type: 'image/jpeg' }) });
    expect(state.calls.uploads).toHaveLength(1);
    expect(state.calls.uploads[0]).toMatch(new RegExp(`^${PRACTICE}/patient-media/${P1}/photo-\\d+\\.jpg$`));
    expect(state.calls.updates).toEqual([{ photo_path: state.calls.uploads[0] }]);
    expect(state.calls.removed).toEqual([[photoOf(P1)]]);
    expect(await patientPhotoUrl(P1)).toBe(`https://signed.test/${state.calls.uploads[0]}`);
  });

  it('removes the upload again when the file could not take it, so storage holds no orphan photo', async () => {
    state.updateError = { code: '42501', message: 'refused' };
    await expect(savePatientPhoto({ practiceId: PRACTICE, patientId: P2, photo: new Blob(['x']) })).rejects.toBeTruthy();
    expect(state.calls.removed).toEqual([[state.calls.uploads[0]]]);
  });

  it('takes the photo off the file and shows the initials again', async () => {
    await removePatientPhoto(P1);
    expect(state.calls.updates).toEqual([{ photo_path: null }]);
    expect(state.calls.removed).toEqual([[photoOf(P1)]]);
    expect(await patientPhotoUrl(P1)).toBeNull();
  });
});
