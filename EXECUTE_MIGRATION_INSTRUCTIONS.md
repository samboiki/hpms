# Two-Step Dental Migration Instructions

## ✅ Execute in Supabase SQL Editor

### Step 1: Add Required Columns
1. **Open Supabase Dashboard**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. **Navigate to SQL Editor** (left sidebar)
3. **Copy content from**: `/home/happy/projects/hpms/STEP1_ADD_COLUMNS.sql`
4. **Paste and Run** the SQL

**What Step 1 Does:**
- ✅ Drops unwanted columns
- ✅ Adds all 11 required columns for dental codes
- ✅ Sets up proper data types
- ✅ Shows table structure verification

### Step 2: Insert All 179 Dental Codes
1. **In the same SQL Editor**
2. **Copy content from**: `/home/happy/projects/hpms/STEP2_CLEAR_AND_INSERT_DATA.sql`
3. **Paste and Run** the SQL

**What Step 2 Does:**
- ✅ Clears existing data
- ✅ Inserts all 179 official dental codes
- ✅ Includes pricing, business rules, and metadata
- ✅ Runs verification queries

## Expected Results

After both steps, you should see:
```
Total codes imported: 179
Codes with multiplication rules: [number]
Progressive pricing codes: [number]
Special tooth-specific code 8346: 1
```

Plus a sample of 10 imported codes with their details.

## Files Created

1. **`STEP1_ADD_COLUMNS.sql`** - Table structure setup
2. **`STEP2_CLEAR_AND_INSERT_DATA.sql`** - Data import
3. **`EXECUTE_DENTAL_MIGRATION_VIA_MCP.sql`** - Single-step version (alternative)

## Why Two Steps?

- **Safety**: Verify table structure before data import
- **Debugging**: Easier to troubleshoot if issues occur
- **Flexibility**: Can modify structure without losing time on data insertion

## Alternative: Single Script

If you prefer, use the single script: `EXECUTE_DENTAL_MIGRATION_VIA_MCP.sql`

## Verification

After completion, check:
- ✅ 179 codes in practice_tariffs table
- ✅ All required columns present
- ✅ Proper pricing and business rules
- ✅ Special code 8346 with tooth-specific pricing

## Next Steps

Once imported, you can:
- Use dental codes in ServiceSelector component
- Build billing workflows with proper pricing
- Apply business rules for multiplication and progressive pricing
- Handle special cases like tooth-specific pricing