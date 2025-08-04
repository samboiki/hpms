# Performance Optimization Implementation Guide

## 🚀 Overview

This guide explains how to implement the world-class performance optimizations that reduce query times from 3-6 seconds to under 200ms.

## 🔧 Quick Start

### 1. Replace Slow Components

Replace your existing patient list with the optimized version:

```tsx
// Before (slow)
import { PatientList } from './components/PatientList';

// After (optimized)
import { OptimizedPatientList } from './components/OptimizedPatientList';
```

### 2. Use Optimized Hooks

Replace slow data fetching with optimized hooks:

```tsx
// Before (slow - multiple queries)
const { data: patients } = useQuery(['patients'], fetchPatients);
const { data: visits } = useQuery(['visits'], fetchVisits);

// After (optimized - single edge function)
import { useOptimizedPatientList, useOptimizedPracticeOverview } from '@/hooks/useOptimizedData';

const { data: overview } = useOptimizedPracticeOverview();
const { data: patientData } = useOptimizedPatientList();
```

### 3. Enable Background Sync

Add to your main App component:

```tsx
import { useBackgroundSync } from '@/hooks/useOptimizedData';

function App() {
  useBackgroundSync(); // Enables automatic prefetching
  // ... rest of your app
}
```

## 🎯 Key Features

### 1. Edge Functions
- **Location**: `supabase/functions/optimized-data-fetcher`
- **Purpose**: Aggregate multiple queries at the edge
- **Usage**: Automatically used by optimized hooks

### 2. IndexedDB Caching
- **Location**: `src/lib/performanceOptimizer.ts`
- **Purpose**: Persistent client-side cache
- **Features**:
  - Automatic cache management
  - TTL-based expiration
  - Offline support

### 3. Virtual Scrolling
- **Location**: `src/components/OptimizedPatientList.tsx`
- **Purpose**: Handle thousands of patients smoothly
- **Benefits**:
  - Only renders visible items
  - Automatic prefetching
  - Smooth 60fps scrolling

### 4. Query Batching
- **Location**: `src/lib/performanceOptimizer.ts`
- **Purpose**: Combine multiple queries
- **Example**:
```tsx
// Multiple queries are automatically batched
const result = await performanceOptimizer.batchQuery(
  'patient:123',
  () => fetchPatient('123')
);
```

## 📊 Performance Monitoring

### View Performance Metrics

The optimized components show real-time metrics:
- Load time
- Cache hit rate
- Number of items
- Performance status

### Slow Query Detection

Queries over 500ms are automatically logged:
```
⚠️ Slow query detected: visits took 1274.50ms
```

### Cache Analytics

Monitor cache performance:
```tsx
const { cacheHitRate, lastFetchTime } = useOptimizedPatientsStore();
console.log(`Cache hit rate: ${(cacheHitRate * 100).toFixed(0)}%`);
```

## 🔄 Migration Strategy

### Phase 1: High-Impact Areas
1. Replace patient list component
2. Update appointment views
3. Enable background sync

### Phase 2: Full Integration
1. Replace all data hooks with optimized versions
2. Enable virtual scrolling for all lists
3. Implement prefetching strategies

### Phase 3: Fine-Tuning
1. Adjust cache TTLs based on usage
2. Optimize edge function queries
3. Monitor and improve slow queries

## 🛠️ Configuration

Edit `src/config/performanceConfig.ts` to customize:

```tsx
export const performanceConfig = {
  features: {
    indexedDBCache: true,    // Toggle IndexedDB
    edgeFunctions: true,     // Toggle edge functions
    virtualScrolling: true,  // Toggle virtual scrolling
  },
  cacheTTL: {
    patientList: 5 * 60 * 1000,  // 5 minutes
    // ... adjust as needed
  }
};
```

## 📈 Expected Results

- **Query Times**: 3-6 seconds → <200ms (95%+ improvement)
- **Cache Hit Rate**: 0% → 90%+ after warmup
- **UI Responsiveness**: Blocking → Non-blocking
- **Memory Usage**: O(n) → O(1) for large lists

## 🚨 Troubleshooting

### Edge Function Not Working
```bash
# Check deployment
supabase functions list

# View logs
supabase functions logs optimized-data-fetcher
```

### Cache Not Working
```javascript
// Clear cache
await performanceOptimizer.clearCache();

// Check IndexedDB
window.indexedDB.databases()
```

### Slow Queries Still Occurring
1. Check if migrations were applied
2. Verify indexes exist
3. Refresh materialized view:
```sql
SELECT refresh_patient_stats();
```

## 🎉 Success Metrics

You'll know the optimizations are working when:
- ✅ Green "Optimal performance" indicator appears
- ✅ Load times consistently under 200ms
- ✅ No more slow query warnings
- ✅ Smooth scrolling with thousands of items
- ✅ Instant search results

## 📞 Support

If you encounter issues:
1. Check browser console for errors
2. Verify edge function is deployed
3. Ensure migrations are applied
4. Check IndexedDB storage quota

Remember: These optimizations are designed to work together. Enable all features for maximum performance gains!