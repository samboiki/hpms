/**
 * Sending a staff member a new sign-in link: the invite function answers 404 itself when the email is not on the
 * practice's staff list. Reading every 404 as "invitations are not switched on" sent administrators to OneHealth
 * support for what was a mistyped email address.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('../../lib/supabase', () => ({ supabase: { functions: { invoke: mocks.invoke } } }));

import { resendStaffInvite } from '../staffInviteService';

const refused = (status: number, body: unknown) => ({
  data: null,
  error: Object.assign(new Error('Edge Function returned a non-2xx status code'), {
    context: new Response(body === null ? null : JSON.stringify(body), { status })
  })
});

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe('resendStaffInvite', () => {
  it('passes on the function\'s own reason for a 404 (no such staff member)', async () => {
    mocks.invoke.mockResolvedValue(refused(404, { success: false, error: 'No staff member with this email address is on your practice.' }));
    await expect(resendStaffInvite('practice-1', 'someone@example.test')).rejects.toThrow('No staff member with this email address is on your practice.');
  });

  it('says invitations are not switched on when the function itself is missing', async () => {
    mocks.invoke.mockResolvedValue(refused(404, null));
    await expect(resendStaffInvite('practice-1', 'someone@example.test')).rejects.toThrow(/not switched on yet/);
  });

  it('returns the confirmation to show when the link was sent', async () => {
    mocks.invoke.mockResolvedValue({ data: { success: true, message: 'Invitation sent to someone@example.test.' }, error: null });
    await expect(resendStaffInvite('practice-1', 'someone@example.test')).resolves.toBe('Invitation sent to someone@example.test.');
  });
});
