import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2 } from 'lucide-react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface LabResultUploadProps {
  onUpload: (data: {
    name: string;
    value: string;
    unit: string;
    referenceRange: string;
    status: 'normal' | 'high' | 'low' | 'critical';
  }) => void;
}

const LabResultUpload: React.FC<LabResultUploadProps> = ({ onUpload }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const processImage = async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);

      // First upload the file to get a URL
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
      const filePath = `lab-results/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Call the edge function to process the image
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl: publicUrl })
      });

      if (!response.ok) {
        throw new Error('Failed to process image');
      }

      const result = await response.json();

      // Process the extracted text to identify lab values
      // This is a simplified example - in a real app you'd need more sophisticated parsing
      const labData = {
        name: result.testName || 'Unknown Test',
        value: result.value || '',
        unit: result.unit || '',
        referenceRange: result.referenceRange || '',
        status: result.status || 'normal'
      };

      onUpload(labData);
    } catch (err) {
      console.error('Error processing lab result:', err);
      setError('Failed to process the image. Please try again or enter the values manually.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      processImage(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg']
    },
    maxFiles: 1,
    disabled: isProcessing
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-brand-primary bg-brand-primary/5' : 'border-gray-300 hover:border-brand-primary'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="text-center">
            <Loader2 size={24} className="mx-auto mb-4 animate-spin text-brand-primary" />
            <p className="text-sm text-gray-600">Processing image...</p>
          </div>
        ) : (
          <>
            <Upload
              size={24}
              className={`mx-auto mb-4 ${isDragActive ? 'text-brand-primary' : 'text-gray-400'}`}
            />
            <p className="text-sm text-gray-600">
              {isDragActive
                ? 'Drop the lab result here'
                : 'Drag and drop a lab result image, or click to select'
            }
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Supported formats: PNG, JPG
            </p>
          </>
        )}
      </div>

      {error && (
        <p className="text-sm text-red-600 mt-2">{error}</p>
      )}
    </div>
  );
};

export default LabResultUpload;