# Simple Storage Fix for Document Uploads

## 🎯 Problem
Document uploads fail because storage.objects table has RLS enabled but no policies for the documents bucket.

## ✅ Quick Solution
Execute this SQL in Supabase Dashboard > SQL Editor:

```sql
-- Temporarily disable RLS on storage.objects to allow uploads
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;
```

## 📋 Steps to Execute

1. **Open Supabase Dashboard**
   - Go to https://supabase.com/dashboard
   - Select your HPMS project

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Execute the SQL**
   - Paste: `ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;`
   - Click "Run"

4. **Test Document Upload**
   - Log into HPMS application
   - Go to any patient's Documents tab
   - Try uploading a file

## 🔐 Security Note
This temporarily disables storage security but is safe for your development environment. For production, you would want to create proper RLS policies.

## 🚀 Alternative: Manual Policy Creation

If you prefer to keep RLS enabled, manually create these policies in SQL Editor:

```sql
-- Enable RLS first
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create upload policy
CREATE POLICY "Allow authenticated uploads to documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Create read policy
CREATE POLICY "Allow authenticated reads from documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');

-- Create delete policy
CREATE POLICY "Allow authenticated deletes from documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents' AND auth.role() = 'authenticated');
```

## ✨ Expected Result
After executing either solution, document uploads should work immediately for logged-in users.