import { supabase } from './supabase';

export interface PracticeDataFilter {
  practiceId: string;
  userId: string;
  userRole: string;
}

class PracticeDataService {
  private logWithContext(message: string, data?: any, context = 'PracticeDataService') {
    console.log(`🔍 [${context}] ${message}`, data || '');
  }

  private logError(message: string, error: any, context = 'PracticeDataService') {
    console.error(`❌ [${context}] ${message}`, error);
  }

  // Get authenticated user context
  async getAuthContext(): Promise<PracticeDataFilter | null> {
    try {
      const { data: { user: authUser }, error } = await supabase.auth.getUser();
      
      if (error || !authUser) {
        this.logError('No authenticated user found', error);
        return null;
      }

      // Get user profile from users table
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('id, email, full_name, role, practice_id')
        .eq('id', authUser.id)
        .single();

      if (profileError) {
        this.logError('Failed to get user profile from users table', profileError);
        
        // Fallback to auth metadata if users table fails
        if (authUser.user_metadata?.practice_id) {
          this.logWithContext('Using auth metadata as fallback', {
            practiceId: authUser.user_metadata.practice_id,
            userId: authUser.id,
            userRole: authUser.user_metadata.role
          });
          
          return {
            practiceId: authUser.user_metadata.practice_id,
            userId: authUser.id,
            userRole: authUser.user_metadata.role || 'admin'
          };
        }
        
        return null;
      }

      if (!userProfile?.practice_id) {
        this.logError('User has no practice_id assigned', userProfile);
        return null;
      }

      const context = {
        practiceId: userProfile.practice_id,
        userId: userProfile.id,
        userRole: userProfile.role
      };

      this.logWithContext('Auth context established', context);
      return context;

    } catch (error) {
      this.logError('Failed to get auth context', error);
      return null;
    }
  }

  // Get all doctors for a practice
  async getPracticeDoctors(practiceId: string): Promise<any[]> {
    this.logWithContext(`Fetching doctors for practice: ${practiceId}`);
    
    try {
      const { data: doctors, error } = await supabase
        .from('users')
        .select('id, email, full_name, role, practice_id')
        .eq('practice_id', practiceId)
        .eq('role', 'doctor');

      if (error) {
        this.logError('Failed to fetch practice doctors', error);
        return [];
      }

      this.logWithContext(`Found ${doctors?.length || 0} doctors for practice ${practiceId}`, doctors);
      return doctors || [];

    } catch (error) {
      this.logError('Exception fetching practice doctors', error);
      return [];
    }
  }

  // Get appointments for practice (filtered by practice doctors)
  async getPracticeAppointments(practiceId: string, date?: string): Promise<any[]> {
    this.logWithContext(`Fetching appointments for practice: ${practiceId}`, { date });
    
    try {
      // First get practice doctors
      const doctors = await this.getPracticeDoctors(practiceId);
      
      if (doctors.length === 0) {
        this.logWithContext(`No doctors found for practice ${practiceId}, returning empty appointments`);
        return [];
      }

      const doctorIds = doctors.map(d => d.id);
      this.logWithContext(`Querying appointments for doctor IDs:`, doctorIds);

      // Build query - get ALL appointments for the practice
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients(id, first_name, last_name, cell_number, date_of_birth, gender),
          doctor:users!doctor_id(id, full_name, practice_id)
        `)
        .eq('practice_id', practiceId)
        .order('date', { ascending: true })
        .order('time', { ascending: true });

      if (date) {
        query = query.eq('date', date);
      }

      const { data: appointments, error } = await query;

      if (error) {
        this.logError('Failed to fetch appointments', error);
        return [];
      }

      // No need to filter anymore since we're querying by practice_id directly
      const filteredAppointments = appointments || [];

      this.logWithContext(`Found ${filteredAppointments.length} appointments for practice ${practiceId}`, {
        totalFetched: appointments?.length || 0,
        afterFiltering: filteredAppointments.length,
        sampleAppointment: filteredAppointments[0] ? {
          id: filteredAppointments[0].id,
          date: filteredAppointments[0].date,
          doctorPractice: filteredAppointments[0].doctor?.practice_id,
          patientName: `${filteredAppointments[0].patient?.first_name} ${filteredAppointments[0].patient?.last_name}`
        } : null
      });

      return filteredAppointments;

    } catch (error) {
      this.logError('Exception fetching practice appointments', error);
      return [];
    }
  }

  // Get patients for practice (only those with appointments at this practice)
  async getPracticePatients(practiceId: string): Promise<any[]> {
    this.logWithContext(`Fetching patients for practice: ${practiceId}`);
    
    try {
      // Get appointments to find patient IDs
      const appointments = await this.getPracticeAppointments(practiceId);
      
      if (appointments.length === 0) {
        this.logWithContext(`No appointments found for practice ${practiceId}, returning empty patients`);
        return [];
      }

      // Get unique patient IDs
      const patientIds = [...new Set(appointments.map(apt => apt.patient_id))];
      this.logWithContext(`Found ${patientIds.length} unique patient IDs from appointments`, patientIds);

      // Fetch patients
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .in('id', patientIds)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) {
        this.logError('Failed to fetch patients', error);
        return [];
      }

      this.logWithContext(`Found ${patients?.length || 0} patients for practice ${practiceId}`, {
        patientCount: patients?.length || 0,
        samplePatient: patients?.[0] ? {
          id: patients[0].id,
          name: `${patients[0].first_name} ${patients[0].last_name}`
        } : null
      });

      return patients || [];

    } catch (error) {
      this.logError('Exception fetching practice patients', error);
      return [];
    }
  }

  // Debug function to check all data
  async debugPracticeData(practiceId: string) {
    this.logWithContext(`🐛 DEBUG: Starting comprehensive data check for practice ${practiceId}`);
    
    // Check doctors
    const doctors = await this.getPracticeDoctors(practiceId);
    
    // Check all appointments in DB
    const { data: allAppointments } = await supabase
      .from('appointments')
      .select(`id, doctor_id, date, patient:patients(first_name, last_name), doctor:users(full_name, practice_id)`)
      .limit(50);

    this.logWithContext(`🐛 DEBUG: All appointments in database (first 50):`, {
      total: allAppointments?.length || 0,
      byPractice: allAppointments?.reduce((acc, apt) => {
        const practice = apt.doctor?.practice_id || 'NO_PRACTICE';
        acc[practice] = (acc[practice] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    });

    // Check all patients in DB
    const { data: allPatients, count: patientCount } = await supabase
      .from('patients')
      .select('*', { count: 'exact', head: true });

    this.logWithContext(`🐛 DEBUG: Total patients in database: ${patientCount}`);

    // Final verification
    const practiceAppointments = await this.getPracticeAppointments(practiceId);
    const practicePatients = await this.getPracticePatients(practiceId);

    this.logWithContext(`🐛 DEBUG: Final results for practice ${practiceId}:`, {
      doctors: doctors.length,
      appointments: practiceAppointments.length,
      patients: practicePatients.length
    });

    return {
      doctors: doctors.length,
      appointments: practiceAppointments.length,
      patients: practicePatients.length,
      allAppointmentsCount: allAppointments?.length || 0,
      allPatientsCount: patientCount || 0
    };
  }
}

export const practiceDataService = new PracticeDataService();