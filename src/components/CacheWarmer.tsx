import { useEffect } from 'react';
import { warmUpCache } from '../lib/cachedQueries';
import { superchargedCache } from '../lib/superchargedCache';
import { prefetchCommonData } from '../lib/optimizedQueries';
import { usePractice } from '../contexts/PracticeContext';

/**
 * Component that warms up the cache on app start
 * and displays cache statistics
 */
export function CacheWarmer() {
  const { practiceId, practice } = usePractice();

  useEffect(() => {
    console.log('🔥 Starting cache warm-up...');
    
    // Warm up cache on mount
    const warmUp = async () => {
      try {
        const promises = [warmUpCache(practiceId)];
        
        // If we have practice data, prefetch common data
        if (practice?.practice_type && practice?.branches?.[0]?.id) {
          promises.push(prefetchCommonData(practice.practice_type, practice.branches[0].id));
        }
        
        await Promise.all(promises);
        console.log('✅ Initial cache warm-up complete');
        
        // Log initial stats
        const stats = superchargedCache.getStats();
        console.log('📊 Initial cache stats:', stats);
      } catch (error) {
        console.error('Cache warm-up failed:', error);
      }
    };
    
    warmUp();
    
    // Monitor cache performance
    const interval = setInterval(() => {
      const stats = superchargedCache.getStats();
      if (stats.totalHits > 0) {
        const hitRate = (stats.totalHits / (stats.totalHits + stats.entries)) * 100;
        console.log(`📈 Cache performance: ${hitRate.toFixed(1)}% hit rate, ${stats.entries} entries`);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [practiceId, practice]);
  
  return null;
}