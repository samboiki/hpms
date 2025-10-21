import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, differenceInDays, addHours } from 'date-fns';
import { useInpatientStore } from '../../stores/inpatientStore';
import { usePractice } from '../../contexts/PracticeContext';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { toast } from 'react-hot-toast';
import ComprehensivePatientModal from '../patients/ComprehensivePatientModal';
import VisitActionModal from '../modals/VisitActionModal';
import ProfessionalSmsModal from '../messages/ProfessionalSmsModal';
import PremiumBillingModal from '../modals/PremiumBillingModal';
import FloatingInpatientTracker from './FloatingInpatientTracker';
import DischargeModal from './DischargeModal';

// Premium color palette - matching communications dashboard
const COLORS = {
  primary: '#06B6D4', // cyan
  secondary: '#0891B2', // cyan-dark
  tertiary: '#3B82F6', // blue
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  pink: '#EC4899',
  emerald: '#059669',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827'
  }
};

type TabType = 'overview' | 'admissions' | 'clinical' | 'financial' | 'insights';
type ViewMode = 'grid' | 'list' | 'timeline';

interface DashboardStats {
  beds: {
    total: number;
    occupied: number;
    available: number;
    maintenance: number;
    reserved: number;
    occupancyRate: number;
    turnoverRate: number;
  };
  admissions: {
    active: number;
    todayAdmissions: number;
    todayDischarges: number;
    scheduled: number;
    emergency: number;
    averageLOS: number;
    readmissionRate: number;
  };
  clinical: {
    criticalPatients: number;
    stablePatients: number;
    improvingPatients: number;
    nursingAlerts: number;
    pendingMedications: number;
    vitalsOverdue: number;
    doctorRounds: number;
  };
  financial: {
    pendingAuthorizations: number;
    approvedAuthorizations: number;
    deniedClaims: number;
    totalBillingToday: number;
    outstandingAmount: number;
    averageDailyRevenue: number;
    medicalAidCoverage: number;
  };
}

