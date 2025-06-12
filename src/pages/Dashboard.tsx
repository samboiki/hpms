import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Calendar,
  Microscope,
  AlertCircle,
  Plus,
  CheckCircle2,
  MessageSquare,
  ChevronRight,
  DollarSign,
  Building2,
  ChevronLeft
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isToday, isSameDay, addWeeks, subWeeks } from 'date-fns';
import { practiceDataService, PracticeDetails } from '../lib/practiceDataService';
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
import { useTheme } from '../stores/themeStore';
import { toast } from 'react-hot-toast';
import PremiumStatCard from '../components/dashboard/PremiumStatCard';
import DetailedReportModal from '../components/modals/DetailedReportModal';
import EnhancedFinancialModal from '../components/modals/EnhancedFinancialModal';
import PracticeOverviewTile from '../components/dashboard/PracticeOverviewTile';
import { dashboardStatsService, DashboardStats } from '../services/dashboardStatsService';
import { useAuthStore } from '../stores/authStore';
import { NotificationsPanel, Notification } from '../components/dashboard/NotificationsPanel';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show' | 'ready';
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
  const { user } = useAuthStore();
  const { currentTheme } = useTheme();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [patientsData, setPatientsData] = useState<any[]>([]);
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
  const [gridViewStatus, setGridViewStatus] = useState<'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'in-progress' | 'ready'>('pending');
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [patientStats, setPatientStats] = useState<{
    total: number;
    male: number;
    female: number;
    newThisMonth: number;
  }>({ total: 0, male: 0, female: 0, newThisMonth: 0 });
  const [selectedReportModal, setSelectedReportModal] = useState<{
    isOpen: boolean;
    type: 'patients' | 'notifications' | 'encounters' | 'finance' | null;
  }>({ isOpen: false, type: null });
  const [isEnhancedFinancialModalOpen, setIsEnhancedFinancialModalOpen] = useState(false);
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

  const fetchPatientStats = async () => {
    try {
      console.log('📊 [Dashboard] Fetching patient statistics...');
      
      // Get total patients count
      const { count: totalCount, error: totalError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });

      if (totalError) {
        console.error('❌ Error fetching total patients:', totalError);
        return;
      }

      // Get gender breakdown
      const { data: genderData, error: genderError } = await supabase
        .from('patients')
        .select('gender')
        .not('gender', 'is', null);

      if (genderError) {
        console.error('❌ Error fetching gender data:', genderError);
        return;
      }

      // Calculate gender counts
      const maleCount = genderData?.filter(p => p.gender?.toLowerCase() === 'male').length || 0;
      const femaleCount = genderData?.filter(p => p.gender?.toLowerCase() === 'female').length || 0;

      // Get new patients this month
      const currentMonth = new Date();
      const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
      
      const { count: newThisMonth, error: newError } = await supabase
        .from('patients')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth.toISOString());

      if (newError) {
        console.error('❌ Error fetching new patients:', newError);
        return;
      }

      setPatientStats({
        total: totalCount || 0,
        male: maleCount,
        female: femaleCount,
        newThisMonth: newThisMonth || 0
      });

      console.log('✅ [Dashboard] Patient stats fetched:', {
        total: totalCount,
        male: maleCount,
        female: femaleCount,
        newThisMonth
      });

    } catch (error) {
      console.error('❌ [Dashboard] Error fetching patient stats:', error);
    }
  };

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

      // Fetch practice details including logo
      const practiceData = await practiceDataService.getPracticeDetails(authContext.practiceId);
      if (practiceData) {
        console.log('✅ [Dashboard] Practice details loaded:', practiceData);
      }

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

      // Set state
      setAppointments(practiceAppointments);
      setPatientsData(practicePatients);

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

      setRecentActivities(activities);

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
        activitiesSet: activities.length
      });

      // Fetch patient statistics
      await fetchPatientStats();

      // Generate sample notifications
      const sampleNotifications: Notification[] = [
        {
          id: '1',
          type: 'booking',
          priority: 'high',
          title: 'New Appointment Request',
          description: 'John Smith has requested an appointment for tomorrow at 2:00 PM',
          time: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago
          actionRequired: true,
          read: false,
          actions: {
            primary: { label: 'Approve', onClick: () => {}, variant: 'approve' },
            secondary: { label: 'Reschedule', onClick: () => {} }
          }
        },
        {
          id: '2',
          type: 'lab-result',
          priority: 'urgent',
          title: 'Lab Results Ready',
          description: 'Blood test results for Mary Johnson are ready for review',
          time: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
          actionRequired: true,
          read: false,
          actions: {
            primary: { label: 'Review', onClick: () => {}, variant: 'neutral' }
          }
        },
        {
          id: '3',
          type: 'follow-up',
          priority: 'normal',
          title: 'Follow-up Reminder',
          description: 'Patient David Wilson needs follow-up appointment in 2 weeks',
          time: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
          actionRequired: false,
          read: true
        },
        {
          id: '4',
          type: 'message',
          priority: 'normal',
          title: 'New Message',
          description: 'Dr. Sarah received a message from a patient regarding medication',
          time: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
          actionRequired: false,
          read: false
        },
        {
          id: '5',
          type: 'reminder',
          priority: 'low',
          title: 'System Reminder',
          description: 'Monthly backup scheduled for tonight at 11:00 PM',
          time: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
          actionRequired: false,
          read: true
        }
      ];
      setNotifications(sampleNotifications);
      
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


  // Calculate today's statistics
  const todayAppointments = appointments.filter(apt => 
    apt.date === format(new Date(), 'yyyy-MM-dd')
  );
  const pendingAppointments = appointments.filter(apt => apt.status === 'pending');
  const completedToday = todayAppointments.filter(apt => apt.status === 'completed').length;
  const scheduledToday = todayAppointments.filter(apt => apt.status === 'scheduled').length;
  const inProgressAppointments = appointments.filter(apt => apt.status === 'in-progress');


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
              <div className="flex items-center justify-end">
                {/* User Avatar */}
                {user && (
                  <div className="relative group">
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
                  </div>
                )}
              </div>
            </div>


            {/* Premium Dashboard Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              {true ? [
                // Patients Card
                <PremiumStatCard
                  key="patients"
                  title="Patients"
                  mainValue={patientStats.total}
                  subtitle="Total registered patients"
                  icon={Users}
                  gradient="from-[#489bfd] to-[#a4c8ff]"
                  cardType="patients"
                  stats={[
                    { label: 'Male', value: patientStats.male, color: '#489bfd' },
                    { label: 'Female', value: patientStats.female, color: '#7db3fe' }
                  ]}
                  comparison={{
                    label1: 'Male',
                    value1: patientStats.male,
                    label2: 'Female',
                    value2: patientStats.female,
                    color1: '#489bfd',
                    color2: '#7db3fe'
                  }}
                  trend={{
                    value: `+${patientStats.newThisMonth}`,
                    isPositive: patientStats.newThisMonth > 0
                  }}
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
                  cardType="communication"
                  stats={[
                    { label: 'Unread', value: 5, color: '#F59E0B' },
                    { label: 'Read', value: 23, color: '#059669' }
                  ]}
                  comparison={{
                    label1: 'Unread',
                    value1: 5,
                    label2: 'Read',
                    value2: 23,
                    color1: '#F59E0B',
                    color2: '#059669'
                  }}
                  trend={{
                    value: '5 unread',
                    isPositive: false
                  }}
                  onClick={() => setSelectedReportModal({ isOpen: true, type: 'notifications' })}
                />,
                
                // Encounters Card
                <PremiumStatCard
                  key="encounters"
                  title="Encounters"
                  mainValue={156}
                  subtitle="Total patient visits"
                  icon={Activity}
                  gradient="from-red-500 to-pink-500"
                  cardType="encounters"
                  stats={[
                    { label: 'This Month', value: 23, color: '#10B981' },
                    { label: 'Previous', value: 133, color: '#047857' }
                  ]}
                  comparison={{
                    label1: 'This Month',
                    value1: 23,
                    label2: 'Previous',
                    value2: 133,
                    color1: '#10B981',
                    color2: '#047857'
                  }}
                  trend={{
                    value: '+23',
                    isPositive: true
                  }}
                  onClick={() => setSelectedReportModal({ isOpen: true, type: 'encounters' })}
                />,
                
                // Finance Card
                <PremiumStatCard
                  key="finance"
                  title="Finance"
                  mainValue="N$125,000"
                  subtitle="Total revenue"
                  icon={DollarSign}
                  gradient="from-cyan-500 to-blue-500"
                  cardType="finance"
                  stats={[
                    { label: 'Paid', value: 'N$119,800', color: '#8B5CF6' },
                    { label: 'Outstanding', value: 'N$5,200', color: '#EF4444' }
                  ]}
                  comparison={{
                    label1: 'Paid',
                    value1: 119800,
                    label2: 'Outstanding',
                    value2: 5200,
                    color1: '#8B5CF6',
                    color2: '#EF4444'
                  }}
                  trend={{
                    value: 'N$18,500',
                    isPositive: true
                  }}
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

            {/* Week Calendar and Notifications */}
            <div className="mt-6">
              {/* Week Calendar and Notifications Row */}
              <div className="grid grid-cols-12 gap-4">
                {/* Premium Week Calendar - Glassmorphic - 8 columns */}
                <div className="relative col-span-8">
                  {/* Glassmorphic background */}
                  <div className="bg-white/20 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/30">
                    {/* Week Navigation Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {/* View Mode Toggles */}
                        <div className="flex items-center bg-white/30 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-white/20">
                          {['day', 'week', 'month'].map((mode) => (
                            <button
                              key={mode}
                              onClick={() => setViewMode(mode as any)}
                              className={`px-2 py-1 text-xs font-medium rounded-md transition-all capitalize ${
                                viewMode === mode
                                  ? `bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white shadow-md`
                                  : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                              }`}
                            >
                              {mode}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setSelectedDate(subWeeks(selectedDate, 1))}
                          className="p-1.5 hover:bg-white/30 rounded-full transition-all duration-200 backdrop-blur-sm"
                        >
                          <ChevronLeft className="w-4 h-4 text-gray-600" />
                        </button>
                        <button
                          onClick={() => setSelectedDate(addWeeks(selectedDate, 1))}
                          className="p-1.5 hover:bg-white/30 rounded-full transition-all duration-200 backdrop-blur-sm"
                        >
                          <ChevronRight className="w-4 h-4 text-gray-600" />
                        </button>
                      </div>
                    </div>
                    
                    {/* Week Range Display */}
                    <div className="text-center mb-4">
                      <span className="text-sm font-semibold text-gray-700">
                        {format(startOfWeek(selectedDate), 'MMM d')} - {format(endOfWeek(selectedDate), 'MMM d, yyyy')}
                      </span>
                    </div>
                    
                    {/* Week Days - All 7 days in one row */}
                    <div className="grid grid-cols-7 gap-2">
                      {eachDayOfInterval({
                        start: startOfWeek(selectedDate),
                        end: endOfWeek(selectedDate)
                      }).map((day) => {
                        const dayIsToday = isToday(day);
                        const dayIsSelected = isSameDay(day, selectedDate);
                        
                        return (
                          <button
                            key={day.toISOString()}
                            onClick={() => setSelectedDate(day)}
                            className={`relative flex flex-col items-center p-3 rounded-2xl transition-all duration-300 transform hover:scale-105 ${
                              dayIsToday || dayIsSelected
                                ? `bg-gradient-to-br ${currentTheme.gradients.sidebar} shadow-lg backdrop-blur-sm`
                                : 'bg-white/20 backdrop-blur-sm hover:bg-white/30'
                            }`}
                            style={{
                              borderRadius: '20px', // Bean shape
                            }}
                          >
                            {/* Date number - prominently displayed at top with theme color */}
                            <div 
                              className={`text-lg font-bold mb-1 ${
                                dayIsToday || dayIsSelected 
                                  ? 'text-white' 
                                  : ''
                              }`}
                              style={{ 
                                color: dayIsToday || dayIsSelected 
                                  ? 'white' 
                                  : currentTheme.colors.primary.from 
                              }}
                            >
                              {format(day, 'd')}
                            </div>
                            
                            {/* Day name - lighter, matte, faded */}
                            <div 
                              className={`text-xs font-medium ${
                                dayIsToday || dayIsSelected
                                  ? 'text-white/80'
                                  : 'text-gray-500/70'
                              }`}
                            >
                              {format(day, 'EEE')}
                            </div>
                            
                            {/* Today indicator */}
                            {dayIsToday && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full shadow-sm animate-pulse"></div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Notifications Panel - 4 columns */}
                <div className="relative col-span-4">
                  <NotificationsPanel
                    notifications={notifications}
                    onNotificationAction={(notificationId, action) => {
                      console.log('Notification action:', notificationId, action);
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
                </div>
              </div>
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
              className="bg-white/90 backdrop-blur-md rounded-xl shadow-sm border border-gray-100/50 overflow-hidden h-[800px] flex flex-col"
            >
              {/* Premium Header with Gradient */}
              <div className="relative p-6 border-b border-gray-100/50">
                {/* Background gradient */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/5 via-cyan-50/30 to-blue-50/20" />
                
                {/* Content */}
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Icon with glow effect */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-[#01b9d5]/20 blur-xl rounded-xl animate-pulse" />
                      <div className="relative p-3 bg-gradient-to-br from-[#01b9d5] to-cyan-600 rounded-xl shadow-lg">
                        <Calendar className="w-6 h-6 text-white" />
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text">
                        Appointment Schedule
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Manage your practice appointments and scheduling
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    {/* View Mode Filters */}
                    <div className="flex items-center bg-white/60 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-gray-200/50">
                      {['day', 'week', 'month'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode as any)}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all capitalize ${
                            viewMode === mode
                              ? 'bg-gray-200 text-gray-800 shadow-md'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                    
                    {/* Timeline/Grid Filters */}
                    {(viewMode === 'day' || viewMode === 'week') && (
                      <div className="flex items-center bg-white/60 backdrop-blur-sm rounded-lg p-0.5 shadow-sm border border-gray-200/50">
                        <button
                          onClick={() => setInternalViewMode('timeline')}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                            internalViewMode === 'timeline'
                              ? 'bg-gray-200 text-gray-800 shadow-md'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                          }`}
                        >
                          <Calendar className="h-3 w-3" />
                          Timeline
                        </button>
                        <button
                          onClick={() => setInternalViewMode('grid')}
                          className={`px-2 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 ${
                            internalViewMode === 'grid'
                              ? 'bg-gray-200 text-gray-800 shadow-md'
                              : 'text-gray-600 hover:text-gray-900 hover:bg-white/80'
                          }`}
                        >
                          <Activity className="h-3 w-3" />
                          Grid
                        </button>
                      </div>
                    )}
                    
                    {/* Premium New Appointment Button */}
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAddAppointmentModalOpen(true)}
                      className={`bg-gradient-to-r ${currentTheme.gradients.button} text-white px-4 py-2 rounded-xl flex items-center gap-2 hover:shadow-lg hover:shadow-[${currentTheme.colors.primary.from}]/20 transition-all duration-200 font-medium text-sm`}
                      title="Schedule New Appointment"
                    >
                      <Plus className="w-4 h-4" />
                      <span className="hidden sm:inline">New Appointment</span>
                      <span className="sm:hidden">New</span>
                    </motion.button>
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
            {/* Practice Overview */}
            <PracticeOverviewTile
              totalPatients={patientsData.length}
              todayAppointments={todayAppointments.length}
              pendingAppointments={pendingAppointments.length}
              completedToday={completedToday}
              practiceStatus={pendingAppointments.length > 5 ? 'busy' : todayAppointments.length === 0 ? 'quiet' : 'operational'}
            />


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
          data={dashboardStats ? generateFinancialReportData(dashboardStats) : {
            type: 'finance' as const,
            title: 'Financial Overview',
            subtitle: 'No data available',
            overview: { total: 0, change: 'N/A', isPositive: false, period: 'N/A' },
            breakdown: [],
            chartData: { labels: [], datasets: [] },
            timeSeriesData: { labels: [], datasets: [] },
            insights: [],
            actionItems: []
          }}
        />
      )}

    </div>
  );

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
        `Most popular payment method: ${stats.finance.paymentMethods[0]?.method || 'Cash'}`
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
}

export default Dashboard;