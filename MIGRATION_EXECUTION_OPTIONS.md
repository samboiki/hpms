# 🦷 Dental Migration Execution Options

## ❌ Network Connection Issue
Direct PostgreSQL connections are currently failing with network errors. Here are your execution options:

## ✅ OPTION 1: Supabase SQL Editor (RECOMMENDED)

### Steps:
1. **Go to**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. **Click**: SQL Editor (left sidebar)
3. **Copy entire content** from: `COMPLETE_DENTAL_MIGRATION.sql`
4. **Paste and Run** in the SQL Editor

### File Location:
```
/home/happy/projects/hpms/COMPLETE_DENTAL_MIGRATION.sql
```

## ✅ OPTION 2: Two-Step Manual Execution

If the complete script is too large, use these smaller files:

### Step 1:
```sql
-- Copy from: STEP1_ADD_COLUMNS_SAFE.sql
-- Adds required columns safely
```

### Step 2:
```sql
-- Copy from: STEP2_INSERT_DATA_SIMPLE.sql  
-- Imports all 179 dental codes
```

## ✅ OPTION 3: Supabase CLI (if you have access token)

```bash
# Set access token and try:
export SUPABASE_ACCESS_TOKEN="your_token_here"
npx supabase link --project-ref jjxlfunlbyayxwvlpgwt
npx supabase db push --include-all
```

## ✅ OPTION 4: Alternative Connection Tools

If you have PostgreSQL tools available:
```bash
# Using psql (if available)
psql "postgresql://postgres:T@ngisasa200@db.jjxlfunlbyayxwvlpgwt.supabase.co:5432/postgres" -f COMPLETE_DENTAL_MIGRATION.sql

# Using pgAdmin or DBeaver with connection:
Host: db.jjxlfunlbyayxwvlpgwt.supabase.co
Port: 5432
Database: postgres
Username: postgres
Password: T@ngisasa200
```

## 📋 What Gets Imported

### All 179 Dental Codes Including:
- **Basic Procedures**: Examinations, consultations, X-rays
- **Preventive**: Scaling, polishing, fluoride, sealants
- **Restorative**: Fillings, crowns, inlays, bridges
- **Surgical**: Extractions, implants, periodontal surgery
- **Prosthetic**: Dentures, partial dentures, repairs
- **Endodontic**: Root canals, pulp treatments
- **Advanced**: CBCT imaging, specialized procedures

### Business Rules Included:
- ✅ **Fixed pricing** for standard procedures
- ✅ **Quantity multiplication** (per tooth, per film, etc.)
- ✅ **Progressive pricing** (first item full price, additional reduced)
- ✅ **Tooth-specific pricing** for special materials
- ✅ **Per-visit charges** that don't multiply by quantity

### Sample Codes:
```
8101: Full mouth examination - 254.70 NAD [Fixed]
8107: Intra-oral radiographs - 135.40 NAD [Per film]
8163: Fissure sealant - 135.40 NAD [Per tooth]
8346: Restorative material - Variable by tooth [Tooth-specific]
8202: Additional extractions - 82.90 NAD [Progressive]
```

## 🔍 Verification Queries

After execution, run these to confirm success:

```sql
-- Check total count
SELECT COUNT(*) FROM practice_tariffs;
-- Should return: 179

-- Check sample data
SELECT code, description, official_2025_price_nad, can_be_multiplied 
FROM practice_tariffs 
WHERE code IN (8101, 8107, 8163, 8346, 8826)
ORDER BY code;

-- Check multiplication rules
SELECT can_be_multiplied, COUNT(*) 
FROM practice_tariffs 
GROUP BY can_be_multiplied;
```

## 🎯 Expected Results

After successful execution:
```
Total codes imported: 179
Codes with multiplication rules: ~40
Progressive pricing codes: ~8
Special tooth-specific code 8346: 1
```

## 🚀 Next Steps After Import

1. **Test ServiceSelector**: Dental codes will appear in dropdowns
2. **Verify Pricing**: Official 2025 NAD rates are applied
3. **Check Business Rules**: Multiplication logic works for quantity-based codes
4. **Multi-practice**: All practices can access the dental codes

## 💡 Troubleshooting

### If migration fails:
1. **Check table exists**: Run `SELECT * FROM practice_tariffs LIMIT 1;`
2. **Check practices**: Run `SELECT id FROM practices LIMIT 1;`
3. **Permission error**: Ensure you're using service role key
4. **Timeout**: Execute in smaller chunks using Step 1 + Step 2 approach

## 📁 Files Available

- ✅ `COMPLETE_DENTAL_MIGRATION.sql` - Single complete script
- ✅ `STEP1_ADD_COLUMNS_SAFE.sql` - Column setup only
- ✅ `STEP2_INSERT_DATA_SIMPLE.sql` - Data import only
- ✅ `execute-complete-migration.cjs` - Node.js execution script
- ✅ `MIGRATION_EXECUTION_OPTIONS.md` - This guide

---

🦷 **All 179 official Namibian dental codes ready for import!**

**RECOMMENDED**: Use Supabase SQL Editor for fastest execution