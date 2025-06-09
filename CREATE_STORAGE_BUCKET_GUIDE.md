# Create Storage Bucket for Documents

Since the API keys are having issues, please manually create the storage bucket in the Supabase Dashboard:

## Steps:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard/project/jjxlfunlbyayxwvlpgwt
2. **Navigate to Storage** in the left sidebar
3. **Click "Create a new bucket"**
4. **Configure the bucket**:
   - **Name**: `documents`
   - **Public**: `false` (keep it private)
   - **File size limit**: `52428800` (50MB in bytes)
   - **Allowed MIME types**: 
     ```
     application/pdf
     image/jpeg
     image/jpg
     image/png
     image/gif
     image/webp
     application/msword
     application/vnd.openxmlformats-officedocument.wordprocessingml.document
     text/plain
     application/vnd.ms-excel
     application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
     ```

5. **Click "Create bucket"**

## Create Database Table

1. **Go to SQL Editor** in the Supabase Dashboard
2. **Copy and paste** the contents of `CREATE_DOCUMENTS_TABLE_IN_SUPABASE.sql`
3. **Click "Run"** to execute the SQL

## After Setup

Once both the storage bucket and table are created:
- ✅ Document upload will work
- ✅ File previews will work  
- ✅ Download functionality will work
- ✅ Document management will be fully functional

The frontend is already complete and ready to use!