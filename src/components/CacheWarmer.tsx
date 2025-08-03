import { useEffect } from 'react';
import { warmUpCache } from '../lib/cachedQueries';
import { superchargedCache } from '../lib/superchargedCache';

/**
 * Component that warms up the cache on app start
 * and displays cache statistics
 */
export function CacheWarmer() {
  useEffect(() => {
    console.log('🔥 Starting cache warm-up...');
    
    // Warm up cache on mount
    warmUpCache().then(() => {
      console.log('✅ Initial cache warm-up complete');
      
      // Log initial stats
      const stats = superchargedCache.getStats();
      console.log('📊 Initial cache stats:', stats);
    });
    
    // Monitor cache performance
    const interval = setInterval(() => {
      const stats = superchargedCache.getStats();
      if (stats.totalHits > 0) {
        const hitRate = (stats.totalHits / (stats.totalHits + stats.entries)) * 100;
        console.log(`📈 Cache performance: ${hitRate.toFixed(1)}% hit rate, ${stats.entries} entries`);
      }
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, []);
  
  return null;
}