import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Calendar,
  Microscope,
  AlertCircle,
  Plus,
  Pill,
  CheckCircle2,
  UserCheck,
  MessageSquare,
  Zap,
  ChevronRight,
  Bell,
  DollarSign,
  TrendingUp,
  Expand,
  Minimize,
  Building2,
  XCircle,
  Moon,
  Sun
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { practiceDataService } from '../lib/practiceDataService';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';
import PremiumAppointmentScheduler from '../components/PremiumAppointmentScheduler';
import AppointmentDetailsModal from '../components/modals/AppointmentDetailsModal';
import RescheduleAppointmentModal from '../components/modals/RescheduleAppointmentModal';
import AppointmentActionModal from '../components/modals/AppointmentActionModal';
import AppointmentApprovalModal from '../components/modals/AppointmentApprovalModal';
import AppointmentGridView from '../components/appointments/AppointmentGridView';
import { motion } from 'framer-motion';
import { useRealtimeAppointments } from '../hooks/useRealtimeAppointments';
import { toast } from 'react-hot-toast';
import { NotificationsPanel, Notification } from '../components/dashboard/NotificationsPanel';
import PremiumStatCard from '../components/dashboard/PremiumStatCard';
import DetailedReportModal from '../components/modals/DetailedReportModal';
import EnhancedFinancialModal from '../components/modals/EnhancedFinancialModal';
import PracticeOverviewTile from '../components/dashboard/PracticeOverviewTile';
import { dashboardStatsService, DashboardStats } from '../services/dashboardStatsService';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number?: string;
    date_of_birth?: string;
    gender?: string;
  };
  doctor?: {
    id: string;
    full_name: string;
  };
}

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

