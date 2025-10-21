import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

interface PracticeSearchFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onAddPractice: () => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  practiceTypeFilter: string;
  onPracticeTypeChange: (type: string) => void;
  filteredPractices: any[];
  viewMode: 'list' | 'grid';
  onViewModeChange: (mode: 'list' | 'grid') => void;
  onExportCSV?: () => void;
  onExportExcel?: () => void;
}

export const PracticeSearchFilters: React.FC<PracticeSearchFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  onAddPractice,
  statusFilter,
  onStatusChange,
  practiceTypeFilter,
  onPracticeTypeChange,
  filteredPractices,
  viewMode,
  onViewModeChange,
  onExportCSV,
  onExportExcel,
}) => {
  const statuses = [
    { id: '', label: 'All', icon: null },
    { id: 'lead', label: 'Lead', icon: 'solar:star-bold-duotone', color: 'text-gray-600' },
    { id: 'contacted', label: 'Contacted', icon: 'solar:phone-calling-bold-duotone', color: 'text-blue-600' },
    { id: 'qualified', label: 'Qualified', icon: 'solar:verified-check-bold-duotone', color: 'text-purple-600' },
    { id: 'onboarding', label: 'Onboarding', icon: 'solar:clipboard-list-bold-duotone', color: 'text-yellow-600' },
    { id: 'active', label: 'Active', icon: 'solar:shield-check-bold-duotone', color: 'text-green-600' },
    { id: 'inactive', label: 'Inactive', icon: 'solar:close-circle-bold-duotone', color: 'text-red-600' },
  ];

  const types = [
    { id: '', label: 'All Types' },
    { id: 'general_practice', label: 'General Practice' },
    { id: 'dental_practice', label: 'Dental' },
    { id: 'veterinary_clinic', label: 'Veterinary' },
    { id: 'specialist_clinic', label: 'Specialist' },
    { id: 'hospital', label: 'Hospital' },
    { id: 'pharmacy', label: 'Pharmacy' },
  ];

  return (
    <div className="p-4 sm:p-6">
      {/* Top Action Bar */}
      <div className="flex justify-end mb-4">
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="hidden lg:flex items-center bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => onViewModeChange('list')}
              className={`p-2 rounded-md transition-all duration-200 ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="List View"
            >
              <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
            </button>
            <button
              onClick={() => onViewModeChange('grid')}
              className={`p-2 rounded-md transition-all duration-200 ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                  : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
              }`}
              title="Grid View"
            >
              <Icon icon="solar:widget-4-bold-duotone" className="w-5 h-5" />
            </button>
          </div>

          {/* Export Buttons */}
          {onExportCSV && (
            <button
              onClick={onExportCSV}
              className="p-3 rounded-xl transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Export to CSV"
            >
              <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />
            </button>
          )}

          {onExportExcel && (
            <button
              onClick={onExportExcel}
              className="p-3 rounded-xl transition-all text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Export to Excel"
            >
              <Icon icon="solar:file-excel-bold-duotone" className="w-5 h-5" />
            </button>
          )}

          {/* Add Practice Button */}
          <button
            onClick={onAddPractice}
            className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
          >
            <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
            <span className="hidden sm:inline">Register Practice</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </div>

      {/* Filter Pills and Search */}
      <div className="flex flex-col gap-4">
        {/* Filter Pills Row */}
        <div className="hidden lg:flex flex-wrap items-center gap-2">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {statuses.map((status) => (
              <button
                key={status.id}
                onClick={() => onStatusChange(status.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  statusFilter === status.id
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {status.icon && (
                  <Icon icon={status.icon} className={`w-4 h-4 ${statusFilter === status.id ? status.color : ''}`} />
                )}
                {status.label}
              </button>
            ))}
          </div>

          {/* Practice Type Filter Pills */}
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {types.slice(0, 4).map((type) => (
              <button
                key={type.id}
                onClick={() => onPracticeTypeChange(type.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  practiceTypeFilter === type.id
                    ? 'bg-white dark:bg-gray-600 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>

          {/* Results Count */}
          <div className="ml-auto flex items-center gap-4 text-sm">
            <div className="text-gray-500 dark:text-gray-400">
              <span className="font-semibold text-gray-900 dark:text-white">{filteredPractices.length}</span> results
            </div>
          </div>
        </div>

        {/* Search Bar */}
        <div className="mt-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
              <div className="relative bg-gray-200 dark:bg-gray-700 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100 dark:group-hover:bg-gray-600">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon
                    icon="solar:magnifer-bold-duotone"
                    className="w-5 h-5 transition-colors duration-300 text-gray-600 dark:text-gray-300 group-hover:text-gray-700 dark:group-hover:text-gray-200"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Search by practice name, email, city, or country..."
                  className="relative w-full pl-12 pr-4 py-3.5 bg-transparent text-base text-gray-800 dark:text-white placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-500 dark:focus:placeholder-gray-500 transition-colors duration-300"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {/* Shimmer effect */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent pointer-events-none"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Filters */}
        <div className="lg:hidden space-y-3">
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-sm text-gray-800 dark:text-white"
          >
            <option value="">All Statuses</option>
            {statuses.slice(1).map((status) => (
              <option key={status.id} value={status.id}>
                {status.label}
              </option>
            ))}
          </select>

          <select
            value={practiceTypeFilter}
            onChange={(e) => onPracticeTypeChange(e.target.value)}
            className="w-full px-4 py-2.5 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all text-sm text-gray-800 dark:text-white"
          >
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>

          <div className="text-sm text-gray-500 dark:text-gray-400 text-center">
            <span className="font-semibold text-gray-900 dark:text-white">{filteredPractices.length}</span> results
          </div>
        </div>
      </div>
    </div>
  );
};
