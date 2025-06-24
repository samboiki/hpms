import { supabase } from '../lib/supabase';

export interface EncounterStats {
  total: number;
  completed: number;
  pending: number;
  inProgress: number;
  percentageCompleted: number;
  percentagePending: number;
  newThisMonth: number;
  newThisWeek: number;
}

export class EncounterStatsService {
  /**
   * Fetch comprehensive encounter statistics for a specific practice
   */
  static async getStats(practiceId: string): Promise<EncounterStats> {
    try {
      console.log('📊 Fetching encounter stats for practice:', practiceId);

      // Get total visits for the practice
      // First, we need to get all patients for this practice
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id')
        .eq('practice_id', practiceId);

      if (patientsError) {
        console.error('❌ Error fetching practice patients:', patientsError);
        throw patientsError;
      }

      const patientIds = patients?.map(p => p.id) || [];
      
      if (patientIds.length === 0) {
        console.log('📊 No patients found for practice:', practiceId);
        return {
          total: 0,
          completed: 0,
          pending: 0,
          inProgress: 0,
          percentageCompleted: 0,
          percentagePending: 0,
          newThisMonth: 0,
          newThisWeek: 0
        };
      }

      // Get total visits for these patients
      const { count: totalCount, error: totalError } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .in('patient_id', patientIds);

      if (totalError) {
        console.error('❌ Error fetching total encounters:', totalError);
        throw totalError;
      }

      const total = totalCount || 0;
      console.log('📊 Total encounters found:', total);

      // Get visits by status
      const { data: statusData, error: statusError } = await supabase
        .from('visits')
        .select('status')
        .in('patient_id', patientIds);

      if (statusError) {
        console.error('❌ Error fetching encounter statuses:', statusError);
        throw statusError;
      }

      // Count by status
      let completed = 0;
      let pending = 0;
      let inProgress = 0;

      statusData?.forEach(visit => {
        const status = visit.status?.toLowerCase() || '';
        
        if (status === 'completed' || status === 'complete') {
          completed++;
        } else {
          // Everything else is considered pending (including 'in-progress', 'pending', 'scheduled', etc.)
          pending++;
          
          // Also track in-progress separately for potential future use
          if (status === 'in_progress' || status === 'in-progress' || status === 'in progress') {
            inProgress++;
          }
        }
      });

      console.log('📊 Status breakdown:', { completed, pending: pending, inProgress: inProgress, totalPending: pending });

      // Calculate percentages
      const percentageCompleted = total > 0 ? Math.round((completed / total) * 100) : 0;
      const percentagePending = total > 0 ? Math.round((pending / total) * 100) : 0;

      // Get new encounters this month
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      
      const { count: newThisMonthCount, error: monthError } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .in('patient_id', patientIds)
        .gte('created_at', startOfMonth.toISOString());

      if (monthError) {
        console.error('❌ Error fetching new encounters this month:', monthError);
      }

      const newThisMonth = newThisMonthCount || 0;

      // Get new encounters this week
      const today = new Date();
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
      startOfWeek.setHours(0, 0, 0, 0);

      const { count: newThisWeekCount, error: weekError } = await supabase
        .from('visits')
        .select('*', { count: 'exact', head: true })
        .in('patient_id', patientIds)
        .gte('created_at', startOfWeek.toISOString());

      if (weekError) {
        console.error('❌ Error fetching new encounters this week:', weekError);
      }

      const newThisWeek = newThisWeekCount || 0;

      const stats: EncounterStats = {
        total,
        completed,
        pending,
        inProgress,
        percentageCompleted,
        percentagePending,
        newThisMonth,
        newThisWeek
      };

      console.log('📊 Final encounter statistics:', stats);
      return stats;

    } catch (error) {
      console.error('❌ Error in getStats:', error);
      // Return fallback data
      return {
        total: 0,
        completed: 0,
        pending: 0,
        inProgress: 0,
        percentageCompleted: 0,
        percentagePending: 0,
        newThisMonth: 0,
        newThisWeek: 0
      };
    }
  }
}