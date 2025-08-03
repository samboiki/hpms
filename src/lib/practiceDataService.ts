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

  // Get appointments for practice (INCLUDING pending ones without doctors)
  async getPracticeAppointments(practiceId: string, date?: string): Promise<any[]> {
    this.logWithContext(`Fetching appointments for practice: ${practiceId}`, { date });
    
    try {
      // Build query - get ALL appointments for the practice
      // INCLUDING pending appointments that don't have a doctor assigned yet
      let query = supabase
        .from('appointments')
        .select('*')
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

      // Now fetch related patient and doctor data
      const patientIds = [...new Set(filteredAppointments.map(apt => apt.patient_id).filter(Boolean))];
      const doctorIds = [...new Set(filteredAppointments.map(apt => apt.doctor_id).filter(Boolean))];
      
      // Fetch patients and doctors in parallel
      const [patientsResponse, doctorsResponse] = await Promise.all([
        patientIds.length > 0 
          ? supabase
              .from('patients')
              .select('id, first_name, last_name, cell_number, date_of_birth, gender')
              .in('id', patientIds)
          : Promise.resolve({ data: [], error: null }),
        doctorIds.length > 0
          ? supabase
              .from('users')
              .select('id, full_name, practice_id')
              .in('id', doctorIds)
          : Promise.resolve({ data: [], error: null })
      ]);
      
      if (patientsResponse.error) {
        this.logError('Failed to fetch patients for appointments', patientsResponse.error);
      }
      if (doctorsResponse.error) {
        this.logError('Failed to fetch doctors for appointments', doctorsResponse.error);
      }
      
      // Create lookup maps
      const patientsMap = new Map((patientsResponse.data || []).map(p => [p.id, p]));
      const doctorsMap = new Map((doctorsResponse.data || []).map(d => [d.id, d]));
      
      // Transform the data to match the expected format
      const formattedAppointments = filteredAppointments.map(apt => ({
        ...apt,
        patient: apt.patient_id ? patientsMap.get(apt.patient_id) : undefined,
        doctor: apt.doctor_id ? doctorsMap.get(apt.doctor_id) : undefined
      }));

      return formattedAppointments;

    } catch (error) {
      this.logError('Exception fetching practice appointments', error);
      return [];
    }
  }

  // Get patients for practice (optimized query)
  async getPracticePatients(practiceId: string): Promise<any[]> {
    this.logWithContext(`Fetching patients for practice: ${practiceId}`);
    
    try {
      const startTime = performance.now();
      
      // First, fetch just the patient data without joins for better performance
      const { data: patients, error } = await supabase
        .from('patients')
        .select('*')
        .eq('practice_id', practiceId)
        .order('last_name', { ascending: true })
        .order('first_name', { ascending: true });

      if (error) {
        this.logError('Failed to fetch patients', error);
        return [];
      }

      if (!patients || patients.length === 0) {
        this.logWithContext(`No patients found for practice ${practiceId}`);
        return [];
      }

      // Only fetch medical aid details if there are patients
      const patientIds = patients.map(p => p.id);
      
      // Fetch medical aid details separately for better performance
      const { data: medicalAidData, error: medicalAidError } = await supabase
        .from('medical_aid_details')
        .select(`
          *,
          medical_aid_provider:medical_aid_providers (
            id,
            name,
            logo_url
          )
        `)
        .in('patient_id', patientIds);
      
      if (medicalAidError) {
        this.logError('Failed to fetch medical aid details', medicalAidError);
        // Continue without medical aid data rather than failing completely
      }
      
      // Create a map for efficient lookup
      const medicalAidMap = new Map<string, any[]>();
      if (medicalAidData) {
        medicalAidData.forEach(mad => {
          if (!medicalAidMap.has(mad.patient_id)) {
            medicalAidMap.set(mad.patient_id, []);
          }
          medicalAidMap.get(mad.patient_id)?.push(mad);
        });
      }
      
      // Combine patients with their medical aid details
      const patientsWithMedicalAid = patients.map(patient => ({
        ...patient,
        medical_aid_details: medicalAidMap.get(patient.id) || []
      }));

      const queryTime = performance.now() - startTime;
      this.logWithContext(`Found ${patients.length} patients for practice ${practiceId} in ${queryTime.toFixed(2)}ms`, {
        patientCount: patients.length,
        queryTime: queryTime.toFixed(2),
        samplePatient: patients[0] ? {
          id: patients[0].id,
          name: `${patients[0].first_name} ${patients[0].last_name}`,
          practice_id: patients[0].practice_id
        } : null
      });

      return patientsWithMedicalAid;

    } catch (error) {
      this.logError('Exception fetching practice patients', error);
      return [];
    }
  }

  // Get practice details including logo
  async getPracticeDetails(practiceId: string): Promise<any | null> {
    this.logWithContext(`Fetching practice details for: ${practiceId}`);
    
    try {
      const { data: practice, error } = await supabase
        .from('practices')
        .select('id, name, logo_url, primary_color, secondary_color, slug')
        .eq('id', practiceId)
        .single();

      if (error) {
        this.logError('Failed to fetch practice details', error);
        return null;
      }

      this.logWithContext(`Found practice details for ${practiceId}:`, {
        name: practice?.name,
        hasLogo: !!practice?.logo_url,
        logoUrl: practice?.logo_url
      });

      return practice;

    } catch (error) {
      this.logError('Exception fetching practice details', error);
      return null;
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
      .select(`id, doctor_id, date, patients!patient_id(first_name, last_name), users!doctor_id(full_name, practice_id)`)
      .limit(50);

    this.logWithContext(`🐛 DEBUG: All appointments in database (first 50):`, {
      total: allAppointments?.length || 0,
      byPractice: allAppointments?.reduce((acc, apt) => {
        const practice = apt.users?.practice_id || 'NO_PRACTICE';
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

export interface PracticeDetails {
  id: string;
  name: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  slug: string;
}