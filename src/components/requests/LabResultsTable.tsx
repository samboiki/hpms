import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, FileText, Calendar, Loader2, Building2, Edit3, Upload, Eye, ChevronDown, ChevronUp, CheckCircle, Clock, Trash2, Edit2 } from 'lucide-react';
import { format } from 'date-fns';
import CreateLabRequest from './CreateLabRequest';
import EditLabRequest from './EditLabRequest';
import EnterLabResults from './EnterLabResults';
import EditLabResults from './EditLabResults';
import UploadLabDocument from './UploadLabDocument';
import LabResultReleaseButton from './LabResultReleaseButton';
import { getResultStatus } from '../../utils/labResultStatus';
import toast from 'react-hot-toast';

// The Add Visit screen passes an empty visitId until the visit exists, and a lab request saved
// with visit_id "" is rejected by the database, so creating one is blocked with this reason
const NEW_VISIT_HINT = 'Save the visit first, then open it again to add lab requests.';

interface LabResultsTableProps {
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

export default function LabResultsTable({ patientId, visitId }: LabResultsTableProps) {
  const [labRequests, setLabRequests] = useState<LabRequest[]>([]);
  const [labResults, setLabResults] = useState<{ [key: string]: LabResult[] }>({});
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<LabRequest | null>(null);
  const [showEnterResultsModal, setShowEnterResultsModal] = useState<string | null>(null);
  const [showEditResultsModal, setShowEditResultsModal] = useState<string | null>(null);
  const [showUploadModal, setShowUploadModal] = useState<string | null>(null);
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      if (visitId && visitId.trim()) {
        query = query.eq('visit_id', visitId);
      } else if (visitId === "") {
        // For new visits (empty visitId), don't load any existing data
        setLabRequests([]);
        setLabResults({});
        setLoading(false);
        return;
      }

      const { data: requests, error: requestsError } = await query;
      if (requestsError) throw requestsError;
      
      setLabRequests(requests || []);

      // Fetch results for completed requests
      if (requests && requests.length > 0) {
        const completedRequests = requests.filter(r => r.status === 'completed');
        const resultsMap: { [key: string]: LabResult[] } = {};
        
        for (const request of completedRequests) {
          const { data: results, error: resultsError } = await supabase
            .from('lab_results')
            .select('*')
            .eq('lab_request_id', request.id)
            .order('test_name');
          
          if (resultsError) throw resultsError;
          resultsMap[request.id] = results || [];
        }
        
        setLabResults(resultsMap);
      }
    } catch (error) {
      console.error('Error fetching lab requests:', error);
      toast.error('Could not load lab requests and results. Check your connection and try again.');
    } finally {
      setLoading(false);
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

  const handleDeleteRequest = async (id: string) => {
    const request = labRequests.find(r => r.id === id);
    const lab = request?.lab_facility ? ` to ${request.lab_facility}` : '';
    const date = request ? ` from ${format(new Date(request.request_date), 'dd MMM yyyy')}` : '';
    const resultCount = labResults[id]?.length ?? 0;
    const withResults = resultCount > 0 ? ` and its ${resultCount} result${resultCount === 1 ? '' : 's'}` : '';
    if (!window.confirm(`Delete the lab request${lab}${date}${withResults}? This cannot be undone.`)) return;
    
    setDeletingId(id);
    try {
      const { error } = await supabase
        .from('lab_requests')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('Lab request deleted');
      await fetchLabRequests();
    } catch (error) {
      console.error('Error deleting lab request:', error);
      toast.error('Failed to delete lab request. Please try again.');
    } finally {
      setDeletingId(null);
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
        <h3 className="text-lg font-semibold text-gray-900">Lab Requests & Results</h3>
        {/* A disabled button shows no tooltip, so the wrapper carries the reason */}
        <span title={visitId === '' ? NEW_VISIT_HINT : undefined} className={visitId === '' ? 'cursor-not-allowed' : undefined}>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            disabled={visitId === ''}
            className={`flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 ${visitId === '' ? 'pointer-events-none' : ''}`}
          >
            <Plus className="w-4 h-4" />
            <span>New Lab Request</span>
          </button>
        </span>
      </div>

      {/* Lab Requests Table */}
      {labRequests.length === 0 ? (
        <div className="bg-gray-50 rounded-lg p-8 text-center">
          <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          {visitId === '' ? (
            <p className="text-gray-600">{NEW_VISIT_HINT}</p>
          ) : (
            <>
              <p className="text-gray-600">No lab requests yet</p>
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="mt-4 text-cyan-600 hover:text-cyan-700 font-medium"
              >
                Create first lab request
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Request Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Expected Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Laboratory
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {labRequests.map((request) => {
                const results = labResults[request.id] || [];
                const isExpanded = expandedRequests.has(request.id);

                return (
                  <React.Fragment key={request.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400" />
                          {format(new Date(request.request_date), 'dd MMM yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {request.preferred_date 
                          ? format(new Date(request.preferred_date), 'dd MMM yyyy')
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          {request.lab_facility && <Building2 className="w-4 h-4 text-gray-400" />}
                          {request.lab_facility || '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(request.status)}`}>
                          {getStatusIcon(request.status)}
                          {request.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          {request.status === 'pending' ? (
                            <>
                              <button
                                type="button"
                                onClick={() => setShowEnterResultsModal(request.id)}
                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                              >
                                <Edit3 className="w-4 h-4" />
                                Enter Results
                              </button>
                              <span className="text-gray-400">|</span>
                              <button
                                type="button"
                                onClick={() => setShowUploadModal(request.id)}
                                className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                                title="Upload the lab report; the results are read from it automatically"
                              >
                                <Upload className="w-4 h-4" />
                                Upload Report
                              </button>
                              <span className="text-gray-400">|</span>
                              <button
                                type="button"
                                onClick={() => setShowEditModal(request)}
                                className="text-gray-600 hover:text-gray-700 font-medium"
                                aria-label="Edit lab request"
                                title="Edit Request"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              {results.length > 0 && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(request.id)}
                                    className="text-cyan-600 hover:text-cyan-700 font-medium flex items-center gap-1"
                                  >
                                    <Eye className="w-4 h-4" />
                                    View Results ({results.length})
                                    {isExpanded ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </button>
                                  <span className="text-gray-400">|</span>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => setShowEditResultsModal(request.id)}
                                className="text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
                                title="Edit Results"
                              >
                                <Edit3 className="w-4 h-4" />
                                Edit Results
                              </button>
                              <span className="text-gray-400">|</span>
                              <button
                                type="button"
                                onClick={() => setShowUploadModal(request.id)}
                                className="text-purple-600 hover:text-purple-700 font-medium flex items-center gap-1"
                                title="Upload another lab report to add more results"
                              >
                                <Upload className="w-4 h-4" />
                                Upload Report
                              </button>
                            </>
                          )}
                          <span className="text-gray-400">|</span>
                          <button
                            type="button"
                            onClick={() => handleDeleteRequest(request.id)}
                            disabled={deletingId === request.id}
                            className="text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                            aria-label="Delete lab request"
                            title="Delete Request"
                          >
                            {deletingId === request.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Results Row */}
                    {isExpanded && results.length > 0 && (
                      <tr>
                        <td colSpan={5} className="px-0 py-0">
                          <div className="bg-gray-50 border-t border-gray-200">
                            <table className="w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                    Test Name
                                  </th>
                                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                    Result
                                  </th>
                                  <th className="px-6 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                    Reference Range
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {results.map((result) => {
                                  const status = getResultStatus(result.test_value, result.reference_range);
                                  return (
                                    <tr key={result.id} className="bg-white">
                                      <td className="px-6 py-3 text-sm text-gray-900">
                                        {result.test_name}
                                      </td>
                                      <td className={`px-6 py-3 text-sm ${getResultStatusColor(status)}`}>
                                        {result.test_value} {result.test_unit}
                                        {/* Spelled out as well as coloured, so an abnormal result is not missed */}
                                        {status !== 'normal' && (
                                          <span
                                            className={`ml-2 inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${status === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}
                                            title={`Outside the reference range ${result.reference_range ?? ''}`.trim()}
                                          >
                                            {status === 'high' ? 'High' : 'Low'}
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-6 py-3 text-sm text-gray-600">
                                        {result.reference_range || '-'}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            {/* Patient app: results are shown to the patient only after release */}
                            <LabResultReleaseButton requestId={request.id} results={results} onChanged={fetchLabRequests} />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Create Request Modal */}
      {showCreateModal && (
        <CreateLabRequest
          patientId={patientId}
          visitId={visitId}
          onClose={() => setShowCreateModal(false)}
          onRequestCreated={fetchLabRequests}
        />
      )}

      {/* Enter Results Modal */}
      {showEnterResultsModal && (
        <EnterLabResults
          requestId={showEnterResultsModal}
          onClose={() => setShowEnterResultsModal(null)}
          onResultsSaved={fetchLabRequests}
        />
      )}

      {/* Upload Document Modal */}
      {showUploadModal && (
        <UploadLabDocument
          requestId={showUploadModal}
          onClose={() => setShowUploadModal(null)}
          onExtractionComplete={fetchLabRequests}
        />
      )}

      {/* Edit Request Modal */}
      {showEditModal && (
        <EditLabRequest
          request={showEditModal}
          onClose={() => setShowEditModal(null)}
          onRequestUpdated={fetchLabRequests}
        />
      )}

      {/* Edit Results Modal */}
      {showEditResultsModal && (
        <EditLabResults
          requestId={showEditResultsModal}
          onClose={() => setShowEditResultsModal(null)}
          onResultsUpdated={fetchLabRequests}
        />
      )}
    </div>
  );
}