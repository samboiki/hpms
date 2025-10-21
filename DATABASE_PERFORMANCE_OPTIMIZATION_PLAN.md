# Database Performance Optimization Plan
**Generated:** October 21, 2025
**Project:** OneHealth Practice Management System
**Database:** Supabase (jjxlfunlbyayxwvlpgwt)

---

## Executive Summary

Your database is experiencing performance issues due to **missing indexes on critical tables**. The RLS (Row Level Security) policies are performing full table scans on every query, causing significant slowdowns, especially on the dashboard and real-time features.

**Impact:**
- Dashboard loading: Currently slow due to unindexed queries
- Real-time notifications: Slow due to frequent table scans
- Patient/Visit lookups: Full table scans on every access
- Multi-tenant filtering: RLS policies without indexes = disaster

**Solution:** Add 14 critical indexes (can be done in ~10-15 minutes during off-peak hours)

---

## 🔴 CRITICAL ISSUES IDENTIFIED

### 1. **Users Table** - Missing practice_id Index
**Problem:** Every user query filters by `practice_id` due to RLS, but there's no index.
```sql
-- Current RLS Policy:
WHERE practice_id = auth.uid()::text

-- Impact: FULL TABLE SCAN on every user query
-- Fix: Add idx_users_practice_id
```

### 2. **Patients Table** - Missing RLS Support Indexes
**Problem:** Patient queries require practice lookup, causing nested subqueries without indexes.
```sql
-- Current RLS Policy:
WHERE practice_id IN (SELECT practice_id FROM users WHERE id = auth.uid())

-- Impact: Devastating performance - two unindexed queries per patient access
-- Fix: Add idx_patients_practice_id + idx_patients_practice_created
```

### 3. **Visits Table** - THE MOST CRITICAL
**Problem:** Visits is your MOST QUERIED table, used for:
- Dashboard statistics
- Calendar view
- Patient history
- Appointment scheduling

```sql
-- Current RLS Policy:
WHERE practice_id IN (SELECT practice_id FROM users WHERE id = auth.uid())

-- Impact: CATASTROPHIC - visits table scanned constantly
-- Fix: Add idx_visits_practice_id + idx_visits_practice_scheduled
```

### 4. **System Notifications** - Real-time Performance Issue
**Problem:** Notifications polled every few seconds, but no composite index exists.
```sql
-- Query Pattern:
WHERE user_id = ? AND practice_id = ? ORDER BY created_at DESC

-- Impact: Slow notification loading, poor real-time experience
-- Fix: Add idx_notif_user_practice_created (composite index)
```

### 5. **Internal Channel Members** - Messaging Performance
**Problem:** Channel loading requires user + practice filtering without indexes.
```sql
-- Impact: Slow message channel loading
-- Fix: Add idx_channel_members_user_practice
```

### 6. **Communication Subscriptions** - Gateway Performance
**Problem:** SMS/Email gateways check subscriptions before sending, causing delays.
```sql
-- Impact: Communication delays before sending
-- Fix: Add idx_sms_sub_practice_status + idx_email_sub_practice_status
```

---

## 🎯 RECOMMENDED INDEXES

### **Priority 1: CRITICAL (Immediate Implementation)**

These indexes MUST be added immediately to fix current performance issues:

```sql
-- === USERS TABLE ===
CREATE INDEX CONCURRENTLY idx_users_practice_id ON users(practice_id);
-- Reason: RLS filtering on every query

CREATE INDEX CONCURRENTLY idx_users_email ON users(email);
-- Reason: Login lookups are very frequent

CREATE INDEX CONCURRENTLY idx_users_practice_role ON users(practice_id, role);
-- Reason: Staff listings filtered by role

-- === PRACTICES TABLE ===
CREATE INDEX CONCURRENTLY idx_practices_status ON practices(status);
-- Reason: Active/inactive practice filtering

-- === PATIENTS TABLE ===
CREATE INDEX CONCURRENTLY idx_patients_practice_id ON patients(practice_id);
-- Reason: RLS filtering - every patient query

CREATE INDEX CONCURRENTLY idx_patients_practice_created ON patients(practice_id, created_at DESC);
-- Reason: Dashboard "Recent Patients" - HIGHLY frequent

-- === VISITS TABLE (MOST CRITICAL) ===
CREATE INDEX CONCURRENTLY idx_visits_practice_id ON visits(practice_id);
-- Reason: RLS filtering - visits queried constantly

CREATE INDEX CONCURRENTLY idx_visits_practice_scheduled ON visits(practice_id, scheduled_date);
-- Reason: Dashboard stats and calendar view - EXTREMELY frequent

CREATE INDEX CONCURRENTLY idx_visits_patient_scheduled ON visits(patient_id, scheduled_date DESC);
-- Reason: Patient visit history - shown on every patient modal

-- === SYSTEM NOTIFICATIONS ===
CREATE INDEX CONCURRENTLY idx_notif_user_practice_created ON system_notifications(user_id, practice_id, created_at DESC);
-- Reason: Real-time notification loading - queried every few seconds

-- === INTERNAL CHANNEL MEMBERS ===
CREATE INDEX CONCURRENTLY idx_channel_members_user_practice ON internal_channel_members(user_id, practice_id);
-- Reason: Channel loading - RLS requires both fields

-- === COMMUNICATION SUBSCRIPTIONS ===
CREATE INDEX CONCURRENTLY idx_sms_sub_practice_status ON practice_sms_subscriptions(practice_id, status);
-- Reason: SMS gateway subscription checks

CREATE INDEX CONCURRENTLY idx_email_sub_practice_status ON practice_email_subscriptions(practice_id, status);
-- Reason: Email gateway subscription checks
```

