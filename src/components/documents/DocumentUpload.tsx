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
  Eye,
  Download,
  Trash2,
  Tag,
  Calendar
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { format } from 'date-fns';

interface DocumentUploadProps {
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

const DocumentUpload: React.FC<DocumentUploadProps> = ({ 
  patientId, 
  visitId, 
  onUploadSuccess 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');

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

  const uploadFile = async (file: File): Promise<string> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`;
    
    const { data, error } = await supabase.storage
      .from('documents')
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      throw new Error(error.message);
    }

    return data.path;
  };

  const saveFileMetadata = async (file: File, storagePath: string) => {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('patient_documents')
      .insert([{
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
        uploaded_by: user.user?.id
      }])
      .select()
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return data;
  };

  const handleFileSelect = useCallback((files: FileList) => {
    const newFiles: UploadedFile[] = [];

    Array.from(files).forEach((file) => {
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
    const filesToUpload = uploadedFiles.filter(f => f.status === 'uploading');
    
    for (const uploadFile of filesToUpload) {
      try {
        // Upload to storage
        const storagePath = await uploadFile(uploadFile.file);
        
        // Save metadata
        await saveFileMetadata(uploadFile.file, storagePath);
        
        // Update file status
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'success', progress: 100 }
            : f
        ));
        
        toast.success(`${uploadFile.file.name} uploaded successfully`);
        
      } catch (error) {
        console.error('Upload error:', error);
        setUploadedFiles(prev => prev.map(f => 
          f.id === uploadFile.id 
            ? { ...f, status: 'error', error: error instanceof Error ? error.message : 'Upload failed' }
            : f
        ));
        toast.error(`Failed to upload ${uploadFile.file.name}`);
      }
    }
    
    // Call success callback if all uploads completed
    const allCompleted = uploadedFiles.every(f => f.status !== 'uploading');
    if (allCompleted && onUploadSuccess) {
      onUploadSuccess();
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
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx,.txt,.xls,.xlsx"
          onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
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

      {/* Upload Modal */}
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
                    <h2 className="text-xl font-bold text-gray-800">Upload Documents</h2>
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
                {/* Document Details */}
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                      className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4]"
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
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
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

export default DocumentUpload;