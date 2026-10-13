import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Camera, 
  Upload, 
  X, 
  FileText, 
  Image, 
  CreditCard,
  User,
  Shield,
  File,
  Loader2,
  AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { RECORDS_BUCKET, currentPracticeId, recordPath } from '../../services/recordFiles';

interface MediaUploadWrapperProps {
  patientId: string;
  visitId?: string;
  onUploadSuccess: (file: any) => void;
  onUploadError: (error: string) => void;
}

const MEDIA_CATEGORIES = [
  { value: 'drivers_license', label: 'Driver\'s License', icon: CreditCard, dbCategory: 'document' },
  { value: 'id_document', label: 'ID Document', icon: User, dbCategory: 'document' },
  { value: 'passport', label: 'Passport', icon: FileText, dbCategory: 'document' },
  { value: 'birth_certificate', label: 'Birth Certificate', icon: FileText, dbCategory: 'document' },
  { value: 'medical_aid_card', label: 'Medical Aid Card', icon: Shield, dbCategory: 'document' },
  { value: 'insurance_card', label: 'Insurance Card', icon: Shield, dbCategory: 'document' },
  { value: 'referral_letter', label: 'Referral Letter', icon: FileText, dbCategory: 'document' },
  { value: 'prescription', label: 'Prescription', icon: FileText, dbCategory: 'document' },
  { value: 'medical_certificate', label: 'Medical Certificate', icon: FileText, dbCategory: 'document' },
  { value: 'consent_form', label: 'Consent Form', icon: FileText, dbCategory: 'document' },
  { value: 'clinical_photo', label: 'Clinical Photo', icon: Image, dbCategory: 'photo' },
  { value: 'before_after', label: 'Before/After Photo', icon: Image, dbCategory: 'photo' },
  { value: 'wound_care', label: 'Wound Care Photo', icon: Image, dbCategory: 'photo' },
  { value: 'xray_film', label: 'X-Ray Film', icon: Image, dbCategory: 'photo' },
  { value: 'scan_copy', label: 'Scan Copy', icon: Image, dbCategory: 'photo' },
  { value: 'other', label: 'Other', icon: File, dbCategory: 'other' }
];

