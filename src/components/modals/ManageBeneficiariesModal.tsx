import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  X,
  Users,
  Search,
  Plus,
  Edit3,
  Trash2,
  Shield,
  User,
  Phone,
  Mail,
  Check,
  AlertCircle,
  UserPlus,
  Crown,
  Star,
  Sparkles,
  Heart,
  Filter,
  SortAsc,
  Calendar,
  Activity,
  Settings,
  Loader,
  ExternalLink,
  Eye
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import '../../styles/scrollbar.css';

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
  id_number?: string;
  created_at: string;
}

interface MedicalAidMember {
  id: string;
  patient_id: string;
  medical_aid_id: string;
  relationship: string;
  member_number?: string;
  dependent_code?: string;
  is_main_member: boolean;
  status: 'active' | 'inactive' | 'suspended';
  created_at: string;
  updated_at: string;
  patient?: Patient;
}

interface MedicalAidDetails {
  id: string;
  provider: string;
  scheme: string;
  membership_number: string;
  plan_type: string;
  main_member_name: string;
  main_member_id_number: string;
  patient_id: string;
}

interface ManageBeneficiariesModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMedicalAid?: MedicalAidDetails;
  patientId: string;
  onRefresh?: () => void;
}

const ManageBeneficiariesModal: React.FC<ManageBeneficiariesModalProps> = ({
  isOpen,
  onClose,
  currentMedicalAid,
  patientId,
  onRefresh
}) => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'view' | 'add'>('view');
  const [members, setMembers] = useState<MedicalAidMember[]>([]);
  const [availablePatients, setAvailablePatients] = useState<Patient[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [relationship, setRelationship] = useState('');
  // const [dependentCode, setDependentCode] = useState(''); // Not supported in current schema
  const [editingMember, setEditingMember] = useState<MedicalAidMember | null>(null);
  const [sortBy, setSortBy] = useState<'name' | 'relationship' | 'date'>('name');
  const [draggedPatient, setDraggedPatient] = useState<Patient | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [totalPatientsInPractice, setTotalPatientsInPractice] = useState<number>(0);

  const relationships = [
    'Spouse',
    'Child',
    'Parent',
    'Sibling',
    'Partner',
    'Guardian',
    'Other'
  ];

  useEffect(() => {
    if (isOpen && currentMedicalAid) {
      fetchMembers();
      if (activeTab === 'add') {
        fetchAvailablePatients();
      }
    }
  }, [isOpen, activeTab, currentMedicalAid?.id]);


  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      // Restore body scroll when modal is closed
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  const fetchMembers = async () => {
    if (!currentMedicalAid?.membership_number) return;

    setIsLoading(true);
    try {
      // Fetch all patients with the same membership number from medical_aid_details
      const { data, error } = await supabase
        .from('medical_aid_details')
        .select(`
          id,
          patient_id,
          provider,
          scheme,
          membership_number,
          plan_type,
          main_member_name,
          main_member_id_number,
          relationship_to_main,
          created_at,
          updated_at,
          patients!inner(
            id,
            first_name,
            last_name,
            email,
            cell_number,
            date_of_birth,
            gender,
            id_number,
            created_at
          )
        `)
        .eq('membership_number', currentMedicalAid.membership_number)
        .order('relationship_to_main', { ascending: false }); // Main member first

      if (error) throw error;

      // Transform the data to match our interface
      const transformedMembers: MedicalAidMember[] = data?.map(item => ({
        id: item.id,
        patient_id: item.patient_id,
        medical_aid_id: item.id,
        relationship: item.relationship_to_main,
        member_number: item.membership_number,
        dependent_code: undefined, // Not available in current schema
        is_main_member: item.relationship_to_main === 'Main Member',
        status: 'active' as const, // Default to active, could be enhanced
        created_at: item.created_at,
        updated_at: item.updated_at,
        patient: item.patients
      })) || [];

      setMembers(transformedMembers);
    } catch (err) {
      console.error('Error fetching members:', err);
      toast.error('Failed to load beneficiaries');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAvailablePatients = async () => {
    if (!currentMedicalAid?.membership_number || !user?.practice_id) {
      console.log('❌ Missing requirements:', { 
        membership_number: currentMedicalAid?.membership_number, 
        practice_id: user?.practice_id
      });
      return;
    }

    setIsLoading(true);
    try {
      // Get all patients from the current user's practice
      const { data: allPatients, error: patientsError } = await supabase
        .from('patients')
        .select('id, first_name, last_name, email, cell_number, date_of_birth, gender, id_number, created_at, practice_id')
        .eq('practice_id', user.practice_id)
        .order('first_name', { ascending: true });

      if (patientsError) throw patientsError;

      setTotalPatientsInPractice(allPatients?.length || 0);

      // Get patients already linked to medical aids from same scheme only
      const { data: linkedPatients, error: linkedError } = await supabase
        .from('medical_aid_details')
        .select('patient_id')
        .eq('membership_number', currentMedicalAid.membership_number);

      if (linkedError) throw linkedError;

      const linkedPatientIds = new Set(linkedPatients?.map(item => item.patient_id) || []);
      
      // Filter out patients already linked to THIS medical aid scheme
      const availablePatients = allPatients?.filter(patient => 
        !linkedPatientIds.has(patient.id)
      ) || [];

      console.log(`✅ Found ${availablePatients.length} available patients from ${allPatients?.length || 0} total in practice`);
      setAvailablePatients(availablePatients);
    } catch (err) {
      console.error('Error fetching available patients:', err);
      toast.error('Failed to load available patients');
    } finally {
      setIsLoading(false);
    }
  };

  const addMember = async () => {
    if (!selectedPatient || !relationship || !currentMedicalAid) {
      toast.error('Please select a patient and relationship');
      return;
    }

    setIsLoading(true);
    try {
      // First verify authentication
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error('Authentication required. Please log in again.');
      }

      console.log('🔐 Adding member with session:', session.user.id);
      
      const { data, error } = await supabase
        .from('medical_aid_details')
        .insert({
          patient_id: selectedPatient.id,
          provider: currentMedicalAid.provider,
          scheme: currentMedicalAid.scheme,
          membership_number: currentMedicalAid.membership_number,
          plan_type: currentMedicalAid.plan_type,
          main_member_name: currentMedicalAid.main_member_name,
          main_member_id_number: currentMedicalAid.main_member_id_number,
          relationship_to_main: relationship
        })
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }

      console.log('✅ Member added successfully:', data);
      toast.success(`${selectedPatient.first_name} ${selectedPatient.last_name} added to medical aid`, {
        duration: 3000,
        icon: '🎉'
      });
      
      // Reset form but keep tab open for adding more members
      setSelectedPatient(null);
      setRelationship('');
      
      // Refresh data
      await Promise.all([
        fetchMembers(),
        fetchAvailablePatients()
      ]);
      
      onRefresh?.();
    } catch (err: any) {
      console.error('Error adding member:', err);
      
      if (err.code === '42501') {
        toast.error('Permission denied. Please check your access rights or contact an administrator.');
      } else if (err.message?.includes('Failed to fetch') || err.code === '') {
        toast.error('Network error. Please check your connection and try again.');
      } else {
        toast.error(`Failed to add member: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateMember = async (memberId: string, updates: { relationship?: string }) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('medical_aid_details')
        .update({
          relationship_to_main: updates.relationship
        })
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member updated successfully');
      setEditingMember(null);
      fetchMembers();
      onRefresh?.();
    } catch (err) {
      console.error('Error updating member:', err);
      toast.error('Failed to update member');
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMember = async (memberId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from('medical_aid_details')
        .delete()
        .eq('id', memberId);

      if (error) throw error;

      toast.success('Member removed successfully');
      fetchMembers();
      fetchAvailablePatients();
      onRefresh?.();
    } catch (err) {
      console.error('Error deleting member:', err);
      toast.error('Failed to remove member');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPatients = availablePatients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    patient.cell_number?.includes(searchTerm) ||
    patient.id_number?.includes(searchTerm)
  );

  // Copy before sorting so the members state is never mutated. There is no member status in the
  // schema (every member is mapped to 'active'), so there is no status filter or badge.
  const filteredAndSortedMembers = [...members]
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return `${a.patient?.first_name} ${a.patient?.last_name}`.localeCompare(
            `${b.patient?.first_name} ${b.patient?.last_name}`
          );
        case 'relationship':
          return a.relationship.localeCompare(b.relationship);
        case 'date':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        default:
          return 0;
      }
    });

  const calculateAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return null;
    return Math.floor((Date.now() - new Date(dateOfBirth).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const isMainMember = currentMedicalAid?.patient_id === patientId;

  // Navigate to patient profile with state to return to current patient's medical aid modal
  const viewPatientProfile = (member: MedicalAidMember) => {
    if (!member.patient) return;
    
    // Store current state to enable proper back navigation
    const currentState = {
      returnToPatientId: patientId,
      returnToModal: 'manageBeneficiaries',
      currentMedicalAid: currentMedicalAid,
      fromBeneficiaryManagement: true
    };
    
    // Close current modal
    onClose();
    
    // Navigate to the member's profile with return state
    navigate(`/patients/${member.patient.id}`, { 
      state: currentState,
      replace: false
    });
    
    toast.success(`Viewing ${member.patient.first_name} ${member.patient.last_name}'s profile`, {
      icon: '👁️',
      duration: 2000
    });
  };

  // Drag and Drop handlers
  const handleDragStart = (patient: Patient) => {
    setDraggedPatient(patient);
  };

  const handleDragEnd = () => {
    setDraggedPatient(null);
    setIsDragOver(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    if (draggedPatient && !selectedPatient) {
      setSelectedPatient(draggedPatient);
      toast.success(`${draggedPatient.first_name} ${draggedPatient.last_name} selected for medical aid`);
    }
    setDraggedPatient(null);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[99999] p-4" 
          style={{ zIndex: 99999 }}
          onClick={(e) => {
            // Close modal when clicking the backdrop
            if (e.target === e.currentTarget) {
              onClose();
            }
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl h-[95vh] flex flex-col overflow-hidden relative"
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside modal
          >
        {/* Header */}
        <div className="bg-gradient-to-r from-emerald-600 via-cyan-600 to-blue-600 text-white p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent" />
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-3xl -translate-y-32 translate-x-32" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  Manage Beneficiaries
                  <Sparkles className="w-5 h-5 text-yellow-300" />
                </h2>
                <p className="text-white/80 text-sm">
                  {currentMedicalAid?.provider} • {currentMedicalAid?.scheme} • #{currentMedicalAid?.membership_number}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="mt-6 flex bg-white/10 rounded-xl p-1 backdrop-blur-sm">
            <button
              onClick={() => setActiveTab('view')}
              className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 justify-center ${
                activeTab === 'view'
                  ? 'bg-white text-emerald-600 shadow-lg'
                  : 'text-white/80 hover:text-white hover:bg-white/10'
              }`}
            >
              <Users className="w-4 h-4" />
              View Members ({members.length})
            </button>
            {isMainMember && (
              <button
                onClick={() => setActiveTab('add')}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 justify-center ${
                  activeTab === 'add'
                    ? 'bg-white text-emerald-600 shadow-lg'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
              >
                <UserPlus className="w-4 h-4" />
                Add Member
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <AnimatePresence mode="wait">
            {activeTab === 'view' ? (
              <motion.div
                key="view"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="h-full flex flex-col"
              >
                {/* Filters and Controls */}
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <SortAsc className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as any)}
                        className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      >
                        <option value="name">Sort by Name</option>
                        <option value="relationship">Sort by Relationship</option>
                        <option value="date">Sort by Date Added</option>
                      </select>
                    </div>
                  </div>

                  {!isMainMember && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <span className="text-sm text-amber-700">To add or remove beneficiaries, open the main member's profile</span>
                    </div>
                  )}
                </div>

                {isLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <Loader className="animate-spin h-12 w-12 text-emerald-600 mx-auto mb-4" />
                      <p className="text-gray-600">Loading beneficiaries...</p>
                    </div>
                  </div>
                ) : members.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center bg-gradient-to-br from-gray-50 to-emerald-50 rounded-2xl p-12 border border-emerald-100">
                      <div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-cyan-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Users className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-xl font-bold text-gray-900 mb-2">No Beneficiaries</h3>
                      <p className="text-gray-600 mb-4">Start adding family members to this medical aid scheme</p>
                      {isMainMember && (
                        <button
                          onClick={() => setActiveTab('add')}
                          className="bg-gradient-to-r from-emerald-500 to-cyan-600 text-white px-6 py-3 rounded-lg hover:shadow-lg transition-all font-medium flex items-center gap-2 mx-auto"
                        >
                          <UserPlus className="w-4 h-4" />
                          Add First Member
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400 smooth-scroll">
                    {filteredAndSortedMembers.map((member, index) => (
                      <motion.div
                        key={member.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="bg-gradient-to-r from-white to-gray-50 rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all group"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            <div className="relative">
                              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg ${
                                member.is_main_member
                                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500'
                                  : member.patient?.gender?.toLowerCase() === 'female'
                                  ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                                  : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                              }`}>
                                {member.is_main_member ? (
                                  <Crown className="w-7 h-7 text-white" />
                                ) : (
                                  <User className="w-7 h-7 text-white" />
                                )}
                              </div>
                              {member.is_main_member && (
                                <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center border-2 border-white">
                                  <Star className="w-2.5 h-2.5 text-yellow-900" />
                                </div>
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 mb-2">
                                <h3 className="text-lg font-bold text-gray-900 truncate">
                                  {member.patient ? `${member.patient.first_name} ${member.patient.last_name}` : 'Unknown Patient'}
                                </h3>
                                {member.is_main_member && (
                                  <span className="bg-gradient-to-r from-yellow-100 to-orange-100 text-yellow-800 text-xs font-medium px-3 py-1 rounded-full border border-yellow-200 flex items-center gap-1">
                                    <Crown className="w-3 h-3" />
                                    Main Member
                                  </span>
                                )}
                              </div>
                              
                              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                  <Heart className="w-4 h-4 text-purple-500" />
                                  <span className="capitalize font-medium">{member.relationship}</span>
                                </div>
                                {member.patient?.cell_number && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Phone className="w-4 h-4 text-blue-500" />
                                    <span className="font-mono">{member.patient.cell_number}</span>
                                  </div>
                                )}
                                {member.patient?.date_of_birth && (
                                  <div className="flex items-center gap-2 text-gray-600">
                                    <Calendar className="w-4 h-4 text-green-500" />
                                    <span>{calculateAge(member.patient.date_of_birth)} years old</span>
                                  </div>
                                )}
                              </div>

                              {member.patient?.email && (
                                <div className="flex items-center gap-2 text-gray-600 mt-2">
                                  <Mail className="w-4 h-4 text-emerald-500" />
                                  <span className="truncate text-sm">{member.patient.email}</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons - Always Visible */}
                          <div className="flex items-center gap-2">
                            {/* View Profile Button - Available for all members */}
                            <motion.button
                              whileHover={{ scale: 1.05 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={() => viewPatientProfile(member)}
                              className="p-2 bg-emerald-100 text-emerald-600 rounded-lg hover:bg-emerald-200 transition-colors"
                              title={`View ${member.patient?.first_name}'s Profile`}
                            >
                              <Eye className="w-4 h-4" />
                            </motion.button>

                            {/* Edit and Delete buttons - Only for main member and non-main members */}
                            {isMainMember && !member.is_main_member && (
                              <>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => setEditingMember(member)}
                                  className="p-2 bg-blue-100 text-blue-600 rounded-lg hover:bg-blue-200 transition-colors"
                                  title="Edit Member"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </motion.button>
                                <motion.button
                                  whileHover={{ scale: 1.05 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    const name = member.patient
                                      ? `${member.patient.first_name} ${member.patient.last_name}`
                                      : 'this member';
                                    if (!window.confirm(`Remove ${name} from this medical aid? Their medical aid details will be deleted. This cannot be undone.`)) return;
                                    deleteMember(member.id);
                                  }}
                                  disabled={isLoading}
                                  className="p-2 rounded-lg transition-colors bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                                  title="Remove Member"
                                  aria-label="Remove member"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </motion.button>
                              </>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="add"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full flex flex-col"
              >
                <div className="mb-6">
                  <h3 className="text-xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-emerald-600" />
                    Add New Beneficiary
                  </h3>
                  <p className="text-gray-600">Search and select a patient to add as a beneficiary to this medical aid scheme</p>
                </div>

                {/* Search Bar */}
                <div className="relative mb-6">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search patients by name, email, phone, or ID number..."
                    className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm"
                  />
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 text-sm">
                    {filteredPatients.length} found
                  </div>
                </div>

                <div className="flex-1 flex gap-6 overflow-hidden">
                  {/* Patient List */}
                  <div className="flex-1 bg-gray-50 rounded-xl p-4 overflow-hidden">
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Filter className="w-4 h-4 text-emerald-600" />
                      Available Patients ({filteredPatients.length})
                      {filteredPatients.length > 0 && (
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                          Drag & Drop
                        </span>
                      )}
                    </h4>
                    
                    <div className="space-y-2 overflow-y-auto h-full scrollbar-thin scrollbar-thumb-emerald-300 scrollbar-track-emerald-100 hover:scrollbar-thumb-emerald-400 smooth-scroll">
                      {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader className="animate-spin h-8 w-8 text-emerald-600" />
                        </div>
                      ) : filteredPatients.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                          <p className="font-medium">No available patients found</p>
                          <p className="text-xs mt-1">
                            {searchTerm 
                              ? `No patients match "${searchTerm}" in your practice`
                              : totalPatientsInPractice === 0
                              ? `No patients found in your practice. Please add patients first.`
                              : `All ${totalPatientsInPractice} patients in your practice are already on this medical aid`
                            }
                          </p>
                          {searchTerm && (
                            <button
                              onClick={() => setSearchTerm('')}
                              className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 underline"
                            >
                              Clear search to see all patients
                            </button>
                          )}
                        </div>
                      ) : (
                        filteredPatients.map((patient) => (
                          <motion.div
                            key={patient.id}
                            whileHover={{ scale: 1.01, y: -2 }}
                            whileTap={{ scale: 0.98 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            draggable
                            onDragStart={() => handleDragStart(patient)}
                            onDragEnd={handleDragEnd}
                            onClick={() => {
                              setSelectedPatient(patient);
                              toast.success(`${patient.first_name} ${patient.last_name} selected`, {
                                duration: 1500,
                                icon: '👤'
                              });
                            }}
                            className={`p-4 rounded-lg cursor-pointer transition-all duration-300 relative hover:shadow-lg ${
                              selectedPatient?.id === patient.id
                                ? 'bg-emerald-100 border-2 border-emerald-300 shadow-md ring-2 ring-emerald-200/50'
                                : draggedPatient?.id === patient.id
                                ? 'bg-blue-100 border-2 border-blue-300 shadow-md opacity-50 scale-105'
                                : 'bg-white border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50/30'
                            }`}
                          >
                            {/* Drag indicator */}
                            <div className="absolute top-2 right-2 opacity-50 hover:opacity-100 transition-opacity">
                              <div className="flex flex-col gap-0.5">
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                                <div className="w-1 h-1 bg-gray-400 rounded-full"></div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${
                                patient.gender?.toLowerCase() === 'female'
                                  ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                                  : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                              }`}>
                                <User className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 truncate">
                                  {patient.first_name} {patient.last_name}
                                </p>
                                <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                                  {patient.date_of_birth && (
                                    <span>{calculateAge(patient.date_of_birth)} years</span>
                                  )}
                                  {patient.gender && (
                                    <span className="capitalize">{patient.gender}</span>
                                  )}
                                  {patient.id_number && (
                                    <span className="font-mono">ID: {patient.id_number.slice(-4)}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3 text-xs text-gray-600 mt-1">
                                  {patient.cell_number && (
                                    <span className="font-mono">{patient.cell_number}</span>
                                  )}
                                  {patient.email && (
                                    <span className="truncate">{patient.email}</span>
                                  )}
                                </div>
                              </div>
                              {selectedPatient?.id === patient.id && (
                                <div className="p-1 bg-emerald-500 rounded-full">
                                  <Check className="w-4 h-4 text-white" />
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Add Member Form */}
                  <div 
                    className={`w-80 bg-white rounded-xl border p-6 shadow-lg transition-all duration-300 ease-in-out ${
                      isDragOver 
                        ? 'border-emerald-400 border-2 bg-emerald-50 shadow-xl scale-105 ring-4 ring-emerald-200/50' 
                        : 'border-gray-200 hover:shadow-xl'
                    }`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-emerald-600" />
                      Member Details
                      {isDragOver && (
                        <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full animate-pulse">
                          Drop here to select
                        </span>
                      )}
                    </h4>

                    {selectedPatient ? (
                      <div className="space-y-5">
                        {/* Selected Patient Preview */}
                        <div className="bg-emerald-50 rounded-lg p-4 border border-emerald-200">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center shadow-sm ${
                              selectedPatient.gender?.toLowerCase() === 'female'
                                ? 'bg-gradient-to-br from-pink-400 to-rose-500'
                                : 'bg-gradient-to-br from-blue-400 to-cyan-500'
                            }`}>
                              <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                              <p className="font-semibold text-gray-900">
                                {selectedPatient.first_name} {selectedPatient.last_name}
                              </p>
                              <p className="text-sm text-gray-600">{selectedPatient.email || 'No email'}</p>
                            </div>
                          </div>
                          <div className="text-xs text-emerald-700 bg-emerald-100 rounded px-2 py-1">
                            Selected for addition to medical aid
                          </div>
                        </div>

                        {/* Relationship Selection */}
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Relationship to Main Member *
                          </label>
                          <select
                            value={relationship}
                            onChange={(e) => setRelationship(e.target.value)}
                            className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all text-sm"
                          >
                            <option value="">Select relationship</option>
                            {relationships.map((rel) => (
                              <option key={rel} value={rel}>{rel}</option>
                            ))}
                          </select>
                        </div>


                        {/* Add Button */}
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={addMember}
                          disabled={!selectedPatient || !relationship || isLoading}
                          className="w-full bg-gradient-to-r from-emerald-500 to-cyan-600 text-white py-3 rounded-lg hover:shadow-lg transition-all duration-300 font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:from-emerald-600 hover:to-cyan-700"
                        >
                          {isLoading ? (
                            <>
                              <Loader className="animate-spin h-4 w-4" />
                              Adding Member...
                            </>
                          ) : (
                            <>
                              <Plus className="w-4 h-4" />
                              Add Member
                            </>
                          )}
                        </motion.button>
                        
                        {/* Success feedback for multiple additions */}
                        {selectedPatient && (
                          <div className="mt-3 text-center">
                            <p className="text-xs text-gray-500">
                              💡 After adding, you can continue adding more members
                            </p>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className={`text-center py-8 transition-all ${isDragOver ? 'text-emerald-600' : 'text-gray-500'}`}>
                        <UserPlus className={`w-8 h-8 mx-auto mb-2 transition-all ${isDragOver ? 'opacity-100 animate-bounce text-emerald-600' : 'opacity-50'}`} />
                        <p className="font-medium">
                          {isDragOver ? 'Drop patient here to select' : 'Select a patient to add as beneficiary'}
                        </p>
                        <p className="text-xs mt-1">
                          {isDragOver ? 'Release to add to medical aid' : 'Click to select or drag & drop from the list'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Edit Member Modal */}
        <AnimatePresence>
          {editingMember && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6"
              >
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <Edit3 className="w-5 h-5 text-blue-600" />
                  Edit Member Details
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Relationship
                    </label>
                    <select
                      value={editingMember.relationship}
                      onChange={(e) => setEditingMember({ ...editingMember, relationship: e.target.value })}
                      className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                    >
                      {relationships.map((rel) => (
                        <option key={rel} value={rel}>{rel}</option>
                      ))}
                    </select>
                  </div>

                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => setEditingMember(null)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => updateMember(editingMember.id, {
                      relationship: editingMember.relationship
                    })}
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50"
                  >
                    {isLoading ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with Info */}
        <div className="border-t border-gray-200 p-4 bg-gray-50">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              <span>Medical Aid Management System</span>
            </div>
            <div className="flex items-center gap-4">
              <span>{members.length} total members</span>
              {isMainMember && <span>Main member controls</span>}
            </div>
          </div>
        </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default ManageBeneficiariesModal;