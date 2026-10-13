import { supabase } from '../lib/supabase';
import { startOfDay, endOfDay, addMinutes, format, parse, isWithinInterval, setHours, setMinutes } from 'date-fns';
// The overlap rule lives in a pure module so the diary checks can use it without the Supabase client
import { APPOINTMENT_DURATION, visitOverlapsSlot, type ConflictVisit } from './diary/visitOverlap';

export { visitOverlapsSlot };
export type { ConflictVisit };

interface TimeSlot {
  start: Date;
  end: Date;
  available: boolean;
}

interface BusinessHours {
  start: string; // "08:00"
  end: string;   // "17:00"
  lunchStart?: string; // "12:00"
  lunchEnd?: string;   // "13:00"
}

const DEFAULT_BUSINESS_HOURS: BusinessHours = {
  start: "08:00",
  end: "17:00",
  lunchStart: "12:00",
  lunchEnd: "13:00"
};

/**
 * Opens a visit for an appointment, creating one if it doesn't exist
 * @param apptId Appointment ID
 * @returns Visit ID
 */
export async function openVisit(apptId: string): Promise<string> {
  const { data, error } = await supabase.rpc('ensure_visit', { _appt: apptId });
  
  if (error) {
    console.error('Error ensuring visit:', error);
    throw error;
  }
  
  return data as string;   // visit ID
}

/**
 * Generate time slots for a given date and doctor
 */
export async function generateTimeSlots(
  date: Date,
  doctorId: string,
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS
): Promise<TimeSlot[]> {
  const slots: TimeSlot[] = [];
  const dayStart = startOfDay(date);
  
  // Parse business hours
  const [startHour, startMin] = businessHours.start.split(':').map(Number);
  const [endHour, endMin] = businessHours.end.split(':').map(Number);
  const workStart = setMinutes(setHours(dayStart, startHour), startMin);
  const workEnd = setMinutes(setHours(dayStart, endHour), endMin);
  
  // Parse lunch hours if provided
  let lunchStart: Date | null = null;
  let lunchEnd: Date | null = null;
  if (businessHours.lunchStart && businessHours.lunchEnd) {
    const [lunchStartHour, lunchStartMin] = businessHours.lunchStart.split(':').map(Number);
    const [lunchEndHour, lunchEndMin] = businessHours.lunchEnd.split(':').map(Number);
    lunchStart = setMinutes(setHours(dayStart, lunchStartHour), lunchStartMin);
    lunchEnd = setMinutes(setHours(dayStart, lunchEndHour), lunchEndMin);
  }
  
  // Generate slots
  let currentTime = workStart;
  while (currentTime < workEnd) {
    const slotEnd = addMinutes(currentTime, APPOINTMENT_DURATION);
    
    // Skip lunch time
    const isDuringLunch = lunchStart && lunchEnd && 
      isWithinInterval(currentTime, { start: lunchStart, end: lunchEnd });
    
    if (!isDuringLunch && slotEnd <= workEnd) {
      slots.push({
        start: currentTime,
        end: slotEnd,
        available: true // Will be updated based on existing appointments
      });
    }
    
    currentTime = slotEnd;
  }
  
  // Check for existing appointments in both tables
  const dateStr = format(date, 'yyyy-MM-dd');
  
  const [appointmentsData, visitsData] = await Promise.all([
    supabase
      .from('appointments')
      .select('date, time, duration')
      .eq('doctor_id', doctorId)
      .eq('date', dateStr)
      .neq('status', 'cancelled'),
    // visits has no `duration` column (selecting it failed the query, so booked visits never blocked slots)
    supabase
      .from('visits')
      .select('id, visit_date, visit_time, scheduled_date, scheduled_time, status, is_cancelled')
      .eq('doctor_id', doctorId)
      .or(`scheduled_date.eq.${dateStr},visit_date.eq.${dateStr}`)
  ]);

  const { data: appointments } = appointmentsData;
  const visits = ((visitsData.data || []) as ConflictVisit[])
    .filter(visit => !visit.is_cancelled && !['cancelled', 'no-show'].includes(visit.status ?? ''))
    // Same date rule as visitOverlapsSlot. A visit rescheduled while only scheduled_* was updated
    // still matches its old day through visit_date, but it now takes place on scheduled_date.
    .filter(visit => (visit.scheduled_date || visit.visit_date || '').slice(0, 10) === dateStr);

  // Combine appointments from both sources
  const allAppointments = [
    ...(appointments || []).map(apt => ({ time: apt.time, duration: apt.duration })),
    ...visits.map(visit => ({ time: visit.scheduled_time || visit.visit_time, duration: APPOINTMENT_DURATION }))
  ];
  
  // Mark slots as unavailable if they have appointments
  allAppointments.forEach(appt => {
    if (appt.time) {
      const [hours, minutes] = appt.time.split(':').map(Number);
      const apptTime = setMinutes(setHours(dayStart, hours), minutes);
      const apptEnd = addMinutes(apptTime, appt.duration || APPOINTMENT_DURATION);
      
      slots.forEach(slot => {
        // Check if appointment overlaps with this slot
        if ((apptTime >= slot.start && apptTime < slot.end) ||
            (apptEnd > slot.start && apptEnd <= slot.end) ||
            (apptTime <= slot.start && apptEnd >= slot.end)) {
          slot.available = false;
        }
      });
    }
  });
  
  return slots;
}

/**
 * Check if a time slot conflicts with existing appointments
 */
