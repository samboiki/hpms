import React, { useMemo, useEffect, useState } from 'react';
import { 
  Activity, 
  Stethoscope, 
  Calendar,
  FileText,
  User,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Play,
  Timer
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

interface AppointmentPatient {
  id: string;
  first_name: string;
  last_name: string;
  cell_number?: string;
  date_of_birth?: string;
  gender?: string;
}

interface QueueAppointment {
  id: string;
  patient: AppointmentPatient;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: 'consultation' | 'follow-up' | 'procedure' | 'emergency';
  status: 'pending' | 'scheduled' | 'ready' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
  notes?: string;
  created_at?: string;
}

interface PatientDetailQueueProps {
  currentDoctorId: string;
  currentPatientId: string;
  appointments: QueueAppointment[];
  onRefresh?: () => void;
}

export default function PatientDetailQueue({
  currentDoctorId,
  currentPatientId,
  appointments,
  onRefresh
}: PatientDetailQueueProps) {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter doctor's appointments for today
  const todayAppointments = useMemo(() => {
    const today = new Date();
    return appointments.filter(apt => {
      // Include appointments assigned to current doctor
      const isMyAppointment = apt.doctor_id === currentDoctorId || (!apt.doctor_id && apt.status === 'ready');
      const isTodayAppointment = isToday(parseISO(apt.date));
      return isMyAppointment && isTodayAppointment;
    }).sort((a, b) => {
      // Sort by status priority first, then by time
      const statusPriority = {
        'in-progress': 0,
        'ready': 1,
        'scheduled': 2,
        'pending': 3,
        'completed': 4
      };
      const aPriority = statusPriority[a.status] ?? 5;
      const bPriority = statusPriority[b.status] ?? 5;
      
      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }
      return a.time.localeCompare(b.time);
    });
  }, [appointments, currentDoctorId]);

  // Calculate statistics
  const stats = useMemo(() => {
    const completed = todayAppointments.filter(apt => apt.status === 'completed').length;
    const inQueue = todayAppointments.filter(apt => 
      ['scheduled', 'ready'].includes(apt.status)
    ).length;
    const inProgress = todayAppointments.filter(apt => apt.status === 'in-progress').length;
    const total = todayAppointments.length;
    
    return { completed, inQueue, inProgress, total };
  }, [todayAppointments]);

  // Get next appointments (excluding current patient)
  const nextAppointments = useMemo(() => {
    return todayAppointments
      .filter(apt => 
        apt.patient_id !== currentPatientId && 
        ['scheduled', 'ready'].includes(apt.status)
      )
      .slice(0, 3);
  }, [todayAppointments, currentPatientId]);

  // Get current/in-progress appointment
  const currentAppointment = todayAppointments.find(apt => apt.status === 'in-progress');
  
  // Get next appointment to start
  const nextToStart = nextAppointments.find(apt => apt.status === 'ready') || nextAppointments[0];

  const handleStartNextVisit = async () => {
    if (!nextToStart) {
      toast.error('No appointments in queue');
      return;
    }

    try {
      setIsLoading(true);

      // Create a visit record
      const { data: visit, error: visitError } = await supabase
        .from('visits')
        .insert([{
          appointment_id: nextToStart.id,
          patient_id: nextToStart.patient_id,
          doctor_id: currentDoctorId,
          visit_date: nextToStart.date,
          visit_time: nextToStart.time,
          visit_type: nextToStart.type || 'consultation',
          chief_complaint: nextToStart.notes || 'See appointment notes',
          status: 'in-progress',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();
      
      if (visitError) throw visitError;
      
      // Update appointment status to in-progress
      const { error: updateError } = await supabase
        .from('appointments')
        .update({ 
          status: 'in-progress',
          doctor_id: currentDoctorId, // Assign to current doctor if not assigned
          updated_at: new Date().toISOString()
        })
        .eq('id', nextToStart.id);
      
      if (updateError) {
        // Try to rollback by deleting the visit
        await supabase.from('visits').delete().eq('id', visit.id);
        throw updateError;
      }
      
      // Navigate to the next patient's profile
      toast.success(`Starting visit for ${nextToStart.patient.first_name} ${nextToStart.patient.last_name}`);
      navigate(`/patients/${nextToStart.patient_id}`);
      
    } catch (error) {
      console.error('Error starting next visit:', error);
      toast.error('Failed to start next visit');
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready': return 'text-green-600 bg-green-500';
      case 'in-progress': return 'text-amber-600 bg-amber-500';
      case 'scheduled': return 'text-blue-600 bg-blue-500';
      case 'completed': return 'text-gray-600 bg-gray-400';
      default: return 'text-gray-500 bg-gray-400';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'ready': return 'from-green-500/10 to-emerald-600/10 border-green-500/20';
      case 'in-progress': return 'from-amber-500/10 to-yellow-600/10 border-amber-500/20';
      case 'scheduled': return 'from-blue-500/10 to-cyan-600/10 border-blue-500/20';
      default: return 'from-gray-500/10 to-slate-600/10 border-gray-500/20';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="relative group"
    >
      {/* Floating glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4]/20 via-purple-500/20 to-indigo-600/20 rounded-xl blur-xl opacity-0 group-hover:opacity-50 transition-all duration-500 -z-10"></div>
      
      <div className="relative bg-white/95 backdrop-blur-xl rounded-xl shadow-xl border border-gray-200/50 overflow-hidden">
        {/* Animated gradient header */}
        <div className="h-2 bg-gradient-to-r from-[#01b9d4] via-purple-500 to-indigo-600 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>
        
        {/* Main content */}
        <div className="p-4 md:p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl shadow-lg">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">My Queue Today</h3>
                <p className="text-xs text-gray-500 font-medium">
                  {stats.total} appointments • {stats.completed} completed
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 font-medium">Live</span>
            </div>
          </div>
          
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`p-3 bg-gradient-to-br ${getStatusBgColor('completed')} rounded-xl border shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-gray-600" />
                <span className="text-xs font-medium text-gray-700">Completed</span>
              </div>
              <p className="text-2xl font-bold text-gray-600">{stats.completed}</p>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`p-3 bg-gradient-to-br ${getStatusBgColor('ready')} rounded-xl border shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Clock className="w-3.5 h-3.5 text-green-600" />
                <span className="text-xs font-medium text-green-700">In Queue</span>
              </div>
              <p className="text-2xl font-bold text-green-600">{stats.inQueue}</p>
            </motion.div>
            
            <motion.div
              whileHover={{ scale: 1.02 }}
              className={`p-3 bg-gradient-to-br ${getStatusBgColor('in-progress')} rounded-xl border shadow-sm`}
            >
              <div className="flex items-center gap-2 mb-1">
                <Activity className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-amber-700">Active</span>
              </div>
              <p className="text-2xl font-bold text-amber-600">{stats.inProgress}</p>
            </motion.div>
          </div>
          
          {/* Current Patient Indicator */}
          {currentAppointment && currentAppointment.patient_id === currentPatientId && (
            <div className="mb-4 p-3 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-medium text-amber-800">
                  Currently seeing this patient
                </span>
              </div>
            </div>
          )}
          
          {/* Live Queue */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-gray-800">Next Patients</h4>
              <span className="text-xs text-gray-500">Updated now</span>
            </div>
            
            {nextAppointments.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Calendar className="w-6 h-6 text-gray-400" />
                </div>
                <p className="text-sm text-gray-600">No more appointments in queue</p>
                <p className="text-xs text-gray-500 mt-1">Great job today!</p>
              </div>
            ) : (
              <>
                {nextAppointments.map((apt, index) => (
                  <motion.div
                    key={apt.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative group/queue cursor-pointer"
                    onClick={() => navigate(`/patients/${apt.patient_id}`)}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${
                      apt.status === 'ready' ? 'from-green-500/5 to-emerald-500/5' :
                      'from-blue-500/5 to-cyan-500/5'
                    } rounded-lg opacity-0 group-hover/queue:opacity-100 transition-opacity`}></div>
                    <div className={`relative p-3 bg-white/90 rounded-lg border ${
                      apt.status === 'ready' ? 'border-green-200/50' : 'border-blue-200/50'
                    } shadow-sm hover:shadow-md transition-all`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 bg-gradient-to-br ${
                          apt.status === 'ready' ? 'from-green-500 to-emerald-600' :
                          'from-blue-500 to-cyan-600'
                        } rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-gray-800">
                            {apt.patient.first_name} {apt.patient.last_name}
                          </p>
                          <p className="text-xs text-gray-600">
                            {apt.type} • {apt.time}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <div className={`w-2 h-2 rounded-full ${getStatusColor(apt.status).split(' ')[1]}`}></div>
                          <span className={`text-xs font-medium ${getStatusColor(apt.status).split(' ')[0]}`}>
                            {apt.status === 'ready' ? 'Ready' : 'Waiting'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </>
            )}
          </div>
          
          {/* Quick Actions */}
          <div className="space-y-2">
            {nextToStart && (
              <motion.button
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleStartNextVisit}
                disabled={isLoading || (currentAppointment && currentAppointment.patient_id !== currentPatientId)}
                className="w-full p-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-lg font-medium text-sm shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Starting Visit...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Start Next Visit ({nextToStart.patient.first_name})
                  </>
                )}
              </motion.button>
            )}
            
            <div className="grid grid-cols-2 gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('/appointments')}
                className="p-2.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-medium text-gray-600"
              >
                <Calendar className="w-3.5 h-3.5" />
                Schedule
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onRefresh}
                className="p-2.5 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 text-xs font-medium text-gray-600"
              >
                <Timer className="w-3.5 h-3.5" />
                Refresh
              </motion.button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}