import { supabase } from './supabase';

export interface PracticeDataFilter {
  practiceId: string;
  userId: string;
  userRole: string;
}

// Cache for auth context
let authContextCache: {
  data: PracticeDataFilter;
  timestamp: number;
} | null = null;

// Cache for practice data
const practiceDataCache = new Map<string, { data: any; timestamp: number }>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
const AUTH_CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

class OptimizedPracticeDataService {
  private logWithContext(message: string, data?: any, context = 'OptimizedPracticeDataService') {
    console.log(`🚀 [${context}] ${message}`, data || '');
  }

  private logError(message: string, error: any, context = 'OptimizedPracticeDataService') {
    console.error(`❌ [${context}] ${message}`, error);
  }

  // Get authenticated user context with caching
  async getAuthContext(): Promise<PracticeDataFilter | null> {
    try {
      // Check cache first
      if (authContextCache && Date.now() - authContextCache.timestamp < AUTH_CACHE_DURATION) {
        this.logWithContext('Using cached auth context');
        return authContextCache.data;
      }

      const startTime = performance.now();
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error || !authUser) {
        this.logError('No authenticated user found', error);
        return null;
      }

      // Use a single query to get user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, role, practice_id')
        .eq('id', authUser.id)
        .single();

      const queryTime = performance.now() - startTime;
      this.logWithContext(`Auth query completed in ${queryTime.toFixed(2)}ms`);

      if (profileError || !userProfile?.practice_id) {
        this.logError('User profile error or no practice_id', profileError);
        return null;
      }

      const context = {
        practiceId: userProfile.practice_id,
        userId: userProfile.id,
        userRole: userProfile.role
      };

      // Update cache
      authContextCache = {
        data: context,
        timestamp: Date.now()
      };

      this.logWithContext('Auth context established and cached', context);
      return context;

    } catch (error) {
      this.logError('Failed to get auth context', error);
      return null;
    }
  }

  // Get all data for dashboard in a single optimized query
  async getDashboardData(practiceId: string): Promise<{
    doctors: any[];
    patients: any[];
    todayAppointments: any[];
    practiceDetails: any;
  }> {
    const cacheKey = `dashboard-${practiceId}`;
    const cached = practiceDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      this.logWithContext('Using cached dashboard data');
      return cached.data;
    }

    const startTime = performance.now();
    this.logWithContext(`Fetching dashboard data for practice: ${practiceId}`);
    
    try {
      // Execute all queries in parallel
      const [doctorsResult, patientsResult, appointmentsResult, practiceResult] = await Promise.all([
        // Doctors query - optimized with specific fields
        supabase
          .from('users')
          .select('id, email, full_name, role')
          .eq('practice_id', practiceId)
          .eq('role', 'doctor'),
        
        // Patients query - limit to necessary fields and recent patients
        supabase
          .from('patients')
          .select('id, first_name, last_name, gender, date_of_birth, created_at')
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false })
          .limit(500), // Limit for performance
        
        // Today's appointments only
        supabase
          .from('appointments')
          .select(`
            id, date, time, status, type,
            patients!appointments_patient_id_fkey(id, first_name, last_name),
            users!appointments_doctor_id_fkey(id, full_name)
          `)
          .eq('practice_id', practiceId)
          .eq('date', new Date().toISOString().split('T')[0])
          .order('time', { ascending: true }),
        
        // Practice details
        supabase
          .from('practices')
          .select('id, name, logo_url, primary_color, secondary_color')
          .eq('id', practiceId)
          .single()
      ]);

      const queryTime = performance.now() - startTime;
      this.logWithContext(`All dashboard queries completed in ${queryTime.toFixed(2)}ms`);

      const data = {
        doctors: doctorsResult.data || [],
        patients: patientsResult.data || [],
        todayAppointments: appointmentsResult.data?.map(apt => ({
          ...apt,
          patient: apt.patients,
          doctor: apt.users
        })) || [],
        practiceDetails: practiceResult.data
      };

      // Update cache
      practiceDataCache.set(cacheKey, {
        data,
        timestamp: Date.now()
      });

      return data;

    } catch (error) {
      this.logError('Exception fetching dashboard data', error);
      return {
        doctors: [],
        patients: [],
        todayAppointments: [],
        practiceDetails: null
      };
    }
  }

  // Get doctors with caching
  async getPracticeDoctors(practiceId: string): Promise<any[]> {
    const cacheKey = `doctors-${practiceId}`;
    const cached = practiceDataCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      this.logWithContext('Using cached doctors data');
      return cached.data;
    }

    const startTime = performance.now();
    
    try {
      const { data: doctors, error } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('practice_id', practiceId)
        .eq('role', 'doctor');

      const queryTime = performance.now() - startTime;
      this.logWithContext(`Doctors query completed in ${queryTime.toFixed(2)}ms`);

      if (error) throw error;

      const result = doctors || [];
      
      // Update cache
      practiceDataCache.set(cacheKey, {
        data: result,
        timestamp: Date.now()
      });

      return result;

    } catch (error) {
      this.logError('Failed to fetch practice doctors', error);
      return [];
    }
  }

  // Clear all caches
  clearCache() {
    authContextCache = null;
    practiceDataCache.clear();
    this.logWithContext('All caches cleared');
  }

  // Clear specific cache
  clearPracticeCache(practiceId: string) {
    const keysToDelete = Array.from(practiceDataCache.keys()).filter(key => 
      key.includes(practiceId)
    );
    keysToDelete.forEach(key => practiceDataCache.delete(key));
    this.logWithContext(`Cleared cache for practice ${practiceId}`);
  }
}

export const optimizedPracticeDataService = new OptimizedPracticeDataService();