import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { getCachedPatients, getCachedPracticeOverview, getCachedAutomationQueue } from '../lib/cachedQueries';
import { superchargedCache } from '../lib/superchargedCache';

export default function TestCache() {
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const runTest = async (testName: string, testFn: () => Promise<any>) => {
    setIsLoading(true);
    const startTime = performance.now();
    
    try {
      const data = await testFn();
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      const result = {
        name: testName,
        duration: duration.toFixed(2),
        success: true,
        dataSize: Array.isArray(data) ? data.length : Object.keys(data).length,
        timestamp: new Date().toLocaleTimeString()
      };
      
      setResults(prev => [...prev, result]);
      
      if (duration < 200) {
        console.log(`✅ ${testName}: OPTIMAL PERFORMANCE (${duration.toFixed(2)}ms)`);
      } else {
        console.warn(`⚠️ ${testName}: SLOW (${duration.toFixed(2)}ms)`);
      }
    } catch (error) {
      const endTime = performance.now();
      setResults(prev => [...prev, {
        name: testName,
        duration: (endTime - startTime).toFixed(2),
        success: false,
        error: error.message,
        timestamp: new Date().toLocaleTimeString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    setResults([]);
    
    // Test 1: Get cached patients
    await runTest('Get Cached Patients', getCachedPatients);
    
    // Test 2: Get practice overview
    await runTest('Get Practice Overview', getCachedPracticeOverview);
    
    // Test 3: Get automation queue
    await runTest('Get Automation Queue', getCachedAutomationQueue);
    
    // Test 4: Second patient fetch (should be cached)
    await runTest('Get Cached Patients (2nd call)', getCachedPatients);
    
    // Show cache stats
    const stats = superchargedCache.getStats();
    console.log('📊 Final Cache Stats:', stats);
  };

  const clearCache = () => {
    superchargedCache.invalidate('');
    setResults([]);
    console.log('🗑️ Cache cleared');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Icon icon="solar:bolt-bold-duotone" className="w-8 h-8 text-primary-600" />
            Supercharged Cache Test
          </h1>
          
          <div className="mb-6 flex gap-4">
            <button
              onClick={runAllTests}
              disabled={isLoading}
              className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Icon icon="solar:play-bold-duotone" className="w-5 h-5" />
              Run Performance Tests
            </button>
            
            <button
              onClick={clearCache}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 flex items-center gap-2"
            >
              <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5" />
              Clear Cache
            </button>
          </div>
          
          {results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Test Results:</h2>
              
              {results.map((result, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${
                    result.success
                      ? result.duration < 200
                        ? 'bg-green-50 border-green-200'
                        : 'bg-yellow-50 border-yellow-200'
                      : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Icon
                        icon={
                          result.success
                            ? result.duration < 200
                              ? 'solar:check-circle-bold-duotone'
                              : 'solar:danger-triangle-bold-duotone'
                            : 'solar:close-circle-bold-duotone'
                        }
                        className={`w-6 h-6 ${
                          result.success
                            ? result.duration < 200
                              ? 'text-green-600'
                              : 'text-yellow-600'
                            : 'text-red-600'
                        }`}
                      />
                      <div>
                        <h3 className="font-medium text-gray-900">{result.name}</h3>
                        {result.success && (
                          <p className="text-sm text-gray-600">
                            {result.dataSize} items loaded
                          </p>
                        )}
                        {result.error && (
                          <p className="text-sm text-red-600">{result.error}</p>
                        )}
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <p className="text-2xl font-bold">
                        {result.duration}ms
                      </p>
                      <p className="text-xs text-gray-500">{result.timestamp}</p>
                    </div>
                  </div>
                  
                  {result.success && (
                    <div className="mt-2">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full ${
                            result.duration < 200
                              ? 'bg-green-600'
                              : result.duration < 1000
                              ? 'bg-yellow-600'
                              : 'bg-red-600'
                          }`}
                          style={{
                            width: `${Math.min(100, (200 / result.duration) * 100)}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5" />
                  Cache Statistics
                </h3>
                <button
                  onClick={() => {
                    const stats = superchargedCache.getStats();
                    console.log('📊 Current Cache Stats:', stats);
                    alert(`Cache Stats:\n- Entries: ${stats.entries}\n- Total Hits: ${stats.totalHits}\n- Memory Usage: ${(stats.memoryUsage / 1024).toFixed(2)}KB\n- Hot Keys: ${stats.hotKeys.join(', ') || 'None'}`);
                  }}
                  className="text-sm text-blue-700 hover:text-blue-900 underline"
                >
                  View Detailed Stats
                </button>
              </div>
            </div>
          )}
          
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Icon icon="solar:hourglass-line-duotone" className="w-8 h-8 text-primary-600 animate-pulse" />
              <span className="ml-2 text-gray-600">Running test...</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}