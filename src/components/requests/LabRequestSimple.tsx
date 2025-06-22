import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, FileText, Loader2, Check, X, Wand2 } from 'lucide-react';
import { format } from 'date-fns';

interface LabRequestSimpleProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
  onRequestCreated: () => void;
}

export default function LabRequestSimple({ 
  patientId, 
  visitId, 
  onClose, 
  onRequestCreated 
}: LabRequestSimpleProps) {
  const [testName, setTestName] = useState('');
  const [testValue, setTestValue] = useState('');
  const [testUnit, setTestUnit] = useState('');
  const [referenceRange, setReferenceRange] = useState('');
  const [labFacility, setLabFacility] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<'pending' | 'completed'>('pending');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionError, setExtractionError] = useState('');

  const handleFileUpload = async (file: File) => {
    try {
      setUploadedFile(file);
      setExtractionError('');
      
      // Upload to Supabase storage
      const fileName = `lab-results/${patientId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      setMediaUrl(publicUrl);
    } catch (error) {
      console.error('File upload error:', error);
      setExtractionError('Failed to upload file');
    }
  };

  const handleAIExtraction = async () => {
    if (!mediaUrl) return;

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
          fileType: uploadedFile?.type,
          extractionType: 'results'
        })
      });

      if (!response.ok) {
        throw new Error('AI extraction failed');
      }

      const { results } = await response.json();
      
      if (results && results.length > 0) {
        // Use the first result to populate fields
        const firstResult = results[0];
        setTestName(firstResult.testName || '');
        setTestValue(firstResult.testValue || '');
        setTestUnit(firstResult.testUnit || '');
        setReferenceRange(firstResult.referenceRange || '');
        
        // If multiple results, add them to notes
        if (results.length > 1) {
          const additionalResults = results.slice(1).map((r: any) => 
            `${r.testName}: ${r.testValue} ${r.testUnit} (Ref: ${r.referenceRange})`
          ).join('\n');
          setNotes(prev => prev ? `${prev}\n\nAdditional Results:\n${additionalResults}` : `Additional Results:\n${additionalResults}`);
        }
      }
    } catch (error) {
      console.error('AI extraction error:', error);
      setExtractionError('Failed to extract data from document');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('lab_requests')
        .insert({
          patient_id: patientId,
          visit_id: visitId,
          test_name: testName,
          test_value: testValue || null,
          test_unit: testUnit || null,
          reference_range: referenceRange || null,
          lab_facility: labFacility || null,
          notes: notes || null,
          status: status,
          media_url: mediaUrl || null,
          media_type: uploadedFile?.type || null,
          completed_date: status === 'completed' ? new Date().toISOString() : null
        });

      if (error) throw error;
      
      onRequestCreated();
      onClose();
    } catch (error) {
      console.error('Error creating lab request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Create Lab Request</h2>
          <p className="text-gray-600 mt-1">Add a new lab test request or result</p>
        </div>

        <div className="p-6 space-y-6">
          {/* File Upload Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Lab Document (Optional)
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                <Upload className="w-4 h-4" />
                <span>Choose File</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                  className="hidden"
                />
              </label>
              
              {uploadedFile && (
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <FileText className="w-4 h-4" />
                  <span>{uploadedFile.name}</span>
                  {mediaUrl && (
                    <button
                      type="button"
                      onClick={handleAIExtraction}
                      disabled={isExtracting}
                      className="ml-2 flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      {isExtracting ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Wand2 className="w-3 h-3" />
                      )}
                      <span>Extract with AI</span>
                    </button>
                  )}
                </div>
              )}
            </div>
            {extractionError && (
              <p className="mt-2 text-sm text-red-600">{extractionError}</p>
            )}
          </div>

          {/* Test Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Test Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
                required
                placeholder="e.g., Complete Blood Count (CBC)"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Result Value
              </label>
              <input
                type="text"
                value={testValue}
                onChange={(e) => setTestValue(e.target.value)}
                placeholder="e.g., 95"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit
              </label>
              <input
                type="text"
                value={testUnit}
                onChange={(e) => setTestUnit(e.target.value)}
                placeholder="e.g., mg/dL"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reference Range
              </label>
              <input
                type="text"
                value={referenceRange}
                onChange={(e) => setReferenceRange(e.target.value)}
                placeholder="e.g., 70-100"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lab Facility
              </label>
              <input
                type="text"
                value={labFacility}
                onChange={(e) => setLabFacility(e.target.value)}
                placeholder="e.g., PathCare Lab"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'pending' | 'completed')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Additional notes or observations"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !testName}
              className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Create Request</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}