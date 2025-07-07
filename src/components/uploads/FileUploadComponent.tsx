import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  File, 
  Image, 
  Video, 
  FileText, 
  X, 
  AlertCircle, 
  CheckCircle2,
  Loader2,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface FileUploadProps {
  patientId: string;
  visitId?: string;
  uploadType: 'media' | 'laboratory' | 'imaging';
  onUploadSuccess?: (file: UploadedFile) => void;
  onUploadError?: (error: string) => void;
  maxFileSize?: number; // in bytes
  acceptedTypes?: string[];
}

interface UploadedFile {
  id: string;
  fileName: string;
  originalName: string;
  fileSize: number;
  fileType: string;
  mimeType: string;
  storagePath: string;
  title?: string;
  category?: string;
  testType?: string;
  imagingType?: string;
  description?: string;
  uploadedAt: string;
  url?: string;
}

const FileUploadComponent: React.FC<FileUploadProps> = ({
  patientId,
  visitId,
  uploadType,
  onUploadSuccess,
  onUploadError,
  maxFileSize = 50 * 1024 * 1024, // 50MB default
  acceptedTypes = []
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showMetadataModal, setShowMetadataModal] = useState(false);
  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState({
    title: '',
    category: '',
    description: '',
    testType: '',
    imagingType: '',
    bodyPart: '',
    studyDate: '',
    isUrgent: false,
    isSensitive: false
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  // Get bucket name and table name based on upload type
  const getBucketName = () => {
    // Use the existing working 'documents' bucket for all uploads
    // The table schemas specify the storage_bucket but we'll use the one that works
    return 'documents';
  };

  const getTableName = () => {
    switch (uploadType) {
      case 'media':
        return 'patient_media';
      case 'laboratory':
        return 'patient_laboratory';
      case 'imaging':
        return 'patient_imaging';
      default:
        return 'patient_documents'; // fallback
    }
  };


  // Get file icon based on mime type
  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return Image;
    if (mimeType.startsWith('video/')) return Video;
    if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
    return File;
  };

  // Validate file
  const validateFile = (file: File): string | null => {
    if (file.size > maxFileSize) {
      return `File size must be less than ${Math.round(maxFileSize / (1024 * 1024))}MB`;
    }
    
    if (acceptedTypes.length > 0 && !acceptedTypes.includes(file.type)) {
      return `File type ${file.type} not supported. Accepted types: ${acceptedTypes.join(', ')}`;
    }
    
    return null;
  };

  // Handle file upload
  const handleFileUpload = async (files: FileList | File[]) => {
    try {
      console.log('📁 handleFileUpload called with:', files.length, 'files');
      console.log('📁 Upload type:', uploadType);
      console.log('📁 Patient ID:', patientId);
      console.log('📁 Visit ID:', visitId);
      
      const fileArray = Array.from(files);
      
      for (const file of fileArray) {
        console.log('📁 Processing file:', file.name, 'Size:', file.size, 'Type:', file.type);
        
        const validationError = validateFile(file);
        if (validationError) {
          console.error('❌ File validation failed:', validationError);
          onUploadError?.(validationError);
          continue;
        }

        // Show metadata modal for certain file types
        if (uploadType === 'laboratory' || uploadType === 'imaging') {
          console.log(`🔵 Showing metadata modal for ${uploadType} upload`);
          setCurrentFile(file);
          setShowMetadataModal(true);
          return;
        }

        // Upload directly for media files
        console.log('🚀 Starting direct upload for media file');
        await uploadFileToStorage(file, {});
      }
    } catch (error) {
      console.error('💥 Error in handleFileUpload:', error);
      onUploadError?.(error instanceof Error ? error.message : 'File upload failed');
    }
  };

  // Upload file to storage and database
  const uploadFileToStorage = async (file: File, additionalMetadata: any) => {
    try {
      setUploading(true);
      setUploadProgress(0);

      // Check authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user) {
        throw new Error('Authentication required for uploads');
      }

      console.log(`🔵 Upload Type: ${uploadType}`);

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
      const bucketName = getBucketName();

      console.log(`🔵 Uploading ${file.name} to bucket: ${bucketName}`);
      console.log(`🔵 Storage path: ${fileName}`);

      // Upload to Supabase Storage
      const { data: storageData, error: storageError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (storageError) {
        console.error('❌ Storage upload error:', storageError);
        throw new Error(`Storage upload failed: ${storageError.message}`);
      }

      console.log('✅ File uploaded to storage:', storageData);

      // Prepare database record based on upload type
      const tableName = getTableName();
      let dbRecord: any = {
        patient_id: patientId,
        visit_id: visitId,
        file_name: fileName,
        original_name: file.name,
        file_size: file.size,
        file_type: fileExt,
        mime_type: file.type,
        storage_path: fileName,
        storage_bucket: 'documents',
        uploaded_by: session.user.id
      };

      // Add type-specific fields based on table schema
      if (uploadType === 'media') {
        dbRecord = {
          ...dbRecord,
          title: metadata.title || file.name,
          category: metadata.category || 'other',
          subcategory: null,
          description: metadata.description || null,
          tags: metadata.description ? [metadata.description] : null,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
            ...additionalMetadata
          },
          is_sensitive: metadata.isSensitive || false
        };
      } else if (uploadType === 'laboratory') {
        dbRecord = {
          ...dbRecord,
          test_type: metadata.testType || 'other',
          test_name: additionalMetadata.testName || null,
          test_code: null,
          lab_name: null,
          reference_number: null,
          test_date: metadata.studyDate ? new Date(metadata.studyDate).toISOString().split('T')[0] : null,
          result_date: null,
          status: 'pending',
          is_abnormal: false,
          critical_result: false,
          description: metadata.description || null,
          notes: null,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
            ...additionalMetadata
          },
          title: metadata.title || file.name
        };
      } else if (uploadType === 'imaging') {
        dbRecord = {
          ...dbRecord,
          imaging_type: metadata.imagingType || 'other',
          body_part: metadata.bodyPart || null,
          view_position: null,
          study_date: metadata.studyDate ? new Date(metadata.studyDate).toISOString().split('T')[0] : null,
          study_time: null,
          modality: null,
          series_number: null,
          instance_number: null,
          study_uid: null,
          series_uid: null,
          instance_uid: null,
          radiologist_name: null,
          referring_physician: null,
          clinical_indication: null,
          findings: null,
          impression: null,
          recommendations: null,
          is_urgent: metadata.isUrgent || false,
          contrast_used: false,
          radiation_dose: null,
          description: metadata.description || null,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
            ...additionalMetadata
          },
          title: metadata.title || file.name
        };
      }

      // Insert database record into appropriate table
      console.log(`🔵 Inserting into table: ${tableName}`);
      console.log(`🔵 Record data:`, dbRecord);
      
      const { data: dbData, error: dbError } = await supabase
        .from(tableName as any)
        .insert([dbRecord])
        .select()
        .single();

      if (dbError) {
        console.error('❌ Database insert error:', dbError);
        console.error('❌ Failed table:', tableName);
        console.error('❌ Failed record:', dbRecord);
        
        // Try to cleanup uploaded file
        try {
          await supabase.storage.from(bucketName).remove([fileName]);
          console.log('🧹 Cleaned up uploaded file after DB error');
        } catch (cleanupError) {
          console.error('❌ Failed to cleanup file:', cleanupError);
        }
        
        // Provide more specific error messages
        if (dbError.code === 'PGRST204') {
          throw new Error(`Column not found in table ${tableName}. This might be a schema mismatch issue.`);
        } else if (dbError.code === '42703') {
          throw new Error(`Database column missing: ${dbError.hint || dbError.message}`);
        } else {
          throw new Error(`Database insert failed: ${dbError.message}`);
        }
      }

      console.log('✅ Database record created:', dbData);
      console.log('✅ Record ID:', dbData.id);
      console.log('✅ Table:', tableName);

      // Create uploaded file object
      const uploadedFile: UploadedFile = {
        id: dbData.id,
        fileName: dbData.file_name,
        originalName: dbData.original_name,
        fileSize: dbData.file_size,
        fileType: dbData.file_type,
        mimeType: dbData.mime_type,
        storagePath: dbData.storage_path,
        title: dbData.title,
        category: dbData.category,
        testType: dbData.test_type,
        imagingType: dbData.imaging_type,
        description: dbData.description,
        uploadedAt: dbData.uploaded_at || dbData.created_at
      };

      setUploadedFiles(prev => [...prev, uploadedFile]);
      
      console.log('🎉 Upload complete! Calling onUploadSuccess callback');
      if (onUploadSuccess) {
        console.log('🎉 onUploadSuccess callback exists, calling it');
        onUploadSuccess(uploadedFile);
      } else {
        console.warn('⚠️ No onUploadSuccess callback provided');
      }

      // Reset metadata
      setMetadata({
        title: '',
        category: '',
        description: '',
        testType: '',
        imagingType: '',
        bodyPart: '',
        studyDate: '',
        isUrgent: false,
        isSensitive: false
      });

    } catch (error) {
      console.error('💥 Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Upload failed';
      onUploadError?.(errorMessage);
      
      // Set uploading to false but keep modal open for retry
      setUploading(false);
      setUploadProgress(0);
      
      // Don't close modal automatically on error - let user decide
      return;
    } finally {
      // This only runs on success
      setUploading(false);
      setUploadProgress(0);
      setCurrentFile(null);
      setShowMetadataModal(false);
    }
  };

  // Handle drag and drop
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  }, []);

  // Handle file input change
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  // Render category options based on upload type
  const renderCategoryOptions = () => {
    try {
      if (uploadType === 'media') {
        return [
          'clinical_photo', 
          'before_after', 
          'procedure_video', 
          'patient_education', 
          'consultation_recording', 
          'documentation', 
          'progress_photo',
          'scan_copy',
          'form_document',
          'id_document',
          'drivers_license',
          'passport',
          'birth_certificate',
          'medical_certificate',
          'insurance_card',
          'referral_letter',
          'prescription',
          'test_results',
          'xray_film',
          'other'
        ].map(cat => (
          <option key={cat} value={cat}>
            {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          </option>
        ));
      } else if (uploadType === 'laboratory') {
        return ['blood_work', 'urine_analysis', 'microbiology', 'chemistry', 'pathology', 'genetics', 'other'].map(type => (
          <option key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
        ));
      } else if (uploadType === 'imaging') {
        return ['x_ray', 'ct_scan', 'mri', 'ultrasound', 'mammography', 'dental_x_ray', 'panoramic_x_ray', 'cbct', 'other'].map(type => (
          <option key={type} value={type}>{type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
        ));
      }
      return [];
    } catch (error) {
      console.error('💥 Error rendering category options:', error);
      return [];
    }
  };

  // Debug logging
  React.useEffect(() => {
    console.log(`🔍 FileUploadComponent mounted with uploadType: ${uploadType}, patientId: ${patientId}, visitId: ${visitId}`);
  }, [uploadType, patientId, visitId]);

  try {
    return (
      <div className="space-y-6">
        {/* Upload Area */}
        <motion.div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : uploading
            ? 'border-green-500 bg-green-50'
            : 'border-gray-300 hover:border-gray-400 bg-gray-50'
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        whileHover={{ scale: 1.01 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedTypes.join(',')}
          onChange={handleFileInputChange}
          className="hidden"
        />

        {uploading ? (
          <div className="space-y-4">
            <Loader2 className="w-12 h-12 animate-spin text-green-600 mx-auto" />
            <div className="space-y-2">
              <p className="text-green-700 font-medium">Uploading...</p>
              <div className="w-full bg-green-200 rounded-full h-2">
                <div 
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Upload className="w-12 h-12 text-gray-500 mx-auto" />
            <div>
              <p className="text-lg font-medium text-gray-700">
                Drop files here or click to browse
              </p>
              <p className="text-sm text-gray-500 mt-1">
                Max file size: {Math.round(maxFileSize / (1024 * 1024))}MB
              </p>
              {acceptedTypes.length > 0 && (
                <p className="text-xs text-gray-400 mt-1">
                  Supported: {acceptedTypes.join(', ')}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Choose Files
            </button>
          </div>
        )}
      </motion.div>

      {/* Metadata Modal */}
      <AnimatePresence>
        {showMetadataModal && currentFile && uploadType && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={() => setShowMetadataModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">File Details</h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMetadataModal(false);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-gray-700">File: {currentFile.name}</p>
                  <p className="text-xs text-gray-500">Size: {(currentFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                </div>

                {/* Title Field for Media */}
                {uploadType === 'media' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Title *
                      <span className="text-xs text-gray-500 ml-1">(This will be displayed instead of the filename)</span>
                    </label>
                    <input
                      type="text"
                      value={metadata.title}
                      onChange={(e) => setMetadata(prev => ({ ...prev, title: e.target.value }))}
                      className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="e.g., 'Before treatment photo', 'Patient consultation video'"
                      required
                    />
                  </div>
                )}

                {/* Category/Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {uploadType === 'media' ? 'Category (Optional)' : uploadType === 'laboratory' ? 'Test Type' : 'Imaging Type'}
                    {uploadType === 'media' && (
                      <span className="text-xs text-gray-500 ml-1">(Helps organize your media files)</span>
                    )}
                  </label>
                  <select
                    value={uploadType === 'media' ? metadata.category : uploadType === 'laboratory' ? metadata.testType : metadata.imagingType}
                    onChange={(e) => setMetadata(prev => ({
                      ...prev,
                      [uploadType === 'media' ? 'category' : uploadType === 'laboratory' ? 'testType' : 'imagingType']: e.target.value
                    }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">
                      {uploadType === 'media' ? 'Choose a category...' : 'Select...'}
                    </option>
                    {renderCategoryOptions()}
                  </select>
                </div>

                {/* Additional fields for imaging */}
                {uploadType === 'imaging' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Body Part</label>
                      <input
                        type="text"
                        value={metadata.bodyPart}
                        onChange={(e) => setMetadata(prev => ({ ...prev, bodyPart: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="e.g., Chest, Abdomen, Head"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Study Date</label>
                      <input
                        type="date"
                        value={metadata.studyDate}
                        onChange={(e) => setMetadata(prev => ({ ...prev, studyDate: e.target.value }))}
                        className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="isUrgent"
                        checked={metadata.isUrgent}
                        onChange={(e) => setMetadata(prev => ({ ...prev, isUrgent: e.target.checked }))}
                        className="mr-2"
                      />
                      <label htmlFor="isUrgent" className="text-sm text-gray-700">Mark as urgent</label>
                    </div>
                  </>
                )}

                {/* Additional fields for laboratory */}
                {uploadType === 'laboratory' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Test Date</label>
                    <input
                      type="date"
                      value={metadata.studyDate}
                      onChange={(e) => setMetadata(prev => ({ ...prev, studyDate: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={metadata.description}
                    onChange={(e) => setMetadata(prev => ({ ...prev, description: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-20"
                    placeholder="Optional description or notes..."
                  />
                </div>

                {/* Sensitive checkbox for media */}
                {uploadType === 'media' && (
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isSensitive"
                      checked={metadata.isSensitive}
                      onChange={(e) => setMetadata(prev => ({ ...prev, isSensitive: e.target.checked }))}
                      className="mr-2"
                    />
                    <label htmlFor="isSensitive" className="text-sm text-gray-700">Mark as sensitive</label>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowMetadataModal(false);
                  }}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    // Validate required fields for media uploads
                    if (uploadType === 'media' && !metadata.title.trim()) {
                      alert('Please enter a title for this media file');
                      return;
                    }
                    uploadFileToStorage(currentFile, {});
                  }}
                  disabled={uploading || (uploadType === 'media' && !metadata.title.trim())}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  Upload
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    );
  } catch (error) {
    console.error('💥 FileUploadComponent render error:', error);
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
        <h3 className="text-red-800 font-medium mb-2">Upload Component Error</h3>
        <p className="text-red-600 text-sm">
          There was an error loading the upload component. Please refresh the page and try again.
        </p>
        <details className="mt-2">
          <summary className="text-red-700 text-xs cursor-pointer">Technical Details</summary>
          <pre className="text-red-600 text-xs mt-1 whitespace-pre-wrap">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </details>
      </div>
    );
  }
};

export default FileUploadComponent;