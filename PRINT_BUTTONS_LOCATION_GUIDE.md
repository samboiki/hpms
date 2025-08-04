# 🖨️ Print Buttons Location Guide

## ✅ FIXES IMPLEMENTED

### 1. **RPC Error Fixed**
- Removed non-existent `get_visit_with_details` RPC call
- Now using direct table queries that work properly

### 2. **Print Buttons Already Exist!**

## 📍 WHERE TO FIND THE PRINT BUTTONS

The print buttons are located at the **BOTTOM** of the Edit Visit form:

```
┌─────────────────────────────────────────────────────────────────┐
│                        EDIT VISIT FORM                          │
├─────────────────────────────────────────────────────────────────┤
│ 📑 Visit Details Tab                                            │
│ 💊 Medications Tab                                              │
│ 🧪 Laboratory Tab                                               │
│ 📸 Imaging Tab                                                  │
│ 📋 Leave Form Tab                                               │
│ 💰 Services Tab                                                 │
│ 📄 Handoff Tab                                                  │
│ 🖼️ Media Tab                                                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐│
│ │                    FORM ACTIONS BAR                          ││
│ │                                                               ││
│ │ [🖨️ Print Prescription] [🖨️ Print Leave] [🖨️ Print Invoice]  ││
│ │                                          [Cancel] [💾 Update] ││
│ └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
         ↑                                           ↑
    PRINT BUTTONS                            SAVE/CANCEL BUTTONS
    (Left side)                              (Right side)
```

## 🔍 HOW TO SEE THE BUTTONS

### For Print Prescription Button to appear:
1. Go to **Medications Tab**
2. Add at least one medication
3. The button will appear at the bottom left

### For Print Leave Form Button to appear:
1. Go to **Leave Form Tab**
2. Fill out the leave form
3. Save it once
4. The button will appear at the bottom left

### For Print Invoice Button to appear:
1. Go to **Services Tab**
2. Select at least one service
3. The button will appear at the bottom left

## 🎯 EXACT CODE LOCATION

File: `/src/components/visits/EditVisitTabs.tsx`
Lines: **3452-3511**

```typescript
{/* Form Actions */}
<div className="border-t border-gray-200 pt-6 mt-8 flex justify-between items-center">
  {/* Print Actions - LEFT SIDE */}
  <div className="flex gap-2">
    {medications.length > 0 && (
      <button type="button" onClick={() => handlePrintPrescription()}>
        Print Prescription
      </button>
    )}
    
    {leaveFormExists && (
      <button type="button" onClick={() => handlePrintLeaveForm()}>
        Print Leave Form
      </button>
    )}
    
    {selectedServices.length > 0 && (
      <button type="button" onClick={() => setIsInvoiceGenerationModalOpen(true)}>
        Print Invoice
      </button>
    )}
  </div>
  
  {/* Save/Cancel Actions - RIGHT SIDE */}
  <div className="flex space-x-3">
    <button onClick={onCancel}>Cancel</button>
    <button type="submit">Update Visit</button>
  </div>
</div>
```

## 💡 TROUBLESHOOTING

If you still don't see the buttons:

1. **Clear browser cache** and refresh
2. **Check browser console** for any JavaScript errors
3. **Verify data exists**:
   - For prescriptions: Check medications array has items
   - For leave forms: Check database has leave_forms record
   - For invoices: Check selectedServices has items

## ✅ THE FIX IS COMPLETE!

1. ✅ RPC error removed - document generation works
2. ✅ Print buttons already implemented in the UI
3. ✅ Buttons appear conditionally based on data

Just add the relevant data (medications, leave form, or services) and the buttons will appear!