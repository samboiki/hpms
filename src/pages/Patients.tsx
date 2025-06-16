import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Users, 
  Search, 
  User,
  ChevronRight,
  FileText,
  Calendar,
  Phone,
  Mail,
  Clock,
  AlertCircle,
  LayoutGrid,
  List,
  ArrowUpDown,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronDown,
  Heart,
  Activity,
  Shield,
  Star,
  Sparkles,
  UserPlus,
  Download,
  Check,
  X,
  Eye,
  Copy,
  MapPin,
  Stethoscope,
  Bot,
  Loader2,
  Send
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import FormModal from '../components/modals/FormModal';
import AddPatientForm from '../components/forms/AddPatientForm';
import EditPatientForm from '../components/forms/EditPatientForm';
import ComprehensivePatientModal from '../components/patients/ComprehensivePatientModal';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';
import { usePatientsStoreNew, Patient } from '../stores/patientsStoreNew';
import { useTheme } from '../stores/themeStore';
import { toast } from 'react-hot-toast';
import { defaultSMSService } from '../services/smsPortal';

interface PatientOld {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  cell_number: string;
  date_of_birth: string;
  gender: string;
  marital_status?: string;
  occupation?: string;
  employer?: string;
  home_language?: string;
  home_address?: string;
  postal_address?: string;
  postal_code?: string;
  created_at: string;
  medical_aid_details?: {
    id?: string;
    provider: string;
    scheme?: string;
    membership_number: string;
    plan_type?: string;
    main_member_name?: string;
    main_member_id_number?: string;
    relationship_to_main?: string;
  };
  next_of_kin?: {
    id?: string;
    name?: string;
    relationship?: string;
    phone?: string;
    address?: string;
  }[];
}

const ITEMS_PER_PAGE = 20;

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

