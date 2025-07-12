import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { usePatientsStoreNew } from '../../stores/patientsStoreNew';

// Extended Patient interface with database fields
interface Patient {
  id: string;
  patient_id?: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  blood_type?: string;
  allergies?: string;
  chronic_conditions?: string;
  last_visit_date?: string;
  created_at?: string;
  updated_at?: string;
  practice_id?: string;
  branch_id?: string;
  medical_aid_details?: {
    id?: string;
    provider: string;
    scheme?: string;
    membership_number: string;
    plan_type?: string;
    main_member_name?: string;
    main_member_id_number?: string;
    relationship_to_main?: string;
    medical_aid_provider?: {
      id: string;
      name: string;
      logo_url?: string;
    };
  }[];
  // Added fields for visits data
  total_visits?: number;
  practice?: {
    id: string;
    name: string;
  };
}

import FormModal from '../modals/FormModal';
import AddPatientForm from '../forms/AddPatientForm';
import EditPatientForm from '../forms/EditPatientForm';
import PatientAnalytics from './PatientAnalytics';
import { PatientSearchFilters } from './PatientSearchFilters';
import { useAiSearch } from '../../hooks/useAiSearch';
import { toast } from 'react-hot-toast';
import ComprehensivePatientModal from './ComprehensivePatientModal';
import { usePractice } from '../../contexts/PracticeContext';
import { getMedicalAidLogo } from '../../utils/medicalAidLogos';
import { supabase } from '../../lib/supabase';

