import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Upload, FileText, Loader2, Calendar, Building2 } from 'lucide-react';
import { format } from 'date-fns';

interface LabRequestUltraSimpleProps {
  patientId: string;
  visitId?: string;
  onClose: () => void;
  onRequestCreated: () => void;
}

export default function LabRequestUltraSimple({ 
  patientId, 
  visitId, 
  onClose, 
  onRequestCreated 
}: LabRequestUltraSimpleProps) {
  const [requestDate, setRequestDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [preferredDate, setPreferredDate] = useState('');
  const [labFacility, setLabFacility] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    try {
      // Upload to Supabase storage
      const fileName = `lab-requests/${patientId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Create lab request with uploaded file
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Create the lab request
      const { data: labRequest, error: requestError } = await supabase
        .from('lab_requests')
        .insert({
          patient_id: patientId,
          visit_id: visitId,
          request_date: requestDate,
          preferred_date: preferredDate || null,
          lab_facility: labFacility || null,
          notes: notes || null,
          media_url: publicUrl,
          media_type: file.type,
          status: 'pending'
        })
        .select()
        .single();

      if (requestError) throw requestError;

      // Automatically extract results using AI
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
          },
          body: JSON.stringify({
            imageUrl: publicUrl,
            fileType: file.type,
            extractionType: 'results'
          })
        });

        if (response.ok) {
          const { results } = await response.json();
          
          if (results && results.length > 0) {
            // Insert all extracted test results
            const testResults = results.map((result: any) => ({
              lab_request_id: labRequest.id,
              test_name: result.testName,
              test_value: result.testValue,
              test_unit: result.testUnit || null,
              reference_range: result.referenceRange || null
            }));

            const { error: resultsError } = await supabase
              .from('lab_results')
              .insert(testResults);

            if (!resultsError) {
              // Update request status to completed
              await supabase
                .from('lab_requests')
                .update({ status: 'completed' })
                .eq('id', labRequest.id);
            }
          }
        }
      } catch (aiError) {
        console.error('AI extraction failed:', aiError);
        // Request created successfully, just AI extraction failed
      }

      onRequestCreated();
      onClose();
    } catch (error) {
      console.error('Error creating lab request:', error);
      alert('Failed to create lab request. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!uploadedFile) {
      alert('Please upload a lab document first');
      return;
    }

    // File upload already handles submission
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Create Lab Request</h2>
          <p className="text-gray-600 mt-1">Upload lab results document</p>
        </div>

        <div className="p-6 space-y-4">
          {/* Request Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Request Date
            </label>
            <input
              type="date"
              value={requestDate}
              onChange={(e) => setRequestDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Preferred Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Expected Results Date (Optional)
            </label>
            <input
              type="date"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              min={requestDate}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Lab Facility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Building2 className="w-4 h-4 inline mr-1" />
              Lab Facility (Optional)
            </label>
            <input
              type="text"
              value={labFacility}
              onChange={(e) => setLabFacility(e.target.value)}
              placeholder="e.g., PathCare, Lancet Lab"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional information"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            />
          </div>

          {/* File Upload */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
            {isUploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-cyan-600 mb-2" />
                <p className="text-sm text-gray-600">Processing lab results...</p>
              </div>
            ) : uploadedFile ? (
              <div className="flex flex-col items-center">
                <FileText className="w-8 h-8 text-green-600 mb-2" />
                <p className="text-sm font-medium text-gray-900">{uploadedFile.name}</p>
                <p className="text-xs text-gray-600 mt-1">Upload complete</p>
              </div>
            ) : (
              <>
                <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600 mb-2">Upload lab results document</p>
                <label className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg cursor-pointer hover:bg-cyan-700 transition-colors">
                  <Upload className="w-4 h-4" />
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                <p className="text-xs text-gray-500 mt-2">PDF or image files accepted</p>
              </>
            )}
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
          </div>
        </div>
      </div>
    </div>
  );
}