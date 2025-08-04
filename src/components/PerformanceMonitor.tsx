import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { lightningCache } from '../lib/lightningCache';

interface PerformanceStats {
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  averageResponseTime: number;
  slowQueries: number;
  totalQueries: number;
  sessionCacheHits: number;
  activeCacheEntries: number;
}

export const PerformanceMonitor: React.FC = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    cacheHits: 0,
    cacheMisses: 0,
    cacheHitRate: 0,
    averageResponseTime: 0,
    slowQueries: 0,
    totalQueries: 0,
    sessionCacheHits: 0,
    activeCacheEntries: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const updateStats = () => {
      const cacheStats = lightningCache.getStats();
      const supabaseStats = (window as any).__supabaseStats || { 
        getSlowQueries: () => 0, 
        getTotalQueries: () => 0 
      };

      setStats({
        cacheHits: cacheStats.hits,
        cacheMisses: cacheStats.misses,
        cacheHitRate: cacheStats.hitRate,
        averageResponseTime: cacheStats.avgResponseTime,
        slowQueries: supabaseStats.getSlowQueries(),
        totalQueries: supabaseStats.getTotalQueries(),
        sessionCacheHits: parseInt(localStorage.getItem('session_cache_hits') || '0'),
        activeCacheEntries: cacheStats.size
      });
    };

    updateStats();
    const interval = setInterval(updateStats, 2000); // Update every 2 seconds

    return () => clearInterval(interval);
  }, []);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-2 bg-blue-500 text-white rounded-lg shadow-lg hover:bg-blue-600 transition-colors z-50"
        title="Show Performance Monitor"
      >
        <Icon icon="solar:chart-bold-duotone" className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-4 z-50 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon icon="solar:speedometer-bold-duotone" className="w-5 h-5 text-blue-500" />
          Performance Monitor
        </h3>
        <button
          onClick={() => setIsVisible(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3 text-sm">
        {/* Cache Performance */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <span className="text-gray-600 dark:text-gray-400">Cache Hit Rate</span>
            <span className={`font-semibold ${stats.cacheHitRate > 80 ? 'text-green-600' : stats.cacheHitRate > 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.cacheHitRate}%
            </span>
          </div>
          <div className="flex gap-1 text-xs">
            <span className="text-green-600">Hits: {stats.cacheHits}</span>
            <span className="text-gray-400">|</span>
            <span className="text-red-600">Misses: {stats.cacheMisses}</span>
          </div>
        </div>

        {/* Response Time */}
        <div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Avg Response Time</span>
            <span className={`font-semibold ${stats.averageResponseTime < 50 ? 'text-green-600' : stats.averageResponseTime < 200 ? 'text-yellow-600' : 'text-red-600'}`}>
              {stats.averageResponseTime.toFixed(0)}ms
            </span>
          </div>
        </div>

        {/* Query Performance */}
        <div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Slow Queries</span>
            <span className={`font-semibold ${stats.slowQueries === 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.slowQueries}/{stats.totalQueries}
            </span>
          </div>
        </div>

        {/* Session Cache */}
        <div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Session Cache Hits</span>
            <span className="font-semibold text-blue-600">{stats.sessionCacheHits}</span>
          </div>
        </div>

        {/* Active Cache Entries */}
        <div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600 dark:text-gray-400">Active Cache Entries</span>
            <span className="font-semibold text-gray-700 dark:text-gray-300">{stats.activeCacheEntries}</span>
          </div>
        </div>
      </div>

      {/* Performance Status */}
      <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          {stats.averageResponseTime < 50 && stats.cacheHitRate > 80 ? (
            <>
              <Icon icon="solar:double-alt-arrow-up-bold-duotone" className="w-5 h-5 text-green-500" />
              <span className="text-sm font-semibold text-green-600">Lightning Fast!</span>
            </>
          ) : stats.averageResponseTime < 200 && stats.cacheHitRate > 50 ? (
            <>
              <Icon icon="solar:alt-arrow-up-bold-duotone" className="w-5 h-5 text-yellow-500" />
              <span className="text-sm font-semibold text-yellow-600">Good Performance</span>
            </>
          ) : (
            <>
              <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-5 h-5 text-red-500" />
              <span className="text-sm font-semibold text-red-600">Needs Optimization</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
};