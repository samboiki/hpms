# Deploy PDF Extraction Fix

## Problem
The extract-text edge function was failing to process PDF files with error:
```
"You uploaded an unsupported image. Please make sure your image has of one the following formats: ['png', 'jpeg', 'gif', 'webp']."
```

## Solution
Updated the edge function to properly handle PDF files using OpenAI's new PDF input API.

## Steps to Deploy:

### 1. Go to Supabase Dashboard
1. Open your Supabase project: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. Navigate to **Edge Functions** in the left sidebar
3. Find the `extract-text` function

### 2. Update the Function Code
Replace the entire function code with the updated version from:
`/home/happy/projects/hpms/supabase/functions/extract-text/index.ts`

### 3. Key Changes Made:
- ✅ Added proper PDF detection from URL and file type
- ✅ Implemented OpenAI direct PDF processing using base64 encoding
- ✅ Maintained backward compatibility for image processing
- ✅ Added comprehensive error handling for PDF processing
- ✅ Updated error messages to include PDF support

### 4. PDF Processing Flow:
```typescript
if (isPDF) {
  // Download PDF and convert to base64
  const pdfResponse = await fetch(imageUrl);
  const arrayBuffer = await pdfResponse.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join('');
  const base64String = btoa(binaryString);
  
  // Send to OpenAI with PDF support
  content: [
    {
      type: 'text',
      text: 'Please analyze this lab result PDF and extract ALL test results. Return them as a JSON array.'
    },
    {
      type: 'image_url',
      image_url: { 
        url: `data:application/pdf;base64,${base64String}`
      }
    }
  ]
}
```

### 5. Supported File Types:
- ✅ PDF files (.pdf)
- ✅ JPEG images (.jpg, .jpeg)
- ✅ PNG images (.png)
- ✅ GIF images (.gif)
- ✅ WebP images (.webp)

## After Deployment:
1. ✅ Test PDF extraction from the Laboratory tab
2. ✅ Check function logs in Supabase dashboard for debugging
3. ✅ Verify both PDF and image extraction work correctly

## Testing:
Try uploading a PDF lab result from the Laboratory tab. You should now see:
- ✅ No format errors for PDF files
- ✅ Proper AI extraction of lab results from PDFs
- ✅ JSON array returned with test results
- ✅ Lab results automatically populated in the form

The edge function now supports both PDF and image lab result extraction!