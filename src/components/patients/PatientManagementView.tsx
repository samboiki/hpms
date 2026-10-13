import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
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
  id_number?: string;
  system_patient_reference_number?: number;
  /** The old file number (paper file or previous system) */
  legacy_account_number?: string | null;
  marital_status?: string;
  occupation?: string;
  employer?: string;
  home_language?: string;
  home_address?: string;
  postal_address?: string;
  postal_code?: string;
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
  visits?: { id: string; branch_id?: string | null }[];
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
import { useAiPatientSearch } from '../../hooks/useAiPatientSearch';
import { toast } from 'react-hot-toast';
import ComprehensivePatientModal from './ComprehensivePatientModal';
import { usePractice } from '../../contexts/PracticeContext';
import { getMedicalAidLogo } from '../../utils/medicalAidLogos';
import { patientSearchFields, patientSearchRank, type PatientSearchRank } from '../../utils/patientSearch';
import { patientFileStatus } from '../../utils/patients/temporaryPatient';
import { bulkSmsOutcome, bulkSmsSummary, personalizePatientMessage } from './bulkMessage';
import { branchPatientCounts as countPatientsAtPlaces, seenAtBranch } from './branchFilter';
import { normalizePhoneNumber } from './patientContact';
import { supabase } from '../../lib/supabase';
import { usePatientSettings } from '../../hooks/usePatientSettings';
import { ProfessionalSmsModal } from '../messages/ProfessionalSmsModal';
import { ProfessionalEmailModal } from '../messages/ProfessionalEmailModal';
import { communicationService } from '../../services/communicationService';
import { AddToListButton } from '../patientLists/AddToListButton';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { MoreMenu } from '../ui/MoreMenu';
import { PossibleDuplicatesDialog } from './duplicates/PossibleDuplicatesDialog';
import { FundMoveDialog } from './fundMove/FundMoveDialog';
import { patientReferenceLabel } from '../../utils/patients/patientNumbers';
import { patientExportRow } from './patientListExport';

// Deep-link contract for this page:
//   /patients?patientId=<id>&tab=<tab>
//   /patients?patientId=<id>&visitId=<id>&action=edit-visit
//   /patients?patientId=<id>&tab=overview&noteId=<id>   (a note: Notes on the Overview scrolls to it)
//   /patients?action=add   (dashboard "Add Patient": opens the registration form)
type PatientDetailTab = 'overview' | 'encounters' | 'medications' | 'media' | 'lab' | 'imaging' | 'billing' | 'audit' | 'teeth' | 'eyes';
// 'teeth' (the tooth chart) shows for dental practices only; the quote and invoice "Teeth chart" links open it.
// 'eyes' (prescriptions, lab orders) shows for optometry practices only; the lab order list links to it.
const PATIENT_DETAIL_TABS: readonly PatientDetailTab[] = ['overview', 'encounters', 'medications', 'media', 'lab', 'imaging', 'billing', 'audit', 'teeth', 'eyes'];
const DEEP_LINK_PARAMS = ['patientId', 'tab', 'visitId', 'action', 'returnTo', 'noteId'] as const;

// The delete buttons used to confirm and then report "Patient deleted successfully" without
// deleting anything. Really removing patients needs a decision on keeping their clinical and
// billing records first, so the buttons stay visible but disabled with this reason.
const DELETE_UNAVAILABLE_REASON =
  "Deleting patients isn't available from this list, so their medical and billing records are kept.";

