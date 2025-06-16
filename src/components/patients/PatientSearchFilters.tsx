import React from 'react';
import { motion } from 'framer-motion';
import { Search, Bot, Plus, MessageSquare, Mail, Loader2 } from 'lucide-react';
import { AiFilters } from '../../hooks/useAiSearch';

interface PatientSearchFiltersProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  isAiSearching: boolean;
  aiFilters: AiFilters | null;
  onAiSearch: () => void;
  onClearAiFilters: () => void;
  onAddPatient: () => void;
  onOpenSmsModal: () => void;
  onOpenEmailModal: () => void;
  selectedPatientIds: Set<string>;
  filteredPatients: any[];
  isSendingBulkSms: boolean;
  isSendingBulkEmail: boolean;
  selectedFilter: string;
  currentTheme: any;
}

export const PatientSearchFilters: React.FC<PatientSearchFiltersProps> = ({
  searchTerm,
  setSearchTerm,
  isAiSearching,
  aiFilters,
  onAiSearch,
  onClearAiFilters,
  onAddPatient,
  onOpenSmsModal,
  onOpenEmailModal,
  selectedPatientIds,
  filteredPatients,
  isSendingBulkSms,
  isSendingBulkEmail,
  selectedFilter,
  currentTheme,
}) => {
  const hasBulkActions = selectedPatientIds.size > 0 || 
    ((searchTerm || selectedFilter !== 'all' || aiFilters) && filteredPatients.length > 0);

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
                  onAiSearch();
                }
              }}
              className="w-full pl-10 pr-16 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all"
            />
            
            {/* AI Search Button */}
            <button
              onClick={onAiSearch}
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
          
          {/* Bulk SMS Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenSmsModal}
            disabled={isSendingBulkSms || (selectedPatientIds.size === 0 && filteredPatients.length === 0)}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
              hasBulkActions
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
          
          {/* Bulk Email Button */}
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onOpenEmailModal}
            disabled={isSendingBulkEmail || (selectedPatientIds.size === 0 && filteredPatients.length === 0)}
            className={`px-3 py-2 rounded-lg transition-all flex items-center gap-2 text-sm font-medium ${
              hasBulkActions
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
              <Mail className="w-4 h-4" />
            )}
            Email
          </motion.button>
        </div>
      </div>
    </div>
  );
};