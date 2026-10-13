/**
 * Patients > smart search. It sent every patient's id in one request: with a few hundred patients that request is too
 * long and was refused, and the refusal was read as "nobody matched", so staff saw "No patients matched" for a search
 * that had not run. Ids now go in chunks and a failed request is an error staff are told about.
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('../supabase', () => ({ supabase: {} }));

import { PATIENT_ID_CHUNK, patientIdsFound } from '../aiSearchFallback';

describe('patientIdsFound', () => {
  it('asks in chunks and joins what every chunk found', async () => {
    const ids = Array.from({ length: PATIENT_ID_CHUNK * 2 + 5 }, (_, index) => `p${index}`);
    const sizes: number[] = [];
    const found = await patientIdsFound(ids, async chunk => {
      sizes.push(chunk.length);
      return { data: [{ patient_id: chunk[0] }, { patient_id: null }], error: null };
    });
    expect(sizes).toEqual([PATIENT_ID_CHUNK, PATIENT_ID_CHUNK, 5]);
    expect([...found]).toEqual(['p0', `p${PATIENT_ID_CHUNK}`, `p${PATIENT_ID_CHUNK * 2}`]);
  });

  it('throws when a request fails instead of reporting that nobody matched', async () => {
    await expect(patientIdsFound(['p1'], async () => ({ data: null, error: { message: 'URI too long' } })))
      .rejects.toThrow(/could not be searched/);
  });
});
