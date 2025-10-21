# Quick Index Verification - 30 Second Check

## Copy This SQL to Supabase Dashboard

**URL**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt/sql/new

```sql
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN (
    'users',
    'practices',
    'patients',
    'visits',
    'system_notifications',
    'internal_channel_members',
    'practice_sms_subscriptions',
    'practice_email_subscriptions'
  )
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

## Expected Result

**13 rows** should be returned, one for each index:

1. idx_users_practice_id
2. idx_users_role
3. idx_users_email
4. idx_practices_status
5. idx_practices_practice_type_id
6. idx_patients_practice_id
7. idx_visits_practice_id
8. idx_visits_patient_id
9. idx_visits_doctor_id
10. idx_system_notifications_user_id
11. idx_internal_channel_members_user_id
12. idx_practice_sms_subscriptions_practice_id
13. idx_practice_email_subscriptions_practice_id

## What to Report

Report back with: **"Found X out of 13 expected indexes"**

- **13/13**: ✅ All indexes present (problem is elsewhere)
- **1-12/13**: ⚠️ Some indexes missing (partial creation)
- **0/13**: ❌ No indexes found (creation failed)

## Next Steps Based on Results

### If 13/13 (All Present)
Problem is NOT missing indexes. Need to:
- Analyze query execution plans
- Check for RLS policy overhead
- Look for composite index opportunities
- Investigate network/connection issues

### If 1-12/13 (Partial)
Some indexes failed. Need to:
- Recreate missing indexes
- Check error logs
- Verify permissions

### If 0/13 (None)
Complete failure. Need to:
- Recreate all indexes with error handling
- Check DDL execution permissions
- Review creation logs

---

**Time to complete**: 30 seconds
**Difficulty**: Easy (just copy/paste SQL)
