// Enhanced Visit Type with scheduling properties
export interface Visit {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  visit_date: string;
  visit_time: string;
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  chief_complaint: string | null;
  history_of_present_illness: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  follow_up_instructions: string | null;
  notes: string | null;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  visit_number: number;
  created_at: string;
  updated_at: string;
  practice_id: string | null;
  
  // New scheduling properties
  is_scheduled: boolean;
  is_confirmed: boolean;
  is_ready: boolean;
  is_checked_in: boolean;
  is_cancelled: boolean;
  is_no_show: boolean;
  scheduled_date: string | null;
  scheduled_time: string | null;
  /** Booked length in minutes; null = the practice's default for the visit type (src/utils/diary/bookingLength.ts) */
  duration_minutes?: number | null;
  /** The practice's own booking status (src/utils/diary/diaryStatuses.ts); null = none */
  diary_status_id?: string | null;
  /** The practice's appointment type the booking was made as (src/utils/diary/appointmentTypes.ts); null = none */
  appointment_type_id?: string | null;
  /** A video consultation's room link (src/utils/diary/videoBookings.ts); null = seen in the rooms */
  video_link?: string | null;

  // Relations
  doctor?: {
    id: string;
    full_name: string;
    role: string;
  };
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number?: string;
    email?: string;
    date_of_birth?: string;
  };
  practice?: {
    id: string;
    name: string;
  };
  vitals?: any;
  lab_results?: any[];
  media_requests?: any[];
}

// Visit state helper functions
export const isUnconfirmedBooking = (visit: Visit): boolean => {
  return visit.is_scheduled && !visit.is_confirmed && !visit.is_cancelled;
};

export const isConfirmedVisit = (visit: Visit): boolean => {
  return visit.is_confirmed && !visit.is_checked_in && !visit.is_cancelled;
};

export const isCheckedIn = (visit: Visit): boolean => {
  return visit.is_checked_in && !visit.is_ready && !visit.is_cancelled;
};

export const isReadyForDoctor = (visit: Visit): boolean => {
  return visit.is_ready && visit.status !== 'in-progress';
};

export const isInProgress = (visit: Visit): boolean => {
  return visit.status === 'in-progress';
};

export const isCompleted = (visit: Visit): boolean => {
  return visit.status === 'completed';
};

export const isCancelled = (visit: Visit): boolean => {
  return visit.is_cancelled || visit.status === 'cancelled';
};

export const isNoShow = (visit: Visit): boolean => {
  return visit.is_no_show || visit.status === 'no-show';
};

// Get display status for UI
export const getVisitDisplayStatus = (visit: Visit): {
  label: string;
  color: string;
  bgColor: string;
  icon?: string;
} => {
  if (isUnconfirmedBooking(visit)) {
    return {
      label: 'Unconfirmed',
      color: 'text-orange-700',
      bgColor: 'bg-orange-100',
      icon: 'alert-circle'
    };
  }
  
  if (isConfirmedVisit(visit)) {
    return {
      label: 'Scheduled',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      icon: 'calendar'
    };
  }
  
  if (isCheckedIn(visit)) {
    return {
      label: 'Checked In',
      color: 'text-green-700',
      bgColor: 'bg-green-100',
      icon: 'user-check'
    };
  }
  
  if (isReadyForDoctor(visit)) {
    return {
      label: 'Ready',
      color: 'text-green-700',
      bgColor: 'bg-green-100 animate-pulse',
      icon: 'activity'
    };
  }
  
  if (visit.is_handoff && visit.status !== 'completed') {
    return {
      label: 'Handed Off',
      color: 'text-purple-700',
      bgColor: 'bg-purple-100',
      icon: 'activity'
    };
  }
  
  if (isInProgress(visit)) {
    return {
      label: 'In Progress',
      color: 'text-blue-700',
      bgColor: 'bg-blue-100',
      icon: 'play'
    };
  }
  
  if (isCompleted(visit)) {
    return {
      label: 'Completed',
      color: 'text-gray-700',
      bgColor: 'bg-gray-100',
      icon: 'check-circle'
    };
  }
  
  if (isCancelled(visit)) {
    return {
      label: 'Cancelled',
      color: 'text-red-700',
      bgColor: 'bg-red-100',
      icon: 'x-circle'
    };
  }
  
  if (isNoShow(visit)) {
    return {
      label: 'No Show',
      color: 'text-amber-700',
      bgColor: 'bg-amber-100',
      icon: 'user-x'
    };
  }
  
  return {
    label: 'Unknown',
    color: 'text-gray-700',
    bgColor: 'bg-gray-100'
  };
};

// Get next allowed actions for a visit
export const getVisitActions = (visit: Visit): string[] => {
  const actions: string[] = [];
  
  if (isUnconfirmedBooking(visit)) {
    actions.push('confirm', 'reject', 'reschedule');
  }
  
  if (isConfirmedVisit(visit)) {
    actions.push('check-in', 'reschedule', 'cancel', 'no-show');
  }
  
  if (isCheckedIn(visit)) {
    actions.push('mark-ready', 'start-visit', 'cancel');
  }
  
  if (isReadyForDoctor(visit)) {
    actions.push('start-visit', 'cancel');
  }
  
  if (isInProgress(visit) && !visit.is_handoff) {
    actions.push('handoff', 'complete', 'add-notes', 'add-vitals');
  }
  
  if (visit.is_handoff && visit.status !== 'completed') {
    actions.push('complete', 'generate-invoice');
  }
  
  if (isCompleted(visit)) {
    actions.push('view-details', 'generate-invoice', 'send-followup');
  }
  
  return actions;
};

// Convert appointment to enhanced visit
export const appointmentToEnhancedVisit = (appointment: any): Partial<Visit> => {
  return {
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    scheduled_date: appointment.date,
    scheduled_time: appointment.time,
    visit_type: appointment.type || 'consultation',
    notes: appointment.notes,
    practice_id: appointment.practice_id,
    is_scheduled: true,
    is_confirmed: appointment.status !== 'pending',
    is_ready: appointment.status === 'ready',
    is_checked_in: appointment.status === 'ready' || appointment.status === 'in-progress',
    is_cancelled: appointment.status === 'cancelled',
    is_no_show: appointment.status === 'no-show',
    status: appointment.status === 'scheduled' ? 'scheduled' : appointment.status,
  };
};

// Type guards
export const isVisit = (obj: any): obj is Visit => {
  return obj && typeof obj.id === 'string' && typeof obj.patient_id === 'string';
};