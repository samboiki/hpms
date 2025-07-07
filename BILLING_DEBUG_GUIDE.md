# 🔍 BILLING DEBUG GUIDE

## Quick Test - Add Visit with Services

### Step 1: Open Console & Test
1. **F12 → Console tab**
2. **Go to patient detail page**
3. **Click "Add Visit"**
4. **Fill form basics**:
   - Visit type: Consultation
   - Chief complaint: "Test billing"
   - Diagnosis: "Test diagnosis"
   - Treatment plan: "Test treatment"

### Step 2: Add Services & Generate Invoice
1. **Go to "Billing & Services" tab**
2. **Add 1-2 services** (quick add buttons)
3. **Check "Generate invoice automatically"**
4. **Submit form**

### Step 3: Analyze Console Logs

## 🟢 SUCCESS PATTERN:
```
🧾 Starting invoice generation...
📋 Selected services: (2) [{...}, {...}]
👤 User found: abc-123-def
🏢 Practice ID: practice-xyz
🏭 InvoiceService.generateInvoiceFromVisit starting...
✅ Request validation passed
💾 Creating invoice with services...
✅ Invoice created successfully
🎉 Invoice generation completed successfully!
```

## 🔴 FAILURE PATTERNS:

### Pattern 1: No Services Selected
```
⏭️ Skipping invoice generation:
   - Services selected: 0
   - Generate invoice: true
```
**Fix**: Services not being added to selectedServices array

### Pattern 2: User/Practice Issues
```
👤 Getting current user...
⚠️ No user found
```
**Fix**: Authentication issue

### Pattern 3: Validation Failure
```
🏭 InvoiceService.generateInvoiceFromVisit starting...
❌ Validation failed: Invalid invoice generation request
📊 Request details: {visitId: false, patientId: true, servicesCount: 2}
```
**Fix**: Missing visitId in request

### Pattern 4: Database/Table Issues
```
💾 Creating invoice with services...
❌ Error creating invoice with services: [database error]
```
**Fix**: Database permissions or missing tables

### Pattern 5: Service Calculation Issues
```
🧮 Calculating billing totals...
💥 Error generating invoice: [calculation error]
```
**Fix**: Service pricing or calculation logic

## 🔧 QUICK FIXES:

### Fix 1: Clear Cache
```javascript
// Run in console
localStorage.clear();
location.reload();
```

### Fix 2: Check Database Tables
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) FROM invoices_enhanced;
SELECT COUNT(*) FROM invoice_services;
SELECT COUNT(*) FROM practice_tariffs WHERE price > 0;
```

### Fix 3: Manual Test Insert
```sql
-- Test if tables work
INSERT INTO invoices_enhanced (patient_id, visit_id, due_date, notes)
VALUES ('YOUR_PATIENT_ID', 'YOUR_VISIT_ID', CURRENT_DATE + 30, 'Test invoice');
```

## 📊 DIAGNOSTIC COMMANDS:

### Check Current State
```javascript
// Run in browser console
console.log('Selected Services:', document.querySelector('[data-testid="selected-services"]'));
console.log('Generate Invoice Checked:', document.querySelector('input[name="generateInvoice"]')?.checked);
```

### Debug Service Selection
```javascript
// Check if services are being added
window.addEventListener('click', (e) => {
  if (e.target.textContent?.includes('N$')) {
    console.log('Service clicked:', e.target);
  }
});
```

## 🎯 EXPECTED OUTCOMES:

✅ **Working System:**
- Console shows complete success flow
- Visit created successfully  
- Billing tab shows new transaction
- No error alerts

❌ **Broken System:**
- Console shows specific error
- Visit created but no invoice
- Billing tab shows "No transactions found"
- Error alert appears

## 🚀 NEXT STEPS:

1. **Run the test** and copy/paste console output
2. **Compare with patterns** above
3. **Apply appropriate fix**
4. **Test again** until success pattern appears

The detailed logs will show exactly where the billing submission is failing!