function Dashboard() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [labRequests, setLabRequests] = useState<any[]>([]);
  const [mediaRequests, setMediaRequests] = useState<any[]>([]);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isApprovalModalOpen, setIsApprovalModalOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'doctor' | 'nurse' | 'receptionist'>('admin');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [internalViewMode, setInternalViewMode] = useState<'timeline' | 'grid'>('timeline');
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const [showGridView, setShowGridView] = useState(false);
  const [gridViewStatus, setGridViewStatus] = useState<'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'in-progress'>('pending');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [selectedReportModal, setSelectedReportModal] = useState<{
    isOpen: boolean;
    type: 'patients' | 'notifications' | 'encounters' | 'finance' | null;
  }>({ isOpen: false, type: null });
  const [isEnhancedFinancialModalOpen, setIsEnhancedFinancialModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [appointmentStatusFilter, setAppointmentStatusFilter] = useState<'all' | 'total' | 'completed' | 'pending' | 'cancelled'>('all');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const navigate = useNavigate();

  // Real-time appointment updates
  useRealtimeAppointments({
    practiceId: currentPracticeId,
    onAppointmentChange: (change) => {
      console.log('📡 Real-time change:', change);
      
      if (change.eventType === 'INSERT') {
        // New appointment - add to list and show notification
        setAppointments(prev => [...prev, change.new]);
        toast.success(`New appointment for ${change.new.patient?.first_name} ${change.new.patient?.last_name}`, {
          duration: 5000,
          position: 'top-right',
          icon: '📅'
        });
        
        // Update recent activities
        const newActivity: ActivityItem = {
          id: `act-${Date.now()}`,
          type: 'appointment',
          message: 'New appointment booked',
          details: `${change.new.patient?.first_name} ${change.new.patient?.last_name} - ${change.new.type}`,
          time: 'Just now',
          icon: Calendar,
          color: 'text-blue-600'
        };
        setRecentActivities(prev => [newActivity, ...prev.slice(0, 4)]);
      } else if (change.eventType === 'UPDATE') {
        // Updated appointment - update in list
        setAppointments(prev => 
          prev.map(apt => apt.id === change.new.id ? change.new : apt)
        );
        
        // Show notification if status changed
        if (change.old.status !== change.new.status) {
          const statusMessages: Record<string, string> = {
            'scheduled': 'Appointment approved',
            'in-progress': 'Visit started',
            'completed': 'Visit completed',
            'cancelled': 'Appointment cancelled',
            'no-show': 'Marked as no-show'
          };
          
          toast(statusMessages[change.new.status] || 'Appointment updated', {
            duration: 4000,
            position: 'top-right',
            icon: change.new.status === 'cancelled' ? '❌' : '✅'
          });
        }
      } else if (change.eventType === 'DELETE') {
        // Deleted appointment - remove from list
        setAppointments(prev => prev.filter(apt => apt.id !== change.old.id));
      }
    },
    onError: (error) => {
      console.error('Real-time error:', error);
    }
  });

  const fetchData = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 [Dashboard] Starting fetchData');
      
      // Get authenticated user context
      const authContext = await practiceDataService.getAuthContext();
      if (!authContext) {
        console.log('❌ [Dashboard] No valid auth context');
        setError(new Error('Authentication failed'));
        return;
      }

      console.log('✅ [Dashboard] Auth context established', authContext);
      setCurrentUserId(authContext.userId);
      setCurrentUserRole(authContext.userRole as any);
      setCurrentPracticeId(authContext.practiceId);

      // Debug practice data
      const debugData = await practiceDataService.debugPracticeData(authContext.practiceId);
      console.log('🐛 [Dashboard] Debug data:', debugData);

      // Use robust practice data service
      const practiceAppointments = await practiceDataService.getPracticeAppointments(authContext.practiceId);
      const practicePatients = await practiceDataService.getPracticePatients(authContext.practiceId);
      const practiceDoctors = await practiceDataService.getPracticeDoctors(authContext.practiceId);

      console.log('✅ [Dashboard] Final results:', {
        appointments: practiceAppointments.length,
        patients: practicePatients.length,
        doctors: practiceDoctors.length,
        practiceId: authContext.practiceId
      });

      // Get unique patient IDs for lab/media requests
      const uniquePatientIds = [...new Set(practiceAppointments.map(apt => apt.patient_id))];

      // Fetch lab requests (only if we have patients)
      let labRequestsData = [];
      if (uniquePatientIds.length > 0) {
        const { data } = await supabase
          .from('lab_requests')
          .select('*')
          .eq('status', 'pending')
          .in('patient_id', uniquePatientIds);
        labRequestsData = data || [];
      }

      // Fetch media requests (only if we have patients)
      let mediaRequestsData = [];
      if (uniquePatientIds.length > 0) {
        const { data } = await supabase
          .from('media_requests')
          .select('*')
          .eq('status', 'pending')
          .in('patient_id', uniquePatientIds);
        mediaRequestsData = data || [];
      }

      // Set state
      setAppointments(practiceAppointments);
      setPatients(practicePatients);
      setLabRequests(labRequestsData);
      setMediaRequests(mediaRequestsData);

      // Format doctors for dropdown
      const formattedDoctors = practiceDoctors.map(doctor => ({
        id: doctor.id,
        email: doctor.email,
        user_metadata: {
          full_name: doctor.full_name,
          role: doctor.role
        }
      }));
      setDoctors(formattedDoctors);

      // Generate recent activities from practice data
      const activities: ActivityItem[] = [];
      
      practiceAppointments.slice(0, 3).forEach((apt) => {
        activities.push({
          id: `apt-${apt.id}`,
          type: 'appointment',
          message: `${apt.patient?.first_name} ${apt.patient?.last_name}`,
          details: `${apt.type} appointment scheduled`,
          time: apt.time ? format(new Date(apt.date + 'T' + apt.time), 'h:mm a') : 'TBD',
          icon: Calendar,
          color: 'text-blue-500'
        });
      });

      labRequestsData.slice(0, 2).forEach((lab) => {
        activities.push({
          id: `lab-${lab.id}`,
          type: 'lab',
          message: 'Lab request pending',
          details: lab.test_name || 'Blood test',
          time: 'Pending',
          icon: Microscope,
          color: 'text-purple-500'
        });
      });

      setRecentActivities(activities);

      // Generate notifications
      const newNotifications: Notification[] = [];

      // Pending appointment bookings that need approval
      const pendingBookings = practiceAppointments.filter(apt => apt.status === 'pending');
      pendingBookings.forEach((apt) => {
        newNotifications.push({
          id: `booking-${apt.id}`,
          type: 'booking',
          priority: 'high',
          title: 'New Booking Request',
          description: `${apt.patient?.first_name} ${apt.patient?.last_name} requested a ${apt.type} appointment for ${format(new Date(apt.date + 'T' + apt.time), 'MMM d, h:mm a')}`,
          time: new Date(apt.created_at || new Date()),
          actionRequired: true,
          read: false,
          data: apt,
          actions: {
            primary: {
              label: 'Approve',
              variant: 'approve',
              onClick: () => {
                setSelectedAppointment(apt);
                setIsApprovalModalOpen(true);
              }
            },
            secondary: {
              label: 'View Details',
              onClick: () => {
                setSelectedAppointment(apt);
                setIsDetailsModalOpen(true);
              }
            }
          }
        });
      });

      // Lab results pending review
      labRequestsData.forEach((lab) => {
        newNotifications.push({
          id: `lab-${lab.id}`,
          type: 'lab-result',
          priority: lab.is_urgent ? 'urgent' : 'normal',
          title: 'Lab Results Ready',
          description: `${lab.test_name || 'Lab test'} results are ready for review`,
          time: new Date(lab.created_at || new Date()),
          actionRequired: true,
          read: false,
          data: lab,
          actions: {
            primary: {
              label: 'Review Results',
              onClick: () => navigate('/requests')
            }
          }
        });
      });

      // Upcoming follow-ups for today
      const todayFollowUps = practiceAppointments.filter(apt => 
        apt.type === 'follow-up' && 
        apt.status === 'scheduled' &&
        apt.date === format(new Date(), 'yyyy-MM-dd')
      );
      todayFollowUps.forEach((apt) => {
        newNotifications.push({
          id: `followup-${apt.id}`,
          type: 'follow-up',
          priority: 'normal',
          title: 'Follow-up Reminder',
          description: `${apt.patient?.first_name} ${apt.patient?.last_name} has a follow-up appointment at ${apt.time ? format(new Date(apt.date + 'T' + apt.time), 'h:mm a') : 'TBD'}`,
          time: new Date(apt.date + 'T' + apt.time),
          actionRequired: false,
          read: false,
          data: apt,
          actions: {
            primary: {
              label: 'Start Visit',
              onClick: () => handleStartVisit(apt.id)
            }
          }
        });
      });

      // Media requests pending
      mediaRequestsData.forEach((media) => {
        newNotifications.push({
          id: `media-${media.id}`,
          type: 'system',
          priority: 'normal',
          title: 'Media Upload Pending',
          description: `${media.request_type || 'Media'} upload requested for patient`,
          time: new Date(media.created_at || new Date()),
          actionRequired: true,
          read: false,
          data: media,
          actions: {
            primary: {
              label: 'Upload Media',
              onClick: () => navigate('/requests')
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

      // Fetch comprehensive dashboard stats
      try {
        const stats = await dashboardStatsService.getComprehensiveStats(authContext.practiceId);
        setDashboardStats(stats);
        console.log('✅ [Dashboard] Stats loaded:', stats);
      } catch (statsError) {
        console.error('❌ [Dashboard] Error loading stats:', statsError);
        // Continue without stats if there's an error
      }

      console.log('✅ [Dashboard] Data fetch complete:', {
        appointmentsSet: practiceAppointments.length,
        patientsSet: practicePatients.length,
        labRequestsSet: labRequestsData.length,
        mediaRequestsSet: mediaRequestsData.length,
        activitiesSet: activities.length,
        notificationsSet: newNotifications.length
      });
      
    } catch (error) {
      console.error('❌ [Dashboard] Error fetching data:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Fullscreen functionality
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);


  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsRescheduleModalOpen(true);
  };

  const [selectedTimeSlot, setSelectedTimeSlot] = useState<{
    doctorId: string;
    date: string;
    time: string;
  } | null>(null);

  const handleCreateAppointment = async (doctorId: string, date: string, time: string) => {
    console.log('Creating appointment for:', { doctorId, date, time });
    setSelectedTimeSlot({ doctorId, date, time });
    setIsAddAppointmentModalOpen(true);
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
      
      if (error) throw error;
      // Real-time updates will handle the refresh
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  const handleApproveAppointment = async (appointmentId: string, doctorId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'scheduled',
          doctor_id: doctorId,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;
      
      setIsApprovalModalOpen(false);
      setSelectedAppointment(null);
      // Real-time updates will handle the refresh
    } catch (error) {
      console.error('Error approving appointment:', error);
      throw error;
    }
  };

  const handleRejectAppointment = async (appointmentId: string, reason?: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'cancelled',
          notes: reason ? `Rejected: ${reason}` : 'Rejected by practice',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) throw error;
      
      setIsApprovalModalOpen(false);
      setSelectedAppointment(null);
      // Real-time updates will handle the refresh
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      throw error;
    }
  };

  const handleStartVisit = async (appointmentId: string) => {
    try {
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        toast.error('Appointment not found');
        return;
      }

      // Start a database transaction by creating visit first
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert([{
          appointment_id: appointmentId,
          patient_id: appointment.patient_id,
          doctor_id: appointment.doctor_id || currentUserId, // Use current doctor if not assigned
          visit_date: appointment.date,
          visit_time: appointment.time,
          visit_type: appointment.type || 'consultation',
          chief_complaint: appointment.notes || 'See appointment notes',
          status: 'in-progress',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (visitError) {
        console.error('Visit creation error:', visitError);
        throw new Error('Failed to create visit record');
      }
      
      // Update appointment status to in-progress
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'in-progress',
          doctor_id: appointment.doctor_id || currentUserId, // Assign doctor if not already assigned
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);
      
      if (updateError) {
        console.error('Appointment update error:', updateError);
        // Try to rollback by deleting the visit
        await supabase.from('visits').delete().eq('id', visit.id);
        throw new Error('Failed to update appointment status');
      }
      
      // Close any open modals
      setIsActionModalOpen(false);
      setIsApprovalModalOpen(false);
      setSelectedAppointment(null);
      
      // Show success message with patient name
      toast.success(
        `Visit started for ${appointment.patient?.first_name} ${appointment.patient?.last_name}`,
        { duration: 3000, icon: '🏥' }
      );
      
      // Add to activity log
      const newActivity: ActivityItem = {
        id: `visit-${Date.now()}`,
        type: 'appointment',
        message: 'Visit started',
        details: `${appointment.patient?.first_name} ${appointment.patient?.last_name} - ${appointment.type}`,
        time: 'Just now',
        icon: Activity,
        color: 'text-green-600'
      };
      setRecentActivities(prev => [newActivity, ...prev.slice(0, 4)]);
      
      // Navigate to patient detail page after a short delay
      setTimeout(() => {
        navigate(`/patients/${appointment.patient_id}`);
      }, 500);
      
    } catch (error) {
      console.error('Error starting visit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to start visit');
    }
  };

  const handleCompleteVisit = async (appointmentId: string) => {
    try {
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        toast.error('Appointment not found');
        return;
      }
      
      // Update visit status first
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('appointment_id', appointmentId)
        .eq('status', 'in-progress')
        .select()
        .single();
      
      if (visitError && visitError.code !== 'PGRST116') { // Ignore "no rows returned" error
        console.error('Visit update error:', visitError);
        throw new Error('Failed to update visit status');
      }
      
      // Update appointment status to completed
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);
      
      if (appointmentError) {
        console.error('Appointment update error:', appointmentError);
        // Try to rollback visit status if appointment update fails
        if (visit) {
          await supabase
            .from('visits')
            .update({ status: 'in-progress' })
            .eq('id', visit.id);
        }
        throw new Error('Failed to update appointment status');
      }
      
      // Close modals
      setIsActionModalOpen(false);
      setSelectedAppointment(null);
      
      // Show success message
      toast.success(
        `Visit completed for ${appointment.patient?.first_name} ${appointment.patient?.last_name}`,
        { duration: 3000, icon: '✅' }
      );
      
      // Add to activity log
      const newActivity: ActivityItem = {
        id: `complete-${Date.now()}`,
        type: 'appointment',
        message: 'Visit completed',
        details: `${appointment.patient?.first_name} ${appointment.patient?.last_name} - ${appointment.type}`,
        time: 'Just now',
        icon: CheckCircle2,
        color: 'text-blue-600'
      };
      setRecentActivities(prev => [newActivity, ...prev.slice(0, 4)]);
      
      // Update stats immediately for better UX
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (appointment.date === todayStr) {
        // Force immediate UI update
        setAppointments(prev => 
          prev.map(apt => apt.id === appointmentId ? { ...apt, status: 'completed' } : apt)
        );
      }
      
    } catch (error) {
      console.error('Error completing visit:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to complete visit');
    }
  };

  const handleMarkReady = async (appointmentId: string) => {
    try {
      const appointment = appointments.find(apt => apt.id === appointmentId);
      if (!appointment) {
        toast.error('Appointment not found');
        return;
      }
      
      // Update appointment status to ready
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', appointmentId);

      if (error) {
        console.error('Mark ready error:', error);
        throw new Error('Failed to update appointment status');
      }
      
      // Show success notification
      toast.success(
        `${appointment.patient?.first_name} ${appointment.patient?.last_name} is ready to be seen`,
        { duration: 3000, icon: '🔔' }
      );
      
      // Add to activity log
      const newActivity: ActivityItem = {
        id: `ready-${Date.now()}`,
        type: 'appointment',
        message: 'Patient ready',
        details: `${appointment.patient?.first_name} ${appointment.patient?.last_name} - ${appointment.type}`,
        time: 'Just now',
        icon: AlertCircle,
        color: 'text-green-600'
      };
      setRecentActivities(prev => [newActivity, ...prev.slice(0, 4)]);
      
      // Send notification to doctor if different from current user
      if (appointment.doctor_id && appointment.doctor_id !== currentUserId) {
        // This would trigger a real-time notification to the doctor
        // For now, we'll just log it
        console.log(`Notification sent to doctor ${appointment.doctor_id}`);
      }
      
    } catch (error) {
      console.error('Error marking patient ready:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to mark patient ready');
    }
  };

  // Calculate today's statistics
  const todayAppointments = appointments.filter(apt => 
    apt.date === format(new Date(), 'yyyy-MM-dd')
  );
  const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
  const pendingRequests = labRequests.length + mediaRequests.length;
  const completedToday = todayAppointments.filter(apt => apt.status === 'completed').length;
  const scheduledToday = todayAppointments.filter(apt => apt.status === 'scheduled').length;
  const inProgressAppointments = appointments.filter(apt => apt.status === 'in-progress');

  // Stats data matching the Patients page design
  const stats = [
    { 
      label: 'Pending Bookings', 
      value: pendingAppointments.length.toString(),
      change: pendingAppointments.length > 0 ? 'Need approval' : 'None pending',
      trend: pendingAppointments.length > 0 ? 'down' : 'up',
      icon: AlertCircle,
      gradient: 'from-red-500 to-rose-600',
      id: 'pending-bookings',
      onClick: () => {
        setGridViewStatus('pending');
        setShowGridView(true);
      }
    },
    { 
      label: "Today's Appointments", 
      value: todayAppointments.length.toString(),
      change: scheduledToday > 0 ? `${scheduledToday} scheduled` : 'All clear',
      trend: scheduledToday > 0 ? 'neutral' : 'up',
      icon: Calendar,
      gradient: 'from-emerald-500 to-green-600',
      id: 'appointments',
      onClick: () => {
        setGridViewStatus('scheduled');
        setShowGridView(true);
      }
    },
    { 
      label: 'In Progress', 
      value: inProgressAppointments.length.toString(),
      change: inProgressAppointments.length > 0 ? 'Active visits' : 'None',
      trend: 'neutral',
      icon: Activity,
      gradient: 'from-blue-500 to-cyan-600',
      id: 'in-progress',
      onClick: () => {
        setGridViewStatus('in-progress');
        setShowGridView(true);
      }
    },
    { 
      label: 'Completed Today', 
      value: completedToday.toString(),
      change: completedToday > 0 ? 'View all' : 'None',
      trend: 'up',
      icon: CheckCircle2,
      gradient: 'from-purple-500 to-indigo-600',
      id: 'completed',
      onClick: () => {
        setGridViewStatus('completed');
        setShowGridView(true);
      }
    }
  ];

  // Quick actions data
  const quickActions = [
    { label: 'New Patient', icon: UserCheck, onClick: () => navigate('/patients') },
    { label: 'Lab Request', icon: Microscope, onClick: () => navigate('/requests') },
    { label: 'Prescription', icon: Pill, onClick: () => navigate('/patients') },
    { label: 'Messages', icon: MessageSquare, onClick: () => navigate('/messages') }
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Compact Professional Header */}
        <div className="bg-white/60 backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50">
          <div className="p-4 md:p-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  {/* Practice Logo */}
                  <div className="p-2 bg-gradient-to-br from-[#01b9d5] to-cyan-600 rounded-xl shadow-md">
                    <Building2 className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's your practice dashboard</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-all duration-200"
                  onClick={toggleFullscreen}
                  title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                >
                  {isFullscreen ? (
                    <Minimize className="w-5 h-5 text-gray-700" />
                  ) : (
                    <Expand className="w-5 h-5 text-gray-700" />
                  )}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="bg-[#01b9d5] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#01b9d5]/20 transition-all duration-200 font-medium text-sm"
                  onClick={() => setIsAddAppointmentModalOpen(true)}
                >
                  <Plus className="w-4 h-4" />
                  New Appointment
                </motion.button>
              </div>
            </div>


            {/* Premium Dashboard Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {true ? [
                // Patients Card
                <PremiumStatCard
                  key="patients"
                  title="Patients"
                  mainValue={250}
                  subtitle="Total registered patients"
                  icon={Users}
                  gradient="from-blue-500 to-cyan-600"
                  stats={[
                    { label: 'Male', value: 120, color: '#3B82F6' },
                    { label: 'Female', value: 130, color: '#06B6D4' },
                    { label: 'New This Month', value: 15, color: '#10B981' },
                    { label: 'Avg Age', value: '42y', color: '#8B5CF6' }
                  ]}
                  miniChart={{
                    type: 'line',
                    data: [45, 52, 48, 61, 55, 67]
                  }}
                  trend={{
                    value: '+15',
                    isPositive: true
                  }}
                  unsplashQuery="medical-patients-healthcare"
                  onClick={() => setSelectedReportModal({ isOpen: true, type: 'patients' })}
                />,
                
                // Communication Card (Light Mode)
                <PremiumStatCard
                  key="communication"
                  title="Communication"
                  mainValue={28}
                  subtitle="Active communications"
                  icon={MessageSquare}
                  gradient="from-amber-500 to-orange-600"
                  stats={[
                    { label: 'Unread', value: 5, color: '#F59E0B' },
                    { label: 'Urgent', value: 2, color: '#EF4444' },
                    { label: 'Today', value: 8, color: '#10B981' },
                    { label: 'Types', value: 4, color: '#8B5CF6' }
                  ]}
                  miniChart={{
                    type: 'bar',
                    data: [12, 18, 15, 25, 20, 28, 22]
                  }}
                  trend={{
                    value: '5 unread',
                    isPositive: false
                  }}
                  unsplashQuery="notification-bell-communication"
                  onClick={() => setSelectedReportModal({ isOpen: true, type: 'notifications' })}
                />,
                
                // Encounters Card
                <PremiumStatCard
                  key="encounters"
                  title="Encounters"
                  mainValue={156}
                  subtitle="Total patient visits"
                  icon={Activity}
                  gradient="from-emerald-500 to-green-600"
                  stats={[
                    { label: 'This Month', value: 23, color: '#10B981' },
                    { label: 'Completed', value: 142, color: '#059669' },
                    { label: 'Pending', value: 14, color: '#F59E0B' },
                    { label: 'Types', value: 3, color: '#8B5CF6' }
                  ]}
                  miniChart={{
                    type: 'line',
                    data: [18, 25, 20, 35, 28, 32]
                  }}
                  trend={{
                    value: '+23',
                    isPositive: true
                  }}
                  unsplashQuery="medical-consultation-stethoscope"
                  onClick={() => setSelectedReportModal({ isOpen: true, type: 'encounters' })}
                />,
                
                // Finance Card
                <PremiumStatCard
                  key="finance"
                  title="Finance"
                  mainValue="N$125,000"
                  subtitle="Total revenue"
                  icon={DollarSign}
                  gradient="from-purple-500 to-indigo-600"
                  stats={[
                    { label: 'This Month', value: 'N$18,500', color: '#8B5CF6' },
                    { label: 'Outstanding', value: 'N$5,200', color: '#EF4444' },
                    { label: 'Paid', value: 45, color: '#10B981' },
                    { label: 'Unpaid', value: 8, color: '#F59E0B' }
                  ]}
                  miniChart={{
                    type: 'line',
                    data: [12000, 15000, 18000, 22000, 16000, 18500]
                  }}
                  trend={{
                    value: 'N$18,500',
                    isPositive: true
                  }}
                  unsplashQuery="money-finance-calculator"
                  onClick={() => setIsEnhancedFinancialModalOpen(true)}
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
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Left Section - Appointment Schedule (8 columns) */}
          <div className="col-span-12 lg:col-span-8">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white backdrop-blur-sm rounded-xl shadow-lg border border-gray-200 overflow-hidden h-[800px] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-[#01b9d5] to-purple-600">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-white" />
                    Appointment Schedule
                  </h3>
                  <div className="flex items-center gap-3">
                    {/* View Mode Filters */}
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      {['day', 'week', 'month'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode as any)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                            viewMode === mode
                              ? 'bg-white/90 text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    
                    {/* Timeline/Grid Filters - Show only for day and week views */}
                    {(viewMode === 'day' || viewMode === 'week') && (
                      <div className="flex items-center bg-gray-100 rounded-lg p-1">
                        <button
                          onClick={() => setInternalViewMode('timeline')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                            internalViewMode === 'timeline'
                              ? 'bg-white/90 text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          Timeline
                        </button>
                        <button
                          onClick={() => setInternalViewMode('grid')}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                            internalViewMode === 'grid'
                              ? 'bg-white/90 text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          <Activity className="h-3 w-3" />
                          Grid
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Appointment Scheduler */}
              <div className="flex-1 overflow-hidden">
                <PremiumAppointmentScheduler
                  appointments={appointments}
                  doctors={doctors}
                  blockedTimes={[]}
                  isLoading={isLoading}
                  error={error}
                  selectedDate={selectedDate}
                  onDateChange={setSelectedDate}
                  onAppointmentClick={(apt) => {
                    setSelectedAppointment(apt);
                    if (apt.status === 'pending') {
                      setIsApprovalModalOpen(true);
                    } else {
                      setIsActionModalOpen(true);
                    }
                  }}
                  onEditAppointment={handleEditAppointment}
                  onCreateAppointment={handleCreateAppointment}
                  viewMode={viewMode}
                  onBlockTime={(doctorId, startTime, endTime, reason) => {
                    console.log('Block time:', { doctorId, startTime, endTime, reason });
                  }}
                  onDeleteAppointment={handleDeleteAppointment}
                  currentUserRole={currentUserRole}
                  currentUserId={currentUserId}
                  onRefresh={() => {
                    console.log('🔄 Manual refresh triggered from scheduler');
                    fetchData();
                  }}
                  internalViewMode={internalViewMode}
                  onInternalViewModeChange={setInternalViewMode}
                />
              </div>
            </motion.div>
          </div>

          {/* Right Section (4 columns) */}
          <div className="col-span-12 lg:col-span-4 space-y-4 md:space-y-6">
            {/* Practice Overview - FIRST */}
            <PracticeOverviewTile
              practiceStats={{
                totalPatients: patients.length,
                todayAppointments: todayAppointments.length,
                completedToday: completedToday,
                pendingAppointments: pendingAppointments.length,
                revenue: dashboardStats?.finance.thisMonth
              }}
            />

            {/* Notifications - SECOND */}
            <NotificationsPanel
              notifications={notifications}
              onNotificationAction={(notificationId, action) => {
                console.log('Notification action:', notificationId, action);
                // Remove notification after action
                setNotifications(prev => prev.filter(n => n.id !== notificationId));
              }}
              onMarkAsRead={(notificationId) => {
                setNotifications(prev => 
                  prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
                );
              }}
              onMarkAllAsRead={() => {
                setNotifications(prev => prev.map(n => ({ ...n, read: true })));
              }}
            />

            {/* Quick Actions - THIRD */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden"
            >
              {/* Modern gradient header */}
              <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-gray-50 via-white to-gray-50">
                <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                  <div className="relative">
                    <div className="absolute inset-0 bg-[#01b9d5] blur-xl opacity-20 animate-pulse" />
                    <Zap className="relative w-5 h-5 text-[#01b9d5]" />
                  </div>
                  Quick Actions
                </h3>
              </div>
              
              {/* Compact modern button grid */}
              <div className="p-4">
                <div className="grid grid-cols-4 gap-2">
                  {quickActions.map((action, index) => (
                    <motion.button
                      key={action.label}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ 
                        delay: 0.4 + index * 0.05,
                        type: "spring",
                        stiffness: 300,
                        damping: 24
                      }}
                      whileHover={{ y: -2 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={action.onClick}
                      className="relative group"
                    >
                      {/* Modern glass card effect */}
                      <div className="relative p-3 rounded-xl bg-gradient-to-br from-white/80 to-gray-50/50 backdrop-blur-sm border border-gray-200/50 hover:border-[#01b9d5]/30 transition-all duration-300 overflow-hidden">
                        {/* Animated gradient background */}
                        <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d5]/0 via-[#01b9d5]/0 to-[#01b9d5]/0 group-hover:from-[#01b9d5]/5 group-hover:via-[#01b9d5]/10 group-hover:to-[#01b9d5]/5 transition-all duration-500" />
                        
                        {/* Floating orb effect */}
                        <div className="absolute -top-4 -right-4 w-16 h-16 bg-[#01b9d5]/10 rounded-full blur-2xl group-hover:bg-[#01b9d5]/20 transition-all duration-500 group-hover:scale-150" />
                        
                        {/* Icon container with modern styling */}
                        <div className="relative mb-2">
                          <div className="w-10 h-10 mx-auto relative">
                            {/* Icon glow effect */}
                            <div className="absolute inset-0 bg-[#01b9d5]/20 rounded-lg blur-md opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                            {/* Icon background */}
                            <div className="relative w-full h-full bg-gradient-to-br from-gray-100 to-gray-50 rounded-lg flex items-center justify-center group-hover:from-[#01b9d5]/10 group-hover:to-[#01b9d5]/5 transition-all duration-300">
                              <action.icon className="w-4 h-4 text-gray-500 group-hover:text-[#01b9d5] transition-all duration-300 group-hover:scale-110" />
                            </div>
                          </div>
                        </div>
                        
                        {/* Compact label */}
                        <p className="relative text-[11px] font-medium text-gray-600 group-hover:text-gray-800 transition-colors duration-300 leading-tight">
                          {action.label}
                        </p>
                        
                        {/* Modern hover indicator */}
                        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-gradient-to-r from-transparent via-[#01b9d5]/0 to-transparent group-hover:via-[#01b9d5]/40 transition-all duration-300" />
                      </div>
                      
                      {/* Subtle shadow on hover */}
                      <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 shadow-lg shadow-[#01b9d5]/10 pointer-events-none" />
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-4 md:p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#01b9d5]" />
                Recent Activity
              </h3>
              <div className="space-y-3">
                {recentActivities.length > 0 ? (
                  recentActivities.map((activity, index) => (
                    <motion.div
                      key={activity.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.5 + index * 0.05 }}
                      className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className={`p-2 rounded-lg bg-gray-100`}>
                        <activity.icon className={`w-4 h-4 ${activity.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900">{activity.message}</p>
                        <p className="text-xs text-gray-500">{activity.details}</p>
                      </div>
                      <span className="text-xs text-gray-400">{activity.time}</span>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 text-center py-8">No recent activity</p>
                )}
              </div>
            </motion.div>
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
        <AddAppointmentForm
          initialDate={selectedTimeSlot ? new Date(selectedTimeSlot.date) : undefined}
          initialTime={selectedTimeSlot?.time}
          initialDoctorId={selectedTimeSlot?.doctorId}
          onSuccess={() => {
            setIsAddAppointmentModalOpen(false);
            setSelectedTimeSlot(null);
            // Real-time updates will handle the refresh
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
            onReschedule={() => {
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
            onEditAppointment={(appointment) => {
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
          onApprove={handleApproveAppointment}
          onReject={handleRejectAppointment}
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

      {/* Detailed Report Modal */}
      {selectedReportModal.isOpen && selectedReportModal.type && dashboardStats && (
        <DetailedReportModal
          isOpen={selectedReportModal.isOpen}
          onClose={() => setSelectedReportModal({ isOpen: false, type: null })}
          data={generateReportData(selectedReportModal.type, dashboardStats)}
        />
      )}

      {/* Enhanced Financial Modal */}
      {isEnhancedFinancialModalOpen && dashboardStats && (
        <EnhancedFinancialModal
          isOpen={isEnhancedFinancialModalOpen}
          onClose={() => setIsEnhancedFinancialModalOpen(false)}
          data={generateReportData('finance', dashboardStats)}
        />
      )}

      {/* Floating Theme Toggle */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsDarkMode(!isDarkMode)}
        className="fixed bottom-6 right-20 w-12 h-12 bg-white/90 backdrop-blur-sm border border-gray-200 text-gray-700 rounded-full shadow-lg hover:shadow-xl transition-all flex items-center justify-center group z-50"
        title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
      >
        {isDarkMode ? (
          <Sun className="w-5 h-5 group-hover:rotate-12 transition-transform" />
        ) : (
          <Moon className="w-5 h-5 group-hover:-rotate-12 transition-transform" />
        )}
      </motion.button>
    </div>
  );

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
            `Most popular payment method: ${stats.finance.paymentMethods[0]?.method || 'Cash'}`
          ],
          actionItems: [
            'Follow up on outstanding payments',
            'Send payment reminders to overdue accounts',
            'Review and optimize payment processes'
          ]
        };

      default:
        throw new Error(`Unknown report type: ${type}`);
    }
  }
}

export default Dashboard;