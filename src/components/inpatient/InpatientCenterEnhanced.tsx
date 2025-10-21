import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { BarChart, Bar, LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadialBarChart, RadialBar, PieChart, Pie, Cell, Legend } from 'recharts';
import { format, subDays, differenceInDays } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useInpatientStore } from '../../stores/inpatientStore';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import FloatingInpatientTracker from './FloatingInpatientTracker';
import DischargeModal from './DischargeModal';
import ComprehensivePatientModal from '../patients/ComprehensivePatientModal';
import PremiumBillingModal from '../modals/PremiumBillingModal';
import { ProfessionalSmsModal } from '../messages/ProfessionalSmsModal';
import VitalsForm from '../forms/VitalsForm';
import { toast } from 'react-hot-toast';
import Button from '../ui/Button';
import { cn } from '../../utils/cn';

interface LayoutContext {
  toggleMobileSidebar: () => void;
  isMobileSidebarOpen: boolean;
}

const COLORS = {
  primary: '#06b6d4',
  secondary: '#8b5cf6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  pink: '#ec4899',
  purple: '#a855f7'
};

interface WardRound {
  id: string;
  wardName: string;
  doctor: string;
  scheduledTime: string;
  status: 'pending' | 'in-progress' | 'completed';
  patientsVisited: number;
  totalPatients: number;
}

interface MedicationSchedule {
  id: string;
  patientName: string;
  medication: string;
  dosage: string;
  time: string;
  status: 'pending' | 'administered' | 'skipped';
  nurse?: string;
}

interface AuthorizationRequest {
  id: string;
  patientName: string;
  medicalAid: string;
  procedure: string;
  requestDate: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  amount: number;
}

interface ClinicalProtocol {
  id: string;
  name: string;
  category: string;
  compliance: number;
  lastUpdated: string;
  criticalSteps: number;
  completedSteps: number;
}

