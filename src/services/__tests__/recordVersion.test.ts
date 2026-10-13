/**
 * "Someone else changed this first" (parity Q12): a save must never silently overwrite a change made after the screen
 * opened the record. These tests pin the comparison (to the microsecond), what counts as gone, what is read when the
 * database cannot say who, and the words staff read. Invented ids and names only; nothing reaches Supabase.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { state } = vi.hoisted(() => ({
  state: {
    selects: [] as Array<{ table: string; columns: string }>,
    results: [] as Array<{ data: unknown[] | null; error: { code?: string; message: string } | null }>
  }
}));

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: (table: string) => ({
      select: (columns: string) => {
        state.selects.push({ table, columns });
        return { in: () => Promise.resolve(state.results.shift() ?? { data: [], error: null }) };
      }
    })
  }
}));

import {
  changedBy,
  changedWhen,
  checkRecordVersions,
  compareVersions,
  describeChanges,
  loadPeopleNames,
  lostChangeWords,
  readRecordVersions,
  stampMicros,
  versionKey,
  versionMoved,
  type CurrentVersion
} from '../recordVersion';

beforeEach(() => {
  state.selects = [];
  state.results = [];
});

const OPENED = '2026-10-13T08:15:31.123456+00:00';

describe('when a record counts as changed', () => {
  it('reads the database timestamp to the microsecond, whatever the time zone it is written in', () => {
    expect(stampMicros('2026-10-13T08:15:31.123456+00:00')).toBe(stampMicros('2026-10-13T10:15:31.123456+02:00'));
    expect(stampMicros('2026-10-13T08:15:31Z')).toBe(Date.parse('2026-10-13T08:15:31Z') * 1000);
    expect(stampMicros('not a time')).toBeNull();
  });

  it('treats two saves within the same millisecond as two versions (a Date would lose the microseconds)', () => {
    expect(versionMoved(OPENED, '2026-10-13T08:15:31.123457+00:00')).toBe(true);
  });

  it('does not warn when only the way the time is written differs', () => {
    expect(versionMoved(OPENED, '2026-10-13T10:15:31.123456+02:00')).toBe(false);
    expect(versionMoved(null, null)).toBe(false);
  });

  it('counts a first stamp on a row that had none as a change', () => {
    expect(versionMoved(null, OPENED)).toBe(true);
  });
});

describe('comparing what the screen opened with what is saved now', () => {
  const now = (entries: Array<[string, CurrentVersion]>) => new Map(entries);

  it('lets an untouched visit and invoice save as before', () => {
    const result = compareVersions(
      [{ kind: 'visit', id: 'v1', updatedAt: OPENED }, { kind: 'invoice', id: 'i1', updatedAt: OPENED }],
      now([[versionKey('visit', 'v1'), { updatedAt: OPENED, updatedBy: 'u1' }], [versionKey('invoice', 'i1'), { updatedAt: OPENED, updatedBy: 'u1' }]])
    );
    expect(result).toEqual({ state: 'unchanged' });
  });

  it('names only the record that moved (here the invoice, changed by reception) and keeps its new version', () => {
    const result = compareVersions(
      [{ kind: 'visit', id: 'v1', updatedAt: OPENED }, { kind: 'invoice', id: 'i1', updatedAt: OPENED }],
      now([[versionKey('visit', 'v1'), { updatedAt: OPENED, updatedBy: 'u1' }], [versionKey('invoice', 'i1'), { updatedAt: '2026-10-13T09:00:00+00:00', updatedBy: 'u2' }]])
    );
    expect(result).toEqual({
      state: 'changed',
      changes: [{ kind: 'invoice', id: 'i1', at: '2026-10-13T09:00:00+00:00', updatedBy: 'u2' }],
      current: [{ kind: 'visit', id: 'v1', updatedAt: OPENED }, { kind: 'invoice', id: 'i1', updatedAt: '2026-10-13T09:00:00+00:00' }]
    });
  });

  it('says a record deleted since it was opened is gone (an update would save nothing and still look saved)', () => {
    expect(compareVersions([{ kind: 'patient', id: 'p1', updatedAt: OPENED }], now([]))).toEqual({ state: 'gone', kind: 'patient' });
  });
});

describe('reading the versions', () => {
  it('reads who changed each record, one request per kind of record', async () => {
    state.results = [{ data: [{ id: 'p1', updated_at: OPENED, updated_by: 'u2' }], error: null }];
    const result = await readRecordVersions([{ kind: 'patient', id: 'p1' }]);
    expect(state.selects).toEqual([{ table: 'patients', columns: 'id, updated_at, updated_by' }]);
    expect(result.get(versionKey('patient', 'p1'))).toEqual({ updatedAt: OPENED, updatedBy: 'u2' });
  });

  it('still compares before the database records who (no updated_by column): the person is just not named', async () => {
    state.results = [
      { data: null, error: { code: '42703', message: 'column patients.updated_by does not exist' } },
      { data: [{ id: 'p1', updated_at: OPENED }], error: null }
    ];
    const result = await readRecordVersions([{ kind: 'patient', id: 'p1' }]);
    expect(state.selects.map(select => select.columns)).toEqual(['id, updated_at, updated_by', 'id, updated_at']);
    expect(result.get(versionKey('patient', 'p1'))).toEqual({ updatedAt: OPENED, updatedBy: undefined });
  });

  it('never stops a save because the check itself failed (offline): it reports "not checked" instead of throwing', async () => {
    state.results = [{ data: null, error: { code: '08006', message: 'Failed to fetch' } }];
    await expect(checkRecordVersions([{ kind: 'visit', id: 'v1', updatedAt: OPENED }])).resolves.toEqual({ state: 'not_checked', reason: 'There is no connection to OneHealth. Check the internet connection and try again' }); // plain words (owner, 13 Oct 2026)
  });

  it('asks nothing when the screen opened nothing to compare', async () => {
    await expect(checkRecordVersions([])).resolves.toEqual({ state: 'unchanged' });
    expect(state.selects).toEqual([]);
  });

  it('names colleagues from the staff list and leaves out anyone it cannot read', async () => {
    state.results = [{ data: [{ id: 'u2', full_name: ' Test Reception ' }], error: null }];
    await expect(loadPeopleNames(['u2', null, 'u2', 'x9'])).resolves.toEqual({ u2: 'Test Reception' });
    expect(state.selects).toEqual([{ table: 'users', columns: 'id, full_name' }]);
  });
});

describe('the words staff read', () => {
  const people = { meId: 'me', names: { u2: 'Test Reception' } };

  it('says who changed it: a colleague by name, the person themself, an automatic change, or someone outside the staff', () => {
    expect(changedBy('u2', people)).toBe('Test Reception');
    expect(changedBy('me', people)).toBe('You');
    expect(changedBy(null, people)).toBe('OneHealth (an automatic change)');
    expect(changedBy('portal-login', people)).toMatch(/not on the practice's staff list/);
    expect(changedBy(undefined, people)).toBe('Someone');
  });

  it('says when in Windhoek time: a change at 22:30 UTC is "today at 00:30" on the next Windhoek day', () => {
    const now = new Date('2026-10-13T08:00:00Z');
    expect(changedWhen('2026-10-12T22:30:00+00:00', now)).toBe('today at 00:30');
    expect(changedWhen('2026-10-12T08:05:00+00:00', now)).toBe('yesterday at 10:05');
    expect(changedWhen('2026-10-07T07:42:00+00:00', now)).toBe('on 7 Oct 2026 at 09:42');
    expect(changedWhen(null, now)).toBe('recently');
  });

  it('says plainly whose change "Save mine anyway" throws away', () => {
    const change = (updatedBy: string | null | undefined) => ({ kind: 'visit' as const, id: 'v1', at: OPENED, updatedBy });
    expect(lostChangeWords([change('u2')], people)).toBe("Test Reception's change is lost.");
    expect(lostChangeWords([change('me')], people)).toBe('Your other change is lost.');
    expect(lostChangeWords([change(null)], people)).toBe('The automatic change is lost.');
    expect(lostChangeWords([change('u2'), { ...change(null), kind: 'invoice' }], people)).toBe("Test Reception's change and the automatic change are lost.");
    expect(lostChangeWords([change('portal-login')], people)).toBe('That change is lost.');
  });

  it('tells a person who changed it in another window that it was them, so they do not suspect a colleague', () => {
    const now = new Date('2026-10-13T08:00:00Z');
    expect(describeChanges([
      { kind: 'visit', id: 'v1', at: '2026-10-13T07:42:00+00:00', updatedBy: 'u2' },
      { kind: 'patient', id: 'p1', at: '2026-10-13T07:50:00+00:00', updatedBy: 'me' },
      { kind: 'invoice', id: 'i1', at: '2026-10-13T07:55:00+00:00', updatedBy: null }
    ], people, now)).toEqual([
      'Test Reception changed this visit today at 09:42, after you opened it.',
      "You changed this patient's details today at 09:50, in another window or another part of OneHealth, after this screen opened it.",
      "OneHealth changed this visit's invoice automatically today at 09:55, after you opened it."
    ]);
  });
});
