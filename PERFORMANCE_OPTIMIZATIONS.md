# Performance Optimizations for HPMS Dashboard

## Overview
This document outlines the performance optimizations implemented to address slow dashboard loading times and redundant database queries.

## Problems Identified
1. **Slow Queries**: Multiple queries taking 1-2+ seconds
   - users table: 1814ms
   - practices table: 1844ms, 2607ms
   - visits table: 960ms
   - patients table: 1002ms, 1766ms
   - appointments: 713ms

2. **Redundant Queries**: Multiple duplicate queries for the same data
3. **N+1 Query Problems**: Separate queries for related data instead of joins
4. **No Caching**: Every page load triggers all queries again
5. **Unoptimized Indexes**: Missing indexes for common query patterns

## Solutions Implemented

### 1. Materialized View for Dashboard Statistics
Created `dashboard_stats_mv` that pre-calculates all dashboard metrics:
- Patient statistics (total, gender breakdown, new patients)
- Visit statistics (total, completed, pending, in-progress)
- Appointment statistics
- Invoice/financial statistics
- Automatically refreshes every 5 minutes

### 2. Optimized Database Indexes
Added composite indexes for common query patterns:
```sql
-- Composite indexes for better performance
CREATE INDEX idx_visits_composite ON visits(practice_id, scheduled_date, status, is_cancelled);
CREATE INDEX idx_patients_composite ON patients(practice_id, created_at, gender);
CREATE INDEX idx_patients_practice_created ON patients(practice_id, created_at);
CREATE INDEX idx_visits_practice_date ON visits(practice_id, scheduled_date);
```

### 3. Caching Strategy
Implemented multi-level caching:
- **Memory Cache**: 1-minute cache for dashboard stats
- **Auth Context Cache**: 30-minute cache for user authentication
- **Practice Data Cache**: 5-minute cache for doctors, patients, appointments

### 4. Optimized Data Fetching
- **Parallel Queries**: All dashboard queries execute in parallel using `Promise.all`
- **Single RPC Call**: Dashboard stats fetched via optimized `get_dashboard_stats` function
- **Batched Queries**: Combined multiple queries into single database round trips
- **Limited Results**: Added reasonable limits (e.g., 500 recent patients instead of all)

### 5. Performance Monitoring
Added comprehensive performance monitoring:
- Query duration tracking
- Slow query warnings (>500ms)
- Duplicate query detection
- Performance reports in development mode

## Implementation Details

### Files Created/Modified

1. **Database Migration**
   - `/supabase/migrations/20240124_optimize_dashboard_performance.sql`
   - Creates materialized view and indexes

2. **Optimized Hooks**
   - `/src/hooks/useOptimizedDashboardStats.ts`
   - Replaces multiple individual queries with single optimized call

3. **Optimized Services**
   - `/src/lib/optimizedPracticeDataService.ts`
   - Implements caching and batched queries

4. **Performance Monitoring**
   - `/src/utils/performanceMonitor.ts`
   - Tracks query performance metrics
   - `/src/lib/monitoredSupabase.ts`
   - Wraps Supabase client with monitoring

5. **Dashboard Updates**
   - Modified `/src/pages/Dashboard.tsx` to use optimized services

## How to Apply

1. **Apply Database Migration**:
   ```bash
   node apply-performance-optimizations.js
   ```

2. **Update Code**:
   The dashboard will automatically use the optimized services and hooks.

3. **Monitor Performance**:
   - Open browser console in development mode
   - Performance reports print every 5 minutes
   - Watch for slow query warnings

## Expected Results

### Before Optimization
- Dashboard load time: 3-5 seconds
- Multiple queries: 10-15 separate database calls
- Query times: 700-2600ms per query

### After Optimization
- Dashboard load time: <500ms (after initial load)
- Single optimized query for stats
- Query times: 50-200ms
- Cached results for subsequent loads

## Maintenance

1. **Refresh Materialized View**:
   - Automatically refreshes via the `refresh_dashboard_stats()` function
   - Can be manually refreshed: `SELECT refresh_dashboard_stats();`

2. **Clear Caches**:
   ```javascript
   // Clear all caches
   optimizedPracticeDataService.clearCache();
   
   // Clear specific practice cache
   optimizedPracticeDataService.clearPracticeCache(practiceId);
   ```

3. **Monitor Performance**:
   ```javascript
   // Enable monitoring
   performanceMonitor.enable();
   
   // Print performance report
   performanceMonitor.printReport();
   
   // Clear metrics
   performanceMonitor.clear();
   ```

## Future Optimizations

1. **Redis Caching**: Implement Redis for distributed caching
2. **GraphQL**: Consider GraphQL for more efficient data fetching
3. **Pagination**: Implement cursor-based pagination for large datasets
4. **Background Jobs**: Move heavy calculations to background workers
5. **CDN**: Cache static assets and API responses at edge locations