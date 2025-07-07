# Ultra-Simplified Lab System

## Overview
The lab system has been radically simplified:
1. **User creates request** - Only enters request date, expected date, and lab facility
2. **Upload document** - Uploads PDF or image of lab results
3. **AI auto-extracts** - System automatically extracts all test results
4. **View results** - All test results displayed in expandable format

## Database Structure

### lab_requests table
- `request_date` - When the lab was requested
- `preferred_date` - Expected results date (optional)
- `lab_facility` - Lab name (optional)
- `status` - pending/completed/cancelled
- `media_url` - Uploaded document URL
- `notes` - Optional notes

### lab_results table
- `lab_request_id` - Links to parent request
- `test_name` - Extracted test name
- `test_value` - Extracted result value
- `test_unit` - Extracted unit
- `reference_range` - Extracted reference range

## User Workflow

### Creating Lab Request
1. Click "Upload Lab Results"
2. Enter request date (defaults to today)
3. Optionally enter expected date and lab facility
4. Upload PDF or image file
5. System automatically:
   - Creates lab request
   - Extracts all test results using AI
   - Saves individual test results
   - Marks request as completed

### Viewing Results
- Expandable list shows all lab requests
- Click chevron to expand and see all test results
- Results show test name, value with unit, and reference range
- High/low values highlighted automatically

### Re-processing
- If AI extraction fails or needs retry, click the wand icon
- System will re-extract results from the uploaded document

## Key Features
1. **Zero data entry** - No manual test entry required
2. **Batch extraction** - Extracts all tests from a single document
3. **Smart status** - Automatically detects high/low values
4. **Clean UI** - Expandable cards for easy viewing
5. **One-click upload** - Upload triggers automatic processing

## Edge Function
The `extract-text` function:
- Accepts PDF or image files
- Extracts all test results in one pass
- Returns array of test results with 4 fields each:
  - testName
  - testValue
  - testUnit
  - referenceRange

## Benefits
- **Faster** - Upload and done, no manual entry
- **Accurate** - AI extraction reduces errors
- **Complete** - Captures all tests from document
- **Simple** - Minimal UI, maximum efficiency