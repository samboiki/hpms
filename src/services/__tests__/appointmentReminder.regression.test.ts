import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '../../lib/supabase';
import { AppointmentService } from '../appointmentService';

vi.mock('../../lib/supabase', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../communicationService', () => ({ communicationService: { sendSMS: vi.fn() } }));

describe('reminder failure handling', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns the lookup error and records the failure without referencing an unavailable reminder', async () => {
    const error = new Error('Reminder lookup failed');
    const lookup = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error }) };
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    vi.mocked(supabase.from).mockReturnValueOnce(lookup as never).mockReturnValueOnce({ update } as never);

    await expect(AppointmentService.sendReminder('reminder-1')).resolves.toEqual({ success: false, error });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', attempts: 1, error_message: error.message }));
  });

  it('preserves the existing attempt count when a later operation fails', async () => {
    const reminder = { attempts: 2, practice_id: 'practice-1', appointments: { patients: { notification_preferences: { reminders: true } }, users: {} } };
    const lookup = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: reminder, error: null }) };
    const error = new Error('Practice lookup failed');
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
    vi.mocked(supabase.from).mockReturnValueOnce(lookup as never).mockImplementationOnce(() => { throw error; }).mockReturnValueOnce({ update } as never);

    await expect(AppointmentService.sendReminder('reminder-1')).resolves.toEqual({ success: false, error });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ attempts: 3 }));
  });
});
