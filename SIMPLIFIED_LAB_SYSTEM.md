# Simplified Lab Request System

## Overview
The lab request system has been simplified to focus on the essential workflow:
1. Users create a lab request with just the test name
2. They can upload a PDF or image of the lab results
3. Results can be entered manually or extracted using AI
4. AI extraction focuses on 4 key fields only: test name, value, unit, and reference range

## Database Changes

### Updated lab_requests table structure:
```sql
- test_name (required) - Name of the test/investigation
- test_value - The actual result value
- test_unit - Unit of measurement (mg/dL, mmol/L, etc)
- reference_range - Normal reference range
- status - pending/completed/cancelled
- media_url - URL to uploaded document
- ai_extraction_data - JSON data from AI extraction
```

## AI Extraction

The AI extraction now focuses only on extracting:
1. **Test Name** - The name of the test/investigation
2. **Test Value** - The actual result value (numeric or text)
3. **Test Unit** - The unit of measurement
4. **Reference Range** - The normal/reference range

## User Workflow

### Creating a Request
1. Click "New Lab Request"
2. Enter the test name (required)
3. Optionally upload a document
4. Save as "pending" or enter values and save as "completed"

### Completing a Request
For pending requests, users can:
1. **Manual Entry** - Click edit icon and enter values manually
2. **Upload & Extract** - Upload a document and click the AI extract button
3. **AI Extraction** - If document already uploaded, click the wand icon to extract values

### UI Components

- **LabRequestSimple.tsx** - Form for creating new lab requests
- **LabResultsSimple.tsx** - List view with inline editing and AI extraction
- Integrated into EditVisitTabs for seamless workflow

## Key Features

1. **Simple Data Model** - Only stores essential test result information
2. **Flexible Entry** - Manual or AI-assisted data entry
3. **Document Support** - Upload and store lab result documents
4. **Status Tracking** - Clear pending/completed workflow
5. **AI Integration** - One-click extraction of test results from documents

## Edge Function Updates

The `extract-text` function now:
- Accepts both PDFs and images
- Focuses only on extracting the 4 key fields
- Returns a simple JSON array of test results
- Handles multiple results in a single document