import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { Visit } from '../types/enhanced-visit.types';
import { validatePracticeId } from '../lib/supabaseValidator';
import { lightningCache } from '../lib/lightningCache';

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
  
  // Performance tracking
  lastFetchTime: number;
  fetchCount: number;
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

// Cache settings
const VISITS_CACHE_TTL = 2 * 60 * 1000; // 2 minutes for visits
const QUICK_CACHE_TTL = 30 * 1000; // 30 seconds for quick queries

export const useVisitsStoreFast = create<VisitsState & VisitsActions>((set, get) => ({
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
  lastFetchTime: 0,
  fetchCount: 0,

  // Fetch visits with filters and caching
  fetchVisits: async (filters?: VisitFilters) => {
    const startTime = performance.now();
    set({ loading: true, error: null });
    
    try {
      // Create cache key from filters
      const cacheKey = `visits:${JSON.stringify(filters || {})}`;
      
      // Use lightning cache
      const visits = await lightningCache.get(
        cacheKey,
        async () => {
          let query = supabase
            .from('visits')
            .select(`
              *,
              patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email, date_of_birth),
              branch:branches!visits_branch_id_fkey(id, name, address),
              doctor:users!visits_doctor_id_fkey(id, full_name, role, hpcsa_number),
              assigned_to:users!visits_assigned_to_fkey(id, full_name, role)
            `);

          // Apply filters
          if (filters?.practiceId) {
            const validatedId = validatePracticeId(filters.practiceId);
            if (validatedId) {
              query = query.eq('practice_id', validatedId);
            }
          }
          
          if (filters?.doctorId) {
            query = query.eq('doctor_id', filters.doctorId);
          }
          
          if (filters?.patientId) {
            query = query.eq('patient_id', filters.patientId);
          }
          
          if (filters?.date) {
            query = query.eq('visit_date', filters.date);
          } else if (filters?.dateRange) {
            query = query
              .gte('visit_date', filters.dateRange.start)
              .lte('visit_date', filters.dateRange.end);
          }
          
          if (filters?.status) {
            query = query.eq('status', filters.status);
          }

          // Order by visit date and time
          query = query.order('visit_date', { ascending: false })
                      .order('visit_time', { ascending: false });

          const { data, error } = await query;
          
          if (error) throw error;
          return data || [];
        },
        filters?.date === new Date().toISOString().split('T')[0] ? QUICK_CACHE_TTL : VISITS_CACHE_TTL
      );

      const endTime = performance.now();
      console.log(`⚡ Visits fetched in ${(endTime - startTime).toFixed(2)}ms`);

      set({ 
        visits, 
        loading: false,
        lastFetchTime: Date.now(),
        fetchCount: get().fetchCount + 1
      });
      
      // Update counts
      get().updateCounts();
      
      // Set filters
      if (filters) {
        get().setFilters(filters);
      }
    } catch (error: any) {
      console.error('Error fetching visits:', error);
      set({ error: error.message, loading: false });
    }
  },

  // Fetch today's visits with ultra-fast caching
  fetchTodayVisits: async (practiceId?: string) => {
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `visits:today:${practiceId || 'all'}`;
    
    set({ loading: true, error: null });
    
    try {
      const visits = await lightningCache.get(
        cacheKey,
        async () => {
          let query = supabase
            .from('visits')
            .select(`
              *,
              patient:patients!visits_patient_id_fkey(id, first_name, last_name, cell_number, email),
              branch:branches!visits_branch_id_fkey(id, name),
              doctor:users!visits_doctor_id_fkey(id, full_name, role)
            `)
            .eq('visit_date', today);

          if (practiceId) {
            const validatedId = validatePracticeId(practiceId);
            if (validatedId) {
              query = query.eq('practice_id', validatedId);
            }
          }

          query = query.order('visit_time', { ascending: true });

          const { data, error } = await query;
          if (error) throw error;
          return data || [];
        },
        QUICK_CACHE_TTL // 30 seconds for today's visits
      );

      set({ 
        visits, 
        loading: false,
        selectedDate: today,
        lastFetchTime: Date.now()
      });
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error fetching today visits:', error);
      set({ error: error.message, loading: false });
    }
  },

  // Fetch visits by patient with caching
  fetchVisitsByPatient: async (patientId: string) => {
    const cacheKey = `visits:patient:${patientId}`;
    
    set({ loading: true, error: null });
    
    try {
      const visits = await lightningCache.get(
        cacheKey,
        async () => {
          const { data, error } = await supabase
            .from('visits')
            .select(`
              *,
              patient:patients!visits_patient_id_fkey(id, first_name, last_name),
              branch:branches!visits_branch_id_fkey(id, name),
              doctor:users!visits_doctor_id_fkey(id, full_name, role)
            `)
            .eq('patient_id', patientId)
            .order('visit_date', { ascending: false })
            .order('visit_time', { ascending: false })
            .limit(20);

          if (error) throw error;
          return data || [];
        },
        VISITS_CACHE_TTL
      );

      set({ visits, loading: false });
    } catch (error: any) {
      console.error('Error fetching patient visits:', error);
      set({ error: error.message, loading: false });
    }
  },

  // Visit state transitions with cache invalidation
  confirmVisit: async (visitId: string, doctorId?: string) => {
    try {
      const updates: any = { 
        status: 'scheduled',
        confirmed_at: new Date().toISOString()
      };
      
      if (doctorId) {
        updates.doctor_id = doctorId;
      }

      const { error } = await supabase
        .from('visits')
        .update(updates)
        .eq('id', visitId);

      if (error) throw error;

      // Invalidate relevant caches
      lightningCache.invalidatePattern('visits:');
      
      // Update local state
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, ...updates } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error confirming visit:', error);
      set({ error: error.message });
    }
  },

  // Other methods remain similar but with cache invalidation...
  
  rejectVisit: async (visitId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'cancelled',
          cancellation_reason: reason || 'Rejected by practice',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, status: 'cancelled' } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error rejecting visit:', error);
      set({ error: error.message });
    }
  },

  checkInPatient: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'in-practice',
          checked_in_at: new Date().toISOString(),
          queue_status: 'checked_in'
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { 
            ...v, 
            status: 'in-practice',
            queue_status: 'checked_in'
          } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error checking in patient:', error);
      set({ error: error.message });
    }
  },

  markPatientReady: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          queue_status: 'ready'
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, queue_status: 'ready' } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error marking patient ready:', error);
      set({ error: error.message });
    }
  },

  startVisit: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          queue_status: 'in_progress',
          consultation_started_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, queue_status: 'in_progress' } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error starting visit:', error);
      set({ error: error.message });
    }
  },

  completeVisit: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'completed',
          queue_status: 'completed',
          consultation_ended_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { 
            ...v, 
            status: 'completed',
            queue_status: 'completed'
          } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error completing visit:', error);
      set({ error: error.message });
    }
  },

  handoffVisit: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          queue_status: 'handed_off'
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, queue_status: 'handed_off' } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error handing off visit:', error);
      set({ error: error.message });
    }
  },

  cancelVisit: async (visitId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'cancelled',
          cancellation_reason: reason || 'Cancelled by practice',
          cancelled_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, status: 'cancelled' } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error cancelling visit:', error);
      set({ error: error.message });
    }
  },

  markNoShow: async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'no-show',
          no_show_marked_at: new Date().toISOString()
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, status: 'no-show' } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error marking no-show:', error);
      set({ error: error.message });
    }
  },

  rescheduleVisit: async (visitId: string, newDate: string, newTime: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          visit_date: newDate,
          visit_time: newTime,
          rescheduled_at: new Date().toISOString(),
          reschedule_reason: reason
        })
        .eq('id', visitId);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { 
            ...v, 
            visit_date: newDate,
            visit_time: newTime
          } : v
        )
      }));
    } catch (error: any) {
      console.error('Error rescheduling visit:', error);
      set({ error: error.message });
    }
  },

  // Bulk operations
  bulkConfirmVisits: async (visitIds: string[], doctorId?: string) => {
    try {
      const updates: any = { 
        status: 'scheduled',
        confirmed_at: new Date().toISOString()
      };
      
      if (doctorId) {
        updates.doctor_id = doctorId;
      }

      const { error } = await supabase
        .from('visits')
        .update(updates)
        .in('id', visitIds);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          visitIds.includes(v.id) ? { ...v, ...updates } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error bulk confirming visits:', error);
      set({ error: error.message });
    }
  },

  bulkCheckInPatients: async (visitIds: string[]) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update({ 
          status: 'in-practice',
          checked_in_at: new Date().toISOString(),
          queue_status: 'checked_in'
        })
        .in('id', visitIds);

      if (error) throw error;

      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          visitIds.includes(v.id) ? { 
            ...v, 
            status: 'in-practice',
            queue_status: 'checked_in'
          } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error bulk checking in patients:', error);
      set({ error: error.message });
    }
  },

  // Update counts
  updateCounts: () => {
    const state = get();
    const today = new Date().toISOString().split('T')[0];
    
    const counts = state.visits.reduce((acc, visit) => {
      if (visit.status === 'unconfirmed') acc.unconfirmed++;
      if (visit.queue_status === 'checked_in') acc.checkedIn++;
      if (visit.queue_status === 'ready') acc.ready++;
      if (visit.queue_status === 'in_progress') acc.inProgress++;
      if (visit.visit_date === today) acc.today++;
      return acc;
    }, {
      unconfirmed: 0,
      checkedIn: 0,
      ready: 0,
      inProgress: 0,
      today: 0
    });
    
    set({
      unconfirmedCount: counts.unconfirmed,
      checkedInCount: counts.checkedIn,
      readyCount: counts.ready,
      inProgressCount: counts.inProgress,
      todayCount: counts.today
    });
  },

  // Set filters
  setFilters: (filters: Partial<VisitFilters>) => {
    set(state => ({
      practiceId: filters.practiceId !== undefined ? filters.practiceId : state.practiceId,
      doctorId: filters.doctorId !== undefined ? filters.doctorId : state.doctorId,
      selectedDate: filters.date !== undefined ? filters.date : state.selectedDate
    }));
  },

  clearError: () => set({ error: null }),

  // Real-time subscriptions
  subscribeToVisitChanges: (practiceId?: string) => {
    const state = get();
    
    // Unsubscribe from existing subscription
    if (state.subscription) {
      state.subscription.unsubscribe();
    }

    const channel = supabase
      .channel('visits-changes')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'visits',
          filter: practiceId ? `practice_id=eq.${practiceId}` : undefined
        },
        (payload) => {
          console.log('Visit change:', payload);
          
          // Invalidate cache on changes
          lightningCache.invalidatePattern('visits:');
          
          // Re-fetch visits
          const filters: VisitFilters = {};
          if (state.practiceId) filters.practiceId = state.practiceId;
          if (state.doctorId) filters.doctorId = state.doctorId;
          if (state.selectedDate) filters.date = state.selectedDate;
          
          get().fetchVisits(filters);
        }
      );

    channel.subscribe();
    
    set({ subscription: channel });
  },

  unsubscribeFromVisitChanges: () => {
    const state = get();
    if (state.subscription) {
      state.subscription.unsubscribe();
      set({ subscription: null });
    }
  },

  // Add visit
  addVisit: async (visit: Partial<Visit>) => {
    try {
      const { data, error } = await supabase
        .from('visits')
        .insert(visit)
        .select()
        .single();

      if (error) throw error;

      // Invalidate cache
      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: [...state.visits, data]
      }));
      
      get().updateCounts();
      
      return data;
    } catch (error: any) {
      console.error('Error adding visit:', error);
      set({ error: error.message });
      throw error;
    }
  },

  // Update visit
  updateVisit: async (visitId: string, updates: Partial<Visit>) => {
    try {
      const { error } = await supabase
        .from('visits')
        .update(updates)
        .eq('id', visitId);

      if (error) throw error;

      // Invalidate cache
      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.map(v => 
          v.id === visitId ? { ...v, ...updates } : v
        )
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error updating visit:', error);
      set({ error: error.message });
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

      // Invalidate cache
      lightningCache.invalidatePattern('visits:');
      
      set(state => ({
        visits: state.visits.filter(v => v.id !== visitId)
      }));
      
      get().updateCounts();
    } catch (error: any) {
      console.error('Error deleting visit:', error);
      set({ error: error.message });
    }
  }
}));