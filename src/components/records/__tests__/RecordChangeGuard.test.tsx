/**
 * The "changed by someone else" sheet (parity Q12): a save after someone else's change never goes through silently;
 * the person sees who changed it and when, and each choice does what it says (Save mine anyway / Reload their version /
 * Back). A check that cannot be made (offline) never blocks a save. Invented ids and names only.
 */
import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OpenedVersion, VersionCheck } from '../../../services/recordVersion';

const { state } = vi.hoisted(() => ({
  state: {
    check: { state: 'unchanged' } as VersionCheck,
    checked: [] as OpenedVersion[][]
  }
}));

vi.mock('../../../lib/supabase', () => ({ supabase: {} }));
vi.mock('../../../stores/authStore', () => ({
  useAuthStore: (select: (value: { user: { id: string } }) => unknown) => select({ user: { id: 'me' } })
}));
vi.mock('../../../services/recordVersion', async importOriginal => ({
  ...(await importOriginal<typeof import('../../../services/recordVersion')>()),
  checkRecordVersions: async (opened: OpenedVersion[]) => {
    state.checked.push(opened);
    return state.check;
  },
  loadPeopleNames: async () => ({ u2: 'Test Reception' }),
  readRecordVersions: async () => new Map()
}));

import { useRecordChangeGuard, type SaveDecision } from '../RecordChangeGuard';

let guard: ReturnType<typeof useRecordChangeGuard>;
const Harness: React.FC = () => {
  guard = useRecordChangeGuard({ reload: 'The form shows the details as saved now.', save: 'Your form replaces the details as saved now.' });
  return <>{guard.dialog}</>;
};

const OPENED = '2026-10-13T08:00:00.000001+00:00';
const NEWER = '2026-10-13T08:30:00+00:00';
const changedByReception: VersionCheck = {
  state: 'changed',
  changes: [{ kind: 'patient', id: 'p1', at: NEWER, updatedBy: 'u2' }],
  current: [{ kind: 'patient', id: 'p1', updatedAt: NEWER }]
};

/** Starts a save and returns its decision once the person has chosen */
async function save(kinds?: Array<'patient' | 'visit' | 'invoice'>): Promise<{ decision: () => SaveDecision | undefined }> {
  let decision: SaveDecision | undefined;
  await act(async () => {
    void guard.confirmSave(kinds).then(value => { decision = value; });
  });
  return { decision: () => decision };
}

beforeEach(() => {
  state.check = { state: 'unchanged' };
  state.checked = [];
  render(<Harness />);
  act(() => guard.remember([{ kind: 'patient', id: 'p1', updatedAt: OPENED }, { kind: 'invoice', id: 'i1', updatedAt: OPENED }]));
});

describe('saving a record someone else changed first', () => {
  it('saves at once, with no sheet, when nobody changed it', async () => {
    const result = await save();
    expect(result.decision()).toBe('save');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('never blocks a save because the check could not be made (offline)', async () => {
    state.check = { state: 'not_checked', reason: 'Failed to fetch' };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const result = await save();
    expect(result.decision()).toBe('save');
    warn.mockRestore();
  });

  it('shows who changed it and when, and says plainly what each choice loses', async () => {
    state.check = changedByReception;
    const result = await save();
    expect(result.decision()).toBeUndefined();
    expect(screen.getByRole('dialog', { name: 'Changed by someone else' })).toBeInTheDocument();
    expect(screen.getByText(/^Test Reception changed this patient's details .* after you opened it\.$/)).toBeInTheDocument();
    expect(screen.getByText("Your form replaces the details as saved now. Test Reception's change is lost.")).toBeInTheDocument();
    expect(screen.getByText('The form shows the details as saved now.')).toBeInTheDocument();
  });

  it('"Save mine anyway" saves, and a second save does not ask again about the change already seen', async () => {
    state.check = changedByReception;
    const first = await save();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Save mine anyway' })));
    expect(first.decision()).toBe('save');
    expect(screen.queryByRole('dialog')).toBeNull();
    state.check = { state: 'unchanged' };
    await save();
    // The second check compares with the version the person chose to overwrite, not the one first opened
    expect(state.checked[1]).toEqual([{ kind: 'patient', id: 'p1', updatedAt: NEWER }, { kind: 'invoice', id: 'i1', updatedAt: OPENED }]);
  });

  it('"Reload their version" asks the screen to show the record as saved now', async () => {
    state.check = changedByReception;
    const result = await save();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Reload their version' })));
    expect(result.decision()).toBe('reload');
  });

  it('"Back" saves nothing and leaves the screen as it is', async () => {
    state.check = changedByReception;
    const result = await save();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(result.decision()).toBe('stop');
  });

  it('says a record deleted meanwhile cannot be saved, and offers only to go back', async () => {
    state.check = { state: 'gone', kind: 'patient' };
    const result = await save();
    expect(screen.getByRole('dialog', { name: 'No longer there' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save mine anyway' })).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Back' })));
    expect(result.decision()).toBe('stop');
  });

  it('compares only versions the screen actually loaded: an unknown one cannot be told apart from a change', async () => {
    act(() => guard.remember([{ kind: 'visit', id: 'v1', updatedAt: undefined }, { kind: 'invoice', id: 'i1', updatedAt: null }]));
    await save();
    expect(state.checked[0]).toEqual([{ kind: 'invoice', id: 'i1', updatedAt: null }]);
  });

  it('compares only what the save will write (the visit screen leaves out an invoice whose lines it keeps)', async () => {
    await save(['patient']);
    expect(state.checked[0]).toEqual([{ kind: 'patient', id: 'p1', updatedAt: OPENED }]);
  });
});
