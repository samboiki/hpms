# Performance Index Verification Instructions

## Current Situation

You are experiencing **2000-7000ms query times** even after creating performance indexes. We need to verify if the indexes actually exist in the database.

## Problem

We cannot directly query `pg_indexes` system table from application code without creating an RPC function first.

---

## 🚀 STEP-BY-STEP SOLUTION

### Step 1: Create the RPC Function

Go to your **Supabase Dashboard** and execute this SQL:

**URL**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

**SQL to Execute**:
```sql
-- Create RPC function to query pg_indexes system view
-- This allows us to check if our performance indexes exist

CREATE OR REPLACE FUNCTION public.get_performance_indexes()
RETURNS TABLE (
  schemaname name,
  tablename name,
  indexname name,
  indexdef text
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    schemaname::name,
    tablename::name,
    indexname::name,
    indexdef::text
  FROM pg_indexes
  WHERE schemaname = 'public'
    AND tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
    AND indexname LIKE 'idx_%'
  ORDER BY tablename, indexname;
$$;

-- Grant execute permission to authenticated and anon users
GRANT EXECUTE ON FUNCTION public.get_performance_indexes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_performance_indexes() TO anon;

COMMENT ON FUNCTION public.get_performance_indexes() IS 'Returns all performance indexes created for core tables';
```

### Step 2: Run the Verification Script

After creating the RPC function, run:

```bash
node setup_and_check_indexes.mjs
```

This will show you:
- ✅ All indexes that exist
- ❌ All indexes that are missing
- 📊 Coverage percentage
- 📋 Detailed index definitions

---

## 🎯 Expected Indexes (13 total)

The script will check for these indexes:

1. **idx_users_practice_id** - Users by practice
2. **idx_users_role** - Users by role
3. **idx_users_email** - Users by email (login queries)
4. **idx_practices_status** - Active practices filter
5. **idx_practices_practice_type_id** - Practices by type
6. **idx_patients_practice_id** - Patients by practice
7. **idx_visits_practice_id** - Visits by practice
8. **idx_visits_patient_id** - Visits by patient
9. **idx_visits_doctor_id** - Visits by doctor
10. **idx_system_notifications_user_id** - Notifications by user
11. **idx_internal_channel_members_user_id** - Channel members by user
12. **idx_practice_sms_subscriptions_practice_id** - SMS subscriptions by practice
13. **idx_practice_email_subscriptions_practice_id** - Email subscriptions by practice

---

## 📊 What the Results Will Tell You

### Scenario 1: All Indexes Present (✅)
```
📈 COVERAGE: 13/13 indexes present
📊 COMPLETION: 100%
```

**Meaning**: Indexes exist but queries are still slow. The problem is elsewhere:
- Complex JOIN queries
- Missing composite indexes
- Query plan issues
- RLS policy overhead
- Network latency

**Next Steps**: Analyze actual query execution plans

### Scenario 2: Some Indexes Missing (⚠️)
```
📈 COVERAGE: 8/13 indexes present
📊 COMPLETION: 62%
```

**Meaning**: Some indexes weren't created successfully.

**Next Steps**: Recreate missing indexes

### Scenario 3: No Indexes Found (❌)
```
📈 COVERAGE: 0/13 indexes present
📊 COMPLETION: 0%
```

**Meaning**: The index creation failed completely.

**Next Steps**: Recreate all indexes with proper error handling

---

## 🔧 Alternative: Manual Verification via Supabase Dashboard

If you prefer to check manually without running scripts:

1. Go to **SQL Editor**
2. Run this query:
```sql
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('users', 'practices', 'patients', 'visits', 'system_notifications', 'internal_channel_members', 'practice_sms_subscriptions', 'practice_email_subscriptions')
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

3. Compare results with the 13 expected indexes above

---

## 📝 Files Created

1. **create_get_indexes_function.sql** - SQL to create the RPC function
2. **setup_and_check_indexes.mjs** - Node script to verify indexes
3. **INDEX_VERIFICATION_INSTRUCTIONS.md** - This file

---

## 🎯 Next Actions Based on Results

After verification, we can:

1. **If indexes exist**: Analyze query execution plans to find real bottleneck
2. **If indexes missing**: Recreate them with error handling
3. **If indexes partial**: Complete the missing ones
4. **Performance tuning**: Create composite indexes, optimize RLS policies, etc.

---

## 💡 Quick Command Reference

```bash
# Create RPC function (via Supabase Dashboard SQL Editor)
# Copy SQL from: create_get_indexes_function.sql

# Verify indexes exist
node setup_and_check_indexes.mjs

# If indexes missing, recreate them
# (We'll provide the SQL after verification)
```

---

**Ready to proceed?** Run Step 1 in the Supabase Dashboard, then Step 2 from your terminal.
