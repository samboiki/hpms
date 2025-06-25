import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Visit } from '../types/enhanced-visit.types';

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
  fetchVisits: async (filters?: VisitFilters) => {
    set({ loading: true, error: null });
    const startTime = performance.now();
    console.log('⏱️ visitsStore: Starting fetchVisits with filters:', filters);
    
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
      
      const queryTime = performance.now() - startTime;
      console.log(`⏱️ visitsStore: Query completed in ${queryTime.toFixed(2)}ms, returned ${data?.length || 0} visits`);

      if (error) throw error;

      set({ visits: data || [], loading: false });
      get().updateCounts();
    } catch (error) {
      console.error('Error fetching visits:', error);
      set({ error: (error as Error).message, loading: false });
    }
  },

  // Fetch visits for a specific patient
  fetchVisitsByPatient: async (patientId: string) => {
    await get().fetchVisits({ patientId });
  },

  // Fetch today's visits
  fetchTodayVisits: async (practiceId?: string) => {
    const today = new Date();
    const todayISO = today.toISOString().split('T')[0]; // 2025-06-25
    const todayUS = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`; // 6/25/2025
    
    const state = get();
    const currentPracticeId = practiceId || state.practiceId;
    
    console.log('⏱️ visitsStore: Fetching today\'s visits for dates:', todayISO, 'or', todayUS, 'practice:', currentPracticeId);
    const startTime = performance.now();
    
    if (!currentPracticeId) {
      console.warn('⚠️ visitsStore: No practice ID provided for fetchTodayVisits');
      set({ visits: [], loading: false });
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
      
      const totalTime = performance.now() - startTime;
      console.log(`⏱️ visitsStore: Today's visits fetched in ${totalTime.toFixed(2)}ms, found ${data?.length || 0} visits`);
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

      if (reason) {
        updateData.notes = reason;
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
            ? { ...visit, is_cancelled: true, status: 'cancelled', notes: reason || visit.notes }
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

  // Handoff visit
  handoffVisit: async (visitId: string) => {
    try {
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

      if (error) throw error;

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
            ? { ...visit, scheduled_date: newDate, scheduled_time: newTime, notes: updateData.notes || visit.notes }
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
    const today = new Date().toISOString().split('T')[0];

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
            // Add new visit
            set(state => ({
              visits: [newRecord as Visit, ...state.visits]
            }));
          } else if (eventType === 'UPDATE' && newRecord) {
            // Update existing visit
            set(state => ({
              visits: state.visits.map(visit =>
                visit.id === newRecord.id ? newRecord as Visit : visit
              )
            }));
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

  // Delete visit
  deleteVisit: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', visitId);

      if (error) throw error;

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