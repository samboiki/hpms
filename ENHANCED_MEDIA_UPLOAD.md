# Enhanced Media Upload Feature

## Overview
The media upload functionality in the Edit Visit form has been enhanced to provide a better user experience with category selection requirements and camera integration.

## Features

### 1. **Upload Options Modal**
- When clicking the dropzone, users are presented with two options:
  - **Upload Files**: Choose files from device
  - **Take Photo**: Use device camera to capture images

### 2. **Camera Integration**
- Direct camera access within the application
- Capture photos without leaving the form
- Uses back camera on mobile devices when available
- Real-time preview before capture

### 3. **Required Category Selection**
- Users MUST select a category before uploading
- Categories include:
  - Procedure Photos
  - Before/After
  - X-Ray Images
  - CT/MRI Scans
  - Wound Care
  - Surgery Documentation
  - Lab Result Images
  - Prescription Photos
  - Other Medical Media

### 4. **File Management**
- Support for images, videos, and audio files
- Maximum file size: 50MB
- Drag & drop support
- Multiple file selection
- Preview uploaded files
- Remove files before upload

### 5. **Metadata**
- Optional description field
- Tag system for better organization
- Automatic file categorization

## Usage

1. **Navigate to Media Tab**
   - Go to Dashboard > Patients > Patient Profile > Encounters
   - Edit a visit
   - Click on the "Media" tab

2. **Upload Files**
   - Click the dropzone area
   - Choose "Upload Files" or "Take Photo"
   - If taking photo: Capture and confirm
   - If uploading: Select files from device

3. **Categorize Files**
   - Select appropriate category (REQUIRED)
   - Add optional description
   - Add tags if needed

4. **Complete Upload**
   - Click "Upload X File(s)" button
   - Files are uploaded to Supabase storage
   - Metadata saved to patient_media table

## Technical Details

- **Component**: `EnhancedMediaUpload.tsx`
- **Storage Bucket**: `media`
- **Database Table**: `patient_media`
- **File Path Format**: `{patientId}/{visitId}/{timestamp}_{random}.{ext}`

## Security
- Files are stored securely in Supabase storage
- Access controlled by RLS policies
- Only authenticated users can upload
- File type validation enforced