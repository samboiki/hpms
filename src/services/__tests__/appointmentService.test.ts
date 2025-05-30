import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AppointmentService } from '../appointmentService';
import { SMSPortalService } from '../smsPortal';

// Mock Supabase
vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      single: vi.fn(),
      order: vi.fn().mockReturnThis(),
    })),
  },
}));

// Mock SMS Portal
vi.mock('../smsPortal', () => ({
  SMSPortalService: {
    replaceTemplateVariables: vi.fn((template, vars) => {
      let result = template;
      Object.entries(vars).forEach(([key, value]) => {
        result = result.replace(`{{${key}}}`, value as string);
      });
      return result;
    }),
  },
  createSMSService: vi.fn(),
}));

describe('AppointmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createAppointment', () => {
    it('should create a single appointment successfully', async () => {
      const mockAppointment = {
        id: 'test-id',
        patient_id: 'patient-123',
        doctor_id: 'doctor-456',
        date: '2025-02-01',
        time: '10:00:00',
        duration: 30,
        type: 'consultation',
      };

      const { supabase } = await import('../../lib/supabase');
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAppointment, error: null }),
      } as any);

      const result = await AppointmentService.createAppointment(
        {
          patient_id: 'patient-123',
          doctor_id: 'doctor-456',
          date: '2025-02-01',
          time: '10:00:00',
          duration: 30,
          type: 'consultation',
        },
        'practice-789'
      );

      expect(result.success).toBe(true);
      expect(result.appointment).toEqual(mockAppointment);
    });

    it('should create recurring appointments when specified', async () => {
      const mockAppointment = {
        id: 'parent-id',
        patient_id: 'patient-123',
        doctor_id: 'doctor-456',
        date: '2025-02-01',
        time: '10:00:00',
        duration: 30,
        type: 'follow-up',
        is_recurring: true,
        recurrence_rule: {
          frequency: 'weekly',
          interval: 1,
          count: 4,
        },
      };

      const { supabase } = await import('../../lib/supabase');
      
      // Mock parent appointment creation
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAppointment, error: null }),
      } as any));

      // Mock parent appointment fetch
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAppointment, error: null }),
      } as any));

      // Mock bulk insert for recurring appointments
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any));

      const result = await AppointmentService.createAppointment(
        {
          ...mockAppointment,
          is_recurring: true,
          recurrence_rule: {
            frequency: 'weekly',
            interval: 1,
            count: 4,
          },
        },
        'practice-789'
      );

      expect(result.success).toBe(true);
    });
  });

  describe('scheduleReminders', () => {
    it('should schedule reminders for future appointments', async () => {
      const appointmentId = 'appt-123';
      const mockAppointment = {
        id: appointmentId,
        date: '2025-02-01',
        time: '14:00:00',
        practice_id: 'practice-789',
        patients: { id: 'patient-123' },
        users: { id: 'doctor-456' },
      };

      const { supabase } = await import('../../lib/supabase');
      
      // Mock appointment fetch
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAppointment, error: null }),
      } as any));

      // Mock reminder insert
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any));

      const result = await AppointmentService.scheduleReminders(appointmentId, ['24h', '2h']);

      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThan(0);
    });

    it('should not schedule reminders for past appointments', async () => {
      const appointmentId = 'appt-past';
      const mockAppointment = {
        id: appointmentId,
        date: '2024-01-01', // Past date
        time: '14:00:00',
        practice_id: 'practice-789',
      };

      const { supabase } = await import('../../lib/supabase');
      
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAppointment, error: null }),
      } as any));

      const result = await AppointmentService.scheduleReminders(appointmentId, ['24h', '2h']);

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
    });
  });

  describe('SMSPortalService', () => {
    it('should validate SMS content correctly', () => {
      const shortMessage = 'Hello, this is a test message';
      const result = SMSPortalService.validateSMSContent(shortMessage);
      
      expect(result.valid).toBe(true);
      expect(result.messageCount).toBe(1);
      expect(result.characterCount).toBe(shortMessage.length);
    });

    it('should reject empty messages', () => {
      const result = SMSPortalService.validateSMSContent('');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    it('should reject messages that are too long', () => {
      const longMessage = 'a'.repeat(1000);
      const result = SMSPortalService.validateSMSContent(longMessage);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('too long');
    });

    it('should calculate correct message count for multi-part SMS', () => {
      const message = 'a'.repeat(200); // More than 160 chars
      const result = SMSPortalService.validateSMSContent(message);
      
      expect(result.valid).toBe(true);
      expect(result.messageCount).toBe(2); // Should be split into 2 messages
    });

    it('should replace template variables correctly', () => {
      const template = 'Hi {{patient_name}}, your appointment with Dr. {{doctor_name}} is at {{time}}';
      const variables = {
        patient_name: 'John Doe',
        doctor_name: 'Smith',
        time: '2:00 PM',
      };
      
      const result = SMSPortalService.replaceTemplateVariables(template, variables);
      
      expect(result).toBe('Hi John Doe, your appointment with Dr. Smith is at 2:00 PM');
    });
  });

  describe('cancelAppointment', () => {
    it('should cancel appointment and its reminders', async () => {
      const appointmentId = 'appt-cancel';
      
      const { supabase } = await import('../../lib/supabase');
      
      // Mock appointment update
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as any));

      // Mock reminder cancellation
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as any));

      // Mock appointment fetch for waitlist check
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { 
            id: appointmentId,
            practice_id: 'practice-789',
            doctor_id: 'doctor-456',
            date: '2025-02-01',
            time: '14:00:00',
          }, 
          error: null 
        }),
      } as any));

      // Mock waitlist check
      vi.mocked(supabase.from).mockImplementationOnce(() => ({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any));

      const result = await AppointmentService.cancelAppointment(appointmentId, 'Patient request');

      expect(result.success).toBe(true);
    });
  });

  describe('addToWaitlist', () => {
    it('should add patient to waitlist successfully', async () => {
      const waitlistData = {
        patient_id: 'patient-123',
        doctor_id: 'doctor-456',
        appointment_type: 'consultation',
        duration: 30,
        preferred_dates: [{ start: '2025-02-01', end: '2025-02-28' }],
        priority: 'normal' as const,
      };

      const { supabase } = await import('../../lib/supabase');
      
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: { ...waitlistData, id: 'waitlist-123' }, 
          error: null 
        }),
      } as any);

      const result = await AppointmentService.addToWaitlist(waitlistData, 'practice-789');

      expect(result.success).toBe(true);
      expect(result.entry).toHaveProperty('id');
    });
  });
});