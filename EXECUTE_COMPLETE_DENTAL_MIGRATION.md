# Complete Dental Migration Guide

## 🎯 EXECUTE IN SUPABASE SQL EDITOR

### Step 1: Access Supabase Dashboard
1. **Go to**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. **Navigate to**: SQL Editor (left sidebar)
3. **Click**: "New Query"

### Step 2: Execute Complete Migration
1. **Copy the entire content** from: `/home/happy/projects/hpms/COMPLETE_DENTAL_MIGRATION.sql`
2. **Paste** into the SQL Editor
3. **Click "Run"** to execute

## 🔍 What This Script Does

### Phase 1: Table Structure Setup
- ✅ Adds all required columns safely (keeps existing ones)
- ✅ Sets proper data types for dental codes
- ✅ Adds pricing and business rule columns
- ✅ Ensures system columns exist

### Phase 2: Data Import
- ✅ Clears existing practice_tariffs data
- ✅ Gets practice_id from existing practices table
- ✅ Inserts all 179 official 2025 dental codes
- ✅ Includes complete metadata:
  - Official pricing in NAD
  - Business rules (Fixed, Progressive, Tooth-specific)
  - Multiplication rules for quantity-based codes
  - Example calculations
  - Claims history flags

### Phase 3: Verification
- ✅ Shows import statistics
- ✅ Displays sample data
- ✅ Confirms table structure

## 📊 Expected Results

After successful execution, you should see:

```sql
-- Results will show:
Total codes imported: 179
Codes with multiplication rules: [varies]
Progressive pricing codes: [varies] 
Special tooth-specific code 8346: 1

-- Plus sample data showing:
8101 | Full mouth examination, charting and treatment planning | 254.70 | NO
8102 | Comprehensive consultation | 479.00 | NO
8104 | Examination or consultation for a specific problem | 137.40 | NO
...
```

## 🦷 Key Features Imported

### 1. Fixed Price Codes (Most Common)
- Standard procedures with set prices
- Example: Code 8101 - Full mouth examination (254.70 NAD)

### 2. Quantity-Multiplied Codes
- Codes that multiply by quantity
- Example: Code 8107 - Intra-oral radiographs × number of X-rays
- Example: Code 8163 - Fissure sealant × number of teeth

### 3. Progressive Pricing Codes
- First item full price, additional items reduced
- Example: Code 8202 - Additional extractions in same quadrant

### 4. Special Cases
- Code 8346 - Tooth-specific pricing (varies by tooth location)
- Per-visit codes (charged once per visit regardless of quantity)

## 🔧 Troubleshooting

### If Migration Fails:
1. **Check table exists**: `SELECT * FROM practice_tariffs LIMIT 1;`
2. **Check practices table**: `SELECT id FROM practices LIMIT 1;`
3. **Manual approach**: Use the two-step files if needed

### Alternative Files Available:
- `STEP1_ADD_COLUMNS_SAFE.sql` - Column setup only
- `STEP2_INSERT_DATA_SIMPLE.sql` - Data import only
- `STEP2_INSERT_DATA_WITH_PRACTICE_ID.sql` - With practice linking

## ✅ Post-Migration Checklist

After successful execution:

1. **Verify count**: `SELECT COUNT(*) FROM practice_tariffs;` (should be 179)
2. **Check pricing**: `SELECT code, description, official_2025_price_nad FROM practice_tariffs WHERE code IN (8101, 8346, 8826);`
3. **Test multiplication**: `SELECT * FROM practice_tariffs WHERE can_be_multiplied = 'YES';`
4. **Test progressive**: `SELECT * FROM practice_tariffs WHERE can_be_multiplied = 'PROGRESSIVE';`

## 🚀 Next Steps

Once imported, the dental codes are ready for:
- **ServiceSelector component** usage
- **Billing workflows** with proper pricing
- **Business rule implementation** for complex pricing
- **Multi-practice deployment** (codes available to all practices)

## 📞 Connection Details

- **Project**: jjxlfunlbyayxwvlpgwt.supabase.co
- **Database**: PostgreSQL
- **Schema**: public.practice_tariffs

## 🎉 Success Confirmation

You'll know it worked when:
- ✅ 179 codes imported successfully
- ✅ All pricing data included
- ✅ Business rules properly set
- ✅ Special code 8346 has tooth-specific pricing note
- ✅ No SQL errors in execution

## 📝 Files Created

1. **`COMPLETE_DENTAL_MIGRATION.sql`** - Single-step complete migration
2. **`STEP1_ADD_COLUMNS_SAFE.sql`** - Column setup (safe version)
3. **`STEP2_INSERT_DATA_SIMPLE.sql`** - Data import (simple version)
4. **`EXECUTE_COMPLETE_DENTAL_MIGRATION.md`** - This guide

---

🦷 **Ready to import all 179 official Namibian dental codes!**