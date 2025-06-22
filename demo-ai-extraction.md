# AI Lab Extraction Demo Instructions

## 🚀 Testing the AI Lab Extraction Feature

The AI extraction functionality has been successfully implemented and integrated with the existing OpenAI edge function. Here's how to test it:

### 📋 Prerequisites
1. Dashboard running on: http://localhost:5002/
2. User logged in with admin credentials
3. Patient selected with an active visit

### 🧪 Demo Workflow

#### Step 1: Create a Lab Request
1. Navigate to a patient's visit
2. Go to Laboratory tab
3. Click "New Lab Request" 
4. Fill in basic information:
   - Test Name: "Blood Chemistry Panel"
   - Test Category: "Blood Work"
   - Clinical Indication: "Routine health check"
   - Priority: "Routine"
5. Save the request

#### Step 2: Upload Lab Request Form
1. Switch to "File Uploads" section in Laboratory tab
2. Upload an image of a lab request form (PDF, JPG, PNG)
3. Fill metadata if required
4. Complete upload

#### Step 3: AI Extract Lab Request
1. Return to "Lab Requests" section
2. Find your created request
3. Click "Extract Request" button in the Request Form column
4. AI will:
   - Find uploaded image files
   - Call OpenAI Vision API
   - Extract test names and details
   - Update the lab request automatically

#### Step 4: Upload Lab Results
1. Upload an image of lab results (with test values)
2. This could be a different image with actual lab values

#### Step 5: AI Extract Lab Results  
1. Click "Extract Results" button in the Results column
2. AI will:
   - Find result images
   - Extract test values, units, reference ranges
   - Create entries in lab_results table
   - Mark request as completed

### ✅ Expected Results

**After Request Extraction:**
- Test name updated with extracted information
- Status remains "pending"
- Clinical indication shows extraction source

**After Results Extraction:**
- Request status changes to "completed"
- Individual lab_results created for each test
- Completion timestamp added

### 🔧 Technical Features

- **AI Service**: Uses existing `/supabase/functions/extract-text/index.ts`
- **Vision AI**: OpenAI GPT-4o-mini with medical prompts
- **File Security**: Signed URLs for secure access
- **Error Handling**: Comprehensive validation and user feedback
- **Data Storage**: Structured storage in database tables

### 🐛 Troubleshooting

1. **"No files found"**: Upload an image file first
2. **"AI extraction failed"**: Check network and OpenAI API key
3. **"Database error"**: Ensure lab_requests table has AI fields
4. **"Access denied"**: Verify user authentication

The implementation integrates seamlessly with the existing codebase and provides a complete end-to-end AI-powered lab management workflow.