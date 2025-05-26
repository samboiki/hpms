import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Calendar,
  Microscope,
  AlertCircle,
  Plus,
  FileText,
  Clock,
  Pill,
  CheckCircle2,
  UserCheck,
  MessageSquare,
  FlaskConical,
  Zap
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';
import PremiumAppointmentScheduler from '../components/PremiumAppointmentScheduler';
import AppointmentDetailsModal from '../components/modals/AppointmentDetailsModal';
import RescheduleAppointmentModal from '../components/modals/RescheduleAppointmentModal';
import AppointmentActionModal from '../components/modals/AppointmentActionModal';
import { motion } from 'framer-motion';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'scheduled' | 'confirmed' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
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
  const [currentUserRole, setCurrentUserRole] = useState<'admin' | 'doctor' | 'nurse' | 'receptionist'>('admin');
  const [currentUserId, setCurrentUserId] = useState('');
  const [currentPracticeId, setCurrentPracticeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'day' | 'week' | 'month'>('day');
  const [recentActivities, setRecentActivities] = useState<ActivityItem[]>([]);
  const navigate = useNavigate();

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
        
        // Get user profile with practice_id
        const { data: userProfile } = await supabase
          .from('users')
          .select('role, practice_id')
          .eq('id', user.id)
          .single();
          
        if (userProfile) {
          setCurrentUserRole(userProfile.role || 'admin');
          setCurrentPracticeId(userProfile.practice_id);
        }
      }

      // Fetch appointments with patient data (past week and future)
      const today = new Date();
      const oneWeekAgo = new Date(today);
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      let appointmentsQuery = supabase
        .from('appointments')
        .select(`
          *,
          patient:patients (
            id,
            first_name,
            last_name,
            cell_number,
            date_of_birth,
            gender
          )
        `)
        .gte('date', format(oneWeekAgo, 'yyyy-MM-dd'))
        .order('date', { ascending: true })
        .order('time', { ascending: true });
        
      // Filter by practice if user has a practice_id
      if (currentPracticeId) {
        appointmentsQuery = appointmentsQuery.eq('practice_id', currentPracticeId);
      }
      
      const { data: appointmentsData, error: appointmentsError } = await appointmentsQuery;

      if (appointmentsError) {
        console.error('Appointments fetch error:', appointmentsError);
        throw appointmentsError;
      }

      // Fetch doctors from users table (not auth.users)
      let doctorsQuery = supabase
        .from('users')
        .select('id, email, full_name, role');
        
      if (currentPracticeId) {
        doctorsQuery = doctorsQuery.eq('practice_id', currentPracticeId);
      }
      
      const { data: doctorsData, error: doctorsError } = await doctorsQuery;
      
      if (doctorsError) {
        console.error('Error fetching doctors:', doctorsError);
        setDoctors([]);
      } else {
        const filteredDoctors = (doctorsData || []).filter(user => 
          user.role === 'doctor' || user.role === 'admin'
        ).map(user => ({
          id: user.id,
          email: user.email,
          user_metadata: {
            full_name: user.full_name,
            role: user.role
          }
        }));
        setDoctors(filteredDoctors);
      }

      // Fetch patient count
      let patientsQuery = supabase
        .from('patients')
        .select('*', { count: 'exact', head: true });
        
      if (currentPracticeId) {
        patientsQuery = patientsQuery.eq('practice_id', currentPracticeId);
      }
      
      const { count: patientsCount } = await patientsQuery;

      // Fetch lab requests
      let labRequestsQuery = supabase
        .from('lab_requests')
        .select('*')
        .eq('status', 'pending');
        
      if (currentPracticeId) {
        labRequestsQuery = labRequestsQuery.eq('practice_id', currentPracticeId);
      }
      
      const { data: labRequestsData } = await labRequestsQuery;

      // Fetch media requests
      let mediaRequestsQuery = supabase
        .from('media_requests')
        .select('*')
        .eq('status', 'pending');
        
      if (currentPracticeId) {
        mediaRequestsQuery = mediaRequestsQuery.eq('practice_id', currentPracticeId);
      }
      
      const { data: mediaRequestsData } = await mediaRequestsQuery;

      console.log('Dashboard data:', {
        appointments: appointmentsData,
        patientsCount,
        labRequests: labRequestsData,
        mediaRequests: mediaRequestsData
      });

      setAppointments(appointmentsData || []);
      setPatients(Array(patientsCount || 0));
      setLabRequests(labRequestsData || []);
      setMediaRequests(mediaRequestsData || []);

      // Generate recent activities from real data
      const activities: ActivityItem[] = [];
      
      // Add recent appointments as activities
      (appointmentsData || []).slice(0, 3).forEach((apt) => {
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

      // Add lab requests as activities
      (labRequestsData || []).slice(0, 2).forEach((lab) => {
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
      
    } catch (error) {
      console.error('Error fetching data:', error);
      setError(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleAppointmentClick = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsDetailsModalOpen(true);
  };

  const handleEditAppointment = (appointment: Appointment) => {
    setSelectedAppointment(appointment);
    setIsRescheduleModalOpen(true);
  };

  const handleCreateAppointment = async () => {
    setIsAddAppointmentModalOpen(false);
    fetchData();
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointmentId);
      
      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error deleting appointment:', error);
    }
  };

  // Calculate today's statistics
  const todayAppointments = appointments.filter(apt => 
    apt.date === format(new Date(), 'yyyy-MM-dd')
  );
  const pendingRequests = labRequests.length + mediaRequests.length;
  const completedToday = todayAppointments.filter(apt => apt.status === 'completed').length;
  const scheduledToday = todayAppointments.filter(apt => apt.status === 'scheduled' || apt.status === 'confirmed').length;

  // Stats data matching the Patients page design
  const stats = [
    { 
      label: 'Total Patients', 
      value: patients.length.toString(),
      change: '+12%',
      trend: 'up',
      icon: Users,
      gradient: 'from-blue-500 to-indigo-600',
      id: 'patients'
    },
    { 
      label: "Today's Appointments", 
      value: todayAppointments.length.toString(),
      change: scheduledToday > 0 ? `${scheduledToday} pending` : 'All clear',
      trend: scheduledToday > 0 ? 'neutral' : 'up',
      icon: Calendar,
      gradient: 'from-emerald-500 to-green-600',
      id: 'appointments'
    },
    { 
      label: 'Pending Tasks', 
      value: pendingRequests.toString(),
      change: labRequests.length > 0 ? `${labRequests.length} labs` : 'None',
      trend: pendingRequests > 0 ? 'down' : 'up',
      icon: AlertCircle,
      gradient: 'from-amber-500 to-orange-600',
      id: 'tasks'
    },
    { 
      label: 'Completed Today', 
      value: completedToday.toString(),
      change: '+8%',
      trend: 'up',
      icon: CheckCircle2,
      gradient: 'from-purple-500 to-indigo-600',
      id: 'completed'
    }
  ];

  // Quick actions data
  const quickActions = [
    { label: 'New Patient', icon: UserCheck, onClick: () => navigate('/patients'), color: 'from-blue-500 to-indigo-600' },
    { label: 'Lab Request', icon: Microscope, onClick: () => navigate('/requests'), color: 'from-green-500 to-emerald-600' },
    { label: 'Prescription', icon: Pill, onClick: () => navigate('/patients'), color: 'from-purple-500 to-indigo-600' },
    { label: 'Messages', icon: MessageSquare, onClick: () => navigate('/messages'), color: 'from-amber-500 to-orange-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-50/80 to-blue-50/20">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Compact Professional Header */}
        <div className="bg-gradient-to-r from-gray-50 via-white to-gray-50 rounded-xl shadow-sm border border-gray-100">
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

            {/* Premium Stats - Exact same design as Patients page */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -1, scale: 1.01 }}
                  className="relative group cursor-pointer"
                >
                  {/* Subtle Gradient Glow */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} rounded-xl blur-md opacity-5 group-hover:opacity-15 transition-opacity duration-200`}></div>
                  
                  {/* Glass Card */}
                  <div className="relative bg-white/60 backdrop-blur-sm border rounded-xl p-3 transition-all duration-200 shadow-sm border-gray-200/40 hover:border-gray-300/50 hover:shadow-md">
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
              ))}
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-12 gap-4 md:gap-6">
          {/* Left Section - Appointment Schedule (6 columns) */}
          <div className="col-span-12 lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-[700px] flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-gray-200 bg-gray-50/50">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#01b9d5]" />
                    Appointment Schedule
                  </h3>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-gray-100 rounded-lg p-1">
                      {['day', 'week', 'month'].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setViewMode(mode as any)}
                          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all capitalize ${
                            viewMode === mode
                              ? 'bg-white text-gray-900 shadow-sm'
                              : 'text-gray-600 hover:text-gray-900'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
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
                    setIsActionModalOpen(true);
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
                  onRefresh={fetchData}
                />
              </div>
            </motion.div>
          </div>

          {/* Right Section (6 columns) */}
          <div className="col-span-12 lg:col-span-6 space-y-4 md:space-y-6">
            {/* Recent Activity */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5"
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
                      transition={{ delay: 0.3 + index * 0.05 }}
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

            {/* Critical Tasks */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-amber-500" />
                Pending Tasks
              </h3>
              <div className="space-y-3">
                {labRequests.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <div className="flex items-center gap-3">
                      <FlaskConical className="w-5 h-5 text-amber-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Lab Results Pending</p>
                        <p className="text-xs text-gray-600">{labRequests.length} requests awaiting review</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/requests')}
                      className="text-xs font-medium text-amber-600 hover:text-amber-700"
                    >
                      Review →
                    </button>
                  </div>
                )}
                
                {mediaRequests.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-200">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-purple-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Media Requests</p>
                        <p className="text-xs text-gray-600">{mediaRequests.length} files pending</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/requests')}
                      className="text-xs font-medium text-purple-600 hover:text-purple-700"
                    >
                      View →
                    </button>
                  </div>
                )}

                {scheduledToday > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center gap-3">
                      <Clock className="w-5 h-5 text-blue-600" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Upcoming Appointments</p>
                        <p className="text-xs text-gray-600">{scheduledToday} scheduled for today</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => navigate('/appointments')}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      View All →
                    </button>
                  </div>
                )}

                {pendingRequests === 0 && scheduledToday === 0 && (
                  <div className="text-center py-8">
                    <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">All caught up! No pending tasks.</p>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-5"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#01b9d5]" />
                Quick Actions
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {quickActions.map((action, index) => (
                  <motion.button
                    key={action.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 + index * 0.05 }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={action.onClick}
                    className="p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition-all group"
                  >
                    <div className={`w-10 h-10 bg-gradient-to-br ${action.color} rounded-lg flex items-center justify-center mx-auto mb-2 group-hover:shadow-lg transition-shadow`}>
                      <action.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm font-medium text-gray-700">{action.label}</p>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <FormModal
        isOpen={isAddAppointmentModalOpen}
        onClose={() => setIsAddAppointmentModalOpen(false)}
        title="Schedule New Appointment"
      >
        <AddAppointmentForm
          onSuccess={() => {
            setIsAddAppointmentModalOpen(false);
            fetchData();
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
              fetchData();
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
              fetchData();
            }}
            currentUserRole={currentUserRole}
          />
        </>
      )}
    </div>
  );
}

export default Dashboard;