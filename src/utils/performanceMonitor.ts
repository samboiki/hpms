interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: number;
  table?: string;
  operation?: string;
}

interface PerformanceReport {
  totalQueries: number;
  averageDuration: number;
  slowQueries: QueryMetrics[];
  queryByTable: Record<string, { count: number; avgDuration: number }>;
  duplicateQueries: Record<string, number>;
}

class PerformanceMonitor {
  private queries: QueryMetrics[] = [];
  private enabled: boolean = false;
  private slowQueryThreshold: number = 500; // 500ms

  enable() {
    this.enabled = true;
    console.log('🔍 Performance monitoring enabled');
  }

  disable() {
    this.enabled = false;
    console.log('🔍 Performance monitoring disabled');
  }

  recordQuery(query: string, duration: number, table?: string, operation?: string) {
    if (!this.enabled) return;

    const metric: QueryMetrics = {
      query,
      duration,
      timestamp: Date.now(),
      table,
      operation
    };

    this.queries.push(metric);

    // Log slow queries immediately
    if (duration > this.slowQueryThreshold) {
      console.warn(`⚠️ Slow query detected (${duration.toFixed(2)}ms):`, {
        table,
        operation,
        query: query.substring(0, 100) + '...'
      });
    }

    // Keep only last 1000 queries
    if (this.queries.length > 1000) {
      this.queries = this.queries.slice(-1000);
    }
  }

  getReport(): PerformanceReport {
    if (this.queries.length === 0) {
      return {
        totalQueries: 0,
        averageDuration: 0,
        slowQueries: [],
        queryByTable: {},
        duplicateQueries: {}
      };
    }

    const totalDuration = this.queries.reduce((sum, q) => sum + q.duration, 0);
    const averageDuration = totalDuration / this.queries.length;

    // Find slow queries
    const slowQueries = this.queries
      .filter(q => q.duration > this.slowQueryThreshold)
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10);

    // Group by table
    const queryByTable: Record<string, { count: number; avgDuration: number; totalDuration: number }> = {};
    this.queries.forEach(q => {
      if (q.table) {
        if (!queryByTable[q.table]) {
          queryByTable[q.table] = { count: 0, avgDuration: 0, totalDuration: 0 };
        }
        queryByTable[q.table].count++;
        queryByTable[q.table].totalDuration += q.duration;
      }
    });

    // Calculate averages for each table
    Object.keys(queryByTable).forEach(table => {
      queryByTable[table].avgDuration = queryByTable[table].totalDuration / queryByTable[table].count;
    });

    // Find duplicate queries
    const queryCount: Record<string, number> = {};
    this.queries.forEach(q => {
      const key = `${q.table}-${q.operation}`;
      queryCount[key] = (queryCount[key] || 0) + 1;
    });

    const duplicateQueries = Object.entries(queryCount)
      .filter(([_, count]) => count > 5)
      .reduce((acc, [key, count]) => {
        acc[key] = count;
        return acc;
      }, {} as Record<string, number>);

    return {
      totalQueries: this.queries.length,
      averageDuration,
      slowQueries,
      queryByTable,
      duplicateQueries
    };
  }

  printReport() {
    const report = this.getReport();
    
    console.group('📊 Performance Report');
    console.log(`Total Queries: ${report.totalQueries}`);
    console.log(`Average Duration: ${report.averageDuration.toFixed(2)}ms`);
    
    if (report.slowQueries.length > 0) {
      console.group('🐌 Slow Queries');
      report.slowQueries.forEach(q => {
        console.log(`${q.duration.toFixed(2)}ms - ${q.table} - ${q.operation}`);
      });
      console.groupEnd();
    }

    console.group('📈 Queries by Table');
    Object.entries(report.queryByTable).forEach(([table, stats]) => {
      console.log(`${table}: ${stats.count} queries, avg ${stats.avgDuration.toFixed(2)}ms`);
    });
    console.groupEnd();

    if (Object.keys(report.duplicateQueries).length > 0) {
      console.group('🔁 Duplicate Queries');
      Object.entries(report.duplicateQueries).forEach(([query, count]) => {
        console.log(`${query}: ${count} times`);
      });
      console.groupEnd();
    }

    console.groupEnd();
  }

  clear() {
    this.queries = [];
    console.log('🧹 Performance metrics cleared');
  }
}

// Singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Supabase query wrapper with performance monitoring
export function monitoredQuery<T>(
  queryFn: () => Promise<T>,
  table: string,
  operation: string
): Promise<T> {
  const startTime = performance.now();
  
  return queryFn().then(
    result => {
      const duration = performance.now() - startTime;
      performanceMonitor.recordQuery(
        `${table}.${operation}`,
        duration,
        table,
        operation
      );
      return result;
    },
    error => {
      const duration = performance.now() - startTime;
      performanceMonitor.recordQuery(
        `${table}.${operation} (failed)`,
        duration,
        table,
        operation
      );
      throw error;
    }
  );
}

// Enable monitoring in development
if (import.meta.env.DEV) {
  performanceMonitor.enable();
  
  // Print report every 5 minutes in development
  setInterval(() => {
    performanceMonitor.printReport();
  }, 5 * 60 * 1000);
}