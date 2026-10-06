import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';
import { findIncompleteResultRow } from './labResultRows';

interface EnterLabResultsProps {
  requestId: string;
  onClose: () => void;
  onResultsSaved: () => void;
}

interface TestResult {
  id: string;
  testName: string;
  testValue: string;
  testUnit: string;
  referenceRange: string;
}

export default function EnterLabResults({ 
  requestId, 
  onClose, 
  onResultsSaved 
}: EnterLabResultsProps) {
  const [results, setResults] = useState<TestResult[]>([
    { id: '1', testName: '', testValue: '', testUnit: '', referenceRange: '' }
  ]);
  const [isSaving, setIsSaving] = useState(false);

  const addResult = () => {
    setResults([...results, {
      id: Date.now().toString(),
      testName: '',
      testValue: '',
      testUnit: '',
      referenceRange: ''
    }]);
  };

  const removeResult = (id: string) => {
    if (results.length > 1) {
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
      name: r.testName,
      value: r.testValue,
      unit: r.testUnit,
      range: r.referenceRange
    })));
    if (incomplete !== -1) {
      toast.error(`Test ${incomplete + 1} needs both a test name and a value.`);
      return;
    }

    // Validate at least one complete result
    const validResults = results.filter(r => r.testName.trim() && r.testValue.trim());
    if (validResults.length === 0) {
      toast.error('Please enter at least one test name and value');
      return;
    }

    setIsSaving(true);
    try {
      // Insert all test results
      const testResults = validResults.map(result => ({
        lab_request_id: requestId,
        test_name: result.testName,
        test_value: result.testValue,
        test_unit: result.testUnit || null,
        reference_range: result.referenceRange || null
      }));

      const { error: resultsError } = await supabase
        .from('lab_results')
        .insert(testResults);

      if (resultsError) throw resultsError;

      // Update request status to completed
      const { error: updateError } = await supabase
        .from('lab_requests')
        .update({ status: 'completed' })
        .eq('id', requestId);

      if (updateError) throw updateError;

      onResultsSaved();
      onClose();
    } catch (error) {
      console.error('Error saving results:', error);
      toast.error('Failed to save results. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}>
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-2xl font-bold text-gray-900">Enter Lab Results</h2>
          <p className="text-gray-600 mt-1">Enter test results manually</p>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={result.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-gray-700">Test {index + 1}</h4>
                  {results.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeResult(result.id)}
                      className="text-red-600 hover:text-red-700"
                      aria-label={`Remove test ${index + 1}`}
                      title="Remove this test"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Test Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={result.testName}
                      onChange={(e) => updateResult(result.id, 'testName', e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                        }
                      }}
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
                      value={result.testValue}
                      onChange={(e) => updateResult(result.id, 'testValue', e.target.value)}
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
                      value={result.testUnit}
                      onChange={(e) => updateResult(result.id, 'testUnit', e.target.value)}
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
                      value={result.referenceRange}
                      onChange={(e) => updateResult(result.id, 'referenceRange', e.target.value)}
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
                <span>Save Results</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}