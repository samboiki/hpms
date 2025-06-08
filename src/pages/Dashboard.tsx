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
  ChevronRight
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
              <div>
                <h1 className="text-2xl font-semibold text-gray-800">Dashboard</h1>
                <p className="text-sm text-gray-500 mt-0.5">Welcome back! Here's your practice overview</p>
              </div>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full lg:w-auto bg-[#01b9d5] text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-[#01b9d5]/20 transition-all duration-200 font-medium text-sm"
                onClick={() => setIsAddAppointmentModalOpen(true)}
              >
                <Plus className="w-4 h-4" />
                New Appointment
              </motion.button>
            </div>

            {/* Premium Stats - Next of Kin and Total Investment card style */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-4">
              {stats.map((stat, index) => {
                // Use premium card style for "In Progress" and "Completed Today"
                const isPremiumCard = stat.id === 'in-progress' || stat.id === 'completed';
                
                if (isPremiumCard) {
                  return (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      whileHover={{ y: -8, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative group cursor-pointer"
                      onClick={stat.onClick}
                    >
                      {/* Gorgeous gradient background like next of kin card - lighter */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${stat.id === 'completed' ? 'from-purple-300 via-purple-400 to-indigo-400 group-hover:from-purple-500 group-hover:via-purple-400 group-hover:to-indigo-500' : 'from-blue-300 via-blue-400 to-cyan-400 group-hover:from-blue-500 group-hover:via-blue-400 group-hover:to-cyan-500'} rounded-3xl transform ${stat.id === 'completed' ? 'rotate-1 group-hover:rotate-2' : '-rotate-1 group-hover:-rotate-2'} transition-transform duration-500`}></div>
                      
                      {/* Main card */}
                      <div className={`relative bg-gradient-to-br ${stat.id === 'completed' ? 'from-purple-300 to-indigo-400 group-hover:from-purple-400 group-hover:to-indigo-500' : 'from-blue-300 to-cyan-400 group-hover:from-blue-400 group-hover:to-cyan-500'} rounded-3xl p-1 shadow-2xl transition-all duration-500`}>
                        <div className="relative bg-white rounded-[1.25rem] overflow-hidden">
                          {/* Subtle pattern overlay */}
                          <div className="absolute inset-0 opacity-[0.02]" style={{
                            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23${stat.id === 'completed' ? 'A855F7' : '0EA5E9'}' fill-opacity='0.05'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                          }}></div>
                          
                          <div className="relative p-6">
                            {/* Icon and trend indicator */}
                            <div className="flex items-start justify-between mb-4">
                              <div className="relative">
                                <div className={`absolute inset-0 bg-gradient-to-br ${stat.id === 'completed' ? 'from-purple-200 to-indigo-300 group-hover:from-purple-300 group-hover:to-indigo-400' : 'from-blue-200 to-cyan-300 group-hover:from-blue-300 group-hover:to-cyan-400'} blur-xl opacity-50 transition-all duration-500`}></div>
                                <div className={`relative p-3 bg-gradient-to-br ${stat.id === 'completed' ? 'from-purple-300 to-indigo-400 group-hover:from-purple-400 group-hover:to-indigo-500' : 'from-blue-300 to-cyan-400 group-hover:from-blue-400 group-hover:to-cyan-500'} rounded-2xl shadow-lg transition-all duration-500`}>
                                  <stat.icon className="w-5 h-5 text-white" />
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-gray-400 group-hover:text-gray-600 transition-colors">
                                <span className="text-xs font-medium">{stat.change}</span>
                                <ChevronRight className="w-3 h-3" />
                              </div>
                            </div>
                            
                            {/* Content */}
                            <div className="space-y-1">
                              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                              <p className="text-2xl font-black text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                                {stat.value}
                              </p>
                              <p className="text-sm text-gray-600 font-medium">
                                {stat.id === 'completed' ? 'Visits completed' : 'Active visits'}
                              </p>
                            </div>
                            
                            {/* Bottom accent */}
                            <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.id === 'completed' ? 'from-purple-400 to-indigo-500 opacity-60 group-hover:opacity-100' : 'from-blue-400 to-cyan-500 opacity-60 group-hover:opacity-100'} transition-opacity duration-300`}></div>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                }
                
                // Regular card style for other stats
                return (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ y: -1, scale: 1.01 }}
                    className="relative group cursor-pointer"
                    onClick={stat.onClick}
                  >
                    {/* Subtle Gradient Glow */}
                    <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-xl blur-md opacity-5 group-hover:opacity-15 transition-opacity duration-200`}></div>
                    
                    {/* Glass Card */}
                    <div className="relative bg-white/80 backdrop-blur-sm border rounded-xl p-3 transition-all duration-200 shadow-sm border-gray-200/40 hover:border-gray-300/50 hover:shadow-md">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`p-2 bg-gradient-to-br ${stat.gradient} rounded-lg shadow-md`}>
                          <stat.icon className="w-4 h-4 text-white" />
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                          stat.trend === 'up' ? 'bg-emerald-100 text-emerald-700' : 
                          stat.trend === 'down' ? 'bg-rose-100 text-rose-700' : 
                          'bg-gray-100 text-gray-600'
                        }`}>
                          {stat.change}
                        </span>
                      </div>
                      <p className="text-3xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-1">{stat.value}</p>
                      <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
                    </div>
                  </motion.div>
                );
              })}
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
              className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[800px] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#01b9d5]" />
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
            {/* Notifications - FIRST */}
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

            {/* Quick Actions - SECOND */}
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
    </div>
  );
}

export default Dashboard;