# Deploy Claude API for PDF Support

## 🎯 **Hybrid Solution: Claude for PDFs, OpenAI for Images**

### What's New:
- ✅ **PDFs**: Processed with Claude API (native PDF support)
- ✅ **Images**: Continue using OpenAI Vision API
- ✅ **Best of both worlds**: Each API used for what it does best

## 🔧 **Implementation Details**

### Claude API for PDFs:
```typescript
// Claude supports PDFs natively via document type
{
  type: 'document',
  source: {
    type: 'base64',
    media_type: 'application/pdf',
    data: base64String
  }
}
```

### OpenAI Vision API for Images:
```typescript
// OpenAI handles images perfectly
{
  type: 'image_url',
  image_url: { url: base64Image }
}
```

## 🚀 **Deployment Steps**

### 1. Add Claude API Key to Supabase
In your Supabase Dashboard:
1. Go to Edge Functions → `extract-text`
2. Add environment variable: `CLAUDE_API_KEY`
3. Get your Claude API key from: https://console.anthropic.com/

### 2. Deploy Updated Function
Copy the entire updated function from:
`/home/happy/projects/hpms/supabase/functions/extract-text/index.ts`

### 3. Test Both File Types
- **PDF**: Should be processed by Claude API
- **Image**: Should be processed by OpenAI Vision API

## 📊 **Support Matrix**

| File Type | API Used | Status |
|-----------|----------|---------|
| PDF | Claude API | ✅ Full Support |
| JPG/JPEG | OpenAI Vision | ✅ Full Support |
| PNG | OpenAI Vision | ✅ Full Support |
| GIF | OpenAI Vision | ✅ Full Support |
| WebP | OpenAI Vision | ✅ Full Support |

## 🔑 **Environment Variables Required**

```bash
OPENAI_API_KEY=sk-...  # For image processing
CLAUDE_API_KEY=sk-ant-... # For PDF processing
```

## 🧪 **Testing Guide**

### PDF Upload Test:
1. Upload a PDF lab result
2. Function detects PDF → Uses Claude API
3. Claude extracts text from PDF natively
4. Returns JSON array of lab results

### Image Upload Test:
1. Upload JPG/PNG lab result
2. Function detects image → Uses OpenAI Vision API
3. OpenAI analyzes image
4. Returns same JSON format

## 💡 **Benefits of This Approach**

1. **Native PDF Support**: Claude handles PDFs without conversion
2. **Reliable Image Processing**: OpenAI Vision API proven for images
3. **Consistent Output**: Both APIs return same JSON format
4. **No External Dependencies**: No OCR services needed
5. **Better Error Handling**: Specific errors for each file type

## ⚠️ **Important Notes**

- **Claude API Key Required**: Without it, PDFs will show configuration error
- **Model Used**: `claude-3-opus-20240229` for best accuracy
- **Fallback**: Users can still convert PDF to image if Claude is unavailable
- **Cost**: Both APIs have usage-based pricing

## 📈 **Future Enhancements**

1. Add Claude Vision support for images too
2. Implement caching for repeated documents
3. Support multi-page PDF processing
4. Add progress indicators for large files

The system now supports both PDFs and images seamlessly!