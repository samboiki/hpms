import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, FileText, Calendar, Loader2, Trash2, CheckCircle, Clock, Building2, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { format } from 'date-fns';
import LabRequestUltraSimple from './LabRequestUltraSimple';
import { getResultStatus } from '../../utils/labResultStatus';

interface LabResultsUltraSimpleProps {
  patientId: string;
  visitId?: string;
}

interface LabRequest {
  id: string;
  request_date: string;
  preferred_date: string | null;
  lab_facility: string | null;
  status: 'pending' | 'completed' | 'cancelled';
  notes: string | null;
  media_url: string | null;
  created_at: string;
}

interface LabResult {
  id: string;
  test_name: string;
  test_value: string;
  test_unit: string | null;
  reference_range: string | null;
  status: string | null;
}

export default function LabResultsUltraSimple({ patientId, visitId }: LabResultsUltraSimpleProps) {
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labResults, setLabResults] = useState<{ [key: string]: LabResult[] }>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);

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

      const { data: requests, error: requestsError } = await query;
      if (requestsError) throw requestsError;
      
      setLabRequests(requests || []);

      // Fetch results for each request
      if (requests && requests.length > 0) {
        const resultsMap: { [key: string]: LabResult[] } = {};
        
        for (const request of requests) {
          const { data: results, error: resultsError } = await supabase
            .from('lab_results')
            .select('*')
            .eq('lab_request_id', request.id)
            .order('test_name');
          
          if (!resultsError && results) {
            resultsMap[request.id] = results;
          }
        }
        
        setLabResults(resultsMap);
      }
    } catch (error) {
      console.error('Error fetching lab requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!confirm('Are you sure you want to delete this lab request and all its results?')) return;

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

  const handleReprocess = async (request: LabRequest) => {
    if (!request.media_url) return;

    setProcessingRequest(request.id);
    try {
      // Delete existing results
      await supabase
        .from('lab_results')
        .delete()
        .eq('lab_request_id', request.id);

      // Re-extract using AI — try Gemini first, fall back to legacy edge function
      let results: any[] = [];
      let extractionOk = false;

      try {
        const { geminiExtractLabResults, isGeminiConfigured } = await import('../../lib/geminiClient');
        if (isGeminiConfigured()) {
          const gem = await geminiExtractLabResults({
            fileUrl: request.media_url,
            mimeType: 'application/pdf',
          });
          results = gem.results;
          extractionOk = true;
        }
      } catch (gemErr) {
        console.warn('Gemini extraction failed, falling back to edge function:', gemErr);
      }

      if (!extractionOk) {
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
        if (response.ok) {
          const payload = await response.json();
          results = payload.results || [];
          extractionOk = true;
        }
      }

      if (extractionOk) {
        if (results && results.length > 0) {
          // Insert new results
          const testResults = results.map((result: any) => ({
            lab_request_id: request.id,
            test_name: result.testName,
            test_value: result.testValue,
            test_unit: result.testUnit || null,
            reference_range: result.referenceRange || null
          }));

          const { error } = await supabase
            .from('lab_results')
            .insert(testResults);

          if (!error) {
            // Update status to completed
            await supabase
              .from('lab_requests')
              .update({ status: 'completed' })
              .eq('id', request.id);
          }
        }
      }
      
      await fetchLabRequests();
    } catch (error) {
      console.error('Error reprocessing:', error);
      alert('Failed to reprocess document');
    } finally {
      setProcessingRequest(null);
    }
  };

  const toggleExpanded = (requestId: string) => {
    const newExpanded = new Set(expandedRequests);
    if (newExpanded.has(requestId)) {
      newExpanded.delete(requestId);
    } else {
      newExpanded.add(requestId);
    }
    setExpandedRequests(newExpanded);
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

  const getResultStatusColor = (status: string) => {
    switch (status) {
      case 'high':
        return 'text-red-600 font-medium';
      case 'low':
        return 'text-blue-600 font-medium';
      case 'critical':
        return 'text-red-800 font-bold';
      default:
        return 'text-gray-900';
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
          <span>Upload Lab Results</span>
        </button>
      </div>

      {/* Lab Requests List */}
      {labRequests.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No lab results found</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
          >
            Upload first lab results
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {labRequests.map((request) => {
            const results = labResults[request.id] || [];
            const isExpanded = expandedRequests.has(request.id);

            return (
              <div key={request.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                {/* Request Header */}
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {request.status}
                        </span>
                        <span className="text-sm text-gray-600">
                          {results.length} test{results.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>Requested: {format(new Date(request.request_date), 'dd MMM yyyy')}</span>
                        </div>
                        {request.preferred_date && (
                          <span>• Expected: {format(new Date(request.preferred_date), 'dd MMM yyyy')}</span>
                        )}
                        {request.lab_facility && (
                          <div className="flex items-center gap-1">
                            <Building2 className="w-4 h-4" />
                            <span>{request.lab_facility}</span>
                          </div>
                        )}
                      </div>
                      
                      {request.notes && (
                        <p className="mt-2 text-sm text-gray-600">{request.notes}</p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {request.media_url && request.status === 'pending' && (
                        <button
                          onClick={() => handleReprocess(request)}
                          disabled={processingRequest === request.id}
                          className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                          title="Re-extract with AI"
                        >
                          {processingRequest === request.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Wand2 className="w-4 h-4" />
                          )}
                        </button>
                      )}
                      
                      {results.length > 0 && (
                        <button
                          onClick={() => toggleExpanded(request.id)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
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

                {/* Test Results */}
                {isExpanded && results.length > 0 && (
                  <div className="border-t border-gray-200">
                    <table className="w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Test Name
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Result
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Reference Range
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {results.map((result) => {
                          const status = getResultStatus(result.test_value, result.reference_range);
                          return (
                            <tr key={result.id}>
                              <td className="px-4 py-3 text-sm text-gray-900">
                                {result.test_name}
                              </td>
                              <td className={`px-4 py-3 text-sm ${getResultStatusColor(status)}`}>
                                {result.test_value} {result.test_unit}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-600">
                                {result.reference_range || '-'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <LabRequestUltraSimple
          patientId={patientId}
          visitId={visitId}
          onClose={() => setShowCreateModal(false)}
          onRequestCreated={fetchLabRequests}
        />
      )}
    </div>
  );
}