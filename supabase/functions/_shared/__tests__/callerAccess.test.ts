import { describe, it, expect } from 'vitest';
import {
  decidePlatformAccess,
  decidePracticeAccess,
  decideRecordAccess,
  decideStaffAccess,
  deniedResponse,
  hasServiceRoleKey,
  loadCaller,
  type Caller,
  type CallerLookupClient,
  type StaffRow
} from '../callerAccess';

// Invented ids and keys: none of these exist anywhere.
const PRACTICE_A = 'practice-a';
const PRACTICE_B = 'practice-b';
const SERVICE_KEY = 'service-key-for-tests';

const staff = (overrides: Partial<StaffRow> = {}): StaffRow => ({ practice_id: PRACTICE_A, is_active: true, is_super_admin: false, ...overrides });
const caller = (overrides: Partial<Caller> = {}): Caller => ({ isServiceKey: false, user: { id: 'user-1' }, staff: staff(), assignedPracticeIds: [], ...overrides });
const anonymous = caller({ user: null, staff: null });
const patientLogin = caller({ staff: null }); // patients sign in to the patient app but have no staff row
const platform = caller({ isServiceKey: true, user: null, staff: null });

// Functions that only machines call (queues, reminders, n8n) and the test tools run with the service role key.
describe('decidePlatformAccess', () => {
  it('lets queue processors, scheduled jobs and the SQL console run with the service role key', () => {
    expect(decidePlatformAccess(`Bearer ${SERVICE_KEY}`, SERVICE_KEY)).toEqual({ allowed: true });
  });

  it('refuses a signed-in staff token or the public anon key: they could otherwise run SQL or create users', () => {
    expect(decidePlatformAccess('Bearer some-staff-jwt', SERVICE_KEY)).toMatchObject({ allowed: false, status: 403 });
    expect(decidePlatformAccess(null, SERVICE_KEY)).toMatchObject({ allowed: false, status: 403 });
  });

  it('stays closed when the service role key is not set, so a misconfigured deploy cannot open it', () => {
    expect(decidePlatformAccess('Bearer ', '')).toMatchObject({ allowed: false, status: 403 });
    expect(decidePlatformAccess('Bearer anything', undefined)).toMatchObject({ allowed: false, status: 403 });
    expect(hasServiceRoleKey(null, undefined)).toBe(false);
  });

  it('does not accept a token that only starts like the service role key', () => {
    expect(hasServiceRoleKey(`Bearer ${SERVICE_KEY}-extra`, SERVICE_KEY)).toBe(false);
    expect(hasServiceRoleKey(`Bearer ${SERVICE_KEY.slice(0, 10)}`, SERVICE_KEY)).toBe(false);
  });
});

// Functions the app calls read patient data with the service role key, so the caller must be practice staff.
describe('decideStaffAccess', () => {
  it('refuses the public anon key alone (no signed-in user): anyone on the internet has it', () => {
    expect(decideStaffAccess(anonymous)).toMatchObject({ allowed: false, status: 401 });
  });

  it('refuses a patient login (no staff row), so a patient cannot search other patients', () => {
    expect(decideStaffAccess(patientLogin)).toMatchObject({ allowed: false, status: 403 });
  });

  it('refuses deactivated staff, who keep a valid login until it expires', () => {
    expect(decideStaffAccess(caller({ staff: staff({ is_active: false }) }))).toMatchObject({ allowed: false, status: 403 });
  });

  it('lets active staff in; a staff row without is_active set counts as active, as in the SMS gateway', () => {
    expect(decideStaffAccess(caller())).toEqual({ allowed: true });
    expect(decideStaffAccess(caller({ staff: staff({ is_active: null }) }))).toEqual({ allowed: true });
  });

  it("lets the platform's own functions in", () => {
    expect(decideStaffAccess(platform)).toEqual({ allowed: true });
  });
});

