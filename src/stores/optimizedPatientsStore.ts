import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { performanceOptimizer } from '../lib/performanceOptimizer';
import { supabase } from '../lib/supabase';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  cell_number?: string;
  email?: string;
  practice_id: string;
  medical_aid_details?: any[];
  visitCount?: number;
  lastVisitDate?: string;
  // Virtual scroll properties
  _virtualIndex?: number;
  _isVisible?: boolean;
}

interface OptimizedPatientsState {
  // Data
  patients: Patient[];
  filteredPatients: Patient[];
  selectedPatient: Patient | null;
  
  // UI State
  isLoading: boolean;
  error: string | null;
  searchTerm: string;
  sortBy: 'name' | 'lastVisit' | 'visitCount';
  sortOrder: 'asc' | 'desc';
  
  // Virtual scrolling
  visibleRange: { start: number; end: number };
  containerHeight: number;
  itemHeight: number;
  
  // Performance metrics
  lastFetchTime: number;
  cacheHitRate: number;
  
  // Actions
  fetchPatients: (practiceId: string) => Promise<void>;
  searchPatients: (term: string) => void;
  sortPatients: (by: 'name' | 'lastVisit' | 'visitCount') => void;
  selectPatient: (patient: Patient | null) => void;
  updateVisibleRange: (start: number, end: number) => void;
  prefetchPatientDetails: (patientIds: string[]) => void;
}

export const useOptimizedPatientsStore = create<OptimizedPatientsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    patients: [],
    filteredPatients: [],
    selectedPatient: null,
    isLoading: false,
    error: null,
    searchTerm: '',
    sortBy: 'name',
    sortOrder: 'asc',
    visibleRange: { start: 0, end: 50 },
    containerHeight: 600,
    itemHeight: 60,
    lastFetchTime: 0,
    cacheHitRate: 0,
    
    // Fetch patients with optimization
    fetchPatients: async (practiceId: string) => {
      set({ isLoading: true, error: null });
      const startTime = performance.now();
      
      try {
        // Use edge function for optimized fetching
        const data = await performanceOptimizer.fetchOptimized('patient_list', {
          practiceId,
          includeVisitCounts: true
        });
        
        const fetchTime = performance.now() - startTime;
        
        set({
          patients: data.patients || [],
          filteredPatients: data.patients || [],
          isLoading: false,
          lastFetchTime: fetchTime,
          cacheHitRate: data.fromCache ? 
            (get().cacheHitRate * 0.9 + 0.1) : 
            (get().cacheHitRate * 0.9)
        });
        
        console.log(`✅ Patients loaded in ${fetchTime.toFixed(2)}ms (Cache hit rate: ${(get().cacheHitRate * 100).toFixed(1)}%)`);
        
        // Prefetch details for visible patients
        const visiblePatients = data.patients?.slice(0, 20) || [];
        get().prefetchPatientDetails(visiblePatients.map((p: Patient) => p.id));
        
      } catch (error) {
        console.error('Failed to fetch patients:', error);
        set({ error: 'Failed to load patients', isLoading: false });
      }
    },
    
    // Local search with debouncing
    searchPatients: (term: string) => {
      set({ searchTerm: term });
      
      if (!term) {
        set({ filteredPatients: get().patients });
        return;
      }
      
      const searchLower = term.toLowerCase();
      const filtered = get().patients.filter(patient => 
        patient.first_name?.toLowerCase().includes(searchLower) ||
        patient.last_name?.toLowerCase().includes(searchLower) ||
        patient.cell_number?.includes(term) ||
        patient.email?.toLowerCase().includes(searchLower)
      );
      
      set({ filteredPatients: filtered });
      
      // Log search performance
      console.log(`🔍 Search completed: ${filtered.length} results for "${term}"`);
    },
    
    // Optimized sorting
    sortPatients: (by: 'name' | 'lastVisit' | 'visitCount') => {
      const { filteredPatients, sortOrder } = get();
      const newOrder = sortOrder === 'asc' ? 'desc' : 'asc';
      
      const sorted = [...filteredPatients].sort((a, b) => {
        let compareValue = 0;
        
        switch (by) {
          case 'name':
            compareValue = `${a.last_name} ${a.first_name}`.localeCompare(
              `${b.last_name} ${b.first_name}`
            );
            break;
          case 'lastVisit':
            compareValue = (a.lastVisitDate || '').localeCompare(b.lastVisitDate || '');
            break;
          case 'visitCount':
            compareValue = (a.visitCount || 0) - (b.visitCount || 0);
            break;
        }
        
        return newOrder === 'asc' ? compareValue : -compareValue;
      });
      
      set({ 
        filteredPatients: sorted, 
        sortBy: by, 
        sortOrder: newOrder 
      });
    },
    
    // Select patient with prefetching
    selectPatient: (patient: Patient | null) => {
      set({ selectedPatient: patient });
      
      if (patient) {
        // Prefetch patient details
        performanceOptimizer.fetchOptimized('patient_details', {
          patientId: patient.id
        }).catch(console.error);
      }
    },
    
    // Virtual scrolling support
    updateVisibleRange: (start: number, end: number) => {
      set({ visibleRange: { start, end } });
      
      // Prefetch patients that will become visible soon
      const patients = get().filteredPatients;
      const prefetchStart = Math.max(0, end - 5);
      const prefetchEnd = Math.min(patients.length, end + 10);
      
      const patientsToPrefetch = patients
        .slice(prefetchStart, prefetchEnd)
        .map(p => p.id);
        
      get().prefetchPatientDetails(patientsToPrefetch);
    },
    
    // Background prefetching
    prefetchPatientDetails: (patientIds: string[]) => {
      // Batch prefetch patient details
      patientIds.forEach((id, index) => {
        setTimeout(() => {
          performanceOptimizer.fetchOptimized('patient_details', {
            patientId: id
          }).catch(() => {
            // Silently fail prefetch
          });
        }, index * 100); // Stagger requests
      });
    }
  }))
);

// Subscribe to visible range changes for virtual scrolling
useOptimizedPatientsStore.subscribe(
  (state) => state.visibleRange,
  (visibleRange) => {
    console.log(`📜 Virtual scroll: showing items ${visibleRange.start}-${visibleRange.end}`);
  }
);

// Performance monitoring
useOptimizedPatientsStore.subscribe(
  (state) => state.lastFetchTime,
  (fetchTime) => {
    if (fetchTime > 1000) {
      console.warn(`⚠️ Slow patient fetch: ${fetchTime.toFixed(2)}ms`);
      // In production, send telemetry
    }
  }
);