export async function checkAppointmentConflict(
  doctorId: string,
  scheduledTime: Date,
  duration: number = APPOINTMENT_DURATION,
  excludeAppointmentId?: string
): Promise<boolean> {
  const dateStr = format(scheduledTime, 'yyyy-MM-dd');
  
  // Check both appointments and visits tables for conflicts
  const [appointmentsData, visitsData] = await Promise.all([
    supabase
      .from('appointments')
      .select('id, date, time, duration')
      .eq('doctor_id', doctorId)
      .eq('date', dateStr)
      .neq('status', 'cancelled'),
    // visits has no `duration` column: selecting it made this query fail silently, so clashes with
    // existing visits were never detected at save time.
    supabase
      .from('visits')
      .select('id, visit_date, visit_time, scheduled_date, scheduled_time, status, is_cancelled')
      .eq('doctor_id', doctorId)
      .or(`scheduled_date.eq.${dateStr},visit_date.eq.${dateStr}`)
  ]);

  if (visitsData.error) {
    console.error('Could not check visit conflicts:', visitsData.error);
    throw new Error("Could not check the doctor's availability. Please try again.");
  }

  const { data: appointments } = appointmentsData;
  const visits = (visitsData.data || []) as ConflictVisit[];
  
  // Filter out excluded appointments/visits
  const filteredAppointments = appointments?.filter(apt => apt.id !== excludeAppointmentId) || [];
  const filteredVisits = visits.filter(visit => visit.id !== excludeAppointmentId);
  
  if (filteredAppointments.length === 0 && filteredVisits.length === 0) {
    return false;
  }
  
  // Check for time conflicts
  const slotStart = scheduledTime;
  const slotEnd = addMinutes(scheduledTime, duration);
  
  // Check conflicts in both appointments and visits
  const hasAppointmentConflict = filteredAppointments.some(appt => {
    const [hours, minutes] = appt.time.split(':').map(Number);
    const apptStart = setMinutes(setHours(parse(appt.date, 'yyyy-MM-dd', new Date()), hours), minutes);
    const apptEnd = addMinutes(apptStart, appt.duration || APPOINTMENT_DURATION);
    
    // Check if times overlap
    return (slotStart < apptEnd && slotEnd > apptStart);
  });

  const hasVisitConflict = filteredVisits.some(visit => visitOverlapsSlot(visit, slotStart, duration));

  return hasAppointmentConflict || hasVisitConflict;
}

/**
 * Find next available appointment slot for a doctor
 */
export async function findNextAvailableSlot(
  doctorId: string,
  startDate: Date = new Date(),
  businessHours: BusinessHours = DEFAULT_BUSINESS_HOURS,
  maxDaysToSearch: number = 30
): Promise<TimeSlot | null> {
  let currentDate = startDate;
  const endSearchDate = addMinutes(startDate, maxDaysToSearch * 24 * 60);
  
  while (currentDate < endSearchDate) {
    const slots = await generateTimeSlots(currentDate, doctorId, businessHours);
    const availableSlot = slots.find(slot => slot.available && slot.start > new Date());
    
    if (availableSlot) {
      return availableSlot;
    }
    
    currentDate = addMinutes(currentDate, 24 * 60); // Next day
  }
  
  return null;
}

/**
 * Reschedule an appointment to a new time
 */
export async function rescheduleAppointment(
  appointmentId: string,
  newTime: Date,
  reason?: string
): Promise<{ success: boolean; error?: string }> {
  // First get the appointment details
  const { data: appointment } = await supabase
    .from('appointments')
    .select('doctor_id, patient_id')
    .eq('id', appointmentId)
    .single();
  
  if (!appointment) {
    return { success: false, error: 'Appointment not found' };
  }
  
  // Check for conflicts
  const hasConflict = await checkAppointmentConflict(
    appointment.doctor_id,
    newTime,
    APPOINTMENT_DURATION,
    appointmentId
  );
  
  if (hasConflict) {
    return { success: false, error: 'Time slot is not available' };
  }
  
  // Update the appointment
  const { error } = await supabase
    .from('appointments')
    .update({
      date: format(newTime, 'yyyy-MM-dd'),
      time: format(newTime, 'HH:mm'),
      notes: reason ? `Rescheduled: ${reason}` : undefined
    })
    .eq('id', appointmentId);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}

/**
 * Get appointment statistics for dashboard
 */
export async function getAppointmentStats(
  doctorId?: string,
  dateRange?: { start: Date; end: Date }
): Promise<{
  total: number;
  completed: number;
  pending: number;
  cancelled: number;
  noShow: number;
  completionRate: number;
}> {
  let query = supabase
    .from('appointments')
    .select('status', { count: 'exact' });
  
  if (doctorId) {
    query = query.eq('doctor_id', doctorId);
  }
  
  if (dateRange) {
    query = query
      .gte('date', format(dateRange.start, 'yyyy-MM-dd'))
      .lte('date', format(dateRange.end, 'yyyy-MM-dd'));
  }
  
  const { data: appointments, count } = await query;
  
  if (!appointments || !count) {
    return {
      total: 0,
      completed: 0,
      pending: 0,
      cancelled: 0,
      noShow: 0,
      completionRate: 0
    };
  }
  
  const statusCounts = appointments.reduce((acc, appt) => {
    acc[appt.status] = (acc[appt.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const completed = statusCounts['completed'] || 0;
  const total = count;
  const completionRate = total > 0 ? (completed / total) * 100 : 0;
  
  return {
    total,
    completed,
    pending: statusCounts['scheduled'] || 0,
    cancelled: statusCounts['cancelled'] || 0,
    noShow: statusCounts['no-show'] || 0,
    completionRate: Math.round(completionRate)
  };
}

/**
 * Bulk update appointment statuses
 */
export async function bulkUpdateAppointmentStatus(
  appointmentIds: string[],
  status: 'scheduled' | 'completed' | 'cancelled' | 'no-show'
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .in('id', appointmentIds);
  
  if (error) {
    return { success: false, error: error.message };
  }
  
  return { success: true };
}