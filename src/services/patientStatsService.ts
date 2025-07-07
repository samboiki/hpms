import { supabase } from '../lib/supabase';

export interface PatientStats {
  total: number;
  male: number;
  female: number;
  newThisMonth: number;
  newThisWeek: number;
  averageAge: number;
  activePatients: number; // Patients with visits in last 6 months
}

export class PatientStatsService {
  static async getPatientStatsByPractice(practiceId: string): Promise<PatientStats> {
    try {
      if (!practiceId) {
        throw new Error('Practice ID is required');
      }

      console.log('🔍 Fetching patient statistics for practice:', practiceId);

      // Main patient statistics query
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('id, gender, date_of_birth, created_at')
        .eq('practice_id', practiceId);

      if (patientError) {
        console.error('❌ Error fetching patient data:', patientError);
        throw new Error('Failed to fetch patient data: ' + patientError.message);
      }

      if (!patientData) {
        console.log('⚠️ No patient data found for practice:', practiceId);
        return {
          total: 0,
          male: 0,
          female: 0,
          newThisMonth: 0,
          newThisWeek: 0,
          averageAge: 0,
          activePatients: 0
        };
      }

      console.log('✅ Found', patientData.length, 'patients for practice');

      // Calculate statistics
      const total = patientData.length;
      const male = patientData.filter(p => p.gender && p.gender.toLowerCase() === 'male').length;
      const female = patientData.filter(p => p.gender && p.gender.toLowerCase() === 'female').length;

      // Calculate new patients this month
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const newThisMonth = patientData.filter(p => 
        new Date(p.created_at) >= thisMonth
      ).length;

      // Calculate new patients this week
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay());
      thisWeek.setHours(0, 0, 0, 0);
      const newThisWeek = patientData.filter(p => 
        new Date(p.created_at) >= thisWeek
      ).length;

      // Calculate average age
      const currentDate = new Date();
      const ages = patientData
        .filter(p => p.date_of_birth)
        .map(p => {
          const birthDate = new Date(p.date_of_birth);
          const age = currentDate.getFullYear() - birthDate.getFullYear();
          const monthDiff = currentDate.getMonth() - birthDate.getMonth();
          return monthDiff < 0 || (monthDiff === 0 && currentDate.getDate() < birthDate.getDate()) 
            ? age - 1 
            : age;
        });
      
      const averageAge = ages.length > 0 
        ? Math.round(ages.reduce((sum, age) => sum + age, 0) / ages.length)
        : 0;

      // Calculate active patients (those with visits in the last 6 months)
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const { data: recentVisits, error: visitsError } = await supabase
        .from('visits')
        .select('patient_id')
        .in('patient_id', patientData.map(p => p.id))
        .gte('visit_date', sixMonthsAgo.toISOString().split('T')[0]);

      const activePatients = visitsError 
        ? 0 
        : new Set(recentVisits?.map(v => v.patient_id) || []).size;

      const stats: PatientStats = {
        total,
        male,
        female,
        newThisMonth,
        newThisWeek,
        averageAge,
        activePatients
      };

      console.log('📊 Calculated patient statistics:');
      console.log(`👥 Total: ${total} patients`);
      console.log(`👨 Male: ${male} patients (${total > 0 ? Math.round((male/total)*100) : 0}%)`);
      console.log(`👩 Female: ${female} patients (${total > 0 ? Math.round((female/total)*100) : 0}%)`);
      console.log(`📅 New this month: ${newThisMonth} patients`);
      console.log(`🆕 New this week: ${newThisWeek} patients`);
      console.log(`🎂 Average age: ${averageAge} years`);
      console.log(`⚡ Active patients (6mo): ${activePatients} patients`);

      return stats;

    } catch (error) {
      console.error('❌ Error fetching patient statistics:', error);
      
      // Return fallback data if there's an error
      return {
        total: 0,
        male: 0,
        female: 0,
        newThisMonth: 0,
        newThisWeek: 0,
        averageAge: 0,
        activePatients: 0
      };
    }
  }
}