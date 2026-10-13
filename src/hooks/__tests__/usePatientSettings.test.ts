/**
 * Patients > Settings: "Patient settings saved" must mean the database changed. An update the access rules refuse
 * changes no row and returns no error, so the page used to say "saved" while the old settings stayed in force.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const db = vi.hoisted(() => ({
  updateRows: [{ id: 'settings-1' }] as unknown[],
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: () => {
      let updating = false;
      const builder: Record<string, unknown> = {};
      builder.select = () => builder;
      builder.eq = () => builder;
      builder.update = () => { updating = true; return builder; };
      builder.single = () => Promise.resolve({ data: { id: 'settings-1', setting_value: {} }, error: null });
      builder.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(updating ? { data: db.updateRows, error: null } : { data: null, error: null }).then(resolve);
      return builder;
    },
  },
}));
vi.mock('../../contexts/PracticeContext', () => ({
  usePractice: () => ({ practiceId: 'practice-1' }),
}));

import { usePatientSettings } from '../usePatientSettings';

describe('usePatientSettings save', () => {
  beforeEach(() => {
    db.updateRows = [{ id: 'settings-1' }];
  });

  it('reports a save the database refused (no row changed) as failed, not saved', async () => {
    db.updateRows = [];
    const { result } = renderHook(() => usePatientSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let saved = true;
    await act(async () => { saved = await result.current.saveSettings(result.current.settings); });
    expect(saved).toBe(false);
  });

  it('reports a save that changed the row as saved', async () => {
    const { result } = renderHook(() => usePatientSettings());
    await waitFor(() => expect(result.current.loading).toBe(false));
    let saved = false;
    await act(async () => { saved = await result.current.saveSettings(result.current.settings); });
    expect(saved).toBe(true);
  });
});
