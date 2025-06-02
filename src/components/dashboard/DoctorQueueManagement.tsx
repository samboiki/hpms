import React, { useMemo } from 'react';
import { 
  Clock, 
  User, 
  Play, 
  CheckCircle, 
  AlertCircle, 
  Activity,
  Calendar,
  Phone,
  Timer,
  ChevronRight
} from 'lucide-react';
import { format, isToday, parseISO } from 'date-fns';
import { motion } from 'framer-motion';

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

interface DoctorQueueManagementProps {
  appointments: QueueAppointment[];
  currentDoctorId: string;
  onStartVisit: (appointmentId: string) => void;
  onCompleteVisit: (appointmentId: string) => void;
  onMarkReady: (appointmentId: string) => void;
  isLoading?: boolean;
}

export default function DoctorQueueManagement({
  appointments,
  currentDoctorId,
  onStartVisit,
  onCompleteVisit,
  onMarkReady,
  isLoading = false
}: DoctorQueueManagementProps) {
  
  // Filter and categorize doctor's appointments for today
  const todayAppointments = useMemo(() => {
    const today = new Date();
    return appointments.filter(apt => 
      apt.doctor_id === currentDoctorId && 
      isToday(parseISO(apt.date))
    ).sort((a, b) => a.time.localeCompare(b.time));
  }, [appointments, currentDoctorId]);

  const categorizedAppointments = useMemo(() => {
    const categories = {
      scheduled: todayAppointments.filter(apt => apt.status === 'scheduled'),
      ready: todayAppointments.filter(apt => apt.status === 'ready'),
      inProgress: todayAppointments.filter(apt => apt.status === 'in-progress'),
      completed: todayAppointments.filter(apt => apt.status === 'completed')
    };
    
    return categories;
  }, [todayAppointments]);

  const nextAppointment = categorizedAppointments.ready[0] || categorizedAppointments.scheduled[0];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled': return 'from-blue-500 to-blue-600';
      case 'ready': return 'from-green-500 to-green-600';
      case 'in-progress': return 'from-amber-500 to-amber-600';
      case 'completed': return 'from-gray-500 to-gray-600';
      default: return 'from-gray-400 to-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled': return Calendar;
      case 'ready': return AlertCircle;
      case 'in-progress': return Activity;
      case 'completed': return CheckCircle;
      default: return Clock;
    }
  };

  const AppointmentCard = ({ appointment, category }: { appointment: QueueAppointment; category: string }) => {
    const StatusIcon = getStatusIcon(appointment.status);
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-all duration-200"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${getStatusColor(appointment.status)} shadow-sm`}>
              <StatusIcon className="w-4 h-4 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-gray-900">
                {appointment.patient.first_name} {appointment.patient.last_name}
              </h4>
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {appointment.time} ({appointment.duration}min)
              </p>
            </div>
          </div>
          {appointment.patient.cell_number && (
            <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Phone className="w-4 h-4 text-gray-500" />
            </button>
          )}
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="capitalize font-medium text-gray-700">{appointment.type}</span>
            {appointment.notes && (
              <span className="text-gray-500">• {appointment.notes.slice(0, 30)}...</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            {appointment.status === 'pending' && (
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-red-100 text-red-700 rounded text-xs font-medium">
                  Needs Approval
                </span>
              </div>
            )}
            {appointment.status === 'scheduled' && (
              <button
                onClick={() => onMarkReady(appointment.id)}
                className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors text-xs font-medium"
              >
                Mark Ready
              </button>
            )}
            {appointment.status === 'ready' && (
              <button
                onClick={() => onStartVisit(appointment.id)}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-xs font-medium flex items-center gap-1"
              >
                <Play className="w-3 h-3" />
                Start Visit
              </button>
            )}
            {appointment.status === 'in-progress' && (
              <button
                onClick={() => onCompleteVisit(appointment.id)}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors text-xs font-medium flex items-center gap-1"
              >
                <CheckCircle className="w-3 h-3" />
                Complete
              </button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  if (isLoading) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-20 bg-gray-100 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-gray-200 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-[#01b9d5] to-[#0196be] text-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Live Queue Management</h3>
            <p className="text-white/90 text-sm">Today's Appointments • {todayAppointments.length} total</p>
          </div>
          {nextAppointment && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                if (nextAppointment.status === 'ready') {
                  onStartVisit(nextAppointment.id);
                } else if (nextAppointment.status === 'scheduled') {
                  onMarkReady(nextAppointment.id);
                }
              }}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg flex items-center gap-2 transition-all text-sm font-medium"
            >
              <Timer className="w-4 h-4" />
              {nextAppointment.status === 'ready' ? 'Start Next Visit' : 'Prepare Next'}
              <ChevronRight className="w-4 h-4" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4 max-h-96 overflow-y-auto">
        {todayAppointments.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 font-medium">No appointments today</p>
            <p className="text-gray-500 text-sm">Enjoy your day off!</p>
          </div>
        ) : (
          <>
            {/* In Progress */}
            {categorizedAppointments.inProgress.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-amber-500" />
                  In Progress ({categorizedAppointments.inProgress.length})
                </h4>
                <div className="space-y-2">
                  {categorizedAppointments.inProgress.map(appointment => (
                    <AppointmentCard key={appointment.id} appointment={appointment} category="inProgress" />
                  ))}
                </div>
              </div>
            )}

            {/* Ready/Waiting */}
            {categorizedAppointments.ready.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-green-500" />
                  Ready to Start ({categorizedAppointments.ready.length})
                </h4>
                <div className="space-y-2">
                  {categorizedAppointments.ready.map(appointment => (
                    <AppointmentCard key={appointment.id} appointment={appointment} category="ready" />
                  ))}
                </div>
              </div>
            )}

            {/* Scheduled */}
            {categorizedAppointments.scheduled.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  Scheduled ({categorizedAppointments.scheduled.length})
                </h4>
                <div className="space-y-2">
                  {categorizedAppointments.scheduled.map(appointment => (
                    <AppointmentCard key={appointment.id} appointment={appointment} category="scheduled" />
                  ))}
                </div>
              </div>
            )}

            {/* Completed */}
            {categorizedAppointments.completed.length > 0 && (
              <div>
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-gray-500" />
                  Completed ({categorizedAppointments.completed.length})
                </h4>
                <div className="space-y-2">
                  {categorizedAppointments.completed.slice(0, 3).map(appointment => (
                    <AppointmentCard key={appointment.id} appointment={appointment} category="completed" />
                  ))}
                  {categorizedAppointments.completed.length > 3 && (
                    <div className="text-center py-2">
                      <p className="text-sm text-gray-500">
                        +{categorizedAppointments.completed.length - 3} more completed
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}