import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { supabase } from './supabase';

// IndexedDB schema
interface HPMSCacheDB extends DBSchema {
  queryCache: {
    key: string;
    value: {
      key: string;
      data: any;
      timestamp: number;
      ttl: number;
    };
  };
  patientCache: {
    key: string;
    value: {
      id: string;
      data: any;
      timestamp: number;
      visitCount?: number;
      lastVisitDate?: string;
    };
  };
  prefetchQueue: {
    key: string;
    value: {
      key: string;
      queryFn: string;
      priority: number;
      timestamp: number;
    };
  };
}

class PerformanceOptimizer {
  private db: IDBPDatabase<HPMSCacheDB> | null = null;
  private initialized = false;
  private prefetchWorker: Worker | null = null;
  private batchQueue = new Map<string, Promise<any>>();
  private batchTimeout: number | null = null;

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize IndexedDB
      this.db = await openDB<HPMSCacheDB>('hpms-cache', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('queryCache')) {
            db.createObjectStore('queryCache', { keyPath: 'key' });
          }
          if (!db.objectStoreNames.contains('patientCache')) {
            const patientStore = db.createObjectStore('patientCache', { keyPath: 'id' });
            patientStore.createIndex('timestamp', 'timestamp');
          }
          if (!db.objectStoreNames.contains('prefetchQueue')) {
            db.createObjectStore('prefetchQueue', { keyPath: 'key' });
          }
        },
      });

      // Clean up old cache entries
      await this.cleanupCache();
      
      this.initialized = true;
      console.log('🚀 Performance Optimizer initialized with IndexedDB');
    } catch (error) {
      console.error('Failed to initialize Performance Optimizer:', error);
    }
  }

  // Smart caching with IndexedDB
  async getCachedOrFetch<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttl: number = 5 * 60 * 1000 // 5 minutes default
  ): Promise<T> {
    await this.initialize();
    
    if (this.db) {
      try {
        // Check cache first
        const cached = await this.db.get('queryCache', key);
        if (cached && Date.now() - cached.timestamp < cached.ttl) {
          console.log(`✨ Cache hit for ${key}`);
          return cached.data;
        }
      } catch (error) {
        console.error('Cache read error:', error);
      }
    }

    // Fetch fresh data
    console.log(`🔄 Cache miss for ${key}, fetching...`);
    const startTime = performance.now();
    const data = await fetchFn();
    const fetchTime = performance.now() - startTime;
    
    // Store in cache
    if (this.db) {
      try {
        await this.db.put('queryCache', {
          key,
          data,
          timestamp: Date.now(),
          ttl
        });
      } catch (error) {
        console.error('Cache write error:', error);
      }
    }

    // Log slow queries
    if (fetchTime > 500) {
      console.warn(`⚠️ Slow query detected: ${key} took ${fetchTime.toFixed(2)}ms`);
      this.scheduleOptimization(key, fetchTime);
    }

    return data;
  }

  // Batch multiple queries into a single request
  async batchQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    batchDelay: number = 50
  ): Promise<T> {
    // Check if we already have a pending batch for this query
    if (this.batchQueue.has(queryKey)) {
      return this.batchQueue.get(queryKey)!;
    }

    // Create a new batch promise
    const batchPromise = new Promise<T>((resolve, reject) => {
      // Clear existing timeout
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
      }

      // Set new timeout to execute batch
      this.batchTimeout = window.setTimeout(() => {
        this.executeBatch().catch(reject);
      }, batchDelay);

      // Store resolver for this query
      this.batchQueue.set(queryKey, { resolve, reject, queryFn });
    });

    return batchPromise;
  }

  private async executeBatch() {
    const batch = Array.from(this.batchQueue.entries());
    this.batchQueue.clear();
    this.batchTimeout = null;

    // Group similar queries
    const groupedQueries = this.groupQueries(batch);
    
    // Execute grouped queries in parallel
    await Promise.all(
      groupedQueries.map(async (group) => {
        try {
          const results = await this.executeGroupedQuery(group);
          group.forEach((item, index) => {
            item.resolver.resolve(results[index]);
          });
        } catch (error) {
          group.forEach(item => item.resolver.reject(error));
        }
      })
    );
  }

  private groupQueries(queries: any[]): any[][] {
    // Group by query type for optimal batching
    const groups = new Map<string, any[]>();
    
    queries.forEach(([key, data]) => {
      const queryType = key.split(':')[0];
      if (!groups.has(queryType)) {
        groups.set(queryType, []);
      }
      groups.get(queryType)!.push({ key, ...data });
    });

    return Array.from(groups.values());
  }

  private async executeGroupedQuery(group: any[]): Promise<any[]> {
    // This would be customized based on query type
    // For now, execute in parallel
    return Promise.all(group.map(item => item.queryFn()));
  }

  // Optimized data fetcher using Edge Function
  async fetchOptimized(
    type: 'practice_overview' | 'patient_list' | 'appointments_today' | 'patient_details',
    params: any
  ) {
    const cacheKey = `${type}:${JSON.stringify(params)}`;
    
    return this.getCachedOrFetch(
      cacheKey,
      async () => {
        const { data, error } = await supabase.functions.invoke('optimized-data-fetcher', {
          body: { type, ...params }
        });
        
        if (error) throw error;
        return data;
      },
      this.getCacheTTL(type)
    );
  }

  private getCacheTTL(type: string): number {
    const ttlMap: Record<string, number> = {
      'practice_overview': 30 * 60 * 1000, // 30 minutes
      'patient_list': 5 * 60 * 1000,      // 5 minutes
      'appointments_today': 60 * 1000,     // 1 minute
      'patient_details': 10 * 60 * 1000   // 10 minutes
    };
    return ttlMap[type] || 5 * 60 * 1000;
  }

  // Background prefetching
  async prefetchData(practiceId: string) {
    if (!this.initialized) await this.initialize();
    
    // Prefetch common data in background
    const prefetchTasks = [
      () => this.fetchOptimized('practice_overview', { practiceId }),
      () => this.fetchOptimized('patient_list', { practiceId, includeVisitCounts: true }),
      () => this.fetchOptimized('appointments_today', { 
        practiceId, 
        date: new Date().toISOString().split('T')[0] 
      })
    ];

    // Execute prefetch tasks with low priority
    prefetchTasks.forEach((task, index) => {
      setTimeout(() => {
        task().catch(error => {
          console.error('Prefetch error:', error);
        });
      }, index * 1000); // Stagger requests
    });
  }

  // Clean up old cache entries
  private async cleanupCache() {
    if (!this.db) return;
    
    const now = Date.now();
    const tx = this.db.transaction('queryCache', 'readwrite');
    const store = tx.objectStore('queryCache');
    
    const allKeys = await store.getAllKeys();
    const deletePromises = allKeys.map(async (key) => {
      const item = await store.get(key);
      if (item && now - item.timestamp > item.ttl) {
        await store.delete(key);
      }
    });
    
    await Promise.all(deletePromises);
    await tx.done;
  }

  // Schedule optimization for slow queries
  private scheduleOptimization(queryKey: string, queryTime: number) {
    // In production, this would send telemetry to optimize slow queries
    console.log(`📊 Scheduling optimization for ${queryKey} (${queryTime.toFixed(2)}ms)`);
  }

  // Virtual scrolling helper
  createVirtualList<T>(
    items: T[],
    itemHeight: number,
    containerHeight: number,
    scrollTop: number
  ): { visibleItems: T[]; offsetY: number; totalHeight: number } {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
    const visibleItems = items.slice(startIndex, endIndex);
    
    return {
      visibleItems,
      offsetY: startIndex * itemHeight,
      totalHeight: items.length * itemHeight
    };
  }
}

export const performanceOptimizer = new PerformanceOptimizer();

// Export convenience hooks
export function useOptimizedQuery<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options?: { ttl?: number; enabled?: boolean }
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!options?.enabled ?? true) return;
    
    let cancelled = false;
    
    const fetch = async () => {
      setLoading(true);
      try {
        const result = await performanceOptimizer.getCachedOrFetch(
          key,
          fetchFn,
          options?.ttl
        );
        if (!cancelled) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err as Error);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetch();
    
    return () => {
      cancelled = true;
    };
  }, [key, options?.enabled]);

  return { data, loading, error };
}

// Connection pooling for Supabase
class ConnectionPool {
  private connections: Map<string, any> = new Map();
  private maxConnections = 5;

  async getConnection(key: string, factory: () => any) {
    if (!this.connections.has(key)) {
      if (this.connections.size >= this.maxConnections) {
        // Remove oldest connection
        const firstKey = this.connections.keys().next().value;
        this.connections.delete(firstKey);
      }
      this.connections.set(key, factory());
    }
    return this.connections.get(key);
  }
}

export const connectionPool = new ConnectionPool();

import { useEffect, useState } from 'react';