const MediaUploadWrapper: React.FC<MediaUploadWrapperProps> = ({
  patientId,
  visitId,
  onUploadSuccess,
  onUploadError
}) => {
  const [showUploadOptions, setShowUploadOptions] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pendingStreamRef = useRef<MediaStream | null>(null);
  
  // Debug camera state changes
  React.useEffect(() => {
    console.log('📸 Camera state:', { isCameraActive, isCameraLoading });
  }, [isCameraActive, isCameraLoading]);
  
  // Handle stream setup when video element is ready
  React.useEffect(() => {
    if (isCameraActive && videoRef.current && pendingStreamRef.current) {
      console.log('📸 Video element ready, setting stream');
      videoRef.current.srcObject = pendingStreamRef.current;
      streamRef.current = pendingStreamRef.current;
      pendingStreamRef.current = null;
      
      videoRef.current.play().then(() => {
        console.log('✅ Video playing');
      }).catch(err => {
        console.error('❌ Error playing video:', err);
      });
    }
  }, [isCameraActive]);
  
  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (pendingStreamRef.current) {
        pendingStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  const { user } = useAuthStore();

  // Handle dropzone click
  const handleDropzoneClick = () => {
    console.log('📱 Dropzone clicked - showing upload options');
    setShowUploadOptions(true);
  };

  // Handle file selection from device
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    console.log('📁 Files selected:', files.length);
    setPendingFiles(Array.from(files));
    setShowUploadOptions(false);
    setShowCategoryModal(true);
  };

  // Start camera
  const startCamera = async () => {
    console.log('📸 startCamera called');
    setShowUploadOptions(false);
    setIsCameraLoading(true);
    
    try {
      console.log('📸 Starting camera...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API not available in this browser');
      }
      
      // Check if we're on HTTPS or localhost (required for camera)
      const isSecureContext = window.isSecureContext;
      if (!isSecureContext) {
        throw new Error('Camera requires HTTPS or localhost. Current protocol: ' + window.location.protocol);
      }
      
      let stream;
      
      // Try back camera first (mobile), then any camera (laptop)
      try {
        console.log('📸 Requesting environment camera');
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        console.log('📸 Got environment camera stream');
      } catch (err) {
        console.log('📸 Back camera not available, trying default camera', err);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true 
        });
        console.log('📸 Got default camera stream');
      }
      
      if (stream) {
        console.log('📸 Got stream, storing it');
        pendingStreamRef.current = stream;
        
        console.log('📸 Setting camera active state to true');
        setIsCameraActive(true);
        setIsCameraLoading(false);
        console.log('✅ Camera initialization complete');
      } else {
        throw new Error('Failed to get camera stream');
      }
    } catch (error) {
      console.error('❌ Camera error:', error);
      let errorMessage = 'Failed to access camera. ';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage += 'Please allow camera permissions.';
        } else if (error.name === 'NotFoundError') {
          errorMessage += 'No camera found.';
        } else {
          errorMessage += error.message;
        }
      }
      
      toast.error(errorMessage);
      setShowUploadOptions(true);
    } finally {
      setIsCameraLoading(false);
    }
  };

  // Stop camera
  const stopCamera = () => {
    console.log('📸 Stopping camera');
    
    // Stop any active stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log('📸 Stopped track:', track.kind);
      });
      streamRef.current = null;
    }
    
    // Also stop pending stream if any
    if (pendingStreamRef.current) {
      pendingStreamRef.current.getTracks().forEach(track => track.stop());
      pendingStreamRef.current = null;
    }
    
    // Clear video element
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    
    setIsCameraActive(false);
    console.log('📸 Camera stopped');
  };

  // Capture photo
  const capturePhoto = () => {
    if (!videoRef.current) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(videoRef.current, 0, 0);
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const file = new window.File(
        [blob], 
        `photo-${Date.now()}.jpg`, 
        { type: 'image/jpeg' }
      );
      
      console.log('📸 Photo captured:', file.name);
      setPendingFiles([file]);
      stopCamera();
      setShowCategoryModal(true);
    }, 'image/jpeg', 0.9);
  };

  // Upload files to storage
  // The category is passed in rather than read from state: state set in the same click
  // isn't visible yet, which saved every upload as "other"
  const uploadFilesToStorage = async (category: string) => {
    setIsUploading(true);
    
    try {
      // Check authentication
      const { data: { session }, error: authError } = await supabase.auth.getSession();
      if (authError || !session?.user) {
        throw new Error('Authentication required for uploads');
      }

      for (const file of pendingFiles) {
        console.log('📤 Uploading file:', file.name);
        
        // Generate unique file name
        const fileExt = file.name.split('.').pop();
        // A patient record: the private bucket, in the practice's folder (no public link)
        const fileName = recordPath(currentPracticeId(), 'patient-media', patientId, `${Date.now()}_${Math.random().toString(36).substring(2)}.${fileExt}`);

        // Upload to storage
        const { data: storageData, error: storageError } = await supabase.storage
          .from(RECORDS_BUCKET)
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
          });

        if (storageError) {
          console.error('❌ Storage upload error:', storageError);
          throw new Error(`Storage upload failed: ${storageError.message}`);
        }

        console.log('✅ File uploaded to storage:', storageData);

        // Find the selected category to get the database category
        const categoryInfo = MEDIA_CATEGORIES.find(cat => cat.value === category);
        const dbCategory = categoryInfo?.dbCategory || 'other';
        
        // Save to database
        const dbRecord = {
          patient_id: patientId,
          visit_id: visitId,
          file_name: fileName.split('/').pop(),
          original_name: file.name,
          file_size: file.size,
          file_type: fileExt,
          mime_type: file.type,
          storage_path: fileName,
          storage_bucket: RECORDS_BUCKET,
          title: file.name,
          category: dbCategory, // Use the mapped database category
          subcategory: category, // Store the specific type as subcategory
          description: null,
          tags: null,
          metadata: {
            originalName: file.name,
            uploadedAt: new Date().toISOString(),
            specificType: category // Also store in metadata for reference
          },
          is_sensitive: false,
          uploaded_by: session.user.id
        };

        console.log('💾 Saving to patient_media table:', dbRecord);
        
        const { data: dbData, error: dbError } = await supabase
          .from('patient_media')
          .insert([dbRecord])
          .select()
          .single();

        if (dbError) {
          console.error('❌ Database insert error:', dbError);
          // Try to cleanup uploaded file
          await supabase.storage.from(RECORDS_BUCKET).remove([fileName]);
          throw new Error(`Database insert failed: ${dbError.message}`);
        }

        console.log('✅ Database record created:', dbData);
        
        // Call success callback
        onUploadSuccess({
          id: dbData.id,
          fileName: dbData.file_name,
          originalName: dbData.original_name,
          fileSize: dbData.file_size,
          fileType: dbData.file_type,
          mimeType: dbData.mime_type,
          storagePath: dbData.storage_path,
          category: dbData.category,
          uploadedAt: dbData.created_at
        });
      }
      
      // Reset state
      setPendingFiles([]);
      setShowCategoryModal(false);
      
    } catch (error) {
      console.error('❌ Upload error:', error);
      onUploadError(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  // Process upload with category
  const handleCategorySelect = async (category: string) => {
    console.log('📂 Category selected:', category);
    setShowCategoryModal(false);

    // Start upload
    await uploadFilesToStorage(category);
  };

  // The Add Visit screen passes an empty visitId until the visit is saved; saving a file with
  // visit_id "" is rejected by the database, so say what to do instead of failing after the upload
  if (visitId === '') {
    return (
      <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center bg-gray-50">
        <Upload className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-600 font-medium">Save the visit first</p>
        <p className="text-sm text-gray-500 mt-1">Then open it again to add photos and documents.</p>
      </div>
    );
  }

  return (
    <>
      {/* Custom Dropzone */}
      {!isCameraActive && (
        <div
          onClick={handleDropzoneClick}
          className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#01b9d4] hover:bg-gray-50 transition-all cursor-pointer"
        >
          <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Click to upload or take a photo</p>
          <p className="text-sm text-gray-500 mt-1">
            Supports images, videos, PDFs up to 50MB
          </p>
        </div>
      )}

      {/* Hidden file input */}
      <input
        type="file"
        id="media-file-input"
        multiple
        accept="image/*,video/*,audio/*,application/pdf"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Upload Options Modal */}
      <AnimatePresence>
        {showUploadOptions && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-md w-full mx-4"
            >
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-800">Choose Upload Method</h2>
                  <button
                    type="button"
                    onClick={() => setShowUploadOptions(false)}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    aria-label="Close"
                    title="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <button
                  onClick={() => {
                    document.getElementById('media-file-input')?.click();
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
                  disabled={isCameraLoading}
                  className="w-full flex items-center gap-4 p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all group disabled:opacity-50"
                >
                  <div className="p-3 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg group-hover:scale-110 transition-transform">
                    {isCameraLoading ? (
                      <Loader2 className="w-6 h-6 text-white animate-spin" />
                    ) : (
                      <Camera className="w-6 h-6 text-white" />
                    )}
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
        {isCameraActive && (
          <div className="fixed inset-0 z-50 bg-black">
            {console.log('📸 Rendering camera view')}
            <div className="relative w-full h-full flex items-center justify-center">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                className="max-w-full max-h-full"
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

      {/* Category Selection Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-800">Select Document Category</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Please select the type of document you're uploading
                </p>
              </div>

              <div className="p-6 overflow-y-auto max-h-[60vh]">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {MEDIA_CATEGORIES.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.value}
                        onClick={() => handleCategorySelect(category.value)}
                        disabled={isUploading}
                        className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:border-[#01b9d4] hover:bg-[#01b9d4]/5 transition-all text-left disabled:opacity-50"
                      >
                        <div className="p-2 bg-gray-100 rounded-lg">
                          <Icon className="w-5 h-5 text-gray-600" />
                        </div>
                        <span className="font-medium text-gray-800">{category.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowCategoryModal(false);
                    setPendingFiles([]);
                  }}
                  disabled={isUploading}
                  className="w-full px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    'Cancel'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MediaUploadWrapper;