import React from 'react';
import { motion } from 'framer-motion';
import {
  Search,
  Plus,
  Bot,
  Loader2,
  MessageSquare,
  Send,
  FileDown,
  List,
  LayoutGrid,
  X,
  Users
} from 'lucide-react';

// Universal Gender Icons
const FemaleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="12" cy="8" r="4" />
    <path d="M12 14v6m-3-3h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

const MaleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="10" cy="10" r="4" />
    <path d="M16 4l4 4m0-4l-4 4m-2-2l-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

interface FilterOption {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

interface SearchAndFiltersSectionProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  selectedFilter: string;
  setSelectedFilter: (filter: string) => void;
  view: 'grid' | 'list';
  setView: (view: 'grid' | 'list') => void;
  patients: any[];
  filteredPatients: any[];
  selectedPatientIds: Set<string>;
  isAiSearching: boolean;
  isSendingBulkSms: boolean;
  isSendingBulkEmail: boolean;
  isExporting: boolean;
  aiFilters: any;
  currentTheme: any;
  onAiSearch: (term: string) => void;
  onClearAiFilters: () => void;
  onAddPatient: () => void;
  onOpenMessageModal: () => void;
  onOpenEmailModal: () => void;
  onExportPatients: () => void;
}

const SearchAndFiltersSection: React.FC<SearchAndFiltersSectionProps> = ({
  searchTerm,
  setSearchTerm,
  selectedFilter,
  setSelectedFilter,
  view,
  setView,
  patients,
  filteredPatients,
  selectedPatientIds,
  isAiSearching,
  isSendingBulkSms,
  isSendingBulkEmail,
  isExporting,
  aiFilters,
  currentTheme,
  onAiSearch,
  onClearAiFilters,
  onAddPatient,
  onOpenMessageModal,
  onOpenEmailModal,
  onExportPatients
}) => {
  // Filter options
  const filterOptions: FilterOption[] = [
    { id: 'all', label: 'All Patients', icon: Users, count: patients.length },
    { id: 'female', label: 'Female', icon: FemaleIcon, count: patients.filter(p => p.gender?.toLowerCase() === 'female').length },
    { id: 'male', label: 'Male', icon: MaleIcon, count: patients.filter(p => p.gender?.toLowerCase() === 'male').length }
  ];

  return (
    <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-6 mb-6">
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Search Bar */}
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="AI Search: Ask anything about patients (e.g., 'patients with diabetes over 40')..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                if (aiFilters) {
                  onClearAiFilters();
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchTerm.trim()) {
                  onAiSearch(searchTerm);
                }
              }}
              className="w-full pl-10 pr-16 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all"
            />
            
            {/* AI Search Button */}
            <button
              onClick={() => onAiSearch(searchTerm)}
              disabled={isAiSearching || !searchTerm.trim()}
              className={`absolute right-3 top-1/2 transform -translate-y-1/2 p-1.5 bg-gradient-to-r ${currentTheme.gradients.button} text-white rounded-md hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm`}
              title="AI Search - Ask anything about your patients"
            >
              {isAiSearching ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Bot className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={onAddPatient}
            className="px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Patient
          </button>
          
          {/* Bulk Action Buttons - Illuminate when filtered */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenMessageModal}
            disabled={isSendingBulkSms || (selectedPatientIds.size === 0 && filteredPatients.length === 0)}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
              (selectedPatientIds.size > 0 || ((searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0))
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 opacity-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={selectedPatientIds.size > 0 
              ? `Send SMS to ${selectedPatientIds.size} selected patients`
              : `Send SMS to ${filteredPatients.length} filtered patients`}
          >
            {isSendingBulkSms ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <MessageSquare className="w-4 h-4" />
            )}
            SMS
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenEmailModal}
            disabled={isSendingBulkEmail || (selectedPatientIds.size === 0 && filteredPatients.length === 0)}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
              (selectedPatientIds.size > 0 || ((searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0))
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 opacity-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={selectedPatientIds.size > 0 
              ? `Send Email to ${selectedPatientIds.size} selected patients`
              : `Send Email to ${filteredPatients.length} filtered patients`}
          >
            {isSendingBulkEmail ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
            Email
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExportPatients}
            disabled={isExporting || filteredPatients.length === 0}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
              (searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md hover:shadow-lg'
                : 'bg-gray-100 text-gray-400 opacity-50'
            } disabled:opacity-50 disabled:cursor-not-allowed`}
            title={`Export ${filteredPatients.length} filtered patients`}
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            Export
          </motion.button>
          
          <button
            onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
            className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
          >
            {view === 'grid' ? <List className="w-4 h-4" /> : <LayoutGrid className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* AI Filter Indicator */}
      {aiFilters && (
        <div className={`mt-2 bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white text-xs px-3 py-2 rounded-md shadow-lg`}>
          <div className="flex items-center gap-2">
            <Bot className="w-3 h-3" />
            <span>AI filtered: {aiFilters.description}</span>
            <button
              onClick={() => {
                onClearAiFilters();
                setSearchTerm('');
              }}
              className="ml-auto hover:bg-white/20 rounded p-0.5"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 mt-4">
        {filterOptions.map((filter) => (
          <motion.button
            key={filter.id}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedFilter(filter.id)}
            className={`px-3 py-2 rounded-full flex items-center gap-2 transition-all text-sm font-medium border ${
              selectedFilter === filter.id
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-transparent shadow-sm'
                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
            }`}
          >
            {filter.id === 'female' ? (
              <FemaleIcon className="w-3 h-3" />
            ) : filter.id === 'male' ? (
              <MaleIcon className="w-3 h-3" />
            ) : (
              <filter.icon className="w-3 h-3" />
            )}
            {filter.label}
            {filter.count > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                selectedFilter === filter.id ? 'bg-white/20' : 'bg-gray-100'
              }`}>
                {filter.count}
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default SearchAndFiltersSection;