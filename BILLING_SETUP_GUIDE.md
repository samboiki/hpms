# 🔧 BILLING SYSTEM SETUP GUIDE

## Step 1: Execute Database Setup

**CRITICAL**: Run this SQL in your Supabase SQL Editor first:

```sql
-- Copy and paste the entire content from either:
-- EXECUTE_THIS_SQL_TO_FIX_BILLING.sql 
-- OR
-- COMPLETE_BILLING_SYSTEM_FIX.sql
```

## Step 2: Verify Database Setup

Run this diagnostic SQL:

```sql
-- Copy and paste content from:
-- TEST_BILLING_SYSTEM.sql
```

## Step 3: Test the System

### Create a Test Invoice:

1. **Go to a patient detail page**
2. **Click "Add Visit" (not edit)**
3. **Fill out the encounter form**
4. **Go to "Billing & Services" tab**
5. **Add some services** (they should load from cached tariffs)
6. **Check "Generate invoice automatically"**
7. **Submit the form**

### Expected Result:
- Visit should be created successfully
- Invoice should be generated automatically
- Billing tab should show the new transaction

## Step 4: Debug Issues

If still showing "No transactions found":

1. **Open browser console** (F12)
2. **Paste the content from `debug-billing-issue.js`**
3. **Check the console output** for errors
4. **Look for specific error messages**

## Step 5: Manual Testing

If automatic doesn't work, test manually in Supabase SQL Editor:

```sql
-- Get a real patient ID
SELECT id, first_name, last_name FROM patients LIMIT 5;

-- Get a real visit ID  
SELECT id, patient_id, visit_date FROM visits LIMIT 5;

-- Get a real tariff ID
SELECT id, code, description, price FROM practice_tariffs WHERE price > 0 LIMIT 5;

-- Create test invoice (replace UUIDs with real ones)
INSERT INTO invoices_enhanced (patient_id, visit_id, due_date, notes)
VALUES (
    'YOUR_PATIENT_ID',
    'YOUR_VISIT_ID', 
    CURRENT_DATE + INTERVAL '30 days',
    'Test invoice'
);

-- Add test service (replace invoice ID with the one just created)
INSERT INTO invoice_services (invoice_id, tariff_id, code, description, quantity, unit_price, total_price, patient_portion)
VALUES (
    (SELECT id FROM invoices_enhanced ORDER BY created_at DESC LIMIT 1),
    'YOUR_TARIFF_ID',
    '8101',
    'Test service',
    1,
    100.00,
    100.00,
    100.00
);
```

## Common Issues:

### ❌ No SQL Setup
- **Error**: Tables don't exist or missing relationships
- **Fix**: Run the SQL setup files

### ❌ No Data
- **Error**: "No transactions found" 
- **Fix**: Create visits with services first

### ❌ Wrong Patient ID
- **Error**: Billing shows 0 for wrong patient
- **Fix**: Check URL contains correct patient ID

### ❌ Cache Issues  
- **Error**: Services not loading
- **Fix**: Clear browser cache and localStorage

## Success Indicators:

✅ **Tariffs load quickly** (from cache)  
✅ **Visit creation works** without errors  
✅ **Invoice generation succeeds**  
✅ **Billing tab shows data** with proper amounts  
✅ **No console errors** in browser  

## Quick Fix Summary:

1. **Run SQL setup** (database structure)
2. **Create test visit** (add services + generate invoice)  
3. **Check billing tab** (should show transaction)
4. **Debug with console** (if issues persist)

Your billing system should work perfectly after following these steps! 🎉