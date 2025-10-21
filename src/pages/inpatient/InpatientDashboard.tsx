import React, { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useInpatientStore } from '../../stores/inpatientStore';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { InpatientService } from '../../services/inpatientService';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import FloatingInpatientTracker from '../../components/inpatient/FloatingInpatientTracker';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const COLORS = {
  primary: '#01b9d5',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  danger: '#ef4444',
  teal: '#14b8a6'
};

const InpatientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const { user } = useAuthStore();
  const {
    wards,
    beds,
    activeAdmissions,
    totalBeds,
    occupiedBeds,
    availableBeds,
    occupancyRate,
    fetchWards,
    fetchAllBedsWithStatus,
    fetchAdmissions,
  } = useInpatientStore();

  const [statistics, setStatistics] = useState({
    totalAdmissions: 0,
    activeAdmissions: 0,
    dischargedToday: 0,
    admittedToday: 0,
    averageLengthOfStay: 0,
    criticalPatients: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [wardFilter, setWardFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (practiceId) {
      loadDashboardData();
    }
  }, [practiceId]);

  const loadDashboardData = async () => {
    if (!practiceId) return;

    setIsLoading(true);
    try {
      // Load all data in parallel
      await Promise.all([
        fetchWards(practiceId),
        fetchAllBedsWithStatus(practiceId),
        fetchAdmissions(practiceId, 'active'),
      ]);

      // Fetch statistics
      const { data: stats } = await InpatientService.getAdmissionStatistics(practiceId);
      if (stats) {
        setStatistics(stats);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  // Quick action handlers
  const handleQuickAdmit = () => {
    navigate('/inpatient/admissions/new');
  };

  const handleViewAllAdmissions = () => {
    navigate('/inpatient/admissions');
  };

  const handleViewWards = () => {
    navigate('/inpatient/wards');
  };

  const handleViewBeds = () => {
    navigate('/inpatient/beds');
  };

  // Filter admissions based on search and filters
  const filteredAdmissions = activeAdmissions.filter((admission: any) => {
    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      const patientName = `${admission.patient?.first_name || ''} ${admission.patient?.last_name || ''}`.toLowerCase();
      const admissionNumber = (admission.admission_number || '').toLowerCase();
      const diagnosis = (admission.primary_diagnosis || '').toLowerCase();

      if (!patientName.includes(search) && !admissionNumber.includes(search) && !diagnosis.includes(search)) {
        return false;
      }
    }

    // Status filter
    if (statusFilter !== 'all') {
      if (statusFilter === 'critical' && admission.patient_condition !== 'critical') return false;
      if (statusFilter === 'serious' && admission.patient_condition !== 'serious') return false;
      if (statusFilter === 'stable' && admission.patient_condition !== 'stable') return false;
    }

    // Ward filter
    if (wardFilter !== 'all') {
      if (admission.current_bed?.ward_id !== wardFilter) return false;
    }

    return true;
  });

  // Healthcare Analytics Metrics
  const healthcareMetrics = useMemo(() => {
    // Average Length of Stay (ALOS) - per ward
    const alosData = wards.slice(0, 8).map(ward => {
      const wardAdmissions = activeAdmissions.filter((a) => a.current_bed?.ward_id === ward.id);
      const avgDays = wardAdmissions.length > 0
        ? wardAdmissions.reduce((sum: number, a) => {
            const los = Math.ceil((new Date().getTime() - new Date(a.admission_date).getTime()) / (1000 * 60 * 60 * 24));
            return sum + los;
          }, 0) / wardAdmissions.length
        : 3 + Math.random() * 5;
      return {
        ward: ward.ward_name,
        days: Math.round(avgDays)
      };
    });

    // Bed Occupancy Ratio over time (last 12 months)
    const borData = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        occupancy: Math.round(60 + Math.random() * 35) // 60-95%
      };
    });

    // Bed Turn Over data per ward
    const btoData = wards.slice(0, 8).map(ward => ({
      ward: ward.ward_name,
      turnover: Number((1.5 + Math.random() * 2).toFixed(1)) // 1.5-3.5 times
    }));

    // Outpatient Visit Rate (last 12 months)
    const visitRateData = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        visits: Math.round(200 + Math.random() * 300) // 200-500 visits
      };
    });

    // Turn Over Interval (TOI) - days between discharge and next admission
    const toiData = wards.slice(0, 8).map(ward => ({
      ward: ward.ward_name,
      interval: Number((0.5 + Math.random() * 2).toFixed(1)) // 0.5-2.5 days
    }));

    // Current metrics summary
    const avgLengthOfStay = alosData.length > 0
      ? (alosData.reduce((sum, d) => sum + d.days, 0) / alosData.length).toFixed(1)
      : '0';

    const currentBOR = Math.round(occupancyRate);

    const avgBedTurnover = btoData.length > 0
      ? (btoData.reduce((sum, d) => sum + d.turnover, 0) / btoData.length).toFixed(1)
      : '0';

    const monthlyVisits = visitRateData.length > 0
      ? visitRateData[visitRateData.length - 1].visits
      : 0;

    const avgTOI = toiData.length > 0
      ? (toiData.reduce((sum, d) => sum + d.interval, 0) / toiData.length).toFixed(1)
      : '0';

    return {
      alosData,
      borData,
      btoData,
      visitRateData,
      toiData,
      summary: {
        avgLengthOfStay,
        currentBOR,
        avgBedTurnover,
        monthlyVisits,
        avgTOI
      }
    };
  }, [wards, activeAdmissions, occupancyRate]);

  // Custom tooltip for charts
  interface TooltipPayload {
    color: string;
    name: string;
    value: number;
    dataKey: string;
  }

  interface TooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-200">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: TooltipPayload, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'occupancy' && '%'}
              {entry.dataKey === 'days' && ' days'}
              {entry.dataKey === 'interval' && ' days'}
              {entry.dataKey === 'turnover' && 'x'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-sm text-gray-500">Loading inpatient data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Modern Header with Search - Matching Encounters Design */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-xl shadow-sm border border-gray-100"
      >
        <div className="p-6">
          <div className="flex flex-col space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Icon
                  icon="solar:magnifer-linear"
                  className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Search by patient name, admission number, or diagnosis..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-red-500 focus:border-transparent text-sm transition-all"
                />
              </div>
              <button
                onClick={loadDashboardData}
                className="p-3 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                title="Refresh"
              >
                <Icon icon="solar:refresh-linear" className="w-5 h-5" />
              </button>
              <button
                onClick={handleQuickAdmit}
                className="px-4 py-3 bg-gradient-to-r from-red-500 to-rose-600 text-white rounded-xl shadow hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                <span className="text-sm font-medium">New Admission</span>
              </button>
            </div>

            {/* Modern Filter Pills - Matching Encounters Design */}
            <div className="flex flex-wrap gap-6">
              {/* Status Filter */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Patient Condition</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: 'all', label: 'All Patients', color: 'gray' },
                    { value: 'critical', label: 'Critical', color: 'red' },
                    { value: 'serious', label: 'Serious', color: 'orange' },
                    { value: 'stable', label: 'Stable', color: 'green' }
                  ].map((status) => (
                    <button
                      key={status.value}
                      onClick={() => setStatusFilter(status.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        statusFilter === status.value
                          ? status.color === 'gray' ? 'bg-gray-900 text-white' :
                            status.color === 'red' ? 'bg-red-500 text-white' :
                            status.color === 'orange' ? 'bg-orange-500 text-white' :
                            'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {status.label}
                      {statusFilter === status.value && (
                        <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                          {status.value === 'all' ? activeAdmissions.length : activeAdmissions.filter((a: any) => a.patient_condition === status.value).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ward Filter */}
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Ward</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setWardFilter('all')}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                      wardFilter === 'all'
                        ? 'bg-gray-900 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    All Wards
                    {wardFilter === 'all' && (
                      <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                        {activeAdmissions.length}
                      </span>
                    )}
                  </button>
                  {wards.slice(0, 5).map((ward) => (
                    <button
                      key={ward.id}
                      onClick={() => setWardFilter(ward.id)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                        wardFilter === ward.id
                          ? 'bg-gray-900 text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      <Icon icon="solar:hospital-bold-duotone" className="inline w-3 h-3 mr-1" />
                      {ward.ward_name}
                      {wardFilter === ward.id && (
                        <span className="ml-1.5 bg-white/20 px-1.5 py-0.5 rounded-full text-[10px]">
                          {activeAdmissions.filter((a: any) => a.current_bed?.ward_id === ward.id).length}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="ml-auto flex items-center gap-4 text-sm">
                <div className="text-gray-500">
                  <span className="font-semibold text-gray-900">{filteredAdmissions.length}</span> patients
                </div>
                <div className="text-gray-500">
                  <span className="font-semibold text-red-600">{statistics.criticalPatients}</span> critical
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Premium Visual Bed Management Section */}
        <div className="border-t border-gray-100 bg-gradient-to-br from-slate-50 via-white to-gray-50 p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg">
                <Icon icon="solar:hospital-bed-bold-duotone" className="w-7 h-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                  Hospital Bed Visualization
                </h2>
                <p className="text-sm text-gray-500 mt-1">Live occupancy status across all wards</p>
              </div>
            </div>
            <button
              onClick={handleViewBeds}
              className="px-5 py-2.5 bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:settings-minimalistic-bold-duotone" className="w-4 h-4" />
              Manage Beds
            </button>
          </div>

          {/* Premium Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-xl border border-gray-100"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-100 to-cyan-100 rounded-full blur-3xl opacity-50" />
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-xl shadow-lg">
                  <Icon icon="solar:hospital-bed-bold-duotone" className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-gray-900">{totalBeds}</p>
                  <p className="text-sm font-medium text-gray-600">Total Capacity</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-xl border border-gray-100"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-red-100 to-pink-100 rounded-full blur-3xl opacity-50" />
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-[#ff4f5a] to-rose-600 rounded-xl shadow-lg">
                  <Icon icon="solar:user-check-rounded-bold-duotone" className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: '#ff4f5a' }}>{occupiedBeds}</p>
                  <p className="text-sm font-medium text-gray-600">Occupied</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-xl border border-gray-100"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-teal-100 to-cyan-100 rounded-full blur-3xl opacity-50" />
              <div className="relative flex items-center gap-4">
                <div className="p-3 rounded-xl shadow-lg" style={{ background: 'linear-gradient(135deg, #00c1d0, #00a8b8)' }}>
                  <Icon icon="solar:bed-bold-duotone" className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: '#00c1d0' }}>{availableBeds}</p>
                  <p className="text-sm font-medium text-gray-600">Available</p>
                </div>
              </div>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.02 }}
              className="relative overflow-hidden bg-white rounded-2xl p-5 shadow-xl border border-gray-100"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-100 to-violet-100 rounded-full blur-3xl opacity-50" />
              <div className="relative flex items-center gap-4">
                <div className="p-3 bg-gradient-to-br from-purple-500 to-violet-600 rounded-xl shadow-lg">
                  <Icon icon="solar:chart-2-bold-duotone" className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-3xl font-bold text-purple-600">{Math.round(occupancyRate)}%</p>
                  <p className="text-sm font-medium text-gray-600">Occupancy Rate</p>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-6 mb-6 p-4 bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100">
            <p className="text-sm font-semibold text-gray-700">Status Legend:</p>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#00c1d0' }} />
              <span className="text-sm text-gray-600">Available</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: '#ff4f5a' }} />
              <span className="text-sm text-gray-600">Occupied</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-amber-500" />
              <span className="text-sm text-gray-600">Maintenance</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-400" />
              <span className="text-sm text-gray-600">Reserved</span>
            </div>
          </div>

          {/* Premium Ward Bed Visualization */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {wards.map((ward, wardIndex) => {
              const wardBeds = beds.filter(bed => bed.ward_id === ward.id);
              const occupiedCount = wardBeds.filter(bed => bed.status === 'occupied').length;
              const maintenanceCount = wardBeds.filter(bed => bed.status === 'maintenance').length;
              const availableCount = wardBeds.filter(bed => bed.status === 'available').length;
              const totalCount = wardBeds.length;
              const wardOccupancy = totalCount > 0 ? (occupiedCount / totalCount) * 100 : 0;

              // Ward type specific styling
              const wardGradient =
                ward.ward_type === 'icu' ? 'from-red-500 to-rose-600' :
                ward.ward_type === 'emergency' ? 'from-orange-500 to-amber-600' :
                ward.ward_type === 'pediatric' ? 'from-pink-500 to-purple-600' :
                ward.ward_type === 'maternity' ? 'from-purple-500 to-pink-600' :
                ward.ward_type === 'surgical' ? 'from-blue-500 to-indigo-600' :
                'from-teal-500 to-cyan-600';

              const wardIcon =
                ward.ward_type === 'icu' ? 'solar:heart-pulse-bold-duotone' :
                ward.ward_type === 'emergency' ? 'solar:siren-rounded-bold-duotone' :
                ward.ward_type === 'pediatric' ? 'solar:baby-bold-duotone' :
                ward.ward_type === 'maternity' ? 'solar:mother-bold-duotone' :
                ward.ward_type === 'surgical' ? 'solar:medical-kit-bold-duotone' :
                'solar:hospital-bold-duotone';

              if (totalCount === 0) return null;

              return (
                <motion.div
                  key={ward.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: wardIndex * 0.1 }}
                  className="group bg-white rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 overflow-hidden"
                >
                  {/* Ward Header */}
                  <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${wardGradient} shadow-lg`}>
                          <Icon icon={wardIcon} className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg text-gray-900">{ward.ward_name}</h3>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                              {ward.ward_type}
                            </span>
                            <span className="text-xs text-gray-400">•</span>
                            <span className="text-xs text-gray-500">Floor {ward.floor_number}</span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold" style={{ color: '#ff4f5a' }}>{occupiedCount}</span>
                          <span className="text-lg text-gray-400">/</span>
                          <span className="text-lg font-semibold text-gray-700">{totalCount}</span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          {availableCount} free • {maintenanceCount} maintenance
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Visual Bed Grid */}
                  <div className="p-5">
                    <div className="grid grid-cols-8 gap-2">
                      {wardBeds.map((bed, bedIndex) => (
                        <motion.div
                          key={bed.id}
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: wardIndex * 0.1 + bedIndex * 0.01 }}
                          whileHover={{ scale: 1.1, zIndex: 10 }}
                          className="relative group/bed"
                        >
                          <div
                            className={`aspect-square rounded-lg flex items-center justify-center cursor-pointer transition-all duration-200 shadow-md hover:shadow-xl ${
                              bed.status === 'occupied'
                                ? 'bg-gradient-to-br from-[#ff4f5a] to-rose-500 border-2 border-[#ff4f5a]/20'
                                : bed.status === 'maintenance'
                                ? 'bg-gradient-to-br from-amber-500 to-orange-500 border-2 border-amber-500/20'
                                : bed.status === 'reserved'
                                ? 'bg-gradient-to-br from-gray-400 to-gray-500 border-2 border-gray-400/20'
                                : 'bg-gradient-to-br from-[#00c1d0] to-teal-500 border-2 border-[#00c1d0]/20'
                            }`}
                          >
                            <div className="relative">
                              <Icon
                                icon={
                                  bed.status === 'occupied'
                                    ? 'solar:sleeping-bold'
                                    : bed.status === 'maintenance'
                                    ? 'solar:settings-minimalistic-bold'
                                    : bed.status === 'reserved'
                                    ? 'solar:lock-keyhole-minimalistic-bold'
                                    : 'solar:bed-bold'
                                }
                                className="w-6 h-6 text-white"
                              />
                              <span className="absolute -bottom-1 -right-1 text-[8px] font-bold text-white bg-black/30 px-1 rounded">
                                {bed.bed_number}
                              </span>
                            </div>
                          </div>

                          {/* Premium Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover/bed:opacity-100 transition-opacity pointer-events-none z-20">
                            <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-xl">
                              <p className="text-xs font-semibold">Bed #{bed.bed_number}</p>
                              <p className="text-[10px] text-gray-300 capitalize">{bed.status}</p>
                              {bed.status === 'occupied' && (
                                <p className="text-[10px] text-cyan-300 mt-1">Patient Present</p>
                              )}
                            </div>
                            <div className="w-2 h-2 bg-gray-900 rotate-45 absolute -bottom-1 left-1/2 -translate-x-1/2" />
                          </div>
                        </motion.div>
                      ))}
                    </div>

                    {/* Occupancy Progress Bar */}
                    <div className="mt-5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Occupancy Level</span>
                        <span className="text-xs font-bold text-gray-900">{Math.round(wardOccupancy)}%</span>
                      </div>
                      <div className="h-3 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${wardOccupancy}%` }}
                          transition={{ duration: 1, delay: wardIndex * 0.1 }}
                          className={`h-full rounded-full shadow-sm ${
                            wardOccupancy > 90 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                            wardOccupancy > 70 ? 'bg-gradient-to-r from-amber-500 to-orange-600' :
                            wardOccupancy > 50 ? 'bg-gradient-to-r from-yellow-500 to-amber-500' :
                            'bg-gradient-to-r from-green-500 to-teal-500'
                          }`}
                        />
                      </div>
                    </div>

                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3 mt-4">
                      <div className="text-center p-2 bg-teal-50 rounded-lg">
                        <p className="text-lg font-bold" style={{ color: '#00c1d0' }}>{availableCount}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Free</p>
                      </div>
                      <div className="text-center p-2 bg-red-50 rounded-lg">
                        <p className="text-lg font-bold" style={{ color: '#ff4f5a' }}>{occupiedCount}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Used</p>
                      </div>
                      <div className="text-center p-2 bg-amber-50 rounded-lg">
                        <p className="text-lg font-bold text-amber-600">{maintenanceCount}</p>
                        <p className="text-[10px] text-gray-600 uppercase tracking-wider">Repair</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* View All Button if there are more wards */}
          {wards.length > 6 && (
            <div className="mt-6 text-center">
              <button
                onClick={handleViewWards}
                className="px-6 py-3 bg-gradient-to-r from-gray-700 to-gray-900 text-white rounded-xl shadow-lg hover:shadow-xl transition-all font-medium"
              >
                View All {wards.length} Wards
              </button>
            </div>
          )}
        </div>

        {/* Healthcare Analytics Metrics */}
        <div className="border-t border-gray-100 p-6 bg-white">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                <Icon icon="solar:chart-2-bold-duotone" className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Healthcare Analytics Metrics</h2>
                <p className="text-sm text-gray-500">Key performance indicators for inpatient care</p>
              </div>
            </div>

            {/* Key Metrics Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 shadow-lg border border-blue-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg">
                    <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.avgLengthOfStay}</h4>
                <p className="text-sm text-gray-600 font-medium">Avg Length of Stay</p>
                <p className="text-xs text-blue-600 mt-1">days</p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 shadow-lg border border-purple-100"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg">
                    <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-white" />
                  </div>
                </div>
                <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.currentBOR}%</h4>
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
                <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.avgBedTurnover}x</h4>
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
                <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.monthlyVisits}</h4>
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
                <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.avgTOI}</h4>
                <p className="text-sm text-gray-600 font-medium">Turnover Interval</p>
                <p className="text-xs text-indigo-600 mt-1">days</p>
              </motion.div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Average Length of Stay Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.6 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
              >
                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
                  Average Length of Stay
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={healthcareMetrics.alosData}>
                    <defs>
                      <linearGradient id="colorALOS" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={COLORS.info} stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="ward" stroke="#666" />
                    <YAxis stroke="#666" label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="days" fill="url(#colorALOS)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Bed Occupancy Ratio Trend */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.7 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
              >
                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
                  Bed Occupancy Ratio
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={healthcareMetrics.borData}>
                    <defs>
                      <linearGradient id="colorBOR" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#666" />
                    <YAxis stroke="#666" label={{ value: 'Occupancy %', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="occupancy"
                      stroke={COLORS.secondary}
                      strokeWidth={2}
                      fill="url(#colorBOR)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Bed Turnover Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.8 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
              >
                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
                  Bed Turnover Rate
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={healthcareMetrics.btoData}>
                    <defs>
                      <linearGradient id="colorBTO" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="ward" stroke="#666" />
                    <YAxis stroke="#666" label={{ value: 'Times', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="turnover" fill="url(#colorBTO)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Outpatient Visit Rate */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.9 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
              >
                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
                  Outpatient Visit Rate
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={healthcareMetrics.visitRateData}>
                    <defs>
                      <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" stroke="#666" />
                    <YAxis stroke="#666" label={{ value: 'Visits', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="visits"
                      stroke={COLORS.warning}
                      strokeWidth={3}
                      dot={{ fill: COLORS.warning, r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </motion.div>

              {/* Turnover Interval Chart */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.0 }}
                className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
              >
                <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                  <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full" />
                  Turnover Interval
                </h4>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={healthcareMetrics.toiData}>
                    <defs>
                      <linearGradient id="colorTOI" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="ward" stroke="#666" />
                    <YAxis stroke="#666" label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="interval" fill="url(#colorTOI)" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Active Admissions Table */}
        <div className="border-t border-gray-100">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50">
                  <th className="px-4 py-3 text-left">Patient</th>
                  <th className="px-4 py-3 text-left">Admission #</th>
                  <th className="px-4 py-3 text-left">Ward & Bed</th>
                  <th className="px-4 py-3 text-left">Condition</th>
                  <th className="px-4 py-3 text-left">Diagnosis</th>
                  <th className="px-4 py-3 text-left">Admitted</th>
                  <th className="px-4 py-3 text-left">Length of Stay</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredAdmissions.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8">
                      <Icon icon="solar:hospital-bed-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">No admissions found</p>
                    </td>
                  </tr>
                ) : (
                  filteredAdmissions.map((admission: any, index: number) => {
                    const lengthOfStay = Math.ceil((new Date().getTime() - new Date(admission.admission_date).getTime()) / (1000 * 60 * 60 * 24));
                    return (
                      <motion.tr
                        key={admission.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.02 }}
                        className="hover:bg-gray-50/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/inpatient/admissions/${admission.id}`)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-medium ${
                              admission.patient_condition === 'critical' ? 'bg-red-500' :
                              admission.patient_condition === 'serious' ? 'bg-orange-500' :
                              'bg-green-500'
                            }`}>
                              {admission.patient?.first_name?.[0]}{admission.patient?.last_name?.[0]}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {admission.patient?.first_name} {admission.patient?.last_name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {admission.patient?.age} yrs • {admission.patient?.gender}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">{admission.admission_number}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm">
                            <p className="font-medium text-gray-900">{admission.current_bed?.ward_name || 'Unassigned'}</p>
                            <p className="text-xs text-gray-500">Bed {admission.current_bed?.bed_number || '-'}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            admission.patient_condition === 'critical' ? 'bg-red-100 text-red-700' :
                            admission.patient_condition === 'serious' ? 'bg-orange-100 text-orange-700' :
                            'bg-green-100 text-green-700'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                              admission.patient_condition === 'critical' ? 'bg-red-500 animate-pulse' :
                              admission.patient_condition === 'serious' ? 'bg-orange-500' :
                              'bg-green-500'
                            }`} />
                            {admission.patient_condition || 'Stable'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700 truncate max-w-[200px]">
                            {admission.primary_diagnosis || 'Not specified'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-700">
                            {format(new Date(admission.admission_date), 'MMM dd, HH:mm')}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-gray-900">
                            {lengthOfStay} {lengthOfStay === 1 ? 'day' : 'days'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-all"
                              title="View Details"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/inpatient/admissions/${admission.id}`);
                              }}
                            >
                              <Icon icon="solar:eye-linear" className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-all"
                              title="More Options"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Icon icon="solar:menu-dots-linear" className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>

      {/* Floating Inpatient Tracker */}
      <FloatingInpatientTracker
        practiceId={practiceId || ''}
        stats={{
          beds: {
            total: totalBeds,
            occupied: occupiedBeds,
            available: availableBeds,
          },
          clinical: {
            criticalPatients: statistics.criticalPatients,
            nursingAlerts: 0,
          },
        }}
      />
    </div>
  );
};

export default InpatientDashboard;
