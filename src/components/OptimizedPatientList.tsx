import React, { useRef, useEffect, useCallback } from 'react';
import { useOptimizedPatientsStore } from '../stores/optimizedPatientsStore';
import { usePractice } from '../contexts/PracticeContext';
import { useVirtualScroll } from '../hooks/useOptimizedData';
import { Icon } from '@iconify/react';
import { debounce } from 'lodash';

export const OptimizedPatientList: React.FC = () => {
  const { practiceId } = usePractice();
  const containerRef = useRef<HTMLDivElement>(null);
  
  const {
    filteredPatients,
    isLoading,
    error,
    searchTerm,
    sortBy,
    sortOrder,
    lastFetchTime,
    cacheHitRate,
    fetchPatients,
    searchPatients,
    sortPatients,
    selectPatient,
    updateVisibleRange
  } = useOptimizedPatientsStore();
  
  // Virtual scrolling
  const { visibleItems, offsetY, totalHeight } = useVirtualScroll(
    filteredPatients,
    60, // item height
    containerRef
  );
  
  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term: string) => searchPatients(term), 300),
    []
  );
  
  // Initial load
  useEffect(() => {
    if (practiceId) {
      fetchPatients(practiceId);
    }
  }, [practiceId]);
  
  // Update visible range for prefetching
  useEffect(() => {
    const startIndex = Math.floor(offsetY / 60);
    const endIndex = startIndex + visibleItems.length;
    updateVisibleRange(startIndex, endIndex);
  }, [offsetY, visibleItems.length]);
  
  if (error) {
    return (
      <div className="p-6 text-center">
        <Icon icon="solar:danger-bold-duotone" className="w-12 h-12 text-red-500 mx-auto mb-2" />
        <p className="text-red-600">{error}</p>
        <button 
          onClick={() => practiceId && fetchPatients(practiceId)}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700"
        >
          Retry
        </button>
      </div>
    );
  }
  
  return (
    <div className="h-full flex flex-col">
      {/* Performance Metrics Bar */}
      <div className="bg-gray-50 px-4 py-2 text-xs text-gray-600 flex items-center gap-4">
        <span className="flex items-center gap-1">
          <Icon icon="solar:speedometer-bold-duotone" className="w-4 h-4" />
          Load time: {lastFetchTime.toFixed(0)}ms
        </span>
        <span className="flex items-center gap-1">
          <Icon icon="solar:database-bold-duotone" className="w-4 h-4" />
          Cache hit rate: {(cacheHitRate * 100).toFixed(0)}%
        </span>
        <span className="flex items-center gap-1">
          <Icon icon="solar:users-group-rounded-bold-duotone" className="w-4 h-4" />
          {filteredPatients.length} patients
        </span>
        {lastFetchTime < 200 && (
          <span className="text-green-600 flex items-center gap-1">
            <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4" />
            Optimal performance
          </span>
        )}
      </div>
      
      {/* Search and Sort Bar */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Icon 
              icon="solar:magnifer-bold-duotone" 
              className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Search patients..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              onChange={(e) => debouncedSearch(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Sort by:</span>
            <button
              onClick={() => sortPatients('name')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortBy === 'name' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Name
              {sortBy === 'name' && (
                <Icon 
                  icon={sortOrder === 'asc' ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} 
                  className="w-3 h-3 inline-block ml-1"
                />
              )}
            </button>
            <button
              onClick={() => sortPatients('lastVisit')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortBy === 'lastVisit' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Last Visit
              {sortBy === 'lastVisit' && (
                <Icon 
                  icon={sortOrder === 'asc' ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} 
                  className="w-3 h-3 inline-block ml-1"
                />
              )}
            </button>
            <button
              onClick={() => sortPatients('visitCount')}
              className={`px-3 py-1 text-sm rounded-md transition-colors ${
                sortBy === 'visitCount' 
                  ? 'bg-primary-100 text-primary-700' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Visits
              {sortBy === 'visitCount' && (
                <Icon 
                  icon={sortOrder === 'asc' ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} 
                  className="w-3 h-3 inline-block ml-1"
                />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {/* Virtual Scrolling Container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto"
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon icon="solar:hourglass-line-duotone" className="w-12 h-12 text-primary-600 animate-pulse mx-auto mb-2" />
              <p className="text-gray-600">Loading patients...</p>
            </div>
          </div>
        ) : (
          <div 
            style={{ height: totalHeight, position: 'relative' }}
          >
            <div 
              style={{ 
                transform: `translateY(${offsetY}px)`,
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0
              }}
            >
              {visibleItems.map((patient) => (
                <div
                  key={patient.id}
                  onClick={() => selectPatient(patient)}
                  className="h-[60px] px-4 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors flex items-center"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <Icon 
                        icon="solar:user-circle-bold-duotone" 
                        className="w-10 h-10 text-primary-600 flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <h3 className="font-medium text-gray-900 truncate">
                          {patient.first_name} {patient.last_name}
                        </h3>
                        <div className="text-sm text-gray-500 flex items-center gap-2">
                          {patient.cell_number && (
                            <span className="flex items-center gap-1">
                              <Icon icon="solar:phone-bold-duotone" className="w-3 h-3" />
                              {patient.cell_number}
                            </span>
                          )}
                          {patient.email && (
                            <span className="truncate flex items-center gap-1">
                              <Icon icon="solar:letter-bold-duotone" className="w-3 h-3" />
                              {patient.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    {patient.visitCount !== undefined && (
                      <div className="flex items-center gap-1">
                        <Icon icon="solar:clipboard-heart-bold-duotone" className="w-4 h-4" />
                        <span>{patient.visitCount} visits</span>
                      </div>
                    )}
                    {patient.lastVisitDate && (
                      <div className="flex items-center gap-1">
                        <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                        <span>{new Date(patient.lastVisitDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {patient.medical_aid_details && patient.medical_aid_details.length > 0 && (
                      <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4 text-green-600" />
                    )}
                  </div>
                  
                  <Icon 
                    icon="solar:alt-arrow-right-bold-duotone" 
                    className="w-5 h-5 text-gray-400 ml-2"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};