import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Camera, Upload, X } from 'lucide-react';
import Button from '../ui/Button';
import Webcam from 'react-webcam';
import { supabase } from '../../lib/supabase';

interface MediaUploadProps {
  onUpload: (url: string) => void;
  type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
}

const MediaUpload: React.FC<MediaUploadProps> = ({ onUpload, type }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = React.useRef<Webcam>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setIsUploading(true);
      const file = acceptedFiles[0];
      
      // Create a unique file path
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (error) throw error;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setIsUploading(false);
    }
  }, [type, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1
  });

  const capturePhoto = React.useCallback(() => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        // Convert base64 to blob
        fetch(imageSrc)
          .then(res => res.blob())
          .then(blob => {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            onDrop([file]);
          });
      }
    }
  }, [onDrop]);

  if (showCamera) {
    return (
      <div className="relative">
        <Webcam
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          className="w-full rounded-lg"
        />
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 space-x-4">
          <Button onClick={capturePhoto}>
            <Camera size={16} className="mr-2" />
            Capture
          </Button>
          <Button variant="outline" onClick={() => setShowCamera(false)}>
            <X size={16} className="mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-300 hover:border-brand-primary'}
        `}
      >
        <input {...getInputProps()} />
        <Upload
          size={24}
          className={`mx-auto mb-4 ${isDragActive ? 'text-brand-primary' : 'text-gray-400'}`}
        />
        <p className="text-sm text-gray-600">
          {isDragActive
            ? 'Drop the file here'
            : 'Drag and drop a file here, or click to select a file'
        }
        </p>
      </div>

      {type === 'photo' && (
        <Button
          variant="outline"
          className="w-full"
          onClick={() => setShowCamera(true)}
        >
          <Camera size={16} className="mr-2" />
          Take Photo
        </Button>
      )}
    </div>
  );
};

export default MediaUpload;