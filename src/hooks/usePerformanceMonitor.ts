/**
 * Performance Monitor Hook
 *
 * Monitors query performance and provides UI feedback for slow connections
 */

import { useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { localCache } from '../services/localCacheService';

export function usePerformanceMonitor(componentName: string) {
  const hasShownWarning = useRef(false);

  useEffect(() => {
    // Check if we've detected slow queries
    const checkPerformance = () => {
      const lastSlowQuery = localStorage.getItem('last_slow_query');

      if (lastSlowQuery && !hasShownWarning.current) {
        const { queryTime, timestamp } = JSON.parse(lastSlowQuery);
        const age = Date.now() - timestamp;

        // If slow query was recent (within last minute)
        if (age < 60000 && queryTime > 3000) {
          hasShownWarning.current = true;

          // Show performance warning
          toast.error(
            `Slow Network Detected! Queries are taking ${(queryTime/1000).toFixed(1)}s. Using local cache to speed things up!`,
            {
              duration: 10000,
              id: 'slow-network-warning'
            }
          );

          // Also log cache stats
          const stats = localCache.getStats();
          console.log('Cache Statistics:', stats);

          if (stats.totalEntries > 0) {
            console.log('Using cached data to bypass slow network');
            toast.success(
              `Using ${stats.totalEntries} cached entries for faster performance`,
              { id: 'cache-active' }
            );
          }
        }
      }
    };

    checkPerformance();

    // Check periodically
    const interval = setInterval(checkPerformance, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, [componentName]);

  // Return utility functions
  return {
    recordSlowQuery: (queryName: string, duration: number) => {
      if (duration > 2000) {
        localStorage.setItem('last_slow_query', JSON.stringify({
          queryName,
          queryTime: duration,
          timestamp: Date.now()
        }));

        console.log(`SLOW QUERY: ${queryName} took ${(duration/1000).toFixed(1)}s`);
      }
    },

    showCacheStatus: () => {
      const stats = localCache.getStats();
      toast.success(
        `Cache Status - Entries: ${stats.totalEntries}, Size: ${(stats.totalSize / 1024).toFixed(1)}KB`,
        { duration: 3000 }
      );
    }
  };
}

// Global performance tracking
export function trackQueryPerformance(queryName: string, startTime: number) {
  const duration = performance.now() - startTime;

  if (duration > 2000) {
    localStorage.setItem('last_slow_query', JSON.stringify({
      queryName,
      queryTime: duration,
      timestamp: Date.now()
    }));

    console.warn(`Warning: Slow query detected: ${queryName} took ${duration.toFixed(0)}ms`);
  }

  return duration;
}