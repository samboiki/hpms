# Document Upload Troubleshooting Guide

## Issue: "new row violates row-level security policy"

This error occurs when the RLS (Row Level Security) policies on the `patient_documents` table are too restrictive or not properly configured for the current user structure.

## Quick Fix (Recommended)

**Step 1: Run the RLS fix in Supabase SQL Editor**
```sql
-- Copy and paste FIX_DOCUMENTS_RLS_POLICY.sql content into Supabase SQL Editor
```

**Step 2: Test upload again**
- The simplified policies will allow authenticated users to upload documents
- Check browser console for detailed debug information

## Alternative: Debug the Issue

**Step 1: Run debug script**
```sql
-- Copy and paste DEBUG_USER_PRACTICE_RELATIONSHIP.sql content
-- This will show user/practice relationships
```

**Step 2: Check console logs**
- Open browser console (F12)
- Try uploading a document
- Look for debug logs showing:
  - 👤 Current user info
  - 🏥 User practice info  
  - 🎯 Target patient info
  - ❌ Any RLS errors

## Root Cause Analysis

The RLS policies were checking for practice relationships like this:
```sql
patient_id IN (
  SELECT p.id FROM patients p
  JOIN users u ON u.practice_id IS NOT NULL
  WHERE auth.uid() = u.id
)
```

**Potential issues:**
1. User doesn't have `practice_id` set
2. Patient isn't associated with user's practice
3. RLS policy logic is incorrect
4. Missing relationships in database

## Solutions

### Option 1: Simplified Policies (Quick Fix)
- Allow any authenticated user to manage documents
- Good for testing and development
- Less secure but functional

### Option 2: Fix Practice Relationships
- Ensure users have proper `practice_id`
- Ensure patients are associated with practices
- More secure but requires data setup

### Option 3: Custom Policy Logic
- Create policies that match your actual data structure
- May need to adjust based on how practices are organized

## Testing Steps

1. **Run RLS fix** → `FIX_DOCUMENTS_RLS_POLICY.sql`
2. **Test upload** → Try uploading a small image
3. **Check console** → Look for success logs
4. **Verify database** → Check `patient_documents` table has new row

## Success Indicators

✅ **Upload completes without errors**
✅ **Console shows**: `✅ Metadata saved successfully`
✅ **Database shows**: New row in `patient_documents` table
✅ **UI shows**: Document appears in documents list

## If Still Having Issues

1. **Check Supabase Auth**: Ensure user is properly authenticated
2. **Check Table Exists**: Verify `patient_documents` table was created
3. **Check Storage Bucket**: Ensure `documents` bucket exists
4. **Check User Permissions**: Verify user has necessary database access

## Contact Support

If issues persist, provide:
- Browser console logs (full error details)
- Results from debug SQL script
- User authentication status
- Database table structure