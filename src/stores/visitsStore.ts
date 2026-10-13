import { create } from 'zustand';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import { Visit } from '../types/enhanced-visit.types';
import { validatePracticeId } from '../lib/supabaseValidator';
import { getStageUpdate, getVisitStage, STAGE_LABELS, type VisitStage } from '../utils/visitStage';
import { blocksReopen, INVOICE_LOCK_MESSAGES, loadVisitInvoiceLocks } from '../utils/invoiceLock';

export const NO_SHOW_NOT_ACCEPTED_MESSAGE =
  'This database does not accept the no-show status yet; ask the administrator to apply the visits status fix.';

/** A delete the database does not allow removes nothing and reports no error, so it is checked by row count */
export const VISIT_DELETE_NOT_ALLOWED_MESSAGE =
  'Not deleted: only a practice administrator can delete a booking, and only before the patient checks in.';
export const VISIT_HAS_RECORDS_MESSAGE =
  'This visit has records attached (vitals, lab requests, media or an invoice), so it cannot be deleted. Cancel it instead.';

/**
 * Reads one visit with the same patient and doctor joins as fetchVisits. Realtime events carry only
 * the visits columns, and storing those as-is made the scheduler show "Unknown Patient".
 */
const fetchVisitWithPeople = async (visitId: string): Promise<Visit | null> => {
  const { data, error } = await supabase
    .from('visits')
    .select(`
      *,
      patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email, date_of_birth),
      doctor:users!doctor_id(id, full_name, role)
    `)
    .eq('id', visitId)
    .single();
  if (error) {
    console.error('Could not reload a visit after a live update:', error);
    return null;
  }
  return data as unknown as Visit;
};

interface VisitsState {
  visits: Visit[];
  loading: boolean;
  error: string | null;
  
  // Counts for different states
  unconfirmedCount: number;
  checkedInCount: number;
  readyCount: number;
  inProgressCount: number;
  todayCount: number;
  
  // Filters
  practiceId: string | null;
  doctorId: string | null;
  selectedDate: string | null;
  
  // Real-time subscription
  subscription: any;
}

interface VisitsActions {
  // Data fetching
  fetchVisits: (filters?: VisitFilters) => Promise<void>;
  fetchVisitsByPatient: (patientId: string) => Promise<void>;
  fetchTodayVisits: (practiceId?: string) => Promise<void>;
  
  // Visit state transitions
  confirmVisit: (visitId: string, doctorId?: string) => Promise<void>;
  rejectVisit: (visitId: string, reason?: string) => Promise<void>;
  checkInPatient: (visitId: string) => Promise<void>;
  markPatientReady: (visitId: string) => Promise<void>;
  startVisit: (visitId: string) => Promise<void>;
  completeVisit: (visitId: string) => Promise<void>;
  moveVisitToStage: (visitId: string, stage: VisitStage, expectedFrom?: VisitStage) => Promise<void>;
  handoffVisit: (visitId: string) => Promise<void>;
  cancelVisit: (visitId: string, reason?: string) => Promise<void>;
  markNoShow: (visitId: string) => Promise<void>;
  rescheduleVisit: (visitId: string, newDate: string, newTime: string, reason?: string) => Promise<void>;
  
  // Bulk operations
  bulkConfirmVisits: (visitIds: string[], doctorId?: string) => Promise<void>;
  bulkCheckInPatients: (visitIds: string[]) => Promise<void>;
  
  // Utility functions
  updateCounts: () => void;
  setFilters: (filters: Partial<VisitFilters>) => void;
  clearError: () => void;
  
  // Real-time subscriptions
  subscribeToVisitChanges: (practiceId?: string) => void;
  unsubscribeFromVisitChanges: () => void;
  
  // Add/Update visits
  addVisit: (visit: Partial<Visit>) => Promise<Visit>;
  updateVisit: (visitId: string, updates: Partial<Visit>) => Promise<void>;
  deleteVisit: (visitId: string) => Promise<void>;
}

interface VisitFilters {
  practiceId?: string;
  doctorId?: string;
  patientId?: string;
  date?: string;
  status?: 'unconfirmed' | 'scheduled' | 'in-practice' | 'completed' | 'cancelled';
  dateRange?: {
    start: string;
    end: string;
  };
}

