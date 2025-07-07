# Lab Request System - Final Implementation

## Overview
A two-step lab request system:
1. **Create Request** - User creates a pending lab request with minimal info
2. **Complete Request** - User completes the request via manual entry or AI extraction

## Database Structure

### lab_requests table
- `request_date` - When lab was requested
- `preferred_date` - Expected results date (optional)
- `lab_facility` - Laboratory name (optional)
- `status` - pending → completed
- `media_url` - Uploaded document URL (when using AI)
- `notes` - Optional notes

### lab_results table
- Links to lab_request via `lab_request_id`
- Stores individual test results:
  - `test_name` - Name of test
  - `test_value` - Result value
  - `test_unit` - Unit of measurement
  - `reference_range` - Normal range

## User Workflow

### Step 1: Create Lab Request
1. Click "New Lab Request" button
2. Enter:
   - Request date (defaults to today)
   - Expected results date (optional)
   - Laboratory name (optional)
   - Notes (optional)
3. Save as "pending" status

### Step 2: Complete Lab Request
For each pending request, user can choose:

#### Option A: Manual Entry
1. Click "Enter Results" button
2. Add test results manually:
   - Test name (required)
   - Value (required)  
   - Unit (optional)
   - Reference range (optional)
3. Add multiple tests with "Add Another Test" button
4. Save to complete the request

#### Option B: AI Extraction
1. Click "AI Extract" button
2. Upload PDF or image of lab results
3. AI automatically:
   - Extracts all test results
   - Saves them to database
   - Marks request as completed

### Viewing Results
- Table shows all lab requests with status
- Completed requests show number of tests
- Click "View Results" to expand and see all test results
- High/low values highlighted automatically

## Components

1. **LabResultsTable.tsx** - Main table view with action buttons
2. **CreateLabRequest.tsx** - Form for creating pending requests
3. **EnterLabResults.tsx** - Manual entry form for test results
4. **UploadLabDocument.tsx** - Upload and AI extraction modal

## Key Features

- **Clear workflow** - Separate request creation from result entry
- **Flexibility** - Manual or AI-assisted data entry
- **Batch processing** - Enter/extract multiple tests at once
- **Status tracking** - Clear pending/completed states
- **Smart display** - Expandable rows, highlighted abnormal values
- **Clean UI** - Professional table layout with action buttons

## Edge Function
The `extract-text` function remains unchanged - extracts test results with:
- testName
- testValue
- testUnit
- referenceRange