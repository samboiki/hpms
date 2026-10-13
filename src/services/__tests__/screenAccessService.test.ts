import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, rpcMock } = vi.hoisted(() => ({ fromMock: vi.fn(), rpcMock: vi.fn() }));

// No database in unit tests
vi.mock('../../lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }));

import { CHOOSABLE_ROLES, GUARDED_SCREENS } from '../../utils/auth/screenAccess';
import {
  describeScreenAccessError,
  loadRolesInUse,
  loadScreenAccess,
  saveScreenAccess
} from '../screenAccessService';

/** A PostgREST query stand-in: every filter returns itself and awaiting it gives the result. */
function query(result: { data?: unknown; error?: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'limit']) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
    Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
  return { builder, calls };
}

const sqlList = (sql: string, name: string): string[] => {
  const list = new RegExp(`${name} constant text\\[\\] := ARRAY\\[([^\\]]*)\\]`).exec(sql);
  expect(list).not.toBeNull();
  return [...(list?.[1] ?? '').matchAll(/'([^']+)'/g)].map((match) => match[1]);
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the app offers exactly the screens and roles the database accepts', () => {
  // A screen or role the app offers but set_screen_access refuses would be a box that never saves; one the database
  // accepts but the app lacks could only be changed with SQL
  const sql = readFileSync('proposals/2026-10-08-screen-access.sql', 'utf8');

  it('lists the same screens as set_screen_access', () => {
    expect(sqlList(sql, 'v_screens')).toEqual(GUARDED_SCREENS.map((screen) => screen.key));
  });

  it('lists the same roles as set_screen_access (administrators are never a choice)', () => {
    expect(sqlList(sql, 'v_roles')).toEqual([...CHOOSABLE_ROLES]);
  });
});

describe('reading the practice choice', () => {
  it("reads the practice's own screen_access row", async () => {
    const read = query({ data: [{ setting_value: { finance: ['doctor'] } }] });
    fromMock.mockReturnValue(read.builder);
    await expect(loadScreenAccess('practice-1')).resolves.toEqual({ finance: ['doctor'] });
    expect(fromMock).toHaveBeenCalledWith('practice_settings');
    expect(read.calls).toContainEqual(['eq', ['practice_id', 'practice-1']]);
    expect(read.calls).toContainEqual(['eq', ['setting_key', 'screen_access']]);
  });

  // No row is the usual case (nobody chose yet): every role keeps opening Finance and Stock
  it('reads no row as nothing chosen', async () => {
    fromMock.mockReturnValue(query({ data: [] }).builder);
    await expect(loadScreenAccess('practice-1')).resolves.toEqual({});
  });

  // An unreadable choice must not count as "open": the route then asks to try again instead of showing the money
  it('throws when the choice cannot be read', async () => {
    fromMock.mockReturnValue(query({ error: { message: 'network down' } }).builder);
    await expect(loadScreenAccess('practice-1')).rejects.toThrow(/Could not read who can open Finance and Stock/);
  });

  // Only roles are needed to draw the boxes: names and contact details stay unread
  it("reads only the staff's roles and whether they are active", async () => {
    const read = query({ data: [{ role: 'receptionist', is_active: true }, { role: 'admin', is_active: true }] });
    fromMock.mockReturnValue(read.builder);
    await expect(loadRolesInUse('practice-1')).resolves.toEqual(['receptionist']);
    expect(read.calls).toContainEqual(['select', ['role, is_active']]);
  });
});

describe('saving goes through set_screen_access only', () => {
  it('sends the practice, the screen and the ticked roles, and keeps what the database stored', async () => {
    rpcMock.mockResolvedValue({ data: { finance: ['doctor'], stock: [] }, error: null });
    await expect(saveScreenAccess('practice-1', 'finance', ['doctor'])).resolves.toEqual({
      ok: true,
      access: { finance: ['doctor'], stock: [] }
    });
    expect(rpcMock).toHaveBeenCalledWith('set_screen_access', {
      p_practice_id: 'practice-1',
      p_screen: 'finance',
      p_roles: ['doctor']
    });
  });

  it('sends null to open a screen to every role again', async () => {
    rpcMock.mockResolvedValue({ data: {}, error: null });
    await saveScreenAccess('practice-1', 'stock', null);
    expect(rpcMock).toHaveBeenCalledWith('set_screen_access', expect.objectContaining({ p_screen: 'stock', p_roles: null }));
  });

  // Before the SQL is applied, or for someone who is not an administrator, the box must say why it did not save
  it('explains a refusal in plain words', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'Could not find the function' } });
    await expect(saveScreenAccess('practice-1', 'finance', [])).resolves.toEqual({
      ok: false,
      message: 'Not saved: screen access is not set up in the database yet.'
    });
    expect(describeScreenAccessError({ code: '42501' })).toBe("Not saved: only the practice's administrators can choose this.");
    expect(describeScreenAccessError({ message: 'timeout' })).toBe('Not saved: timeout');
  });
});
