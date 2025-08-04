# Document Generation Fixes Summary

## 🔧 Fixed Issues

### 1. **RPC Function Error** ✅
**Problem**: `Failed to fetch visit data: Could not find the function public.get_visit_with_details`
**Solution**: Removed the non-existent RPC call in `documentGenerationService.ts` (lines 69-101) and now using direct table queries with proper joins.

```typescript
// OLD (causing error):
const { data: visitData, error: visitError } = await supabase
  .rpc('get_visit_with_details', { visit_id: options.visitId });

// NEW (working):
const { data: visit, error: visitError } = await supabase
  .from('visits')
  .select(`
    *,
    patients!visits_patient_id_fkey (...),
    users!visits_doctor_id_fkey (...)
  `)
  .eq('id', options.visitId)
  .single();
```

### 2. **Print Buttons Location** ✅
**Status**: Print buttons ARE already implemented in `EditVisitTabs.tsx` at lines 3452-3500
**Location**: Inside the "Form Actions" section, left side of the form footer

The buttons are:
- **Print Prescription** - Shows when medications exist (line 3457)
- **Print Leave Form** - Shows when leave form exists (line 3480)  
- **Print Invoice** - Shows when services are selected (line 3503)

## 📍 Current Implementation

### Print Button Visibility Conditions:
1. **Prescription Button**: `medications.length > 0`
2. **Leave Form Button**: `leaveFormExists` (checked on component mount)
3. **Invoice Button**: `selectedServices.length > 0`

### Button Features:
- Beautiful styling with hover effects
- Loading states with spinning icons
- Disabled state during generation
- Solar Bold Duotone icons
- Proper click handlers that check for existing documents

## 🚀 How It Works Now

1. **When visiting a patient's visit:**
   - Component checks for existing medications, leave forms, and services
   - Shows relevant print buttons in the form actions area

2. **When clicking a print button:**
   - Checks if document already exists in storage
   - If exists: Opens existing PDF in new tab
   - If not: Generates new PDF and opens it

3. **When clicking "Update Visit":**
   - Saves all visit data
   - Automatically generates all relevant documents
   - Shows success toast

## ✅ Testing the Fix

To verify the fix is working:

1. Open any existing visit in edit mode
2. Check the bottom of the form - you should see:
   - Cancel and Update Visit buttons on the right
   - Print buttons on the left (if data exists)
3. Add some medications to see the Print Prescription button appear
4. Fill out the leave form tab to see the Print Leave Form button
5. Add services to see the Print Invoice button

## 🎯 Key Files Modified

1. **`/src/services/documentGenerationService.ts`**
   - Line 69-89: Removed RPC call, using direct query
   
2. **`/src/components/visits/EditVisitTabs.tsx`**
   - Lines 3452-3511: Print buttons already implemented
   - Lines 217, 463, 845: Leave form existence checking

## 💡 If Print Buttons Still Don't Show

The buttons might not show if:
1. No medications are added (prescription button)
2. No leave form data exists (leave form button)
3. No services are selected (invoice button)

To make them appear:
1. Go to Medications tab → Add a medication
2. Go to Leave Form tab → Fill out the form
3. Go to Services tab → Select services

The buttons will appear dynamically as you add data!