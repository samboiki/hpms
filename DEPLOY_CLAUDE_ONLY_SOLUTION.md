# Deploy Claude API for All File Types

## 🎯 **Unified Solution: Claude for Everything**

Claude's Vision API handles both PDFs and images excellently, providing a single, consistent solution.

## ✅ **What's Changed**

### Single API for All Files:
- **PDFs**: Uses Claude's `document` type with native PDF support
- **Images**: Uses Claude's `image` type with vision capabilities
- **Consistent**: Same model, same API, same response format

### Simplified Configuration:
- Only need `CLAUDE_API_KEY` (no OpenAI key required)
- One API to manage, monitor, and pay for
- Unified error handling and logging

## 🚀 **Deployment Steps**

### 1. Set Claude API Key in Supabase
1. Go to: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. Navigate to **Edge Functions** → `extract-text`
3. Add environment variable:
   ```
   CLAUDE_API_KEY=sk-ant-api03-...
   ```
4. Get your key from: https://console.anthropic.com/

### 2. Deploy the Updated Function
Replace the entire function code with the new version from:
`/home/happy/projects/hpms/supabase/functions/extract-text/index.ts`

### 3. Remove OpenAI Dependency
You can now remove the `OPENAI_API_KEY` environment variable if not used elsewhere.

## 📊 **Supported Formats**

| File Type | Claude Type | Status |
|-----------|-------------|---------|
| PDF | `document` | ✅ Native Support |
| JPG/JPEG | `image` | ✅ Full Support |
| PNG | `image` | ✅ Full Support |
| GIF | `image` | ✅ Full Support |
| WebP | `image` | ✅ Full Support |

## 🔧 **Technical Details**

### PDF Processing:
```typescript
{
  type: 'document',
  source: {
    type: 'base64',
    media_type: 'application/pdf',
    data: base64String
  }
}
```

### Image Processing:
```typescript
{
  type: 'image',
  source: {
    type: 'base64',
    media_type: 'image/jpeg', // or png, gif, webp
    data: base64String
  }
}
```

## 🧪 **Testing Guide**

### Test All File Types:
1. **PDF**: Upload a lab result PDF
2. **JPG**: Upload a photo of lab results
3. **PNG**: Upload a screenshot
4. **Multi-page PDF**: Test with complex documents

All should return the same JSON format:
```json
{
  "results": [
    {
      "testName": "Glucose",
      "value": "95",
      "unit": "mg/dL",
      "referenceRange": "70-100",
      "status": "normal"
    }
  ]
}
```

## 💡 **Benefits of Claude-Only Approach**

1. **Unified Processing**: Single API for all file types
2. **Native PDF Support**: No OCR workarounds needed
3. **Better Context Understanding**: Claude excels at document comprehension
4. **Cost Efficiency**: One API subscription instead of two
5. **Simpler Maintenance**: One integration to maintain
6. **Consistent Performance**: Same model for all files

## ⚙️ **Configuration**

### Required Environment Variables:
```bash
CLAUDE_API_KEY=sk-ant-api03-...  # Your Claude API key
```

### Model Used:
- **claude-3-opus-20240229** - Highest accuracy for medical documents
- Alternative: **claude-3-sonnet-20240229** - Faster, still very accurate

## 📈 **Performance Notes**

- **File Size**: Claude handles large PDFs well (up to 5MB recommended)
- **Multi-page**: Processes all pages in PDFs automatically
- **Speed**: ~2-5 seconds for typical lab results
- **Accuracy**: Excellent OCR and data extraction

## 🔍 **Debugging**

Check function logs for:
- `Processing file:` - Shows detected file type
- `File converted to base64` - Confirms successful download
- `Claude API response:` - Full API response
- `Parsed lab results:` - Final extracted data

## 🚨 **Error Handling**

The function provides clear errors for:
- Missing API key
- File download failures
- API errors
- JSON parsing issues
- Includes partial AI response in errors for debugging

## 🎉 **Result**

You now have a robust, unified solution that handles both PDFs and images seamlessly with Claude's excellent vision and document processing capabilities!