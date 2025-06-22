import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, FileText, Calendar, Loader2, Edit2, Trash2, CheckCircle, Clock, Upload, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import LabRequestSimple from './LabRequestSimple';

interface LabResultsSimpleProps {
  patientId: string;
  visitId?: string;
}

interface LabRequest {
  id: string;
  test_name: string;
  test_value: string | null;
  test_unit: string | null;
  reference_range: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  request_date: string;
  completed_date: string | null;
  lab_facility: string | null;
  notes: string | null;
  media_url: string | null;
}

export default function LabResultsSimple({ patientId, visitId }: LabResultsSimpleProps) {
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRequest, setEditingRequest] = useState<LabRequest | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [extractingFor, setExtractingFor] = useState<string | null>(null);

  useEffect(() => {
    fetchLabRequests();
  }, [patientId, visitId]);

  const fetchLabRequests = async () => {
    try {
      let query = supabase
        .from('lab_requests')
        .select('*')
        .eq('patient_id', patientId)
        .order('request_date', { ascending: false });

      if (visitId) {
        query = query.eq('visit_id', visitId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      setLabRequests(data || []);
    } catch (error) {
      console.error('Error fetching lab requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteRequest = async (request: LabRequest) => {
    setEditingRequest(request);
  };

  const handleUpdateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRequest) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('lab_requests')
        .update({
          test_value: editingRequest.test_value,
          test_unit: editingRequest.test_unit,
          reference_range: editingRequest.reference_range,
          status: 'completed',
          completed_date: new Date().toISOString(),
          notes: editingRequest.notes
        })
        .eq('id', editingRequest.id);

      if (error) throw error;
      
      await fetchLabRequests();
      setEditingRequest(null);
    } catch (error) {
      console.error('Error updating lab request:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleFileUpload = async (requestId: string, file: File) => {
    setUploadingFor(requestId);
    try {
      // Upload file
      const fileName = `lab-results/${patientId}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Update request with media URL
      const { error: updateError } = await supabase
        .from('lab_requests')
        .update({
          media_url: publicUrl,
          media_type: file.type
        })
        .eq('id', requestId);

      if (updateError) throw updateError;
      
      await fetchLabRequests();
    } catch (error) {
      console.error('File upload error:', error);
    } finally {
      setUploadingFor(null);
    }
  };

  const handleAIExtraction = async (request: LabRequest) => {
    if (!request.media_url) return;

    setExtractingFor(request.id);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify({
          imageUrl: request.media_url,
          fileType: 'image',
          extractionType: 'results'
        })
      });

      if (!response.ok) throw new Error('AI extraction failed');

      const { results } = await response.json();
      
      if (results && results.length > 0) {
        // Find the result matching this test name
        const matchingResult = results.find((r: any) => 
          r.testName.toLowerCase().includes(request.test_name.toLowerCase()) ||
          request.test_name.toLowerCase().includes(r.testName.toLowerCase())
        ) || results[0];

        // Update the request with extracted values
        const { error } = await supabase
          .from('lab_requests')
          .update({
            test_value: matchingResult.testValue || request.test_value,
            test_unit: matchingResult.testUnit || request.test_unit,
            reference_range: matchingResult.referenceRange || request.reference_range,
            status: 'completed',
            completed_date: new Date().toISOString(),
            ai_extraction_data: results
          })
          .eq('id', request.id);

        if (error) throw error;
        
        await fetchLabRequests();
      }
    } catch (error) {
      console.error('AI extraction error:', error);
    } finally {
      setExtractingFor(null);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lab request?')) return;

    try {
      const { error } = await supabase
        .from('lab_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      await fetchLabRequests();
    } catch (error) {
      console.error('Error deleting lab request:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-cyan-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Lab Results</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Lab Request</span>
        </button>
      </div>

      {/* Lab Requests List */}
      {labRequests.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No lab requests found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
          >
            Create first lab request
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {labRequests.map((request) => (
            <div key={request.id} className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h4 className="font-medium text-gray-900">{request.test_name}</h4>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                  </div>
                  
                  {request.status === 'completed' && request.test_value && (
                    <div className="mt-2 bg-gray-50 rounded-md p-3">
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-600">Result:</span>
                          <p className="font-medium text-gray-900">
                            {request.test_value} {request.test_unit}
                          </p>
                        </div>
                        {request.reference_range && (
                          <div>
                            <span className="text-gray-600">Reference:</span>
                            <p className="font-medium text-gray-900">{request.reference_range}</p>
                          </div>
                        )}
                        {request.completed_date && (
                          <div>
                            <span className="text-gray-600">Completed:</span>
                            <p className="font-medium text-gray-900">
                              {format(new Date(request.completed_date), 'dd MMM yyyy')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 mt-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      <span>Requested: {format(new Date(request.request_date), 'dd MMM yyyy')}</span>
                    </div>
                    {request.lab_facility && (
                      <span>• {request.lab_facility}</span>
                    )}
                  </div>
                  
                  {request.notes && (
                    <p className="mt-2 text-sm text-gray-600">{request.notes}</p>
                  )}
                </div>
                
                <div className="flex items-center gap-2 ml-4">
                  {request.status === 'pending' && (
                    <>
                      {!request.media_url && (
                        <label className="cursor-pointer p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                          <Upload className="w-4 h-4" />
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            onChange={(e) => e.target.files?.[0] && handleFileUpload(request.id, e.target.files[0])}
                            className="hidden"
                          />
                        </label>
                      )}
                      
                      {request.media_url && (
                        <button
                          onClick={() => handleAIExtraction(request)}
                          disabled={extractingFor === request.id}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Extract with AI"
                        >
                          {extractingFor === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      
                      <button
                        onClick={() => handleCompleteRequest(request)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Complete manually"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  
                  <button
                    onClick={() => handleDeleteRequest(request.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <LabRequestSimple
          patientId={patientId}
          visitId={visitId}
          onClose={() => setShowCreateModal(false)}
          onRequestCreated={fetchLabRequests}
        />
      )}

      {/* Edit Modal */}
      {editingRequest && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-xl font-bold text-gray-900">Complete Lab Result</h3>
              <p className="text-gray-600 mt-1">{editingRequest.test_name}</p>
            </div>

            <form onSubmit={handleUpdateRequest} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Result Value <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={editingRequest.test_value || ''}
                  onChange={(e) => setEditingRequest({ ...editingRequest, test_value: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Unit
                </label>
                <input
                  type="text"
                  value={editingRequest.test_unit || ''}
                  onChange={(e) => setEditingRequest({ ...editingRequest, test_unit: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reference Range
                </label>
                <input
                  type="text"
                  value={editingRequest.reference_range || ''}
                  onChange={(e) => setEditingRequest({ ...editingRequest, reference_range: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={editingRequest.notes || ''}
                  onChange={(e) => setEditingRequest({ ...editingRequest, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRequest(null)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUpdating || !editingRequest.test_value}
                  className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpdating ? 'Saving...' : 'Complete'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}