import { useEffect, useState } from 'react';
import { EncounterStats, EncounterStatsService } from '../services/encounterStatsService';
import { practiceDataService } from '../lib/practiceDataService';

export function useEncounterStats() {
  const [encounterStats, setEncounterStats] = useState<EncounterStats>({
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    percentageCompleted: 0,
    percentagePending: 0,
    newThisMonth: 0,
    newThisWeek: 0
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchEncounterStats = async () => {
      try {
        setIsLoading(true);
        
        // Get the current practice ID
        const authContext = await practiceDataService.getAuthContext();
        if (!authContext?.practiceId) {
          console.warn('⚠️ No practice ID available for encounter stats');
          return;
        }

        console.log('🎯 Fetching encounter stats for practice:', authContext.practiceId);
        
        // Fetch encounter statistics
        const stats = await EncounterStatsService.getStats(authContext.practiceId);
        console.log('📊 Received encounter stats:', stats);
        setEncounterStats(stats);
        
      } catch (err) {
        console.error('❌ Error fetching encounter stats:', err);
        setError(err instanceof Error ? err : new Error('Failed to fetch encounter stats'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchEncounterStats();
    
    // Refresh stats every 30 seconds for real-time updates
    const interval = setInterval(fetchEncounterStats, 30000);
    
    return () => clearInterval(interval);
  }, []);

  return { encounterStats, isLoading, error };
}