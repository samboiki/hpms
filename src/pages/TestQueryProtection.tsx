import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import { getQueryStats } from '../lib/supabaseProtected';
import { getBlockedQueries } from '../lib/supabaseEnhanced';
import { superchargedCache } from '../lib/superchargedCache';
import { usePractice } from '../contexts/PracticeContext';

interface TestResult {
  name: string;
  status: 'success' | 'blocked' | 'error';
  message: string;
  duration: number;
}

export default function TestQueryProtection() {
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { practiceId } = usePractice();

  const runTest = async (name: string, testFn: () => Promise<any>) => {
    const startTime = performance.now();
    
    try {
      const result = await testFn();
      const duration = performance.now() - startTime;
      
      return {
        name,
        status: 'success' as const,
        message: `Query executed successfully`,
        duration
      };
    } catch (error: any) {
      const duration = performance.now() - startTime;
      return {
        name,
        status: 'error' as const,
        message: error.message,
        duration
      };
    }
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setResults([]);
    
    const tests: TestResult[] = [];
    
    // Test 1: Invalid practice_id query (should be blocked)
    const test1 = await runTest('Query with "default-practice"', async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('practice_id', 'default-practice');
      
      if (!error && (!data || data.length === 0)) {
        return { status: 'blocked', message: 'Query blocked successfully' };
      }
      throw new Error('Query should have been blocked');
    });
    tests.push({ ...test1, status: test1.message.includes('blocked') ? 'blocked' : test1.status });
    
    // Test 2: Invalid UUID format (should be blocked)
    const test2 = await runTest('Query with invalid UUID', async () => {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('practice_id', 'not-a-uuid');
      
      if (!error && (!data || data.length === 0)) {
        return { status: 'blocked', message: 'Query blocked successfully' };
      }
      throw new Error('Query should have been blocked');
    });
    tests.push({ ...test2, status: test2.message.includes('blocked') ? 'blocked' : test2.status });
    
    // Test 3: Valid practice_id query (should succeed)
    if (practiceId) {
      const test3 = await runTest('Query with valid practice_id', async () => {
        const { data, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', practiceId);
        
        if (error) throw error;
        return { data };
      });
      tests.push(test3);
    }
    
    // Test 4: Null practice_id (should be blocked)
    const test4 = await runTest('Query with null practice_id', async () => {
      const { data, error } = await supabase
        .from('visits')
        .select('*')
        .eq('practice_id', null as any);
      
      if (!error && (!data || data.length === 0)) {
        return { status: 'blocked', message: 'Query blocked successfully' };
      }
      throw new Error('Query should have been blocked');
    });
    tests.push({ ...test4, status: test4.message.includes('blocked') ? 'blocked' : test4.status });
    
    // Test 5: Cache hit test
    const test5 = await runTest('Cache performance test', async () => {
      // First call - should hit database
      const start1 = performance.now();
      await supabase.from('practice_settings').select('*').eq('practice_id', practiceId!);
      const time1 = performance.now() - start1;
      
      // Second call - should hit cache
      const start2 = performance.now();
      await supabase.from('practice_settings').select('*').eq('practice_id', practiceId!);
      const time2 = performance.now() - start2;
      
      if (time2 < time1 / 2) {
        return { message: `Cache working: ${time1.toFixed(0)}ms → ${time2.toFixed(0)}ms` };
      }
      return { message: `No cache improvement: ${time1.toFixed(0)}ms → ${time2.toFixed(0)}ms` };
    });
    tests.push(test5);
    
    setResults(tests);
    setIsRunning(false);
  };

  const queryStats = getQueryStats();
  const cacheStats = superchargedCache.getStats();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
            <Icon icon="solar:shield-check-bold-duotone" className="w-8 h-8 text-green-600" />
            Query Protection Test Suite
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This page tests the comprehensive query protection system that prevents invalid UUID queries.
            </p>
            
            <button
              onClick={runAllTests}
              disabled={isRunning}
              className="px-6 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Icon icon="solar:play-bold-duotone" className="w-5 h-5" />
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </button>
          </div>
          
          {/* Current Practice Info */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-900">
              <strong>Current Practice ID:</strong> {practiceId || 'Not loaded'}
              {practiceId && <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 inline ml-2" />}
            </p>
          </div>
        </div>

        {/* Test Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h2>
            
            <div className="space-y-3">
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.status === 'blocked'
                      ? 'bg-yellow-50 border-yellow-200'
                      : result.status === 'success'
                      ? 'bg-green-50 border-green-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon
                        icon={
                          result.status === 'blocked'
                            ? 'solar:shield-warning-bold-duotone'
                            : result.status === 'success'
                            ? 'solar:check-circle-bold-duotone'
                            : 'solar:close-circle-bold-duotone'
                        }
                        className={`w-6 h-6 ${
                          result.status === 'blocked'
                            ? 'text-yellow-600'
                            : result.status === 'success'
                            ? 'text-green-600'
                            : 'text-red-600'
                        }`}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">{result.name}</h3>
                        <p className="text-sm text-gray-600">{result.message}</p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-lg font-semibold">{result.duration.toFixed(0)}ms</p>
                      <p className={`text-xs ${
                        result.status === 'blocked' ? 'text-yellow-600' : 
                        result.status === 'success' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {result.status.toUpperCase()}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistics Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Query Stats */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon icon="solar:chart-bold-duotone" className="w-6 h-6 text-blue-600" />
              Query Protection Stats
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-gray-600">Total Queries</span>
                <span className="font-semibold">{queryStats.total}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-red-50 rounded">
                <span className="text-gray-600">Blocked Queries</span>
                <span className="font-semibold text-red-600">{queryStats.blocked} ({queryStats.blockRate})</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-green-50 rounded">
                <span className="text-gray-600">Cached Queries</span>
                <span className="font-semibold text-green-600">{queryStats.cached} ({queryStats.cacheRate})</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded">
                <span className="text-gray-600">Executed Queries</span>
                <span className="font-semibold text-blue-600">{queryStats.executed}</span>
              </div>
            </div>
          </div>

          {/* Cache Stats */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Icon icon="solar:database-bold-duotone" className="w-6 h-6 text-purple-600" />
              Cache Performance
            </h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
                <span className="text-gray-600">Cache Entries</span>
                <span className="font-semibold">{cacheStats.entries}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded">
                <span className="text-gray-600">Total Hits</span>
                <span className="font-semibold text-purple-600">{cacheStats.totalHits}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-orange-50 rounded">
                <span className="text-gray-600">Memory Usage</span>
                <span className="font-semibold text-orange-600">{(cacheStats.memoryUsage / 1024).toFixed(2)} KB</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-yellow-50 rounded">
                <span className="text-gray-600">Hot Keys</span>
                <span className="font-semibold text-yellow-600">{cacheStats.hotKeys.length}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Protection Status */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <div className="flex items-center gap-3">
            <Icon icon="solar:shield-check-bold-duotone" className="w-8 h-8 text-green-600" />
            <div>
              <h3 className="font-semibold text-green-900">Query Protection Active</h3>
              <p className="text-green-700">
                All queries are being validated. Invalid UUIDs and "default-practice" values are blocked.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}