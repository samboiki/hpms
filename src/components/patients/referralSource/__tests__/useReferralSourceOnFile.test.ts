/**
 * "How did you hear about us?" on the patient form (owner's decision, 13 Oct 2026: editable on the patient file). The
 * form must never blank an answer it has not read yet (a save while the answer is still loading would wipe what
 * reception recorded at registration), and before the database has the columns it sends nothing at all.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const db = vi.hoisted(() => ({
  available: true,
  row: { referral_source: 'walk_in', referral_source_other: null } as Record<string, unknown> | null,
  release: null as null | (() => void)
}));

vi.mock('../../../forms/patientExtrasColumns', () => ({
  useReferralSourceColumns: () => db.available
}));

vi.mock('../../../../lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: () => new Promise(resolve => {
            db.release = () => resolve({ data: db.row, error: null });
          })
        })
      })
    })
  }
}));

import { useReferralSourceOnFile } from '../useReferralSourceOnFile';

afterEach(() => {
  db.available = true;
  db.release = null;
});

describe('the answer on the patient form', () => {
  it('sends nothing until the answer on the file has been read, then shows and saves it', async () => {
    const { result } = renderHook(() => useReferralSourceOnFile('patient-1'));
    expect(result.current.shown).toBe(false);
    expect(result.current.columns()).toEqual({});
    await waitFor(() => expect(db.release).not.toBeNull());
    await act(async () => db.release?.());
    await waitFor(() => expect(result.current.shown).toBe(true));
    expect(result.current.value).toEqual({ source: 'walk_in', other: '' });
    expect(result.current.columns()).toEqual({ referral_source: 'walk_in', referral_source_other: null });
  });

  it('saves a changed answer', async () => {
    const { result } = renderHook(() => useReferralSourceOnFile('patient-1'));
    await waitFor(() => expect(db.release).not.toBeNull());
    await act(async () => db.release?.());
    await waitFor(() => expect(result.current.shown).toBe(true));
    act(() => result.current.setValue({ source: 'radio_newspaper', other: '' }));
    expect(result.current.columns()).toEqual({ referral_source: 'radio_newspaper', referral_source_other: null });
  });

  it('asks and sends nothing before the database has the columns', () => {
    db.available = false;
    const { result } = renderHook(() => useReferralSourceOnFile('patient-1'));
    expect(result.current.shown).toBe(false);
    expect(result.current.columns()).toEqual({});
    expect(db.release).toBeNull();
  });
});
