import React, { useState, useCallback, useRef } from 'react';
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
  Plus,
  Camera,
  Crop,
  Save,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import FormModal from './FormModal';

interface EnhancedDocumentUploadModalProps {
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
  title?: string;
  thumbnail?: string;
}

interface CapturedImage {
  id: string;
  dataUrl: string;
  blob: Blob;
  title: string;
  processed: boolean;
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
  { value: 'identification', label: 'ID Documents', icon: FileText },
  { value: 'licenses', label: 'Licenses', icon: FileText },
  { value: 'discharge_summaries', label: 'Discharge Summaries', icon: FileText }
];

const DOCUMENT_TYPES = [
  { value: 'id_document', label: 'ID Document', icon: FileText, optimize: true },
  { value: 'drivers_license', label: 'Driver\'s License', icon: FileText, optimize: true },
  { value: 'passport', label: 'Passport', icon: FileText, optimize: true },
  { value: 'medical_card', label: 'Medical Aid Card', icon: FileText, optimize: true },
  { value: 'general_photo', label: 'General Photo', icon: Camera, optimize: false }
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const EnhancedDocumentUploadModal: React.FC<EnhancedDocumentUploadModalProps> = ({ 
  isOpen, 
  onClose, 
  patientId, 
  visitId, 
  onUploadSuccess 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [capturedImages, setCapturedImages] = useState<CapturedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('general');
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [currentTag, setCurrentTag] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'upload' | 'camera'>('upload');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [selectedDocumentType, setSelectedDocumentType] = useState('general_photo');
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Check authentication when modal opens
  React.useEffect(() => {
    if (isOpen && !authChecked) {
      checkAuthentication();
    }
  }, [isOpen]);

  // Cleanup camera when modal closes
  React.useEffect(() => {
    if (!isOpen && streamRef.current) {
      stopCamera();
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

  const startCamera = async () => {
    setIsCameraLoading(true);
    try {
      console.log('📷 Starting camera...');
      
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not supported in this browser');
      }
      
      // Try with back camera first, fallback to any camera
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'environment' // Prefer back camera for document scanning
          } 
        });
      } catch (backCameraError) {
        console.log('⚠️ Back camera not available, trying any camera...');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 }
          } 
        });
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          console.log('✅ Camera stream loaded');
          setIsCameraActive(true);
          setIsCameraLoading(false);
        };
        
        // Play the video
        await videoRef.current.play();
        console.log('✅ Camera started successfully');
      }
    } catch (error) {
      setIsCameraLoading(false);
      console.error('❌ Camera access failed:', error);
      
      let errorMessage = 'Camera access failed. ';
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Please allow camera permissions in your browser.';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No camera found on this device.';
        } else if (error.name === 'NotSupportedError') {
          errorMessage += 'Camera is not supported in this browser.';
        } else {
          errorMessage += error.message;
        }
      }
      
      toast.error(errorMessage);
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
    console.log('🔌 Camera stopped');
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (!context) return;

    // Set canvas size to video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob((blob) => {
      if (!blob) return;

      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      const capturedImage: CapturedImage = {
        id: Math.random().toString(36).substring(2),
        dataUrl,
        blob,
        title: `${DOCUMENT_TYPES.find(t => t.value === selectedDocumentType)?.label || 'Photo'} - ${new Date().toLocaleString()}`,
        processed: false
      };

      setCapturedImages(prev => [...prev, capturedImage]);
      toast.success('Photo captured successfully!');
      console.log('📸 Photo captured:', capturedImage.title);
    }, 'image/jpeg', 0.9);
  };

  const generateThumbnail = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      if (!file.type.startsWith('image/')) {
        // For non-images, return a default thumbnail or file type icon
        resolve('');
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = document.createElement('img'); // Fix: Use document.createElement instead of new Image()

      img.onload = () => {
        // Set thumbnail size
        const maxSize = 150;
        let { width, height } = img;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        canvas.width = width;
        canvas.height = height;
        
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.7));
        } else {
          resolve('');
        }
        
        // Clean up object URL
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        console.error('Failed to load image for thumbnail generation');
        URL.revokeObjectURL(img.src);
        resolve('');
      };

      img.src = URL.createObjectURL(file);
    });
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

  const saveFileMetadata = async (file: File, storagePath: string, title?: string, thumbnailUrl?: string) => {
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
    
    const metadata = {
      patient_id: patientId,
      visit_id: visitId,
      file_name: storagePath.split('/').pop(),
      original_name: file.name,
      title: title || file.name, // Use custom title or fallback to filename
      file_type: file.type.split('/')[1],
      file_size: file.size,
      mime_type: file.type,
      storage_path: storagePath,
      thumbnail_url: thumbnailUrl,
      description: description.trim() || null,
      category: selectedCategory,
      tags: tags.length > 0 ? tags : null,
      uploaded_by: user.id,
      is_processed: !!thumbnailUrl // Mark as processed if we have a thumbnail
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

  const handleFileSelect = useCallback(async (files: FileList) => {
    console.log('📂 Files selected:', files.length);
    
    const newFiles: UploadedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      console.log(`🔍 Processing file ${i + 1}:`, file.name);
      
      const validation = validateFile(file);
      if (validation) {
        console.error('❌ Validation failed for:', file.name, validation);
        toast.error(`${file.name}: ${validation}`);
        continue;
      }

      // Generate thumbnail for images
      const thumbnail = await generateThumbnail(file);

      const uploadFile: UploadedFile = {
        file,
        id: Math.random().toString(36).substring(2),
        progress: 0,
        status: 'pending',
        thumbnail
      };

      console.log('✅ File added to upload queue:', file.name);
      newFiles.push(uploadFile);
    }

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
    const imagesToUpload = capturedImages;
    
    if (filesToUpload.length === 0 && imagesToUpload.length === 0) {
      console.log('⚠️ No files to upload');
      return;
    }
    
    console.log('🚀 Starting upload process for', filesToUpload.length, 'files and', imagesToUpload.length, 'captured images');
    setIsUploading(true);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Process regular file uploads
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
        await saveFileMetadata(uploadFile.file, storagePath, uploadFile.title, uploadFile.thumbnail);
        
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

    // Process captured images
    for (const capturedImage of imagesToUpload) {
      try {
        console.log('📸 Processing captured image:', capturedImage.title);
        
        // Create file from blob
        const file = new File([capturedImage.blob], `${capturedImage.title}.jpg`, { type: 'image/jpeg' });
        
        // Upload to storage
        const storagePath = await uploadFileToStorage(file, { id: capturedImage.id } as UploadedFile);
        
        // Save metadata
        await saveFileMetadata(file, storagePath, capturedImage.title, capturedImage.dataUrl);
        
        successCount++;
        toast.success(`${capturedImage.title} uploaded successfully`);
        
      } catch (error) {
        errorCount++;
        toast.error(`Failed to upload ${capturedImage.title}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  const removeCapturedImage = (imageId: string) => {
    console.log('🗑️ Removing captured image:', imageId);
    setCapturedImages(prev => prev.filter(img => img.id !== imageId));
  };

  const updateFileTitle = (fileId: string, title: string) => {
    setUploadedFiles(prev => prev.map(f => 
      f.id === fileId ? { ...f, title } : f
    ));
  };

  const updateImageTitle = (imageId: string, title: string) => {
    setCapturedImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, title } : img
    ));
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
    stopCamera();
    setUploadedFiles([]);
    setCapturedImages([]);
    setSelectedCategory('general');
    setDescription('');
    setTags([]);
    setCurrentTag('');
    setIsUploading(false);
    setAuthChecked(false);
    setIsAuthenticated(false);
    setCurrentUser(null);
    setActiveTab('upload');
    setIsCameraLoading(false);
    onClose();
  };

  const canUpload = (uploadedFiles.length > 0 && uploadedFiles.some(f => f.status === 'pending')) || 
                    capturedImages.length > 0;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={handleClose}
      title="Upload Documents"
      size="xl"
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

        {/* Main Content - Only show if authenticated */}
        {authChecked && isAuthenticated && (
          <>
            {/* Tab Navigation */}
            <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('upload')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'upload'
                    ? 'bg-white text-[#01b9d4] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Upload className="w-4 h-4 inline mr-2" />
                Upload Files
              </button>
              <button
                onClick={() => setActiveTab('camera')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'camera'
                    ? 'bg-white text-[#01b9d4] shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <Camera className="w-4 h-4 inline mr-2" />
                Take Photo
              </button>
            </div>

            {/* Upload Tab */}
            {activeTab === 'upload' && (
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

            {/* Camera Tab */}
            {activeTab === 'camera' && (
              <div className="space-y-4">
                {/* Document Type Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Document Type
                  </label>
                  <select
                    value={selectedDocumentType}
                    onChange={(e) => setSelectedDocumentType(e.target.value)}
                    className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d4]/30 focus:border-[#01b9d4]"
                  >
                    {DOCUMENT_TYPES.map(type => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Camera Interface */}
                <div className="bg-black rounded-lg overflow-hidden relative">
                  {!isCameraActive && !isCameraLoading ? (
                    <div className="aspect-video flex items-center justify-center">
                      <button
                        onClick={startCamera}
                        disabled={isCameraLoading}
                        className="px-6 py-3 bg-[#01b9d4] text-white rounded-lg hover:bg-[#01a5c4] transition-colors flex items-center gap-2 disabled:opacity-50"
                      >
                        <Camera className="w-5 h-5" />
                        Start Camera
                      </button>
                    </div>
                  ) : isCameraLoading ? (
                    <div className="aspect-video flex items-center justify-center">
                      <div className="text-white text-center">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                        <p>Starting camera...</p>
                        <p className="text-sm text-gray-300 mt-1">Please allow camera permissions</p>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <video
                        ref={videoRef}
                        autoPlay
                        playsInline
                        className="w-full aspect-video"
                      />
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-3">
                        <button
                          onClick={capturePhoto}
                          className="w-16 h-16 bg-white rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shadow-lg"
                        >
                          <div className="w-12 h-12 bg-[#01b9d4] rounded-full" />
                        </button>
                        <button
                          onClick={stopCamera}
                          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          Stop
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />
              </div>
            )}

            {/* Document Details */}
            {(uploadedFiles.length > 0 || capturedImages.length > 0) && (
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

            {/* File List */}
            {uploadedFiles.length > 0 && (
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
                        {/* Thumbnail or Icon */}
                        <div className={`p-2 rounded-lg ${getFileBg(uploadFile.file.type)} flex-shrink-0`}>
                          {uploadFile.thumbnail ? (
                            <img 
                              src={uploadFile.thumbnail} 
                              alt="Thumbnail" 
                              className="w-8 h-8 object-cover rounded"
                            />
                          ) : (
                            <Icon className={`w-5 h-5 ${getFileColor(uploadFile.file.type)}`} />
                          )}
                        </div>
                        
                        <div className="flex-1 min-w-0 space-y-2">
                          {/* Title Input */}
                          <input
                            type="text"
                            value={uploadFile.title || uploadFile.file.name}
                            onChange={(e) => updateFileTitle(uploadFile.id, e.target.value)}
                            placeholder="Enter document title..."
                            disabled={isUploading}
                            className="w-full text-sm font-medium text-gray-800 bg-transparent border-0 border-b border-gray-200 focus:border-[#01b9d4] focus:ring-0 disabled:opacity-50"
                          />
                          
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

            {/* Captured Images List */}
            {capturedImages.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium text-gray-700">Captured Photos</h3>
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {capturedImages.map((image) => (
                    <div
                      key={image.id}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      {/* Thumbnail */}
                      <div className="flex-shrink-0">
                        <img 
                          src={image.dataUrl} 
                          alt="Captured" 
                          className="w-16 h-12 object-cover rounded"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0 space-y-2">
                        {/* Title Input */}
                        <input
                          type="text"
                          value={image.title}
                          onChange={(e) => updateImageTitle(image.id, e.target.value)}
                          placeholder="Enter document title..."
                          disabled={isUploading}
                          className="w-full text-sm font-medium text-gray-800 bg-transparent border-0 border-b border-gray-200 focus:border-[#01b9d4] focus:ring-0 disabled:opacity-50"
                        />
                        
                        <p className="text-xs text-gray-500">
                          Captured Photo • {(image.blob.size / 1024).toFixed(1)} KB
                        </p>
                      </div>

                      {!isUploading && (
                        <button
                          onClick={() => removeCapturedImage(image.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <X className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
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
          
          {authChecked && isAuthenticated && canUpload && (
            <button
              onClick={processUploads}
              disabled={isUploading}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                `Upload ${uploadedFiles.filter(f => f.status === 'pending').length + capturedImages.length} Item${uploadedFiles.filter(f => f.status === 'pending').length + capturedImages.length !== 1 ? 's' : ''}`
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

export default EnhancedDocumentUploadModal;