export default function InpatientCenterEnhanced() {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const { user, logout } = useAuthStore();
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const {
    activeAdmissions,
    wards,
    beds,
    isLoading,
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyRate,
    fetchAdmissions,
    fetchWards,
    fetchAllBedsWithStatus
  } = useInpatientStore();

  // Create stats object from store values
  const stats = {
    beds: {
      total: totalBeds || 0,
      occupied: occupiedBeds || 0,
      available: availableBeds || 0,
      occupancyRate: occupancyRate || 0,
      maintenance: beds.filter(b => b.status === 'maintenance').length
    },
    clinical: {
      criticalPatients: activeAdmissions.filter((a: any) => a.patient_condition === 'critical').length,
      pendingMedications: 5, // Mock value
      vitalsOverdue: 3, // Mock value
      nursingAlerts: 8 // Mock value
    }
  };

  // State Management
  const [activeTab, setActiveTab] = useState<'overview' | 'admissions' | 'clinical' | 'nursing' | 'authorization' | 'protocols'>('overview');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid');

  // Modal States
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);

  // Ward Round Management
  const [wardRounds, setWardRounds] = useState<WardRound[]>([
    {
      id: '1',
      wardName: 'General Ward A',
      doctor: 'Dr. Smith',
      scheduledTime: '09:00 AM',
      status: 'completed',
      patientsVisited: 12,
      totalPatients: 12
    },
    {
      id: '2',
      wardName: 'ICU',
      doctor: 'Dr. Johnson',
      scheduledTime: '10:00 AM',
      status: 'in-progress',
      patientsVisited: 3,
      totalPatients: 8
    },
    {
      id: '3',
      wardName: 'Pediatric Ward',
      doctor: 'Dr. Williams',
      scheduledTime: '02:00 PM',
      status: 'pending',
      patientsVisited: 0,
      totalPatients: 6
    }
  ]);

  // Medication Administration
  const [medicationSchedule, setMedicationSchedule] = useState<MedicationSchedule[]>([
    {
      id: '1',
      patientName: 'John Doe',
      medication: 'Amoxicillin',
      dosage: '500mg',
      time: '08:00 AM',
      status: 'administered',
      nurse: 'Nurse Mary'
    },
    {
      id: '2',
      patientName: 'Jane Smith',
      medication: 'Paracetamol',
      dosage: '1g',
      time: '09:00 AM',
      status: 'pending'
    },
    {
      id: '3',
      patientName: 'Bob Johnson',
      medication: 'Insulin',
      dosage: '10 units',
      time: '09:30 AM',
      status: 'pending'
    }
  ]);

  // Medical Aid Authorizations
  const [authorizationRequests, setAuthorizationRequests] = useState<AuthorizationRequest[]>([
    {
      id: '1',
      patientName: 'Alice Brown',
      medicalAid: 'Discovery Health',
      procedure: 'MRI Scan',
      requestDate: '2024-01-20',
      status: 'pending',
      amount: 15000
    },
    {
      id: '2',
      patientName: 'Charlie Davis',
      medicalAid: 'Momentum',
      procedure: 'Surgery - Appendectomy',
      requestDate: '2024-01-19',
      status: 'approved',
      amount: 45000
    },
    {
      id: '3',
      patientName: 'Eva Wilson',
      medicalAid: 'BestMed',
      procedure: 'CT Scan',
      requestDate: '2024-01-18',
      status: 'rejected',
      amount: 8000
    }
  ]);

  // Clinical Protocols
  const [protocols, setProtocols] = useState<ClinicalProtocol[]>([
    {
      id: '1',
      name: 'Sepsis Management Protocol',
      category: 'Critical Care',
      compliance: 95,
      lastUpdated: '2024-01-15',
      criticalSteps: 8,
      completedSteps: 7
    },
    {
      id: '2',
      name: 'Diabetic Ketoacidosis Protocol',
      category: 'Endocrine',
      compliance: 88,
      lastUpdated: '2024-01-10',
      criticalSteps: 10,
      completedSteps: 9
    },
    {
      id: '3',
      name: 'Post-Operative Care Protocol',
      category: 'Surgery',
      compliance: 92,
      lastUpdated: '2024-01-12',
      criticalSteps: 15,
      completedSteps: 14
    }
  ]);

  // Fetch initial data
  useEffect(() => {
    if (practiceId) {
      fetchAdmissions(practiceId, 'active');
      fetchWards(practiceId);
      fetchAllBedsWithStatus(practiceId);
    }
  }, [practiceId, fetchAdmissions, fetchWards, fetchAllBedsWithStatus]);

  // Handle patient selection for bidirectional navigation
  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient);
    setIsPatientModalOpen(true);
  };

  // Handle ward round start
  const handleStartWardRound = (round: WardRound) => {
    const updatedRounds = wardRounds.map(r =>
      r.id === round.id ? { ...r, status: 'in-progress' as const } : r
    );
    setWardRounds(updatedRounds);
    toast.success(`Started ward round for ${round.wardName}`);
  };

  // Handle medication administration
  const handleAdministerMedication = (medication: MedicationSchedule) => {
    const updatedSchedule = medicationSchedule.map(m =>
      m.id === medication.id
        ? { ...m, status: 'administered' as const, nurse: user?.name || 'Nurse' }
        : m
    );
    setMedicationSchedule(updatedSchedule);
    toast.success(`Medication administered to ${medication.patientName}`);
  };

  // Handle authorization request
  const handleAuthorizationAction = (auth: AuthorizationRequest, action: 'approve' | 'reject' | 'follow-up') => {
    if (action === 'follow-up') {
      setIsSmsModalOpen(true);
      return;
    }

    const updatedRequests = authorizationRequests.map(a =>
      a.id === auth.id
        ? { ...a, status: action === 'approve' ? 'approved' as const : 'rejected' as const }
        : a
    );
    setAuthorizationRequests(updatedRequests);
    toast.success(`Authorization ${action}d for ${auth.patientName}`);
  };

  // Handle protocol action
  const handleProtocolView = (protocol: ClinicalProtocol) => {
    toast.info(`Opening protocol: ${protocol.name}`);
    // Would open detailed protocol view
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Don't show loading forever - max 5 seconds then show empty state
  if (isLoading && activeAdmissions.length === 0 && wards.length === 0 && beds.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon icon="solar:hospital-bed-bold-duotone" className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-2">No Inpatient Data Yet</h3>
          <p className="text-gray-500 mb-4">Set up your wards and beds to start managing inpatient care</p>
          <button
            onClick={() => navigate('/settings')}
            className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 transition-colors"
          >
            Go to Settings
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-0 sm:px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Standard Header - Matching Patients/Encounters/Communications */}
        <div className="mx-0 sm:mx-0 backdrop-blur-md rounded-none sm:rounded-xl shadow-sm border border-gray-100/50 border-x-0 sm:border-x bg-white">
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between w-full">
              {/* Left Side - Page Title and Icon */}
              <div className="flex items-center gap-3">
                {/* Practice Logo/Icon - Desktop only */}
                <div className="hidden lg:block p-3 bg-gradient-to-br from-red-500 to-rose-600 rounded-xl shadow-lg">
                  <Icon icon="solar:hospital-bold-duotone" className="w-8 h-8 text-white" />
                </div>

                {/* Title - Always visible */}
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">
                    Inpatient Management
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5 hidden lg:block">Comprehensive ward management and clinical operations</p>
                </div>
              </div>

              {/* Right Side - New Admission Button + User Avatar */}
              <div className="flex items-center gap-3">
                {/* New Admission Button */}
                <button
                  onClick={() => navigate('/inpatient/admissions/new')}
                  className="px-4 py-2 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] hover:from-[#0197d4] hover:to-[#01b9d4] text-white rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex items-center gap-2 font-medium"
                >
                  <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                  <span className="hidden sm:inline">New Admission</span>
                </button>

                {/* User Avatar - Desktop (right side) */}
                {user && (
                  <div className="relative">
                    <button
                      ref={avatarButtonRef}
                      onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                      className="relative group focus:outline-none"
                    >
                      {/* Pulsating outer ring */}
                      <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4] to-[#0197d4] rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300"></div>
                      <div className="absolute -inset-1 bg-gradient-to-br from-[#01b9d4] to-[#0197d4] rounded-full opacity-50"></div>

                      {/* Avatar circle */}
                      <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                        <img
                          src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                          alt={user.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`;
                          }}
                        />
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Premium Dropdown Modal - Using Portal */}
        {isAvatarDropdownOpen && createPortal(
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] animate-in fade-in duration-200"
              onClick={() => setIsAvatarDropdownOpen(false)}
            />

            {/* Premium Modal Dropdown */}
            <div
              style={{
                position: 'fixed',
                top: avatarButtonRef.current ? avatarButtonRef.current.getBoundingClientRect().bottom + 16 : 0,
                right: avatarButtonRef.current ? window.innerWidth - avatarButtonRef.current.getBoundingClientRect().right : 0,
                zIndex: 99999
              }}
              className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px] animate-in fade-in slide-in-from-top-3 duration-300"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
                <button
                  onClick={() => setIsAvatarDropdownOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                </button>
              </div>

              {/* User Info Card */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-4">
                  <div className="relative flex-shrink-0">
                    <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                      <img
                        src={user?.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                        alt={user?.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-base font-semibold text-gray-900">{user?.name}</p>
                    <p className="text-sm text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>{user?.email}</p>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-red-500 to-rose-600 text-white mt-1">
                      {user?.role}
                    </span>
                  </div>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={() => {
                  setIsAvatarDropdownOpen(false);
                  handleLogout();
                }}
                className="w-full px-4 py-3 text-sm bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl transition-colors font-semibold hover:shadow-lg flex items-center justify-center gap-2"
              >
                <Icon icon="solar:logout-3-bold-duotone" className="w-4 h-4" />
                Logout
              </button>
            </div>
          </>,
          document.body
        )}

        {/* Main Tab Navigation - Professional Style */}
        <div className="bg-white rounded-none sm:rounded-2xl shadow-lg border border-gray-200 border-x-0 sm:border-x overflow-hidden mx-0 sm:mx-0">
          <div className="grid grid-cols-5 gap-0 w-full">
            {(['overview', 'clinical', 'nursing', 'authorization', 'protocols'] as const).map((tab, index) => {
              const tabConfig = {
                overview: { icon: 'solar:chart-square-bold-duotone', label: 'Overview' },
                clinical: { icon: 'solar:stethoscope-bold-duotone', label: 'Ward Rounds' },
                nursing: { icon: 'solar:pills-bold-duotone', label: 'Medications' },
                authorization: { icon: 'solar:shield-check-bold-duotone', label: 'Medical Aid', badge: authorizationRequests.filter(a => a.status === 'pending').length },
                protocols: { icon: 'solar:document-medicine-bold-duotone', label: 'Protocols' }
              };
              const { icon, label, badge } = tabConfig[tab];
              const isActive = activeTab === tab;

              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-6 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize flex-1 rounded-lg ${
                    isActive
                      ? 'bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white shadow-lg hover:shadow-xl z-10'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={icon} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="text-[10px] sm:text-sm truncate">{label}</span>
                  {badge !== undefined && badge > 0 && (
                    <span className="absolute top-1 right-1 w-5 h-5 bg-white text-red-600 text-xs rounded-full flex items-center justify-center font-bold">
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content - Standard Pattern */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
              {/* Overview Tab */}
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="grid grid-cols-12 gap-6"
                >
                  {/* Left Column - Visual Bed Management */}
                  <div className="col-span-12 lg:col-span-4 space-y-6">
                    {/* Hospital Bed Management System with Theme Colors */}
                    <Card className="bg-white border border-gray-200 shadow-xl overflow-hidden">
                      <CardHeader className="pb-3 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] border-b border-[#0197d4]/20">
                        <CardTitle className="text-base font-bold text-white flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:hospital-bed-bold-duotone" className="w-6 h-6 text-white/90" />
                            <div>
                              <span className="block">Bed Management</span>
                              <span className="text-xs font-normal text-white/70">Live Tracking</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 px-3 py-1 bg-white/20 rounded-full">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-xs text-white font-medium">LIVE</span>
                          </div>
                        </CardTitle>
                      </CardHeader>
                      <CardContent
                        className="p-4 space-y-4 max-h-[650px] overflow-y-auto relative z-10"
                        style={{
                          scrollbarWidth: 'thin',
                          scrollbarColor: 'rgba(0,193,208,0.3) rgba(255,255,255,0.1)',
                        }}
                      >
                        {/* Simple Stats Display */}
                        <div className="grid grid-cols-3 gap-2 p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="text-center">
                            <p className="text-2xl font-bold text-gray-600">{stats.beds.available}</p>
                            <p className="text-xs text-gray-600">Available</p>
                          </div>
                          <div className="text-center border-x border-gray-200">
                            <p className="text-2xl font-bold" style={{ color: '#00a7ad' }}>{stats.beds.occupied}</p>
                            <p className="text-xs text-gray-600">Occupied</p>
                          </div>
                          <div className="text-center">
                            <p className="text-2xl font-bold text-[#01b9d4]">{totalBeds}</p>
                            <p className="text-xs text-gray-600">Total</p>
                          </div>
                        </div>

                        {/* All Wards with Bed Visualization */}
                        <div className="space-y-2">
                          {wards.map((ward, wardIndex) => {
                            const wardBeds = beds.filter(bed => bed.ward_id === ward.id);
                            const occupiedCount = wardBeds.filter(bed => bed.status === 'occupied').length;
                            const totalCount = wardBeds.length;

                            if (totalCount === 0) return null;

                            // Group beds by room
                            const roomGroups = wardBeds.reduce((acc, bed) => {
                              const roomMatch = bed.bed_number.match(/R(\d+)/);
                              const roomNumber = roomMatch ? roomMatch[1] : '1';
                              if (!acc[roomNumber]) acc[roomNumber] = [];
                              acc[roomNumber].push(bed);
                              return acc;
                            }, {} as Record<string, typeof wardBeds>);

                            return (
                              <div
                                key={ward.id}
                                className="mb-3"
                              >
                                {/* Clean Ward Header */}
                                <div className="bg-gray-100 border-b-2 border-gray-300 px-3 py-1.5 flex items-center justify-between">
                                  <span className="text-sm font-bold text-gray-700">{ward.ward_name}</span>
                                  <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-1">
                                      <div className="w-16 h-1.5 bg-gray-300 rounded-full overflow-hidden">
                                        <div
                                          className="h-full bg-[#00a7ad] transition-all duration-500"
                                          style={{ width: `${Math.round((occupiedCount / totalCount) * 100)}%` }}
                                        />
                                      </div>
                                      <span className="text-[11px] text-gray-600 font-medium">
                                        {occupiedCount}/{totalCount}
                                      </span>
                                    </div>
                                  </div>
                                </div>

                                {/* Premium Compact Bed Grid */}
                                <div className="bg-white p-2 border-x border-b border-gray-200">
                                  <div className="grid grid-cols-6 gap-1">
                                    {wardBeds.map((bed, bedIndex) => {
                                      const roomMatch = bed.bed_number.match(/R(\d+)/);
                                      const roomNumber = roomMatch ? roomMatch[1] : '1';
                                      const bedNumber = bed.bed_number.split('-').pop();

                                      return (
                                        <motion.button
                                          key={bed.id}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          transition={{
                                            delay: bedIndex * 0.01,
                                            type: "spring",
                                            stiffness: 400
                                          }}
                                          whileHover={{
                                            scale: 1.08,
                                            boxShadow: bed.status === 'occupied'
                                              ? '0 4px 12px rgba(0,167,173,0.4)'
                                              : '0 4px 12px rgba(0,0,0,0.1)',
                                            zIndex: 10
                                          }}
                                          whileTap={{ scale: 0.95 }}
                                          onClick={() => {
                                            if (bed.status === 'available') {
                                              toast.success(
                                                <div>
                                                  <div className="font-medium">Bed Available</div>
                                                  <div className="text-xs opacity-90">Room {roomNumber} • Bed {bedNumber}</div>
                                                </div>,
                                                { duration: 2000 }
                                              );
                                            } else {
                                              toast(
                                                <div>
                                                  <div className="font-medium">Bed Occupied</div>
                                                  <div className="text-xs opacity-90">Room {roomNumber} • Bed {bedNumber}</div>
                                                </div>,
                                                {
                                                  duration: 2000,
                                                  icon: '🛏️'
                                                }
                                              );
                                            }
                                          }}
                                          className="relative group"
                                        >
                                          <div className={cn(
                                            "relative h-14 rounded-md flex flex-col items-center justify-center transition-all border-2",
                                            bed.status === 'occupied'
                                              ? 'bg-gradient-to-b from-[#00a7ad] to-[#008a90] border-[#00a7ad] text-white shadow-md'
                                              : 'bg-gradient-to-b from-gray-100 to-gray-200 border-gray-300 text-gray-700 hover:from-gray-50 hover:to-gray-150'
                                          )}>
                                            <span className="text-[10px] font-medium opacity-70">
                                              R{roomNumber}
                                            </span>
                                            <span className={cn(
                                              "text-base font-bold leading-none",
                                              bed.status === 'occupied' ? 'text-white' : 'text-gray-800'
                                            )}>
                                              {bedNumber}
                                            </span>
                                            {bed.status === 'occupied' && (
                                              <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-white rounded-full shadow-md flex items-center justify-center">
                                                <div className="w-1.5 h-1.5 bg-[#00a7ad] rounded-full animate-pulse" />
                                              </div>
                                            )}
                                          </div>

                                          {/* Premium Tooltip */}
                                          <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-30">
                                            <div className={cn(
                                              "px-2.5 py-1 rounded-md text-xs font-medium shadow-xl backdrop-blur-sm",
                                              bed.status === 'occupied'
                                                ? 'bg-[#00a7ad]/95 text-white'
                                                : 'bg-gray-800/95 text-white'
                                            )}>
                                              Room {roomNumber} • Bed {bedNumber}
                                              <div className="text-[10px] opacity-80 mt-0.5">
                                                {bed.status === 'occupied' ? 'Occupied' : 'Available'}
                                              </div>
                                            </div>
                                          </div>
                                        </motion.button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Theme-colored Action Button */}
                        <button
                          onClick={() => navigate('/inpatient/beds')}
                          className="w-full py-2.5 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] hover:from-[#0197d4] hover:to-[#01b9d4] text-white text-sm font-medium rounded-lg shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all duration-300 flex items-center justify-center gap-2"
                        >
                          <Icon icon="solar:settings-minimalistic-bold-duotone" className="w-4 h-4" />
                          <span>Advanced Bed Management</span>
                        </button>
                      </CardContent>
                    </Card>

                    {/* Nursing Alerts */}
                    <Card className="bg-white border border-gray-200 shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold text-gray-700 flex items-center gap-2">
                          <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-500" />
                          Critical Alerts
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-red-50 to-red-100 rounded-lg border-2 border-red-200">
                          <Icon icon="solar:pills-bold-duotone" className="w-5 h-5 text-red-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{stats.clinical.pendingMedications} Medications Due</p>
                            <p className="text-xs text-gray-600">Next round in 15 mins</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg border-2 border-orange-200">
                          <Icon icon="solar:clipboard-heart-bold-duotone" className="w-5 h-5 text-orange-600 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{stats.clinical.vitalsOverdue} Vitals Overdue</p>
                            <p className="text-xs text-gray-600">Ward B, Room 3 & 5</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Right Column - Charts & Statistics */}
                  <div className="col-span-12 lg:col-span-8 space-y-6">
                    {/* Healthcare Analytics Metrics */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-[#01b9d4] to-[#0197d4] rounded-xl shadow-lg">
                          <Icon icon="solar:chart-2-bold-duotone" className="w-5 h-5 text-white" />
                        </div>
                        <div>
                          <h2 className="text-lg font-semibold text-gray-900">Healthcare Analytics Metrics</h2>
                          <p className="text-sm text-gray-500">Key performance indicators for inpatient care</p>
                        </div>
                      </div>

                      {/* Key Metrics Summary Cards */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="bg-gradient-to-br from-cyan-50/50 to-white rounded-xl p-4 shadow-lg border border-[#01b9d4]/20"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-gradient-to-br from-[#01b9d4] to-[#0197d4] rounded-lg">
                              <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <h4 className="text-2xl font-bold text-gray-800">5.2</h4>
                          <p className="text-sm text-gray-600 font-medium">Avg Length of Stay</p>
                          <p className="text-xs text-[#0197d4] mt-1">days</p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="bg-gradient-to-br from-cyan-50/50 to-white rounded-xl p-4 shadow-lg border border-[#00a7ad]/20"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-gradient-to-br from-[#00a7ad] to-[#008a90] rounded-lg">
                              <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <h4 className="text-2xl font-bold text-gray-800">{Math.round(stats.beds.occupancyRate)}%</h4>
                          <p className="text-sm text-gray-600 font-medium">Bed Occupancy Ratio</p>
                          <p className="text-xs text-purple-600 mt-1">current</p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-lg border border-green-100"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                              <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <h4 className="text-2xl font-bold text-gray-800">2.3x</h4>
                          <p className="text-sm text-gray-600 font-medium">Bed Turnover</p>
                          <p className="text-xs text-green-600 mt-1">average</p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 shadow-lg border border-orange-100"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg">
                              <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <h4 className="text-2xl font-bold text-gray-800">342</h4>
                          <p className="text-sm text-gray-600 font-medium">Outpatient Visits</p>
                          <p className="text-xs text-orange-600 mt-1">this month</p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 shadow-lg border border-indigo-100"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="p-2 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg">
                              <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          <h4 className="text-2xl font-bold text-gray-800">1.2</h4>
                          <p className="text-sm text-gray-600 font-medium">Turnover Interval</p>
                          <p className="text-xs text-indigo-600 mt-1">days</p>
                        </motion.div>
                      </div>
                    </div>

                    {/* Admission Trends Chart */}
                    <Card className="bg-white border border-gray-200 shadow-lg">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                          <Icon icon="solar:calendar-line-duotone" className="w-5 h-5 text-cyan-500" />
                          7-Day Admission Trends
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                          <LineChart
                            data={[
                              { day: 'Mon', admissions: 4, discharges: 2 },
                              { day: 'Tue', admissions: 6, discharges: 5 },
                              { day: 'Wed', admissions: 3, discharges: 4 },
                              { day: 'Thu', admissions: 7, discharges: 3 },
                              { day: 'Fri', admissions: 5, discharges: 6 },
                              { day: 'Sat', admissions: 4, discharges: 2 },
                              { day: 'Sun', admissions: 5, discharges: 3 }
                            ]}
                            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                          >
                            <defs>
                              <linearGradient id="admissionGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
                              </linearGradient>
                              <linearGradient id="dischargeGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                                <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                            <XAxis
                              dataKey="day"
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              interval={0}
                              angle={-45}
                              textAnchor="end"
                              height={60}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: '#6b7280' }}
                              label={{ value: 'Number of Patients', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: '#374151' } }}
                            />
                            <Tooltip />
                            <Legend wrapperStyle={{ fontSize: 12 }} />

                            {/* Area fill for admissions */}
                            <Area
                              type="monotone"
                              dataKey="admissions"
                              stroke={COLORS.primary}
                              fill="url(#admissionGradient)"
                              strokeWidth={0}
                              name="Admissions Area"
                              legendType="none"
                            />

                            {/* Main admissions line */}
                            <Line
                              type="monotone"
                              dataKey="admissions"
                              stroke={COLORS.primary}
                              strokeWidth={3}
                              dot={{ fill: COLORS.primary, r: 4 }}
                              activeDot={{ r: 6 }}
                              name="Admissions"
                            />

                            {/* Discharges line */}
                            <Line
                              type="monotone"
                              dataKey="discharges"
                              stroke={COLORS.success}
                              strokeWidth={2}
                              strokeDasharray="5 5"
                              dot={{ fill: COLORS.success, r: 3 }}
                              name="Discharges"
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>

                  </div>
                </motion.div>
              )}

              {/* Ward Rounds Tab */}
              {activeTab === 'clinical' && (
                <motion.div
                  key="clinical"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-gray-900">Ward Round Schedule</CardTitle>
                        <button className="px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-colors">
                          Schedule New Round
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {wardRounds.map((round) => (
                          <div key={round.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'p-3 rounded-xl',
                                round.status === 'completed' ? 'bg-green-100' :
                                round.status === 'in-progress' ? 'bg-yellow-100' : 'bg-gray-100'
                              )}>
                                <Icon
                                  icon="solar:stethoscope-bold-duotone"
                                  className={cn(
                                    'w-6 h-6',
                                    round.status === 'completed' ? 'text-green-600' :
                                    round.status === 'in-progress' ? 'text-yellow-600' : 'text-gray-600'
                                  )}
                                />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{round.wardName}</h4>
                                <div className="flex items-center gap-4 mt-1">
                                  <span className="text-sm text-gray-600 flex items-center gap-1">
                                    <Icon icon="solar:user-bold-duotone" className="w-3.5 h-3.5" />
                                    {round.doctor}
                                  </span>
                                  <span className="text-sm text-gray-600 flex items-center gap-1">
                                    <Icon icon="solar:clock-circle-bold-duotone" className="w-3.5 h-3.5" />
                                    {round.scheduledTime}
                                  </span>
                                  <span className="text-sm text-gray-600">
                                    {round.patientsVisited}/{round.totalPatients} patients
                                  </span>
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {round.status === 'pending' && (
                                <button
                                  onClick={() => handleStartWardRound(round)}
                                  className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors"
                                >
                                  Start Round
                                </button>
                              )}
                              {round.status === 'in-progress' && (
                                <div className="flex items-center gap-2">
                                  <div className="w-24 bg-gray-200 rounded-full h-2">
                                    <div
                                      className="bg-cyan-500 h-2 rounded-full transition-all"
                                      style={{ width: `${(round.patientsVisited / round.totalPatients) * 100}%` }}
                                    />
                                  </div>
                                  <button className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                                    Continue
                                  </button>
                                </div>
                              )}
                              {round.status === 'completed' && (
                                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                  Completed
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Nursing/Medication Tab */}
              {activeTab === 'nursing' && (
                <motion.div
                  key="nursing"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-gray-900">Medication Schedule</CardTitle>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">Next round:</span>
                          <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-sm font-medium">
                            09:00 AM (in 15 mins)
                          </span>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {medicationSchedule.map((med) => (
                          <div key={med.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-center gap-4">
                              <div className={cn(
                                'p-3 rounded-xl',
                                med.status === 'administered' ? 'bg-green-100' :
                                med.status === 'skipped' ? 'bg-red-100' : 'bg-yellow-100'
                              )}>
                                <Icon
                                  icon="solar:pills-bold-duotone"
                                  className={cn(
                                    'w-6 h-6',
                                    med.status === 'administered' ? 'text-green-600' :
                                    med.status === 'skipped' ? 'text-red-600' : 'text-yellow-600'
                                  )}
                                />
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">{med.patientName}</h4>
                                <div className="flex items-center gap-4 mt-1">
                                  <span className="text-sm text-gray-600">{med.medication}</span>
                                  <span className="text-sm font-medium text-purple-600">{med.dosage}</span>
                                  <span className="text-sm text-gray-600 flex items-center gap-1">
                                    <Icon icon="solar:clock-circle-bold-duotone" className="w-3.5 h-3.5" />
                                    {med.time}
                                  </span>
                                  {med.nurse && (
                                    <span className="text-sm text-green-600 flex items-center gap-1">
                                      <Icon icon="solar:user-check-rounded-bold-duotone" className="w-3.5 h-3.5" />
                                      {med.nurse}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div>
                              {med.status === 'pending' && (
                                <button
                                  onClick={() => handleAdministerMedication(med)}
                                  className="px-3 py-1.5 bg-cyan-500 text-white rounded-lg text-sm font-medium hover:bg-cyan-600 transition-colors"
                                >
                                  Administer
                                </button>
                              )}
                              {med.status === 'administered' && (
                                <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                  <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 inline mr-1" />
                                  Done
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Medical Aid Authorization Tab */}
              {activeTab === 'authorization' && (
                <motion.div
                  key="authorization"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-gray-900">Medical Aid Authorizations</CardTitle>
                        <button className="px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-colors">
                          New Request
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-4">
                        {authorizationRequests.map((auth) => (
                          <div key={auth.id} className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-4">
                                <div className={cn(
                                  'p-3 rounded-xl',
                                  auth.status === 'approved' ? 'bg-green-100' :
                                  auth.status === 'rejected' ? 'bg-red-100' :
                                  auth.status === 'expired' ? 'bg-gray-100' : 'bg-yellow-100'
                                )}>
                                  <Icon
                                    icon="solar:shield-check-bold-duotone"
                                    className={cn(
                                      'w-6 h-6',
                                      auth.status === 'approved' ? 'text-green-600' :
                                      auth.status === 'rejected' ? 'text-red-600' :
                                      auth.status === 'expired' ? 'text-gray-600' : 'text-yellow-600'
                                    )}
                                  />
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-medium text-gray-900">{auth.patientName}</h4>
                                  <div className="flex items-center gap-4 mt-1">
                                    <span className="text-sm text-gray-600 flex items-center gap-1">
                                      <Icon icon="solar:health-bold-duotone" className="w-3.5 h-3.5" />
                                      {auth.medicalAid}
                                    </span>
                                    <span className="text-sm text-gray-600">{auth.procedure}</span>
                                    <span className="text-sm font-medium text-purple-600">N$ {auth.amount.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs text-gray-500">Requested: {auth.requestDate}</span>
                                    {auth.status === 'pending' && (
                                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">
                                        Awaiting Response
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                {auth.status === 'pending' && (
                                  <>
                                    <button
                                      onClick={() => handleAuthorizationAction(auth, 'follow-up')}
                                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                                    >
                                      Follow Up
                                    </button>
                                    <button
                                      onClick={() => handleAuthorizationAction(auth, 'approve')}
                                      className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100 transition-colors"
                                    >
                                      Approve
                                    </button>
                                  </>
                                )}
                                {auth.status === 'approved' && (
                                  <span className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium">
                                    Approved
                                  </span>
                                )}
                                {auth.status === 'rejected' && (
                                  <span className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium">
                                    Rejected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Clinical Protocols Tab */}
              {activeTab === 'protocols' && (
                <motion.div
                  key="protocols"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
                >
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-semibold text-gray-900">Clinical Protocols & Pathways</CardTitle>
                        <button className="px-3 py-1.5 bg-cyan-50 text-cyan-600 rounded-lg text-sm font-medium hover:bg-cyan-100 transition-colors">
                          Add Protocol
                        </button>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="grid grid-cols-2 gap-4">
                        {protocols.map((protocol) => (
                          <div
                            key={protocol.id}
                            className="p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                            onClick={() => handleProtocolView(protocol)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="p-2 bg-purple-100 rounded-lg">
                                <Icon icon="solar:document-medicine-bold-duotone" className="w-5 h-5 text-purple-600" />
                              </div>
                              <span className={cn(
                                'px-2 py-1 rounded-lg text-xs font-medium',
                                protocol.compliance >= 90 ? 'bg-green-100 text-green-700' :
                                protocol.compliance >= 75 ? 'bg-yellow-100 text-yellow-700' :
                                'bg-red-100 text-red-700'
                              )}>
                                {protocol.compliance}% Compliance
                              </span>
                            </div>
                            <h4 className="font-medium text-gray-900 mb-1">{protocol.name}</h4>
                            <p className="text-sm text-gray-600 mb-3">{protocol.category}</p>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1">
                                <div className="w-20 bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-purple-500 h-1.5 rounded-full transition-all"
                                    style={{ width: `${(protocol.completedSteps / protocol.criticalSteps) * 100}%` }}
                                  />
                                </div>
                                <span className="text-xs text-gray-600">
                                  {protocol.completedSteps}/{protocol.criticalSteps}
                                </span>
                              </div>
                              <span className="text-xs text-gray-500">
                                Updated: {protocol.lastUpdated}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
          </AnimatePresence>
        </div>
      </div>

      {/* Floating Inpatient Tracker - Fixed Position at Bottom Right */}
      <FloatingInpatientTracker
        practiceId={practiceId!}
        onPatientSelect={handlePatientSelect}
        stats={stats}
      />

      {/* Modals */}
      {isPatientModalOpen && selectedPatient && (
        <ComprehensivePatientModal
          isOpen={isPatientModalOpen}
          onClose={() => setIsPatientModalOpen(false)}
          patient={selectedPatient}
          practiceId={practiceId!}
        />
      )}

      {isDischargeModalOpen && (
        <DischargeModal
          isOpen={isDischargeModalOpen}
          onClose={() => setIsDischargeModalOpen(false)}
          admission={selectedAdmission}
          onDischarge={() => {
            setIsDischargeModalOpen(false);
            toast.success('Patient discharged successfully');
          }}
        />
      )}

      {isBillingModalOpen && (
        <PremiumBillingModal
          isOpen={isBillingModalOpen}
          onClose={() => setIsBillingModalOpen(false)}
          patientName={selectedPatient?.first_name + ' ' + selectedPatient?.last_name}
          isInpatient={true}
          wardDetails={{
            wardType: 'general',
            dailyRate: 1500,
            admissionDate: new Date(),
            totalDays: 3,
            totalWardFees: 4500
          }}
        />
      )}

      {isSmsModalOpen && (
        <ProfessionalSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => setIsSmsModalOpen(false)}
          patient={selectedPatient}
          wardContext={{
            wardName: 'General Ward A',
            admissionNumber: 'ADM-2024-001',
            visitingHours: '10:00 AM - 8:00 PM',
            patientCondition: 'Stable'
          }}
        />
      )}

      {isVitalsModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Record Patient Vitals</h2>
              <button
                onClick={() => setIsVitalsModalOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <VitalsForm
              medicalRecordId="temp-id"
              onSuccess={() => {
                setIsVitalsModalOpen(false);
                toast.success('Vitals recorded successfully');
              }}
              isInpatient={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}