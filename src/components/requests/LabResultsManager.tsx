import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  TestTube, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  Search,
  Calendar,
  Save,
  X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface LabResult {
  id: string;
  visit_id: string;
  name: string;
  value: string;
  unit: string;
  reference_range: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  date: string;
  created_at: string;
}

interface LabResultsManagerProps {
  visitId: string;
  labRequestId?: string; // Optional - to link results to a specific request
  onResultsChange?: (results: LabResult[]) => void;
}

const LabResultsManager: React.FC<LabResultsManagerProps> = ({
  visitId,
  labRequestId,
  onResultsChange
}) => {
  const [results, setResults] = useState<LabResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingResult, setEditingResult] = useState<LabResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    value: '',
    unit: '',
    reference_range: '',
    status: 'normal' as const,
    date: new Date().toISOString().split('T')[0]
  });

  // Fetch lab results for this visit
  useEffect(() => {
    fetchLabResults();
  }, [visitId]);

  const fetchLabResults = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('lab_results')
        .select('*')
        .eq('visit_id', visitId)
        .order('date', { ascending: false });

      if (error) {
        console.error('Error fetching lab results:', error);
        return;
      }

      setResults(data || []);
      onResultsChange?.(data || []);
    } catch (error) {
      console.error('Error in fetchLabResults:', error);
    } finally {
      setLoading(false);
    }
  };

  // Link results to a lab request if specified
  const linkResultsToRequest = async (resultIds: string[]) => {
    if (!labRequestId) return;

    try {
      const { error } = await supabase
        .from('lab_requests')
        .update({ 
          result_text_ids: resultIds,
          status: 'completed',
          completed_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', labRequestId);

      if (error) {
        console.error('Error linking results to request:', error);
      }
    } catch (error) {
      console.error('Error in linkResultsToRequest:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim() || !formData.value.trim()) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      const resultData = {
        ...formData,
        visit_id: visitId
      };

      let result;
      if (editingResult) {
        // Update existing result
        result = await supabase
          .from('lab_results')
          .update(resultData)
          .eq('id', editingResult.id)
          .select()
          .single();
      } else {
        // Create new result
        result = await supabase
          .from('lab_results')
          .insert([resultData])
          .select()
          .single();
      }

      if (result.error) {
        console.error('Error saving lab result:', result.error);
        throw new Error(result.error.message);
      }

      console.log('✅ Lab result saved successfully');
      
      // Refresh results
      await fetchLabResults();
      
      // Link to request if needed
      if (labRequestId && !editingResult) {
        const currentResults = await supabase
          .from('lab_results')
          .select('id')
          .eq('visit_id', visitId);
        
        if (currentResults.data) {
          await linkResultsToRequest(currentResults.data.map(r => r.id));
        }
      }
      
      // Reset form
      setFormData({
        name: '',
        value: '',
        unit: '',
        reference_range: '',
        status: 'normal',
        date: new Date().toISOString().split('T')[0]
      });
      setEditingResult(null);
      setShowForm(false);
      
    } catch (error) {
      console.error('💥 Error saving lab result:', error);
      alert(`Failed to save lab result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleEdit = (result: LabResult) => {
    setFormData({
      name: result.name,
      value: result.value,
      unit: result.unit || '',
      reference_range: result.reference_range || '',
      status: result.status,
      date: result.date
    });
    setEditingResult(result);
    setShowForm(true);
  };

  const handleDelete = async (resultId: string) => {
    if (!confirm('Are you sure you want to delete this lab result?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('lab_results')
        .delete()
        .eq('id', resultId);

      if (error) {
        console.error('Error deleting lab result:', error);
        throw new Error(error.message);
      }

      console.log('✅ Lab result deleted successfully');
      await fetchLabResults();
      
    } catch (error) {
      console.error('💥 Error deleting lab result:', error);
      alert(`Failed to delete lab result: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'normal': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'high': return <TrendingUp className="w-4 h-4 text-red-500" />;
      case 'low': return <TrendingDown className="w-4 h-4 text-blue-500" />;
      case 'critical': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <CheckCircle2 className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'normal': return 'bg-green-100 text-green-800';
      case 'high': return 'bg-red-100 text-red-800';
      case 'low': return 'bg-blue-100 text-blue-800';
      case 'critical': return 'bg-red-200 text-red-900 font-semibold';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredResults = results.filter(result =>
    result.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    result.value.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <TestTube className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Lab Results</h3>
            <p className="text-sm text-gray-600">Text-based laboratory test results</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            console.log('🔘 Lab Results Manager - Add Result button clicked');
            setShowForm(true);
            setEditingResult(null);
            setFormData({
              name: '',
              value: '',
              unit: '',
              reference_range: '',
              status: 'normal',
              date: new Date().toISOString().split('T')[0]
            });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Result
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          type="text"
          placeholder="Search lab results..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>

      {/* Results List */}
      {filteredResults.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <TestTube className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No lab results yet</h4>
          <p className="text-gray-500">Add text-based lab results to track patient health metrics</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Test Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Value</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Reference Range</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredResults.map((result) => (
                <tr key={result.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{result.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{result.value}</span>
                      {result.unit && <span className="text-gray-500 text-sm">{result.unit}</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-gray-600 text-sm">{result.reference_range || 'N/A'}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(result.status)}
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(result.status)}`}>
                        {result.status.charAt(0).toUpperCase() + result.status.slice(1)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="w-3 h-3" />
                      {new Date(result.date).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleEdit(result);
                        }}
                        className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleDelete(result.id);
                        }}
                        className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
            onClick={(e) => {
              if (e.target === e.currentTarget) {
                setShowForm(false);
              }
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg p-6 w-full max-w-md mx-4"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  {editingResult ? 'Edit Lab Result' : 'Add Lab Result'}
                </h3>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setShowForm(false);
                  }}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit(e);
              }} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Test Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., Hemoglobin"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Value *
                    </label>
                    <input
                      type="text"
                      value={formData.value}
                      onChange={(e) => setFormData(prev => ({ ...prev, value: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g., 12.5"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={formData.unit}
                      onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                      placeholder="e.g., g/dL"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference Range
                  </label>
                  <input
                    type="text"
                    value={formData.reference_range}
                    onChange={(e) => setFormData(prev => ({ ...prev, reference_range: e.target.value }))}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    placeholder="e.g., 12.0-15.5 g/dL"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Status
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as any }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    >
                      <option value="normal">Normal</option>
                      <option value="high">High</option>
                      <option value="low">Low</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Date
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      console.log('🔘 Lab Results Manager - Cancel button clicked');
                      setShowForm(false);
                    }}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Save className="w-4 h-4" />
                    {editingResult ? 'Update' : 'Add'} Result
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LabResultsManager;