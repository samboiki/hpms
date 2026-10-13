import React, { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
// Removed framer-motion for stable, premium experience
import { format, isSameDay } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { useVisitsStore } from '../../stores/visitsStore';
import { useNavigate } from 'react-router-dom';
import VisitActionModal from '../modals/VisitActionModal';
import EnhancedSmsModal from '../messages/EnhancedSmsModal';
import { 
  Settings, 
  MessageCircle, 
  CheckCircle, 
  PlayCircle, 
  Clock, 
  XCircle, 
  X, 
  Stethoscope, 
  Bell, 
  HandshakeIcon,
  Calendar,
  RefreshCcw,
  User
} from 'lucide-react';
import { NotificationsList } from '../messages/InternalMessaging/NotificationsList';
import { useMessagingStore } from '../../stores/messagingStore';
import { useAuthStore } from '../../stores/authStore';
import { cn } from '../../utils/cn';
import { unreadMessagesService } from '../../services/unreadMessagesService';
import { NotificationBadge } from '../ui/NotificationBadge';
import { HandoffCardPrintButtons } from './HandoffCardPrintButtons';
import { toast } from 'react-hot-toast';
import { formatDoctorName } from '../../utils/formatDoctorName';
import { lazyWindow } from '../layout/lazyScreen';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { PatientAvatar } from '../patients/photo/PatientAvatar';

// The tracker is on the Dashboard, so the patient file and the visit screen it can open load when first opened
// instead of with the first screen (and say so if they cannot load: lazyScreen.tsx)
const ComprehensivePatientModal = lazyWindow(() => import('../patients/ComprehensivePatientModal'));
const FullScreenEditVisitModal = lazyWindow(() => import('../visits/FullScreenEditVisitModal'));

interface Visit {
  id: string;
  patient_id: string;
  practice_id?: string;
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
  disablePatientModal?: boolean;
  zIndex?: number;
  onOpenPatientModal?: (patientId: string, defaultTab?: 'overview' | 'encounters') => void;
}

/** Donut showing the share of the day's visits that are completed */
const ProgressRing: React.FC<{ size: number; stroke: number; percentage: number; trackClassName: string; barClassName: string }> = ({
  size,
  stroke,
  percentage,
  trackClassName,
  barClassName
}) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" strokeWidth={stroke} className={trackClassName} />
      {percentage > 0 && (
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(percentage / 100) * circumference} ${circumference}`}
          className={barClassName}
        />
      )}
    </svg>
  );
};

const FloatingVisitTracker: React.FC<FloatingVisitTrackerProps> = ({ practiceId, selectedDate, disablePatientModal = false, zIndex: zIndexProp, onOpenPatientModal }) => {
  const zIndex = zIndexProp ?? 50;
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  // Escape closes the visit tracker panel, as its X does
  useEscapeToClose(isOpen, () => setIsOpen(false));
  const [activeTab, setActiveTab] = useState<'visits' | 'messages'>('visits');
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(true);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [selectedVisitForEdit, setSelectedVisitForEdit] = useState<Visit | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [defaultDetailTab, setDefaultDetailTab] = useState<'overview' | 'encounters'>('overview');

  // Subscribe to unread messages
  useEffect(() => {
    if (user?.id && practiceId) {
      const unsubscribe = unreadMessagesService.subscribe(setUnreadCount);
      return () => unsubscribe();
    }
  }, [user?.id, practiceId]);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Messaging store
  const { unreadNotificationCount } = useMessagingStore();
  
  // Use visits store instead of appointments
  const { visits, loading, startVisit, checkInPatient } = useVisitsStore();
  
  // Get stable references to avoid re-renders
  const fetchTodayVisits = useVisitsStore(state => state.fetchTodayVisits);
  const fetchVisits = useVisitsStore(state => state.fetchVisits);
  
  // Memoize the formatted date to prevent unnecessary re-renders
  const formattedDate = useMemo(() => {
    return selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null;
  }, [selectedDate]);
  
  // Stable fetch function
  const loadVisits = useCallback(async () => {
    if (!practiceId) return;
    
    try {
      if (formattedDate) {
        await fetchVisits({ 
          date: formattedDate, 
          practiceId 
        });
      } else {
        await fetchTodayVisits(practiceId);
      }
    } catch (error) {
      console.error('Error loading visits:', error);
    }
  }, [practiceId, formattedDate, fetchVisits, fetchTodayVisits]);
  
  // Fetch visits for selected date when component mounts or dependencies change
  useEffect(() => {
    loadVisits();
  }, [loadVisits]);

  // Handle scroll shadows
  const handleScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      setShowTopShadow(scrollTop > 10);
      setShowBottomShadow(scrollTop < scrollHeight - clientHeight - 10);
    }
  };
  
  // Remove the early return that was preventing rendering when theme wasn't fully loaded
  // The component uses mostly hardcoded gradients anyway
  
  // Calculate visit statistics using the enhanced visits structure
  const safeVisits = visits || [];
  const scheduledCount = safeVisits.filter(v => v?.is_confirmed && !v?.is_cancelled).length;
  const readyCount = safeVisits.filter(v => v?.is_ready && !v?.is_cancelled).length;
  const inProgressCount = safeVisits.filter(v => v?.status === 'in-progress' && !v?.is_cancelled && !v?.is_handoff).length;
  const handedOffCount = safeVisits.filter(v => v?.is_handoff && v?.status !== 'completed').length;
  const completedCount = safeVisits.filter(v => v?.status === 'completed').length;
  const cancelledCount = safeVisits.filter(v => v?.is_cancelled || v?.status === 'cancelled').length;
  // The store writes 'no-show' (hyphen); counting 'no_show' always gave 0
  const noShowCount = safeVisits.filter(v => v?.status === 'no-show' || v?.status === 'no_show').length;
  
  // Calculate percentage: completed vs all other statuses (excluding cancelled)
  const nonCancelledVisits = safeVisits.filter(v => !v?.is_cancelled && v?.status !== 'cancelled');
  const nonCancelledCount = nonCancelledVisits.length;
  const completionPercentage = nonCancelledCount > 0 ? Math.round((completedCount / nonCancelledCount) * 100) : 0;
  const remainingPercentage = nonCancelledCount > 0 ? 100 - completionPercentage : 0;

  // The data is now fetched via the useTodayAppointments hook

  // The tracker floats in the bottom-right corner on every page (the owner's choice, 2026-10-09). Above a
  // full-screen window (callers pass a z-index) it sits higher, clear of that window's Save and Complete buttons.
  const isOverWindow = zIndexProp !== undefined;

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
        return CheckCircle;
      case 'in_progress':
        return PlayCircle;
      case 'scheduled':
      case 'confirmed':
        return Clock;
      case 'cancelled':
        return XCircle;
      default:
        return Clock;
    }
  };

  const handlePatientClick = useCallback((patientId: string, openOnEncountersTab: boolean = false) => {
    console.log('🔍 [FloatingVisitTracker] handlePatientClick called:', {
      patientId,
      openOnEncountersTab,
      disablePatientModal,
      hasCallback: !!onOpenPatientModal
    });
    
    if (!patientId) {
      console.log('❌ [FloatingVisitTracker] No patientId provided');
      return;
    }
    
    // If we have a callback from parent (Dashboard), use it
    if (onOpenPatientModal) {
      console.log('✅ [FloatingVisitTracker] Using parent callback to open modal');
      onOpenPatientModal(patientId, openOnEncountersTab ? 'encounters' : 'overview');
      return;
    }
    
    // Otherwise, use local modal (if not disabled)
    if (!disablePatientModal) {
      console.log('✅ [FloatingVisitTracker] Opening local modal');
      setSelectedPatientId(patientId);
      setDefaultDetailTab(openOnEncountersTab ? 'encounters' : 'overview');
      setIsPatientModalOpen(true);
    } else {
      console.log('❌ [FloatingVisitTracker] Modal disabled and no callback provided');
    }
  }, [disablePatientModal, onOpenPatientModal]);
  // A row opens the patient when the page gives a way to (the Dashboard opens the patient file) or the tracker's own
  // window is allowed; the Dashboard turns its own window off, which left every row there doing nothing
  const canOpenPatient = !!onOpenPatientModal || !disablePatientModal;

  const handleStartVisit = useCallback(async (visit: any) => {
    // Update visit status to in-progress first
    if (visit && visit.id) {
      try {
        await startVisit(visit.id);
        // Then open edit visit modal
        setSelectedVisitForEdit(visit);
        setIsEditVisitModalOpen(true);
      } catch (error) {
        console.error('Error starting visit:', error);
        toast.error('Could not start the visit. Please try again.');
      }
    }
  }, [startVisit]);

  // Tracker buttons report back like the same actions in the scheduler (they used to fail silently)
  const runVisitAction = async (action: () => Promise<void>, success: string, failure: string) => {
    try {
      await action();
      toast.success(success);
    } catch (error) {
      console.error(failure, error);
      toast.error(failure);
    }
  };

  const visitWord = nonCancelledCount === 1 ? 'visit' : 'visits';
  const openLabel = `Open the visit tracker: ${nonCancelledCount} ${visitWord}, ${completedCount} completed${
    unreadCount > 0 ? `, ${unreadCount} unread messages` : ''
  }`;
  const unreadBadge = unreadCount > 0 && (
    <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1 text-[11px] font-bold leading-none text-white tabular-nums ring-2 ring-white">
      {unreadCount > 99 ? '99+' : unreadCount}
    </span>
  );

  return (
    <>
      {/* Visit tracker: a round button floating in the bottom-right corner, the day's progress around the count */}
      <div className={cn('fixed right-6 float-animation', isOverWindow ? 'bottom-24' : 'bottom-6')} style={{ zIndex }}>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          title={openLabel}
          aria-label={openLabel}
          className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/90 shadow-2xl backdrop-blur-xl transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
        >
          <span className="absolute inset-1">
            <ProgressRing size={72} stroke={6} percentage={completionPercentage} trackClassName="stroke-gray-300" barClassName="stroke-gray-500" />
          </span>
          <span className="relative text-center leading-none">
            <span className="block text-2xl font-bold tabular-nums text-gray-800">{nonCancelledCount}</span>
            <span className="block text-xs text-gray-500">{nonCancelledCount === 1 ? 'Visit' : 'Visits'}</span>
          </span>
          {unreadBadge}
        </button>
      </div>

      {/* Modal */}
      {isOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200"
              style={{ zIndex: zIndex + 10 }}
            />

            {/* Modal Content */}
            {/* Full-height sheet on phones, right-hand panel from md */}
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="visit-tracker-title"
              className="fixed inset-0 md:inset-y-4 md:right-4 md:left-auto md:w-[560px] bg-white md:rounded-2xl shadow-2xl overflow-hidden flex flex-col"
              style={{ zIndex: zIndex + 20 }}
            >
              {/* Fixed Header */}
              <div className="flex-shrink-0 border-b border-gray-100 bg-white">
                <div className="p-4 pb-0 sm:p-6 sm:pb-0">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <h2 id="visit-tracker-title" className="text-xl sm:text-2xl font-bold text-gray-800">
                        {activeTab === 'visits' 
                          ? (selectedDate && !isSameDay(selectedDate, new Date()) ? 'Visits' : "Today's Visits")
                          : 'Messages & Notifications'
                        }
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        {activeTab === 'visits' 
                          ? format(selectedDate || new Date(), 'EEEE, d MMMM yyyy')
                          : `${unreadNotificationCount} unread notifications`
                        }
                      </p>
                    </div>
                    <button
                      onClick={() => setIsOpen(false)}
                      className="p-2 hover:bg-gray-100 rounded-xl"
                      title="Close"
                      aria-label="Close"
                    >
                      <X className="w-6 h-6 text-gray-400" />
                    </button>
                  </div>
                  
                  {/* Tab Navigation */}
                  <div className="flex gap-1 p-1 bg-gray-100 rounded-lg -mx-2">
                    <button
                      onClick={() => setActiveTab('visits')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'visits'
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <Stethoscope className="w-4 h-4" />
                      Visits
                      {nonCancelledCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-[#01b9d5] text-white text-xs rounded-full">
                          {nonCancelledCount}
                        </span>
                      )}
                    </button>
                    <button
                      onClick={() => setActiveTab('messages')}
                      className={cn(
                        "flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                        activeTab === 'messages'
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      )}
                    >
                      <Bell className="w-4 h-4" />
                      Messages
                      {unreadNotificationCount > 0 && (
                        <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                          {unreadNotificationCount}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Single Scrollable Content Area */}
              <div className="relative flex-1 overflow-hidden">
                {activeTab === 'visits' ? (
                  <>
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
                      <div className="p-4 sm:p-6 space-y-6">
                    {/* Full Width Progress Bar */}
                    <div className="w-full">
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="text-sm font-semibold text-gray-700">Daily Progress</span>
                          <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded-full">
                            {completedCount} of {nonCancelledCount} visits completed
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
                          <Bell className="w-5 h-5 text-emerald-600 animate-pulse" />
                          <h3 className="font-semibold text-emerald-700">Called & Ready</h3>
                          <span className="ml-auto text-sm font-medium text-emerald-600 bg-white px-2 py-0.5 rounded-full">
                            {readyCount} {readyCount === 1 ? 'patient' : 'patients'} waiting
                          </span>
                        </div>
                        <div className="space-y-2">
                          {safeVisits.filter(v => v?.is_ready && !v?.is_cancelled && v?.status !== 'in-progress').map((visit, index) => (
                            <div
                              key={visit.id}
                              className={`relative flex items-center gap-3 p-2 pl-12 bg-white/80 backdrop-blur rounded-lg border border-emerald-200 ${
                                canOpenPatient ? 'cursor-pointer hover:bg-white' : ''
                              }`}
                              onClick={canOpenPatient ? () => handlePatientClick(visit.patient_id, true) : undefined}
                            >
                              {/* Ready Number Badge */}
                              <div className="absolute left-2 top-1/2 -translate-y-1/2 w-6 h-6 bg-emerald-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {index + 1}
                              </div>
                              
                              <PatientAvatar patientId={visit.patient_id} className="w-10 h-10 rounded-full">
                                <div className="flex items-center justify-center w-10 h-10 bg-emerald-100 rounded-full">
                                  <Bell className="w-5 h-5 text-emerald-600" />
                                </div>
                              </PatientAvatar>
                              <div className="flex-1">
                                <p className="font-medium text-gray-800 text-sm">
                                  {visit.patient?.first_name} {visit.patient?.last_name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDoctorName(visit.doctor?.full_name, 'Unassigned')} • Booked for {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : '--:--'}
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <HandshakeIcon className="w-4 h-4 text-emerald-600" />
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
                          <PlayCircle className="w-5 h-5 text-orange-600" />
                          <h3 className="font-semibold text-orange-700">Currently In Progress</h3>
                          <span className="ml-auto text-sm font-medium text-orange-600 bg-white px-2 py-0.5 rounded-full">
                            {inProgressCount} {inProgressCount === 1 ? 'visit' : 'visits'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {safeVisits.filter(v => v?.status === 'in-progress' && !v?.is_cancelled && !v?.is_handoff).map((visit, index) => (
                            <div
                              key={visit.id}
                              className={`relative flex flex-col sm:flex-row sm:items-center gap-3 p-3 sm:pl-12 bg-white/80 backdrop-blur rounded-lg border border-orange-100 ${
                                canOpenPatient ? 'cursor-pointer hover:bg-white' : ''
                              }`}
                              onClick={canOpenPatient ? () => handlePatientClick(visit.patient_id, true) : undefined}
                            >
                              {/* Progress Number Badge - inline on mobile, absolute on desktop */}
                              <div className="sm:absolute sm:left-2 sm:top-1/2 sm:-translate-y-1/2 w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                                {index + 1}
                              </div>
                              
                              {/* Main content area */}
                              <div className="flex items-start gap-3 flex-1">
                                <PatientAvatar patientId={visit.patient_id} className="w-10 h-10 rounded-full">
                                  <div className="flex items-center justify-center w-10 h-10 bg-orange-100 rounded-full">
                                    <Stethoscope className="w-5 h-5 text-orange-600" />
                                  </div>
                                </PatientAvatar>
                                <div className="flex-1">
                                  <p className="font-medium text-gray-800 text-sm">
                                    {visit.patient?.first_name} {visit.patient?.last_name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {formatDoctorName(visit.doctor?.full_name, 'Unassigned')} • Booked for {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : '--:--'}
                                  </p>
                                </div>
                              </div>
                              
                              {/* Action buttons - separate row on mobile */}
                              <div className="flex items-center gap-2 sm:ml-auto">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    runVisitAction(
                                      () => useVisitsStore.getState().handoffVisit(visit.id),
                                      'Handed off to nurse',
                                      'Could not hand off the visit. Please try again.'
                                    );
                                  }}
                                  className="px-3 py-1.5 bg-purple-500 hover:bg-purple-600 text-white text-sm font-medium rounded-md"
                                >
                                  Handoff
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    runVisitAction(
                                      () => useVisitsStore.getState().completeVisit(visit.id),
                                      'Visit completed',
                                      'Could not complete the visit. Please try again.'
                                    );
                                  }}
                                  className="px-3 py-1.5 bg-[#01b9d4] hover:bg-[#00a5be] text-white text-sm font-medium rounded-md"
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
                        <RefreshCcw className="w-8 h-8 text-gray-400 animate-spin mx-auto" />
                        <p className="text-sm text-gray-500 mt-2">Loading visits...</p>
                      </div>
                    ) : safeVisits.length === 0 ? (
                      <div className="text-center py-8">
                        <Calendar className="w-12 h-12 text-gray-300 mx-auto" />
                        <p className="text-sm text-gray-500 mt-2">
                          {selectedDate && !isSameDay(selectedDate, new Date()) ? 'No visits scheduled for this day' : 'No visits scheduled for today'}
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Book one with Schedule on the dashboard.</p>
                      </div>
                    ) : (
                      // Group visits by status and render each category
                      (() => {
                        const statusCategories = [
                          { 
                            key: 'scheduled', 
                            label: 'Scheduled', 
                            icon: Clock,
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
                            icon: CheckCircle,
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
                            icon: HandshakeIcon,
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
                            icon: XCircle,
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
                                {React.createElement(category.icon, { className: `w-5 h-5 ${category.color}` })}
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
                                    className={`relative bg-white/80 backdrop-blur-xl rounded-xl border border-white/50 shadow-lg group overflow-hidden ${
                                      canOpenPatient ? 'hover:shadow-xl hover:bg-white/90 hover:scale-[1.02] cursor-pointer transition-all duration-200' : ''
                                    }`}
                                    onClick={canOpenPatient ? () => handlePatientClick(visit.patient_id, true) : undefined}
                                  >
                                    {/* Main card content */}
                                    <div className="flex">
                                      {/* Card Number Badge with glassmorphism */}
                                      <div className="flex-shrink-0 p-3">
                                        <div className={`w-9 h-9 rounded-lg backdrop-blur-md flex items-center justify-center text-sm font-bold shadow-lg ${
                                          category.key === 'scheduled' && visit.is_checked_in
                                            ? 'bg-gradient-to-br from-[#01b8d8]/90 to-[#00a0c1]/90 text-white'
                                            : category.key === 'scheduled'
                                            ? 'bg-gradient-to-br from-[#489bfd]/90 to-[#3a7fe5]/90 text-white'
                                            : category.key === 'completed'
                                            ? 'bg-gradient-to-br from-green-500/90 to-green-600/90 text-white'
                                            : category.key === 'handedoff'
                                            ? 'bg-gradient-to-br from-purple-500/90 to-purple-600/90 text-white'
                                            : category.key === 'cancelled'
                                            ? 'bg-gradient-to-br from-red-500/90 to-red-600/90 text-white'
                                            : 'bg-white/70 text-gray-700 border border-gray-200/50 backdrop-blur-sm'
                                        }`}>
                                          {cardNumber}
                                        </div>
                                      </div>
                                      
                                      {/* Main content area - compact spacing */}
                                      <div className="flex-1 py-3 pr-3">
                                        {/* Time with subtle background */}
                                        <div className={`text-sm font-bold mb-1 inline-block px-2 py-0.5 rounded-md ${
                                          category.key === 'scheduled' && visit.is_checked_in
                                            ? 'bg-[#01b8d8]/10 text-[#01b8d8]'
                                            : category.key === 'scheduled'
                                            ? 'bg-[#489bfd]/10 text-[#489bfd]'
                                            : category.key === 'completed'
                                            ? 'bg-green-500/10 text-green-700'
                                            : category.key === 'handedoff'
                                            ? 'bg-purple-500/10 text-purple-700'
                                            : category.key === 'cancelled'
                                            ? 'bg-red-500/10 text-red-700'
                                            : 'bg-gray-100 text-gray-900'
                                        }`}>
                                          {visit.scheduled_time ? format(new Date(`2000-01-01T${visit.scheduled_time}`), 'HH:mm') : 
                                           visit.visit_time ? format(new Date(`2000-01-01T${visit.visit_time}`), 'HH:mm') : '--:--'}
                                        </div>

                                        {/* Patient Name */}
                                        <div className="font-medium text-gray-800 group-hover:text-brand-primary mb-0.5">
                                          {visit.patient?.first_name} {visit.patient?.last_name}
                                        </div>
                                        
                                        {/* Visit type and Doctor */}
                                        <div className="text-xs text-gray-500 mb-2">
                                          {visit.visit_type || 'Consultation'} • {formatDoctorName(visit.doctor?.full_name, 'Unassigned')}
                                        </div>
                                        
                                        {/* Status and actions for non-handoff cards */}
                                        {category.key !== 'handedoff' && (
                                          <div className="flex items-center gap-2">
                                            {category.key === 'scheduled' && visit.is_checked_in && (
                                              <>
                                                <div className="flex items-center gap-1">
                                                  <div className="w-2 h-2 bg-emerald-500 rounded-full" />
                                                  <span className="text-xs font-medium text-emerald-600">Checked In</span>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    setIsOpen(false);
                                                    requestAnimationFrame(() => {
                                                      handleStartVisit(visit);
                                                    });
                                                  }}
                                                  className="ml-auto px-3 py-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xs font-medium rounded-md shadow-sm"
                                                >
                                                  Start Visit
                                                </button>
                                              </>
                                            )}
                                            {/* A no-show is said so: checking them in would leave the booking a no-show in the diary */}
                                            {category.key === 'scheduled' && !visit.is_checked_in && (visit.status === 'no-show' || visit.status === 'no_show') && (
                                              <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                                                <span className="text-xs font-medium text-gray-600">No-show</span>
                                              </div>
                                            )}
                                            {category.key === 'scheduled' && !visit.is_checked_in && visit.status !== 'no-show' && visit.status !== 'no_show' && (
                                              <>
                                                <div className="flex items-center gap-1">
                                                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                                  <span className="text-xs font-medium text-blue-600">Scheduled</span>
                                                </div>
                                                <button
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    e.preventDefault();
                                                    runVisitAction(
                                                      () => checkInPatient(visit.id),
                                                      'Patient checked in',
                                                      'Could not check in the patient. Please try again.'
                                                    );
                                                  }}
                                                  className="ml-auto px-3 py-1 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white text-xs font-medium rounded-md shadow-sm"
                                                >
                                                  Check In
                                                </button>
                                              </>
                                            )}
                                            {category.key === 'completed' && (
                                              <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                                <span className="text-xs font-medium text-green-600">Completed</span>
                                              </div>
                                            )}
                                            {category.key === 'cancelled' && (
                                              <div className="flex items-center gap-1">
                                                <div className="w-2 h-2 bg-red-500 rounded-full" />
                                                <span className="text-xs font-medium text-red-600">Cancelled</span>
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {/* Handoff cards special section */}
                                    {category.key === 'handedoff' && (
                                      <div className="border-t border-purple-100/30 bg-gradient-to-r from-purple-50/50 to-purple-100/30 backdrop-blur-sm">
                                        {/* Ready for checkout badge */}
                                        <div className="px-3 pt-2 pb-1">
                                          <div className="flex items-center gap-1.5">
                                            <div className="w-2 h-2 bg-purple-500 rounded-full" />
                                            <span className="text-xs font-medium text-purple-700">Ready for checkout</span>
                                          </div>
                                        </div>
                                        
                                        {/* Actions row */}
                                        <div className="px-3 pb-2 flex items-center justify-between gap-2">
                                          {/* Print buttons */}
                                          <HandoffCardPrintButtons
                                            visitId={visit.id}
                                            patientId={visit.patient_id}
                                            practiceId={visit.practice_id || practiceId}
                                            showLabels={false}
                                          />
                                          
                                          {/* Complete button */}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              runVisitAction(
                                                () => useVisitsStore.getState().completeVisit(visit.id),
                                                'Visit completed',
                                                'Could not complete the visit. Please try again.'
                                              );
                                            }}
                                            className="px-3 py-1 bg-gradient-to-r from-[#01b9d4] to-[#00a5be] hover:from-[#00a5be] hover:to-[#0096b7] text-white text-xs font-medium rounded-md shadow-sm"
                                          >
                                            Complete
                                          </button>
                                        </div>
                                      </div>
                                    )}
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
              </>
            ) : (
              /* Messages Tab: the person's notifications. The red count on the tracker button is staff chat: it opens from here */
              <>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      navigate('/communications?tab=messaging');
                    }}
                    className="block w-full px-4 pt-3 text-left text-sm font-medium text-cyan-700 hover:underline"
                  >
                    Staff messages: {unreadCount} unread
                  </button>
                )}
                <NotificationsList
                  practiceId={practiceId}
                  userId={user?.id || ''}
                  className="h-full"
                />
              </>
            )}
          </div>
        </div>
      </>
    )}

      {/* Patient Modal */}
      {console.log('🏥 [FloatingVisitTracker] Modal render check:', {
        disablePatientModal,
        selectedPatientId,
        isPatientModalOpen,
        defaultDetailTab,
        shouldRenderModal: !disablePatientModal && selectedPatientId
      })}
      {!disablePatientModal && selectedPatientId && (
        <Suspense fallback={null}>
          <ComprehensivePatientModal
            isOpen={isPatientModalOpen}
            onClose={() => {
              console.log('🚪 [FloatingVisitTracker] Modal closing');
              setIsPatientModalOpen(false);
              setSelectedPatientId(null);
              setDefaultDetailTab('overview');
            }}
            patientId={selectedPatientId}
            defaultDetailTab={defaultDetailTab}
          />
        </Suspense>
      )}

      {/* Edit Visit Modal */}
      {selectedVisitForEdit && (
        <Suspense fallback={null}>
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
        </Suspense>
      )}
    </>
  );
};

export default FloatingVisitTracker;