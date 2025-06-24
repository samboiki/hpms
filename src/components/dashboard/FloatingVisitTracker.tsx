import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { useTheme } from '../../stores/themeStore';

interface Visit {
  id: string;
  patient_id: string;
  date: string;
  time: string;
  status: string;
  patient?: {
    first_name: string;
    last_name: string;
    avatar?: string;
  };
  doctor?: {
    first_name: string;
    last_name: string;
  };
}

interface FloatingVisitTrackerProps {
  practiceId: string;
}

const FloatingVisitTracker: React.FC<FloatingVisitTrackerProps> = ({ practiceId }) => {
  const { currentTheme } = useTheme();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Ensure currentTheme is available
  if (!currentTheme || !currentTheme.gradients || !currentTheme.gradients.sidebar) {
    return null; // Return early if theme is not loaded
  }
  
  // Calculate visit statistics like in PremiumAppointmentScheduler with error handling
  const safeVisits = visits || [];
  const totalCount = safeVisits.length;
  const scheduledCount = safeVisits.filter(v => v?.status && ['scheduled', 'confirmed'].includes(v.status)).length;
  const readyCount = safeVisits.filter(v => v?.status === 'ready').length;
  const inProgressCount = safeVisits.filter(v => v?.status === 'in_progress').length;
  const completedCount = safeVisits.filter(v => v?.status === 'completed').length;
  const cancelledCount = safeVisits.filter(v => v?.status === 'cancelled').length;
  const noShowCount = safeVisits.filter(v => v?.status === 'no_show').length;
  
  console.log('📊 FloatingVisitTracker Stats:', {
    total: totalCount,
    scheduled: scheduledCount,
    ready: readyCount,
    inProgress: inProgressCount,
    completed: completedCount,
    cancelled: cancelledCount,
    noShow: noShowCount,
    statuses: safeVisits.map(v => v.status)
  });
  
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const remainingPercentage = totalCount > 0 ? 100 - completionPercentage : 0;

  useEffect(() => {
    fetchTodayVisits();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('appointments-today')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `date=eq.${format(new Date(), 'yyyy-MM-dd')}`
        },
        () => {
          fetchTodayVisits();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [practiceId]);

  const fetchTodayVisits = async () => {
    try {
      setIsLoading(true);
      const todayDate = format(new Date(), 'yyyy-MM-dd');
      
      console.log('🔍 FloatingVisitTracker: Fetching appointments for practice:', practiceId);
      console.log('🔍 FloatingVisitTracker: Today date:', todayDate);
      
      // Get all patients for this practice
      const { data: patients, error: patientsError } = await supabase
        .from('patients')
        .select('id')
        .eq('practice_id', practiceId);

      console.log('🔍 FloatingVisitTracker: Patients found:', patients?.length || 0);
      
      if (patientsError) {
        console.error('❌ FloatingVisitTracker: Error fetching patients:', patientsError);
        setVisits([]);
        return;
      }

      if (!patients || patients.length === 0) {
        console.log('⚠️ FloatingVisitTracker: No patients found for practice');
        setVisits([]);
        return;
      }

      const patientIds = patients.map(p => p.id);
      console.log('🔍 FloatingVisitTracker: Patient IDs:', patientIds.length);
      
      // Get today's appointments (using appointments table)
      const { data: appointmentsData, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patients!appointments_patient_id_fkey(first_name, last_name, avatar)
        `)
        .in('patient_id', patientIds)
        .eq('date', todayDate)
        .order('time', { ascending: true });

      console.log('🔍 FloatingVisitTracker: Raw appointments data:', appointmentsData);
      console.log('🔍 FloatingVisitTracker: Appointments count:', appointmentsData?.length || 0);

      if (error) {
        console.error('❌ FloatingVisitTracker: Error fetching appointments:', error);
        throw error;
      }

      setVisits(appointmentsData || []);
    } catch (error) {
      console.error('❌ FloatingVisitTracker: Error in fetchTodayVisits:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // SVG path for donut chart
  const createPath = (percentage: number, offset: number = 0) => {
    const radius = 40;
    const strokeWidth = 8;
    const normalizedRadius = radius - strokeWidth / 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDasharray = `${(percentage / 100) * circumference} ${circumference}`;
    const transform = `rotate(${-90 + offset * 3.6} 50 50)`;

    return {
      strokeDasharray,
      transform
    };
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'in_progress':
        return '#3B82F6';
      case 'scheduled':
      case 'confirmed':
        return '#F59E0B';
      case 'cancelled':
        return '#EF4444';
      default:
        return '#6B7280';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return 'solar:check-circle-bold-duotone';
      case 'in_progress':
        return 'solar:play-circle-bold-duotone';
      case 'scheduled':
      case 'confirmed':
        return 'solar:clock-circle-bold-duotone';
      case 'cancelled':
        return 'solar:close-circle-bold-duotone';
      default:
        return 'solar:question-circle-bold-duotone';
    }
  };

  return (
    <>
      {/* Floating Button */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        className="fixed bottom-6 right-6 z-40"
      >
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="relative w-20 h-20 bg-white rounded-full shadow-2xl border-2 border-white/50 backdrop-blur-xl overflow-hidden group"
          style={{ 
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Donut Chart */}
          <svg className="absolute inset-0 w-full h-full -rotate-90">
            {/* Background circle */}
            <circle
              cx="50%"
              cy="50%"
              r="36"
              fill="none"
              stroke="#E5E7EB"
              strokeWidth="8"
            />
            
            {/* Completed segment */}
            {completionPercentage > 0 && (
              <circle
                cx="50%"
                cy="50%"
                r="36"
                fill="none"
                stroke="#10B981"
                strokeWidth="8"
                strokeLinecap="round"
                style={{
                  strokeDasharray: createPath(completionPercentage).strokeDasharray,
                  transition: 'stroke-dasharray 0.5s ease'
                }}
              />
            )}
            
            {/* Scheduled segment */}
            {remainingPercentage > 0 && (
              <circle
                cx="50%"
                cy="50%"
                r="36"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="8"
                strokeLinecap="round"
                style={{
                  strokeDasharray: createPath(remainingPercentage).strokeDasharray,
                  strokeDashoffset: -(completionPercentage / 100) * 226.19,
                  transition: 'all 0.5s ease'
                }}
              />
            )}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{totalCount}</p>
              <p className="text-xs text-gray-500 -mt-1">Visits</p>
            </div>
          </div>

          {/* Pulse effect */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 opacity-20 group-hover:opacity-30 transition-opacity animate-pulse" />
        </motion.button>

      </motion.div>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 20 }}
              className="fixed inset-x-4 bottom-20 md:right-6 md:left-auto md:w-[480px] bg-white rounded-2xl shadow-2xl z-50 max-h-[80vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Today's Visits</h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {format(new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-400" />
                  </button>
                </div>

                {/* Premium Visit Status Segments */}
                <div className="mt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Visit Status Overview</h3>
                  <div className="bg-gradient-to-r from-gray-100 to-gray-200 rounded-2xl p-2 shadow-lg">
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { status: 'total', label: 'Total', count: totalCount, icon: 'solar:calendar-minimalistic-bold-duotone' },
                        { status: 'scheduled', label: 'Scheduled', count: scheduledCount, icon: 'solar:clock-circle-bold-duotone' },
                        { status: 'ready', label: 'Ready', count: readyCount, icon: 'solar:check-circle-bold-duotone' },
                        { status: 'in_progress', label: 'In Progress', count: inProgressCount, icon: 'solar:play-circle-bold-duotone' },
                        { status: 'completed', label: 'Completed', count: completedCount, icon: 'solar:verified-check-bold-duotone' },
                        { status: 'cancelled', label: 'Cancelled', count: cancelledCount, icon: 'solar:close-circle-bold-duotone' }
                      ].map((segment) => (
                        <motion.div
                          key={segment.status}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 }}
                          className="bg-white/80 backdrop-blur-sm rounded-xl p-4 border border-white/50 hover:bg-white/90 transition-all duration-200 group cursor-pointer shadow-sm hover:shadow-md"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-lg bg-gradient-to-br ${currentTheme?.gradients?.sidebar || 'from-cyan-500 to-blue-600'} shadow-sm group-hover:scale-110 transition-transform duration-200`}>
                                <Icon icon={segment.icon} className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-700 group-hover:text-gray-900 transition-colors">{segment.label}</p>
                                <p className="text-xs text-gray-500">visits</p>
                              </div>
                            </div>
                            <div className={`px-3 py-1 rounded-full bg-gradient-to-r ${currentTheme?.gradients?.sidebar || 'from-cyan-500 to-blue-600'} shadow-sm`}>
                              <span className="text-lg font-bold text-white">{segment.count}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Premium Progress Section */}
                  <div className={`mt-6 p-6 bg-gradient-to-br ${currentTheme?.gradients?.sidebar || 'from-cyan-500 to-blue-600'} rounded-2xl border border-white/20 backdrop-blur-xl shadow-xl`}>
                    <div className="text-center mb-4">
                      <h4 className="text-lg font-bold text-white mb-2">Daily Progress</h4>
                      <div className="text-4xl font-bold text-white mb-1">{completionPercentage}%</div>
                      <p className="text-sm text-white/80">Completion Rate</p>
                    </div>
                    
                    <div className="h-4 bg-white/20 rounded-full overflow-hidden backdrop-blur-sm border border-white/30">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${completionPercentage}%` }}
                        transition={{ duration: 1.2, ease: "easeOut" }}
                        className="h-full bg-gradient-to-r from-emerald-400 via-green-400 to-teal-400 rounded-full shadow-lg"
                      />
                    </div>
                    
                    <div className="flex justify-between text-xs text-white/80 mt-2">
                      <span>{completedCount} completed</span>
                      <span>{totalCount - completedCount} remaining</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* Visits List */}
              <div className="overflow-y-auto max-h-[400px] p-6 space-y-3">
                {isLoading ? (
                  <div className="text-center py-8">
                    <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                    <p className="text-sm text-gray-500 mt-2">Loading visits...</p>
                  </div>
                ) : safeVisits.length === 0 ? (
                  <div className="text-center py-8">
                    <Icon icon="solar:calendar-minimalistic-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto" />
                    <p className="text-sm text-gray-500 mt-2">No visits scheduled for today</p>
                  </div>
                ) : (
                  safeVisits.map((visit) => (
                    <motion.div
                      key={visit.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors"
                    >
                      {/* Time */}
                      <div className="text-center min-w-[60px]">
                        <p className="text-lg font-semibold text-gray-800">
                          {visit.time ? format(new Date(`2000-01-01T${visit.time}`), 'HH:mm') : '--:--'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {visit.time ? format(new Date(`2000-01-01T${visit.time}`), 'a') : ''}
                        </p>
                      </div>

                      {/* Patient Info */}
                      <div className="flex-1">
                        <p className="font-semibold text-gray-800">
                          {visit.patient?.first_name} {visit.patient?.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          Dr. {visit.doctor?.first_name || 'Unassigned'}
                        </p>
                      </div>

                      {/* Status */}
                      <div className="flex items-center gap-2">
                        <Icon 
                          icon={getStatusIcon(visit.status)} 
                          className="w-5 h-5"
                          style={{ color: getStatusColor(visit.status) }}
                        />
                        <span 
                          className="text-sm font-medium capitalize"
                          style={{ color: getStatusColor(visit.status) }}
                        >
                          {visit.status.replace('_', ' ')}
                        </span>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingVisitTracker;