import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { useVisitsStore } from '../../stores/visitsStore';

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
  const [isOpen, setIsOpen] = useState(false);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use visits store instead of appointments
  const { visits, loading, fetchTodayVisits } = useVisitsStore();
  
  // Fetch today's visits when component mounts or practiceId changes
  useEffect(() => {
    if (practiceId) {
      fetchTodayVisits(practiceId);
    }
  }, [practiceId, fetchTodayVisits]);

  // Handle scroll shadows
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowTopShadow(scrollTop > 0);
      setShowBottomShadow(scrollTop < scrollHeight - clientHeight - 10);
    }
  };
  
  // Ensure currentTheme is available
  if (!currentTheme || !currentTheme.gradients || !currentTheme.gradients.sidebar) {
    return null; // Return early if theme is not loaded
  }
  
  // Calculate visit statistics using the enhanced visits structure
  const safeVisits = visits || [];
  const totalCount = safeVisits.length;
  const scheduledCount = safeVisits.filter(v => v?.is_confirmed && !v?.is_cancelled).length;
  const readyCount = safeVisits.filter(v => v?.is_ready && !v?.is_cancelled).length;
  const inProgressCount = safeVisits.filter(v => v?.status === 'in-progress' && !v?.is_cancelled).length;
  const completedCount = safeVisits.filter(v => v?.status === 'completed').length;
  const cancelledCount = safeVisits.filter(v => v?.status === 'cancelled').length;
  const noShowCount = safeVisits.filter(v => v?.status === 'no_show').length;
  
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const remainingPercentage = totalCount > 0 ? 100 - completionPercentage : 0;

  // The data is now fetched via the useTodayAppointments hook

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
              className="fixed inset-x-4 bottom-20 md:right-6 md:left-auto md:w-[580px] bg-white rounded-2xl shadow-2xl z-50 max-h-[85vh] overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between mb-4">
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
                
                {/* Full Width Progress Bar */}
                <div className="w-full">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-gray-700">Daily Progress</span>
                      <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                        {completedCount} of {totalCount} visits completed
                      </span>
                    </div>
                    <span className="text-lg font-bold text-gray-800">{completionPercentage}%</span>
                  </div>
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${completionPercentage}%` }}
                      transition={{ duration: 1.2, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full shadow-sm"
                    />
                  </div>
                </div>

                {/* In Progress Section - Always Visible */}
                {inProgressCount > 0 && (
                  <div className="mt-4 p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5 text-orange-600" />
                      <h3 className="font-semibold text-orange-700">Currently In Progress</h3>
                      <span className="ml-auto text-sm font-medium text-orange-600 bg-white px-2 py-0.5 rounded-full">
                        {inProgressCount} {inProgressCount === 1 ? 'visit' : 'visits'}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {safeVisits.filter(v => v?.status === 'in-progress' && !v?.is_cancelled).map((visit) => (
                        <div
                          key={visit.id}
                          className="flex items-center gap-3 p-2 bg-white/80 backdrop-blur rounded-lg border border-orange-100"
                        >
                          <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-full">
                            <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-orange-600" />
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 text-sm">
                              {visit.patient?.first_name} {visit.patient?.last_name}
                            </p>
                            <p className="text-xs text-gray-500">
                              Dr. {visit.doctor?.full_name || 'Unassigned'} • Started {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : '--:--'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                            <span className="text-xs font-medium text-orange-600">Active</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Visits Grouped by Status */}
              <div className="relative">
                {/* Scroll Shadow Indicators */}
                <div className={`absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white via-white/95 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showTopShadow ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className={`absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white via-white/95 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${showBottomShadow ? 'opacity-100' : 'opacity-0'}`}></div>
                
                {/* Scrollable Content */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="overflow-y-auto max-h-[600px] p-6 space-y-6 scroll-smooth 
                    scrollbar-thin scrollbar-track-transparent scrollbar-thumb-gray-300/50 
                    hover:scrollbar-thumb-gray-400/70 scrollbar-thumb-rounded-full 
                    scrollbar-track-rounded-full"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollBehavior: 'smooth'
                  }}
                >
                {loading ? (
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
                  // Group visits by status and render each category
                  (() => {
                    const statusCategories = [
                      { 
                        key: 'scheduled', 
                        label: 'Scheduled', 
                        icon: 'solar:clock-circle-bold-duotone',
                        color: 'text-blue-600',
                        bgColor: 'bg-blue-50',
                        borderColor: 'border-blue-200',
                        visits: safeVisits.filter(v => v?.is_confirmed && !v?.is_cancelled && v?.status !== 'in-progress' && v?.status !== 'completed' && !v?.is_ready)
                      },
                      { 
                        key: 'ready', 
                        label: 'Ready', 
                        icon: 'solar:check-circle-bold-duotone',
                        color: 'text-emerald-600',
                        bgColor: 'bg-emerald-50',
                        borderColor: 'border-emerald-200',
                        visits: safeVisits.filter(v => v?.is_ready && !v?.is_cancelled)
                      },
                      { 
                        key: 'completed', 
                        label: 'Completed', 
                        icon: 'solar:verified-check-bold-duotone',
                        color: 'text-green-600',
                        bgColor: 'bg-green-50',
                        borderColor: 'border-green-200',
                        visits: safeVisits.filter(v => v?.status === 'completed')
                      },
                      { 
                        key: 'cancelled', 
                        label: 'Cancelled', 
                        icon: 'solar:close-circle-bold-duotone',
                        color: 'text-red-600',
                        bgColor: 'bg-red-50',
                        borderColor: 'border-red-200',
                        visits: safeVisits.filter(v => v?.status === 'cancelled')
                      }
                    ];

                    return statusCategories.map((category) => {
                      if (category.visits.length === 0) return null;

                      return (
                        <motion.div
                          key={category.key}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-3"
                        >
                          {/* Status Header */}
                          <div className={`flex items-center gap-3 p-3 rounded-lg ${category.bgColor} ${category.borderColor} border`}>
                            <Icon icon={category.icon} className={`w-5 h-5 ${category.color}`} />
                            <h3 className={`font-semibold ${category.color}`}>
                              {category.label}
                            </h3>
                            <span className={`ml-auto text-sm font-medium ${category.color} bg-white px-2 py-1 rounded-full`}>
                              {category.visits.length}
                            </span>
                          </div>

                          {/* Patients in this status */}
                          <div className="space-y-2 ml-8">
                            {category.visits.map((visit, index) => (
                              <motion.div
                                key={visit.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm transition-all cursor-pointer"
                              >
                                {/* Time */}
                                <div className="text-center min-w-[50px]">
                                  <p className="text-sm font-semibold text-gray-800">
                                    {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : 
                                     visit.visit_time ? format(new Date(`2000-01-01T${visit.visit_time}`), 'HH:mm') : '--:--'}
                                  </p>
                                </div>

                                {/* Patient Info */}
                                <div className="flex-1">
                                  <p className="font-medium text-gray-800">
                                    {visit.patient?.first_name} {visit.patient?.last_name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {visit.visit_type || 'Consultation'} • Dr. {visit.doctor?.full_name || 'Unassigned'}
                                  </p>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <button className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
                                    <Icon icon="solar:eye-bold-duotone" className="w-4 h-4 text-gray-400" />
                                  </button>
                                </div>
                              </motion.div>
                            ))}
                          </div>
                        </motion.div>
                      );
                    });
                  })()
                )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingVisitTracker;