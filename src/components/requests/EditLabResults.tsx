import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Loader2, Save, Edit3 } from 'lucide-react';
import toast from 'react-hot-toast';
import { findIncompleteResultRow } from './labResultRows';

interface EditLabResultsProps {
  requestId: string;
  onClose: () => void;
  onResultsUpdated: () => void;
}

interface TestResult {
  id: string;
  test_name: string;
  test_value: string;
  test_unit: string | null;
  reference_range: string | null;
  isNew?: boolean;
}

export default function EditLabResults({ 
  requestId, 
  onClose, 
  onResultsUpdated 
}: EditLabResultsProps) {
  const [results, setResults] = useState<TestResult[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [deletedNames, setDeletedNames] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExistingResults();
  }, [requestId]);

  const fetchExistingResults = async () => {
    try {
      const { data, error } = await supabase
        .from('lab_results')
        .select('*')
        .eq('lab_request_id', requestId)
        .order('test_name');

      if (error) throw error;

      if (data) {
        setResults(data.map(result => ({
          id: result.id,
          test_name: result.test_name,
          test_value: result.test_value || '',
          test_unit: result.test_unit || '',
          reference_range: result.reference_range || ''
        })));
      }
    } catch (error) {
      console.error('Error fetching lab results:', error);
      toast.error('Could not load the saved results. Close this window and try again.');
    } finally {
      setLoading(false);
    }
  };

  const addResult = () => {
    setResults([...results, {
      id: `new-${Date.now()}`,
      test_name: '',
      test_value: '',
      test_unit: '',
      reference_range: '',
      isNew: true
    }]);
  };

  const removeResult = (id: string) => {
    if (id.startsWith('new-')) {
      // Just remove from list if it's a new result
      setResults(results.filter(r => r.id !== id));
    } else {
      // Mark for deletion if it's an existing result
      setDeletedIds([...deletedIds, id]);
      setDeletedNames([...deletedNames, results.find(r => r.id === id)?.test_name || 'an unnamed test']);
      setResults(results.filter(r => r.id !== id));
    }
  };

  const updateResult = (id: string, field: keyof TestResult, value: string) => {
    setResults(results.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    ));
  };

  const handleSave = async () => {
    const incomplete = findIncompleteResultRow(results.map(r => ({
      name: r.test_name,
      value: r.test_value,
      unit: r.test_unit,
      range: r.reference_range,
      saved: !r.isNew
    })));
    if (incomplete !== -1) {
      toast.error(`Test ${incomplete + 1} needs both a test name and a value. Use the bin icon to remove a test.`);
      return;
    }

    // Removed tests are only deleted here, so confirm before they are gone for good
    if (deletedIds.length > 0 && !window.confirm(`Delete ${deletedNames.join(', ')} from this lab request? This cannot be undone.`)) {
      return;
    }

    setIsSaving(true);
    try {
      // Delete removed results
      if (deletedIds.length > 0) {
        const { error: deleteError } = await supabase
          .from('lab_results')
          .delete()
          .in('id', deletedIds);

        if (deleteError) throw deleteError;
      }

      // Separate new and existing results
      const newResults = results.filter(r => r.isNew && r.test_name && r.test_value);
      const existingResults = results.filter(r => !r.isNew && r.test_name && r.test_value);

      // Insert new results
      if (newResults.length > 0) {
        const { error: insertError } = await supabase
          .from('lab_results')
          .insert(
            newResults.map(result => ({
              lab_request_id: requestId,
              test_name: result.test_name,
              test_value: result.test_value,
              test_unit: result.test_unit || null,
              reference_range: result.reference_range || null
            }))
          );

        if (insertError) throw insertError;
      }

      // Update existing results
      for (const result of existingResults) {
        const { error: updateError } = await supabase
          .from('lab_results')
          .update({
            test_name: result.test_name,
            test_value: result.test_value,
            test_unit: result.test_unit || null,
            reference_range: result.reference_range || null
          })
          .eq('id', result.id);

        if (updateError) throw updateError;
      }

      // Make sure the request is marked as completed if it has results
      if (results.filter(r => r.test_name && r.test_value).length > 0) {
        const { error: statusError } = await supabase
          .from('lab_requests')
          .update({ status: 'completed' })
          .eq('id', requestId);

        if (statusError) throw statusError;
      }

      onResultsUpdated();
      onClose();
    } catch (error) {
      console.error('Error saving results:', error);
      toast.error('Failed to save results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Edit Lab Results</h2>
          <p className="text-gray-600 mt-1">Modify existing results or add new tests</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={result.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">
                    Test {index + 1}
                    {result.isNew && <span className="ml-2 text-xs text-green-600">(New)</span>}
                  </h4>
                  <button
                    type="button"
                    onClick={() => removeResult(result.id)}
                    className="text-red-600 hover:text-red-700"
                    aria-label={`Remove test ${index + 1}`}
                    title="Remove this test"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Test Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={result.test_name}
                      onChange={(e) => updateResult(result.id, 'test_name', e.target.value)}
                      placeholder="e.g., Glucose"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Value <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={result.test_value}
                      onChange={(e) => updateResult(result.id, 'test_value', e.target.value)}
                      placeholder="e.g., 5.4"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Unit
                    </label>
                    <input
                      type="text"
                      value={result.test_unit || ''}
                      onChange={(e) => updateResult(result.id, 'test_unit', e.target.value)}
                      placeholder="e.g., mmol/L"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Reference Range
                    </label>
                    <input
                      type="text"
                      value={result.reference_range || ''}
                      onChange={(e) => updateResult(result.id, 'reference_range', e.target.value)}
                      placeholder="e.g., 3.9-5.6"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <button
            type="button"
            onClick={addResult}
            className="mt-4 flex items-center gap-2 px-4 py-2 text-cyan-600 hover:bg-cyan-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Another Test</span>
          </button>
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                <span>Save Changes</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}