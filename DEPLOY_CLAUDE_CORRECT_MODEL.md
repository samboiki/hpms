# Deploy Claude with Correct Model for PDF Support

## 🚨 **Important: Model Update Required**

The error revealed that **`claude-3-opus-20240229` does NOT support PDF input**.

## ✅ **Solution: Use Claude 3.5 Sonnet**

### Updated Model:
```typescript
model: 'claude-3-5-sonnet-20241022'
```

This model supports:
- ✅ **PDF documents** via `document` type
- ✅ **Images** via `image` type
- ✅ **Better performance** than Opus for most tasks
- ✅ **Lower cost** than Opus

## 🚀 **Deployment Steps**

### 1. **Ensure Claude API Key is Set**
In Supabase Dashboard → Edge Functions → `extract-text`:
```
Environment Variables:
CLAUDE_API_KEY = sk-ant-api03-YOUR-KEY-HERE
```

### 2. **Deploy Updated Function**
The function now uses the correct model that supports PDFs.

## 📊 **Claude Model Comparison**

| Model | PDF Support | Image Support | Best For |
|-------|-------------|---------------|----------|
| claude-3-opus-20240229 | ❌ No | ✅ Yes | Complex reasoning (no PDFs) |
| claude-3-5-sonnet-20241022 | ✅ Yes | ✅ Yes | Documents & images |
| claude-3-haiku-20240307 | ❌ No | ✅ Yes | Fast responses (no PDFs) |

## 🧪 **Testing**

After deployment:
1. **PDF Test**: Should now work with Claude 3.5 Sonnet
2. **Image Test**: Continues to work as before

## 💡 **Why This Happened**

- Older Claude models (like Opus) don't support the `document` type
- Only newer models like Claude 3.5 Sonnet have native PDF support
- The API gives a clear error: "does not support PDF input"

## 🔧 **Technical Details**

The function now correctly uses:
```typescript
// For PDFs - only works with Claude 3.5 Sonnet
{
  type: 'document',
  source: {
    type: 'base64',
    media_type: 'application/pdf',
    data: base64String
  }
}
```

## 📈 **Benefits of Claude 3.5 Sonnet**

1. **Native PDF Support**: No workarounds needed
2. **Excellent Accuracy**: Great for medical documents
3. **Cost Effective**: Cheaper than Opus
4. **Fast Processing**: Quick responses
5. **Multi-modal**: Handles both PDFs and images

The system should now work perfectly with both PDFs and images!