// Export the PatientManagementView component
export const PatientManagementView: React.FC = () => {
  const { practiceId } = usePractice();
  const {
    patients = [],
    isLoading: loadingStore,
    fetchPatients,
    fetchPatientsWithVisits
  } = usePatientsStoreNew();
  
  // Debug logging
  useEffect(() => {
    console.log('PatientManagementView - Practice ID:', practiceId);
    console.log('Patients from store:', patients);
    console.log('Number of patients:', patients.length);
    console.log('Is Loading:', loadingStore);
    console.log('First patient:', patients[0]);
  }, [patients, practiceId, loadingStore]);

  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientDetailOpen, setIsPatientDetailOpen] = useState(false);
  
  // Local state for filtering and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatients, setSelectedPatients] = useState<string[]>([]);
  const [sortField, setSortField] = useState<'name' | 'age' | 'lastVisit'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Filter states
  const [genderFilter, setGenderFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [medicalAidFilter, setMedicalAidFilter] = useState<string>('');
  const [branchFilter, setBranchFilter] = useState<string>('');
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageType, setMessageType] = useState<'sms' | 'email'>('sms');
  const [inactiveThreshold, setInactiveThreshold] = useState(180); // Default 6 months
  
  // Filter states (for future use)
  // const [genderFilter, setGenderFilter] = useState('');
  // const [ageFilter, setAgeFilter] = useState('');
  // const [bloodTypeFilter, setBloodTypeFilter] = useState('');
  // const [medicalAidFilter, setMedicalAidFilter] = useState('');
  // const [doctorFilter, setDoctorFilter] = useState('');
  // const [dateRangeFilter, setDateRangeFilter] = useState<[Date | null, Date | null]>([null, null]);
  // const [customAgeRange, setCustomAgeRange] = useState<[number, number]>([0, 100]);
  // const [lastVisitFilter, setLastVisitFilter] = useState('');
  // const [customVisitRange, setCustomVisitRange] = useState<[Date | null, Date | null]>([null, null]);

  // AI Search
  const {
    isSearching,
    isAiMode,
    setIsAiMode,
    aiSuggestions = [],
    processNaturalLanguageSearch
  } = useAiSearch(patients, setSearchQuery, {
    setGenderFilter: () => {},
    setAgeFilter: () => {},
    setBloodTypeFilter: () => {},
    setMedicalAidFilter: () => {},
    setDoctorFilter: () => {},
    setDateRangeFilter: () => {},
    setCustomAgeRange: () => {},
    setLastVisitFilter: () => {},
    setCustomVisitRange: () => {}
  });

  // Fetch data on mount when practice context is available
  useEffect(() => {
    console.log('🚀 PatientManagementView - FORCING DATA FETCH');
    console.log('Practice ID:', practiceId);
    
    // ALWAYS fetch patients, no matter what
    fetchPatients();
    
    // Also try the enhanced method
    if (fetchPatientsWithVisits) {
      setTimeout(() => {
        console.log('🔄 Trying enhanced fetch as backup...');
        fetchPatientsWithVisits();
      }, 1000);
    }
  }, [practiceId]);
  
  // Load threshold from settings
  useEffect(() => {
    const loadThreshold = async () => {
      if (!practiceId) return;
      
      try {
        const { data, error } = await supabase
          .from('practice_settings')
          .select('setting_value')
          .eq('practice_id', practiceId)
          .eq('setting_key', 'patient_activity_thresholds')
          .single();
          
        if (data?.setting_value?.inactive_days) {
          setInactiveThreshold(data.setting_value.inactive_days);
        }
      } catch (error) {
        console.error('Error loading threshold settings:', error);
      }
    };
    loadThreshold();
  }, [practiceId]);

  // Filter patients based on search and filters
  const filteredPatients = patients.filter(patient => {
    // Search filter
    if (searchQuery && !isAiMode) {
      const searchLower = searchQuery.toLowerCase();
      const matchesSearch = 
        patient.first_name?.toLowerCase().includes(searchLower) ||
        patient.last_name?.toLowerCase().includes(searchLower) ||
        (patient.patient_id || patient.id)?.toLowerCase().includes(searchLower) ||
        patient.email?.toLowerCase().includes(searchLower) ||
        patient.cell_number?.toLowerCase().includes(searchLower);
      
      if (!matchesSearch) return false;
    }
    
    // Gender filter
    if (genderFilter && patient.gender?.toLowerCase() !== genderFilter.toLowerCase()) {
      return false;
    }
    
    // Status filter - Active means had a visit in last 6 months
    // Only apply if explicitly filtering, don't filter by default
    if (statusFilter && statusFilter !== '') {
      const isActive = patient.last_visit_date ? 
        new Date(patient.last_visit_date) > new Date(Date.now() - 180 * 24 * 60 * 60 * 1000) : false;
      
      if (statusFilter === 'active' && !isActive) return false;
      if (statusFilter === 'inactive' && isActive) return false;
    }
    
    // Branch filter
    if (branchFilter && patient.branch_id !== branchFilter) {
      return false;
    }
    
    // Medical aid filter
    if (medicalAidFilter) {
      const hasMedicalAid = patient.medical_aid_details && patient.medical_aid_details.length > 0;
      if (medicalAidFilter === 'with_aid' && !hasMedicalAid) return false;
      if (medicalAidFilter === 'without_aid' && hasMedicalAid) return false;
    }
    
    return true;
  });

  // Sort patients
  const sortedPatients = [...filteredPatients].sort((a, b) => {
    let compareValue = 0;
    
    switch (sortField) {
      case 'name':
        compareValue = `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`);
        break;
      case 'age':
        const ageA = a.date_of_birth ? new Date().getFullYear() - new Date(a.date_of_birth).getFullYear() : 0;
        const ageB = b.date_of_birth ? new Date().getFullYear() - new Date(b.date_of_birth).getFullYear() : 0;
        compareValue = ageA - ageB;
        break;
      case 'joined':
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        compareValue = dateA - dateB;
        break;
      case 'lastVisit':
        const visitA = a.last_visit_date ? new Date(a.last_visit_date).getTime() : 0;
        const visitB = b.last_visit_date ? new Date(b.last_visit_date).getTime() : 0;
        compareValue = visitA - visitB;
        break;
    }
    
    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  // Pagination calculations
  const totalPages = Math.ceil(sortedPatients.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedPatients = sortedPatients.slice(startIndex, endIndex);
  
  // Reset to first page when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, genderFilter, branchFilter, medicalAidFilter]);

  // Check if all are selected
  const isAllSelected = selectedPatients.length > 0 && selectedPatients.length === paginatedPatients.length;
  
  // Select all function
  const selectAllPatients = () => {
    if (isAllSelected) {
      setSelectedPatients([]);
    } else {
      setSelectedPatients(paginatedPatients.map(p => p.id));
    }
  };

  // Handle patient selection
  const handleSelectPatient = (patientId: string) => {
    setSelectedPatients(
      selectedPatients.includes(patientId)
        ? selectedPatients.filter(id => id !== patientId)
        : [...selectedPatients, patientId]
    );
  };
  
  // Delete patient function
  const deletePatient = async (patientId: string) => {
    // This would need to be implemented with the actual delete API
    console.log('Delete patient:', patientId);
    // After deletion, refresh the patients list
    await fetchPatients();
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (selectedPatients.length === 0) return;
    
    const confirmed = await toast.promise(
      new Promise((resolve) => {
        toast.custom(
          (t) => (
            <div className="bg-white rounded-lg shadow-lg p-4 max-w-md">
              <p className="text-gray-800 mb-4">
                Are you sure you want to delete {selectedPatients.length} patient{selectedPatients.length > 1 ? 's' : ''}?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ),
          { duration: Infinity }
        );
      }),
      {
        loading: 'Processing...',
        success: 'Operation completed',
        error: 'Operation cancelled'
      }
    );

    if (confirmed) {
      try {
        await Promise.all(selectedPatients.map(id => deletePatient(id)));
        setSelectedPatients([]);
        toast.success(`Successfully deleted ${selectedPatients.length} patient${selectedPatients.length > 1 ? 's' : ''}`);
      } catch {
        toast.error('Failed to delete some patients');
      }
    }
  };

  // Handle bulk messaging
  const handleBulkMessage = () => {
    if (selectedPatients.length === 0) return;
    // Implementation for bulk messaging
    toast.info('Bulk messaging feature coming soon!');
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const exportData = filteredPatients.map(patient => ({
        'Patient ID': patient.patient_id || patient.id,
        'Name': `${patient.first_name} ${patient.last_name}`,
        'Date of Birth': patient.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : '',
        'Gender': patient.gender || '',
        'Phone': patient.cell_number || '',
        'Email': patient.email || '',
        'Medical Aid': patient.medical_aid_details?.[0]?.provider || 'None',
        'Medical Aid Number': patient.medical_aid_details?.[0]?.membership_number || '',
        'Blood Type': patient.blood_type || '',
        'Allergies': patient.allergies || '',
        'Chronic Conditions': patient.chronic_conditions || '',
        'Last Visit': patient.last_visit_date ? format(new Date(patient.last_visit_date), 'dd/MM/yyyy') : 'Never'
      }));

      const csv = [
        Object.keys(exportData[0]).join(','),
        ...exportData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
      ].join('\n');

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Patients exported successfully');
    } catch {
      toast.error('Failed to export patients');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle patient click
  const handlePatientClick = (patient: Patient) => {
    setSelectedPatientId(patient.id);
    setIsPatientDetailOpen(true);
  };

  // Handle edit
  const handleEdit = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatient(patient);
    setIsEditModalOpen(true);
  };

  // Handle delete
  const handleDelete = async (patientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    const confirmed = await toast.promise(
      new Promise((resolve) => {
        toast.custom(
          (t) => (
            <div className="bg-white rounded-lg shadow-lg p-4 max-w-md">
              <p className="text-gray-800 mb-4">
                Are you sure you want to delete this patient?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(false);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    toast.dismiss(t.id);
                    resolve(true);
                  }}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          ),
          { duration: Infinity }
        );
      }),
      {
        loading: 'Processing...',
        success: 'Operation completed',
        error: 'Operation cancelled'
      }
    );

    if (confirmed) {
      try {
        await deletePatient(patientId);
        toast.success('Patient deleted successfully');
      } catch {
        toast.error('Failed to delete patient');
      }
    }
  };

  // Handle AI search toggle
  const handleAiSearchToggle = () => {
    setIsAiMode(!isAiMode);
    if (isAiMode) {
      setSearchQuery('');
    }
  };

  // Handle search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query && !isAiMode) {
      // For regular search, we filter locally
      // The filtering is already handled in the filteredPatients computation
    } else if (isAiMode && query) {
      processNaturalLanguageSearch(query);
    }
  };

  // Handle sort
  const handleSort = (field: 'name' | 'age' | 'joined' | 'lastVisit') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field as typeof sortField);
      setSortOrder('asc');
    }
  };

  // Render patient card
  const renderPatientCard = (patient: Patient) => {
    const age = patient.date_of_birth 
      ? Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
    
    const joinedDate = patient.created_at ? new Date(patient.created_at) : null;
    const isActive = patient.last_visit_date ? 
      new Date(patient.last_visit_date) > new Date(Date.now() - inactiveThreshold * 24 * 60 * 60 * 1000) : false;

    return (
      <motion.div
        key={patient.id}
        layout
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        whileHover={{ y: -2 }}
        className="group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200"
        onClick={() => handlePatientClick(patient)}
      >

        {/* Activity Indicator - Top Right */}
        <div className="absolute top-3 right-3">
          {(() => {
            const daysSinceVisit = patient.last_visit_date ? 
              Math.floor((Date.now() - new Date(patient.last_visit_date).getTime()) / (24 * 60 * 60 * 1000)) : null;
            
            return (
              <div className="relative group">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md`}
                  style={{
                    backgroundColor: isActive ? '#009292' : '#9ca3af'
                  }}
                >
                  {daysSinceVisit !== null ? (
                    daysSinceVisit === 0 ? 'Now' : 
                    daysSinceVisit < 0 ? 'New' :
                    daysSinceVisit < 30 ? `${daysSinceVisit}d` : 
                    daysSinceVisit < 365 ? `${Math.floor(daysSinceVisit / 30)}m` : 
                    `${Math.floor(daysSinceVisit / 365)}y`
                  ) : 'N/A'}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Quick actions */}
        <div className="absolute top-16 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <button
            onClick={(e) => handleEdit(patient, e)}
            className="p-1.5 bg-white rounded-lg shadow-sm hover:shadow-md transition-all"
          >
            <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 text-cyan-600" />
          </button>
          <button
            onClick={(e) => handleDelete(patient.id, e)}
            className="p-1.5 bg-white rounded-lg shadow-sm hover:shadow-md transition-all"
          >
            <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 text-red-600" />
          </button>
        </div>

        <div className="p-6 cursor-pointer">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="relative inline-flex items-center justify-center">
              <div 
                className="absolute inset-0 rounded-full heartbeat-ring" 
                style={{
                  background: isActive 
                    ? patient.gender === 'male' 
                      ? 'linear-gradient(45deg, rgba(17, 141, 255, 0.25), rgba(17, 141, 255, 0.376))' 
                      : patient.gender === 'female'
                      ? 'linear-gradient(45deg, rgba(255, 79, 90, 0.25), rgba(255, 79, 90, 0.376))'
                      : 'linear-gradient(45deg, rgba(107, 114, 128, 0.25), rgba(107, 114, 128, 0.376))'
                    : 'linear-gradient(45deg, rgba(156, 163, 175, 0.25), rgba(156, 163, 175, 0.376))',
                  transform: 'scale(1.4)'
                }}
              />
              <div 
                className="relative inline-flex items-center justify-center w-12 h-12 rounded-full text-white font-bold text-lg shadow-sm z-10"
                style={{
                  backgroundColor: isActive 
                    ? (patient.gender === 'male' ? '#118dff' : patient.gender === 'female' ? '#ff4f5a' : '#6b7280')
                    : '#9ca3af'
                }}
              >
                {patient.first_name[0]?.toUpperCase()}{patient.last_name[0]?.toUpperCase()}
              </div>
            </div>
            <div className="flex-1">
              <h3 className={`font-semibold flex items-center gap-2 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {patient.first_name} {patient.last_name}
                {patient.gender && (
                  <Icon 
                    icon={patient.gender === 'male' ? 'solar:men-bold-duotone' : 'solar:women-bold-duotone'} 
                    className={`w-4 h-4 ${
                      isActive 
                        ? (patient.gender === 'male' ? 'text-blue-500' : 'text-pink-500')
                        : 'text-gray-400'
                    }`}
                  />
                )}
              </h3>
              <p className={`text-sm ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                {age !== null ? `${age} years` : 'Age unknown'}
              </p>
              {patient.practice?.name && (
                <p className={`text-xs font-medium mt-1 ${isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                  {patient.practice.name}
                </p>
              )}
            </div>
          </div>

          {/* Contact info */}
          <div className="space-y-2 mb-4">
            {patient.cell_number && (
              <div className={`flex items-center gap-2 text-sm ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 text-gray-400" />
                {patient.cell_number}
              </div>
            )}
            {patient.email && (
              <div className={`flex items-center gap-2 text-sm ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 text-gray-400" />
                <span className="truncate">{patient.email}</span>
              </div>
            )}
          </div>

          {/* Medical Aid Info */}
          {patient.medical_aid_details && patient.medical_aid_details.length > 0 && (
            <div className="mb-4 p-3 bg-purple-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {patient.medical_aid_details[0].medical_aid_provider?.logo_url ? (
                    <div className="w-10 h-8 flex items-center justify-center">
                      <img 
                        src={patient.medical_aid_details[0].medical_aid_provider.logo_url} 
                        alt={patient.medical_aid_details[0].provider}
                        className="max-h-8 max-w-10 object-contain"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <div className="w-10 h-8 flex items-center justify-center">
                      <Icon icon="solar:shield-plus-bold-duotone" className="w-6 h-6 text-purple-600" />
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-900">{patient.medical_aid_details[0].provider}</p>
                    <div className="flex items-center gap-2">
                      {patient.medical_aid_details[0].membership_number && (
                        <p className="text-xs text-gray-600">{patient.medical_aid_details[0].membership_number}</p>
                      )}
                      {patient.medical_aid_details[0].scheme && (
                        <p className="text-xs text-gray-500">
                          • {patient.medical_aid_details[0].scheme}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Medical info badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {patient.blood_type && (
              <span className="px-2 py-1 bg-red-50 text-red-700 rounded-lg text-xs font-medium">
                {patient.blood_type}
              </span>
            )}
            {patient.medical_aid_details && patient.medical_aid_details.length > 0 && (
              <span className="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium">
                {patient.medical_aid_details[0].provider}
              </span>
            )}
            {patient.chronic_conditions && (
              <span className="px-2 py-1 bg-orange-50 text-orange-700 rounded-lg text-xs font-medium">
                Chronic
              </span>
            )}
            {patient.allergies && (
              <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded-lg text-xs font-medium">
                Allergies
              </span>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div>
                <p>Joined: {joinedDate ? format(joinedDate, 'dd MMM yyyy') : 'Unknown'}</p>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:health-bold-duotone" className="w-4 h-4 text-purple-500" />
                  <p>{patient.total_visits || 0} visits</p>
                </div>
              </div>
              <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" />
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render patient row
  const renderPatientRow = (patient: Patient) => {
    const age = patient.date_of_birth 
      ? Math.floor((new Date().getTime() - new Date(patient.date_of_birth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
    
    const isSelected = selectedPatients.includes(patient.id);
    const isActive = patient.last_visit_date ? 
      new Date(patient.last_visit_date) > new Date(Date.now() - inactiveThreshold * 24 * 60 * 60 * 1000) : false;

    return (
      <motion.tr
        key={patient.id}
        layout
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
          isSelected ? 'bg-cyan-50' : ''
        }`}
        onClick={() => handlePatientClick(patient)}
      >
        <td className="px-6 py-4 whitespace-nowrap">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => {
              e.stopPropagation();
              handleSelectPatient(patient.id);
            }}
            className="w-4 h-4 text-cyan-600 bg-white border-gray-300 rounded focus:ring-cyan-500"
          />
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-3">
            <div className="relative inline-flex items-center justify-center">
              <div 
                className="absolute inset-0 rounded-full heartbeat-ring" 
                style={{
                  background: isActive 
                    ? patient.gender === 'male' 
                      ? 'linear-gradient(45deg, rgba(17, 141, 255, 0.25), rgba(17, 141, 255, 0.376))' 
                      : patient.gender === 'female'
                      ? 'linear-gradient(45deg, rgba(255, 79, 90, 0.25), rgba(255, 79, 90, 0.376))'
                      : 'linear-gradient(45deg, rgba(107, 114, 128, 0.25), rgba(107, 114, 128, 0.376))'
                    : 'linear-gradient(45deg, rgba(156, 163, 175, 0.25), rgba(156, 163, 175, 0.376))',
                  transform: 'scale(1.4)'
                }}
              />
              <div 
                className="relative inline-flex items-center justify-center w-10 h-10 rounded-full text-white font-bold text-sm shadow-sm z-10"
                style={{
                  backgroundColor: isActive 
                    ? (patient.gender === 'male' ? '#118dff' : patient.gender === 'female' ? '#ff4f5a' : '#6b7280')
                    : '#9ca3af'
                }}
              >
                {patient.first_name[0]?.toUpperCase()}{patient.last_name[0]?.toUpperCase()}
              </div>
            </div>
            <div>
              <div className={`font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {patient.first_name} {patient.last_name}
              </div>
              {patient.practice?.name && (
                <div className={`text-xs font-medium mt-0.5 ${isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                  {patient.practice.name}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {patient.gender && (
              <Icon 
                icon={patient.gender === 'male' ? 'solar:men-bold-duotone' : 'solar:women-bold-duotone'} 
                className={`w-4 h-4 ${
                  isActive 
                    ? (patient.gender === 'male' ? 'text-blue-500' : 'text-pink-500')
                    : 'text-gray-400'
                }`}
              />
            )}
            <span className={`text-sm ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {age !== null ? `${age} years` : 'Unknown'}
            </span>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="space-y-1">
            {patient.cell_number && (
              <div className={`flex items-center gap-2 text-sm ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 text-gray-400" />
                {patient.cell_number}
              </div>
            )}
            {patient.email && (
              <div className={`flex items-center gap-2 text-sm ${isActive ? 'text-gray-600' : 'text-gray-400'}`}>
                <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 text-gray-400" />
                <span className="truncate block max-w-[200px]">{patient.email}</span>
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          {patient.medical_aid_details && patient.medical_aid_details.length > 0 ? (
            <div className="flex items-center gap-3">
              {patient.medical_aid_details[0].medical_aid_provider?.logo_url ? (
                <div className="w-10 h-8 flex items-center justify-center">
                  <img 
                    src={patient.medical_aid_details[0].medical_aid_provider.logo_url} 
                    alt={patient.medical_aid_details[0].provider}
                    className="max-h-8 max-w-10 object-contain"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div className="w-10 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Icon icon="solar:shield-plus-bold-duotone" className="w-5 h-5 text-purple-600" />
                </div>
              )}
              <div>
                <div className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                  {patient.medical_aid_details[0].provider}
                </div>
                <div className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                  {patient.medical_aid_details[0].membership_number}
                  {patient.medical_aid_details[0].scheme && ` • ${patient.medical_aid_details[0].scheme}`}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">No medical aid</span>
          )}
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div>
            <div className={`text-sm ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
              {patient.created_at ? format(new Date(patient.created_at), 'dd MMM yyyy') : 'Unknown'}
            </div>
            {patient.created_at && (
              <div className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                {(() => {
                  const days = Math.floor((new Date().getTime() - new Date(patient.created_at).getTime()) / (1000 * 60 * 60 * 24));
                  if (days === 0) return 'Today';
                  if (days === 1) return '1 day';
                  if (days < 30) return `${days} days`;
                  if (days < 365) return `${Math.floor(days / 30)} months`;
                  const years = Math.floor(days / 365);
                  return years === 1 ? '1 year' : `${years} years`;
                })()}
              </div>
            )}
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-3">
            {/* Innovative Activity Indicator */}
            <div className="relative">
              {(() => {
                const isActive = patient.last_visit_date ? 
                  new Date(patient.last_visit_date) > new Date(Date.now() - inactiveThreshold * 24 * 60 * 60 * 1000) : false;
                const daysSinceVisit = patient.last_visit_date ? 
                  Math.floor((Date.now() - new Date(patient.last_visit_date).getTime()) / (24 * 60 * 60 * 1000)) : null;
                
                return (
                  <div className={`relative group`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md transition-all hover:scale-110`}
                      style={{
                        backgroundColor: isActive ? '#009292' : '#9ca3af'
                      }}
                    >
                      {daysSinceVisit !== null ? (
                        daysSinceVisit === 0 ? 'Now' : 
                        daysSinceVisit < 0 ? 'New' :
                        daysSinceVisit < 30 ? `${daysSinceVisit}d` : 
                        daysSinceVisit < 365 ? `${Math.floor(daysSinceVisit / 30)}m` : 
                        `${Math.floor(daysSinceVisit / 365)}y`
                      ) : 'N/A'}
                    </div>
                    {/* Tooltip */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                      {daysSinceVisit !== null ? (
                        daysSinceVisit === 0 ? 'Visited today' :
                        daysSinceVisit < 0 ? 'Future visit' :
                        `${daysSinceVisit} days ago`
                      ) : 'Never visited'}
                    </div>
                  </div>
                );
              })()}
            </div>
            <div>
              <div className={`text-sm ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                {patient.last_visit_date ? format(new Date(patient.last_visit_date), 'dd MMM yyyy') : 'Never visited'}
              </div>
              <div className={`text-xs ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                {patient.total_visits || 0} total visits
              </div>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleEdit(patient, e)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 text-cyan-600" />
            </button>
            <button
              onClick={(e) => handleDelete(patient.id, e)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 text-red-600" />
            </button>
          </div>
        </td>
      </motion.tr>
    );
  };

  const loading = loadingStore || isSearching;

  return (
    <div>
      {/* Single Container for Search, Actions and Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header with Search and Actions */}
        <div className="p-6">
          {/* Top Row - Search and Actions */}
          <div className="flex flex-col lg:flex-row gap-4 mb-4">
            {/* Search Bar - Dashboard Style */}
            <div className="flex-1">
              <div className="relative group">
                <Icon icon="solar:magnifer-bold-duotone" className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 transition-colors group-focus-within:text-purple-600" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search patients by name, ID, phone or email..."
                  className="w-full pl-12 pr-12 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 focus:outline-none transition-all duration-200"
                />
                {/* AI Icon */}
                <button
                  onClick={() => setIsAiMode(!isAiMode)}
                  className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${
                    isAiMode ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-purple-600'
                  }`}
                  title="AI Search"
                >
                  <Icon icon="solar:magic-stick-3-bold-duotone" className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Actions Group */}
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="List View"
                >
                  <Icon icon="solar:list-bold-duotone" className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    viewMode === 'grid'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="Grid View"
                >
                  <Icon icon="solar:widget-2-bold-duotone" className="w-5 h-5" />
                </button>
              </div>

              {/* Message Button */}
              <button
                onClick={() => {
                  if (filteredPatients.length > 0) {
                    setShowMessageModal(true);
                  } else {
                    toast.error('No patients to message');
                  }
                }}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                title="Send Message to Patients"
              >
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
              </button>

              {/* Export Buttons */}
              <button
                onClick={handleExport}
                disabled={isExporting}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                title="Export to CSV"
              >
                <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
                  setIsExporting(true);
                  try {
                    // Export to Excel logic here
                    const exportData = filteredPatients.map(patient => ({
                      'Patient ID': patient.patient_id || patient.id,
                      'Name': `${patient.first_name} ${patient.last_name}`,
                      'Date of Birth': patient.date_of_birth ? format(new Date(patient.date_of_birth), 'dd/MM/yyyy') : '',
                      'Gender': patient.gender || '',
                      'Phone': patient.cell_number || '',
                      'Email': patient.email || '',
                      'Medical Aid': patient.medical_aid_details?.[0]?.provider || 'None',
                      'Medical Aid Number': patient.medical_aid_details?.[0]?.membership_number || '',
                      'Blood Type': patient.blood_type || '',
                      'Allergies': patient.allergies || '',
                      'Chronic Conditions': patient.chronic_conditions || '',
                      'Last Visit': patient.last_visit_date ? format(new Date(patient.last_visit_date), 'dd/MM/yyyy') : 'Never',
                      'Joined Date': patient.created_at ? format(new Date(patient.created_at), 'dd/MM/yyyy') : ''
                    }));
                    
                    // Convert to Excel format (simplified CSV for now)
                    const csv = [
                      Object.keys(exportData[0]).join(','),
                      ...exportData.map(row => Object.values(row).map(val => `"${val}"`).join(','))
                    ].join('\n');

                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `patients_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
                    a.click();
                    window.URL.revokeObjectURL(url);
                    
                    toast.success('Patients exported to Excel successfully');
                  } catch {
                    toast.error('Failed to export patients');
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                title="Export to Excel"
              >
                <Icon icon="solar:file-bold-duotone" className="w-5 h-5" />
              </button>

              {/* Add Patient Button */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5" />
                <span>Add Patient</span>
              </button>
            </div>
          </div>

          {/* Quick Filters Row */}
          <div className="flex flex-col gap-4">
            {/* Filter Pills */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filters */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setStatusFilter('')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    statusFilter === '' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Patients
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    statusFilter === 'active' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  Active
                </button>
                <button
                  onClick={() => setStatusFilter('inactive')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    statusFilter === 'inactive' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                  Inactive
                </button>
              </div>

              {/* Branch Filter */}
              <select 
                value={branchFilter}
                onChange={(e) => setBranchFilter(e.target.value)}
                className="px-4 py-1.5 bg-gray-100 border-0 rounded-lg text-sm text-gray-700 focus:ring-2 focus:ring-purple-200"
              >
                <option value="">All Branches</option>
                <option value="5d63c776-4663-4fd3-bf18-de0fa504c7ff">Otjomuise - New Charm</option>
                <option value="d998b460-a1d6-4d11-9946-1c59c97ac6f3">Otjomuise - NewCharm</option>
              </select>

              {/* Gender Filters */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setGenderFilter('')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    genderFilter === '' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Genders
                </button>
                <button
                  onClick={() => setGenderFilter('male')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    genderFilter === 'male' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:men-bold-duotone" className="w-4 h-4" />
                  Male
                </button>
                <button
                  onClick={() => setGenderFilter('female')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    genderFilter === 'female' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:women-bold-duotone" className="w-4 h-4" />
                  Female
                </button>
              </div>

              {/* Medical Aid Filters */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setMedicalAidFilter('')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    medicalAidFilter === '' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  All Patients
                </button>
                <button
                  onClick={() => setMedicalAidFilter('with_aid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    medicalAidFilter === 'with_aid' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4" />
                  With Medical Aid
                </button>
                <button
                  onClick={() => setMedicalAidFilter('without_aid')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                    medicalAidFilter === 'without_aid' 
                      ? 'bg-white text-purple-600 shadow-sm' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon icon="solar:shield-cross-bold-duotone" className="w-4 h-4" />
                  No Medical Aid
                </button>
              </div>

              {/* Clear All Filters */}
              {(genderFilter || medicalAidFilter || statusFilter || branchFilter) && (
                <button
                  onClick={() => {
                    setGenderFilter('');
                    setMedicalAidFilter('');
                    setStatusFilter('');
                    setBranchFilter('');
                  }}
                  className="px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-all flex items-center gap-1"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4" />
                  Clear Filters
                </button>
              )}

              {/* Results Count */}
              <div className="ml-auto flex items-center gap-4 text-sm">
                <div className="text-gray-500">
                  <span className="font-semibold text-gray-900">{filteredPatients.length}</span> results
                </div>
              </div>
            </div>
          </div>
        </div>

        </div>
        
        {/* Content with divider */}
        <div className="border-t border-gray-200">
          <div className="p-6">
          {loading ? (
              <div className="flex items-center justify-center h-64">
                <Icon icon="solar:refresh-bold-duotone" className="w-8 h-8 text-cyan-600 animate-spin" />
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="py-12 text-center">
                <Icon icon="solar:user-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No patients found</h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery ? 'Try adjusting your search or filters' : 'Get started by adding your first patient'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setIsAddModalOpen(true)}
                    className="inline-flex items-center justify-center rounded-lg font-medium transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 hover:shadow-lg hover:shadow-purple-500/20 hover:scale-[1.02] px-4 py-2 animate-scale-in bg-gradient-to-r from-purple-500 to-indigo-600 text-white mx-auto"
                  >
                    <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5 mr-2" />
                    Add First Patient
                  </button>
                )}
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {paginatedPatients.map(patient => renderPatientCard(patient))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            onChange={selectAllPatients}
                            className="w-4 h-4 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500"
                          />
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            Patient
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('age')}
                        >
                          <div className="flex items-center gap-1">
                            Age & Gender
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medical Aid
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('joined')}
                        >
                          <div className="flex items-center gap-1">
                            Joined
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th 
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('lastVisit')}
                        >
                          <div className="flex items-center gap-1">
                            Encounters
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <AnimatePresence>
                        {paginatedPatients.map(patient => renderPatientRow(patient))}
                      </AnimatePresence>
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            
            {/* Pagination Controls */}
            {filteredPatients.length > itemsPerPage && (
        <div className="mt-6 px-6 pb-6">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, filteredPatients.length)} of {filteredPatients.length} patients
            </div>
            <div className="flex items-center gap-2">
              {/* Previous Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md"
              >
                <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-4 h-4 mr-1" />
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex items-center gap-1">
                {/* First page */}
                {currentPage > 3 && (
                  <>
                    <button
                      onClick={() => setCurrentPage(1)}
                      className="inline-flex items-center justify-center w-10 h-10 text-sm font-medium rounded-lg transition-all duration-300 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md"
                    >
                      1
                    </button>
                    {currentPage > 4 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                  </>
                )}

                {/* Page numbers around current page */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(page => {
                    return page === currentPage || 
                           page === currentPage - 1 || 
                           page === currentPage + 1 ||
                           (currentPage <= 3 && page <= 3) ||
                           (currentPage >= totalPages - 2 && page >= totalPages - 2);
                  })
                  .map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`inline-flex items-center justify-center w-10 h-10 text-sm font-medium rounded-lg transition-all duration-300 ${
                        currentPage === page
                          ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/30'
                          : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md'
                      }`}
                    >
                      {page}
                    </button>
                  ))}

                {/* Last page */}
                {currentPage < totalPages - 2 && (
                  <>
                    {currentPage < totalPages - 3 && (
                      <span className="px-2 text-gray-400">...</span>
                    )}
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      className="inline-flex items-center justify-center w-10 h-10 text-sm font-medium rounded-lg transition-all duration-300 bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md"
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              {/* Next Button */}
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center justify-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 hover:shadow-md"
              >
                Next
                <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      </div>

      {/* Modals */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Patient"
        size="xl"
      >
        <AddPatientForm onClose={() => setIsAddModalOpen(false)} />
      </FormModal>

      <FormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Patient"
        size="xl"
      >
        {selectedPatient && (
          <EditPatientForm 
            patient={selectedPatient}
            onClose={() => {
              setIsEditModalOpen(false);
              setSelectedPatient(null);
            }}
          />
        )}
      </FormModal>

      {/* Patient Detail Modal */}
      {selectedPatientId && isPatientDetailOpen && (
        <ComprehensivePatientModal
          isOpen={isPatientDetailOpen}
          onClose={() => {
            setIsPatientDetailOpen(false);
            setSelectedPatientId(null);
          }}
          patientId={selectedPatientId}
        />
      )}

      {/* Message Modal */}
      <FormModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        title="Send Message to Patients"
        size="md"
      >
        <div className="space-y-6">
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">Message Type</h3>
            <div className="flex gap-3">
              <button
                onClick={() => setMessageType('sms')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  messageType === 'sms'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon icon="solar:smartphone-bold-duotone" className="w-5 h-5" />
                SMS
              </button>
              <button
                onClick={() => setMessageType('email')}
                className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                  messageType === 'email'
                    ? 'border-purple-500 bg-purple-50 text-purple-700'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
                Email
              </button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recipients</h3>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">{filteredPatients.length}</span> patients selected
              </p>
              {genderFilter && (
                <p className="text-xs text-gray-500 mt-1">Gender: {genderFilter}</p>
              )}
              {statusFilter && (
                <p className="text-xs text-gray-500 mt-1">Status: {statusFilter}</p>
              )}
              {medicalAidFilter && (
                <p className="text-xs text-gray-500 mt-1">
                  Medical Aid: {medicalAidFilter === 'with_aid' ? 'With Medical Aid' : 'No Medical Aid'}
                </p>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowMessageModal(false)}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                toast.success(`Preparing to send ${messageType.toUpperCase()} to ${filteredPatients.length} patients`);
                setShowMessageModal(false);
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              Continue to Compose
            </button>
          </div>
        </div>
      </FormModal>
    </div>
  );
};

export default PatientManagementView;