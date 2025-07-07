import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, FileText, Loader2, Wand2 } from 'lucide-react';

interface UploadLabDocumentProps {
  requestId: string;
  onClose: () => void;
  onExtractionComplete: () => void;
}

export default function UploadLabDocument({ 
  requestId, 
  onClose, 
  onExtractionComplete 
}: UploadLabDocumentProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);
    setExtractionError('');

    try {
      // Get patient ID from request
      const { data: request } = await supabase
        .from('lab_requests')
        .select('patient_id')
        .eq('id', requestId)
        .single();

      if (!request) throw new Error('Request not found');

      // Upload to Supabase storage
      const fileName = `lab-results/${request.patient_id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Update lab request with media URL
      await supabase
        .from('lab_requests')
        .update({
          media_url: publicUrl,
          media_type: file.type
        })
        .eq('id', requestId);

      // Start extraction automatically
      await extractResults(publicUrl, file.type);

    } catch (error) {
      console.error('Upload error:', error);
      setExtractionError('Failed to upload file');
    } finally {
      setIsUploading(false);
    }
  };

  const extractResults = async (mediaUrl: string, fileType: string) => {
    setIsExtracting(true);
    setExtractionError('');

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          imageUrl: mediaUrl,
          fileType: fileType,
          extractionType: 'results'
        })
      });

      if (!response.ok) {
        throw new Error('AI extraction failed');
      }

      const { results } = await response.json();
      
      if (results && results.length > 0) {
        // Check if there are existing results
        const { data: existingResults, error: fetchError } = await supabase
          .from('lab_results')
          .select('test_name')
          .eq('lab_request_id', requestId);

        if (fetchError) throw fetchError;

        // Create a set of existing test names for easy lookup
        const existingTestNames = new Set((existingResults || []).map(r => r.test_name.toLowerCase()));

        // Filter out duplicates - only add new tests that don't already exist
        const newTestResults = results
          .filter((result: any) => !existingTestNames.has(result.testName.toLowerCase()))
          .map((result: any) => ({
            lab_request_id: requestId,
            test_name: result.testName,
            test_value: result.testValue,
            test_unit: result.testUnit || null,
            reference_range: result.referenceRange || null
          }));

        if (newTestResults.length > 0) {
          const { error: resultsError } = await supabase
            .from('lab_results')
            .insert(newTestResults);

          if (resultsError) throw resultsError;

          // Update request status to completed if it's not already
          await supabase
            .from('lab_requests')
            .update({ status: 'completed' })
            .eq('id', requestId);

          onExtractionComplete();
          onClose();
        } else {
          setExtractionError('All extracted tests already exist for this request. No new tests were added.');
        }
      } else {
        setExtractionError('No test results found in the document');
      }
    } catch (error) {
      console.error('Extraction error:', error);
      setExtractionError('Failed to extract test results. Please try manual entry.');
    } finally {
      setIsExtracting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">AI Extract Lab Results</h2>
          <p className="text-gray-600 mt-1">Upload document to extract and add new test results</p>
        </div>

        <div className="p-6">
          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            {isUploading || isExtracting ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 animate-spin text-cyan-600 mb-3" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  {isUploading ? 'Uploading document...' : 'Extracting results...'}
                </p>
                <p className="text-xs text-gray-600">
                  {isExtracting && 'AI is analyzing your lab results'}
                </p>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col items-center">
                <FileText className="w-12 h-12 text-green-600 mb-3" />
                <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                <p className="text-xs text-gray-600 mt-1">Upload complete</p>
                {extractionError && (
                  <div className="mt-3 p-3 bg-red-50 rounded-lg">
                    <p className="text-sm text-red-600">{extractionError}</p>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900 mb-1">
                  Drop your lab results here
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  or click to browse
                </p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg cursor-pointer hover:bg-cyan-700 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading || isExtracting}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-3">
                  PDF or image files • Max 50MB
                </p>
              </>
            )}
          </div>

          {extractionError && (
            <p className="mt-4 text-sm text-gray-600 text-center">
              You can close this window and try manual entry instead
            </p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={onClose}
              disabled={isUploading || isExtracting}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}