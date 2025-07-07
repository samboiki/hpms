# Lab System - Update & Delete Features

## Features Added

### 1. Delete Lab Requests
- Added delete button (trash icon) for each lab request
- Confirmation dialog before deletion
- Works for both pending and completed requests
- Cascade deletes associated lab results automatically

### 2. Edit Lab Requests
- Added edit button (pencil icon) for pending requests
- Can update:
  - Request date
  - Expected results date
  - Laboratory name
  - Notes
  - Status (pending/completed/cancelled)
- Modal form for editing

### 3. UI Updates
- Action buttons in table:
  - **Pending requests**: Enter Results | AI Extract | Edit | Delete
  - **Completed requests**: View Results | Delete
- Loading states for delete operations
- Icons for better visual clarity

## How to Use

### Delete a Lab Request
1. Click the trash icon in the Actions column
2. Confirm deletion in the popup
3. Request and all associated results will be deleted

### Edit a Lab Request
1. Click the pencil icon (only available for pending requests)
2. Update any fields in the modal
3. Click "Update Request" to save changes

### Notes
- Deleting a lab request will also delete all associated test results
- Edit functionality is primarily for pending requests
- Completed requests can still be deleted if needed
- All actions refresh the table automatically