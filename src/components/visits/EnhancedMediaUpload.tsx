import React, { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  Camera,
  X,
  FileText,
  Image,
  Video,
  Music,
  File,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Eye,
  Download,
  Trash2,
  Tag,
  Calendar,
  Stethoscope,
  Heart,
  Activity,
  FileX,
  Microscope,
  Pill
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface EnhancedMediaUploadProps {
  patientId: string;
  visitId?: string;
  onUploadSuccess?: () => void;
}

interface UploadedFile {
  file: File;
  id: string;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
  url?: string;
}

const ALLOWED_TYPES = {
  'image/jpeg': { icon: Image, color: 'text-blue-600', bg: 'bg-blue-100' },
  'image/jpg': { icon: Image, color: 'text-blue-600', bg: 'bg-blue-100' },
  'image/png': { icon: Image, color: 'text-green-600', bg: 'bg-green-100' },
  'image/gif': { icon: Image, color: 'text-purple-600', bg: 'bg-purple-100' },
  'image/webp': { icon: Image, color: 'text-indigo-600', bg: 'bg-indigo-100' },
  'video/mp4': { icon: Video, color: 'text-red-600', bg: 'bg-red-100' },
  'video/quicktime': { icon: Video, color: 'text-red-600', bg: 'bg-red-100' },
  'video/avi': { icon: Video, color: 'text-red-600', bg: 'bg-red-100' },
  'audio/mpeg': { icon: Music, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  'audio/wav': { icon: Music, color: 'text-yellow-600', bg: 'bg-yellow-100' },
  'audio/mp3': { icon: Music, color: 'text-yellow-600', bg: 'bg-yellow-100' },
};

const CATEGORIES = [
  { value: 'procedure_photos', label: 'Procedure Photos', icon: Camera },
  { value: 'before_after', label: 'Before/After', icon: Image },
  { value: 'xray', label: 'X-Ray Images', icon: FileX },
  { value: 'scan', label: 'CT/MRI Scans', icon: Activity },
  { value: 'wound_care', label: 'Wound Care', icon: Heart },
  { value: 'surgery', label: 'Surgery Documentation', icon: Stethoscope },
  { value: 'lab_images', label: 'Lab Result Images', icon: Microscope },
  { value: 'prescription', label: 'Prescription Photos', icon: Pill },
  { value: 'other', label: 'Other Medical Media', icon: FileText }
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const EnhancedMediaUpload: React.FC<EnhancedMediaUploadProps> = ({ 
  patientId, 
  visitId, 
  onUploadSuccess 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [categoryError, setCategoryError] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size must be less than 50MB';
    }
    if (!ALLOWED_TYPES[file.type as keyof typeof ALLOWED_TYPES]) {
      return 'File type not supported';
    }
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

  const startCamera = async () => {
    try {
      // First try with environment camera (back camera on mobile)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: 'environment'
          } 
        });
      } catch (err) {
        // Fallback to any available camera (for laptops)
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true
        });
      }
      
      if (videoRef.current && stream) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setShowCamera(true);
      setShowUploadOptions(false);
    } catch (err) {
      toast.error('Failed to access camera. Please check permissions.');
      console.error('Camera access error:', err);
      setShowUploadOptions(false);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setShowCamera(false);
  };

  const capturePhoto = async () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    const blob = await new Promise<Blob>((resolve) => 
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8)
    );

    stopCamera();
    // Create file from blob
    const file = new window.File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
    handleFileSelect([file]);
  };

  const uploadFileToStorage = async (file: File): Promise<string> => {
    // Get session to ensure we're authenticated
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (sessionError || !session) {
      throw new Error('Authentication required for uploads');
    }
    
    const fileExt = file.name.split('.').pop();
    // Use similar path structure as documents for consistency
    const fileName = `${patientId}/media/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    console.log('Uploading to path:', fileName);
    console.log('File size:', file.size);
    console.log('File type:', file.type);
    
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Storage upload error:', error);
      throw new Error(error.message);
    }

    console.log('Upload successful, path:', data.path);
    return data.path;
  };

  const saveFileMetadata = async (file: File, storagePath: string) => {
    const { data: user } = await supabase.auth.getUser();
    
    const metadata = {
      patient_id: patientId,
      visit_id: visitId,
      file_name: storagePath.split('/').pop(),
      original_name: file.name,
      file_type: file.type.split('/')[1] || 'unknown',
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      description: description.trim() || null,
      category: selectedCategory,
      tags: tags.length > 0 ? tags : null,
      uploaded_by: user.user?.id
    };
    
    console.log('Saving file metadata:', metadata);
    
    const { data, error } = await supabase
      .from('patient_media')
      .insert([metadata])
      .select()
      .single();

    if (error) {
      console.error('Error saving metadata:', error);
      throw new Error(error.message);
    }

    console.log('Metadata saved successfully:', data);
    
    // Verify the data was actually saved
    const { data: verifyData, error: verifyError } = await supabase
      .from('patient_media')
      .select('*')
      .eq('id', data.id)
      .single();
      
    if (verifyError) {
      console.error('❌ Verification failed:', verifyError);
    } else {
      console.log('✅ Verified saved record:', verifyData);
    }
    
    return data;
  };

  const handleFileSelect = useCallback((files: File[]) => {
    const newFiles: UploadedFile[] = [];

    files.forEach((file) => {
      const validation = validateFile(file);
      if (validation) {
        toast.error(`${file.name}: ${validation}`);
        return;
      }

      const uploadFile: UploadedFile = {
        file,
        id: Math.random().toString(36).substring(2),
        progress: 0,
        status: 'uploading'
      };

      newFiles.push(uploadFile);
    });

    if (newFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...newFiles]);
      setIsModalOpen(true);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
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
    // Validate category selection
    if (!selectedCategory) {
      setCategoryError(true);
      toast.error('Please select a category before uploading');
      return;
    }
    
    setCategoryError(false);
    const filesToUpload = uploadedFiles.filter(f => f.status === 'uploading');
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const uploadFile of filesToUpload) {
      try {
        console.log(`Starting upload for ${uploadFile.file.name}`);
        
        // Upload to storage
        const storagePath = await uploadFileToStorage(uploadFile.file);
        console.log(`File uploaded to storage: ${storagePath}`);
        
        // Save metadata
        await saveFileMetadata(uploadFile.file, storagePath);
        
        // Update file status
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'success', progress: 100 }
            : f
        ));
        
        toast.success(`${uploadFile.file.name} uploaded successfully`);
        successCount++;
        
      } catch (error) {
        console.error('Upload error:', error);
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ));
        toast.error(`Failed to upload ${uploadFile.file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errorCount++;
      }
    }
    
    console.log(`📊 Upload summary: ${successCount} success, ${errorCount} errors, ${filesToUpload.length} total`);
    
    // Check if all files have been processed
    if (filesToUpload.length > 0) {
      console.log('✅ All files processed');
      
      if (errorCount === 0 && onUploadSuccess) {
        console.log('🎉 All uploads completed successfully, calling onUploadSuccess');
        onUploadSuccess();
        
        // Reset state after a short delay
        setTimeout(() => {
          setIsModalOpen(false);
          setUploadedFiles([]);
          setSelectedCategory('');
          setDescription('');
          setTags([]);
        }, 1500);
      } else if (errorCount > 0) {
        console.error(`❌ ${errorCount} uploads failed`);
      }
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      setTags(prev => [...prev, currentTag.trim()]);
      setCurrentTag('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(prev => prev.filter(tag => tag !== tagToRemove));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <>
      {/* Upload Drop Zone */}
      <motion.div
        className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          isDragging 
            ? 'border-[#01b9d4] bg-cyan-50/50' 
            : 'border-gray-300 hover:border-gray-400'
        }`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => setShowUploadOptions(true)}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          onChange={(e) => e.target.files && handleFileSelect(Array.from(e.target.files))}
          className="hidden"
        />
        
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className={`p-4 rounded-full ${isDragging ? 'bg-cyan-100' : 'bg-gray-100'}`}>
              <Upload className={`w-8 h-8 ${isDragging ? 'text-[#01b9d4]' : 'text-gray-400'}`} />
            </div>
          </div>
          
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">
              {isDragging ? 'Drop files here' : 'Upload Medical Media'}
            </h3>
            <p className="text-gray-600 text-sm">
              Click to upload or take a photo
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Supports: Images, Videos, Audio files
            </p>
            <p className="text-xs text-gray-500">
              Maximum file size: 50MB
            </p>
          </div>
        </div>
      </motion.div>

      {/* Upload Options Modal */}
      <AnimatePresence>
        {showUploadOptions && !showCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800">Choose Upload Method</h2>
                  <button
                    onClick={() => setShowUploadOptions(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <button
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowUploadOptions(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl hover:from-blue-100 hover:to-cyan-100 transition-all group"
                >
                  <div className="p-3 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Upload className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-800">Upload Files</h3>
                    <p className="text-sm text-gray-600">Choose from your device</p>
                  </div>
                </button>

                <button
                  onClick={startCamera}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all group"
                >
                  <div className="p-3 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg group-hover:scale-110 transition-transform">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <h3 className="font-semibold text-gray-800">Take Photo</h3>
                    <p className="text-sm text-gray-600">Use your camera</p>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Camera View */}
      <AnimatePresence>
        {showCamera && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">
            <div className="relative w-full h-full max-w-4xl max-h-[90vh]">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="w-full h-full object-contain"
              />
              <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
                <button
                  onClick={capturePhoto}
                  className="px-6 py-3 bg-white text-gray-800 rounded-full hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg"
                >
                  <Camera className="w-5 h-5" />
                  Capture
                </button>
                <button
                  onClick={stopCamera}
                  className="px-6 py-3 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors flex items-center gap-2 shadow-lg"
                >
                  <X className="w-5 h-5" />
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Modal with Category Selection */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Upload Medical Media</h2>
                    <p className="text-sm text-gray-600">
                      {uploadedFiles.length} file{uploadedFiles.length !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                  <button
                    onClick={() => setIsModalOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                {/* Category Selection - REQUIRED */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category <span className="text-red-500">*</span>
                    </label>
                    <div className={`p-4 rounded-lg border-2 ${categoryError ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}>
                      <select
                        value={selectedCategory}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setCategoryError(false);
                        }}
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4]"
                      >
                        <option value="">-- Select Category --</option>
                        {CATEGORIES.map(category => (
                          <option key={category.value} value={category.value}>
                            {category.label}
                          </option>
                        ))}
                      </select>
                      {categoryError && (
                        <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          Please select a category before uploading
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description (Optional)
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Add a description for these files..."
                      rows={3}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4] resize-none"
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
                        className="flex-1 p-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4]"
                      />
                      <button
                        type="button"
                        onClick={addTag}
                        className="px-3 py-2 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors"
                      >
                        <Tag className="w-4 h-4" />
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
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="hover:text-cyan-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* File List */}
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-700">Files to Upload</h3>
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
                          
                          <button
                            type="button"
                            onClick={() => removeFile(uploadFile.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={processUploads}
                    disabled={uploadedFiles.length === 0 || uploadedFiles.some(f => f.status === 'uploading')}
                    className="flex-1 px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Upload {uploadedFiles.length} File{uploadedFiles.length !== 1 ? 's' : ''}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default EnhancedMediaUpload;