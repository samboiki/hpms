import React, { useState } from 'react';
import { Camera, Upload, Sparkles } from 'lucide-react';
import Button from '../ui/Button';
import Webcam from 'react-webcam';
import { supabase } from '../../lib/supabase';

interface LabResultUploadProps {
  onExtractedData: (data: any) => void;
}

const LabResultUpload: React.FC<LabResultUploadProps> = ({ onExtractedData }) => {
  const [showCamera, setShowCamera] = useState(false);
  const [processing, setProcessing] = useState(false);
  const webcamRef = React.useRef<Webcam>(null);

  const processImage = async (imageData: string) => {
    try {
      setProcessing(true);

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });

      const data = await response.json();
      
      if (data.success) {
        onExtractedData(data.labResults);
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error processing image:', error);
    } finally {
      setProcessing(false);
      setShowCamera(false);
    }
  };

  const captureImage = React.useCallback(async () => {
    if (!webcamRef.current) return;
    const imageSrc = webcamRef.current.getScreenshot();
    if (imageSrc) {
      await processImage(imageSrc);
    }
  }, [webcamRef]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setProcessing(true);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64data = reader.result as string;
        await processImage(base64data.split(',')[1]);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      setProcessing(false);
    }
  };

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
          <Button onClick={captureImage} disabled={processing}>
            {processing ? 'Processing...' : 'Capture'}
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
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
          id="lab-result-upload"
        />
        <label htmlFor="lab-result-upload" className="cursor-pointer">
          <Upload className="mx-auto h-12 w-12 text-gray-400" />
          <p className="mt-2 text-sm text-gray-600">
            Click to upload a lab result image
          </p>
        </label>
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
        Take Photo of Lab Result
      </Button>
      <div className="text-center text-sm text-gray-500 flex items-center justify-center">
        <Sparkles size={16} className="mr-2 text-brand-primary" />
        AI-powered text extraction
      </div>
    </div>
  );
};

export default LabResultUpload;