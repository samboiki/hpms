import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  Image,
  File,
  X,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Tag,
  Plus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import FormModal from './FormModal';

interface DocumentUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  visitId?: string;
  onUploadSuccess?: () => void;
}

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

const ALLOWED_TYPES = {
  'application/pdf': { icon: FileText, color: 'text-red-600', bg: 'bg-red-100' },
  'image/jpeg': { icon: Image, color: 'text-blue-600', bg: 'bg-blue-100' },
  'image/jpg': { icon: Image, color: 'text-blue-600', bg: 'bg-blue-100' },
  'image/png': { icon: Image, color: 'text-green-600', bg: 'bg-green-100' },
  'image/gif': { icon: Image, color: 'text-purple-600', bg: 'bg-purple-100' },
  'image/webp': { icon: Image, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  'application/msword': { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { icon: FileText, color: 'text-blue-600', bg: 'bg-blue-100' },
  'text/plain': { icon: FileText, color: 'text-gray-600', bg: 'bg-gray-100' },
  'application/vnd.ms-excel': { icon: FileText, color: 'text-green-600', bg: 'bg-green-100' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { icon: FileText, color: 'text-green-600', bg: 'bg-green-100' }
};

const CATEGORIES = [
  { value: 'general', label: 'General Documents', icon: FileText },
  { value: 'lab_results', label: 'Lab Results', icon: FileText },
  { value: 'imaging', label: 'Medical Imaging', icon: Image },
  { value: 'referrals', label: 'Referrals', icon: FileText },
  { value: 'consent_forms', label: 'Consent Forms', icon: FileText },
  { value: 'insurance', label: 'Insurance Documents', icon: FileText },
  { value: 'prescriptions', label: 'Prescriptions', icon: FileText },
  { value: 'discharge_summaries', label: 'Discharge Summaries', icon: FileText }
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const DocumentUploadModal: React.FC<DocumentUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  patientId, 
  visitId, 
  onUploadSuccess 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Check authentication when modal opens
  React.useEffect(() => {
    if (isOpen && !authChecked) {
      checkAuthentication();
    }
  }, [isOpen]);

  const checkAuthentication = async () => {
    console.log('🔐 Checking authentication for document upload...');
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Session check failed:', error);
        setIsAuthenticated(false);
        setCurrentUser(null);
      } else if (session && session.user) {
        console.log('✅ User authenticated:', session.user.email);
        console.log('🎫 Session valid until:', new Date(session.expires_at * 1000).toLocaleString());
        setIsAuthenticated(true);
        setCurrentUser(session.user);
      } else {
        console.log('⚠️ No authenticated session');
        setIsAuthenticated(false);
        setCurrentUser(null);
      }
    } catch (error) {
      console.error('💥 Auth check failed:', error);
      setIsAuthenticated(false);
      setCurrentUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  const validateFile = (file: File): string | null => {
    console.log('🔍 Validating file:', file.name, 'Size:', file.size, 'Type:', file.type);
    
    if (file.size > MAX_FILE_SIZE) {
      console.error('❌ File too large:', file.name, file.size);
      return 'File size must be less than 50MB';
    }
    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      console.error('❌ File type not supported:', file.type);
      return 'File type not supported';
    }
    
    console.log('✅ File validation passed:', file.name);
    return null;
  };

  const getFileIcon = (mimeType: string) => {
    const typeInfo = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    return typeInfo ? typeInfo.icon : File;
  };

  const getFileColor = (mimeType: string) => {
    const typeInfo = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    return typeInfo ? typeInfo.color : 'text-gray-600';
  };

  const getFileBg = (mimeType: string) => {
    const typeInfo = ALLOWED_TYPES[mimeType as keyof typeof ALLOWED_TYPES];
    return typeInfo ? typeInfo.bg : 'bg-gray-100';
  };

  const uploadFileToStorage = async (file: File, uploadFile: UploadedFile): Promise<string> => {
    console.log('📤 Starting upload to storage for:', file.name);
    
    // Check authentication and get session
    console.log('🔐 Checking authentication status...');
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session check failed:', sessionError);
      throw new Error('Authentication error. Please log in and try again.');
    }
    
    if (!session || !session.user) {
      console.error('🚨 USER NOT AUTHENTICATED - Login required for uploads');
      throw new Error('You must be logged in to upload documents. Please log in and try again.');
    }
    
    console.log('✅ User authenticated:', session.user.email);
    console.log('🎫 Session token available:', !!session.access_token);
    
    // Skip bucket listing check - just try to upload directly
    console.log('📁 Proceeding with upload to documents bucket...');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log('📁 Storage path:', fileName);
    
    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setUploadedFiles(prev => prev.map(f => 
        f.id === uploadFile.id && f.progress < 90
          ? { ...f, progress: f.progress + 10 }
          : f
      ));
    }, 100);
    
    try {
      console.log('🔄 Uploading to Supabase Storage...');
      const { data, error } = await supabase.storage
        .from('documents')
        .upload(fileName, file, {
          cacheControl: '3600',
          upsert: false
        });

      clearInterval(progressInterval);

      if (error) {
        console.error('❌ Storage upload failed:', error);
        console.error('❌ Error details:', {
          message: error.message,
          statusCode: error.statusCode,
          error: error.error
        });
        
        if (error.message.includes('row-level security')) {
          console.error('🚨 RLS ERROR IN STORAGE - Storage policies need to be configured');
          throw new Error('Storage access denied. Please ensure you are logged in and have proper permissions.');
        }
        
        if (error.message.includes('bucket') && error.message.includes('not found')) {
          console.error('🚨 BUCKET ACCESS ERROR - documents bucket may not be accessible');
          throw new Error('documents storage bucket is not accessible. Please contact administrator.');
        }
        
        throw new Error(error.message);
      }

      console.log('✅ File uploaded to storage successfully:', data.path);
      return data.path;
    } catch (error) {
      clearInterval(progressInterval);
      console.error('❌ Upload exception:', error);
      throw error;
    }
  };

  const saveFileMetadata = async (file: File, storagePath: string) => {
    console.log('💾 Saving file metadata to database...');
    
    // Check authentication and get session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError) {
      console.error('❌ Session fetch error:', sessionError);
      throw new Error('Authentication error while saving metadata.');
    }
    
    if (!session || !session.user) {
      console.error('🚨 USER NOT AUTHENTICATED - Cannot save metadata');
      throw new Error('You must be logged in to save document metadata.');
    }
    
    const user = session.user;
    console.log('👤 Authenticated user:', user.id, user.email);
    
    // Debug: Check user's practice relationship
    const { data: userInfo, error: userInfoError } = await supabase
      .from('users')
      .select('id, email, practice_id, role')
      .eq('id', user.id)
      .single();
    
    console.log('🏥 User practice info:', userInfo);
    if (userInfoError) console.error('❌ User info error:', userInfoError);
    
    // Debug: Check patient accessibility
    const { data: patientCheck, error: patientError } = await supabase
      .from('patients')
      .select('id, first_name, last_name')
      .eq('id', patientId)
      .single();
    
    console.log('🎯 Target patient:', patientCheck);
    if (patientError) console.error('❌ Patient check error:', patientError);
    
    const metadata = {
      patient_id: patientId,
      visit_id: visitId,
      file_name: storagePath.split('/').pop(),
      original_name: file.name,
      file_type: file.type.split('/')[1],
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      description: description.trim() || null,
      category: selectedCategory,
      tags: tags.length > 0 ? tags : null,
      uploaded_by: user.id
    };
    
    console.log('📝 Metadata to save:', metadata);
    
    const { data, error } = await supabase
      .from('patient_documents')
      .insert([metadata])
      .select()
      .single();

    if (error) {
      console.error('❌ Database save failed:', error);
      console.error('❌ Error details:', {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint
      });
      
      if (error.message.includes('row-level security policy')) {
        console.error('🚨 RLS POLICY VIOLATION - Run FIX_DOCUMENTS_RLS_POLICY.sql to fix this');
        throw new Error('Permission denied. Please contact administrator to fix database permissions.');
      }
      
      throw new Error(error.message);
    }

    console.log('✅ Metadata saved successfully:', data);
    return data;
  };

  const handleFileSelect = useCallback((files: FileList) => {
    console.log('📂 Files selected:', files.length);
    
    const newFiles: UploadedFile[] = [];

    Array.from(files).forEach((file, index) => {
      console.log(`🔍 Processing file ${index + 1}:`, file.name);
      
      const validation = validateFile(file);
      if (validation) {
        console.error('❌ Validation failed for:', file.name, validation);
        toast.error(`${file.name}: ${validation}`);
        return;
      }

      const uploadFile: UploadedFile = {
        file,
        id: Math.random().toString(36).substring(2),
        progress: 0,
        status: 'pending'
      };

      console.log('✅ File added to upload queue:', file.name);
      newFiles.push(uploadFile);
    });

    if (newFiles.length > 0) {
      console.log('📋 Adding', newFiles.length, 'files to upload list');
      setUploadedFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    console.log('🎯 Files dropped');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const processUploads = async () => {
    const filesToUpload = uploadedFiles.filter(f => f.status === 'pending');
    
    if (filesToUpload.length === 0) {
      console.log('⚠️ No files to upload');
      return;
    }
    
    console.log('🚀 Starting upload process for', filesToUpload.length, 'files');
    setIsUploading(true);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const uploadFile of filesToUpload) {
      console.log('📤 Processing upload for:', uploadFile.file.name);
      
      // Update status to uploading
      setUploadedFiles(prev => prev.map(f => 
        f.id === uploadFile.id 
          ? { ...f, status: 'uploading', progress: 0 }
          : f
      ));
      
      try {
        // Upload to storage
        console.log('1️⃣ Uploading to storage...');
        const storagePath = await uploadFileToStorage(uploadFile.file, uploadFile);
        
        // Update progress to 90%
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, progress: 90 }
            : f
        ));
        
        // Save metadata
        console.log('2️⃣ Saving metadata...');
        await saveFileMetadata(uploadFile.file, storagePath);
        
        // Update file status to success
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'success', progress: 100 }
            : f
        ));
        
        successCount++;
        console.log('✅ Upload completed for:', uploadFile.file.name);
        toast.success(`${uploadFile.file.name} uploaded successfully`);
        
      } catch (error) {
        console.error('❌ Upload failed for:', uploadFile.file.name, error);
        
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ));
        
        errorCount++;
        toast.error(`Failed to upload ${uploadFile.file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    setIsUploading(false);
    
    console.log('📊 Upload summary - Success:', successCount, 'Errors:', errorCount);
    
    if (successCount > 0) {
      console.log('🎉 Calling success callback');
      if (onUploadSuccess) {
        onUploadSuccess();
      }
      
      // Auto-close modal if all uploads succeeded
      if (errorCount === 0) {
        setTimeout(() => {
          handleClose();
        }, 1000);
      }
    }
  };

  const removeFile = (fileId: string) => {
    console.log('🗑️ Removing file from upload list:', fileId);
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      console.log('🏷️ Adding tag:', currentTag.trim());
      setTags(prev => [...prev, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    console.log('🗑️ Removing tag:', tagToRemove);
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleClose = () => {
    console.log('🚪 Closing modal and resetting state');
    setUploadedFiles([]);
    setSelectedCategory('general');
    setDescription('');
    setTags([]);
    setCurrentTag('');
    setIsUploading(false);
    setAuthChecked(false);
    setIsAuthenticated(false);
    setCurrentUser(null);
    onClose();
  };

  const canUpload = uploadedFiles.length > 0 && uploadedFiles.some(f => f.status === 'pending') && !isUploading;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Documents"
    >
      <div className="space-y-6">
        {/* Authentication Check */}
        {authChecked && !isAuthenticated && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              <div>
                <h3 className="font-medium text-red-800">Authentication Required</h3>
                <p className="text-sm text-red-600 mt-1">
                  You must be logged in to upload documents. Please log in and try again.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Loading Authentication */}
        {!authChecked && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#01b9d4]" />
            <span className="ml-2 text-gray-600">Checking authentication...</span>
          </div>
        )}

        {/* Upload Drop Zone - Only show if authenticated */}
        {authChecked && isAuthenticated && (
          <motion.div
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
            isDragging 
              ? 'border-[#01b9d4] bg-cyan-50/50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
        >
          <input
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt,.xls,.xlsx"
            onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isUploading}
          />
          
          <div className="space-y-4">
            <div className="flex justify-center">
              <div className={`p-4 rounded-full ${isDragging ? 'bg-cyan-100' : 'bg-gray-100'}`}>
                <Upload className={`w-8 h-8 ${isDragging ? 'text-[#01b9d4]' : 'text-gray-400'}`} />
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">
                {isDragging ? 'Drop files here' : 'Upload Documents'}
              </h3>
              <p className="text-gray-600 text-sm">
                Drag and drop files here, or click to browse
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Supports: PDF, Images (JPG, PNG, GIF, WebP), Word docs, Excel, Text files
              </p>
              <p className="text-xs text-gray-500">
                Maximum file size: 50MB
              </p>
            </div>
          </div>
          </motion.div>
        )}

        {/* Document Details - Only show if authenticated and files uploaded */}
        {authChecked && isAuthenticated && uploadedFiles.length > 0 && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={isUploading}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4] disabled:opacity-50"
              >
                {CATEGORIES.map(category => (
                  <option key={category.value} value={category.value}>
                    {category.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Add a description for these documents..."
                rows={3}
                disabled={isUploading}
                className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4] resize-none disabled:opacity-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (Optional)
              </label>
              <div className="flex items-center gap-2 mb-2">
                <input
                  type="text"
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                  placeholder="Add a tag and press Enter"
                  disabled={isUploading}
                  className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4] disabled:opacity-50"
                />
                <button
                  onClick={addTag}
                  disabled={isUploading}
                  className="px-3 py-2 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {tags.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-cyan-100 text-cyan-800 rounded-full text-sm"
                    >
                      {tag}
                      {!isUploading && (
                        <button
                          onClick={() => removeTag(tag)}
                          className="hover:text-cyan-600"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* File List - Only show if authenticated and files uploaded */}
        {authChecked && isAuthenticated && uploadedFiles.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-gray-700">Files to Upload</h3>
            <div className="max-h-60 overflow-y-auto space-y-2">
              {uploadedFiles.map((uploadFile) => {
                const Icon = getFileIcon(uploadFile.file.type);
                return (
                  <div
                    key={uploadFile.id}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                  >
                    <div className={`p-2 rounded-lg ${getFileBg(uploadFile.file.type)}`}>
                      <Icon className={`w-5 h-5 ${getFileColor(uploadFile.file.type)}`} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {uploadFile.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatFileSize(uploadFile.file.size)}
                      </p>
                      
                      {/* Progress Bar */}
                      {uploadFile.status === 'uploading' && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>Uploading...</span>
                            <span>{uploadFile.progress}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-1.5">
                            <div 
                              className="bg-[#01b9d4] h-1.5 rounded-full transition-all duration-300"
                              style={{ width: `${uploadFile.progress}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      
                      {uploadFile.status === 'error' && uploadFile.error && (
                        <p className="text-xs text-red-600 mt-1">{uploadFile.error}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {uploadFile.status === 'uploading' && (
                        <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                      )}
                      {uploadFile.status === 'success' && (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      )}
                      {uploadFile.status === 'error' && (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                      
                      {uploadFile.status === 'pending' && !isUploading && (
                        <button
                          onClick={() => removeFile(uploadFile.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 pt-4 border-t border-gray-200">
          <button
            onClick={handleClose}
            disabled={isUploading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {isUploading ? 'Uploading...' : 'Cancel'}
          </button>
          
          {authChecked && isAuthenticated && (
            <button
              onClick={processUploads}
              disabled={!canUpload}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${uploadedFiles.filter(f => f.status === 'pending').length} File${uploadedFiles.filter(f => f.status === 'pending').length !== 1 ? 's' : ''}`
              )}
            </button>
          )}
          
          {authChecked && !isAuthenticated && (
            <button
              disabled
              className="flex-1 px-4 py-2 bg-gray-300 text-gray-500 rounded-lg cursor-not-allowed"
            >
              Login Required
            </button>
          )}
        </div>
      </div>
    </FormModal>
  );
};

export default DocumentUploadModal;