# Enhanced Document Upload Features

## 🎯 New Features to Implement

### 1. **Document Title Field**
- Add title input field to upload modal
- Store custom titles in database
- Display titles instead of filenames in document list

### 2. **Thumbnail Generation**
- Generate thumbnails for image uploads
- Show preview thumbnails in upload queue
- Display thumbnails in document list

### 3. **Camera Capture**
- Add camera button to capture photos directly
- Support for ID documents, driver licenses
- Real-time camera preview with capture controls

### 4. **Image Processing**
- Auto-scaling and cropping for documents
- Resolution optimization
- Format conversion (PNG/PDF)
- Document type detection and enhancement

### 5. **Database Changes Required**

Execute this SQL in Supabase Dashboard > SQL Editor:

```sql
-- Add title column to patient_documents table
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS title TEXT;

-- Add thumbnail_url column for storing thumbnail paths
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- Add is_processed column to track image processing status
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS is_processed BOOLEAN DEFAULT false;

-- Add processing_metadata for storing crop/resize info
ALTER TABLE patient_documents 
ADD COLUMN IF NOT EXISTS processing_metadata JSONB;

-- Create index for searching by title
CREATE INDEX IF NOT EXISTS idx_patient_documents_title 
ON patient_documents(title);

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'patient_documents' 
ORDER BY ordinal_position;
```

### 6. **Required NPM Packages**

```bash
npm install react-image-crop html2canvas jspdf
```

## 🔧 Implementation Plan

1. **Database Schema Update** - Add title and thumbnail columns
2. **Enhanced Upload Modal** - Add title field and camera button
3. **Camera Component** - Implement photo capture functionality
4. **Image Processing** - Add crop, resize, and format conversion
5. **Thumbnail Generation** - Create thumbnails for all uploads
6. **Enhanced Document List** - Show thumbnails and titles

## 📱 User Experience Flow

1. User clicks "Upload Documents" button
2. Modal shows three options:
   - **Upload Files** (existing functionality)
   - **Take Photo** (new camera capture)
   - **Scan Document** (optimized for IDs/licenses)
3. For uploads: User adds title, selects files, uploads
4. For camera: User captures, crops/adjusts, saves as PNG/PDF
5. All uploads generate thumbnails automatically
6. Document list shows thumbnails with custom titles

This will create a professional document management system with modern features!