/** Loads of the same visits started this close together are one load (fetchVisits) */
const SHARE_VISIT_LOAD_MS = 300;
const recentVisitLoads = new Map<string, { task: Promise<void>; startedAt: number }>();

export const useVisitsStore = create<VisitsState & VisitsActions>((set, get) => ({
  // Initial state
  visits: [],
  loading: false,
  error: null,
  unconfirmedCount: 0,
  checkedInCount: 0,
  readyCount: 0,
  inProgressCount: 0,
  todayCount: 0,
  practiceId: null,
  doctorId: null,
  selectedDate: null,
  subscription: null,

  // Fetch visits with filters
  fetchVisits: (filters?: VisitFilters) => {
    // The diary and the visit tracker ask for the same day as the Dashboard opens: requests for the same filters
    // made within a moment of each other share one load. A later request (a refresh after a save) always reads afresh.
    const key = JSON.stringify(filters ?? {});
    const recent = recentVisitLoads.get(key);
    if (recent && Date.now() - recent.startedAt < SHARE_VISIT_LOAD_MS) return recent.task;
    const task = (async () => {
      set({ loading: true, error: null });
      
      try {
        let query = supabase
          .from('visits')
          .select(`
            *,
            patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email, date_of_birth),
            doctor:users!doctor_id(id, full_name, role)
          `);
        
        // Optimize ordering - only order by one field for better performance
        if (filters?.date) {
          // For specific date, sort by time only
          query = query.order('scheduled_time', { ascending: true });
        } else {
          // For date ranges, sort by date then time
          query = query
            .order('scheduled_date', { ascending: false })
            .order('scheduled_time', { ascending: false });
        }

        // Apply filters
        if (filters?.practiceId) {
          query = query.eq('practice_id', filters.practiceId);
        }
        if (filters?.doctorId) {
          query = query.eq('doctor_id', filters.doctorId);
        }
        if (filters?.patientId) {
          query = query.eq('patient_id', filters.patientId);
        }
        if (filters?.date) {
          // Handle both date formats (YYYY-MM-DD and M/D/YYYY)
          const dateObj = new Date(filters.date);
          const isoFormat = filters.date; // Already in YYYY-MM-DD format
          const usFormat = `${dateObj.getMonth() + 1}/${dateObj.getDate()}/${dateObj.getFullYear()}`;
          query = query.or(`scheduled_date.eq.${isoFormat},scheduled_date.eq.${usFormat}`);
        }
        if (filters?.dateRange) {
          query = query
            .gte('scheduled_date', filters.dateRange.start)
            .lte('scheduled_date', filters.dateRange.end);
        }

        // Status filters
        if (filters?.status === 'unconfirmed') {
          query = query.eq('is_scheduled', true).eq('is_confirmed', false).eq('is_cancelled', false);
        } else if (filters?.status === 'scheduled') {
          query = query.eq('is_confirmed', true).eq('is_checked_in', false).eq('is_cancelled', false);
        } else if (filters?.status === 'in-practice') {
          query = query.eq('is_checked_in', true).neq('status', 'completed');
        } else if (filters?.status === 'completed') {
          query = query.eq('status', 'completed');
        } else if (filters?.status === 'cancelled') {
          query = query.or('is_cancelled.eq.true,status.eq.cancelled');
        }
        
        // Add limit for performance - can implement pagination later
        if (!filters?.date && !filters?.patientId) {
          query = query.limit(100);
        }

        const { data, error } = await query;

        if (error) throw error;

        set({ visits: data || [], loading: false });
        get().updateCounts();
      } catch (error) {
        console.error('Error fetching visits:', error);
        set({ error: (error as Error).message, loading: false });
      }
    })();
    recentVisitLoads.set(key, { task, startedAt: Date.now() });
    void task.finally(() => {
      if (recentVisitLoads.get(key)?.task === task) recentVisitLoads.delete(key);
    });
    return task;
  },

  // Fetch visits for a specific patient
  fetchVisitsByPatient: async (patientId: string) => {
    await get().fetchVisits({ patientId });
  },

  // Fetch today's visits
  fetchTodayVisits: async (practiceId?: string) => {
    const today = new Date();
    // Local calendar date: toISOString() is UTC, which is still yesterday before 02:00 in Namibia
    const todayISO = format(today, 'yyyy-MM-dd');
    const todayUS = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`; // 6/25/2025
    
    const state = get();
    const currentPracticeId = practiceId || state.practiceId;
    
    // Validate practice ID
    if (!validatePracticeId(currentPracticeId)) {
      console.warn('⚠️ visitsStore: Invalid or missing practice ID:', currentPracticeId);
      set({ visits: [], loading: false, error: 'Invalid practice ID' });
      return;
    }
    
    // Fetch visits matching either date format
    set({ loading: true, error: null });
    
    try {
      const { data, error } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email, date_of_birth),
          doctor:users!doctor_id(id, full_name, role)
        `)
        .eq('practice_id', currentPracticeId)
        .or(`scheduled_date.eq.${todayISO},scheduled_date.eq.${todayUS}`)
        .order('scheduled_time', { ascending: true });
      
      if (error) throw error;
      
      set({ visits: data || [], loading: false });
      get().updateCounts();
    } catch (error) {
      console.error('Error fetching today\'s visits:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  // Confirm a visit
  confirmVisit: async (visitId: string, doctorId?: string) => {
    try {
      const updateData: any = {
        is_confirmed: true,
        updated_at: new Date().toISOString()
      };
      
      if (doctorId) {
        updateData.doctor_id = doctorId;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId
            ? { ...visit, is_confirmed: true, doctor_id: doctorId || visit.doctor_id }
            : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error confirming visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Reject a visit
  rejectVisit: async (visitId: string, reason?: string) => {
    try {
      const updateData: any = {
        is_cancelled: true,
        status: 'cancelled',
        updated_at: new Date().toISOString()
      };

      // Keep the clinical notes: the reason used to overwrite them. Append it as a marked line instead
      // (visits has no cancellation_reason column yet).
      if (reason) {
        const { data: current } = await supabase.from('visits').select('notes').eq('id', visitId).single();
        const existingNotes = (current?.notes || '').trim();
        updateData.notes = existingNotes ? `${existingNotes}\n\n[Cancelled: ${reason}]` : `[Cancelled: ${reason}]`;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId
            ? { ...visit, is_cancelled: true, status: 'cancelled', notes: updateData.notes ?? visit.notes }
            : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error rejecting visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Check in patient
  checkInPatient: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          is_checked_in: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, is_checked_in: true } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error checking in patient:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Mark patient ready
  markPatientReady: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          is_ready: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, is_ready: true } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error marking patient ready:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Start visit
  startVisit: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          status: 'in-progress',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, status: 'in-progress' } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error starting visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Complete visit
  completeVisit: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, status: 'completed' } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error completing visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Correct a visit's stage (e.g. reopen a visit completed by mistake, back to the nurse handoff,
  // undo a check-in or a no-show). Column values come from the shared stage definition.
  moveVisitToStage: async (visitId: string, stage: VisitStage, expectedFrom?: VisitStage) => {
    try {
      // Read the visit as it is now, so a stale screen can't overwrite a change someone else made
      const { data: current, error: readError } = await supabase
        .from('visits')
        .select('status, is_checked_in, is_ready, is_handoff, is_cancelled')
        .eq('id', visitId)
        .single();
      if (readError) throw readError;

      const currentStage = getVisitStage(current);
      if (expectedFrom && currentStage !== expectedFrom) {
        throw new Error(
          `This visit is now "${STAGE_LABELS[currentStage]}". Someone may have changed it; refresh and try again.`
        );
      }

      // A billed visit (invoice paid, or its claim already sent to the medical aid) must not be reopened:
      // real practices correct those with a credit note and an addendum, never by editing the record.
      // An invoice still waiting in the unsent claim batch does not block reopening.
      if (currentStage === 'completed' && stage !== 'completed') {
        const blocking = (await loadVisitInvoiceLocks(visitId)).find(invoice => blocksReopen(invoice.lock));
        if (blocking?.lock) {
          throw new Error(`Can't reopen this visit. ${INVOICE_LOCK_MESSAGES[blocking.lock]}`);
        }
      }

      const stageFields = getStageUpdate(stage);
      const { error } = await supabase
        .from('visits')
        .update({
          ...stageFields,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) {
        if (stage === 'no-show' && `${error.message ?? ''} ${error.details ?? ''}`.includes('visits_status_check')) {
          throw new Error(NO_SHOW_NOT_ACCEPTED_MESSAGE);
        }
        throw error;
      }

      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, ...stageFields } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error moving visit to stage:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Handoff visit
  handoffVisit: async (visitId: string) => {
    try {
      // Simple update without practice_id
      const { error } = await supabase
        .from('visits')
        .update({
          is_handoff: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, is_handoff: true } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error handing off visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Cancel visit
  cancelVisit: async (visitId: string, reason?: string) => {
    await get().rejectVisit(visitId, reason);
  },

  // Mark no show
  markNoShow: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          status: 'no-show',
          updated_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) {
        // Some databases' visits_status_check constraint doesn't list 'no-show' yet. Say so plainly
        // instead of showing staff a raw constraint error.
        if (`${error.message ?? ''} ${error.details ?? ''}`.includes('visits_status_check')) {
          throw new Error(NO_SHOW_NOT_ACCEPTED_MESSAGE);
        }
        throw error;
      }

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, status: 'no-show' } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error marking no show:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Reschedule visit
  rescheduleVisit: async (visitId: string, newDate: string, newTime: string, reason?: string) => {
    try {
      const updateData: any = {
        scheduled_date: newDate,
        scheduled_time: newTime,
        // Bookings write both pairs and some screens read visit_*; moving only scheduled_* left the
        // visit showing, and blocking, its old slot
        visit_date: newDate,
        visit_time: newTime,
        updated_at: new Date().toISOString()
      };

      if (reason) {
        const currentVisit = get().visits.find(v => v.id === visitId);
        updateData.notes = currentVisit?.notes 
          ? `${currentVisit.notes}\n\nRescheduled: ${reason}`
          : `Rescheduled: ${reason}`;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId
            ? {
                ...visit,
                scheduled_date: newDate,
                scheduled_time: newTime,
                visit_date: newDate,
                visit_time: newTime,
                notes: updateData.notes || visit.notes
              }
            : visit
        )
      }));
    } catch (error) {
      console.error('Error rescheduling visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Bulk confirm visits
  bulkConfirmVisits: async (visitIds: string[], doctorId?: string) => {
    try {
      const updateData: any = {
        is_confirmed: true,
        updated_at: new Date().toISOString()
      };
      
      if (doctorId) {
        updateData.doctor_id = doctorId;
      }

      const { error } = await supabase
        .from('visits')
        .update(updateData)
        .in('id', visitIds);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visitIds.includes(visit.id)
            ? { ...visit, is_confirmed: true, doctor_id: doctorId || visit.doctor_id }
            : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error bulk confirming visits:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Bulk check in patients
  bulkCheckInPatients: async (visitIds: string[]) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({
          is_checked_in: true,
          updated_at: new Date().toISOString()
        })
        .in('id', visitIds);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visitIds.includes(visit.id) ? { ...visit, is_checked_in: true } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error bulk checking in patients:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Update counts
  updateCounts: () => {
    const { visits } = get();
    const today = format(new Date(), 'yyyy-MM-dd');

    const unconfirmedCount = visits.filter(v => v.is_scheduled && !v.is_confirmed && !v.is_cancelled).length;
    const checkedInCount = visits.filter(v => v.is_checked_in && !v.is_ready && !v.is_cancelled).length;
    const readyCount = visits.filter(v => v.is_ready && v.status !== 'in-progress').length;
    const inProgressCount = visits.filter(v => v.status === 'in-progress').length;
    const todayCount = visits.filter(v => 
      (v.scheduled_date === today || v.visit_date === today) && !v.is_cancelled
    ).length;

    set({
      unconfirmedCount,
      checkedInCount,
      readyCount,
      inProgressCount,
      todayCount
    });
  },

  // Set filters
  setFilters: (filters: Partial<VisitFilters>) => {
    set(state => ({
      practiceId: filters.practiceId ?? state.practiceId,
      doctorId: filters.doctorId ?? state.doctorId,
      selectedDate: filters.date ?? state.selectedDate
    }));
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },

  // Subscribe to visit changes
  subscribeToVisitChanges: (practiceId?: string) => {
    const { subscription } = get();
    
    // Unsubscribe existing subscription
    if (subscription) {
      subscription.unsubscribe();
    }

    let channel = supabase.channel('visits-store-changes');
    
    if (practiceId) {
      channel = channel.on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits', filter: `practice_id=eq.${practiceId}` },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          if (eventType === 'INSERT' && newRecord) {
            // Add the new visit once its patient and doctor are loaded (raw row if that fails)
            const inserted = newRecord as Visit;
            void fetchVisitWithPeople(inserted.id).then(full => {
              const visit = full ?? inserted;
              set(state => ({
                visits: state.visits.some(v => v.id === visit.id) ? state.visits : [visit, ...state.visits]
              }));
              get().updateCounts();
            });
            return;
          } else if (eventType === 'UPDATE' && newRecord) {
            const updated = newRecord as Visit;
            const existing = get().visits.find(visit => visit.id === updated.id);
            // Visits outside the loaded list stay out of it, as before
            if (!existing) return;
            if (existing.patient_id === updated.patient_id && existing.doctor_id === updated.doctor_id) {
              // Same patient and doctor: keep the details already loaded
              set(state => ({
                visits: state.visits.map(visit =>
                  visit.id === updated.id ? { ...updated, patient: existing.patient, doctor: existing.doctor } : visit
                )
              }));
            } else {
              void fetchVisitWithPeople(updated.id).then(full => {
                // If the reload fails, never show the previous doctor's or patient's name on it
                const fallback: Visit = {
                  ...updated,
                  patient: existing.patient_id === updated.patient_id ? existing.patient : undefined,
                  doctor: existing.doctor_id === updated.doctor_id ? existing.doctor : undefined
                };
                set(state => ({
                  visits: state.visits.map(visit => (visit.id === updated.id ? full ?? fallback : visit))
                }));
                get().updateCounts();
              });
              return;
            }
          } else if (eventType === 'DELETE' && oldRecord) {
            // Remove deleted visit
            set(state => ({
              visits: state.visits.filter(visit => visit.id !== oldRecord.id)
            }));
          }

          // Update counts after any change
          get().updateCounts();
        }
      );
    } else {
      channel = channel.on('postgres_changes', 
        { event: '*', schema: 'public', table: 'visits' },
        (payload) => {
          // Handle all visit changes
          get().fetchVisits();
        }
      );
    }

    const newSubscription = channel.subscribe();
    set({ subscription: newSubscription });
  },

  // Unsubscribe from visit changes
  unsubscribeFromVisitChanges: () => {
    const { subscription } = get();
    if (subscription) {
      subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  // Add visit
  addVisit: async (visitData: Partial<Visit>) => {
    try {
      // First, insert the visit without relations
      const { data: insertedVisit, error: insertError } = await supabase
        .from('visits')
        .insert([visitData])
        .select()
        .single();

      if (insertError) throw insertError;

      // Then fetch the complete visit with relations
      const { data, error: fetchError } = await supabase
        .from('visits')
        .select(`
          *,
          patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email),
          doctor:users!doctor_id(id, full_name, role)
        `)
        .eq('id', insertedVisit.id)
        .single();

      if (fetchError) {
        console.warn('Error fetching visit relations, using basic data:', fetchError);
        // If fetching with relations fails, use the basic inserted data
        set(state => ({
          visits: [insertedVisit, ...state.visits]
        }));
        get().updateCounts();
        return insertedVisit;
      }

      // Add to local state with full relations
      set(state => ({
        visits: [data, ...state.visits]
      }));

      get().updateCounts();
      return data;
    } catch (error) {
      console.error('Error adding visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Update visit
  updateVisit: async (visitId: string, updates: Partial<Visit>) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', visitId);

      if (error) throw error;

      // Update local state
      set(state => ({
        visits: state.visits.map(visit =>
          visit.id === visitId ? { ...visit, ...updates } : visit
        )
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error updating visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  },

  // Delete visit: the database allows it only for a practice administrator and a booking that has not started
  // (see proposals/2026-10-06-data-fixes.sql, section 8)
  deleteVisit: async (visitId: string) => {
    try {
      const { error, count } = await supabase
        .from('visits')
        .delete({ count: 'exact' })
        .eq('id', visitId);

      if (error?.code === '23503') throw new Error(VISIT_HAS_RECORDS_MESSAGE);
      if (error) throw error;
      if (count === 0) throw new Error(VISIT_DELETE_NOT_ALLOWED_MESSAGE);

      // Remove from local state
      set(state => ({
        visits: state.visits.filter(visit => visit.id !== visitId)
      }));

      get().updateCounts();
    } catch (error) {
      console.error('Error deleting visit:', error);
      set({ error: (error as Error).message });
      throw error;
    }
  }
}));