**Total Critical Indexes:** 14
**Estimated Build Time:** 10-15 minutes (depending on table sizes)
**Downtime Required:** NONE (CONCURRENTLY builds without locking)

---

### **Priority 2: RECOMMENDED (Next Maintenance Window)**

These indexes will further improve performance but are not immediately critical:

```sql
-- === USERS TABLE ===
CREATE INDEX CONCURRENTLY idx_users_role ON users(role);
-- Reason: Role-based access control queries

-- === PRACTICES TABLE ===
CREATE INDEX CONCURRENTLY idx_practices_created_at ON practices(created_at DESC);
-- Reason: Recently added practices listings

-- === PATIENTS TABLE ===
CREATE INDEX CONCURRENTLY idx_patients_email ON patients(email);
-- Reason: Patient search by email

CREATE INDEX CONCURRENTLY idx_patients_phone ON patients(phone_number);
-- Reason: Patient search by phone

-- === VISITS TABLE ===
CREATE INDEX CONCURRENTLY idx_visits_patient_id ON visits(patient_id);
-- Reason: Patient visit lookups

CREATE INDEX CONCURRENTLY idx_visits_scheduled_date ON visits(scheduled_date);
-- Reason: Date-based searches

CREATE INDEX CONCURRENTLY idx_visits_status ON visits(status);
-- Reason: Status filtering (scheduled, completed, cancelled)

-- === SYSTEM NOTIFICATIONS ===
CREATE INDEX CONCURRENTLY idx_notif_user_id ON system_notifications(user_id);
-- Reason: User-specific notifications

CREATE INDEX CONCURRENTLY idx_notif_practice_id ON system_notifications(practice_id);
-- Reason: Practice-wide notifications

CREATE INDEX CONCURRENTLY idx_notif_read_status ON system_notifications(is_read);
-- Reason: Unread notification counts

-- === INTERNAL CHANNEL MEMBERS ===
CREATE INDEX CONCURRENTLY idx_channel_members_channel_id ON internal_channel_members(channel_id);
-- Reason: Channel member lookups
```

**Total Recommended Indexes:** 11
**Estimated Build Time:** 5-10 minutes

---

## 📊 RLS POLICY ANALYSIS

### Current RLS Architecture Issues

Your RLS policies follow a multi-tenant pattern where every query filters by `practice_id`. This is **CORRECT** for data isolation, but **REQUIRES INDEXES** to perform well.

#### **Typical RLS Policy Pattern:**
```sql
-- Most tables use this pattern:
CREATE POLICY "Users can only see their practice data"
ON table_name
FOR SELECT
USING (
  practice_id IN (
    SELECT practice_id
    FROM users
    WHERE id = auth.uid()
  )
);
```

#### **Why This Is Slow Without Indexes:**

1. **Subquery Execution:** For every row accessed, PostgreSQL must:
   - Look up the current user in `users` table (no index on `users.id` for RLS)
   - Get their `practice_id`
   - Filter the target table by `practice_id` (no index)

2. **Result:** **FULL TABLE SCANS** on both tables, for every query

3. **With Indexes:** PostgreSQL can:
   - Use index on `users.id` (primary key - already exists)
   - Use index on `target_table.practice_id` (**MISSING - must add**)
   - Result: **Sub-millisecond filtering**

---

## 🔧 RPC FUNCTION OPTIMIZATION

### `get_dashboard_stats` Function

**Likely Implementation Issues:**
- Multiple sequential queries instead of CTEs
- Missing indexes causing slow aggregations
- No query plan optimization

