import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, Loader2, Wand2 } from 'lucide-react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { RECORDS_BUCKET, currentPracticeId, recordLink, recordPath } from '../../services/recordFiles';
import { geminiExtractLabResults, isGeminiConfigured } from '../../lib/geminiClient';

interface LabResultUploadProps {
  onUpload: (data: {
    id?: string;
    name: string;
    value: string;
    unit: string;
    reference_range: string;
    status: 'normal' | 'high' | 'low' | 'critical';
  }) => void;
}

const LabResultUpload: React.FC<LabResultUploadProps> = ({ onUpload }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  const processWithAI = async (file: File) => {
    try {
      setIsProcessing(true);
      setError(null);

      // First store the report: a patient record, so the private bucket, in the practice's folder
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}${Date.now()}.${fileExt}`;
      const filePath = recordPath(currentPracticeId(), 'lab-results', fileName);

      const { error: uploadError } = await supabase.storage
        .from(RECORDS_BUCKET)
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error('Failed to upload image');
      }

      // Path A — Gemini Flash (PDF + image native support, free tier)
      // Path B — legacy Supabase Edge Function (requires OPENAI_API_KEY secret)
      let result: any;
      if (isGeminiConfigured()) {
        console.log('✨ Extracting with Gemini 1.5 Flash');
        const gem = await geminiExtractLabResults({
          fileBlob: file,
          mimeType: file.type,
        });
        // Map Gemini's testValue/testUnit shape to this component's value/unit shape
        result = {
          results: gem.results.map(r => ({
            testName: r.testName,
            value: r.testValue,
            unit: r.testUnit ?? '',
            referenceRange: r.referenceRange ?? '',
            status: 'normal',
          })),
        };
      } else {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
          method: 'POST',
          headers: {
            // The signed-in user's token: extract-text only reads documents for active staff
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // The reading service fetches the report through a link that works for a few minutes, made now
            imageUrl: await recordLink(filePath),
            fileType: file.type
          })
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('Processing error:', errorData);
          throw new Error('Failed to process image');
        }

        result = await response.json();
      }

      // Handle the response from the updated edge function
      if (result.results && Array.isArray(result.results) && result.results.length > 0) {
        // Process each extracted result
        result.results.forEach((labResult: any) => {
          const labData = {
            id: crypto.randomUUID(),
            name: labResult.testName || 'Unknown Test',
            value: labResult.value || '',
            unit: labResult.unit || '',
            reference_range: labResult.referenceRange || '',
            status: labResult.status || 'normal'
          };
          onUpload(labData);
        });
      } else {
        // Fallback for single result or empty response
        const labData = {
          id: crypto.randomUUID(),
          name: result.testName || 'Unknown Test',
          value: result.value || '',
          unit: result.unit || '',
          reference_range: result.referenceRange || '',
          status: result.status || 'normal'
        };
        onUpload(labData);
      }
      // The preview stays the local copy shown on drop: the stored report has no public link
    } catch (err) {
      console.error('Error processing lab result:', err);
      // Provide default data even when processing fails
      onUpload({
        id: crypto.randomUUID(),
        name: 'Unknown Test',
        value: '',
        unit: '',
        reference_range: '',
        status: 'normal'
      });
      setError('Failed to process the image. Default values have been provided for manual entry.');
    } finally {
      setIsProcessing(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      // Show preview immediately
      const previewUrl = URL.createObjectURL(file);
      setPreview(previewUrl);
      
      // Store the file for AI processing
      setUploadedFile(file);
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
          ${isDragActive ? 'border-[#01b9d4] bg-[#01b9d4]/5' : 'border-gray-300 hover:border-[#01b9d4]'}
          ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />
        {isProcessing ? (
          <div className="text-center">
            <Loader2 size={24} className="mx-auto mb-4 animate-spin text-[#01b9d4]" />
            <p className="text-sm text-gray-600">Processing image...</p>
          </div>
        ) : (
          <>
            <Upload
              size={24}
              className={`mx-auto mb-4 ${isDragActive ? 'text-[#01b9d4]' : 'text-gray-400'}`}
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

      {preview && !isProcessing && uploadedFile && (
        <div className="bg-gray-50 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Preview</h4>
            <Button
              size="sm"
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                processWithAI(uploadedFile);
              }}
              disabled={isProcessing}
            >
              <Wand2 size={16} className="mr-2" />
              Process with AI
            </Button>
          </div>
          <img
            src={preview}
            alt="Lab result preview"
            className="w-full h-48 object-contain rounded-lg border border-gray-200"
          />
          <p className="text-xs text-gray-500 mt-2 text-center">
            Click "Process with AI" to extract data or enter values manually
          </p>
        </div>
      )}
    </div>
  );
};

export default LabResultUpload;