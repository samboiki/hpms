# 🚀 Database Migration Execution Guide

## 📋 Current Database State

✅ **Database Connection**: Verified and working  
✅ **Core Tables**: All present (practices, users, patients, appointments, visits, medical_records)  
✅ **Multi-tenant Setup**: Already configured with practice_id columns  
⚠️ **Missing Feature**: `appointments.ready_status` column  

### Current Practices
- **City Clinic Windhoek** (cityclinic) - 0 patients
- **Coastal Medical Center** (coastalmed) - 0 patients  
- **Dr. Polina Aesthetics** (dr-polina-aesthetics) - 35 patients

---

## 🔧 Required Migration

### What needs to be added:
- `ready_status` column to appointments table
- ENUM type for status values: `not_ready`, `ready`, `in_queue`
- Index for performance optimization

### Impact Assessment:
- ✅ **Safe**: No existing data will be affected
- ✅ **Non-breaking**: Default value ensures compatibility
- ✅ **Reversible**: Can be rolled back if needed

---

## 📖 Step-by-Step Execution

### Step 1: Open Supabase SQL Editor
1. Go to: **https://app.jjxlfunlbyayxwvlpgwt.supabase.co/sql**
2. Sign in with your Supabase credentials

### Step 2: Execute the Migration
Copy and paste this SQL into the editor:

\`\`\`sql
-- Add ready_status column to appointments table
-- This migration adds appointment readiness tracking functionality

BEGIN;

-- Create the ready status enum type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_ready_status') THEN
        CREATE TYPE appointment_ready_status AS ENUM ('not_ready', 'ready', 'in_queue');
    END IF;
END $$;

-- Add the ready_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'appointments' 
        AND column_name = 'ready_status'
    ) THEN
        ALTER TABLE appointments 
        ADD COLUMN ready_status appointment_ready_status DEFAULT 'not_ready';
    END IF;
END $$;

-- Add a comment for documentation
COMMENT ON COLUMN appointments.ready_status IS 'Patient readiness status: not_ready (default), ready (patient has arrived), in_queue (being processed)';

-- Create an index for better performance when filtering by ready_status
CREATE INDEX IF NOT EXISTS idx_appointments_ready_status ON appointments(ready_status);

-- Update any existing scheduled appointments to not_ready status
UPDATE appointments 
SET ready_status = 'not_ready' 
WHERE ready_status IS NULL;

COMMIT;

-- Verification query to check the column was added
SELECT 
    column_name, 
    data_type, 
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'appointments' 
AND column_name = 'ready_status';
\`\`\`

### Step 3: Verify Success
After execution, you should see:
- ✅ "Success. No rows returned" message
- ✅ Verification query showing the new column details

---

## 🔍 Post-Migration Verification

### Option 1: Run Verification Tool
\`\`\`bash
cd /home/happy/projects/hpms
node final_migration_report.js
\`\`\`

### Option 2: Manual Verification in Supabase
Run this query in the SQL editor:
\`\`\`sql
-- Check if ready_status column exists
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'appointments' AND column_name = 'ready_status';

-- Check enum values
SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'appointment_ready_status');
\`\`\`

Expected results:
- Column: `ready_status` of type `USER-DEFINED` with default `'not_ready'::appointment_ready_status`
- Enum values: `not_ready`, `ready`, `in_queue`

---

## 🔄 Rollback Plan (if needed)

If something goes wrong, execute this rollback:
\`\`\`sql
BEGIN;

-- Remove the column
ALTER TABLE appointments DROP COLUMN IF EXISTS ready_status;

-- Drop the enum type
DROP TYPE IF EXISTS appointment_ready_status;

-- Remove the index
DROP INDEX IF EXISTS idx_appointments_ready_status;

COMMIT;
\`\`\`

---

## 📊 What This Enables

After successful migration, your application will support:

1. **Patient Check-in Flow**
   - Mark appointments as 'ready' when patients arrive
   - Track queue status with 'in_queue'

2. **Dashboard Features**
   - Filter appointments by readiness status
   - Display patient queue in order of arrival

3. **Workflow Management**
   - Prioritize ready patients
   - Manage appointment flow efficiently

---

## 🎯 Next Steps After Migration

1. ✅ Verify migration success
2. 🧪 Test the new functionality in your app
3. 🔄 Update any TypeScript interfaces to include \`ready_status\`
4. 📝 Update your UI to show ready status options
5. 🚀 Deploy application updates

---

## 🆘 Need Help?

If you encounter any issues:
1. Check the Supabase logs for error details
2. Run the verification tool: \`node final_migration_report.js\`
3. Use the rollback script if needed
4. Verify your database permissions

---

*Migration guide generated on ${new Date().toISOString()}*