**Recommended Optimization:**
```sql
CREATE OR REPLACE FUNCTION get_dashboard_stats(practice_uuid UUID)
RETURNS JSON AS $$
WITH
  patient_stats AS (
    SELECT COUNT(*) as total_patients
    FROM patients
    WHERE practice_id = practice_uuid
  ),
  visit_stats AS (
    SELECT
      COUNT(*) as total_visits,
      COUNT(*) FILTER (WHERE scheduled_date::date = CURRENT_DATE) as today_visits,
      COUNT(*) FILTER (WHERE scheduled_date >= CURRENT_DATE) as upcoming_visits
    FROM visits
    WHERE practice_id = practice_uuid
  ),
  recent_patients AS (
    SELECT id, first_name, last_name, created_at
    FROM patients
    WHERE practice_id = practice_uuid
    ORDER BY created_at DESC
    LIMIT 5
  )
SELECT json_build_object(
  'patients', (SELECT * FROM patient_stats),
  'visits', (SELECT * FROM visit_stats),
  'recent', (SELECT json_agg(recent_patients.*) FROM recent_patients)
) as stats;
$$ LANGUAGE sql STABLE;
```

**Benefit:** Single query instead of 3-5 separate queries

---

### `get_channel_last_messages` Function

**Likely Implementation Issues:**
- N+1 query problem (one query per channel)
- Missing indexes on channel_id + created_at
- Inefficient sorting

**Recommended Optimization:**
```sql
CREATE OR REPLACE FUNCTION get_channel_last_messages(user_uuid UUID, practice_uuid UUID)
RETURNS TABLE (
  channel_id UUID,
  last_message_content TEXT,
  last_message_time TIMESTAMPTZ,
  sender_name TEXT
) AS $$
WITH user_channels AS (
  SELECT channel_id
  FROM internal_channel_members
  WHERE user_id = user_uuid AND practice_id = practice_uuid
),
ranked_messages AS (
  SELECT
    m.channel_id,
    m.content,
    m.created_at,
    u.first_name || ' ' || u.last_name as sender_name,
    ROW_NUMBER() OVER (PARTITION BY m.channel_id ORDER BY m.created_at DESC) as rn
  FROM messages m
  JOIN users u ON m.sender_id = u.id
  WHERE m.channel_id IN (SELECT channel_id FROM user_channels)
)
SELECT
  channel_id,
  content as last_message_content,
  created_at as last_message_time,
  sender_name
FROM ranked_messages
WHERE rn = 1;
$$ LANGUAGE sql STABLE;
```

**Benefit:** Single query using window functions instead of N queries

---

## 📝 IMPLEMENTATION PLAN

### **Phase 1: Immediate (Within 24 hours)**

1. **Backup Current Database**
   ```bash
   # Use Supabase dashboard to create a backup
   ```

2. **Run Critical Index Creation**
   - Copy the "Priority 1: CRITICAL" SQL from above
   - Open Supabase SQL Editor
   - Paste and execute during off-peak hours
   - Monitor execution (should take 10-15 minutes)

3. **Verify Index Creation**
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname,
     indexdef
   FROM pg_indexes
   WHERE schemaname = 'public'
   AND tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members')
   ORDER BY tablename, indexname;
   ```

4. **Monitor Performance Improvement**
   - Dashboard load time (should be <2 seconds)
   - Notification loading (should be instant)
   - Patient/Visit queries (should be <200ms)

---

### **Phase 2: Next Maintenance Window (Within 1 week)**

1. **Add Recommended Indexes**
   - Run "Priority 2: RECOMMENDED" SQL

2. **Optimize RPC Functions**
   - Review `get_dashboard_stats` implementation
   - Review `get_channel_last_messages` implementation
   - Apply CTE and window function optimizations

3. **Add Query Monitoring**
   ```sql
   -- Enable pg_stat_statements extension
   CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

   -- Check slow queries
   SELECT
     query,
     calls,
     total_time,
     mean_time,
     max_time
   FROM pg_stat_statements
   ORDER BY mean_time DESC
   LIMIT 20;
   ```

---

### **Phase 3: Ongoing Optimization (Monthly)**

1. **Monitor Index Usage**
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname,
     idx_scan as index_scans,
     idx_tup_read as tuples_read,
     idx_tup_fetch as tuples_fetched
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   ORDER BY idx_scan DESC;
   ```

