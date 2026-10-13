import { describe, it, expect } from 'vitest';
import { bearerToken, decideGatewayAccess, type GatewayCaller } from '../smsGatewayAccess';

const PRACTICE = 'practice-a';
const staff = (overrides: Partial<NonNullable<GatewayCaller['staff']>> = {}) => ({ practice_id: PRACTICE, is_active: true, is_super_admin: false, ...overrides });
const caller = (overrides: Partial<GatewayCaller> = {}): GatewayCaller => ({ isServiceKey: false, user: { id: 'u1' }, staff: staff(), assignedPracticeIds: [], ...overrides });

// Every SMS is charged to a practice's bundle and goes to a real phone, so only the practice's own staff
// (or the platform's own functions) may send in its name.
describe('decideGatewayAccess', () => {
  it("lets the platform's own functions send (reminders, automation queue, reply auto-answers)", () => {
    expect(decideGatewayAccess(caller({ isServiceKey: true, user: null, staff: null }), PRACTICE)).toEqual({ allowed: true });
  });

  it('refuses a caller with only the public anon key (no signed-in user)', () => {
    expect(decideGatewayAccess(caller({ user: null, staff: null }), PRACTICE)).toMatchObject({ allowed: false, status: 401 });
  });

  it("lets staff send for their own practice, but not charge another practice's bundle", () => {
    expect(decideGatewayAccess(caller(), PRACTICE)).toEqual({ allowed: true });
    expect(decideGatewayAccess(caller(), 'practice-b')).toMatchObject({ allowed: false, status: 403 });
  });

  it('lets staff send for a practice they are assigned to', () => {
    expect(decideGatewayAccess(caller({ assignedPracticeIds: ['practice-b'] }), 'practice-b')).toEqual({ allowed: true });
  });

  it('refuses deactivated staff and signed-in users with no staff record (for example a future patient account)', () => {
    expect(decideGatewayAccess(caller({ staff: staff({ is_active: false }) }), PRACTICE)).toMatchObject({ allowed: false, status: 403 });
    expect(decideGatewayAccess(caller({ staff: null }), PRACTICE)).toMatchObject({ allowed: false, status: 403 });
  });

  it('lets super admins send for any practice (platform support)', () => {
    expect(decideGatewayAccess(caller({ staff: staff({ practice_id: 'other', is_super_admin: true }) }), PRACTICE)).toEqual({ allowed: true });
  });

  it('refuses when no practice is named', () => {
    expect(decideGatewayAccess(caller(), '')).toMatchObject({ allowed: false, status: 403 });
  });
});

describe('bearerToken', () => {
  it('reads the token from an Authorization header, any case', () => {
    expect(bearerToken('Bearer abc.def')).toBe('abc.def');
    expect(bearerToken('bearer   xyz ')).toBe('xyz');
  });

  it('returns null without a bearer token', () => {
    expect(bearerToken(null)).toBeNull();
    expect(bearerToken('Basic abc')).toBeNull();
  });
});
