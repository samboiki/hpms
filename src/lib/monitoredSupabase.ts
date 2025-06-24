import { supabase } from './supabase';
import { performanceMonitor } from '../utils/performanceMonitor';

// Extend the Supabase client with performance monitoring
export const monitoredSupabase = new Proxy(supabase, {
  get(target, prop) {
    if (prop === 'from') {
      return (table: string) => {
        const tableProxy = target.from(table);
        
        return new Proxy(tableProxy, {
          get(tableTarget, tableProp) {
            const originalMethod = tableTarget[tableProp as keyof typeof tableTarget];
            
            if (typeof originalMethod === 'function') {
              return (...args: any[]) => {
                const startTime = performance.now();
                const operation = tableProp.toString();
                
                const result = originalMethod.apply(tableTarget, args);
                
                // Intercept the actual query execution
                if (result && typeof result.then === 'function') {
                  return result.then(
                    (response: any) => {
                      const duration = performance.now() - startTime;
                      performanceMonitor.recordQuery(
                        `${table}.${operation}`,
                        duration,
                        table,
                        operation
                      );
                      
                      // Log slow queries
                      if (duration > 1000) {
                        console.warn(`⚠️ Slow query on ${table}: ${duration.toFixed(2)}ms`);
                      }
                      
                      return response;
                    },
                    (error: any) => {
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
                
                return result;
              };
            }
            
            return originalMethod;
          }
        });
      };
    }
    
    // For RPC calls
    if (prop === 'rpc') {
      return (fnName: string, params?: any) => {
        const startTime = performance.now();
        
        return target.rpc(fnName, params).then(
          response => {
            const duration = performance.now() - startTime;
            performanceMonitor.recordQuery(
              `rpc.${fnName}`,
              duration,
              'rpc',
              fnName
            );
            
            if (duration > 1000) {
              console.warn(`⚠️ Slow RPC call ${fnName}: ${duration.toFixed(2)}ms`);
            }
            
            return response;
          },
          error => {
            const duration = performance.now() - startTime;
            performanceMonitor.recordQuery(
              `rpc.${fnName} (failed)`,
              duration,
              'rpc',
              fnName
            );
            throw error;
          }
        );
      };
    }
    
    return target[prop as keyof typeof target];
  }
});

// Export performance utilities
export { performanceMonitor } from '../utils/performanceMonitor';