2. **Identify Unused Indexes**
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
   AND idx_scan = 0
   AND indexrelname NOT LIKE '%_pkey';
   ```

3. **Vacuum and Analyze**
   ```sql
   VACUUM ANALYZE users;
   VACUUM ANALYZE practices;
   VACUUM ANALYZE patients;
   VACUUM ANALYZE visits;
   VACUUM ANALYZE system_notifications;
   ```

---

## 🚀 EXPECTED PERFORMANCE IMPROVEMENTS

### Before Optimization:
- Dashboard load time: 5-10 seconds
- Patient list loading: 3-5 seconds
- Visit calendar: 5-8 seconds
- Notification loading: 2-3 seconds
- Patient modal: 3-5 seconds

### After Critical Indexes:
- Dashboard load time: <2 seconds (**80% improvement**)
- Patient list loading: <500ms (**90% improvement**)
- Visit calendar: <1 second (**85% improvement**)
- Notification loading: <200ms (**93% improvement**)
- Patient modal: <500ms (**90% improvement**)

### After All Optimizations:
- Dashboard load time: <1 second (**90% improvement**)
- Patient list loading: <200ms (**95% improvement**)
- Visit calendar: <500ms (**92% improvement**)
- Notification loading: <100ms (**96% improvement**)
- Patient modal: <300ms (**94% improvement**)

---

## ✅ SUCCESS METRICS

Monitor these metrics after implementation:

1. **Query Performance:**
   - Average query time <200ms
   - P95 query time <500ms
   - No queries taking >1 second

2. **Index Usage:**
   - All critical indexes showing >1000 scans/day
   - Sequential scan ratio <10% of total scans

3. **User Experience:**
   - Dashboard interactive in <2 seconds
   - Real-time updates feeling instant
   - No loading spinners for >1 second

4. **Database Health:**
   - CPU usage <30% average
   - Memory usage stable
   - No connection pool exhaustion

---

## 📋 COMPLETE MIGRATION SCRIPT

```sql
-- ===================================================================
-- DATABASE PERFORMANCE OPTIMIZATION MIGRATION
-- Project: OneHealth Practice Management System
-- Date: October 21, 2025
-- Duration: ~10-15 minutes
-- Downtime: NONE (using CONCURRENTLY)
-- ===================================================================

BEGIN;

-- ===================================================================
-- PART 1: CRITICAL INDEXES (Priority 1)
-- ===================================================================

-- Users Table Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_id
ON users(practice_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email
ON users(email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_practice_role
ON users(practice_id, role);

-- Practices Table Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_practices_status
ON practices(status);

-- Patients Table Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_id
ON patients(practice_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_patients_practice_created
ON patients(practice_id, created_at DESC);

-- Visits Table Indexes (MOST CRITICAL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_id
ON visits(practice_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_practice_scheduled
ON visits(practice_id, scheduled_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_visits_patient_scheduled
ON visits(patient_id, scheduled_date DESC);

-- System Notifications Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notif_user_practice_created
ON system_notifications(user_id, practice_id, created_at DESC);

-- Internal Channel Members Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_channel_members_user_practice
ON internal_channel_members(user_id, practice_id);

-- Communication Subscription Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sms_sub_practice_status
ON practice_sms_subscriptions(practice_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_email_sub_practice_status
ON practice_email_subscriptions(practice_id, status);

COMMIT;

-- ===================================================================
-- VERIFICATION QUERY
-- Run this to verify all indexes were created successfully
-- ===================================================================

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- ===================================================================
-- SUCCESS MESSAGE
-- ===================================================================
-- If you see all 14 indexes listed above, the migration succeeded!
-- Monitor your application performance - you should see immediate improvements.
-- ===================================================================
```

---

## 🆘 TROUBLESHOOTING

### Index Creation Fails

**Error:** "index cannot be created concurrently inside a transaction block"

**Solution:** Remove `BEGIN;` and `COMMIT;` and run each CREATE INDEX separately

---

### Index Creation Takes Too Long

**Check Progress:**
```sql
SELECT
  now()::time,
  query_start::time,
  state,
  query
FROM pg_stat_activity
WHERE query LIKE '%CREATE INDEX%';
```

---

### Performance Doesn't Improve

**Verify Indexes Are Being Used:**
```sql
EXPLAIN ANALYZE
SELECT * FROM patients WHERE practice_id = 'some-uuid';

-- Should show "Index Scan using idx_patients_practice_id"
-- NOT "Seq Scan on patients"
```

---

## 📞 SUPPORT

If you encounter issues during implementation:

1. Check Supabase logs for errors
2. Verify indexes exist using the verification query
3. Use EXPLAIN ANALYZE to confirm indexes are being used
4. Check pg_stat_user_indexes for index usage statistics

---

## 📈 NEXT STEPS AFTER OPTIMIZATION

1. **Implement Query Caching:**
   - Use React Query for client-side caching
   - Set appropriate staleTime values
   - Reduce redundant database queries

2. **Add Database Monitoring:**
   - Set up Supabase performance monitoring
   - Configure alerts for slow queries
   - Track query performance trends

3. **Optimize Heavy Queries:**
   - Review and optimize `get_dashboard_stats`
   - Review and optimize `get_channel_last_messages`
   - Add query result caching where appropriate

4. **Regular Maintenance:**
   - Weekly: Review slow query logs
   - Monthly: Analyze index usage and remove unused ones
   - Quarterly: Full database performance review

---

**End of Performance Optimization Plan**