const Patients: React.FC = () => {
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const { patients, isLoading, error, fetchPatients: fetchPatientsFromStore, searchPatients } = usePatientsStoreNew();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddPatientModalOpen, setIsAddPatientModalOpen] = useState(false);
  const [isEditPatientModalOpen, setIsEditPatientModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'age'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedFilter, setSelectedFilter] = useState<string>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [statFilter, setStatFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string>('all-time');
  const [showExportModal, setShowExportModal] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [aiFilters, setAiFilters] = useState<any>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailContent, setEmailContent] = useState('');
  const [smsContent, setSmsContent] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingSms, setIsSendingSms] = useState(false);
  
  // Define calculateAge before using it
  const calculateAge = (dateOfBirth: string) => {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };
  
  useEffect(() => {
    console.log('🏥 Patients page loaded');
    fetchPatientsFromStore();
  }, []);
  
  // Debug effect to log state changes
  useEffect(() => {
    console.log('📊 AI Filters state changed:', aiFilters);
  }, [aiFilters]);

  // Debounced search
  useEffect(() => {
    if (searchTerm) {
      const timeoutId = setTimeout(() => {
        searchPatients(searchTerm);
      }, 300);
      return () => clearTimeout(timeoutId);
    } else if (!aiFilters) {
      fetchPatientsFromStore();
    }
  }, [searchTerm, fetchPatientsFromStore, searchPatients]);

  // Memoized filtered patients for better performance
  const filteredPatients = useMemo(() => {
    // If AI search results are available, use them
    if (aiFilters && aiFilters.results) {
      return aiFilters.results;
    }
    
    // Otherwise, apply regular filters
    const filtered = patients.filter(patient => {
      // Apply stat filter first if active
      if (statFilter) {
        if (statFilter === 'total') {
          // Show all patients
        } else if (statFilter === 'active') {
          // In real app, would check active status
        } else if (statFilter === 'new') {
          // In real app, would check new status  
        } else if (statFilter === 'insured' && !patient.medical_aid_details) {
          return false;
        }
      }
      
      // Apply date filter
      if (dateFilter !== 'all-time') {
        const patientDate = new Date(patient.created_at);
        const now = new Date();
        let matchesDate = true;
        
        switch (dateFilter) {
          case 'today':
            matchesDate = patientDate.toDateString() === now.toDateString();
            break;
          case 'this-week':
            const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            matchesDate = patientDate >= weekAgo;
            break;
          case 'this-month':
            matchesDate = patientDate.getMonth() === now.getMonth() && 
                         patientDate.getFullYear() === now.getFullYear();
            break;
          case 'last-3-months':
            const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            matchesDate = patientDate >= threeMonthsAgo;
            break;
          case 'this-year':
            matchesDate = patientDate.getFullYear() === now.getFullYear();
            break;
        }
        
        if (!matchesDate) return false;
      }
      
      // Apply regular filter
      if (selectedFilter === 'medical-aid' && !patient.medical_aid_details) return false;
      if (selectedFilter === 'female' && patient.gender?.toLowerCase() !== 'female') return false;
      if (selectedFilter === 'male' && patient.gender?.toLowerCase() !== 'male') return false;
      if (selectedFilter === 'appointments' && (patient.id.length % 3 !== 0)) return false; // Simulated
      
      return true;
    });
    
    // Sort the results
    return filtered.sort((a: Patient, b: Patient) => {
      if (sortBy === 'name') {
        const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
        const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
        return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
      } else if (sortBy === 'date') {
        const dateA = new Date(a.date_of_birth).getTime();
        const dateB = new Date(b.date_of_birth).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      } else {
        const ageA = calculateAge(a.date_of_birth);
        const ageB = calculateAge(b.date_of_birth);
        return sortOrder === 'asc' ? ageA - ageB : ageB - ageA;
      }
    });
  }, [patients, aiFilters, statFilter, dateFilter, selectedFilter, sortBy, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredPatients.length / ITEMS_PER_PAGE);
  const paginatedPatients = filteredPatients.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const handlePatientAdded = () => {
    setIsAddPatientModalOpen(false);
    fetchPatientsFromStore();
  };

  const handlePatientUpdated = () => {
    setIsEditPatientModalOpen(false);
    setSelectedPatient(null);
    fetchPatientsFromStore();
  };

  const toggleSort = (field: 'name' | 'date' | 'age') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const handleEdit = (patient: Patient, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPatient(patient);
    setIsEditPatientModalOpen(true);
  };

  const handleDelete = async (patientId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (showDeleteConfirm === patientId) {
      try {
        const { error } = await supabase
          .from('patients')
          .delete()
          .eq('id', patientId);

        if (error) throw error;
        
        setPatients(patients.filter(p => p.id !== patientId));
        setShowDeleteConfirm(null);
      } catch (error) {
        console.error('Error deleting patient:', error);
        alert('Failed to delete patient');
      }
    } else {
      setShowDeleteConfirm(patientId);
      setTimeout(() => setShowDeleteConfirm(null), 3000);
    }
  };

  const handleExport = (exportFormat: 'csv' | 'json') => {
    const exportData = filteredPatients.map((p: Patient) => ({
      name: `${p.first_name} ${p.last_name}`,
      email: p.email || '',
      phone: p.cell_number || '',
      dateOfBirth: p.date_of_birth,
      gender: p.gender,
      medicalAid: p.medical_aid_details?.provider || 'None',
      occupation: p.occupation || '',
      employer: p.employer || '',
      maritalStatus: p.marital_status || '',
      emergencyContact: p.emergency_contact_name || '',
      emergencyPhone: p.emergency_contact_phone || '',
      registeredDate: p.created_at
    }));

    if (exportFormat === 'csv') {
      const csvContent = [
        ['Name', 'Email', 'Phone', 'DOB', 'Gender', 'Medical Aid', 'Occupation', 'Employer', 'Marital Status', 'Emergency Contact', 'Emergency Phone', 'Registered'],
        ...exportData.map((p: any) => [
          p.name,
          p.email,
          p.phone,
          p.dateOfBirth,
          p.gender,
          p.medicalAid,
          p.occupation,
          p.employer,
          p.maritalStatus,
          p.emergencyContact,
          p.emergencyPhone,
          format(new Date(p.registeredDate), 'yyyy-MM-dd')
        ])
      ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${format(new Date(), 'yyyy-MM-dd')}_filtered.csv`;
      a.click();
    } else {
      const jsonContent = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `patients_${format(new Date(), 'yyyy-MM-dd')}_filtered.json`;
      a.click();
    }
    setShowExportModal(false);
  };

  const handleSendEmail = async () => {
    const patientsWithEmail = filteredPatients.filter(p => p.email);
    if (patientsWithEmail.length === 0) {
      alert('No patients with email addresses in the current filtered list.');
      return;
    }
    
    setEmailSubject('Important Health Information from OneHealth Practice');
    setEmailContent(`Dear Patient,

We hope this message finds you in good health. We wanted to reach out with some important information regarding your healthcare.

Please don't hesitate to contact our office if you have any questions or concerns. We're here to support your health journey.

Stay healthy and take care.

Best regards,
OneHealth Medical Team`);
    setIsEmailModalOpen(true);
  };

  const handleSendSMS = () => {
    const patientsWithPhone = filteredPatients.filter(p => p.cell_number);
    if (patientsWithPhone.length === 0) {
      alert('No patients with phone numbers in the current filtered list.');
      return;
    }
    
    setSmsContent(`Hello,

This is a message from OneHealth Practice. Please contact us at your earliest convenience if you have any questions about your healthcare.

Best regards,
OneHealth Medical Team

Phone: +264 61 123 4567
Email: info@onehealth.com.na`);
    setIsSmsModalOpen(true);
  };

  const handleAiSearch = async () => {
    if (!searchTerm.trim() || isAiSearching) return;
    
    console.log('🔍 AI Search initiated with query:', searchTerm);
    setIsAiSearching(true);
    
    try {
      // Always try the Edge Function first for proper AI-powered search
      console.log('📡 Calling Edge Function ai-search-patients...');
      const { data, error } = await supabase.functions.invoke('ai-search-patients', {
        body: {
          query: searchTerm
        }
      });
      
      console.log('📨 Edge Function response:', { data, error });
      
      if (error) {
        console.error('❌ Edge Function error:', error);
        throw error;
      }
      
      if (!data || !data.sql_query) {
        console.error('❌ No SQL query returned from Edge Function');
        throw new Error('No SQL query generated');
      }
      
      console.log('✅ SQL Query generated:', data.sql_query);
      console.log('📝 Query description:', data.description);
      
      let queryResults: Patient[] | null = null;
      let queryError: any = null;
      
      // Parse the SQL query to extract conditions
      console.log('🔍 Parsing SQL query to build Supabase query...');
      
      try {
        // Extract WHERE conditions
        const whereMatch = data.sql_query.match(/WHERE\s+(.*?)\s+ORDER\s+BY/is);
        
        if (whereMatch) {
          const conditions = whereMatch[1];
          console.log('📋 WHERE conditions:', conditions);
          
          // Check if it's a simple patient query or has joins
          const hasJoins = data.sql_query.toLowerCase().includes('join');
          
          if (!hasJoins && conditions) {
            // Simple patient query - parse conditions
            let filteredPatients = [...patients];
            
            // Handle ILIKE conditions
            const ilikeMatches = [...conditions.matchAll(/(?:patients\.)?(\w+)\s+ILIKE\s+'%([^%]+)%'/gi)];
            for (const match of ilikeMatches) {
              const [_, column, value] = match;
              console.log(`🔍 Filtering by ${column} ILIKE '%${value}%'`);
              filteredPatients = filteredPatients.filter(p => {
                const fieldValue = p[column as keyof Patient];
                return fieldValue && String(fieldValue).toLowerCase().includes(value.toLowerCase());
              });
            }
            
            // Handle equality conditions
            const equalMatches = [...conditions.matchAll(/(?:patients\.)?(\w+)\s*=\s*'([^']+)'/gi)];
            for (const match of equalMatches) {
              const [_, column, value] = match;
              console.log(`🔍 Filtering by ${column} = '${value}'`);
              filteredPatients = filteredPatients.filter(p => {
                const fieldValue = p[column as keyof Patient];
                return String(fieldValue) === value;
              });
            }
            
            // Handle age comparisons
            const ageMatch = conditions.match(/EXTRACT\(YEAR FROM AGE\(patients\.date_of_birth\)\)\s*([><=]+)\s*(\d+)/i);
            if (ageMatch) {
              const [_, operator, ageValue] = ageMatch;
              const age = parseInt(ageValue);
              console.log(`🎂 Filtering by age ${operator} ${age}`);
              
              filteredPatients = filteredPatients.filter(p => {
                const patientAge = calculateAge(p.date_of_birth);
                switch(operator) {
                  case '>': return patientAge > age;
                  case '<': return patientAge < age;
                  case '>=': return patientAge >= age;
                  case '<=': return patientAge <= age;
                  case '=': return patientAge === age;
                  default: return true;
                }
              });
            }
            
            queryResults = filteredPatients;
            console.log(`✅ Filtered to ${queryResults.length} patients`);
            
          } else if (hasJoins) {
            // Complex query with joins - need to handle differently
            console.log('⚠️ Complex query with joins detected');
            
            // For visits joins, extract the complaint
            const complaintMatch = data.sql_query.match(/chief_complaint\s+ILIKE\s+'%([^%]+)%'/i);
            if (complaintMatch) {
              const complaint = complaintMatch[1];
              console.log(`🏥 Searching for visits with complaint: ${complaint}`);
              
              // Query visits table
              const { data: visits, error: visitsError } = await supabase
                .from('visits')
                .select('patient_id')
                .ilike('chief_complaint', `%${complaint}%`);
              
              if (!visitsError && visits) {
                const patientIds = [...new Set(visits.map(v => v.patient_id))];
                queryResults = patients.filter(p => patientIds.includes(p.id));
                console.log(`✅ Found ${queryResults.length} patients with complaint "${complaint}"`);
              } else {
                queryError = visitsError;
              }
            } else {
              queryResults = [];
              queryError = new Error('Complex join query not supported locally');
            }
          }
        } else {
          // No WHERE clause - return all patients
          queryResults = patients;
        }
      } catch (err) {
        console.error('❌ Error parsing SQL:', err);
        queryError = err;
        queryResults = [];
      }
      
      console.log('📊 Query execution response:', { 
        queryResults, 
        queryError,
        resultCount: queryResults?.length || 0 
      });
      
      if (queryError) {
        console.error('❌ RPC execution error:', queryError);
        throw queryError;
      }
      
      if (queryResults) {
        console.log('✅ Query executed successfully. Found', queryResults.length, 'patients');
        
        setAiFilters({
          results: queryResults,
          description: data.description || searchTerm,
          sql_query: data.sql_query
        });
        setCurrentPage(1);
        
        if (queryResults.length === 0) {
          console.log('⚠️ No patients found matching criteria');
          alert('No patients found matching your criteria.');
        } else {
          console.log('🎉 AI search completed successfully');
        }
        
        setIsAiSearching(false);
        return;
      }
      
      // If Edge Function is not available, show instructions
      alert(`AI search requires the Edge Function to be deployed.

Your query: "${searchTerm}"

This type of complex query (combining medical conditions with demographics) requires the AI-powered search to work properly.

To enable AI search:
1. Deploy the Edge Function: npx supabase functions deploy ai-search-patients
2. Set OPENAI_API_KEY in Supabase dashboard
3. Apply the database migrations for execute_ai_query function

The AI uses GPT-4 to understand natural language queries like:
- "patients with coughing over the age of 37"
- "female patients under 40 with diabetes"
- "everyone who complained of headaches last month"`);
      
      setIsAiSearching(false);
    } catch (error: any) {
      console.error('❌ AI search error:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        response: error?.response,
        data: error?.data
      });
      
      // More specific error messages
      let errorMessage = 'AI search failed. ';
      if (error?.message?.includes('CORS')) {
        errorMessage += 'CORS error - check Edge Function deployment.';
      } else if (error?.message?.includes('execute_ai_query')) {
        errorMessage += 'Database function error - check if migrations are applied.';
      } else if (error?.message?.includes('OpenAI')) {
        errorMessage += 'OpenAI API error - check API key configuration.';
      } else {
        errorMessage += 'Please check console for details.';
      }
      
      alert(errorMessage);
      setIsAiSearching(false);
    }
  };

  const handleRowClick = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsPatientModalOpen(true);
  };

  // Calculate filtered patients for stats
  const getFilteredPatientsForStats = () => {
    return patients.filter(patient => {
      const patientDate = new Date(patient.created_at);
      const now = new Date();
      
      switch (dateFilter) {
        case 'today':
          return patientDate.toDateString() === now.toDateString();
        case 'this-week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          return patientDate >= weekAgo;
        case 'this-month':
          return patientDate.getMonth() === now.getMonth() && 
                 patientDate.getFullYear() === now.getFullYear();
        case 'last-3-months':
          const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          return patientDate >= threeMonthsAgo;
        case 'this-year':
          return patientDate.getFullYear() === now.getFullYear();
        default: // 'all-time'
          return true;
      }
    });
  };

  const filteredPatientsForStats = getFilteredPatientsForStats();

  // Stats with modern colors
  const stats = [
    { 
      label: 'Total Patients', 
      value: filteredPatientsForStats.length.toString(),
      change: '+12%',
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      id: 'total'
    },
    { 
      label: 'Active Patients', 
      value: Math.floor(filteredPatientsForStats.length * 0.8).toString(),
      change: '+5%',
      trend: 'up',
      icon: Activity,
      gradient: 'from-emerald-500 to-green-600',
      id: 'active'
    },
    { 
      label: 'New This Month', 
      value: Math.floor(filteredPatientsForStats.length * 0.1).toString(),
      change: '+18%',
      trend: 'up',
      icon: UserPlus,
      gradient: 'from-purple-500 to-indigo-600',
      id: 'new'
    },
    { 
      label: 'Insured', 
      value: filteredPatientsForStats.filter((p: Patient) => p.medical_aid_details).length.toString(),
      change: '+3%',
      trend: 'up',
      icon: Shield,
      gradient: 'from-cyan-500 to-blue-600',
      id: 'insured'
    }
  ];

  const filterOptions = [
    { id: 'all', label: 'All', icon: Users, count: filteredPatientsForStats.length },
    { id: 'medical-aid', label: 'Insured', icon: Shield, count: filteredPatientsForStats.filter((p: Patient) => p.medical_aid_details).length },
    { id: 'female', label: 'Female', icon: FemaleIcon, count: filteredPatientsForStats.filter((p: Patient) => p.gender.toLowerCase() === 'female').length },
    { id: 'male', label: 'Male', icon: MaleIcon, count: filteredPatientsForStats.filter((p: Patient) => p.gender.toLowerCase() === 'male').length },
    { id: 'appointments', label: 'Has Appointments', icon: Calendar, count: filteredPatientsForStats.filter((p: Patient) => p.id.length % 3 === 0).length },
    { id: 'favorites', label: 'Starred', icon: Star, count: 0 }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50/80 to-blue-50/20">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Compact Professional Header */}
        <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 md:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-semibold text-gray-800">Patient Directory</h1>
                <p className="text-sm text-gray-500 mt-0.5">Manage and track patient information</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`w-full lg:w-auto bg-gradient-to-r ${currentTheme.gradients.button} text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg transition-all duration-200 font-medium text-sm`}
                onClick={() => setIsAddPatientModalOpen(true)}
              >
                <UserPlus className="w-4 h-4" />
                Add New Patient
              </motion.button>
            </div>

            {/* Premium Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -1, scale: 1.01 }}
                  className="relative group cursor-pointer"
                  onClick={() => {
                    if (statFilter === stat.id) {
                      setStatFilter(null);
                    } else {
                      setStatFilter(stat.id);
                      setSelectedFilter('all');
                    }
                    setCurrentPage(1);
                  }}
                >
                  {/* Subtle Gradient Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-xl blur-md opacity-5 group-hover:opacity-15 transition-opacity duration-200`}></div>
                  
                  {/* Glass Card */}
                  <div className={`relative bg-white/60 backdrop-blur-sm border rounded-xl p-3 transition-all duration-200 shadow-sm ${
                    statFilter === stat.id 
                      ? `border-${currentTheme.colors.primary.from}/30 shadow-lg bg-gradient-to-br ${currentTheme.gradients.sidebar} opacity-15` 
                      : 'border-gray-200/40 hover:border-gray-300/50 hover:shadow-md'
                  }`}
>
                    <div className="flex items-center justify-between mb-2">
                      <div className={`p-2 bg-gradient-to-br ${stat.gradient} rounded-lg shadow-md`}>
                        <stat.icon className="w-4 h-4 text-white" />
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                        stat.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 
                        stat.trend === 'down' ? 'bg-rose-100 text-rose-700' : 
                        'bg-gray-100 text-gray-600'
                      }`}>
                        {stat.change}
                      </span>
                    </div>
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-1">{stat.value}</p>
                    <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                    
                    {/* Active Indicator */}
                    {statFilter === stat.id && (
                      <div className={`absolute top-2 right-2 w-2 h-2 rounded-full`} style={{ backgroundColor: currentTheme.colors.primary.from }} />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search Bar with AI */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search patients by name, email, or phone..."
                  className="w-full pl-10 pr-16 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                    // Clear AI filters when typing normally
                    if (aiFilters) {
                      setAiFilters(null);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchTerm.trim()) {
                      handleAiSearch();
                    }
                  }}
                />
                
                {/* AI Search Button - positioned inside input */}
                <button
                  onClick={handleAiSearch}
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
              
              {/* AI Filter Indicator */}
              {aiFilters && (
                <div className={`mt-2 bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white text-xs px-3 py-2 rounded-md shadow-lg`}>
                  <div className="flex items-center gap-2">
                    <Bot className="w-3 h-3" />
                    <span>AI filtered: {aiFilters.description}</span>
                    <button
                      onClick={() => {
                        console.log('🧹 Clearing AI filters');
                        setAiFilters(null);
                        setSearchTerm('');
                      }}
                      className="ml-auto hover:bg-white/20 rounded p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setIsAddPatientModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium"
              >
                <UserPlus className="w-4 h-4" />
                Add Patient
              </button>
              <button
                onClick={() => setView(view === 'grid' ? 'list' : 'grid')}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
              >
                <List className="w-4 h-4" />
              </button>
              {/* Date Filter Dropdown */}
              <div className="relative">
                <select
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium appearance-none pr-8 hover:bg-gray-100 transition-all cursor-pointer"
                >
                  <option value="all-time">All Time</option>
                  <option value="today">Today</option>
                  <option value="this-week">This Week</option>
                  <option value="this-month">This Month</option>
                  <option value="last-3-months">Last 3 Months</option>
                  <option value="this-year">This Year</option>
                </select>
                <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              </div>
              
              
              
              {/* SMS Button */}
              <button
                onClick={handleSendSMS}
                className="px-2 py-1 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-md flex items-center gap-1 hover:shadow-md transition-all text-xs font-medium"
              >
                <Phone className="w-3 h-3" />
                <span className="text-xs">SMS</span>
              </button>
              
              {/* Email Button */}
              <button
                onClick={handleSendEmail}
                className="px-2 py-1 bg-gradient-to-br from-blue-500 to-indigo-600 text-white rounded-md flex items-center gap-1 hover:shadow-md transition-all text-xs font-medium"
              >
                <Mail className="w-3 h-3" />
                <span className="text-xs">Email</span>
              </button>
              
              {/* Export Button */}
              <button
                onClick={() => setShowExportModal(true)}
                className={`px-2 py-1 bg-gradient-to-br ${currentTheme.gradients.button} text-white rounded-md flex items-center gap-1 hover:shadow-md transition-all text-xs font-medium`}
              >
                <Download className="w-3 h-3" />
                <span className="text-xs">Export</span>
              </button>
            </div>
          </div>

          {/* Filter Pills with Counts */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {filterOptions.map((filter) => (
              <motion.button
                key={filter.id}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedFilter(filter.id)}
                className={`px-3 py-2 rounded-full flex items-center gap-1.5 transition-all text-sm font-medium border ${
                  selectedFilter === filter.id
                    ? `bg-gradient-to-br ${currentTheme.gradients.button} text-white border-transparent shadow-sm`
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

        {/* Main Content */}
        {isLoading ? (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-center py-20"
          >
            <div className="text-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-3 border-violet-500 border-t-transparent rounded-full mx-auto mb-4"
              />
              <p className="text-gray-600 text-sm">Loading patients...</p>
            </div>
          </motion.div>
        ) : error ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20"
          >
            <div className="bg-white rounded-xl p-8 max-w-sm mx-auto border border-red-200">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
              <p className="text-gray-900 font-medium mb-2">Unable to load patients</p>
              <p className="text-gray-600 text-sm mb-4">{error}</p>
              <button
                onClick={() => fetchPatientsFromStore()}
                className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium"
              >
                Try Again
              </button>
            </div>
          </motion.div>
        ) : (
          <>
            {view === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {paginatedPatients.map((patient: Patient, index: number) => (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    whileHover={{ y: -4 }}
                    onHoverStart={() => setHoveredCard(patient.id)}
                    onHoverEnd={() => setHoveredCard(null)}
                    className="group relative"
                  >
                    <div 
                      className={`relative bg-white rounded-xl border-2 ${
                        hoveredCard === patient.id 
                          ? patient.gender.toLowerCase() === 'female'
                            ? 'border-pink-300 shadow-lg shadow-pink-100/50 scale-[1.02]' 
                            : 'border-blue-300 shadow-lg shadow-blue-100/50 scale-[1.02]'
                          : patient.gender.toLowerCase() === 'female'
                            ? 'border-pink-100'
                            : 'border-blue-100'
                      } p-3 cursor-pointer transition-all duration-200 overflow-hidden hover:shadow-md`}
                      onClick={() => handleRowClick(patient.id)}
                    >
                      
                      <div className="flex items-start justify-between mb-2">
                        <div className="relative">
                          <div className={`h-10 w-10 rounded-lg flex items-center justify-center text-white shadow-sm ${
                            patient.gender.toLowerCase() === 'female'
                              ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                              : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                          }`}>
                            <User className="w-5 h-5" />
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-emerald-500 rounded-full border border-white" />
                        </div>
                        
                        {/* Quick Actions */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => handleEdit(patient, e)}
                            className="p-1 bg-gray-100 text-gray-600 rounded-md hover:bg-[#01b9d5] hover:text-white transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(patient.id, e)}
                            className={`p-1 rounded-md transition-colors ${
                              showDeleteConfirm === patient.id
                                ? 'bg-red-500 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-red-500 hover:text-white'
                            }`}
                          >
                            {showDeleteConfirm === patient.id ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Trash2 className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="mb-2">
                        <h3 className="font-semibold text-gray-800 text-base flex items-center gap-2">
                          {patient.first_name} {patient.last_name}
                          {patient.medical_aid_details && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="flex items-center gap-0.5"
                            >
                              <Shield className="w-3 h-3 text-cyan-500" />
                              <span className="text-xs text-cyan-600 font-medium">
                                {patient.medical_aid_details.provider}
                              </span>
                            </motion.div>
                          )}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            patient.gender.toLowerCase() === 'female'
                              ? 'bg-pink-100 text-pink-700 border border-pink-200'
                              : 'bg-blue-100 text-blue-700 border border-blue-200'
                          }`}>
                            {calculateAge(patient.date_of_birth)} yrs
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                            patient.gender.toLowerCase() === 'female'
                              ? 'bg-pink-50 text-pink-600'
                              : 'bg-blue-50 text-blue-600'
                          }`}>
                            {patient.gender}
                          </span>
                        </div>
                      </div>
                      
                      <div className="space-y-1 text-xs">
                        <div className="flex items-center text-gray-600">
                          <Mail className="w-3 h-3 mr-1.5 text-gray-400" />
                          <span className="truncate">{patient.email || 'No email'}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Phone className="w-3 h-3 mr-1.5 text-gray-400" />
                          <span className="truncate">{patient.cell_number || 'No phone'}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="w-3 h-3 mr-1.5 text-gray-400" />
                          <span>{format(new Date(patient.date_of_birth), 'MMM d, yyyy')}</span>
                        </div>
                        <div className="flex items-center text-gray-500 text-xs">
                          <Clock className="w-3 h-3 mr-1.5 text-gray-400" />
                          <span>Since {format(new Date(patient.created_at), 'MMM yyyy')}</span>
                        </div>
                        {patient.medical_aid_details?.membership_number && (
                          <div className="flex items-center text-gray-600">
                            <Shield className="w-3 h-3 mr-1.5 text-gray-400" />
                            <span className="truncate">#{patient.medical_aid_details.membership_number}</span>
                          </div>
                        )}
                      </div>

                      {/* Bottom Action Bar */}
                      <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            className="text-gray-400 hover:text-[#01b9d5] transition-colors p-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Star className="w-3 h-3" />
                          </button>
                          <button
                            className="text-gray-400 hover:text-pink-500 transition-colors p-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Heart className="w-3 h-3" />
                          </button>
                        </div>
                        <button className="flex items-center gap-1 text-xs text-[#01b9d5] font-medium hover:gap-1.5 transition-all">
                          View
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {/* Column Headers for List View */}
                <div className="bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg border border-gray-300 shadow-sm overflow-hidden">
                  <div className="flex items-center text-sm font-semibold text-gray-800 px-4 py-3">
                    <div className="w-14"></div>
                    <div className="flex-1 grid grid-cols-5 gap-4 items-center ml-2">
                      <button
                        onClick={() => toggleSort('name')}
                        className="col-span-2 flex items-center gap-2 hover:text-[#01b9d5] transition-colors group text-left"
                      >
                        <span>Patient Name</span>
                        <motion.div
                          animate={{ rotate: sortBy === 'name' && sortOrder === 'desc' ? 180 : 0 }}
                          className={`transition-colors ${sortBy === 'name' ? 'text-[#01b9d5]' : 'text-gray-400'}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.div>
                      </button>
                      <div>Contact Info</div>
                      <button
                        onClick={() => toggleSort('age')}
                        className="flex items-center gap-2 hover:text-[#01b9d5] transition-colors group"
                      >
                        <span>Age/Gender</span>
                        <motion.div
                          animate={{ rotate: sortBy === 'age' && sortOrder === 'desc' ? 180 : 0 }}
                          className={`transition-colors ${sortBy === 'age' ? 'text-[#01b9d5]' : 'text-gray-400'}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.div>
                      </button>
                      <div>Medical Aid</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleSort('date')}
                        className="w-[100px] text-center flex items-center justify-center gap-2 hover:text-[#01b9d5] transition-colors group"
                      >
                        <span>Registered</span>
                        <motion.div
                          animate={{ rotate: sortBy === 'date' && sortOrder === 'desc' ? 180 : 0 }}
                          className={`transition-colors ${sortBy === 'date' ? 'text-[#01b9d5]' : 'text-gray-400'}`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </motion.div>
                      </button>
                      <div className="w-[130px] text-center">Actions</div>
                    </div>
                  </div>
                </div>
                
                {paginatedPatients.map((patient: Patient, index: number) => (
                  <motion.div
                    key={patient.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="group"
                  >
                    <div className={`bg-white rounded-xl border-l-4 border-r border-t border-b ${
                      hoveredCard === patient.id 
                        ? patient.gender.toLowerCase() === 'female'
                          ? 'border-l-pink-400 border-pink-200 shadow-md shadow-pink-100/50' 
                          : 'border-l-blue-400 border-blue-200 shadow-md shadow-blue-100/50'
                        : patient.gender.toLowerCase() === 'female'
                          ? 'border-l-pink-200 border-gray-200'
                          : 'border-l-blue-200 border-gray-200'
                    } overflow-hidden transition-all`}>
                      <div 
                        className="flex items-center p-4 hover:bg-gray-50/50 cursor-pointer"
                        onClick={() => handleRowClick(patient.id)}
                        onMouseEnter={() => setHoveredCard(patient.id)}
                        onMouseLeave={() => setHoveredCard(null)}
                      >
                        
                        <div className="flex items-center flex-1 gap-4 ml-2">
                          <div className="relative">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center text-white shadow-md ${
                              patient.gender.toLowerCase() === 'female'
                                ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                                : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                            }`}>
                              <User className="w-6 h-6" />
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-white" />
                          </div>
                          
                          <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                            <div className="col-span-2">
                              <h3 className="font-semibold text-gray-900 text-base">
                                {patient.first_name} {patient.last_name}
                              </h3>
                              <p className="text-sm text-gray-500 mt-0.5">
                                Last visit: {format(new Date(), 'MMM d, yyyy')}
                              </p>
                            </div>
                            
                            <div className="text-sm text-gray-600">
                              <div className="flex items-center gap-1.5">
                                <Mail className="w-4 h-4 text-gray-400" />
                                <span className="truncate">{patient.email || 'No email'}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-1">
                                <Phone className="w-4 h-4 text-gray-400" />
                                <span>{patient.cell_number || 'No phone'}</span>
                              </div>
                            </div>
                            
                            <div className="text-sm">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                patient.gender.toLowerCase() === 'female'
                                  ? 'bg-pink-100 text-pink-700'
                                  : 'bg-blue-100 text-blue-700'
                              }`}>
                                {calculateAge(patient.date_of_birth)} yrs • {patient.gender}
                              </span>
                            </div>
                            
                            <div className="flex flex-col">
                              {patient.medical_aid_details ? (
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <Shield className="w-4 h-4 text-cyan-600" />
                                    <span className="text-sm text-cyan-700 font-medium">
                                      {patient.medical_aid_details.provider}
                                    </span>
                                  </div>
                                  <span className="text-xs text-gray-600 ml-5">
                                    #{patient.medical_aid_details.membership_number || 'N/A'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-400">None</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <div className="text-sm text-gray-600 w-[100px] text-center">
                            {format(new Date(patient.created_at), 'MMM d, yyyy')}
                          </div>
                          <div className="flex items-center gap-1 w-[130px] justify-center">
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/patients/${patient.id}`);
                              }}
                              className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => handleEdit(patient, e)}
                              className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => handleDelete(patient.id, e)}
                              className={`p-2 rounded-lg transition-all ${
                                showDeleteConfirm === patient.id
                                  ? 'bg-red-500 text-white'
                                  : 'text-gray-600 hover:bg-gray-100'
                              }`}
                            >
                              {showDeleteConfirm === patient.id ? (
                                <Check className="w-4 h-4" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Empty State */}
            {filteredPatients.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-16"
              >
                <div className="bg-white rounded-xl p-8 max-w-sm mx-auto border border-gray-200">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-16 h-16 bg-gradient-to-br from-violet-100 to-pink-100 rounded-full flex items-center justify-center mx-auto mb-4"
                  >
                    <FileText className="w-8 h-8 text-violet-500" />
                  </motion.div>
                  <h3 className="font-semibold text-gray-900 mb-1">No patients found</h3>
                  <p className="text-sm text-gray-600 mb-4">Try adjusting your search or filters</p>
                  <button
                    onClick={() => setIsAddPatientModalOpen(true)}
                    className="px-4 py-2 bg-gradient-to-br from-[#01b9d5] to-purple-600 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/20 transition-all text-sm font-medium"
                  >
                    Add First Patient
                  </button>
                </div>
              </motion.div>
            )}

            {/* Modern Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white rounded-xl border border-gray-200 p-3">
                <div className="text-xs text-gray-600">
                  <span className="font-medium text-gray-900">{filteredPatients.length}</span> results • 
                  Page <span className="font-medium text-gray-900">{currentPage}</span> of{' '}
                  <span className="font-medium text-gray-900">{totalPages}</span>
                </div>
                
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded transition-all ${
                      currentPage === 1 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <ChevronLeft className="w-3.5 h-3.5 -ml-2" />
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className={`p-1.5 rounded transition-all ${
                      currentPage === 1 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  
                  <div className="flex items-center gap-0.5 mx-2">
                    {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 7) {
                        pageNum = i + 1;
                      } else if (currentPage <= 4) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 3) {
                        pageNum = totalPages - 6 + i;
                      } else {
                        pageNum = currentPage - 3 + i;
                      }
                      
                      return (
                        <motion.button
                          key={pageNum}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-7 h-7 rounded-lg text-xs font-medium transition-all ${
                            currentPage === pageNum
                              ? 'bg-gradient-to-br from-[#01b9d5] to-purple-600 text-white shadow-md shadow-purple-500/20'
                              : 'text-gray-700 hover:bg-gray-100'
                          }`}
                        >
                          {pageNum}
                        </motion.button>
                      );
                    })}
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded transition-all ${
                      currentPage === totalPages 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages}
                    className={`p-1.5 rounded transition-all ${
                      currentPage === totalPages 
                        ? 'text-gray-300 cursor-not-allowed' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                    <ChevronRight className="w-3.5 h-3.5 -ml-2" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <FormModal
        isOpen={isAddPatientModalOpen}
        onClose={() => setIsAddPatientModalOpen(false)}
        title="Add New Patient"
      >
        <AddPatientForm onSuccess={handlePatientAdded} />
      </FormModal>

      <FormModal
        isOpen={isEditPatientModalOpen}
        onClose={() => {
          setIsEditPatientModalOpen(false);
          setSelectedPatient(null);
        }}
        title="Edit Patient"
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
              postal_code: selectedPatient.postal_code || ''
            }}
            onSuccess={handlePatientUpdated}
          />
        )}
      </FormModal>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Export Patient Data</h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-600 mb-6">
              Export {filteredPatients.length} filtered patients in your preferred format.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => handleExport('csv')}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-[#01b9d5] hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 rounded-lg group-hover:bg-green-200 transition-colors">
                    <FileText className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">CSV Format</div>
                    <div className="text-sm text-gray-500">Comma-separated values for spreadsheets</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#01b9d5]" />
              </button>
              
              <button
                onClick={() => handleExport('json')}
                className="w-full flex items-center justify-between p-4 border-2 border-gray-200 rounded-lg hover:border-[#01b9d5] hover:bg-blue-50 transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg group-hover:bg-blue-200 transition-colors">
                    <FileText className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-gray-900">JSON Format</div>
                    <div className="text-sm text-gray-500">Structured data for applications</div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#01b9d5]" />
              </button>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}
      
      {/* Patient Details Modal */}
      <ComprehensivePatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false);
          setSelectedPatientId(null);
        }}
        patientId={selectedPatientId}
      />

      {/* SMS Modal */}
      {isSmsModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-md w-full mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Send SMS to {filteredPatients.filter(p => p.cell_number).length} Patients</h3>
              <button
                onClick={() => setIsSmsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                <textarea
                  value={smsContent}
                  onChange={(e) => setSmsContent(e.target.value)}
                  rows={6}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all resize-none"
                  placeholder="Type your message here..."
                />
                <div className="text-xs text-gray-500 mt-1">Character count: {smsContent.length}/1600</div>
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsSmsModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsSendingSms(true);
                    try {
                      const patientsWithPhone = filteredPatients.filter(p => p.cell_number);
                      let successCount = 0;
                      let failureCount = 0;

                      for (const patient of patientsWithPhone) {
                        try {
                          const result = await defaultSMSService.sendSMS({
                            to: patient.cell_number!,
                            content: smsContent,
                            reference: `bulk-patient-${patient.id}-${Date.now()}`
                          });
                          if (result.success) successCount++;
                          else failureCount++;
                        } catch (error) {
                          failureCount++;
                        }
                      }

                      if (successCount > 0) {
                        toast.success(`SMS sent to ${successCount} patients successfully!`);
                      }
                      if (failureCount > 0) {
                        toast.error(`Failed to send SMS to ${failureCount} patients`);
                      }
                      
                      setIsSmsModalOpen(false);
                      setSmsContent('');
                    } catch (error) {
                      console.error('Error sending bulk SMS:', error);
                      toast.error('Failed to send SMS. Please try again.');
                    } finally {
                      setIsSendingSms(false);
                    }
                  }}
                  disabled={isSendingSms || !smsContent.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingSms ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Phone className="w-4 h-4" />
                      Send SMS
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Email Modal */}
      {isEmailModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Send Email to {filteredPatients.filter(p => p.email).length} Patients</h3>
              <button
                onClick={() => setIsEmailModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all"
                  placeholder="Enter email subject"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message Content</label>
                <textarea
                  value={emailContent}
                  onChange={(e) => setEmailContent(e.target.value)}
                  rows={8}
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all resize-none"
                  placeholder="Type your email content here..."
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setIsEmailModalOpen(false)}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    setIsSendingEmail(true);
                    try {
                      const patientsWithEmail = filteredPatients.filter(p => p.email);
                      
                      const { data, error } = await supabase.functions.invoke('send-batch-email', {
                        body: {
                          recipients: patientsWithEmail.map(p => ({
                            email: p.email,
                            name: `${p.first_name} ${p.last_name}`
                          })),
                          subject: emailSubject,
                          html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                              <div style="background: linear-gradient(135deg, #01b9d4 0%, #7c3aed 100%); padding: 30px 20px; text-align: center;">
                                <h1 style="color: white; margin: 0;">OneHealth Practice Management</h1>
                              </div>
                              <div style="padding: 30px 20px;">
                                <div style="white-space: pre-wrap;">${emailContent}</div>
                              </div>
                              <div style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #e2e8f0;">
                                <p style="margin: 0; color: #666; font-size: 14px;">© 2024 OneHealth. All rights reserved.</p>
                              </div>
                            </div>
                          `,
                          from: {
                            email: 'noreply@onehealth.com.na',
                            name: 'OneHealth Practice'
                          }
                        }
                      });

                      if (error) throw error;

                      toast.success(`Email sent to ${patientsWithEmail.length} patients successfully!`);
                      setIsEmailModalOpen(false);
                      setEmailContent('');
                      setEmailSubject('');
                    } catch (error) {
                      console.error('Error sending bulk email:', error);
                      toast.error('Failed to send emails. Please try again.');
                    } finally {
                      setIsSendingEmail(false);
                    }
                  }}
                  disabled={isSendingEmail || !emailContent.trim() || !emailSubject.trim()}
                  className="flex-1 px-4 py-2 bg-gradient-to-r from-emerald-500 to-[#01b9d5] text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSendingEmail ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4" />
                      Send Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Patients;