// Every practice's data sits in the same tables; the practice in the request decides what is read or changed.
describe('decidePracticeAccess', () => {
  it("refuses staff of practice A asking for practice B's data", () => {
    expect(decidePracticeAccess(caller(), PRACTICE_B)).toMatchObject({ allowed: false, status: 403 });
  });

  it('lets staff act for their own practice and for practices they are assigned to', () => {
    expect(decidePracticeAccess(caller(), PRACTICE_A)).toEqual({ allowed: true, practiceId: PRACTICE_A });
    expect(decidePracticeAccess(caller({ assignedPracticeIds: [PRACTICE_B] }), PRACTICE_B)).toEqual({ allowed: true, practiceId: PRACTICE_B });
  });

  it("uses the caller's own practice when the request names none", () => {
    expect(decidePracticeAccess(caller(), undefined)).toEqual({ allowed: true, practiceId: PRACTICE_A });
    expect(decidePracticeAccess(caller(), '   ')).toEqual({ allowed: true, practiceId: PRACTICE_A });
  });

  it("never trusts a practice id that is not plain text: it cannot be used to reach another practice", () => {
    expect(decidePracticeAccess(caller(), [PRACTICE_B])).toEqual({ allowed: true, practiceId: PRACTICE_A });
    expect(decidePracticeAccess(caller(), { id: PRACTICE_B })).toEqual({ allowed: true, practiceId: PRACTICE_A });
  });

  it('refuses staff linked to no practice when they name none (there is nothing they may act for)', () => {
    expect(decidePracticeAccess(caller({ staff: staff({ practice_id: null }) }), undefined)).toMatchObject({ allowed: false, status: 403 });
  });

  it('lets super admins act for any practice they name (platform support)', () => {
    const superAdmin = caller({ staff: staff({ practice_id: null, is_super_admin: true }) });
    expect(decidePracticeAccess(superAdmin, PRACTICE_B)).toEqual({ allowed: true, practiceId: PRACTICE_B });
    expect(decidePracticeAccess(superAdmin, undefined)).toEqual({ allowed: true, practiceId: null });
  });

  it('lets the platform act for the practice it names (automation queue, reminders)', () => {
    expect(decidePracticeAccess(platform, PRACTICE_B)).toEqual({ allowed: true, practiceId: PRACTICE_B });
    expect(decidePracticeAccess(platform, undefined)).toEqual({ allowed: true, practiceId: null });
  });

  it("refuses a patient login even when it names a real practice's id", () => {
    expect(decidePracticeAccess(patientLogin, PRACTICE_A)).toMatchObject({ allowed: false, status: 403 });
    expect(decidePracticeAccess(anonymous, PRACTICE_A)).toMatchObject({ allowed: false, status: 401 });
  });
});

// Records fetched by id (a patient's medical aid, a patient file) belong to the practice stored on the record.
describe('decideRecordAccess', () => {
  it("refuses staff of practice A reading the medical aid of a patient in practice B", () => {
    expect(decideRecordAccess(caller(), PRACTICE_B)).toMatchObject({ allowed: false, status: 403 });
  });

  it('lets staff read records of their own practice and of practices they are assigned to', () => {
    expect(decideRecordAccess(caller(), PRACTICE_A)).toEqual({ allowed: true });
    expect(decideRecordAccess(caller({ assignedPracticeIds: [PRACTICE_B] }), PRACTICE_B)).toEqual({ allowed: true });
  });

  it("never treats a record without a practice as the caller's own: only super admins and the platform may open it", () => {
    expect(decideRecordAccess(caller(), null)).toMatchObject({ allowed: false, status: 403 });
    expect(decideRecordAccess(caller({ staff: staff({ is_super_admin: true }) }), null)).toEqual({ allowed: true });
    expect(decideRecordAccess(platform, null)).toEqual({ allowed: true });
  });

  it('refuses a patient login that knows a patient id', () => {
    expect(decideRecordAccess(patientLogin, PRACTICE_A)).toMatchObject({ allowed: false, status: 403 });
  });
});

