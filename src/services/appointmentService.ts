import { supabase } from '../lib/supabase';
import { format, parse, addDays, addWeeks, addMonths, subHours, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { communicationService } from './communicationService';

interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly';
  interval: number;
  count?: number;
  endDate?: string;
  daysOfWeek?: number[]; // 0-6, Sunday-Saturday
  dayOfMonth?: number;
}

interface AppointmentData {
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  notes?: string;
  is_recurring?: boolean;
  recurrence_rule?: RecurrenceRule;
  reminder_settings?: {
    enabled: boolean;
    timing: string[];
  };
}

interface WaitlistEntry {
  patient_id: string;
  doctor_id?: string;
  appointment_type: string;
  duration: number;
  preferred_dates: Array<{ start: string; end: string }>;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  notes?: string;
}

export class AppointmentService {
  /**
   * Replace template variables with actual values
   */
  static replaceTemplateVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    Object.entries(variables).forEach(([key, value]) => {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), value);
    });
    return result;
  }

  /**
   * Create a single or recurring appointment
   */
  static async createAppointment(data: AppointmentData, practiceId: string) {
    try {
      // Create the main appointment
      const { data: appointment, error } = await supabase
        .from('appointments')
        .insert({
          ...data,
          practice_id: practiceId,
          status: 'scheduled',
          recurrence_rule: data.recurrence_rule ? JSON.stringify(data.recurrence_rule) : null,
        })
        .select()
        .single();

      if (error) throw error;

      // If recurring, generate future appointments
      if (data.is_recurring && data.recurrence_rule) {
        await this.generateRecurringAppointments(appointment.id, data.recurrence_rule);
      }

      // Schedule reminders
      if (data.reminder_settings?.enabled) {
        await this.scheduleReminders(appointment.id, data.reminder_settings.timing);
      }

      return { success: true, appointment };
    } catch (error) {
      console.error('Error creating appointment:', error);
      return { success: false, error };
    }
  }

  /**
   * Generate recurring appointments based on recurrence rule
   */
  static async generateRecurringAppointments(parentId: string, rule: RecurrenceRule) {
    try {
      // Get the parent appointment
      const { data: parent, error: parentError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', parentId)
        .single();

      if (parentError) throw parentError;

      const appointments = [];
      let currentDate = parse(parent.date, 'yyyy-MM-dd', new Date());
      let count = 0;
      const maxCount = rule.count || 52; // Default to 1 year weekly
      const endDate = rule.endDate ? parse(rule.endDate, 'yyyy-MM-dd', new Date()) : addMonths(currentDate, 12);

      while (count < maxCount && currentDate <= endDate) {
        // Calculate next date based on frequency
        switch (rule.frequency) {
          case 'daily':
            currentDate = addDays(currentDate, rule.interval);
            break;
          case 'weekly':
            currentDate = addWeeks(currentDate, rule.interval);
            break;
          case 'monthly':
            currentDate = addMonths(currentDate, rule.interval);
            break;
        }

        // Skip if past end date
        if (currentDate > endDate) break;

        // Create appointment data
        const newAppointment = {
          ...parent,
          id: undefined,
          date: format(currentDate, 'yyyy-MM-dd'),
          recurrence_parent_id: parentId,
          created_at: undefined,
          updated_at: undefined,
        };

        appointments.push(newAppointment);
        count++;
      }

      // Bulk insert
      if (appointments.length > 0) {
        const { error } = await supabase
          .from('appointments')
          .insert(appointments);

        if (error) throw error;

        // Schedule reminders for all recurring appointments
        for (const apt of appointments) {
          if (parent.reminder_settings?.enabled) {
            await this.scheduleReminders(apt.id, parent.reminder_settings.timing);
          }
        }
      }

      return { success: true, count: appointments.length };
    } catch (error) {
      console.error('Error generating recurring appointments:', error);
      return { success: false, error };
    }
  }

  /**
   * Schedule reminders for an appointment
   */
  static async scheduleReminders(appointmentId: string, timings: string[]) {
    try {
      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .select('*, patients(*), users!doctor_id(*), practices(*)')
        .eq('id', appointmentId)
        .single();

      if (aptError) throw aptError;

      const reminders = [];
      const appointmentDateTime = new Date(`${appointment.date}T${appointment.time}`);

      for (const timing of timings) {
        let scheduledFor: Date;
        
        switch (timing) {
          case '24h':
            scheduledFor = subHours(appointmentDateTime, 24);
            break;
          case '2h':
            scheduledFor = subHours(appointmentDateTime, 2);
            break;
          case '1h':
            scheduledFor = subHours(appointmentDateTime, 1);
            break;
          case '30m':
            scheduledFor = subHours(appointmentDateTime, 0.5);
            break;
          default:
            continue;
        }

        // Only schedule if in the future
        if (scheduledFor > new Date()) {
          reminders.push({
            appointment_id: appointmentId,
            reminder_type: timing,
            scheduled_for: scheduledFor.toISOString(),
            practice_id: appointment.practice_id,
            status: 'pending',
          });
        }
      }

      if (reminders.length > 0) {
        const { error } = await supabase
          .from('appointment_reminders')
          .insert(reminders);

        if (error) throw error;
      }

      return { success: true, count: reminders.length };
    } catch (error) {
      console.error('Error scheduling reminders:', error);
      return { success: false, error };
    }
  }

  /**
   * Send appointment reminder
   */
  static async sendReminder(reminderId: string) {
    try {
      // Get reminder details
      const { data: reminder, error: reminderError } = await supabase
        .from('appointment_reminders')
        .select(`
          *,
          appointments(
            *,
            patients(*),
            users!doctor_id(*)
          )
        `)
        .eq('id', reminderId)
        .single();

      if (reminderError) throw reminderError;

      const appointment = reminder.appointments;
      const patient = appointment.patients;
      const doctor = appointment.users;

      // Get practice settings
      const { data: practice } = await supabase
        .from('practices')
        .select('*')
        .eq('id', reminder.practice_id)
        .single();

      // Check patient preferences
      if (!patient.notification_preferences?.reminders) {
        await supabase
          .from('appointment_reminders')
          .update({ status: 'cancelled' })
          .eq('id', reminderId);
        return { success: true, sent: false, reason: 'Patient opted out' };
      }

      // Get reminder template
      const { data: template } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('practice_id', reminder.practice_id)
        .eq('type', 'appointment_reminder')
        .eq('timing', reminder.reminder_type)
        .eq('is_active', true)
        .single();

      if (!template) {
        throw new Error('No active reminder template found');
      }

      // Prepare variables
      const variables = {
        patient_name: `${patient.first_name} ${patient.last_name}`,
        doctor_name: doctor.user_metadata?.full_name || 'Doctor',
        appointment_date: format(new Date(appointment.date), 'MMMM d, yyyy'),
        appointment_time: format(parse(appointment.time, 'HH:mm:ss', new Date()), 'h:mm a'),
        practice_name: practice?.name || 'the clinic',
      };

      // Replace template variables
      const messageContent = this.replaceTemplateVariables(template.content, variables);

      // Send SMS if enabled
      if (practice?.notification_settings?.sms?.enabled && patient.cell_number) {
        const result = await communicationService.sendSMS({
          practiceId: practice.id,
          recipientPhone: patient.cell_number,
          messageContent: messageContent,
          messageType: 'appointment_reminder',
          patientId: patient.id,
          appointmentId: appointment.id,
          metadata: {
            reminderId: reminderId,
            appointmentDate: appointment.date,
            appointmentTime: appointment.time,
            doctorName: doctor.user_metadata?.full_name || 'Doctor'
          }
        });

        if (result.success) {
          // Create message record
          const { data: message } = await supabase
            .from('messages')
            .insert({
              type: 'sms',
              recipient: patient.cell_number,
              content: messageContent,
                status: 'sent',
                sent_at: new Date().toISOString(),
                practice_id: reminder.practice_id,
                metadata: {
                  appointment_id: appointment.id,
                  reminder_id: reminderId,
                  sms_message_id: result.messageId,
                },
              })
              .select()
              .single();

            // Update reminder status
            await supabase
              .from('appointment_reminders')
              .update({
                status: 'sent',
                message_id: message?.id,
                updated_at: new Date().toISOString(),
              })
              .eq('id', reminderId);

            // Update appointment
            await supabase
              .from('appointments')
              .update({ reminder_sent_at: new Date().toISOString() })
              .eq('id', appointment.id);

            return { success: true, sent: true, messageId: result.messageId };
          } else {
            // Update reminder with error
            await supabase
              .from('appointment_reminders')
              .update({
                status: 'failed',
                error_message: result.error,
                attempts: reminder.attempts + 1,
                last_attempt_at: new Date().toISOString(),
              })
              .eq('id', reminderId);

            return { success: false, error: result.error };
          }
        }
      }

      // TODO: Send email if enabled and patient has email

      return { success: true, sent: false, reason: 'No SMS service configured' };
    } catch (error) {
      console.error('Error sending reminder:', error);
      
      // Update reminder status
      await supabase
        .from('appointment_reminders')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          attempts: reminder.attempts + 1,
          last_attempt_at: new Date().toISOString(),
        })
        .eq('id', reminderId);

      return { success: false, error };
    }
  }

  /**
   * Process pending reminders
   */
  static async processPendingReminders() {
    try {
      // Get all pending reminders that should be sent now
      const { data: reminders, error } = await supabase
        .from('appointment_reminders')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', new Date().toISOString())
        .lt('attempts', 3); // Max 3 attempts

      if (error) throw error;

      const results = [];
      for (const reminder of reminders || []) {
        const result = await this.sendReminder(reminder.id);
        results.push({ reminderId: reminder.id, ...result });
      }

      return { success: true, processed: results.length, results };
    } catch (error) {
      console.error('Error processing reminders:', error);
      return { success: false, error };
    }
  }

  /**
   * Add patient to waitlist
   */
  static async addToWaitlist(data: WaitlistEntry, practiceId: string) {
    try {
      const { data: entry, error } = await supabase
        .from('appointment_waitlist')
        .insert({
          ...data,
          practice_id: practiceId,
          status: 'waiting',
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days
        })
        .select()
        .single();

      if (error) throw error;

      return { success: true, entry };
    } catch (error) {
      console.error('Error adding to waitlist:', error);
      return { success: false, error };
    }
  }

  /**
   * Check waitlist when appointment is cancelled
   */
  static async checkWaitlistForSlot(appointmentId: string) {
    try {
      // Get cancelled appointment details
      const { data: appointment, error: aptError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (aptError) throw aptError;

      // Find matching waitlist entries
      const { data: waitlistEntries, error: waitError } = await supabase
        .from('appointment_waitlist')
        .select('*, patients(*)')
        .eq('status', 'waiting')
        .eq('practice_id', appointment.practice_id)
        .order('priority')
        .order('created_at');

      if (waitError) throw waitError;

      // Filter by preferences
      const matchingEntries = waitlistEntries?.filter(entry => {
        // Check doctor preference
        if (entry.doctor_id && entry.doctor_id !== appointment.doctor_id) {
          return false;
        }

        // Check date preferences
        if (entry.preferred_dates.length > 0) {
          const appointmentDate = new Date(appointment.date);
          return entry.preferred_dates.some((range: any) => {
            const start = new Date(range.start);
            const end = new Date(range.end);
            return isWithinInterval(appointmentDate, { start, end });
          });
        }

        return true;
      });

      // Notify first matching patient
      if (matchingEntries && matchingEntries.length > 0) {
        const selected = matchingEntries[0];
        
        // Update waitlist status
        await supabase
          .from('appointment_waitlist')
          .update({
            status: 'notified',
            notified_at: new Date().toISOString(),
          })
          .eq('id', selected.id);

        // Send notification
        await this.sendWaitlistNotification(selected, appointment);

        return { success: true, notified: selected.patient_id };
      }

      return { success: true, notified: null };
    } catch (error) {
      console.error('Error checking waitlist:', error);
      return { success: false, error };
    }
  }

  /**
   * Send waitlist notification
   */
  static async sendWaitlistNotification(waitlistEntry: any, appointment: any) {
    try {
      // Get practice settings
      const { data: practice } = await supabase
        .from('practices')
        .select('*')
        .eq('id', waitlistEntry.practice_id)
        .single();

      // Get doctor info
      const { data: doctor } = await supabase
        .from('users')
        .select('*')
        .eq('id', appointment.doctor_id)
        .single();

      // Get template
      const { data: template } = await supabase
        .from('reminder_templates')
        .select('*')
        .eq('practice_id', waitlistEntry.practice_id)
        .eq('type', 'waitlist_notification')
        .eq('is_active', true)
        .single();

      if (!template) return;

      // Prepare variables
      const variables = {
        patient_name: `${waitlistEntry.patients.first_name} ${waitlistEntry.patients.last_name}`,
        doctor_name: doctor?.user_metadata?.full_name || 'Doctor',
        date: format(new Date(appointment.date), 'MMMM d, yyyy'),
        time: format(parse(appointment.time, 'HH:mm:ss', new Date()), 'h:mm a'),
      };

      const messageContent = this.replaceTemplateVariables(template.content, variables);

      // Send SMS
      if (practice?.notification_settings?.sms?.enabled && waitlistEntry.patients.cell_number) {
        await communicationService.sendSMS({
          practiceId: practice.id,
          recipientPhone: waitlistEntry.patients.cell_number,
          messageContent: messageContent,
          messageType: 'appointment_reminder',
          patientId: waitlistEntry.patient_id,
          appointmentId: appointment.id,
          metadata: {
            waitlistId: waitlistEntry.id,
            appointmentDate: appointment.date,
            appointmentTime: appointment.time,
            doctorName: doctor?.user_metadata?.full_name || 'Doctor',
            source: 'waitlist_notification'
          }
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error sending waitlist notification:', error);
      return { success: false, error };
    }
  }

  /**
   * Cancel appointment and check waitlist
   */
  static async cancelAppointment(appointmentId: string, reason?: string) {
    try {
      // Update appointment status
      const { error: updateError } = await supabase
        .from('appointments')
        .update({
          status: 'cancelled',
          notes: reason ? `Cancelled: ${reason}` : undefined,
          updated_at: new Date().toISOString(),
        })
        .eq('id', appointmentId);

      if (updateError) throw updateError;

      // Cancel any pending reminders
      await supabase
        .from('appointment_reminders')
        .update({ status: 'cancelled' })
        .eq('appointment_id', appointmentId)
        .eq('status', 'pending');

      // Check waitlist for this slot
      const waitlistResult = await this.checkWaitlistForSlot(appointmentId);

      return { success: true, waitlistNotified: waitlistResult.notified };
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      return { success: false, error };
    }
  }
}