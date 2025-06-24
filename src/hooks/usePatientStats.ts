import { useState, useEffect } from 'react';
import { PatientStatsService, PatientStats } from '../services/patientStatsService';
import { usePractice } from '../contexts/PracticeContext';

export const usePatientStats = (overridePracticeId?: string) => {
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = overridePracticeId || contextPracticeId;
  const [patientStats, setPatientStats] = useState<PatientStats>({
    total: 0,
    male: 0,
    female: 0,
    newThisMonth: 0,
    newThisWeek: 0,
    averageAge: 0,
    activePatients: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchPatientStats = async () => {
      if (!practiceId) {
        console.log('⏳ usePatientStats: Waiting for practiceId...');
        return;
      }
      
      try {
        console.log('🔄 usePatientStats: Starting fetch for practiceId:', practiceId);
        setIsLoading(true);
        setError(null);
        const stats = await PatientStatsService.getPatientStatsByPractice(practiceId);
        console.log('✅ usePatientStats: Successfully fetched stats:', stats);
        setPatientStats(stats);
      } catch (err) {
        setError(err as Error);
        console.error('❌ usePatientStats: Error fetching patient stats:', err);
      } finally {
        setIsLoading(false);
        console.log('🏁 usePatientStats: Fetch completed');
      }
    };

    fetchPatientStats();
  }, [practiceId]);

  return {
    patientStats,
    isLoading,
    error,
    refetch: () => {
      const fetchStats = async () => {
        try {
          const stats = await PatientStatsService.getPatientStatsByPractice(practiceId);
          setPatientStats(stats);
        } catch (err) {
          setError(err as Error);
        }
      };
      fetchStats();
    }
  };
};