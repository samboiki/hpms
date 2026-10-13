import { describe, expect, it, vi } from 'vitest';

const update = vi.hoisted(() => vi.fn());
vi.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'reception-1' } } } }) },
    from: () => ({ update }),
  },
}));

import { answerPortalRequest, normalizePortalRequestRow } from '../portalRequestsService';

const row = {
  id: 'q1',
  patient_id: 'p1',
  kind: 'reschedule',
  visit_id: 'v1',
  preferred_date: '2026-10-12',
  preferred_time: 'afternoon',
  message: null,
  status: 'pending',
  staff_note: null,
  handled_at: null,
  created_at: '2026-10-07T08:00:00Z',
  patient: { first_name: 'Maria', last_name: 'Nghipondoka' },
  visit: { scheduled_date: '2026-10-09', scheduled_time: '09:30:00', visit_date: null, visit_time: null },
  handler: null,
};

describe('patient app requests for reception', () => {
  it('shows who asked, for which appointment and which day they would like', () => {
    expect(normalizePortalRequestRow(row)).toMatchObject({
      patientName: 'Maria Nghipondoka',
      kind: 'reschedule',
      visitDate: '2026-10-09',
      visitTime: '09:30:00',
      preferredDate: '2026-10-12',
      preferredTime: 'afternoon',
      status: 'pending',
    });
    expect(normalizePortalRequestRow({ ...row, kind: 'refund' })).toBeNull();
  });

  it('asks for a reason before telling a patient "not possible": they read the note in their app', async () => {
    await expect(answerPortalRequest('q1', 'declined', '  ')).resolves.toMatchObject({ ok: false });
    expect(update).not.toHaveBeenCalled();
  });

  it('only answers a request that is still waiting (the patient may have withdrawn it)', async () => {
    const eq = vi.fn();
    const chain = { eq, select: vi.fn(async () => ({ data: [], error: null })) };
    eq.mockReturnValue(chain);
    update.mockReturnValue(chain);
    await expect(answerPortalRequest('q1', 'done', 'Booked for Tue 14 Oct at 09:30')).resolves.toMatchObject({ ok: false });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'done', staff_note: 'Booked for Tue 14 Oct at 09:30', handled_by: 'reception-1' }));
    expect(eq).toHaveBeenCalledWith('status', 'pending');
  });
});
