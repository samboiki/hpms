import React, { useState } from 'react';
import { Upload, X, Image as ImageIcon, FileText, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';

interface MediaUploadProps {
  visitId: string;
  onUploadComplete: (url: string) => void;
}

const MediaUpload: React.FC<MediaUploadProps> = ({ visitId, onUploadComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      // Validate file size (5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    try {
      setUploading(true);
      setError(null);

      // Create a unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
      const filePath = `photo/${fileName}`;

      // Upload file to Supabase Storage
      const { error: uploadError, data } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      onUploadComplete(publicUrl);
      setFile(null);
    } catch (err) {
      console.error('Error uploading file:', err);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Input Area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileSelect}
          className="hidden"
          id="file-upload"
        />
        
        {!file ? (
          <label 
            htmlFor="file-upload" 
            className="cursor-pointer flex flex-col items-center"
          >
            <Upload size={24} className="text-gray-400 mb-2" />
            <span className="text-sm font-medium text-gray-900">Click to upload</span>
            <span className="text-xs text-gray-500">or drag and drop</span>
            <span className="text-xs text-gray-500 mt-1">PNG, JPG up to 5MB</span>
          </label>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center space-x-2">
              {file.type.startsWith('image/') ? (
                <ImageIcon size={20} className="text-brand-primary" />
              ) : (
                <FileText size={20} className="text-brand-primary" />
              )}
              <span className="text-sm font-medium text-gray-900">{file.name}</span>
              <button
                onClick={() => setFile(null)}
                className="text-gray-400 hover:text-gray-500"
              >
                <X size={16} />
              </button>
            </div>
            <Button
              onClick={handleUpload}
              disabled={uploading}
              isLoading={uploading}
            >
              {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center text-error-600 text-sm">
          <AlertCircle size={16} className="mr-2" />
          {error}
        </div>
      )}
    </div>
  );
};

export default MediaUpload;