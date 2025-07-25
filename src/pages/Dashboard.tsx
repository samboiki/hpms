import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import SearchDuotone from '../components/icons/SearchDuotone';
import { Icon } from '@iconify/react';
import { supabase } from '../lib/supabase';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format, eachDayOfInterval, isToday, isSameDay, isSameMonth, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { usePractice } from '../contexts/PracticeContext';
import AddScheduledVisitForm from '../components/forms/AddScheduledVisitForm';
import { motion, AnimatePresence } from 'framer-motion';
import { useVisitsStore } from '../stores/visitsStore';
import { useTheme } from '../stores/themeStore';
import { toast } from 'react-hot-toast';
import PremiumStatCard from '../components/dashboard/PremiumStatCard';
import DetailedReportModal from '../components/modals/DetailedReportModal';
import EnhancedFinancialModal from '../components/modals/EnhancedFinancialModal';
import PracticeOverviewTile from '../components/dashboard/PracticeOverviewTile';
import { dashboardStatsService, DashboardStats } from '../services/dashboardStatsService';
import { useAuthStore } from '../stores/authStore';
import { NotificationsPanel, Notification } from '../components/dashboard/NotificationsPanel';
// import ComprehensivePatientModal from '../components/patients/ComprehensivePatientModal'; // Commented out - now navigating to patients page
import { useOptimizedDashboardStats, useCommunicationStats } from '../hooks/useOptimizedDashboardStats';
import { useTodayAppointments, useRealtimeAppointments } from '../hooks/useAppointments';
import FloatingVisitTracker from '../components/dashboard/FloatingVisitTracker';
import { useAutoPatientPrefetch } from '../hooks/usePatientPrefetch';
import PremiumAppointmentScheduler from '../components/PremiumAppointmentScheduler';
import FormModal from '../components/modals/FormModal';
import PremiumAddAppointmentForm from '../components/forms/PremiumAddAppointmentForm';
import AppointmentDetailsModal from '../components/modals/AppointmentDetailsModal';
import RescheduleAppointmentModal from '../components/modals/RescheduleAppointmentModal';
import AppointmentActionModal from '../components/modals/AppointmentActionModal';
import AppointmentApprovalModal from '../components/modals/AppointmentApprovalModal';
import AppointmentGridView from '../components/appointments/AppointmentGridView';
import FullScreenEditVisitModal from '../components/visits/FullScreenEditVisitModal';
import { usePracticeData } from '../hooks/usePracticeData';

// Using Visit type from enhanced-visit.types
import { Visit } from '../types/enhanced-visit.types';

interface Doctor {
  id: string;
  email: string;
  user_metadata?: {
    full_name?: string;
    role?: string;
    avatar?: string;
    specialization?: string;
  };
}

interface ActivityItem {
  id: string;
  type: 'appointment' | 'patient' | 'lab' | 'payment' | 'prescription';
  message: string;
  details: string;
  time: string;
  icon: any;
  color: string;
}

interface LayoutContext {
  toggleMobileSidebar: () => void;
  isMobileSidebarOpen: boolean;
}

