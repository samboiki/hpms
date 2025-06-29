# Follow-up Automation System Security Model

## Overview
The follow-up automation system is designed with **strict single-practice data isolation** to ensure that users can ONLY access data from their assigned practice.

## Security Architecture

### 1. User-Practice Assignment
- Users are assigned to ONE practice via `users.practice_id`
- No multi-practice access is supported for security reasons
- The `user_practice_assignments` table should NOT be used

### 2. Frontend Security
All components validate practice access:
```typescript
// SECURITY: Users can ONLY access their assigned practice from users table
if (!user.practice_id) {
  throw new Error('No practice assigned to this user');
}
```

### 3. Database Security (Row Level Security)
RLS policies on `follow_up_templates` table:
- SELECT: `practice_id = (SELECT practice_id FROM users WHERE id = auth.uid())`
- INSERT: Same check with WITH CHECK
- UPDATE: Same check for both USING and WITH CHECK
- DELETE: Same check with USING

### 4. Edge Function Security

#### generate-follow-up-templates
- Accepts practiceId as parameter
- Only generates templates, doesn't fetch existing data
- Caller must validate practiceId matches user's practice

#### follow-up-automation-engine
- Uses service role but maintains practice boundaries
- Processes each practice in complete isolation
- Filters all queries by practice_id

### 5. Key Security Principles

1. **Single Practice Assignment**: Users belong to ONE practice only
2. **No Cross-Practice Access**: Data from different practices is completely isolated
3. **RLS Enforcement**: Database-level security prevents unauthorized access
4. **Practice ID Validation**: Every query filters by practice_id
5. **Audit Trail**: All automation actions are logged

### 6. Security Checklist

- [x] RLS enabled on follow_up_templates table
- [x] RLS policies restrict access by practice_id
- [x] Frontend validates user.practice_id
- [x] Edge functions filter by practice_id
- [x] No use of user_practice_assignments table
- [x] Audit logging for automation runs

## Testing Security

To verify security:
1. Create users in different practices
2. Try to access templates from another practice (should fail)
3. Check RLS policies are enforced
4. Verify edge functions only process assigned practice data

## Important Notes

- NEVER allow users to specify practiceId in API calls
- Always use authenticated user's practice_id from database
- Service role functions must still filter by practice_id
- Regular security audits should verify practice isolation