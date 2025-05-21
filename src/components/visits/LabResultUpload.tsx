import React, { useState } from 'react';
import { Button } from '../ui/Button';
import { supabase } from '../../lib/supabase';

interface LabResultUploadProps {
  visitId: string;
  onUploadComplete?: () => void;
}

const LabResultUpload: React.FC<LabResultUploadProps> = ({ visitId, onUploadComplete }) => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `lab-results/${visitId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('medical-files')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('medical-files')
        .getPublicUrl(filePath);

      // Here you would typically save the lab result details to your database
      // including the file URL and other metadata

      onUploadComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during upload');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileUpload}
        className="hidden"
        id="lab-result-upload"
      />
      <label htmlFor="lab-result-upload">
        <Button
          as="span"
          disabled={uploading}
          className="cursor-pointer"
        >
          {uploading ? 'Uploading...' : 'Upload Lab Result'}
        </Button>
      </label>
      {error && (
        <p className="text-red-500 text-sm">{error}</p>
      )}
    </div>
  );
};

export default LabResultUpload;