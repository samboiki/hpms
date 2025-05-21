import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import Button from '../ui/Button';

interface LabResultUploadProps {
  onUpload: (data: {
    name: string;
    value: string;
    unit: string;
    reference_range: string;
    status: 'normal' | 'high' | 'low' | 'critical';
  }) => void;
}

const LabResultUpload: React.FC<LabResultUploadProps> = ({ onUpload }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      setError(null);

      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        throw new Error('Please upload an image file');
      }

      // Generate unique file name
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `lab-results/${fileName}`;

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('media')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('media')
        .getPublicUrl(filePath);

      // Process with AI
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
      
      onUpload({
        name: result.testName || 'Unknown Test',
        value: result.value || '',
        unit: result.unit || '',
        reference_range: result.referenceRange || '',
        status: result.status || 'normal'
      });

    } catch (error) {
      console.error('Error uploading lab result:', error);
      setError(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <input
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
        id="lab-result-upload"
      />
      <label htmlFor="lab-result-upload">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              <Upload size={16} className="mr-2" />
              Upload & Process
            </>
          )}
        </Button>
      </label>
      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}
    </div>
  );
};

export default LabResultUpload;