function Dashboard() {
  const { user, logout } = useAuthStore();
  const { toggleMobileSidebar } = useOutletContext<LayoutContext>();
  const { currentTheme } = useTheme();
  const { practiceData, colors } = usePracticeData();
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientsData, setPatientsData] = useState<any[]>([]);
  const [isAddVisitModalOpen, setIsAddVisitModalOpen] = useState(false);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  // appointments now come from useTodayAppointments hook
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'doctor' | 'nurse' | 'receptionist'>('admin');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [internalViewMode, setInternalViewMode] = useState<'timeline' | 'grid'>('grid');
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [showGridView, setShowGridView] = useState(false);
  const [gridViewStatus, setGridViewStatus] = useState<'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'in-progress' | 'ready'>('pending');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  // Note: patientStats now comes from usePatientStats hook - no longer using local state
  const [selectedReportModal, setSelectedReportModal] = useState<{
    isOpen: boolean;
    type: 'patients' | 'notifications' | 'encounters' | 'finance' | null;
  }>({ isOpen: false, type: null });
  
  const [isEnhancedFinancialModalOpen, setIsEnhancedFinancialModalOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showCalendarPicker, setShowCalendarPicker] = useState(false);
  const [showYearDropdown, setShowYearDropdown] = useState(false);
  const [showMonthDropdown, setShowMonthDropdown] = useState(false);
  const [isAvatarDropdownOpen, setIsAvatarDropdownOpen] = useState(false);
  const avatarButtonRef = useRef<HTMLButtonElement>(null);
  const [isEditVisitModalOpen, setIsEditVisitModalOpen] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<any>(null);
  const [isEditAppointmentModalOpen, setIsEditAppointmentModalOpen] = useState(false);
  const calendarScrollRef = useRef<HTMLDivElement>(null);
  
  // Fetch all dashboard stats using optimized hook
  const { data: dashboardData, isLoading: isDashboardLoading } = useOptimizedDashboardStats();
  
  // Fetch communication stats separately for PremiumStatCard
  const { data: realCommunicationStats, isLoading: isCommunicationLoading } = useCommunicationStats();
  
  // Use shared appointments data
  const { data: todayAppointments = [], isLoading: isAppointmentsLoading } = useTodayAppointments();
  
  // Subscribe to real-time appointment updates
  useRealtimeAppointments();
  
  // Prefetch patient data for today's appointments in the background
  useAutoPatientPrefetch(todayAppointments, !isAppointmentsLoading && todayAppointments.length > 0);
  
  // Extract individual stats for compatibility
  const communicationStats = dashboardData?.communication || null;
  const realPatientStats = dashboardData?.patient || {
    total: 0,
    male: 0,
    female: 0,
    newThisMonth: 0,
    newThisWeek: 0,
    averageAge: 0,
    activePatients: 0
  };
  const invoiceStats = dashboardData?.invoice || {
    totalInvoices: 0,
    totalRevenue: 0,
    quarterlyRevenue: 0,
    quarterlyInvoices: 0,
    quarterlyPaidInvoices: 0,
    quarterlyOutstandingInvoices: 0,
    quarterlyPercentagePaid: 0,
    quarterlyPercentageOutstanding: 0,
    currentQuarter: Math.floor(new Date().getMonth() / 3) + 1
  };
  const encounterStats = dashboardData?.encounter || {
    total: 0,
    completed: 0,
    pending: 0,
    inProgress: 0,
    percentageCompleted: 0,
    percentagePending: 0,
    newThisMonth: 0
  };
  
  const navigate = useNavigate();
  // const [isPatientModalOpen, setIsPatientModalOpen] = useState(false); // Commented out - now navigating to patients page
  // const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null); // Commented out - now navigating to patients page
  // const [defaultDetailTab, setDefaultDetailTab] = useState<'overview' | 'encounters'>('overview'); // Commented out - now navigating to patients page

  const handleLogout = async () => {
    // Clear any pending navigation
    window.history.replaceState(null, '', '/login');
    
    // Perform logout
    await logout();
    
    // Force navigation to login
    window.location.href = '/login';
  };

  // Close mobile menu when clicking outside (handled by backdrop now)

  // Close calendar picker when clicking backdrop or pressing Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showCalendarPicker) {
        setShowCalendarPicker(false);
        setShowYearDropdown(false);
        setShowMonthDropdown(false);
      }
    };

    if (showCalendarPicker) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    } else {
      // Close dropdowns when modal closes
      setShowYearDropdown(false);
      setShowMonthDropdown(false);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [showCalendarPicker]);

  // Get visits data from store
  const { 
    visits, 
    unconfirmedCount, 
    checkedInCount, 
    readyCount, 
    inProgressCount, 
    todayCount,
    fetchTodayVisits,
    fetchVisits,
    subscribeToVisitChanges,
    unsubscribeFromVisitChanges
  } = useVisitsStore();

  // Subscribe to real-time visit changes
  useEffect(() => {
    if (currentPracticeId) {
      fetchTodayVisits(currentPracticeId);
      subscribeToVisitChanges(currentPracticeId);
    }
    return () => {
      unsubscribeFromVisitChanges();
    };
  }, [currentPracticeId, fetchTodayVisits, subscribeToVisitChanges, unsubscribeFromVisitChanges]);

  // Fetch visits when selected date changes
  useEffect(() => {
    if (currentPracticeId && selectedDate) {
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      console.log('📅 Dashboard: Selected date changed to:', formattedDate);
      fetchVisits({ 
        date: formattedDate, 
        practiceId: currentPracticeId 
      });
    }
  }, [selectedDate, currentPracticeId, fetchVisits]);

  // Auto-scroll to center today's date only on initial load
  useEffect(() => {
    const scrollToToday = () => {
      const todayButton = document.querySelector('[data-is-today="true"]');
      if (todayButton && calendarScrollRef.current) {
        const container = calendarScrollRef.current;
        const buttonRect = todayButton.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const scrollLeft = buttonRect.left - containerRect.left - (containerRect.width / 2) + (buttonRect.width / 2) + container.scrollLeft;
        container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
      }
    };

    // Only scroll on initial mount
    const timeoutId = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timeoutId);
  }, []); // Empty dependency array - only run on mount

  // Show notification for unconfirmed visits
  useEffect(() => {
    if (unconfirmedCount > 0) {
      toast(`You have ${unconfirmedCount} unconfirmed booking${unconfirmedCount > 1 ? 's' : ''} requiring attention`, {
        duration: 6000,
        position: 'top-right',
        icon: '⚠️'
      });
    }
  }, [unconfirmedCount]);

  // Note: fetchPatientStats removed - now using usePatientStats hook for real-time practice-specific data

  // Get practice context data
  const { practiceId, userId, userRole, isLoading: isPracticeLoading, error: practiceError } = usePractice();

  // Update current user data from practice context
  useEffect(() => {
    if (practiceId && userId && userRole) {
      setCurrentPracticeId(practiceId);
      setCurrentUserId(userId);
      setCurrentUserRole(userRole as any);
    }
  }, [practiceId, userId, userRole]);

  const fetchDashboardData = async () => {
    if (!practiceId) return;
    
    const startTime = performance.now();
    try {
      setIsLoading(true);
      
      // Fetch doctors for the practice
      const { data: practiceDoctors, error: doctorsError } = await supabase
        .from('users')
        .select('id, email, full_name, role')
        .eq('practice_id', practiceId)
        .eq('role', 'doctor');

      if (doctorsError) throw doctorsError;

      // Format doctors for dropdown
      const formattedDoctors = (practiceDoctors || []).map(doctor => ({
        id: doctor.id,
        email: doctor.email,
        user_metadata: {
          full_name: doctor.full_name,
          role: doctor.role
        }
      }));
      setDoctors(formattedDoctors);

      // Fetch patients for activities (limit to recent for performance)
      const { data: practicePatients, error: patientsError } = await supabase
        .from('patients')
        .select('id, first_name, last_name, gender, date_of_birth, created_at')
        .eq('practice_id', practiceId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (patientsError) throw patientsError;
      setPatientsData(practicePatients || []);

      // Generate recent activities from visits data
      const activities: ActivityItem[] = [];
      
      // Get today's visits for activities
      const todayVisits = visits.slice(0, 3);
      todayVisits.forEach((visit) => {
        activities.push({
          id: `visit-${visit.id}`,
          type: 'appointment',
          message: `${visit.patient?.first_name} ${visit.patient?.last_name}`,
          details: `${visit.visit_type} visit ${visit.status}`,
          time: visit.scheduled_time || visit.visit_time || 'TBD',
          icon: 'solar:calendar-bold-duotone',
          color: 'text-blue-500'
        });
      });

      setRecentActivities(activities);

      // Dashboard stats are fetched by useOptimizedDashboardStats hook

      // Generate real-time notifications based on visits data
      const newNotifications: Notification[] = [];

      // Unconfirmed bookings that need confirmation - specifically from website
      const unconfirmedVisits = visits.filter(v => 
        v.status === 'scheduled' && 
        !v.is_confirmed && 
        v.is_from_website && 
        !v.is_cancelled
      );
      unconfirmedVisits.forEach((visit) => {
        newNotifications.push({
          id: `booking-${visit.id}`,
          type: 'booking',
          priority: 'high',
          title: 'New Booking Request',
          description: `${visit.patient?.first_name} ${visit.patient?.last_name} requested a ${visit.visit_type} visit for ${format(new Date(visit.scheduled_date + 'T' + visit.scheduled_time), 'MMM d, h:mm a')}`,
          time: new Date(visit.created_at || new Date()),
          actionRequired: true,
          read: false,
          data: visit,
          actions: {
            primary: {
              label: 'Confirm',
              variant: 'approve',
              onClick: () => {
                setSelectedVisit(visit);
                setIsConfirmationModalOpen(true);
              }
            },
            secondary: {
              label: 'View Details',
              onClick: () => {
                setSelectedVisit(visit);
                setIsDetailsModalOpen(true);
              }
            }
          }
        });
      });

      // Upcoming follow-ups for today
      const todayFollowUps = visits.filter(visit => 
        visit.visit_type === 'follow-up' && 
        visit.is_confirmed &&
        visit.scheduled_date === format(new Date(), 'yyyy-MM-dd')
      );
      todayFollowUps.forEach((visit) => {
        newNotifications.push({
          id: `followup-${visit.id}`,
          type: 'follow-up',
          priority: 'normal',
          title: 'Follow-up Reminder',
          description: `${visit.patient?.first_name} ${visit.patient?.last_name} has a follow-up visit at ${visit.scheduled_time || 'TBD'}`,
          time: new Date(visit.scheduled_date + 'T' + visit.scheduled_time),
          actionRequired: false,
          read: false,
          data: visit,
          actions: {
            primary: {
              label: 'Start Visit',
              onClick: () => handleStartVisit(visit.id)
            }
          }
        });
      });

      // Sort notifications by priority and time
      newNotifications.sort((a, b) => {
        const priorityOrder = { urgent: 0, high: 1, normal: 2, low: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.time.getTime() - a.time.getTime();
      });

      setNotifications(newNotifications);

      
      const totalTime = performance.now() - startTime;
      console.log(`✅ [Dashboard] Data fetched in ${totalTime.toFixed(2)}ms`);
    } catch (error) {
      console.error('❌ [Dashboard] Error fetching data:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch dashboard data when practice ID is available
  useEffect(() => {
    if (practiceId && !isPracticeLoading) {
      fetchDashboardData();
    }
  }, [practiceId, isPracticeLoading]);



  const handleEditVisit = (visit: Visit) => {
    setSelectedVisit(visit);
    setIsRescheduleModalOpen(true);
  };

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    doctorId: string;
    date: string;
    time: string;
  } | null>(null);

  const handleCreateVisit = async (doctorId: string, date: string, time: string) => {
    setSelectedTimeSlot({ doctorId, date, time });
    setIsAddVisitModalOpen(true);
  };

  const handleDeleteVisit = async (visitId: string) => {
    try {
      const { error } = await supabase
        .from('visits')
        .delete()
        .eq('id', visitId);
      
      if (error) throw error;
      // Real-time updates will handle the refresh
    } catch (error) {
      console.error('Error deleting visit:', error);
    }
  };

  const handleConfirmVisit = async (visitId: string, doctorId?: string) => {
    try {
      const { confirmVisit } = useVisitsStore.getState();
      await confirmVisit(visitId, doctorId);
      
      setIsConfirmationModalOpen(false);
      setSelectedVisit(null);
      toast.success('Visit confirmed successfully');
    } catch (error) {
      console.error('Error confirming visit:', error);
      toast.error('Failed to confirm visit');
    }
  };

  const handleRejectVisit = async (visitId: string, reason?: string) => {
    try {
      const { rejectVisit } = useVisitsStore.getState();
      await rejectVisit(visitId, reason);
      
      setIsConfirmationModalOpen(false);
      setSelectedVisit(null);
      toast.success('Visit rejected');
    } catch (error) {
      console.error('Error rejecting visit:', error);
      toast.error('Failed to reject visit');
    }
  };

  const handleStartVisit = async (visitId: string) => {
    try {
      const { startVisit } = useVisitsStore.getState();
      const visit = visits.find(v => v.id === visitId);
      if (!visit) {
        toast.error('Visit not found');
        return;
      }

      await startVisit(visitId);
      
      // Close any open modals
      setIsActionModalOpen(false);
      setIsConfirmationModalOpen(false);
      setSelectedVisit(null);
      
      // Show success message with patient name
      toast.success(
        `Visit started for ${visit.patient?.first_name} ${visit.patient?.last_name}`,
        { duration: 3000, icon: '🏥' }
      );
      
      // Navigate to patient detail page after a short delay
      setTimeout(() => {
        navigate(`/patients/${visit.patient_id}`);
      }, 500);
      
    } catch (error) {
      console.error('Error starting visit:', error);
      toast.error('Failed to start visit');
    }
  };

  const handleCompleteVisit = async (visitId: string) => {
    try {
      const { completeVisit } = useVisitsStore.getState();
      const visit = visits.find(v => v.id === visitId);
      if (!visit) {
        toast.error('Visit not found');
        return;
      }
      
      await completeVisit(visitId);
      
      // Close modals
      setIsActionModalOpen(false);
      setSelectedVisit(null);
      
      // Show success message
      toast.success(
        `Visit completed for ${visit.patient?.first_name} ${visit.patient?.last_name}`,
        { duration: 3000, icon: '✅' }
      );
      
    } catch (error) {
      console.error('Error completing visit:', error);
      toast.error('Failed to complete visit');
    }
  };


  // Calculate today's statistics using visits
  const todayVisits = visits.filter(v => 
    (v.scheduled_date === format(new Date(), 'yyyy-MM-dd') || 
     v.visit_date === format(new Date(), 'yyyy-MM-dd')) && 
    !v.is_cancelled
  );
  const pendingVisits = visits.filter(v => v.is_scheduled && !v.is_confirmed && !v.is_cancelled);
  const completedToday = todayVisits.filter(v => v.status === 'completed').length;
  const pendingAppointments = pendingVisits; // For compatibility


  return (
    <div className="min-h-screen bg-gray-100 relative" style={{
      backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.1) 1px, transparent 0)',
      backgroundSize: '20px 20px'
    }}>
      <div className="px-0 sm:px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Compact Professional Header */}
        <div className="mx-0 sm:mx-0 backdrop-blur-md rounded-none sm:rounded-xl shadow-sm border border-gray-100/50 border-x-0 sm:border-x">
          <div className="p-4 md:p-5">
            <div className="flex items-center justify-between w-full">
              {/* Left Side - Mobile: User Avatar, Desktop: Practice logo + title */}
              <div className="flex items-center gap-3">
                {/* User Avatar - Left side on mobile/tablet */}
                {user && (
                  <div className="relative lg:hidden">
                    <button
                      ref={avatarButtonRef}
                      onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                      className="relative group focus:outline-none"
                    >
                      {/* Pulsating outer ring */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300`}></div>
                      <div className={`absolute -inset-1 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full opacity-50`}></div>
                      
                      {/* Avatar circle */}
                      <div className="relative h-12 w-12 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
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
                
                {/* Practice Logo - Hidden on mobile/tablet */}
                <div className="hidden lg:block p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                  <Icon icon="solar:buildings-bold-duotone" className="w-8 h-8 text-white" />
                </div>
                
                {/* Dashboard Title */}
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">
                    Dashboard
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5 hidden lg:block">Welcome back! Here's your practice dashboard</p>
                </div>
              </div>

              {/* Right Side */}
              <div className="flex items-center gap-3">
                {/* Search Bar - Desktop only */}
                <div className="hidden xl:block w-[400px]">
                  <div className="relative group">
                    <div className={`absolute -inset-0.5 bg-gradient-to-r ${currentTheme.gradients.sidebar} rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200`}></div>
                    <div className="relative bg-gray-200 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                        <SearchDuotone 
                          className="w-5 h-5 transition-colors duration-300"
                          primaryColor="#374151"
                          secondaryColor="#37415180"
                        />
                      </div>
                      <input
                        type="text"
                        placeholder="Search patients, appointments..."
                        className="relative w-full pl-12 pr-4 py-3 bg-transparent text-base text-gray-800 placeholder-gray-600 focus:outline-none focus:placeholder-gray-500 transition-colors duration-300"
                        onChange={(e) => {
                          console.log('Search:', e.target.value);
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Mobile Menu Button - Right side on mobile/tablet */}
                <div className="lg:hidden">
                  <button 
                    onClick={toggleMobileSidebar}
                    className="p-3 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center gap-2"
                  >
                    <Icon icon="solar:hamburger-menu-bold-duotone" className="w-5 h-5" />
                    <span className="text-sm font-medium hidden sm:block">Menu</span>
                  </button>
                </div>

                {/* User Avatar - Desktop only (right side) */}
                {user && (
                  <div className="relative hidden lg:block">
                    <button
                      ref={avatarButtonRef}
                      onClick={() => setIsAvatarDropdownOpen(!isAvatarDropdownOpen)}
                      className="relative group focus:outline-none"
                    >
                      {/* Pulsating outer ring */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300`}></div>
                      <div className={`absolute -inset-1 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full opacity-50`}></div>
                      
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

                {/* User dropdown - shared for both mobile and desktop */}
                {user && isAvatarDropdownOpen && createPortal(
                  <>
                    <div 
                      className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[99998] animate-in fade-in duration-200" 
                      onClick={() => setIsAvatarDropdownOpen(false)}
                    />
                    
                    <div 
                      style={{
                        position: 'fixed',
                        top: avatarButtonRef.current ? avatarButtonRef.current.getBoundingClientRect().bottom + 16 : 0,
                        left: window.innerWidth < 1024 ? avatarButtonRef.current?.getBoundingClientRect().left : undefined,
                        right: window.innerWidth >= 1024 ? (avatarButtonRef.current ? window.innerWidth - avatarButtonRef.current.getBoundingClientRect().right : 0) : undefined,
                        zIndex: 99999
                      }}
                      className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 w-[320px] animate-in fade-in slide-in-from-top-3 duration-300"
                    >
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-gray-900">User Profile</h3>
                        <button 
                          onClick={() => setIsAvatarDropdownOpen(false)}
                          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                          <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                        </button>
                      </div>
                      
                      <div className="bg-gradient-to-br from-gray-50 to-gray-100/50 rounded-xl p-4 mb-6">
                        <div className="flex items-start gap-3">
                          <div className="relative flex-shrink-0">
                            <div className="h-14 w-14 rounded-full overflow-hidden border-3 border-white shadow-lg">
                              <img 
                                src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                                alt={user.name}
                                className="h-full w-full object-cover"
                              />
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-4 w-4 bg-green-500 rounded-full border-2 border-white"></div>
                          </div>
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <p className="text-base font-semibold text-gray-900 truncate">{user.name}</p>
                            <p className="text-sm text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>{user.email}</p>
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-600 text-white mt-1">
                              {user.role}
                            </span>
                          </div>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => {
                          setIsAvatarDropdownOpen(false);
                          navigate('/settings');
                        }}
                        className="w-full px-4 py-3 text-sm bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl transition-colors font-semibold hover:shadow-lg flex items-center justify-center gap-2 mb-2"
                      >
                        <Icon icon="solar:settings-bold-duotone" className="w-4 h-4" />
                        Settings
                      </button>
                      
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
              </div>
            </div>


            {/* Premium Dashboard Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
              {true ? [
                // Patients Card - Now using real database stats by practice
                <PremiumStatCard
                  key="patients"
                  title="Patients"
                  mainValue={realPatientStats.total}
                  subtitle="Total registered patients"
                  icon={null}
                  iconName="solar:users-group-two-rounded-bold-duotone"
                  gradient={colors?.gradient || "from-[#489bfd] to-[#a4c8ff]"}
                  cardType="patients"
                  stats={[
                    { label: 'Male', value: realPatientStats.male, color: colors?.primary || '#489bfd' },
                    { label: 'Female', value: realPatientStats.female, color: colors?.secondary || '#7db3fe' }
                  ]}
                  comparison={{
                    label1: 'Male',
                    value1: realPatientStats.male,
                    label2: 'Female',
                    value2: realPatientStats.female,
                    color1: colors?.primary || '#489bfd',
                    color2: colors?.secondary || '#7db3fe'
                  }}
                  trend={{
                    value: `+${realPatientStats.newThisMonth}`,
                    isPositive: realPatientStats.newThisMonth > 0
                  }}
                  onClick={() => {
                    navigate('/patients');
                  }}
                  patientStats={realPatientStats}
                />,
                
                // Communication Card (Light Mode)
                <PremiumStatCard
                  key="communication"
                  title="Communication"
                  mainValue={realCommunicationStats?.overall_percentage_available ? `${realCommunicationStats.overall_percentage_available}%` : '88%'}
                  subtitle="Service usage"
                  icon={null}
                  iconName="solar:monitor-smartphone-bold-duotone"
                  gradient="from-amber-500 to-orange-600"
                  cardType="communication"
                  stats={[
                    { label: 'SMS Available', value: realCommunicationStats?.sms?.available || 850, color: '#EF4444' },
                    { label: 'Email Available', value: realCommunicationStats?.email?.available || 460, color: '#F59E0B' }
                  ]}
                  comparison={{
                    label1: 'SMS Available',
                    value1: realCommunicationStats?.sms?.available || 850,
                    label2: 'Email Available', 
                    value2: realCommunicationStats?.email?.available || 460,
                    color1: '#EF4444',
                    color2: '#F97316'
                  }}
                  onClick={() => {
                    navigate('/communications');
                  }}
                  dashboardStats={dashboardStats}
                  communicationStats={realCommunicationStats}
                />,
                
                // Encounters Card - Now using real database stats
                <PremiumStatCard
                  key="encounters"
                  title="Encounters"
                  mainValue={encounterStats.total}
                  subtitle="Total patient visits"
                  icon={null}
                  iconName="solar:clipboard-heart-bold-duotone"
                  gradient="from-red-500 to-pink-500"
                  cardType="encounters"
                  stats={[
                    { label: 'Completed', value: encounterStats.completed, color: '#10B981' },
                    { label: 'Pending', value: encounterStats.pending, color: '#EF4444' }
                  ]}
                  comparison={{
                    label1: 'Completed',
                    value1: encounterStats.completed,
                    label2: 'Pending',
                    value2: encounterStats.pending,
                    color1: '#10B981',
                    color2: '#EF4444'
                  }}
                  trend={{
                    value: `+${encounterStats.newThisMonth}`,
                    isPositive: encounterStats.newThisMonth > 0
                  }}
                  onClick={() => {
                    navigate('/encounters');
                  }}
                  encounterStats={encounterStats}
                />,
                
                // Finance Card - Now using real quarterly invoice data
                <PremiumStatCard
                  key="finance"
                  title="Finance"
                  mainValue={`N$${invoiceStats.quarterlyRevenue.toLocaleString()}`}
                  subtitle={`Q${invoiceStats.currentQuarter} ${new Date().getFullYear()} revenue`}
                  icon={null}
                  iconName="solar:wallet-money-bold-duotone"
                  gradient="from-cyan-500 to-blue-500"
                  cardType="finance"
                  stats={[
                    { label: 'Paid', value: `${invoiceStats.quarterlyPercentagePaid}%`, color: '#8B5CF6' },
                    { label: 'Outstanding', value: `${invoiceStats.quarterlyPercentageOutstanding}%`, color: '#EF4444' }
                  ]}
                  comparison={{
                    label1: 'Paid',
                    value1: invoiceStats.quarterlyPercentagePaid,
                    label2: 'Outstanding',
                    value2: invoiceStats.quarterlyPercentageOutstanding,
                    color1: '#8B5CF6',
                    color2: '#EF4444'
                  }}
                  trend={{
                    value: `${invoiceStats.quarterlyInvoices} invoices`,
                    isPositive: invoiceStats.quarterlyInvoices > 0
                  }}
                  onClick={() => {
                    navigate('/finance');
                  }}
                  invoiceStats={invoiceStats}
                />
              ] : (
                // Loading skeleton
                Array.from({ length: 4 }, (_, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="bg-gradient-to-br from-gray-300 to-gray-400 rounded-2xl p-4 shadow-lg"
                  >
                    <div className="animate-pulse">
                      <div className="flex items-center justify-between mb-3">
                        <div className="w-8 h-8 bg-white/20 rounded-xl"></div>
                        <div className="w-4 h-4 bg-white/20 rounded"></div>
                      </div>
                      <div className="space-y-2 mb-3">
                        <div className="h-3 bg-white/20 rounded w-16"></div>
                        <div className="h-6 bg-white/20 rounded w-12"></div>
                        <div className="h-2 bg-white/20 rounded w-20"></div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="h-6 bg-white/10 rounded-lg"></div>
                        <div className="h-6 bg-white/10 rounded-lg"></div>
                        <div className="h-6 bg-white/10 rounded-lg"></div>
                        <div className="h-6 bg-white/10 rounded-lg"></div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            {/* Week Calendar and Notifications */}
            <div className="mt-6">
              {/* Week Calendar and Notifications Row */}
              <div className="grid grid-cols-12 gap-4">
                {/* Premium Month Calendar - Glassmorphic - Full width on mobile/tablet, 8 columns on desktop */}
                <div className="relative col-span-12 lg:col-span-8">
                  {/* Glassmorphic background */}
                  <div className="bg-white/20 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/30">
                    {/* Month Navigation Header - Different layouts for mobile vs desktop */}
                    <div className="mb-4">
                      {/* Desktop Layout - 3-column grid */}
                      <div className="hidden lg:grid lg:grid-cols-3 lg:items-center lg:gap-4">
                        {/* Grid/Timeline Filters on left */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center bg-white/30 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-white/20">
                            <button
                              onClick={() => setInternalViewMode('grid')}
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                                internalViewMode === 'grid'
                                  ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                              }`}
                            >
                              <Icon icon="solar:widget-2-bold-duotone" className="h-4 w-4" />
                              Grid
                            </button>
                            <button
                              onClick={() => setInternalViewMode('timeline')}
                              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                                internalViewMode === 'timeline'
                                  ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                              }`}
                            >
                              <Icon icon="solar:calendar-line-duotone" className="h-4 w-4" />
                              Timeline
                            </button>
                          </div>
                        </div>
                        
                        {/* Selected Date truly centered */}
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                            className="p-2 hover:bg-white/30 rounded-full transition-colors duration-200 backdrop-blur-sm"
                          >
                            <Icon icon="solar:map-arrow-left-bold-duotone" className="w-5 h-5 text-gray-600" />
                          </button>
                          <button
                            onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                            className="text-lg font-bold text-gray-700 min-w-[140px] text-center hover:bg-white/20 rounded-lg px-2 py-1 transition-colors duration-200 flex items-center justify-center gap-2"
                          >
                            <span>{format(selectedDate, 'MMMM yyyy')}</span>
                            <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                            className="p-2 hover:bg-white/30 rounded-full transition-colors duration-200 backdrop-blur-sm"
                          >
                            <Icon icon="solar:map-arrow-right-bold-duotone" className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                        
                        {/* Today Button on right */}
                        <div className="flex justify-end">
                          <button
                          onClick={() => {
                            const today = new Date();
                            setSelectedDate(today);
                            // Only scroll if we're not already looking at the current month
                            if (!isSameMonth(selectedDate, today)) {
                              setTimeout(() => {
                                const todayButton = document.querySelector('[data-is-today="true"]');
                                if (todayButton && calendarScrollRef.current) {
                                  const container = calendarScrollRef.current;
                                  const buttonRect = todayButton.getBoundingClientRect();
                                  const containerRect = container.getBoundingClientRect();
                                  const scrollLeft = buttonRect.left - containerRect.left - (containerRect.width / 2) + (buttonRect.width / 2) + container.scrollLeft;
                                  container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                                }
                              }, 100);
                            }
                          }}
                          className={`px-4 py-2 bg-gradient-to-r ${currentTheme.gradients.button} text-white rounded-xl flex items-center gap-2 hover:shadow-lg transition-colors duration-200 font-medium text-sm`}
                        >
                            <Icon icon="solar:calendar-mark-bold-duotone" className="w-4 h-4" />
                            <span>Today</span>
                          </button>
                        </div>
                      </div>

                      {/* Mobile Layout - Stacked rows for better spacing */}
                      <div className="lg:hidden space-y-3">
                        {/* First Row: Grid/Timeline + Today Button */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center bg-white/30 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-white/20">
                            <button
                              onClick={() => setInternalViewMode('grid')}
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                                internalViewMode === 'grid'
                                  ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                              }`}
                            >
                              <Icon icon="solar:widget-2-bold-duotone" className="h-4 w-4" />
                              <span className="hidden sm:inline">Grid</span>
                            </button>
                            <button
                              onClick={() => setInternalViewMode('timeline')}
                              className={`px-3 py-2 text-sm font-medium rounded-md transition-colors flex items-center gap-2 ${
                                internalViewMode === 'timeline'
                                  ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                              }`}
                            >
                              <Icon icon="solar:calendar-line-duotone" className="h-4 w-4" />
                              <span className="hidden sm:inline">Timeline</span>
                            </button>
                          </div>
                          
                          <button
                          onClick={() => {
                            const today = new Date();
                            setSelectedDate(today);
                            // Only scroll if we're not already looking at the current month
                            if (!isSameMonth(selectedDate, today)) {
                              setTimeout(() => {
                                const todayButton = document.querySelector('[data-is-today="true"]');
                                if (todayButton && calendarScrollRef.current) {
                                  const container = calendarScrollRef.current;
                                  const buttonRect = todayButton.getBoundingClientRect();
                                  const containerRect = container.getBoundingClientRect();
                                  const scrollLeft = buttonRect.left - containerRect.left - (containerRect.width / 2) + (buttonRect.width / 2) + container.scrollLeft;
                                  container.scrollTo({ left: scrollLeft, behavior: 'smooth' });
                                }
                              }, 100);
                            }
                          }}
                          className={`px-3 py-2 bg-gradient-to-r ${currentTheme.gradients.button} text-white rounded-xl flex items-center gap-2 hover:shadow-lg transition-colors duration-200 font-medium text-sm`}
                        >
                            <Icon icon="solar:calendar-mark-bold-duotone" className="w-4 h-4" />
                            <span className="hidden sm:inline">Today</span>
                          </button>
                        </div>

                        {/* Second Row: Calendar Navigation (centered) */}
                        <div className="flex items-center justify-center gap-3">
                          <button
                            onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                            className="p-2 hover:bg-white/30 rounded-full transition-colors duration-200 backdrop-blur-sm"
                          >
                            <Icon icon="solar:map-arrow-left-bold-duotone" className="w-5 h-5 text-gray-600" />
                          </button>
                          <button
                            onClick={() => setShowCalendarPicker(!showCalendarPicker)}
                            className="text-lg font-bold text-gray-700 min-w-[140px] text-center hover:bg-white/20 rounded-lg px-2 py-1 transition-colors duration-200 flex items-center justify-center gap-2"
                          >
                            <span>{format(selectedDate, 'MMMM yyyy')}</span>
                            <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                            className="p-2 hover:bg-white/30 rounded-full transition-colors duration-200 backdrop-blur-sm"
                          >
                            <Icon icon="solar:map-arrow-right-bold-duotone" className="w-5 h-5 text-gray-600" />
                          </button>
                        </div>
                      </div>

                    </div>
                    
                    {/* Month Days - All days in one horizontal row */}
                    <div 
                      ref={calendarScrollRef}
                      className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-transparent"
                    >
                      {eachDayOfInterval({
                        start: startOfMonth(selectedDate),
                        end: endOfMonth(selectedDate)
                      }).map((day) => {
                        const dayIsToday = isToday(day);
                        const dayIsSelected = isSameDay(day, selectedDate);
                        
                        // Check if day has appointments
                        const dayVisits = visits.filter(v => 
                          (v.scheduled_date === format(day, 'yyyy-MM-dd') || 
                           v.visit_date === format(day, 'yyyy-MM-dd')) &&
                          !v.is_cancelled
                        );
                        const hasVisits = dayVisits.length > 0;
                        
                        return (
                          <button
                            key={day.toISOString()}
                            data-is-today={dayIsToday}
                            onClick={() => setSelectedDate(day)}
                            className={`relative flex flex-col items-center p-3 rounded-2xl transition-colors duration-300 min-w-[4rem] flex-shrink-0 ${
                              dayIsSelected
                                ? `bg-gradient-to-br ${currentTheme.gradients.sidebar} shadow-lg backdrop-blur-sm text-white`
                                : dayIsToday
                                ? 'bg-white/40 backdrop-blur-sm shadow-md'
                                : 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
                            }`}
                            style={{
                              borderRadius: '20px',
                            }}
                          >
                            {/* Date number */}
                            <div 
                              className={`text-lg font-bold mb-1 ${
                                dayIsSelected
                                  ? 'text-white' 
                                  : 'text-gray-700'
                              }`}
                            >
                              {format(day, 'd')}
                            </div>
                            
                            {/* Day name */}
                            <div 
                              className={`text-xs font-medium mb-1 ${
                                dayIsSelected
                                  ? 'text-white/80'
                                  : 'text-gray-500/70'
                              }`}
                            >
                              {format(day, 'EEE')}
                            </div>
                            
                            {/* Visit indicators - only show if not selected */}
                            {hasVisits && !dayIsSelected && (
                              <div className="flex gap-0.5 mt-1">
                                {dayVisits.slice(0, 3).map((v, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      v.status === 'completed' 
                                        ? 'bg-green-400' 
                                        : v.is_scheduled && !v.is_confirmed
                                        ? 'bg-amber-400'
                                        : v.is_cancelled
                                        ? 'bg-red-400'
                                        : 'bg-blue-400'
                                    }`}
                                  />
                                ))}
                                {dayVisits.length > 3 && (
                                  <div className="text-xs text-gray-500 ml-1">
                                    +{dayVisits.length - 3}
                                  </div>
                                )}
                              </div>
                            )}
                            
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Appointment Schedule */}
                  <div className="mt-4">
                    <div className="bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50">
                      {/* Appointment Scheduler */}
                      <div>
                        <PremiumAppointmentScheduler
                          onEditVisit={(visit) => {
                            console.log('[Dashboard] onEditVisit called with visit:', visit);
                            if (!visit.patient_id) {
                              console.error('[Dashboard] No patient_id in visit:', visit);
                              toast.error('Cannot open visit - patient information missing');
                              return;
                            }
                            setEditingVisitId(visit.id);
                            setIsEditVisitModalOpen(true);
                          }}
                          appointments={visits.map(v => {
                            // Debug logging for website bookings
                            if (v.is_from_website) {
                              console.log('Dashboard: Website booking visit:', {
                                id: v.id,
                                status: v.status,
                                is_confirmed: v.is_confirmed,
                                is_from_website: v.is_from_website,
                                scheduled_date: v.scheduled_date,
                                scheduled_time: v.scheduled_time
                              });
                            }
                            return {
                            id: v.id,
                            patient: v.patient || {
                              id: v.patient_id,
                              first_name: 'Unknown',
                              last_name: 'Patient'
                            },
                            patient_id: v.patient_id,
                            doctor_id: v.doctor_id || '',
                            date: v.scheduled_date || v.visit_date || format(new Date(), 'yyyy-MM-dd'),
                            time: v.scheduled_time || v.visit_time || '09:00',
                            duration: 30,
                            type: (v.visit_type || 'consultation') as any,
                            status: v.is_cancelled ? 'cancelled' : 
                                   v.status === 'completed' ? 'completed' :
                                   v.status === 'in-progress' ? 'in-progress' :
                                   v.is_ready ? 'ready' :
                                   v.is_checked_in ? 'ready' :
                                   v.status === 'scheduled' ? 'scheduled' : 'pending',
                            notes: v.chief_complaint || v.notes,
                            is_checked_in: v.is_checked_in || false,
                            is_ready: v.is_ready || false,
                            is_confirmed: v.is_confirmed || false,
                            is_cancelled: v.is_cancelled || false,
                            is_handoff: v.is_handoff || false,
                            is_from_website: v.is_from_website || false
                          };})} // Transform visits to appointments format
                          visits={visits.map(v => ({
                            id: v.id,
                            patient_id: v.patient_id,
                            doctor_id: v.doctor_id || '',
                            scheduled_date: v.scheduled_date,
                            scheduled_time: v.scheduled_time,
                            visit_date: v.visit_date,
                            visit_time: v.visit_time,
                            is_cancelled: v.is_cancelled || false
                          }))} // Pass raw visits for time slot blocking
                          doctors={doctors}
                          blockedTimes={[]}
                          isLoading={isLoading}
                          error={error}
                          selectedDate={selectedDate}
                          onDateChange={setSelectedDate}
                          onAppointmentClick={(apt) => {
                            // Navigate to patient page on encounters tab
                            if (apt.patient_id) {
                              navigate(`/patients/${apt.patient_id}?tab=encounters`);
                            }
                          }}
                          onEditAppointment={async (appointment) => {
                            setEditingAppointment(appointment);
                            setIsEditAppointmentModalOpen(true);
                          }}
                          onCreateAppointment={async (appointmentData) => {
                            // appointmentData is the full appointment object
                            const visitData = {
                              patient_id: appointmentData.patient_id,
                              doctor_id: appointmentData.doctor_id,
                              scheduled_date: appointmentData.date,
                              scheduled_time: appointmentData.time,
                              visit_type: appointmentData.type,
                              chief_complaint: appointmentData.notes,
                              is_scheduled: true,
                              is_confirmed: false,
                              practice_id: currentPracticeId
                            };
                            const { addVisit } = useVisitsStore.getState();
                            await addVisit(visitData);
                            return appointmentData; // Return appointment data for compatibility
                          }}
                          viewMode={viewMode}
                          onBlockTime={(doctorId, startTime, endTime, reason) => {
                          }}
                          onDeleteAppointment={async (appointmentId) => {
                            const { deleteVisit } = useVisitsStore.getState();
                            await deleteVisit(appointmentId);
                          }}
                          currentUserRole={currentUserRole}
                          currentUserId={currentUserId}
                          onRefresh={() => {
                            if (currentPracticeId) {
                              const formattedDate = format(selectedDate, 'yyyy-MM-dd');
                              fetchVisits({ 
                                date: formattedDate, 
                                practiceId: currentPracticeId 
                              });
                            }
                          }}
                          internalViewMode={internalViewMode}
                          onInternalViewModeChange={setInternalViewMode}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Notifications Panel and Practice Overview - Hidden on mobile/tablet, 4 columns on desktop */}
                <div className="relative col-span-4 space-y-4 hidden lg:block">
                  <NotificationsPanel
                    notifications={notifications}
                    onNotificationAction={(notificationId, action) => {
                      // Handle notification actions here
                    }}
                    onMarkAsRead={(notificationId) => {
                      setNotifications(prev => 
                        prev.map(notif => 
                          notif.id === notificationId 
                            ? { ...notif, read: true }
                            : notif
                        )
                      );
                    }}
                    onMarkAllAsRead={() => {
                      setNotifications(prev => 
                        prev.map(notif => ({ ...notif, read: true }))
                      );
                    }}
                  />

                  {/* Practice Overview */}
                  <PracticeOverviewTile
                    totalPatients={patientsData.length}
                    todayAppointments={todayAppointments.length}
                    pendingAppointments={pendingAppointments.length}
                    completedToday={completedToday}
                    practiceStatus={pendingAppointments.length > 5 ? 'busy' : todayAppointments.length === 0 ? 'quiet' : 'operational'}
                  />
                </div>
              </div>
            </div>
            
            {/* Mobile Notifications Section - Only visible on mobile/tablet */}
            <div className="mt-6 lg:hidden">
              <div className="space-y-4">
                <NotificationsPanel
                  notifications={notifications}
                  onNotificationAction={(notificationId, action) => {
                    // Handle notification actions here
                  }}
                  onMarkAsRead={(notificationId) => {
                    setNotifications(prev => 
                      prev.map(notif => 
                        notif.id === notificationId 
                          ? { ...notif, read: true }
                          : notif
                      )
                    );
                  }}
                  onMarkAllAsRead={() => {
                    setNotifications(prev => 
                      prev.map(notif => ({ ...notif, read: true }))
                    );
                  }}
                />

                {/* Mobile Practice Overview */}
                <PracticeOverviewTile
                  totalPatients={patientsData.length}
                  todayAppointments={todayAppointments.length}
                  pendingAppointments={pendingAppointments.length}
                  completedToday={completedToday}
                  practiceStatus={pendingAppointments.length > 5 ? 'busy' : todayAppointments.length === 0 ? 'quiet' : 'operational'}
                />
              </div>
            </div>
          </div>
        </div>

      

      </div>

      {/* Modals */}
      <FormModal
        isOpen={isAddAppointmentModalOpen}
        onClose={() => {
          setIsAddAppointmentModalOpen(false);
          setSelectedTimeSlot(null);
        }}
        title="Schedule New Appointment"
      >
        <PremiumAddAppointmentForm
          initialDate={selectedTimeSlot ? new Date(selectedTimeSlot.date) : undefined}
          initialTime={selectedTimeSlot?.time}
          initialDoctorId={selectedTimeSlot?.doctorId}
          onSuccess={(newVisit) => {
            setIsAddAppointmentModalOpen(false);
            setSelectedTimeSlot(null);
            
            // The form already creates a visit in the visits table
            // So we just need to refresh the visits list
            if (newVisit && currentPracticeId) {
              fetchTodayVisits(currentPracticeId);
            }
          }}
          onCancel={() => {
            setIsAddAppointmentModalOpen(false);
            setSelectedTimeSlot(null);
          }}
        />
      </FormModal>

      {selectedAppointment && (
        <>
          <AppointmentDetailsModal
            isOpen={isDetailsModalOpen}
            onClose={() => {
              setIsDetailsModalOpen(false);
              setSelectedAppointment(null);
            }}
            appointment={selectedAppointment}
            onEdit={() => {
              setIsDetailsModalOpen(false);
              setIsRescheduleModalOpen(true);
            }}
          />

          <RescheduleAppointmentModal
            isOpen={isRescheduleModalOpen}
            onClose={() => {
              setIsRescheduleModalOpen(false);
              setSelectedAppointment(null);
            }}
            appointment={{
              id: selectedAppointment.id,
              patient_name: `${selectedAppointment.patient?.first_name} ${selectedAppointment.patient?.last_name}`,
              doctor_id: selectedAppointment.doctor_id,
              doctor_name: doctors.find(d => d.id === selectedAppointment.doctor_id)?.user_metadata?.full_name || 'Unknown Doctor',
              date: selectedAppointment.date,
              time: selectedAppointment.time,
              type: selectedAppointment.type
            }}
            onReschedule={async () => {
              setIsRescheduleModalOpen(false);
              setSelectedAppointment(null);
              // Real-time updates will handle the refresh
            }}
          />

          <AppointmentActionModal
            isOpen={isActionModalOpen}
            onClose={() => {
              setIsActionModalOpen(false);
              setSelectedAppointment(null);
            }}
            appointment={selectedAppointment}
            onUpdate={() => {
              setIsActionModalOpen(false);
              setSelectedAppointment(null);
              // Real-time updates will handle the refresh
            }}
            currentUserRole={currentUserRole}
            onStartVisit={handleStartVisit}
            onCompleteVisit={handleCompleteVisit}
            onEditAppointment={(_appointment) => {
              setIsActionModalOpen(false);
              setIsRescheduleModalOpen(true);
            }}
          />
        </>
      )}

      {/* Appointment Approval Modal */}
      {isApprovalModalOpen && selectedAppointment && (
        <AppointmentApprovalModal
          isOpen={isApprovalModalOpen}
          onClose={() => {
            setIsApprovalModalOpen(false);
            setSelectedAppointment(null);
          }}
          appointment={selectedAppointment}
          onApprove={async () => {
            const visit = visits.find(v => v.id === selectedAppointment.id);
            if (visit) {
              await handleConfirmVisit(visit.id);
            }
            setIsApprovalModalOpen(false);
            setSelectedAppointment(null);
          }}
          onReject={async (reason) => {
            const visit = visits.find(v => v.id === selectedAppointment.id);
            if (visit) {
              await handleRejectVisit(visit.id, reason);
            }
            setIsApprovalModalOpen(false);
            setSelectedAppointment(null);
          }}
          onReschedule={() => {
            setIsApprovalModalOpen(false);
            setIsRescheduleModalOpen(true);
          }}
        />
      )}

      {/* Appointment Grid View */}
      {showGridView && currentPracticeId && (
        <AppointmentGridView
          status={gridViewStatus}
          practiceId={currentPracticeId}
          onClose={() => setShowGridView(false)}
        />
      )}

      {/* Add Visit Modal (keeping for direct visit creation) */}
      {isAddVisitModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Schedule New Visit</h2>
                <button
                  onClick={() => setIsAddVisitModalOpen(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              <AddScheduledVisitForm
                practiceId={currentPracticeId || ''}
                onSuccess={() => {
                  setIsAddVisitModalOpen(false);
                  toast.success('Visit scheduled successfully');
                }}
                onCancel={() => setIsAddVisitModalOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Visit Confirmation Modal */}
      {isConfirmationModalOpen && selectedVisit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Confirm Visit</h3>
              <p className="text-gray-600 mb-6">
                Confirm visit for {selectedVisit.patient?.first_name} {selectedVisit.patient?.last_name} 
                on {format(new Date(selectedVisit.scheduled_date + 'T' + selectedVisit.scheduled_time), 'MMM d, h:mm a')}?
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setIsConfirmationModalOpen(false);
                    setSelectedVisit(null);
                  }}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConfirmVisit(selectedVisit.id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Confirm
                </button>
                <button
                  onClick={() => handleRejectVisit(selectedVisit.id, 'Rejected by practice')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Visit Details Modal */}
      {isDetailsModalOpen && selectedVisit && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Visit Details</h2>
                <button
                  onClick={() => {
                    setIsDetailsModalOpen(false);
                    setSelectedVisit(null);
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
                </button>
              </div>
              {/* Visit details content */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium text-gray-700">Patient</h4>
                  <p className="text-gray-900">{selectedVisit.patient?.first_name} {selectedVisit.patient?.last_name}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Date & Time</h4>
                  <p className="text-gray-900">
                    {format(new Date(selectedVisit.scheduled_date + 'T' + selectedVisit.scheduled_time), 'MMMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Type</h4>
                  <p className="text-gray-900">{selectedVisit.visit_type || 'Consultation'}</p>
                </div>
                <div>
                  <h4 className="font-medium text-gray-700">Status</h4>
                  <p className="text-gray-900">
                    {selectedVisit.is_cancelled ? 'Cancelled' : 
                     selectedVisit.status === 'completed' ? 'Completed' :
                     selectedVisit.is_ready ? 'Ready' :
                     selectedVisit.is_checked_in ? 'Checked In' :
                     selectedVisit.is_confirmed ? 'Confirmed' :
                     'Unconfirmed'}
                  </p>
                </div>
                {selectedVisit.chief_complaint && (
                  <div>
                    <h4 className="font-medium text-gray-700">Chief Complaint</h4>
                    <p className="text-gray-900">{selectedVisit.chief_complaint}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Report Modal */}
      {selectedReportModal.isOpen && selectedReportModal.type && (
        <DetailedReportModal
          isOpen={selectedReportModal.isOpen}
          onClose={() => {
            setSelectedReportModal({ isOpen: false, type: null });
          }}
          data={dashboardStats ? generateReportData(selectedReportModal.type, dashboardStats) : {
            type: selectedReportModal.type,
            title: 'Loading...',
            subtitle: 'Please wait while we load the data',
            overview: { total: 0, change: 'Loading...', isPositive: true, period: 'N/A' },
            breakdown: [],
            chartData: { labels: [], datasets: [] },
            timeSeriesData: { labels: [], datasets: [] },
            insights: ['Loading data...'],
            actionItems: ['Please wait...']
          }}
        />
      )}

      {/* Enhanced Financial Modal */}
      {isEnhancedFinancialModalOpen && (
        <EnhancedFinancialModal
          isOpen={isEnhancedFinancialModalOpen}
          onClose={() => {
            setIsEnhancedFinancialModalOpen(false);
          }}
          data={dashboardStats ? generateFinancialReportData(dashboardStats) : {
            type: 'finance' as const,
            title: 'Financial Overview',
            subtitle: 'Loading financial data...',
            overview: { total: 0, change: 'Loading...', isPositive: true, period: 'N/A' },
            breakdown: [],
            chartData: { labels: [], datasets: [] },
            timeSeriesData: { labels: [], datasets: [] },
            insights: ['Loading financial data...'],
            actionItems: ['Please wait...']
          }}
        />
      )}


      {/* Calendar Picker Modal - Rendered as Portal */}
      {showCalendarPicker && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center">
          {/* Modal Backdrop */}
          <div 
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              setShowCalendarPicker(false);
              setShowYearDropdown(false);
              setShowMonthDropdown(false);
            }}
          />
          
          {/* Calendar Modal */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="relative bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 mx-4 w-full max-w-[380px]"
            onClick={(e) => {
              e.stopPropagation();
              // Close dropdowns when clicking elsewhere in modal
              setShowYearDropdown(false);
              setShowMonthDropdown(false);
            }}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-gray-900">Select Date</h3>
              <button
                onClick={() => {
                  setShowCalendarPicker(false);
                  setShowYearDropdown(false);
                  setShowMonthDropdown(false);
                }}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* View Mode Toggles */}
            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                {['day', 'week', 'month'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode as any)}
                    className={`px-4 py-2 text-sm font-medium rounded-md transition-colors capitalize ${
                      viewMode === mode
                        ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                        : 'text-gray-600 hover:text-gray-900 hover:bg-white'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Month/Year Navigation */}
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => setSelectedDate(subMonths(selectedDate, 1))}
                className="p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:map-arrow-left-bold-duotone" className="w-5 h-5 text-gray-700" />
              </button>
              
              {/* Month and Year Dropdowns */}
              <div className="flex items-center gap-2">
                {/* Month Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setShowMonthDropdown(!showMonthDropdown);
                      setShowYearDropdown(false);
                    }}
                    className="px-4 py-2 text-lg font-bold text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {format(selectedDate, 'MMMM')}
                    <Icon icon="solar:alt-arrow-down-bold-duotone" className={`w-4 h-4 transition-transform ${showMonthDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showMonthDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px] max-h-[200px] overflow-y-auto">
                      {Array.from({ length: 12 }, (_, i) => {
                        const monthDate = new Date(selectedDate.getFullYear(), i, 1);
                        return (
                          <button
                            key={i}
                            onClick={() => {
                              setSelectedDate(new Date(selectedDate.getFullYear(), i, selectedDate.getDate()));
                              setShowMonthDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${
                              i === selectedDate.getMonth() ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {format(monthDate, 'MMMM')}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
                
                {/* Year Dropdown */}
                <div className="relative" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => {
                      setShowYearDropdown(!showYearDropdown);
                      setShowMonthDropdown(false);
                    }}
                    className="px-4 py-2 text-lg font-bold text-gray-800 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-2"
                  >
                    {format(selectedDate, 'yyyy')}
                    <Icon icon="solar:alt-arrow-down-bold-duotone" className={`w-4 h-4 transition-transform ${showYearDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showYearDropdown && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[100px] max-h-[200px] overflow-y-auto">
                      {Array.from({ length: 100 }, (_, i) => {
                        const year = new Date().getFullYear() - 50 + i;
                        return (
                          <button
                            key={year}
                            onClick={() => {
                              setSelectedDate(new Date(year, selectedDate.getMonth(), selectedDate.getDate()));
                              setShowYearDropdown(false);
                            }}
                            className={`w-full px-4 py-2 text-left hover:bg-gray-100 transition-colors ${
                              year === selectedDate.getFullYear() ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-gray-700'
                            }`}
                          >
                            {year}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              
              <button
                onClick={() => setSelectedDate(addMonths(selectedDate, 1))}
                className="p-3 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:map-arrow-right-bold-duotone" className="w-5 h-5 text-gray-700" />
              </button>
            </div>
            
            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2 mb-6">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
                <div key={day} className="text-sm font-semibold text-gray-500 text-center py-3">
                  {day}
                </div>
              ))}
              {eachDayOfInterval({
                start: startOfMonth(selectedDate),
                end: endOfMonth(selectedDate)
              }).map((day) => {
                const dayIsToday = isToday(day);
                const dayIsSelected = isSameDay(day, selectedDate);
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => {
                      setSelectedDate(day);
                      setShowCalendarPicker(false);
                      setShowYearDropdown(false);
                      setShowMonthDropdown(false);
                    }}
                    className={`h-12 w-12 text-sm rounded-xl transition-colors duration-200 font-medium flex items-center justify-center ${
                      dayIsSelected
                        ? `bg-gradient-to-r ${currentTheme.gradients.button} text-white font-bold shadow-lg scale-110`
                        : dayIsToday
                        ? 'bg-blue-100 text-blue-800 font-bold border-2 border-blue-400'
                        : 'hover:bg-gray-100 text-gray-700 hover:scale-105'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                );
              })}
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedDate(new Date());
                  setShowCalendarPicker(false);
                  setShowYearDropdown(false);
                  setShowMonthDropdown(false);
                }}
                className={`flex-1 px-4 py-3 text-sm bg-gradient-to-r ${currentTheme.gradients.button} text-white rounded-xl transition-colors font-semibold hover:shadow-lg`}
              >
                Today
              </button>
              <button
                onClick={() => {
                  setShowCalendarPicker(false);
                  setShowYearDropdown(false);
                  setShowMonthDropdown(false);
                }}
                className="flex-1 px-4 py-3 text-sm bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors font-semibold"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>,
        document.body
      )}

      {/* Enhanced Patient Modal - Commented out as we now navigate to patients page */}
      {/* <ComprehensivePatientModal
        isOpen={isPatientModalOpen}
        onClose={() => {
          setIsPatientModalOpen(false);
          setSelectedPatientId(null);
          setDefaultDetailTab('overview');
        }}
        patientId={selectedPatientId}
        defaultDetailTab={defaultDetailTab}
      /> */}

      {/* Floating Visit Tracker */}
      {currentPracticeId && (
        <FloatingVisitTracker 
          practiceId={currentPracticeId} 
          selectedDate={selectedDate} 
          disablePatientModal={true}
          onOpenPatientModal={(patientId, defaultTab) => {
            // Navigate to patient page with optional tab parameter
            navigate(`/patients/${patientId}?tab=${defaultTab || 'overview'}`);
          }}
        />
      )}

      {/* Full Screen Edit Visit Modal */}
      {editingVisitId && (
        <FullScreenEditVisitModal
          isOpen={isEditVisitModalOpen}
          onClose={() => {
            setIsEditVisitModalOpen(false);
            setEditingVisitId(null);
          }}
          visitId={editingVisitId}
          patientId={visits.find(v => v.id === editingVisitId)?.patient_id || ''}
          onSuccess={() => {
            setIsEditVisitModalOpen(false);
            setEditingVisitId(null);
            // Refresh visits
            if (currentPracticeId) {
              fetchTodayVisits(currentPracticeId);
            }
          }}
        />
      )}

      {/* Edit Appointment Modal */}
      <FormModal
        isOpen={isEditAppointmentModalOpen}
        onClose={() => {
          setIsEditAppointmentModalOpen(false);
          setEditingAppointment(null);
        }}
        title="Edit Appointment"
      >
        <PremiumAddAppointmentForm
          initialPatientId={editingAppointment?.patient_id}
          initialDate={editingAppointment ? new Date(editingAppointment.date) : undefined}
          initialTime={editingAppointment?.time}
          initialDoctorId={editingAppointment?.doctor_id}
          initialType={editingAppointment?.type}
          initialDuration={editingAppointment?.duration}
          initialNotes={editingAppointment?.notes}
          editingAppointmentId={editingAppointment?.id}
          onSuccess={() => {
            setIsEditAppointmentModalOpen(false);
            setEditingAppointment(null);
            // Refresh visits
            if (currentPracticeId) {
              fetchTodayVisits(currentPracticeId);
            }
          }}
          onCancel={() => {
            setIsEditAppointmentModalOpen(false);
            setEditingAppointment(null);
          }}
        />
      </FormModal>
      
    </div>
  );
}

// Helper function to generate financial report data
function generateFinancialReportData(stats: DashboardStats) {
  return {
    type: 'finance' as const,
    title: 'Financial Overview',
    subtitle: 'Revenue analysis and payment tracking',
    overview: {
      total: stats.finance.totalRevenue,
      change: `N$${(stats.finance.thisMonth / 1000).toFixed(1)}k`,
      isPositive: stats.finance.thisMonth > 0,
      period: 'This Month'
    },
    breakdown: [
      { label: 'Total Revenue', value: stats.finance.totalRevenue, percentage: 100, color: '#8B5CF6' },
      { label: 'This Month', value: stats.finance.thisMonth, percentage: Math.round((stats.finance.thisMonth / stats.finance.totalRevenue) * 100), color: '#7C3AED' },
      { label: 'Outstanding', value: stats.finance.outstanding, percentage: Math.round((stats.finance.outstanding / stats.finance.totalRevenue) * 100), color: '#EF4444' },
      { label: 'Collection Rate', value: Math.round(((stats.finance.totalRevenue - stats.finance.outstanding) / stats.finance.totalRevenue) * 100), percentage: Math.round(((stats.finance.totalRevenue - stats.finance.outstanding) / stats.finance.totalRevenue) * 100), color: '#10B981' }
    ],
    chartData: {
      labels: stats.finance.paymentMethods.map(p => p.method),
      datasets: [{
        label: 'Payment Methods',
        data: stats.finance.paymentMethods.map(p => p.amount)
      }]
    },
    timeSeriesData: {
      labels: ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'],
      datasets: [{
        label: 'Monthly Revenue',
        data: stats.finance.revenueData
      }]
    },
    insights: [
      `N$${(stats.finance.outstanding / 1000).toFixed(1)}k in outstanding payments needs collection`,
      `Average monthly revenue: N$${(stats.finance.totalRevenue / 6 / 1000).toFixed(1)}k`,
      `${stats.finance.paidInvoices} invoices paid vs ${stats.finance.unpaidInvoices} unpaid`,
      `Most popular payment method: ${stats.finance.paymentMethods && stats.finance.paymentMethods[0] ? stats.finance.paymentMethods[0].method : 'Cash'}`
    ],
    actionItems: [
      'Follow up on outstanding payments',
      'Send payment reminders to overdue accounts',
      'Review and optimize payment processes'
    ]
  };
}

// Helper function to generate report data
function generateReportData(type: 'patients' | 'notifications' | 'encounters' | 'finance', stats: DashboardStats) {
  switch (type) {
    case 'patients':
        return {
          type: 'patients' as const,
          title: 'Patient Analytics',
          subtitle: 'Comprehensive patient demographics and growth analysis',
          overview: {
            total: stats.patients.total,
            change: `+${stats.patients.newThisMonth}`,
            isPositive: stats.patients.newThisMonth > 0,
            period: 'This Month'
          },
          breakdown: [
            { label: 'Male Patients', value: stats.patients.male, percentage: Math.round((stats.patients.male / stats.patients.total) * 100), color: '#3B82F6' },
            { label: 'Female Patients', value: stats.patients.female, percentage: Math.round((stats.patients.female / stats.patients.total) * 100), color: '#06B6D4' },
            { label: 'New This Month', value: stats.patients.newThisMonth, percentage: Math.round((stats.patients.newThisMonth / stats.patients.total) * 100), color: '#10B981' },
            { label: 'Top Medical Aid', value: stats.patients.topMedicalAids[0]?.count || 0, percentage: Math.round(((stats.patients.topMedicalAids[0]?.count || 0) / stats.patients.total) * 100), color: '#8B5CF6' }
          ],
          chartData: {
            labels: ['Male', 'Female', 'New This Month', 'Average Age'],
            datasets: [{
              label: 'Patient Statistics',
              data: [stats.patients.male, stats.patients.female, stats.patients.newThisMonth, stats.patients.averageAge]
            }]
          },
          timeSeriesData: {
            labels: ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'],
            datasets: [{
              label: 'Patient Growth',
              data: stats.patients.growthData
            }]
          },
          insights: [
            `You have ${stats.patients.total} total patients with an average age of ${stats.patients.averageAge} years`,
            `${stats.patients.newThisMonth} new patients registered this month, showing ${stats.patients.newThisMonth > 0 ? 'positive' : 'stable'} growth`,
            `Gender distribution: ${Math.round((stats.patients.male / stats.patients.total) * 100)}% male, ${Math.round((stats.patients.female / stats.patients.total) * 100)}% female`,
            stats.patients.topMedicalAids.length > 0 ? `Top medical aid provider: ${stats.patients.topMedicalAids[0].name} (${stats.patients.topMedicalAids[0].count} patients)` : 'No medical aid data available'
          ],
          actionItems: [
            'Review patient demographics for targeted care programs',
            'Follow up with new patients for satisfaction surveys',
            'Analyze medical aid coverage for billing optimization'
          ]
        };

      case 'notifications':
        return {
          type: 'notifications' as const,
          title: 'Notifications Dashboard',
          subtitle: 'Active alerts and communication overview',
          overview: {
            total: stats.notifications.total,
            change: `${stats.notifications.unread} unread`,
            isPositive: false,
            period: 'Active Now'
          },
          breakdown: stats.notifications.types.map(type => ({
            label: type.type,
            value: type.count,
            percentage: Math.round((type.count / stats.notifications.total) * 100),
            color: type.color
          })),
          chartData: {
            labels: stats.notifications.types.map(t => t.type),
            datasets: [{
              label: 'Notification Types',
              data: stats.notifications.types.map(t => t.count)
            }]
          },
          timeSeriesData: {
            labels: ['6d ago', '5d ago', '4d ago', '3d ago', '2d ago', 'Yesterday', 'Today'],
            datasets: [{
              label: 'Daily Notifications',
              data: stats.notifications.weeklyData
            }]
          },
          insights: [
            `${stats.notifications.unread} unread notifications require attention`,
            `${stats.notifications.urgent} urgent notifications need immediate action`,
            `Peak notification day this week: ${Math.max(...stats.notifications.weeklyData)} notifications`,
            `Most common notification type: ${stats.notifications.types[0]?.type || 'None'}`
          ],
          actionItems: [
            'Review and clear unread notifications',
            'Address urgent notifications immediately',
            'Set up notification filters to reduce noise'
          ]
        };

      case 'encounters':
        return {
          type: 'encounters' as const,
          title: 'Patient Encounters',
          subtitle: 'Visit analytics and encounter management',
          overview: {
            total: stats.encounters.total,
            change: `+${stats.encounters.thisMonth}`,
            isPositive: stats.encounters.thisMonth > 0,
            period: 'This Month'
          },
          breakdown: [
            { label: 'Total Encounters', value: stats.encounters.total, percentage: 100, color: '#10B981' },
            { label: 'This Month', value: stats.encounters.thisMonth, percentage: Math.round((stats.encounters.thisMonth / stats.encounters.total) * 100), color: '#059669' },
            { label: 'Completed', value: stats.encounters.completed, percentage: Math.round((stats.encounters.completed / stats.encounters.total) * 100), color: '#047857' },
            { label: 'Pending', value: stats.encounters.pending, percentage: Math.round((stats.encounters.pending / stats.encounters.total) * 100), color: '#F59E0B' }
          ],
          chartData: {
            labels: stats.encounters.types.map(t => t.type),
            datasets: [{
              label: 'Encounter Types',
              data: stats.encounters.types.map(t => t.count)
            }]
          },
          timeSeriesData: {
            labels: ['6mo ago', '5mo ago', '4mo ago', '3mo ago', '2mo ago', 'Last month'],
            datasets: [{
              label: 'Monthly Encounters',
              data: stats.encounters.monthlyData
            }]
          },
          insights: [
            `${stats.encounters.completed} encounters completed with ${stats.encounters.pending} still pending`,
            `Average encounters per month: ${Math.round(stats.encounters.total / 6)}`,
            `Most common encounter type: ${stats.encounters.types[0]?.type || 'Consultation'}`,
            `Completion rate: ${Math.round((stats.encounters.completed / stats.encounters.total) * 100)}%`
          ],
          actionItems: [
            'Follow up on pending encounters',
            'Review encounter efficiency metrics',
            'Schedule follow-up appointments as needed'
          ]
        };

    case 'finance':
      return generateFinancialReportData(stats);

    default:
      throw new Error(`Unknown report type: ${type}`);
  }
}

export default Dashboard;