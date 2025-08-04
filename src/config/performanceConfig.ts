// Performance optimization configuration
export const performanceConfig = {
  // Enable/disable optimizations
  features: {
    indexedDBCache: true,
    edgeFunctions: true,
    virtualScrolling: true,
    backgroundSync: true,
    queryBatching: true,
    materializedViews: true,
  },
  
  // Cache TTL settings (in milliseconds)
  cacheTTL: {
    practiceOverview: 30 * 60 * 1000,    // 30 minutes
    patientList: 5 * 60 * 1000,          // 5 minutes
    appointmentsToday: 60 * 1000,        // 1 minute
    patientDetails: 10 * 60 * 1000,      // 10 minutes
    visitDetails: 30 * 60 * 1000,        // 30 minutes
    practiceSettings: 24 * 60 * 60 * 1000 // 24 hours
  },
  
  // Query performance thresholds
  thresholds: {
    slowQueryWarning: 500,    // ms - warn if query takes longer
    slowQueryError: 2000,     // ms - error if query takes longer
    batchDelay: 50,          // ms - delay before executing batch
    prefetchDelay: 100,      // ms - delay between prefetch requests
  },
  
  // Virtual scrolling settings
  virtualScroll: {
    itemHeight: 60,          // px - height of each item
    overscan: 5,             // number of items to render outside viewport
    scrollDebounce: 50,      // ms - debounce scroll events
  },
  
  // Background sync settings
  backgroundSync: {
    interval: 5 * 60 * 1000,         // 5 minutes
    staleDataThreshold: 2 * 60 * 1000, // 2 minutes
    maxRetries: 3,
  },
  
  // Edge function endpoints
  edgeFunctions: {
    optimizedDataFetcher: '/functions/v1/optimized-data-fetcher',
  },
  
  // IndexedDB settings
  indexedDB: {
    dbName: 'hpms-cache',
    version: 1,
    stores: ['queryCache', 'patientCache', 'prefetchQueue'],
    cleanupInterval: 60 * 60 * 1000, // 1 hour
  }
};

// Helper to check if a feature is enabled
export function isFeatureEnabled(feature: keyof typeof performanceConfig.features): boolean {
  return performanceConfig.features[feature] ?? false;
}

// Helper to get cache TTL
export function getCacheTTL(key: keyof typeof performanceConfig.cacheTTL): number {
  return performanceConfig.cacheTTL[key] ?? 5 * 60 * 1000; // Default 5 minutes
}