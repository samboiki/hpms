// Unified Visit Type that handles both appointments and visits
export interface UnifiedVisit {
  id: string;
  patient_id: string;
  doctor_id: string | null;
  appointment_id: string | null;
  visit_date: string;
  visit_time: string;
  visit_type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  chief_complaint: string | null;
  diagnosis: string | null;
  treatment_plan: string | null;
  prescription: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  notes: string | null;
  status: 'scheduled' | 'in-progress' | 'completed' | 'cancelled';
  visit_number: number;
  created_at: string;
  updated_at: string;
  practice_id: string | null;
  encounter_date: string | null;
  
  // Relations
  doctor?: {
    id: string;
    full_name: string;
  };
  patient?: {
    id: string;
    first_name: string;
    last_name: string;
  };
}

// Helper functions
export const isScheduledVisit = (visit: UnifiedVisit): boolean => {
  return visit.status === 'scheduled';
};

export const isActiveVisit = (visit: UnifiedVisit): boolean => {
  return visit.status === 'in-progress';
};

export const isCompletedVisit = (visit: UnifiedVisit): boolean => {
  return visit.status === 'completed';
};

export const isCancelledVisit = (visit: UnifiedVisit): boolean => {
  return visit.status === 'cancelled';
};

// Convert appointment to visit (for migration)
export const appointmentToVisit = (appointment: any): Partial<UnifiedVisit> => {
  return {
    patient_id: appointment.patient_id,
    doctor_id: appointment.doctor_id,
    appointment_id: appointment.id,
    visit_date: appointment.date,
    visit_time: appointment.time,
    visit_type: appointment.type,
    chief_complaint: appointment.notes,
    status: 'scheduled',
    practice_id: appointment.practice_id,
  };
};