// A stand-in for the supabase-js client: users by token, staff rows and assignments by user id.
function fakeDb(data: {
  usersByToken?: Record<string, { id: string }>;
  staffByUser?: Record<string, Record<string, unknown>>;
  assignmentsByUser?: Record<string, Array<Record<string, unknown>>>;
}) {
  const lookups: string[] = [];
  const db: CallerLookupClient = {
    auth: {
      getUser: async (jwt: string) => {
        lookups.push('auth');
        return { data: { user: data.usersByToken?.[jwt] ?? null } };
      }
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_column: string, userId: string) => {
          lookups.push(table);
          const rows = table === 'users'
            ? (data.staffByUser?.[userId] ? [data.staffByUser[userId]] : [])
            : (data.assignmentsByUser?.[userId] ?? []);
          return Object.assign(Promise.resolve({ data: rows as unknown }), {
            maybeSingle: () => Promise.resolve({ data: (rows[0] ?? null) as unknown })
          });
        }
      })
    })
  };
  return { db, lookups };
}

describe('loadCaller', () => {
  it('recognises the service role key without looking anyone up', async () => {
    const { db, lookups } = fakeDb({});
    const found = await loadCaller(db, `Bearer ${SERVICE_KEY}`, SERVICE_KEY);
    expect(found.isServiceKey).toBe(true);
    expect(lookups).toEqual([]);
  });

  it('finds nobody behind the public anon key, so staff functions answer 401', async () => {
    const { db } = fakeDb({});
    const found = await loadCaller(db, 'Bearer public-anon-key', SERVICE_KEY);
    expect(found).toEqual({ isServiceKey: false, user: null, staff: null, assignedPracticeIds: [] });
    expect(decideStaffAccess(found)).toMatchObject({ status: 401 });
  });

  it('finds nobody without an Authorization header, without asking the auth server', async () => {
    const { db, lookups } = fakeDb({});
    expect((await loadCaller(db, null, SERVICE_KEY)).user).toBeNull();
    expect(lookups).toEqual([]);
  });

  it('finds a patient login as a user without a staff row, so staff functions refuse it', async () => {
    const { db } = fakeDb({ usersByToken: { 'patient-jwt': { id: 'patient-user' } } });
    const found = await loadCaller(db, 'Bearer patient-jwt', SERVICE_KEY);
    expect(found.user).toEqual({ id: 'patient-user' });
    expect(found.staff).toBeNull();
    expect(decideStaffAccess(found)).toMatchObject({ allowed: false, status: 403 });
  });

  it('reads the staff row and only the practice assignments that are not switched off', async () => {
    const { db } = fakeDb({
      usersByToken: { 'staff-jwt': { id: 'staff-user' } },
      staffByUser: { 'staff-user': { practice_id: PRACTICE_A, is_active: true, is_super_admin: false, role: 'admin' } },
      assignmentsByUser: { 'staff-user': [{ practice_id: PRACTICE_B, is_active: true }, { practice_id: 'practice-c', is_active: false }, { practice_id: null }] }
    });
    const found = await loadCaller(db, 'Bearer staff-jwt', SERVICE_KEY);
    // The role is read too: some functions (inviting staff) are for administrators only
    expect(found.staff).toEqual({ practice_id: PRACTICE_A, is_active: true, is_super_admin: false, role: 'admin' });
    expect(found.assignedPracticeIds).toEqual([PRACTICE_B]);
    expect(decidePracticeAccess(found, 'practice-c')).toMatchObject({ allowed: false, status: 403 });
  });
});

describe('deniedResponse', () => {
  it('answers with the status, the CORS headers and a plain message the app can show', async () => {
    const response = deniedResponse({ allowed: false, status: 403, error: 'Only active practice staff can use this.' }, { 'Access-Control-Allow-Origin': '*' });
    expect(response.status).toBe(403);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(await response.json()).toEqual({ success: false, error: 'Only active practice staff can use this.' });
  });
});