export default function InpatientCenter() {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const { user } = useAuthStore();
  const {
    wards,
    beds,
    activeAdmissions,
    fetchWards,
    fetchAllBedsWithStatus,
    fetchAdmissions,
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyRate
  } = useInpatientStore();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('today');

  // Modal states
  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<any>(null);
  const [isVisitActionModalOpen, setIsVisitActionModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [isBillingModalOpen, setIsBillingModalOpen] = useState(false);
  const [isDischargeModalOpen, setIsDischargeModalOpen] = useState(false);
  const [selectedAdmission, setSelectedAdmission] = useState<any>(null);

  useEffect(() => {
    if (practiceId) {
      loadDashboardData();
    }
  }, [practiceId, selectedPeriod]);

  const loadDashboardData = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);

      // Load real data
      await Promise.all([
        fetchWards(practiceId),
        fetchAllBedsWithStatus(practiceId),
        fetchAdmissions(practiceId, 'active')
      ]);

      // Calculate statistics
      const criticalCount = activeAdmissions.filter(a => a.patient_condition === 'critical').length;
      const stableCount = activeAdmissions.filter(a => a.patient_condition === 'stable').length;
      const todayAdmissions = activeAdmissions.filter(a => {
        const admissionDate = new Date(a.admission_date);
        const today = new Date();
        return admissionDate.toDateString() === today.toDateString();
      }).length;

      // Mock some financial data (would come from billing system)
      const mockFinancialData = {
        pendingAuthorizations: Math.floor(Math.random() * 15) + 5,
        approvedAuthorizations: Math.floor(Math.random() * 30) + 20,
        deniedClaims: Math.floor(Math.random() * 5) + 1,
        totalBillingToday: Math.floor(Math.random() * 50000) + 25000,
        outstandingAmount: Math.floor(Math.random() * 150000) + 50000,
        averageDailyRevenue: Math.floor(Math.random() * 40000) + 20000,
        medicalAidCoverage: 78
      };

      setStats({
        beds: {
          total: totalBeds,
          occupied: occupiedBeds,
          available: availableBeds,
          maintenance: beds.filter(b => b.status === 'maintenance').length,
          reserved: beds.filter(b => b.status === 'reserved').length,
          occupancyRate,
          turnoverRate: 4.2
        },
        admissions: {
          active: activeAdmissions.length,
          todayAdmissions,
          todayDischarges: Math.floor(Math.random() * 5) + 2,
          scheduled: Math.floor(Math.random() * 10) + 5,
          emergency: Math.floor(Math.random() * 3) + 1,
          averageLOS: 4.5,
          readmissionRate: 12.3
        },
        clinical: {
          criticalPatients: criticalCount,
          stablePatients: stableCount,
          improvingPatients: Math.floor(Math.random() * 10) + 5,
          nursingAlerts: Math.floor(Math.random() * 8) + 2,
          pendingMedications: Math.floor(Math.random() * 15) + 5,
          vitalsOverdue: Math.floor(Math.random() * 5) + 1,
          doctorRounds: Math.floor(Math.random() * 20) + 10
        },
        financial: mockFinancialData
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Handle patient selection from any component
  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient);
    setIsPatientModalOpen(true);
  };

  // Handle admission actions
  const handleAdmissionAction = (admission: any, action: string) => {
    setSelectedAdmission(admission);

    switch (action) {
      case 'view':
        setSelectedPatient(admission.patient);
        setIsPatientModalOpen(true);
        break;
      case 'discharge':
        setIsDischargeModalOpen(true);
        break;
      case 'billing':
        setIsBillingModalOpen(true);
        break;
      case 'sms':
        setSelectedPatient(admission.patient);
        setIsSmsModalOpen(true);
        break;
      default:
        break;
    }
  };

  // Generate trend data for charts
  const generateTrendData = () => {
    const days = selectedPeriod === 'today' ? 24 : selectedPeriod === 'week' ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const date = selectedPeriod === 'today'
        ? `${i}:00`
        : selectedPeriod === 'week'
        ? format(subDays(new Date(), 6 - i), 'EEE')
        : format(subDays(new Date(), 29 - i), 'MMM d');

      return {
        date,
        admissions: Math.floor(Math.random() * 10) + 5,
        discharges: Math.floor(Math.random() * 8) + 2,
        occupancy: Math.floor(Math.random() * 20) + 70,
        revenue: Math.floor(Math.random() * 10000) + 15000
      };
    });
  };

  // Ward distribution data for pie chart
  const wardDistribution = wards.map(ward => ({
    name: ward.ward_name,
    value: beds.filter(b => b.ward_id === ward.id && b.status === 'occupied').length,
    total: beds.filter(b => b.ward_id === ward.id).length,
    color: ward.ward_type === 'icu' ? COLORS.danger :
           ward.ward_type === 'emergency' ? COLORS.warning :
           ward.ward_type === 'pediatric' ? COLORS.pink :
           ward.ward_type === 'maternity' ? COLORS.purple :
           COLORS.primary
  }));

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon icon="solar:spinner-bold-duotone" className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading inpatient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gray-50">
      {/* Floating Inpatient Tracker - Always visible on the right */}
      <FloatingInpatientTracker
        practiceId={practiceId!}
        onPatientSelect={handlePatientSelect}
        stats={stats}
      />

      <div className="space-y-6 p-6 pr-20">
        {/* Header Section - Matching Communications Center Style */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="p-4 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-2xl shadow-lg">
                <Icon icon="solar:hospital-bold-duotone" className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Inpatient Center</h1>
                <p className="text-sm text-gray-600 mt-1">Comprehensive hospital admission and patient care management</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* User Avatar */}
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.name || 'Admin User'}</p>
                  <p className="text-xs text-gray-500">Hospital Administrator</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-cyan-400 to-cyan-600 flex items-center justify-center text-white font-semibold text-lg shadow-lg">
                  {user?.name?.charAt(0) || 'A'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div className="flex items-center gap-3 mt-6 pt-6 border-t border-gray-100">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate('/inpatient/admissions/new')}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-medium"
            >
              <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
              New Admission
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => toast.info('Authorization modal will open')}
              className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 font-medium"
            >
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5" />
              Request Authorization
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:shadow-md transition-all flex items-center gap-2 font-medium"
            >
              <Icon icon="solar:document-medicine-bold-duotone" className="w-5 h-5 text-purple-500" />
              Nursing Notes
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsDischargeModalOpen(true)}
              className="px-4 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl hover:shadow-md transition-all flex items-center gap-2 font-medium"
            >
              <Icon icon="solar:clipboard-remove-bold-duotone" className="w-5 h-5 text-orange-500" />
              Discharge Planning
            </motion.button>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-12 gap-6">
          {/* Left Column - Stats & Quick Info */}
          <div className="col-span-4 space-y-4">
            {/* Period Selector */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-heading tracking-tight text-base font-semibold text-gray-700">Time Period</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Select reporting timeframe</p>
                  </div>
                  <div className="p-2 bg-cyan-100 rounded-lg">
                    <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-cyan-500" />
                  </div>
                </div>
                <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
                  {(['today', 'week', 'month'] as const).map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                        selectedPeriod === period
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      {period.charAt(0).toUpperCase() + period.slice(1)}
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Premium Visual Bed Management */}
            <Card className="bg-white border border-gray-200 shadow-sm overflow-hidden">
              <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-white">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading tracking-tight text-base font-semibold text-gray-700">Bed Visualization</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">Live bed occupancy</p>
                  </div>
                  <div className="p-2 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-lg shadow">
                    <Icon icon="solar:hospital-bed-bold-duotone" className="w-5 h-5 text-white" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Status Summary */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 bg-gradient-to-br from-teal-50 to-cyan-50 rounded-lg border border-teal-200">
                    <div className="flex items-center justify-between">
                      <Icon icon="solar:bed-bold-duotone" className="w-5 h-5" style={{ color: '#00c1d0' }} />
                      <span className="text-lg font-bold" style={{ color: '#00c1d0' }}>{stats.beds.available}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Available</p>
                  </div>
                  <div className="p-3 bg-gradient-to-br from-red-50 to-rose-50 rounded-lg border border-red-200">
                    <div className="flex items-center justify-between">
                      <Icon icon="solar:user-check-rounded-bold-duotone" className="w-5 h-5" style={{ color: '#ff4f5a' }} />
                      <span className="text-lg font-bold" style={{ color: '#ff4f5a' }}>{stats.beds.occupied}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">Occupied</p>
                  </div>
                </div>

                {/* Ward Visual Grid */}
                <div className="space-y-3">
                  {wards.slice(0, 3).map((ward, wardIndex) => {
                    const wardBeds = beds.filter(bed => bed.ward_id === ward.id);
                    const occupiedCount = wardBeds.filter(bed => bed.status === 'occupied').length;
                    const availableCount = wardBeds.filter(bed => bed.status === 'available').length;
                    const totalCount = wardBeds.length;
                    const wardOccupancy = totalCount > 0 ? (occupiedCount / totalCount) * 100 : 0;

                    if (totalCount === 0) return null;

                    return (
                      <motion.div
                        key={ward.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: wardIndex * 0.1 }}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:border-gray-300 transition-all"
                      >
                        {/* Ward Header */}
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Icon
                              icon={
                                ward.ward_type === 'icu' ? 'solar:heart-pulse-bold-duotone' :
                                ward.ward_type === 'emergency' ? 'solar:siren-rounded-bold-duotone' :
                                'solar:hospital-bold-duotone'
                              }
                              className="w-4 h-4 text-gray-600"
                            />
                            <span className="text-xs font-semibold text-gray-700">{ward.ward_name}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            <span style={{ color: '#ff4f5a' }} className="font-bold">{occupiedCount}</span>/{totalCount}
                          </span>
                        </div>

                        {/* Visual Bed Grid */}
                        <div className="grid grid-cols-8 gap-1.5 mb-2">
                          {wardBeds.slice(0, 16).map((bed, bedIndex) => (
                            <motion.div
                              key={bed.id}
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ delay: wardIndex * 0.1 + bedIndex * 0.01 }}
                              className="group relative"
                            >
                              <div
                                className={`aspect-square rounded flex items-center justify-center cursor-pointer transition-all hover:scale-110 ${
                                  bed.status === 'occupied'
                                    ? 'shadow-sm'
                                    : bed.status === 'maintenance'
                                    ? 'bg-amber-500 shadow-sm'
                                    : 'shadow-sm'
                                }`}
                                style={{
                                  backgroundColor: bed.status === 'occupied' ? '#ff4f5a' :
                                                   bed.status === 'available' ? '#00c1d0' :
                                                   undefined
                                }}
                                title={`Bed ${bed.bed_number} - ${bed.status}`}
                              >
                                <Icon
                                  icon={
                                    bed.status === 'occupied' ? 'solar:sleeping-bold' :
                                    bed.status === 'maintenance' ? 'solar:settings-minimalistic-bold' :
                                    'solar:bed-bold'
                                  }
                                  className="w-3 h-3 text-white"
                                />
                              </div>

                              {/* Tooltip */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 whitespace-nowrap">
                                Bed {bed.bed_number}
                              </div>
                            </motion.div>
                          ))}
                          {wardBeds.length > 16 && (
                            <div className="aspect-square rounded border border-dashed border-gray-300 flex items-center justify-center text-[10px] text-gray-500">
                              +{wardBeds.length - 16}
                            </div>
                          )}
                        </div>

                        {/* Occupancy Bar */}
                        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${wardOccupancy}%` }}
                            transition={{ duration: 0.8, delay: wardIndex * 0.1 }}
                            className={`h-full ${
                              wardOccupancy > 90 ? 'bg-red-500' :
                              wardOccupancy > 70 ? 'bg-amber-500' :
                              'bg-teal-500'
                            }`}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* View More Link */}
                <button
                  onClick={() => navigate('/inpatient/beds')}
                  className="w-full py-2 text-xs font-medium text-cyan-600 hover:text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg transition-all flex items-center justify-center gap-1"
                >
                  <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
                  View All Beds
                </button>
              </CardContent>
            </Card>

            {/* Critical Alerts */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-heading tracking-tight text-base font-semibold text-gray-700">Critical Alerts</CardTitle>
                    <p className="text-xs text-gray-500 mt-0.5">Requires immediate attention</p>
                  </div>
                  <div className="p-2 bg-red-100 rounded-lg">
                    <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-500" />
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {stats.clinical.criticalPatients > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-red-50 rounded-lg border border-red-200">
                    <Icon icon="solar:heart-pulse-bold-duotone" className="w-5 h-5 text-red-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{stats.clinical.criticalPatients} Critical Patients</p>
                      <p className="text-xs text-gray-600">ICU monitoring required</p>
                    </div>
                  </div>
                )}
                {stats.clinical.vitalsOverdue > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <Icon icon="solar:clipboard-heart-bold-duotone" className="w-5 h-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{stats.clinical.vitalsOverdue} Vitals Overdue</p>
                      <p className="text-xs text-gray-600">Check required immediately</p>
                    </div>
                  </div>
                )}
                {stats.clinical.pendingMedications > 0 && (
                  <div className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                    <Icon icon="solar:pills-bold-duotone" className="w-5 h-5 text-yellow-600 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{stats.clinical.pendingMedications} Medications Pending</p>
                      <p className="text-xs text-gray-600">Awaiting administration</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="col-span-8 space-y-6">
            {/* Tab Navigation */}
            <Card className="bg-white border border-gray-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Hospital Operations</h2>
                    <p className="text-sm text-gray-600">Monitor admissions, clinical care, and financial metrics</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* View Mode Switcher */}
                    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                      <button
                        onClick={() => setViewMode('grid')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Icon icon="solar:widget-bold-duotone" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('list')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Icon icon="solar:list-bold-duotone" className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setViewMode('timeline')}
                        className={`p-2 rounded-md transition-all ${
                          viewMode === 'timeline' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                        }`}
                      >
                        <Icon icon="solar:timeline-bold-duotone" className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                  <button
                    onClick={() => setActiveTab('overview')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'overview'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon icon="solar:chart-square-bold-duotone" className="w-4 h-4" />
                    Overview
                  </button>
                  <button
                    onClick={() => setActiveTab('admissions')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'admissions'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-4 h-4" />
                    Admissions
                  </button>
                  <button
                    onClick={() => setActiveTab('clinical')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'clinical'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon icon="solar:heart-pulse-bold-duotone" className="w-4 h-4" />
                    Clinical
                  </button>
                  <button
                    onClick={() => setActiveTab('financial')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'financial'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-4 h-4" />
                    Financial
                  </button>
                  <button
                    onClick={() => setActiveTab('insights')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                      activeTab === 'insights'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon icon="solar:lightbulb-bolt-bold-duotone" className="w-4 h-4" />
                    Insights
                  </button>
                </div>
              </CardContent>
            </Card>

            {/* Tab Content */}
            <AnimatePresence mode="wait">
              {activeTab === 'overview' && (
                <motion.div
                  key="overview"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Admission & Discharge Trends */}
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-cyan-100 rounded-lg">
                            <Icon icon="solar:graph-up-bold-duotone" className="w-5 h-5 text-cyan-600" />
                          </div>
                          <CardTitle className="text-lg font-semibold text-gray-900">Admission & Discharge Trends</CardTitle>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-6">
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={generateTrendData()}>
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
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" stroke="#9CA3AF" fontSize={11} />
                          <YAxis stroke="#9CA3AF" fontSize={12} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(255, 255, 255, 0.98)',
                              borderRadius: '8px',
                              border: `1px solid ${COLORS.primary}`,
                              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                            }}
                          />
                          <Area
                            type="monotone"
                            dataKey="admissions"
                            stroke={COLORS.primary}
                            fill="url(#admissionGradient)"
                            strokeWidth={2}
                            name="Admissions"
                          />
                          <Area
                            type="monotone"
                            dataKey="discharges"
                            stroke={COLORS.success}
                            fill="url(#dischargeGradient)"
                            strokeWidth={2}
                            name="Discharges"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  {/* Ward Distribution & Key Metrics */}
                  <div className="grid grid-cols-2 gap-6">
                    <Card className="bg-white border border-gray-200 shadow-sm">
                      <CardHeader className="pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-purple-100 rounded-lg">
                            <Icon icon="solar:hospital-bold-duotone" className="w-5 h-5 text-purple-600" />
                          </div>
                          <CardTitle className="text-lg font-semibold text-gray-900">Ward Distribution</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6">
                        <ResponsiveContainer width="100%" height={250}>
                          <PieChart>
                            <Pie
                              data={wardDistribution}
                              cx="50%"
                              cy="50%"
                              innerRadius={60}
                              outerRadius={90}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {wardDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="mt-4 space-y-2">
                          {wardDistribution.map((ward, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: ward.color }}></div>
                                <span className="text-xs text-gray-700">{ward.name}</span>
                              </div>
                              <span className="text-xs font-semibold text-gray-900">{ward.value}/{ward.total}</span>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-white border border-gray-200 shadow-sm">
                      <CardHeader className="pb-3 border-b border-gray-100">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-indigo-100 rounded-lg">
                            <Icon icon="solar:chart-2-bold-duotone" className="w-5 h-5 text-indigo-600" />
                          </div>
                          <CardTitle className="text-lg font-semibold text-gray-900">Key Metrics</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent className="p-6 space-y-4">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-blue-500" />
                            <span className="text-sm text-gray-700">Average Length of Stay</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{stats.admissions.averageLOS} days</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:rewind-back-bold-duotone" className="w-5 h-5 text-orange-500" />
                            <span className="text-sm text-gray-700">Readmission Rate</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{stats.admissions.readmissionRate}%</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:medical-kit-bold-duotone" className="w-5 h-5 text-green-500" />
                            <span className="text-sm text-gray-700">Doctor Rounds Today</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{stats.clinical.doctorRounds}</span>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div className="flex items-center gap-3">
                            <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-5 h-5 text-cyan-500" />
                            <span className="text-sm text-gray-700">Avg Daily Revenue</span>
                          </div>
                          <span className="text-lg font-bold text-gray-900">R{stats.financial.averageDailyRevenue.toLocaleString()}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </motion.div>
              )}

              {activeTab === 'admissions' && (
                <motion.div
                  key="admissions"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6"
                >
                  {/* Admissions content - showing current patients */}
                  <Card className="bg-white border border-gray-200 shadow-sm">
                    <CardHeader className="pb-3 border-b border-gray-100">
                      <CardTitle className="text-lg font-semibold text-gray-900">Current Admissions</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        {activeAdmissions.slice(0, 5).map((admission: any) => (
                          <div
                            key={admission.id}
                            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                            onClick={() => handleAdmissionAction(admission, 'view')}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium text-sm ${
                                admission.patient_condition === 'critical' ? 'bg-red-500' :
                                admission.patient_condition === 'serious' ? 'bg-orange-500' :
                                'bg-green-500'
                              }`}>
                                {admission.patient?.first_name?.[0]}{admission.patient?.last_name?.[0]}
                              </div>
                              <div>
                                <h4 className="font-medium text-gray-900">
                                  {admission.patient?.first_name} {admission.patient?.last_name}
                                </h4>
                                <p className="text-sm text-gray-500">
                                  {admission.admission_number} • {admission.current_bed?.ward_name} - Bed {admission.current_bed?.bed_number}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdmissionAction(admission, 'billing');
                                }}
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                              >
                                <Icon icon="solar:dollar-minimalistic-bold-duotone" className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdmissionAction(admission, 'sms');
                                }}
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                              >
                                <Icon icon="solar:chat-square-bold-duotone" className="w-4 h-4 text-gray-600" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAdmissionAction(admission, 'discharge');
                                }}
                                className="p-2 hover:bg-white rounded-lg transition-colors"
                              >
                                <Icon icon="solar:logout-3-bold-duotone" className="w-4 h-4 text-gray-600" />
                              </button>
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
      </div>

      {/* Modals - Reusing existing components */}
      {selectedPatient && (
        <ComprehensivePatientModal
          patient={selectedPatient}
          isOpen={isPatientModalOpen}
          onClose={() => {
            setIsPatientModalOpen(false);
            setSelectedPatient(null);
          }}
          defaultTab="inpatient" // Will show inpatient tab when patient is admitted
        />
      )}

      {selectedVisit && (
        <VisitActionModal
          isOpen={isVisitActionModalOpen}
          onClose={() => {
            setIsVisitActionModalOpen(false);
            setSelectedVisit(null);
          }}
          visit={selectedVisit}
          visitStatus={selectedVisit.status}
          // Additional inpatient actions will be added in the modal extension
        />
      )}

      {selectedPatient && (
        <ProfessionalSmsModal
          isOpen={isSmsModalOpen}
          onClose={() => {
            setIsSmsModalOpen(false);
          }}
          patient={selectedPatient}
          // Ward-specific templates will be added in the modal extension
        />
      )}

      {selectedAdmission && (
        <PremiumBillingModal
          isOpen={isBillingModalOpen}
          onClose={() => {
            setIsBillingModalOpen(false);
            setSelectedAdmission(null);
          }}
          patient={selectedAdmission?.patient}
          admission={selectedAdmission} // Pass admission for ward fee calculation
        />
      )}

      {selectedAdmission && (
        <DischargeModal
          isOpen={isDischargeModalOpen}
          onClose={() => {
            setIsDischargeModalOpen(false);
            setSelectedAdmission(null);
          }}
          admission={selectedAdmission}
          onDischarge={() => {
            loadDashboardData();
            setIsDischargeModalOpen(false);
          }}
        />
      )}
    </div>
  );
}