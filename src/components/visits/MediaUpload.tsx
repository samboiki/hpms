import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Webcam from 'react-webcam';
import { Camera, Upload, X } from 'lucide-react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface MediaUploadProps {
  onUpload: (url: string) => void;
  type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
}

export const MediaUpload: React.FC<MediaUploadProps> = ({ onUpload, type }) => {
  const [showCamera, setShowCamera] = useState(false);
  const [uploading, setUploading] = useState(false);
  const webcamRef = React.useRef<Webcam>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    try {
      setUploading(true);
      const file = acceptedFiles[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
    } catch (error) {
      console.error('Error uploading file:', error);
    } finally {
      setUploading(false);
    }
  }, [type, onUpload]);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif']
    },
    maxFiles: 1
  });

  const captureImage = React.useCallback(async () => {
    if (!webcamRef.current) return;

    try {
      setUploading(true);
      const imageSrc = webcamRef.current.getScreenshot();
      if (!imageSrc) return;

      // Convert base64 to blob
      const res = await fetch(imageSrc);
      const blob = await res.blob();
      const file = new File([blob], 'capture.jpg', { type: 'image/jpeg' });

      const fileName = `${Math.random()}.jpg`;
      const filePath = `${type}/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
      setShowCamera(false);
    } catch (error) {
      console.error('Error capturing image:', error);
    } finally {
      setUploading(false);
    }
  }, [webcamRef, type, onUpload]);

  if (showCamera) {
    return (
      <div className="relative">
        <Webcam
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          className="w-full rounded-lg"
        />
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 space-x-4">
          <Button onClick={captureImage} disabled={uploading}>
            {uploading ? 'Capturing...' : 'Capture'}
          </Button>
          <Button variant="outline" onClick={() => setShowCamera(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div {...getRootProps()} className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer">
        <input {...getInputProps()} />
        <Upload className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-2 text-sm text-gray-600">
          Drag & drop a file here, or click to select
        </p>
      </div>
      <div className="text-center">
        <span className="text-sm text-gray-500">or</span>
      </div>
      <Button
        type="button"
        variant="outline"
        className="w-full"
        onClick={() => setShowCamera(true)}
      >
        <Camera size={16} className="mr-2" />
        Use Camera
      </Button>
    </div>
  );
};

export default MediaUpload;