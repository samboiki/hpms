import { useState, useEffect } from 'react';
import { CommunicationStatsService, CommunicationStats } from '../services/communicationStatsService';
import { usePractice } from '../contexts/PracticeContext';

export const useCommunicationStats = (overridePracticeId?: string) => {
  const { practiceId: contextPracticeId } = usePractice();
  const practiceId = overridePracticeId || contextPracticeId;
  const [communicationStats, setCommunicationStats] = useState<CommunicationStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchCommunicationStats = async () => {
      if (!practiceId) {
        console.log('⏳ useCommunicationStats: Waiting for practiceId...');
        return;
      }
      
      try {
        console.log('🔄 useCommunicationStats: Starting fetch for practiceId:', practiceId);
        setIsLoading(true);
        setError(null);
        const stats = await CommunicationStatsService.getCommunicationStats(practiceId);
        console.log('✅ useCommunicationStats: Successfully fetched stats:', stats);
        setCommunicationStats(stats);
      } catch (err) {
        setError(err as Error);
        console.error('❌ useCommunicationStats: Error fetching communication stats:', err);
      } finally {
        setIsLoading(false);
        console.log('🏁 useCommunicationStats: Fetch completed');
      }
    };

    fetchCommunicationStats();
  }, [practiceId]);

  return {
    communicationStats,
    isLoading,
    error,
    refetch: () => {
      const fetchStats = async () => {
        try {
          const stats = await CommunicationStatsService.getCommunicationStats(practiceId);
          setCommunicationStats(stats);
        } catch (err) {
          setError(err as Error);
        }
      };
      fetchStats();
    }
  };
};