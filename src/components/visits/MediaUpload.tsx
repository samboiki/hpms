import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../ui/Button';
import { Upload } from 'lucide-react';

interface Props {
  type: 'xray' | 'ct' | 'mri' | 'ultrasound' | 'photo';
  onUpload: (url: string) => void;
}

const MediaUpload: React.FC<Props> = ({ type, onUpload }) => {
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      const file = event.target.files?.[0];
      
      if (!file) {
        throw new Error('No file selected');
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${type}/${fileName}`;

      // Upload file
      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      onUpload(publicUrl);
    } catch (error) {
      console.error('Error uploading media:', error);
      alert(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
        id="media-upload"
      />
      <label htmlFor="media-upload">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isUploading}
          asChild
        >
          <span>
            <Upload size={16} className="mr-2" />
            {isUploading ? 'Uploading...' : 'Upload Media'}
          </span>
        </Button>
      </label>
    </div>
  );
};

export default MediaUpload;