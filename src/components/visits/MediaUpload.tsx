import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, Camera, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';

interface MediaUploadProps {
  type?: string;
  onUpload: (url: string) => void;
}

const MediaUpload: React.FC<MediaUploadProps> = ({ type = 'photo', onUpload }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
      }
      setShowCamera(true);
    } catch (err) {
      setError('Failed to access camera. Please check permissions.');
      console.error('Camera access error:', err);
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
    handleUpload([new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' })]);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    handleUpload(acceptedFiles);
  }, []);

  const handleUpload = async (files: File[]) => {
    if (files.length === 0) return;

    const file = files[0];
    setIsUploading(true);
    setError(null);

    try {
      // Show preview
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);

      // Upload to Supabase Storage
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1,
    disabled: isUploading || showCamera
  });

  return (
    <div className="space-y-4">
      {!showCamera ? (
        <>
          <div className="flex justify-between items-center mb-4">
            <div className="space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={startCamera}
                disabled={isUploading}
              >
                <Camera size={16} className="mr-2" />
                Take Photo
              </Button>
            </div>
          </div>

          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-[#01b9d4] bg-[#01b9d4]/5' : 'border-gray-300 hover:border-[#01b9d4]'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            {isUploading ? (
              <div className="text-center">
                <Loader2 size={24} className="mx-auto mb-4 animate-spin text-[#01b9d4]" />
                <p className="text-sm text-gray-600">Uploading...</p>
              </div>
            ) : (
              <>
                <Upload
                  size={24}
                  className={`mx-auto mb-4 ${isDragActive ? 'text-[#01b9d4]' : 'text-gray-400'}`}
                />
                <p className="text-sm text-gray-600">
                  {isDragActive
                    ? 'Drop the file here'
                    : 'Drag and drop an image, or click to select'
                }
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: PNG, JPG, JPEG, GIF
                </p>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            className="w-full rounded-lg"
          />
          <div className="absolute bottom-4 left-0 right-0 flex justify-center space-x-2">
            <Button onClick={capturePhoto}>
              <Camera size={16} className="mr-2" />
              Capture
            </Button>
            <Button variant="outline" onClick={stopCamera}>
              <X size={16} className="mr-2" />
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}

      {preview && !isUploading && (
        <div className="relative mt-4">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-48 object-cover rounded-lg"
          />
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 bg-white/80"
            onClick={() => setPreview(null)}
          >
            <X size={14} />
          </Button>
        </div>
      )}
    </div>
  );
};

export default MediaUpload;