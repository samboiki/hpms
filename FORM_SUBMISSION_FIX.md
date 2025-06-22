# Form Submission Fix - Lab System

## Problem
The EditVisitTabs form was being submitted accidentally when interacting with lab request modals, causing crashes.

## Root Cause
The lab request components were nested inside the main form element, causing any button clicks or Enter key presses to trigger form submission.

## Solution
Separated the form element from the content by:

1. **Moved form element outside the content**
   - Created a hidden form with ID `edit-visit-form`
   - Content is no longer wrapped in the form element
   - Form submission is completely isolated

2. **Connected submit button via form attribute**
   - Submit button uses `form="edit-visit-form"` attribute
   - Only this button can trigger form submission

3. **Added type="button" to all modal buttons**
   - Prevents default submit behavior
   - Ensures buttons only trigger their onClick handlers

## Benefits
- Form can only be submitted by clicking "Update Visit" button
- Modal interactions are completely isolated from form
- No accidental submissions when entering lab results
- Clean separation of concerns

## Implementation
```jsx
// Before
<form onSubmit={handleSubmit(onSubmit)}>
  <div className="content">
    <!-- All content including modals -->
  </div>
</form>

// After
<div>
  <form id="edit-visit-form" onSubmit={handleSubmit(onSubmit)} className="hidden" />
  <div className="content">
    <!-- All content including modals -->
  </div>
  <button type="submit" form="edit-visit-form">Update Visit</button>
</div>
```