// Export the PatientManagementView component
export const PatientManagementView: React.FC = () => {
  const { practiceId } = usePractice();
  const {
    patients = [],
    isLoading: loadingStore,
    error: patientsError,
    fetchPatients,
    fetchPatientsWithVisits
  } = usePatientsStoreNew();
  
  // Detect if mobile or tablet
  const isMobileOrTablet = window.innerWidth < 1024;

  const [viewMode, setViewMode] = useState<'grid' | 'list'>(isMobileOrTablet ? 'grid' : 'list');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientDetailOpen, setIsPatientDetailOpen] = useState(false);
  const [detailDefaultTab, setDetailDefaultTab] = useState<PatientDetailTab | undefined>(undefined);
  const [detailVisitIdToEdit, setDetailVisitIdToEdit] = useState<string | null>(null);
  // Stays false until the first patient fetch for this practice has settled
  const [hasInitialLoadSettled, setHasInitialLoadSettled] = useState(false);
  // More > Possible duplicates: merging files is for the practice's administrators (the database checks it again)
  const isAdministrator = useAuthStore(state => state.user?.role === 'admin');
  const [showDuplicates, setShowDuplicates] = useState(false);
  // More > Move to another fund (parity A21): administrators only too
  const [showFundMove, setShowFundMove] = useState(false);

  // Open the patient modal from URL params (see deep-link contract above).
  // The modal fetches the patient by id, so it works even if the patient is not in the loaded list.
  const [searchParams, setSearchParams] = useSearchParams();
  const deepLinkPatientId = searchParams.get('patientId');
  const deepLinkTab = searchParams.get('tab');
  const deepLinkVisitId = searchParams.get('visitId');
  const deepLinkAction = searchParams.get('action');
  const deepLinkNoteId = searchParams.get('noteId');
  // Set when a doctor arrives from a consultation started on the dashboard
  const cameFromDashboard = searchParams.get('returnTo') === 'dashboard';
  const navigate = useNavigate();

  useEffect(() => {
    if (!deepLinkPatientId) return;
    const visitIdToEdit = deepLinkAction === 'edit-visit' && deepLinkVisitId ? deepLinkVisitId : null;
    const requestedTab = PATIENT_DETAIL_TABS.find(tab => tab === deepLinkTab);
    setSelectedPatientId(deepLinkPatientId);
    setDetailDefaultTab(requestedTab ?? (visitIdToEdit ? 'encounters' : 'overview'));
    setDetailVisitIdToEdit(visitIdToEdit);
    setIsPatientDetailOpen(true);
  }, [deepLinkPatientId, deepLinkTab, deepLinkVisitId, deepLinkAction]);

  // ?action=add opens the registration form, then the param is dropped (replace) so a refresh or
  // Back doesn't open it again. A patient link (?patientId=) takes precedence.
  useEffect(() => {
    if (deepLinkAction !== 'add' || deepLinkPatientId) return;
    setIsAddModalOpen(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('action');
    setSearchParams(nextParams, { replace: true });
  }, [deepLinkAction, deepLinkPatientId, searchParams, setSearchParams]);

  const closePatientDetail = () => {
    setIsPatientDetailOpen(false);
    setSelectedPatientId(null);
    setDetailDefaultTab(undefined);
    setDetailVisitIdToEdit(null);
    // Drop the deep-link params without a reload; replace so Back doesn't reopen the modal
    if (DEEP_LINK_PARAMS.some(key => searchParams.has(key))) {
      const nextParams = new URLSearchParams(searchParams);
      DEEP_LINK_PARAMS.forEach(key => nextParams.delete(key));
      setSearchParams(nextParams, { replace: true });
    }
  };

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
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branches, setBranches] = useState<{ id: string; name: string; practice_id: string }[]>([]);
  const [allPatientsCount, setAllPatientsCount] = useState(0);
  const [practiceName, setPracticeName] = useState<string>('');
  
  // SMS and Email modal states
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  // Get inactive threshold from patient settings
  const { settings: patientSettings } = usePatientSettings();
  const inactiveThreshold = patientSettings.inactiveThresholdDays;
  
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

  // AI Search toggle state
  const [showAiSearch, setShowAiSearch] = useState(false);
  const [aiSearchQuery, setAiSearchQuery] = useState('');
  
  // AI Search - n8n integration with Grok-3
  const {
    isAiSearching,
    searchDescription,
    aiFilteredPatients,
    lastSearchQuery,
    searchPatients,
    clearAiSearch,
    searchLogs
  } = useAiPatientSearch(patients, setCurrentPage);
  
  // Legacy AI Search (keeping for backward compatibility)
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

  // Fetch branches and counts when component mounts
  useEffect(() => {
    const fetchBranchesAndCounts = async () => {
      if (!practiceId) return;
      
      // Branches, the practice name and the patient count are independent: asked for together (one round-trip, not three)
      const [{ data: branchData, error: branchError }, { data: practiceData }, { count: mainCount }] = await Promise.all([
        supabase
          .from('branches')
          .select('id, name, practice_id')
          .eq('practice_id', practiceId)
          .order('name'),
        supabase
          .from('practices')
          .select('name')
          .eq('id', practiceId)
          .single(),
        // Count for "All Branches" (all patients); each place's count follows the filter (branchFilter.ts)
        supabase
          .from('patients')
          .select('*', { count: 'exact', head: true })
          .eq('practice_id', practiceId)
      ]);
      
      if (branchData && !branchError) {
        setBranches(branchData);
      }
      if (branchError) {
        console.error('Error loading branches:', branchError);
        toast.error('Could not load your branches, so the branch filter may be incomplete.');
      }
      
      if (practiceData) {
        setPracticeName(practiceData.name);
      }
      
      setAllPatientsCount(mainCount || 0);
    };
    
    fetchBranchesAndCounts();
  }, [practiceId]);

  // Fetch data on mount when practice context is available
  useEffect(() => {
    // CRITICAL: Only fetch if we have a valid practice ID
    if (!practiceId) {
      return;
    }
    
    // Validate practice ID format (should be a UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(practiceId)) {
      return;
    }
    
    // Track when the initial fetches have settled so we never flash "0 results"/empty state while loading
    let cancelled = false;
    let enhancedFetchTimer: ReturnType<typeof setTimeout> | undefined;
    setHasInitialLoadSettled(false);
    const initialFetches: Promise<unknown>[] = [fetchPatients()];

    // Also try the enhanced method
    if (fetchPatientsWithVisits) {
      initialFetches.push(new Promise<void>(resolve => {
        enhancedFetchTimer = setTimeout(() => {
          fetchPatientsWithVisits().finally(resolve);
        }, 1000);
      }));
    }

    Promise.allSettled(initialFetches).then(() => {
      if (!cancelled) setHasInitialLoadSettled(true);
    });

    return () => {
      cancelled = true;
      if (enhancedFetchTimer) clearTimeout(enhancedFetchTimer);
    };
  }, [practiceId]);

  // Typing in the search box stays instant: the list is filtered and sorted from the deferred search text, and only
  // again when the patients, the search or a filter or the order changes (not on every render of this page)
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const { filteredPatients, sortedPatients } = useMemo(() => {
    // How well each patient matches the search: exact first, then starts-with, then contains (src/utils/patientSearch.ts)
    const searchRanks = new Map<string, PatientSearchRank>();

    // Filter patients based on search and filters
    const filteredPatients = (aiFilteredPatients || patients).filter(patient => {
      // If AI search is active and we have filtered results, use those
      if (showAiSearch && aiFilteredPatients) {
        // AI has already filtered, but we can still apply additional filters
        // like branch, gender, etc. on top of AI results
      }

      // Search filter (only for non-AI search): names, ID number, OneHealth reference, cell, email, the Eminance account
      // number ("1234" finds 0001234) and membership numbers
      if (deferredSearchQuery && !showAiSearch) {
        const rank = patientSearchRank(patientSearchFields(patient), deferredSearchQuery);
        if (rank === null) return false;
        searchRanks.set(patient.id, rank);
      }
      
      // Gender filter
      if (genderFilter && patient.gender?.toLowerCase() !== genderFilter.toLowerCase()) {
        return false;
      }
      
      // Status filter - Active means had a visit within the threshold period
      // Only apply if explicitly filtering, don't filter by default
      if (statusFilter && statusFilter !== '') {
        const isActive = patient.last_visit_date ? 
          new Date(patient.last_visit_date) > new Date(Date.now() - inactiveThreshold * 24 * 60 * 60 * 1000) : false;
        
        if (statusFilter === 'active' && !isActive) return false;
        if (statusFilter === 'inactive' && isActive) return false;
      }
      
      // Branch filter: patients seen at the selected branch, or at the practice itself ('main')
      if (branchFilter && !seenAtBranch(patient.visits, branchFilter)) return false;
      
      // Medical aid filter
      if (medicalAidFilter) {
        const hasMedicalAid = patient.medical_aid_details && patient.medical_aid_details.length > 0;
        if (medicalAidFilter === 'with_aid' && !hasMedicalAid) return false;
        if (medicalAidFilter === 'without_aid' && hasMedicalAid) return false;
      }
      
      return true;
    });

    // Sort patients: when searching, exact matches first, then starts-with, then contains; the chosen order within each
    const sortedPatients = [...filteredPatients].sort((a, b) => {
      const byRank = (searchRanks.get(a.id) ?? 0) - (searchRanks.get(b.id) ?? 0);
      if (byRank !== 0) return byRank;
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
    return { filteredPatients, sortedPatients };
  }, [aiFilteredPatients, patients, showAiSearch, deferredSearchQuery, genderFilter, statusFilter, inactiveThreshold, branchFilter, medicalAidFilter, sortField, sortOrder]);

  const hasActiveFilters = Boolean(genderFilter || medicalAidFilter || statusFilter || branchFilter);
  // The number beside each place in the branch window: the patients choosing it shows
  const branchPatientCounts = useMemo(() => countPatientsAtPlaces(patients, branches.map(branch => branch.id)), [patients, branches]);

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

  // Bulk messaging is the envelope button: it sends to the selected patients, or to the whole
  // filtered list when none are selected (see getSmsRecipients / getEmailRecipients)

  // Get recipients for SMS/Email
  const getSmsRecipients = () => {
    // If patients are selected, only send to selected patients
    const targetPatients = selectedPatients.length > 0 
      ? filteredPatients.filter(p => selectedPatients.includes(p.id))
      : filteredPatients;
    
    // Only numbers that can be dialled: the gateway turns e.g. "811234567" into +81... (Japan)
    return targetPatients.filter(p => normalizePhoneNumber(p.cell_number) !== null);
  };

  const getEmailRecipients = () => {
    // If patients are selected, only send to selected patients
    const targetPatients = selectedPatients.length > 0 
      ? filteredPatients.filter(p => selectedPatients.includes(p.id))
      : filteredPatients;
    
    return targetPatients.filter(p => p.email && p.email.trim() !== '');
  };

  // Handle SMS send for bulk (called by SMS modal)
  const handleSendSms = async (allRecipients: any[], message: string) => {
    
    // Allow multiple SMS to same number (different patients, same phone)
    const uniqueRecipients = allRecipients;
    
    try {
      setIsSendingSms(true);
      
      let successCount = 0;
      let failureCount = 0;
      // Patients who replied STOP are skipped on purpose; once the SMS bundle is used up nobody else gets one
      let optedOutCount = 0;
      let limitReached = false;
      const processedPatients = new Set<string>(); // Track processed patient IDs
      
      // Send to each recipient individually (allowing multiple SMS to same number)
      for (const recipient of uniqueRecipients) {
        if (limitReached) break;
        try {
          // Additional safeguard - check if this specific patient already processed
          if (processedPatients.has(recipient.id)) {
            continue;
          }
          
          processedPatients.add(recipient.id);
          
          // Personalize SMS content for this specific patient
          const personalizedMessage = processTemplateVariables(message, recipient);
          
          
          const result = await communicationService.sendSMS({
            practiceId: practiceId!,
            // International form (+264...), so the gateway cannot misread a local number
            recipientPhone: normalizePhoneNumber(recipient.cell_number) ?? recipient.cell_number!,
            messageContent: personalizedMessage,
            messageType: 'custom',
            patientId: recipient.id,
            // A message to many patients is a campaign: the gateway skips patients who replied STOP
            // ('custom' alone counts as a message typed to one patient, which they still receive)
            metadata: { bulkSend: true }
          });
          
          // Also check if the result contains success indicators even if success is false
          const isActuallySuccessful = result.success || 
            (result.error && typeof result.error === 'string' && 
             result.error.includes('"statusCode":200') && 
             result.error.includes('"cost":'));
          
          const outcome = isActuallySuccessful ? 'sent' : bulkSmsOutcome(result);
          if (outcome === 'sent') {
            successCount++;
          } else if (outcome === 'opted_out') {
            optedOutCount++;
          } else if (outcome === 'limit_reached') {
            limitReached = true;
            processedPatients.delete(recipient.id);
          } else {
            failureCount++;
          }
        } catch (error) {
          // Check if error indicates success
          const errorStr = JSON.stringify(error);
          if (errorStr.includes('"statusCode":200') && errorStr.includes('"cost":')) {
            successCount++;
          } else {
            failureCount++;
          }
        }
      }
      
      // Show results
      const notTriedCount = limitReached ? new Set(uniqueRecipients.map(r => r.id)).size - processedPatients.size : 0;
      const summary = bulkSmsSummary({ sent: successCount, optedOut: optedOutCount, failed: failureCount, notTried: notTriedCount });
      
      if (summary.tone === 'success') {
        toast.success(summary.text, {
          duration: 5000,
          icon: '✅'
        });
      } else if (summary.tone === 'warning') {
        toast(summary.text, {
          icon: '⚠️',
          style: {
            background: '#f59e0b',
            color: 'white',
          },
        });
      } else {
        toast.error(summary.text);
      }
      
      // Clear state on success
      if (successCount > 0) {
        setSelectedPatients([]);
        setShowSmsModal(false);
      }
      
      return { success: successCount > 0, successCount, failureCount };
      
    } catch (error) {
      toast.error('Failed to send SMS. Please try again.');
      return { success: false, successCount: 0, failureCount: allRecipients.length };
    } finally {
      setIsSendingSms(false);
    }
  };

  // Convert File to base64 for email attachments
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1]; // Extract base64 part from data URL
        resolve(base64);
      };
      reader.onerror = error => {
        reject(error);
      };
    });
  };

  // Fill in this patient's name (and the practice name); variables without a real value are
  // dropped, so no patient is sent "John Smith", an invented offer or a fake review link
  const processTemplateVariables = (text: string, targetPatient: { first_name?: string | null; last_name?: string | null }): string =>
    personalizePatientMessage(text, targetPatient, practiceName);

  // Handle bulk email sending (called by ProfessionalEmailModal)
  const handleSendEmail = async (allRecipients: any[], subject: string, message: string, attachments?: File[]) => {
    
    // Allow multiple emails to same address (different patients, same email)
    // This is valid for families/couples sharing an email address
    const uniqueRecipients = allRecipients;
    
    try {
      setIsSendingEmail(true);
      
      // Convert File objects to base64 attachments once
      let emailAttachments: { filename: string; content: string; type?: string; }[] = [];
      
      if (attachments && attachments.length > 0) {
        emailAttachments = await Promise.all(
          attachments.map(async (file, index) => {
            const base64Content = await fileToBase64(file);
            const attachment = {
              filename: file.name,
              content: base64Content,
              type: file.type || 'application/octet-stream'
            };
            return attachment;
          })
        );
      }
      
      let successCount = 0;
      let failureCount = 0;
      const processedPatients = new Set<string>(); // Track processed patient IDs
      
      // Send to each recipient individually (allowing multiple emails to same address)
      for (const recipient of uniqueRecipients) {
        try {
          // Additional safeguard - check if this specific patient already processed
          if (processedPatients.has(recipient.id)) {
            continue;
          }
          
          processedPatients.add(recipient.id);
          
          // Personalize email content for this specific patient
          const personalizedSubject = processTemplateVariables(subject, recipient);
          const personalizedMessage = processTemplateVariables(message, recipient);
          
          
          const result = await communicationService.sendEmail({
            practiceId: practiceId!,
            recipientEmail: recipient.email!,
            recipientName: `${recipient.first_name} ${recipient.last_name}`,
            subject: personalizedSubject,
            textContent: personalizedMessage,
            emailType: 'bulk_message',
            patientId: recipient.id,
            attachments: emailAttachments
          });
          
          if (result.success) {
            successCount++;
          } else {
            failureCount++;
          }
        } catch (error) {
          failureCount++;
        }
      }
      
      // Show results
      
      if (successCount > 0 && failureCount === 0) {
        toast.success(`Email sent successfully to all ${successCount} patients`);
      } else if (successCount > 0 && failureCount > 0) {
        toast(`Email sent to ${successCount} patients, failed for ${failureCount} patients`, {
          icon: '⚠️',
          style: {
            background: '#f59e0b',
            color: 'white',
          },
        });
      } else {
        toast.error(`Failed to send email to all ${failureCount} patients`);
      }
      
      // Clear state on success
      if (successCount > 0) {
        setSelectedPatients([]);
        setShowEmailModal(false);
      }
      
      return { success: successCount > 0, successCount, failureCount };
      
    } catch (error) {
      toast.error('Failed to send emails. Please try again.');
      return { success: false, successCount: 0, failureCount: allRecipients.length };
    } finally {
      setIsSendingEmail(false);
    }
  };

  // Handle export
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const targetPatients = selectedPatients.length > 0
        ? filteredPatients.filter(p => selectedPatients.includes(p.id))
        : filteredPatients;
      if (targetPatients.length === 0) {
        toast.error('No patients to export. Clear the filters or select patients first.');
        return;
      }

      const exportData = targetPatients.map(patient => patientExportRow(patient));

      const csv = [
        Object.keys(exportData[0]).join(','),
        // Quotes inside a value are doubled (CSV rule); otherwise a name or note with a " shifts the columns
        ...exportData.map(row => Object.values(row).map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      ].join('\n');

      // The byte-order mark makes Excel read the file as UTF-8 (accented names stay readable)
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
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
    // A file booked with a name and cell only has a placeholder birthday: no age until it is completed
    const fileStatus = patientFileStatus(patient);
    const reference = patientReferenceLabel(patient.system_patient_reference_number);
    const age = fileStatus.dateOfBirth
      ? Math.floor((new Date().getTime() - new Date(fileStatus.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
    
    const joinedDate = patient.created_at ? new Date(patient.created_at) : null;
    const isActive = patient.last_visit_date ? 
      new Date(patient.last_visit_date) > new Date(Date.now() - inactiveThreshold * 24 * 60 * 60 * 1000) : false;

    return (
      <motion.div
        key={patient.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        whileHover={{ y: -2 }}
        className="group relative bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-gray-200"
        onClick={() => handlePatientClick(patient)}
      >

        <div className="p-4 sm:p-5 cursor-pointer">
          {/* Header: avatar, name and age, then the last-visit badge in the same row (it used to float
              over the name and age) */}
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
            <div className="flex-1 min-w-0">
              <h3 className={`font-semibold flex items-center gap-2 ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                <span className="truncate" title={`${patient.first_name} ${patient.last_name}`}>{patient.first_name} {patient.last_name}</span>
                {fileStatus.gender && (
                  <Icon
                    icon={patient.gender === 'male' ? 'solar:men-bold-duotone' : 'solar:women-bold-duotone'}
                    className={`w-4 h-4 flex-none ${
                      isActive
                        ? (patient.gender === 'male' ? 'text-blue-500' : 'text-pink-500')
                        : 'text-gray-400'
                    }`}
                  />
                )}
              </h3>
              <p className={`text-sm ${isActive ? 'text-gray-500' : 'text-gray-400'}`}>
                {age !== null ? `${age} years` : 'Age unknown'}
                {/* The OneHealth reference: on claims and statements, and searchable */}
                {reference && <span className="tabular-nums"> · Ref {reference}</span>}
              </p>
              {fileStatus.incomplete && (
                <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">File not complete</span>
              )}
              {patient.practice?.name && (
                <p className={`text-xs font-medium mt-1 ${isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                  {patient.practice.name}
                </p>
              )}
            </div>
            {/* Activity indicator: time since the last visit */}
            {(() => {
              const daysSinceVisit = patient.last_visit_date ?
                Math.floor((Date.now() - new Date(patient.last_visit_date).getTime()) / (24 * 60 * 60 * 1000)) : null;

              return (
                <div
                  className="flex-none w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md"
                  style={{
                    backgroundColor: isActive ? '#009292' : '#9ca3af'
                  }}
                  title={
                    daysSinceVisit === null ? 'Never visited' :
                    daysSinceVisit === 0 ? 'Visited today' :
                    daysSinceVisit < 0 ? 'Future visit' :
                    `Last visit ${daysSinceVisit} days ago`
                  }
                >
                  {daysSinceVisit !== null ? (
                    daysSinceVisit === 0 ? 'Now' :
                    daysSinceVisit < 0 ? 'New' :
                    daysSinceVisit < 30 ? `${daysSinceVisit}d` :
                    daysSinceVisit < 365 ? `${Math.floor(daysSinceVisit / 30)}m` :
                    `${Math.floor(daysSinceVisit / 365)}y`
                  ) : 'N/A'}
                </div>
              );
            })()}
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
                <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 flex-none text-gray-400" />
                <span className="truncate min-w-0" title={patient.email}>{patient.email}</span>
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

          {/* Footer: details, then the quick actions (always visible: they used to appear only on hover,
              over the contact details, and were unreachable on touch screens) */}
          <div className="pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between gap-3 text-sm text-gray-500">
              <div className="min-w-0">
                <p>Joined: {joinedDate ? format(joinedDate, 'dd MMM yyyy') : 'Unknown'}</p>
                <div className="flex items-center gap-2">
                  <Icon icon="solar:health-bold-duotone" className="w-4 h-4 text-purple-500" />
                  <p>{patient.total_visits || 0} {patient.total_visits === 1 ? 'visit' : 'visits'}</p>
                </div>
              </div>
              <div className="flex flex-none items-center gap-1">
                <button
                  type="button"
                  onClick={(e) => handleEdit(patient, e)}
                  className="p-2.5 rounded-lg hover:bg-gray-100 transition-colors"
                  title="Edit patient"
                  aria-label={`Edit ${patient.first_name} ${patient.last_name}`}
                >
                  <Icon icon="solar:pen-bold-duotone" className="w-5 h-5 text-cyan-600" />
                </button>
                {/* The wrapper carries the tooltip (a disabled button shows none) and keeps the click
                    from opening the patient */}
                <span title={DELETE_UNAVAILABLE_REASON} className="cursor-not-allowed" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    disabled
                    aria-label={`Delete unavailable: ${DELETE_UNAVAILABLE_REASON}`}
                    className="p-2.5 rounded-lg opacity-40 pointer-events-none"
                  >
                    <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-5 h-5 text-red-600" />
                  </button>
                </span>
                <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-colors" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // Render patient row
  const renderPatientRow = (patient: Patient) => {
    // A file booked with a name and cell only has a placeholder birthday: no age until it is completed
    const fileStatus = patientFileStatus(patient);
    const reference = patientReferenceLabel(patient.system_patient_reference_number);
    const age = fileStatus.dateOfBirth
      ? Math.floor((new Date().getTime() - new Date(fileStatus.dateOfBirth).getTime()) / (1000 * 60 * 60 * 24 * 365.25))
      : null;
    
    const isSelected = selectedPatients.includes(patient.id);
    const isActive = patient.last_visit_date ? 
      new Date(patient.last_visit_date) > new Date(Date.now() - inactiveThreshold * 24 * 60 * 60 * 1000) : false;

    return (
      <motion.tr
        key={patient.id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.15 }}
        className={`hover:bg-gray-50 transition-colors cursor-pointer ${
          isSelected ? 'bg-cyan-50' : ''
        }`}
        onClick={() => handlePatientClick(patient)}
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <div 
            className="flex items-center justify-center w-8 h-8 hover:bg-gray-100 rounded-lg cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              handleSelectPatient(patient.id);
            }}
          >
            <input
              type="checkbox"
              checked={isSelected}
              aria-label={`Select ${patient.first_name} ${patient.last_name}`}
              onChange={(e) => {
                e.stopPropagation();
                handleSelectPatient(patient.id);
              }}
              className="w-5 h-5 text-cyan-600 bg-white border-gray-300 rounded focus:ring-cyan-500 cursor-pointer"
            />
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
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
              {/* The OneHealth reference: on claims and statements, and searchable */}
              {reference && <div className="text-xs text-gray-500 tabular-nums">Ref {reference}</div>}
              {fileStatus.incomplete && (
                <span className="mt-0.5 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">File not complete</span>
              )}
              {patient.practice?.name && (
                <div className={`text-xs font-medium mt-0.5 ${isActive ? 'text-purple-600' : 'text-gray-400'}`}>
                  {patient.practice.name}
                </div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            {fileStatus.gender && (
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
        <td className="px-4 py-3 whitespace-nowrap">
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
                <span className="truncate block max-w-[180px]" title={patient.email}>{patient.email}</span>
              </div>
            )}
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
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
              <div className="min-w-0">
                <div className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                  {patient.medical_aid_details[0].provider}
                </div>
                <div
                  className={`text-xs max-w-[180px] truncate ${isActive ? 'text-gray-500' : 'text-gray-400'}`}
                  title={[patient.medical_aid_details[0].membership_number, patient.medical_aid_details[0].scheme].filter(Boolean).join(' • ')}
                >
                  {patient.medical_aid_details[0].membership_number}
                  {patient.medical_aid_details[0].scheme && ` • ${patient.medical_aid_details[0].scheme}`}
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-400">No medical aid</span>
          )}
        </td>
        {/* Joined: shown from 2xl so the table fits a laptop screen with Actions in view */}
        <td className="hidden 2xl:table-cell px-4 py-3 whitespace-nowrap">
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
        <td className="px-4 py-3 whitespace-nowrap">
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
                {patient.total_visits || 0} total {patient.total_visits === 1 ? 'visit' : 'visits'}
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => handleEdit(patient, e)}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="Edit patient"
              aria-label={`Edit ${patient.first_name} ${patient.last_name}`}
            >
              <Icon icon="solar:pen-bold-duotone" className="w-4 h-4 text-cyan-600" />
            </button>
            <span title={DELETE_UNAVAILABLE_REASON} className="cursor-not-allowed" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                disabled
                aria-label={`Delete unavailable: ${DELETE_UNAVAILABLE_REASON}`}
                className="p-1.5 rounded-lg opacity-40 pointer-events-none"
              >
                <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-4 h-4 text-red-600" />
              </button>
            </span>
          </div>
        </td>
      </motion.tr>
    );
  };

  // Show the loading state until the initial fetch has settled, and on refetches only while
  // there is nothing to show yet (keeps an already-rendered list visible during background refreshes)
  const loading = isSearching || (patients.length === 0 && (loadingStore || !hasInitialLoadSettled));

  // CRITICAL SECURITY CHECK
  if (!practiceId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Icon icon="solar:shield-warning-bold-duotone" className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Security Error</h3>
          <p className="text-gray-600">No practice context available. Please refresh the page or log in again.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Single Container for Search, Actions and Table */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        {/* Header with Search and Actions */}
        <div className="p-4 sm:p-6">
          {/* Top Row - Actions Only */}
          <div className="flex justify-end mb-4">
            {/* Actions Group */}
            <div className="flex items-center gap-3">
              {/* View Toggle - Hidden on mobile */}
              <div className="hidden lg:flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md transition-all duration-200 ${
                    viewMode === 'list'
                      ? 'bg-white text-purple-600 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                  title="List View"
                  aria-label="List view"
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
                  aria-label="Grid view"
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
                className={`p-3 rounded-xl transition-all ${
                  (searchQuery || genderFilter || statusFilter || medicalAidFilter || branchFilter || (showAiSearch && searchDescription) || selectedPatients.length > 0) && filteredPatients.length > 0
                    ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
                title={`Send Message to ${selectedPatients.length > 0 ? selectedPatients.length + ' Selected' : filteredPatients.length} Patient${(selectedPatients.length > 0 ? selectedPatients.length : filteredPatients.length) !== 1 ? 's' : ''}`}
                aria-label="Send an SMS or email to the selected patients, or to everyone in the list"
              >
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
              </button>

              {/* Add to list: the ticked patients, or everyone shown when nobody is ticked (as Message) */}
              <AddToListButton
                practiceId={practiceId}
                patientIds={(selectedPatients.length > 0
                  ? filteredPatients.filter(p => selectedPatients.includes(p.id))
                  : filteredPatients
                ).map(p => p.id)}
                scope={selectedPatients.length > 0 ? 'selected' : 'shown'}
                onAdded={() => setSelectedPatients([])}
              />

              {/* Export Buttons */}
              <button
                onClick={handleExport}
                disabled={isExporting || filteredPatients.length === 0}
                className={`p-3 rounded-xl transition-all ${
                  (searchQuery || genderFilter || statusFilter || medicalAidFilter || branchFilter || (showAiSearch && searchDescription) || selectedPatients.length > 0) && filteredPatients.length > 0
                    ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                } ${isExporting || filteredPatients.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={`Export ${selectedPatients.length > 0 ? selectedPatients.length + ' Selected' : filteredPatients.length} Patient${(selectedPatients.length > 0 ? selectedPatients.length : filteredPatients.length) !== 1 ? 's' : ''} to CSV`}
                aria-label="Export patients to CSV"
              >
                <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5" />
              </button>
              <button
                onClick={async () => {
                  setIsExporting(true);
                  try {
                    // Export to Excel logic here
                    const targetPatients = selectedPatients.length > 0
                      ? filteredPatients.filter(p => selectedPatients.includes(p.id))
                      : filteredPatients;
                    if (targetPatients.length === 0) {
                      toast.error('No patients to export. Clear the filters or select patients first.');
                      return;
                    }

                    const exportData = targetPatients.map(patient => ({
                      ...patientExportRow(patient),
                      'Joined Date': patient.created_at ? format(new Date(patient.created_at), 'dd/MM/yyyy') : ''
                    }));
                    
                    // A real workbook: Excel refuses CSV text saved under an .xlsx name as corrupt.
                    // Loaded on demand so the spreadsheet library isn't downloaded with the patient list
                    const XLSX = await import('xlsx');
                    const worksheet = XLSX.utils.json_to_sheet(exportData);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, 'Patients');
                    XLSX.writeFile(workbook, `patients_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

                    toast.success('Patients exported to Excel successfully');
                  } catch {
                    toast.error('Failed to export patients');
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={isExporting || filteredPatients.length === 0}
                className={`p-3 rounded-xl transition-all ${
                  (searchQuery || genderFilter || statusFilter || medicalAidFilter || branchFilter || (showAiSearch && searchDescription) || selectedPatients.length > 0) && filteredPatients.length > 0
                    ? 'text-purple-600 bg-purple-50 hover:bg-purple-100 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                } ${isExporting || filteredPatients.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                title={`Export ${selectedPatients.length > 0 ? selectedPatients.length + ' Selected' : filteredPatients.length} Patient${(selectedPatients.length > 0 ? selectedPatients.length : filteredPatients.length) !== 1 ? 's' : ''} to Excel`}
                aria-label="Export patients to Excel"
              >
                <Icon icon="solar:file-bold-duotone" className="w-5 h-5" />
              </button>

              {/* More: the duplicate finder, for administrators */}
              {isAdministrator && (
                <MoreMenu
                  menuLabel="More patient actions"
                  items={[
                    { label: 'Possible duplicates', icon: 'solar:users-group-two-rounded-bold-duotone', onSelect: () => setShowDuplicates(true) },
                    { label: 'Move to another fund', icon: 'solar:transfer-horizontal-bold-duotone', onSelect: () => setShowFundMove(true) }
                  ]}
                />
              )}

              {/* Add Patient Button - Mobile optimized */}
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-purple-500/25 transition-all duration-300"
              >
                <Icon icon="solar:user-plus-bold-duotone" className="w-5 h-5" />
                <span className="hidden sm:inline">Add Patient</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>

          {/* Quick Filters Row - Hidden on mobile */}
          <div className="flex flex-col gap-4">
            {/* Filter Pills */}
            <div className="hidden lg:flex flex-wrap items-center gap-2">
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
                  All
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
                  All
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
                  All
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

              {/* Branch Filter Button */}
              <button
                onClick={() => setShowBranchModal(true)}
                className={`px-4 py-1.5 bg-gray-100 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                  branchFilter ? 'text-purple-600' : 'text-gray-700'
                } hover:bg-gray-200`}
              >
                <Icon icon="solar:buildings-bold-duotone" className="w-4 h-4" />
                {branchFilter === 'main' ? practiceName : branchFilter ? branches.find(b => b.id === branchFilter)?.name || 'Branch' : 'All Branches'}
                <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-3 h-3" />
              </button>

              {/* Clear All Filters: always rendered (hidden when unused) so the row never reflows */}
              <button
                onClick={() => {
                  setGenderFilter('');
                  setMedicalAidFilter('');
                  setStatusFilter('');
                  setBranchFilter('');
                }}
                aria-hidden={!hasActiveFilters}
                tabIndex={hasActiveFilters ? 0 : -1}
                className={`px-3 py-1.5 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-opacity flex items-center gap-1 ${
                  hasActiveFilters ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-4 h-4" />
                Clear Filters
              </button>

              {/* Results Count */}
              <div className="ml-auto flex items-center gap-4 text-sm">
                {loading ? (
                  <div className="text-gray-500 flex items-center gap-1.5" role="status" aria-live="polite">
                    <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 text-cyan-600 animate-spin" />
                    Loading patients...
                  </div>
                ) : (
                <div className="text-gray-500 tabular-nums">
                  <span className="font-semibold text-gray-900">
                    {selectedPatients.length > 0 ? selectedPatients.length : filteredPatients.length}
                  </span> {selectedPatients.length > 0 ? 'selected' : (filteredPatients.length === 1 ? 'result' : 'results')}
                  {selectedPatients.length > 0 && (
                    <span className="text-xs text-purple-600 ml-1">
                      (from {filteredPatients.length} total)
                    </span>
                  )}
                </div>
                )}
              </div>
            </div>

            {/* Search Bar - Premium Dashboard Style */}
            <div className="mt-4">
              <div className="flex items-center gap-4">
                {/* Search Bar */}
                <div className="flex-1 relative group">
                  {/* Animated gradient glow on hover */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
                  
                  <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
                    {/* Search Icon */}
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                      <Icon 
                        icon="solar:magnifer-bold-duotone" 
                        className="w-5 h-5 transition-colors duration-300 text-gray-600 group-hover:text-gray-700"
                      />
                    </div>
                    
                    <input
                      type="text"
                      value={showAiSearch ? aiSearchQuery : searchQuery}
                      onChange={(e) => {
                        if (showAiSearch) {
                          setAiSearchQuery(e.target.value);
                        } else {
                          handleSearch(e.target.value);
                        }
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && showAiSearch && aiSearchQuery.trim()) {
                          searchPatients(aiSearchQuery);
                        }
                      }}
                      placeholder={showAiSearch ? "Describe patients in natural language..." : "Search by name, ID, cell, reference, old file or medical aid number..."}
                      aria-label={showAiSearch ? 'Describe the patients to find' : 'Search patients'}
                      className="relative w-full pl-12 pr-4 py-3.5 bg-transparent text-base text-gray-800 placeholder-gray-600 focus:outline-none focus:placeholder-gray-500 transition-colors duration-300"
                      disabled={isAiSearching}
                    />
                    
                    {/* Loading indicator for AI search */}
                    {isAiSearching && (
                      <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <Icon icon="solar:hourglass-line-duotone" className="w-5 h-5 text-purple-500 animate-spin" />
                      </div>
                    )}
                    
                    {/* Shimmer effect on hover */}
                    <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 to-transparent pointer-events-none"></div>
                  </div>
                </div>

                {/* CPU chip button - Toggle AI mode */}
                <button
                  onClick={() => {
                    setShowAiSearch(!showAiSearch);
                    if (!showAiSearch) {
                      toast.success('AI search activated - describe patients naturally!');
                      // Clear regular search when switching to AI
                      setSearchQuery('');
                    } else {
                      // Clear AI search when switching back
                      clearAiSearch();
                      setAiSearchQuery('');
                    }
                  }}
                  className={`relative group ${showAiSearch ? 'ring-2 ring-purple-500 rounded-xl' : ''}`}
                  title={showAiSearch ? "Switch to regular search" : "Enable AI search"}
                  aria-label={showAiSearch ? "Switch to regular search" : "Enable AI search"}
                >
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500"></div>
                  <div className={`relative px-4 py-3.5 rounded-xl transition-all ${
                    showAiSearch 
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white' 
                      : 'bg-gray-200 hover:bg-gray-100'
                  }`}>
                    <Icon icon="solar:cpu-bolt-bold-duotone" className="w-5 h-5" />
                  </div>
                </button>
              </div>

              {/* AI Search Progress, Description and Analysis */}
              {showAiSearch && (
                <div className="mt-3 space-y-3">
                  {/* Progress Bar */}

                  {/* Search Results Summary */}
                  {searchDescription && !isAiSearching ? (
                    <div className="space-y-2">
                      {/* Beautiful Search Results Card */}
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative overflow-hidden bg-gradient-to-br from-purple-50 via-indigo-50 to-blue-50 rounded-xl p-4 border border-purple-200 shadow-sm"
                      >
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-purple-200/20 rounded-full blur-2xl" />
                        <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-32 h-32 bg-indigo-200/20 rounded-full blur-2xl" />
                        
                        <div className="relative flex items-start gap-3">
                          {/* Icon with animation */}
                          <motion.div 
                            animate={{ rotate: [0, 5, -5, 0] }}
                            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                            className="flex-shrink-0"
                          >
                            <div className="p-2 bg-purple-100 rounded-lg">
                              <Icon icon="solar:magnifer-zoom-in-bold-duotone" className="w-5 h-5 text-purple-600" />
                            </div>
                          </motion.div>
                          
                          {/* Results content */}
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-purple-900">AI Search Results</h4>
                              <button 
                                onClick={() => {
                                  clearAiSearch();
                                  setAiSearchQuery('');
                                }}
                                className="text-purple-600 hover:text-purple-700 transition-colors"
                                title="Clear search"
                                aria-label="Clear AI search"
                              >
                                <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
                              </button>
                            </div>
                            
                            {/* Enhanced description with better formatting */}
                            <p className="mt-1 text-sm text-gray-700">
                              {(() => {
                                const match = searchDescription.match(/Found (\d+) patients matching: (.+)/);
                                if (match) {
                                  const [, count, query] = match;
                                  const patientCount = parseInt(count);
                                  return (
                                    <>
                                      <span className="font-medium text-purple-700">
                                        {patientCount === 0 ? 'No' : patientCount} 
                                        {' '}patient{patientCount !== 1 ? 's' : ''}
                                      </span>
                                      {' '}
                                      {patientCount === 0 ? 'found' : 'matching your search for'}
                                      {' '}
                                      <span className="font-medium text-indigo-700 italic">"{query}"</span>
                                      {patientCount > 0 && (
                                        <>
                                          {' • '}
                                          <span className="text-gray-600">
                                            {patientCount === 1 ? 'This patient meets' : 'These patients meet'} your specified criteria
                                          </span>
                                        </>
                                      )}
                                    </>
                                  );
                                }
                                return searchDescription;
                              })()}
                            </p>
                            
                            {/* Stats badges */}
                            {aiFilteredPatients && aiFilteredPatients.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <div className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-xs font-medium">
                                  <Icon icon="solar:users-group-rounded-bold-duotone" className="w-3 h-3 inline mr-1" />
                                  {aiFilteredPatients.length} result{aiFilteredPatients.length !== 1 ? 's' : ''}
                                </div>
                                <div className="px-2 py-1 bg-indigo-100 text-indigo-700 rounded-md text-xs font-medium">
                                  <Icon icon="solar:magnifer-bold-duotone" className="w-3 h-3 inline mr-1" />
                                  AI-powered search
                                </div>
                                <div className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-xs font-medium">
                                  <Icon icon="solar:calendar-search-bold-duotone" className="w-3 h-3 inline mr-1" />
                                  {lastSearchQuery}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                      
                      {/* Clear search button (kept for compatibility) */}
                      <button 
                        onClick={() => {
                          clearAiSearch();
                          setAiSearchQuery('');
                        }}
                        className="text-purple-500 hover:text-purple-600 font-medium"
                      >
                        Clear
                      </button>

                    </div>
                  ) : !isAiSearching && (
                    <div className="text-sm text-gray-500">
                      <div className="mb-2">Try natural language searches like:</div>
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={() => {
                            setAiSearchQuery("women over 50 with diabetes");
                            searchPatients("women over 50 with diabetes");
                          }}
                          className="text-left px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-xs"
                        >
                          "women over 50 with diabetes"
                        </button>
                        <button 
                          onClick={() => {
                            setAiSearchQuery("patients who visited last month");
                            searchPatients("patients who visited last month");
                          }}
                          className="text-left px-3 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-xs"
                        >
                          "patients who visited last month"
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Content with divider. At least one screen tall, so a filter that shortens the list can't
            shrink the page under the user's scroll position and make the header jump. */}
        <div className="border-t border-gray-200">
          <div className="p-4 sm:p-6 min-h-screen">
          {loading ? (
              <div className="space-y-3" role="status" aria-live="polite" aria-label="Loading patients">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 rounded-xl border border-gray-100 animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3.5 bg-gray-200 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-1/4" />
                    </div>
                    <div className="hidden md:block h-3 bg-gray-100 rounded w-24" />
                    <div className="hidden md:block h-3 bg-gray-100 rounded w-20" />
                  </div>
                ))}
                <span className="sr-only">Loading patients...</span>
              </div>
            ) : patientsError && patients.length === 0 ? (
              // A failed load used to fall through to "No patients found - add your first patient".
              // Only shown while nothing is loaded, so an already-loaded list is never hidden.
              <div className="py-12 text-center" role="alert">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-16 h-16 text-amber-500 mx-auto mb-4" aria-hidden="true" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Couldn't load patients</h3>
                <p className="text-gray-500 mb-6">Check your connection and try again.</p>
                <button
                  type="button"
                  onClick={() => void fetchPatientsWithVisits()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-white bg-gradient-to-r from-purple-500 to-indigo-600 hover:shadow-lg transition-all"
                >
                  <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5" aria-hidden="true" />
                  Try again
                </button>
              </div>
            ) : filteredPatients.length === 0 ? (
              <div className="py-12 text-center">
                <Icon icon="solar:user-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  {searchQuery || hasActiveFilters ? 'No patients match' : 'No patients found'}
                </h3>
                <p className="text-gray-500 mb-6">
                  {searchQuery || hasActiveFilters ? 'Try adjusting your search or filters' : 'Get started by adding your first patient'}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => {
                      setGenderFilter('');
                      setMedicalAidFilter('');
                      setStatusFilter('');
                      setBranchFilter('');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
                    Clear filters
                  </button>
                )}
                {!searchQuery && !hasActiveFilters && (
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
              // One scroll container (rounded corners clip to it): on narrower desktops the table scrolls
              // sideways instead of having its last columns cut off
              <div className="overflow-x-auto rounded-xl">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left rounded-tl-xl">
                          <input
                            type="checkbox"
                            checked={isAllSelected}
                            aria-label="Select every patient in the list"
                            onChange={selectAllPatients}
                            className="w-5 h-5 text-purple-600 bg-white border-gray-300 rounded focus:ring-purple-500"
                          />
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('name')}
                        >
                          <div className="flex items-center gap-1">
                            Patient
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('age')}
                        >
                          <div className="flex items-center gap-1">
                            Age & Gender
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Contact
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Medical Aid
                        </th>
                        <th
                          className="hidden 2xl:table-cell px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('joined')}
                        >
                          <div className="flex items-center gap-1">
                            Joined
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th 
                          className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700"
                          onClick={() => handleSort('lastVisit')}
                        >
                          <div className="flex items-center gap-1">
                            Encounters
                            <Icon icon="solar:sort-bold-duotone" className="w-4 h-4" />
                          </div>
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider rounded-tr-xl">
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
            )}
            
            {/* Pagination Controls */}
            {!loading && filteredPatients.length > itemsPerPage && (
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
    </div>

      {/* Modals */}
      <FormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Add New Patient"
        size="xl"
      >
        <AddPatientForm
          onCreated={(patient) => {
            // Open the new patient's record so reception can book or check them in straight away
            setSelectedPatientId(patient.id);
            setDetailDefaultTab('overview');
            setDetailVisitIdToEdit(null);
            setIsPatientDetailOpen(true);
          }}
          onSuccess={() => {
            // This used to pass an onClose prop the form never calls, so after a successful
            // registration the form stayed open with no confirmation and the list didn't refresh
            setIsAddModalOpen(false);
            toast.success('Patient registered');
            void fetchPatients();
            if (fetchPatientsWithVisits) void fetchPatientsWithVisits();
          }}
          onUseExisting={(patient) => {
            // The duplicate check found the person's file: open it instead of registering them twice
            setIsAddModalOpen(false);
            setSelectedPatientId(patient.id);
            setDetailDefaultTab('overview');
            setDetailVisitIdToEdit(null);
            setIsPatientDetailOpen(true);
          }}
        />
      </FormModal>

      <FormModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Patient"
        size="xl"
      >
        {selectedPatient && (
          <EditPatientForm
            patientId={selectedPatient.id}
            initialData={{
              first_name: selectedPatient.first_name,
              last_name: selectedPatient.last_name,
              email: selectedPatient.email,
              cell_number: selectedPatient.cell_number,
              date_of_birth: selectedPatient.date_of_birth,
              gender: selectedPatient.gender,
              marital_status: selectedPatient.marital_status || '',
              occupation: selectedPatient.occupation || '',
              employer: selectedPatient.employer || '',
              home_language: selectedPatient.home_language || '',
              home_address: selectedPatient.home_address || '',
              postal_address: selectedPatient.postal_address || '',
              postal_code: selectedPatient.postal_code || '',
              // Read with the list: a change saved since then is shown before it could be overwritten
              updated_at: selectedPatient.updated_at
            }}
            // Called after a save and by the form's Cancel button
            onSuccess={() => {
              setIsEditModalOpen(false);
              setSelectedPatient(null);
              void fetchPatients();
              if (fetchPatientsWithVisits) void fetchPatientsWithVisits();
            }}
          />
        )}
      </FormModal>

      {/* Patient Detail Modal */}
      {selectedPatientId && isPatientDetailOpen && (
        <ComprehensivePatientModal
          isOpen={isPatientDetailOpen}
          onClose={closePatientDetail}
          patientId={selectedPatientId}
          defaultDetailTab={detailDefaultTab}
          visitIdToEdit={detailVisitIdToEdit}
          backAction={cameFromDashboard ? { label: 'Back to dashboard', onClick: () => navigate('/') } : undefined}
          focusNoteId={deepLinkNoteId}
        />
      )}

      {/* More > Possible duplicates (administrators) */}
      {showDuplicates && (
        <PossibleDuplicatesDialog
          practiceId={practiceId}
          onClose={() => setShowDuplicates(false)}
          // A merge archives a file and an undo brings it back: the list reads the files again (not from the cache)
          onFilesChanged={() => {
            if (fetchPatientsWithVisits) void fetchPatientsWithVisits();
            else void fetchPatients();
          }}
          onOpenPatient={(patientId) => {
            setShowDuplicates(false);
            setSelectedPatientId(patientId);
            setDetailDefaultTab('overview');
            setDetailVisitIdToEdit(null);
            setIsPatientDetailOpen(true);
          }}
        />
      )}

      {/* More > Move to another fund (administrators) */}
      {showFundMove && (
        <FundMoveDialog
          practiceId={practiceId}
          onClose={() => setShowFundMove(false)}
          onPatientsChanged={() => {
            if (fetchPatientsWithVisits) void fetchPatientsWithVisits();
            else void fetchPatients();
          }}
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
            <div className="p-4 bg-gray-50 rounded-lg space-y-2">
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-900">
                  {selectedPatients.length > 0 ? selectedPatients.length : filteredPatients.length}
                </span> {selectedPatients.length > 0 ? 'patients selected' : 'patients in the current list (none selected)'}
                {selectedPatients.length > 0 && (
                  <span className="text-xs text-purple-600 ml-2">
                    (from {filteredPatients.length} total)
                  </span>
                )}
              </p>
              
              {messageType === 'sms' && (
                <p className="text-sm text-purple-600">
                  <Icon icon="solar:smartphone-bold-duotone" className="w-4 h-4 inline mr-1" />
                  <span className="font-medium">{getSmsRecipients().length}</span> with valid phone numbers
                </p>
              )}
              
              {messageType === 'email' && (
                <p className="text-sm text-purple-600">
                  <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 inline mr-1" />
                  <span className="font-medium">{getEmailRecipients().length}</span> with valid email addresses
                </p>
              )}
              
              {genderFilter && (
                <p className="text-xs text-gray-500">Gender: {genderFilter}</p>
              )}
              {statusFilter && (
                <p className="text-xs text-gray-500">Status: {statusFilter}</p>
              )}
              {medicalAidFilter && (
                <p className="text-xs text-gray-500">
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
                setShowMessageModal(false);
                if (messageType === 'sms') {
                  const smsRecipients = getSmsRecipients();
                  if (smsRecipients.length === 0) {
                    toast.error('No patients with valid phone numbers found');
                    return;
                  }
                  setShowSmsModal(true);
                } else {
                  const emailRecipients = getEmailRecipients();
                  if (emailRecipients.length === 0) {
                    toast.error('No patients with valid email addresses found');
                    return;
                  }
                  setShowEmailModal(true);
                }
              }}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all"
            >
              Continue to Compose
            </button>
          </div>
        </div>
      </FormModal>

      {/* Branch Selection Modal */}
      <FormModal
        isOpen={showBranchModal}
        onClose={() => setShowBranchModal(false)}
        title="Select Branch"
        size="sm"
      >
        <div className="space-y-2">
          {/* All Branches Option */}
          <button
            onClick={() => {
              setBranchFilter('');
              setShowBranchModal(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center justify-between ${
              !branchFilter
                ? 'bg-purple-50 text-purple-700 border-2 border-purple-500'
                : 'hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon icon="solar:buildings-bold-duotone" className="w-5 h-5" />
              <div>
                <span className="font-medium">All Branches</span>
                <span className="text-xs text-gray-500 block">All patients</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                {allPatientsCount}
              </span>
              {!branchFilter && (
                <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-purple-600" />
              )}
            </div>
          </button>
          
          {/* Main Practice Option */}
          <button
            onClick={() => {
              setBranchFilter('main');
              setShowBranchModal(false);
            }}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center justify-between ${
              branchFilter === 'main'
                ? 'bg-purple-50 text-purple-700 border-2 border-purple-500'
                : 'hover:bg-gray-50 border border-gray-200'
            }`}
          >
            <div className="flex items-center gap-3">
              <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5" />
              <div>
                <span className="font-medium">{practiceName || 'Main Practice'}</span>
                <span className="text-xs text-gray-500 block">Head office patients</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">
                {branchPatientCounts.main || 0}
              </span>
              {branchFilter === 'main' && (
                <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-purple-600" />
              )}
            </div>
          </button>
          
          {/* Branch Options */}
          {branches.map((branch) => (
            <button
              key={branch.id}
              onClick={() => {
                setBranchFilter(branch.id);
                setShowBranchModal(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-lg transition-all flex items-center justify-between ${
                branchFilter === branch.id
                  ? 'bg-purple-50 text-purple-700 border-2 border-purple-500'
                  : 'hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon icon="solar:buildings-2-bold-duotone" className="w-5 h-5" />
                <div>
                  <span className="font-medium">{branch.name}</span>
                  <span className="text-xs text-gray-500 block">Branch location</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">
                  {branchPatientCounts[branch.id] || 0}
                </span>
                {branchFilter === branch.id && (
                  <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-purple-600" />
                )}
              </div>
            </button>
          ))}
        </div>
      </FormModal>

      {/* Professional SMS Modal - For bulk sending */}
      {showSmsModal && getSmsRecipients().length > 0 && (
        <ProfessionalSmsModal
          isOpen={showSmsModal}
          onClose={() => setShowSmsModal(false)}
          recipients={getSmsRecipients()}
          onSend={handleSendSms}
          isSending={isSendingSms}
        />
      )}

      {/* Professional Email Modal - For bulk sending */}
      {showEmailModal && getEmailRecipients().length > 0 && (
        <ProfessionalEmailModal
          isOpen={showEmailModal}
          onClose={() => setShowEmailModal(false)}
          recipients={getEmailRecipients()}
          onSend={handleSendEmail}
          isSending={isSendingEmail}
        />
      )}
    </div>
  );
};

export default PatientManagementView;