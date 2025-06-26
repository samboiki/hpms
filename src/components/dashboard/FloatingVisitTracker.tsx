import React, { useState, useEffect, useRef } from 'react';
// Removed framer-motion for stable, premium experience
import { Icon } from '@iconify/react';
import { format, isSameDay } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { useVisitsStore } from '../../stores/visitsStore';
import { useNavigate } from 'react-router-dom';
import ComprehensivePatientModal from '../patients/ComprehensivePatientModal';
import FullScreenEditVisitModal from '../visits/FullScreenEditVisitModal';
import VisitActionModal from '../modals/VisitActionModal';
import EnhancedSmsModal from '../messages/EnhancedSmsModal';
import { Settings, MessageCircle } from 'lucide-react';

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
  selectedDate?: Date;
}

const FloatingVisitTracker: React.FC<FloatingVisitTrackerProps> = ({ practiceId, selectedDate }) => {
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [selectedVisitForEdit, setSelectedVisitForEdit] = useState<Visit | null>(null);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Use visits store instead of appointments
  const { visits, loading, fetchTodayVisits, fetchVisits, startVisit } = useVisitsStore();
  
  // Fetch visits for selected date when component mounts or date/practiceId changes
  useEffect(() => {
    if (practiceId) {
      if (selectedDate) {
        // Fetch visits for the selected date
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        fetchVisits({ 
          date: formattedDate, 
          practiceId 
        });
      } else {
        // Fallback to today's visits if no date selected
        fetchTodayVisits(practiceId);
      }
    }
  }, [practiceId, selectedDate, fetchVisits, fetchTodayVisits]);

  // Handle scroll shadows
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowTopShadow(scrollTop > 10);
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
  const inProgressCount = safeVisits.filter(v => v?.status === 'in-progress' && !v?.is_cancelled && !v?.is_handoff).length;
  const handedOffCount = safeVisits.filter(v => v?.is_handoff && v?.status !== 'completed').length;
  const completedCount = safeVisits.filter(v => v?.status === 'completed').length;
  const cancelledCount = safeVisits.filter(v => v?.is_cancelled || v?.status === 'cancelled').length;
  const noShowCount = safeVisits.filter(v => v?.status === 'no_show').length;
  
  // Calculate percentage: completed vs all other statuses (excluding cancelled)
  const nonCancelledVisits = safeVisits.filter(v => !v?.is_cancelled && v?.status !== 'cancelled');
  const nonCancelledCount = nonCancelledVisits.length;
  const completionPercentage = nonCancelledCount > 0 ? Math.round((completedCount / nonCancelledCount) * 100) : 0;
  const remainingPercentage = nonCancelledCount > 0 ? 100 - completionPercentage : 0;

  // The data is now fetched via the useTodayAppointments hook

  // SVG path for donut chart
  const createPath = (percentage: number) => {
    const radius = 36; // Match the actual circle radius
    const circumference = radius * 2 * Math.PI;
    const strokeLength = (percentage / 100) * circumference;
    const strokeDasharray = `${strokeLength} ${circumference}`;
    
    return {
      strokeDasharray,
      strokeDashoffset: 0
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

  const handlePatientClick = (patientId: string) => {
    setSelectedPatientId(patientId);
    setIsPatientModalOpen(true);
  };

  const handleStartVisit = async (visit: any) => {
    try {
      // Update visit status to in-progress
      await startVisit(visit.id);
      
      // Open the edit visit modal
      setSelectedVisitForEdit(visit);
      setIsEditVisitModalOpen(true);
    } catch (error) {
      console.error('Error starting visit:', error);
    }
  };

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-6 right-6 z-40 float-animation">
        <button
          onClick={() => setIsOpen(true)}
          className="relative w-20 h-20 bg-white rounded-full shadow-2xl border-2 border-white/50 backdrop-blur-xl overflow-hidden group hover:shadow-3xl"
          style={{ 
            background: 'rgba(255, 255, 255, 0.9)',
            backdropFilter: 'blur(20px)'
          }}
        >
          {/* Donut Chart */}
          <svg className="absolute inset-0 w-full h-full">
            {/* Full background circle in light grey */}
            <circle
              cx="50%"
              cy="50%"
              r="36"
              fill="none"
              stroke="#D1D5DB"
              strokeWidth="8"
              style={{
                transformOrigin: '50% 50%',
                transform: 'rotate(-90deg)'
              }}
            />
            
            {/* Completed segment - darker grey, overlays on top */}
            {completionPercentage > 0 && (
              <circle
                cx="50%"
                cy="50%"
                r="36"
                fill="none"
                stroke="#6B7280"
                strokeWidth="8"
                strokeLinecap="round"
                style={{
                  strokeDasharray: createPath(completionPercentage).strokeDasharray,
                  strokeDashoffset: createPath(completionPercentage).strokeDashoffset,
                  transition: 'none',
                  transformOrigin: '50% 50%',
                  transform: 'rotate(-90deg)'
                }}
              />
            )}
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-800">{nonCancelledCount}</p>
              <p className="text-xs text-gray-500 -mt-1">Visits</p>
            </div>
          </div>

        </button>

      </div>

      {/* Modal */}
      {isOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 transition-opacity duration-200"
            />

            {/* Modal Content */}
            <div
              className="fixed inset-x-4 bottom-20 md:right-6 md:left-auto md:w-[580px] bg-white rounded-2xl shadow-2xl z-50 max-h-[85vh] h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Fixed Header */}
              <div className="flex-shrink-0 p-6 border-b border-gray-100 bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">
                      {selectedDate && !isSameDay(selectedDate, new Date()) ? 'Visits' : "Today's Visits"}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      {format(selectedDate || new Date(), 'EEEE, MMMM d, yyyy')}
                    </p>
                  </div>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 hover:bg-gray-100 rounded-xl"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Single Scrollable Content Area */}
              <div className="relative flex-1 overflow-hidden">
                {/* Scroll Shadow Indicators */}
                <div className={`absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-white via-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-200 ${showTopShadow ? 'opacity-100' : 'opacity-0'}`}></div>
                <div className={`absolute bottom-0 left-0 right-0 h-6 bg-gradient-to-t from-white via-white/90 to-transparent z-10 pointer-events-none transition-opacity duration-200 ${showBottomShadow ? 'opacity-100' : 'opacity-0'}`}></div>
                
                {/* High-performance Scrollable Container */}
                <div 
                  ref={scrollContainerRef}
                  onScroll={handleScroll}
                  className="overflow-y-auto h-full scroll-smooth overscroll-contain"
                  style={{
                    scrollbarWidth: 'thin',
                    scrollbarGutter: 'stable',
                    WebkitOverflowScrolling: 'touch',
                    scrollBehavior: 'smooth',
                    willChange: 'scroll-position'
                  }}
                >
                  <div className="p-6 space-y-6">
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
                        <div
                          style={{ width: `${completionPercentage}%` }}
                          className="h-full bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-full shadow-sm"
                        />
                      </div>
                    </div>

                    {/* Called/Ready Section */}
                    {readyCount > 0 && (
                      <div className="p-3 bg-gradient-to-r from-emerald-50 to-green-50 rounded-lg border border-emerald-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon icon="solar:notification-bold-duotone" className="w-5 h-5 text-emerald-600 animate-pulse" />
                          <h3 className="font-semibold text-emerald-700">Called & Ready</h3>
                          <span className="ml-auto text-sm font-medium text-emerald-600 bg-white px-2 py-0.5 rounded-full">
                            {readyCount} {readyCount === 1 ? 'patient' : 'patients'} waiting
                          </span>
                        </div>
                        <div className="space-y-2">
                          {safeVisits.filter(v => v?.is_ready && !v?.is_cancelled && v?.status !== 'in-progress').map((visit, index) => (
                            <div
                              key={visit.id}
                              className="relative flex items-center gap-3 p-2 pl-12 bg-white/80 backdrop-blur rounded-lg border border-emerald-200 cursor-pointer hover:bg-white"
                              onClick={() => handlePatientClick(visit.patient_id)}
                            >
                              {/* Ready Number Badge */}
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {index + 1}
                              </div>
                              
                              <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full">
                                <Icon icon="solar:bell-bing-bold-duotone" className="w-5 h-5 text-emerald-600" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-800 text-sm">
                                  {visit.patient?.first_name} {visit.patient?.last_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  Dr. {visit.doctor?.full_name || 'Unassigned'} • Ready since {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : '--:--'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Icon icon="solar:hand-shake-bold-duotone" className="w-4 h-4 text-emerald-600" />
                                <span className="text-xs font-medium text-emerald-600">Waiting</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* In Progress Section */}
                    {inProgressCount > 0 && (
                      <div className="p-3 bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg border border-orange-200">
                        <div className="flex items-center gap-2 mb-2">
                          <Icon icon="solar:play-circle-bold-duotone" className="w-5 h-5 text-orange-600" />
                          <h3 className="font-semibold text-orange-700">Currently In Progress</h3>
                          <span className="ml-auto text-sm font-medium text-orange-600 bg-white px-2 py-0.5 rounded-full">
                            {inProgressCount} {inProgressCount === 1 ? 'visit' : 'visits'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {safeVisits.filter(v => v?.status === 'in-progress' && !v?.is_cancelled && !v?.is_handoff).map((visit, index) => (
                            <div
                              key={visit.id}
                              className="relative flex items-center gap-3 p-2 pl-12 bg-white/80 backdrop-blur rounded-lg border border-orange-100 cursor-pointer hover:bg-white"
                              onClick={() => handlePatientClick(visit.patient_id)}
                            >
                              {/* Progress Number Badge */}
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {index + 1}
                              </div>
                              
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
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const { handoffVisit } = useVisitsStore.getState();
                                    handoffVisit(visit.id);
                                  }}
                                  className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-md"
                                >
                                  Handoff
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const { completeVisit } = useVisitsStore.getState();
                                    completeVisit(visit.id);
                                  }}
                                  className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md"
                                >
                                  Complete
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Visits Grouped by Status */}
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
                            visits: safeVisits.filter(v => 
                              v?.is_confirmed && 
                              !v?.is_cancelled && 
                              v?.status !== 'in-progress' && 
                              v?.status !== 'completed' && 
                              !v?.is_ready
                            ).sort((a, b) => {
                              // First sort by checked-in status (checked-in first)
                              if (a.is_checked_in && !b.is_checked_in) return -1;
                              if (!a.is_checked_in && b.is_checked_in) return 1;
                              
                              // Then sort by time
                              const timeA = a.scheduled_time || a.visit_time || '00:00';
                              const timeB = b.scheduled_time || b.visit_time || '00:00';
                              return timeA.localeCompare(timeB);
                            })
                          },
                          { 
                            key: 'completed', 
                            label: 'Completed', 
                            icon: 'solar:verified-check-bold-duotone',
                            color: 'text-green-600',
                            bgColor: 'bg-green-50',
                            borderColor: 'border-green-200',
                            visits: safeVisits.filter(v => v?.status === 'completed')
                              .sort((a, b) => {
                                const timeA = a.scheduled_time || a.visit_time || '00:00';
                                const timeB = b.scheduled_time || b.visit_time || '00:00';
                                return timeA.localeCompare(timeB);
                              })
                          },
                          { 
                            key: 'handedoff', 
                            label: 'Handed Off', 
                            icon: 'solar:hand-shake-bold-duotone',
                            color: 'text-purple-600',
                            bgColor: 'bg-purple-50',
                            borderColor: 'border-purple-200',
                            visits: safeVisits.filter(v => v?.is_handoff && v?.status !== 'completed')
                              .sort((a, b) => {
                                const timeA = a.scheduled_time || a.visit_time || '00:00';
                                const timeB = b.scheduled_time || b.visit_time || '00:00';
                                return timeA.localeCompare(timeB);
                              })
                          },
                          { 
                            key: 'cancelled', 
                            label: 'Cancelled', 
                            icon: 'solar:close-circle-bold-duotone',
                            color: 'text-red-600',
                            bgColor: 'bg-red-50',
                            borderColor: 'border-red-200',
                            visits: safeVisits.filter(v => v?.is_cancelled || v?.status === 'cancelled')
                              .sort((a, b) => {
                                const timeA = a.scheduled_time || a.visit_time || '00:00';
                                const timeB = b.scheduled_time || b.visit_time || '00:00';
                                return timeA.localeCompare(timeB);
                              })
                          }
                        ];

                        let cardCounter = 0;
                        return statusCategories.map((category) => {
                          if (category.visits.length === 0) return null;

                          const categoryStartNumber = cardCounter;
                          
                          return (
                            <div
                              key={category.key}
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
                              <div className="space-y-2 ml-4">
                                {category.visits.map((visit, index) => {
                                  cardCounter++;
                                  const cardNumber = categoryStartNumber + index + 1;
                                  
                                  return (
                                  <div
                                    key={visit.id}
                                    className="relative flex items-center gap-3 p-3 pl-12 bg-white rounded-lg border border-gray-100 hover:border-gray-200 hover:shadow-sm cursor-pointer group"
                                    onClick={() => handlePatientClick(visit.patient_id)}
                                  >
                                    {/* Card Number Badge - Colored based on status */}
                                    <div className={`absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shadow-md ${
                                      category.key === 'scheduled' && visit.is_checked_in
                                        ? 'bg-[#01b8d8] text-white'
                                        : category.key === 'scheduled'
                                        ? 'bg-[#489bfd] text-white'
                                        : category.key === 'completed'
                                        ? 'bg-green-500 text-white'
                                        : category.key === 'handedoff'
                                        ? 'bg-purple-500 text-white'
                                        : category.key === 'cancelled'
                                        ? 'bg-red-500 text-white'
                                        : 'bg-white text-gray-700 border border-gray-200'
                                    }`}>
                                      {cardNumber}
                                    </div>
                                    
                                    {/* Time */}
                                    <div className="text-center min-w-[50px]">
                                      <p className="text-sm font-semibold text-gray-800">
                                        {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : 
                                         visit.visit_time ? format(new Date(`2000-01-01T${visit.visit_time}`), 'HH:mm') : '--:--'}
                                      </p>
                                    </div>

                                    {/* Patient Info */}
                                    <div className="flex-1">
                                      <p className="font-medium text-gray-800 group-hover:text-brand-primary">
                                        {visit.patient?.first_name} {visit.patient?.last_name}
                                      </p>
                                      <p className="text-xs text-gray-500">
                                        {visit.visit_type || 'Consultation'} • Dr. {visit.doctor?.full_name || 'Unassigned'}
                                      </p>
                                    </div>

                                    {/* Status Indicator and Actions */}
                                    <div className="flex items-center gap-2">
                                      {category.key === 'scheduled' && visit.is_checked_in && (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              e.preventDefault();
                                              handleStartVisit(visit);
                                            }}
                                            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-md"
                                          >
                                            Start Visit
                                          </button>
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                            <span className="text-xs font-medium text-emerald-600">Checked In</span>
                                          </div>
                                        </>
                                      )}
                                      {category.key === 'scheduled' && !visit.is_checked_in && (
                                        <>
                                          <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                          <span className="text-xs font-medium text-blue-600">Scheduled</span>
                                        </>
                                      )}
                                      {category.key === 'completed' && (
                                        <>
                                          <div className="w-2 h-2 bg-green-500 rounded-full" />
                                          <span className="text-xs font-medium text-green-600">Completed</span>
                                        </>
                                      )}
                                      {category.key === 'cancelled' && (
                                        <>
                                          <div className="w-2 h-2 bg-red-500 rounded-full" />
                                          <span className="text-xs font-medium text-red-600">Cancelled</span>
                                        </>
                                      )}
                                      {category.key === 'handedoff' && (
                                        <>
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              const { completeVisit } = useVisitsStore.getState();
                                              completeVisit(visit.id);
                                            }}
                                            className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-medium rounded-md"
                                          >
                                            Complete
                                          </button>
                                          <div className="flex items-center gap-1">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full" />
                                            <span className="text-xs font-medium text-purple-600">Handed Off</span>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        });
                      })()
                    )}
                  </div>
                </div>
              </div>
            </div>
          </>
      )}

      {/* Patient Modal */}
      {selectedPatientId && (
        <ComprehensivePatientModal
          isOpen={isPatientModalOpen}
          onClose={() => {
            setIsPatientModalOpen(false);
            setSelectedPatientId(null);
          }}
          patientId={selectedPatientId}
        />
      )}

      {/* Edit Visit Modal */}
      {selectedVisitForEdit && (
        <FullScreenEditVisitModal
          isOpen={isEditVisitModalOpen}
          onClose={() => {
            setIsEditVisitModalOpen(false);
            setSelectedVisitForEdit(null);
          }}
          visitId={selectedVisitForEdit.id}
          patientId={selectedVisitForEdit.patient_id}
          onSuccess={() => {
            setIsEditVisitModalOpen(false);
            setSelectedVisitForEdit(null);
            // Refresh visits after editing
            if (practiceId) {
              if (selectedDate) {
                const formattedDate = format(selectedDate, 'yyyy-MM-dd');
                fetchVisits({ 
                  date: formattedDate, 
                  practiceId 
                });
              } else {
                fetchTodayVisits(practiceId);
              }
            }
          }}
        />
      )}
    </>
  );
};

export default FloatingVisitTracker;