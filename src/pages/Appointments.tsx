import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  User,
  Clock,
  Filter,
  MoreVertical,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Search,
  ArrowUpDown,
  Users,
  CalendarDays,
  Timer,
  TrendingUp
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAppointmentsStore } from '../stores/appointmentsStore';
import { useAuthStore } from '../stores/authStore';
import Badge from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, isSameDay, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameMonth } from 'date-fns';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';
import RescheduleAppointmentModal from '../components/modals/RescheduleAppointmentModal';
import ModernWeekView from '../components/appointments/ModernWeekView';
import DayTimelineView from '../components/appointments/DayTimelineView';
import AppointmentGridView from '../components/appointments/AppointmentGridView';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { AnimatedPageBackground } from '../components/ui/AnimatedBackground';

interface AppointmentStats {
  todayCount: number;
  weekCount: number;
  pendingCheckins: number;
  completionRate: number;
  requestedCount: number;
}

interface Doctor {
  id: string;
  full_name: string;
}

const Appointments: React.FC = () => {
  const navigate = useNavigate();
  const { appointments, fetchAppointments, checkInAppointment, cancelAppointment, isLoading, error } = useAppointmentsStore();
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [isRescheduleModalOpen, setIsRescheduleModalOpen] = useState(false);
  const [selectedAppointmentForReschedule, setSelectedAppointmentForReschedule] = useState<any>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<AppointmentStats>({
    todayCount: 0,
    weekCount: 0,
    pendingCheckins: 0,
    completionRate: 0,
    requestedCount: 0
  });
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [showGridView, setShowGridView] = useState(false);
  const [gridViewStatus, setGridViewStatus] = useState<'pending' | 'scheduled' | 'completed' | 'cancelled' | 'no-show' | 'in-progress'>('pending');
  const { user } = useAuthStore();
  
  // Generate dates for week view
  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekDays = [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
  
  // Generate dates for month view
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Navigation functions
  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToPreviousMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  const goToToday = () => setCurrentDate(new Date());
  
  // Fetch doctors from users table
  const fetchDoctors = async () => {
    try {
      // Get current user's practice_id from authStore
      const currentUser = useAuthStore.getState().user;
      if (!currentUser?.practice_id) {
        console.log('No practice_id found for current user');
        return;
      }

      const { data, error } = await supabase
        .from('users')
        .select('id, full_name')
        .eq('role', 'doctor')
        .eq('practice_id', currentUser.practice_id);
      
      if (!error && data) {
        setDoctors(data);
      }
    } catch (err) {
      console.error('Error fetching doctors:', err);
    }
  };
  
  // Calculate statistics
  const calculateStats = () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    
    const todayCount = appointments.filter(apt => apt.date === today).length;
    const weekCount = appointments.filter(apt => {
      const aptDate = parseISO(apt.date);
      return aptDate >= weekStart && aptDate <= weekEnd;
    }).length;
    const pendingCheckins = appointments.filter(apt => 
      apt.status === 'scheduled' && apt.date <= today
    ).length;
    
    const completedToday = appointments.filter(apt => 
      apt.date === today && apt.status === 'completed'
    ).length;
    const completionRate = todayCount > 0 ? (completedToday / todayCount) * 100 : 0;
    
    const requestedCount = appointments.filter(apt => 
      apt.status === 'pending'
    ).length;
    
    setStats({
      todayCount,
      weekCount,
      pendingCheckins,
      completionRate: Math.round(completionRate),
      requestedCount
    });
  };

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, [fetchAppointments]);
  
  useEffect(() => {
    calculateStats();
  }, [appointments]);

  // Filter appointments for the current period
  const getFilteredAppointments = () => {
    if (view === 'week') {
      return appointments.filter(appointment => {
        const appointmentDate = parseISO(appointment.date);
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = addDays(weekStart, 6);
        return appointmentDate >= weekStart && appointmentDate <= weekEnd;
      });
    } else if (view === 'month') {
      return appointments.filter(appointment => {
        const appointmentDate = parseISO(appointment.date);
        return isSameMonth(appointmentDate, currentDate);
      });
    } else {
      return appointments.filter(appointment => 
        appointment.date === format(currentDate, 'yyyy-MM-dd')
      );
    }
  };

  // Group appointments by date
  const appointmentsByDate: Record<string, typeof appointments> = {};
  getFilteredAppointments().forEach(appointment => {
    if (!appointmentsByDate[appointment.date]) {
      appointmentsByDate[appointment.date] = [];
    }
    appointmentsByDate[appointment.date].push(appointment);
  });

  // Apply search and filters
  const filteredAppointments = appointments.filter(appointment => {
    if (filterStatus !== 'all' && appointment.status !== filterStatus) {
      return false;
    }
    
    if (filterDoctor !== 'all' && appointment.doctor_id !== filterDoctor) {
      return false;
    }
    
    if (searchTerm) {
      const patientName = appointment.patient ? 
        `${appointment.patient.first_name} ${appointment.patient.last_name}`.toLowerCase() : '';
      const doctorName = appointment.doctor ? appointment.doctor.full_name.toLowerCase() : '';
      const searchLower = searchTerm.toLowerCase();
      
      return patientName.includes(searchLower) || 
             doctorName.includes(searchLower) ||
             appointment.type.toLowerCase().includes(searchLower);
    }
    
    return true;
  });

  const handleCheckIn = async (appointmentId: string) => {
    const visitId = await checkInAppointment(appointmentId);
    if (visitId) {
      navigate(`/patients/${appointments.find(a => a.id === appointmentId)?.patient_id}`);
    }
  };

  const handleCancel = async (appointmentId: string) => {
    if (window.confirm('Are you sure you want to cancel this appointment?')) {
      await cancelAppointment(appointmentId);
    }
  };

  const handleReschedule = (appointment: any) => {
    const appointmentWithNames = {
      ...appointment,
      patient_name: appointment.patient ? 
        `${appointment.patient.first_name} ${appointment.patient.last_name}` : 'Unknown',
      doctor_name: appointment.doctor?.full_name || 'Unknown'
    };
    setSelectedAppointmentForReschedule(appointmentWithNames);
    setIsRescheduleModalOpen(true);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'lavender';
      case 'scheduled': return 'azure';
      case 'in-progress': return 'amber';
      case 'completed': return 'slate';
      case 'cancelled': return 'coral';
      case 'no-show': return 'rose';
      default: return 'glass';
    }
  };

  return (
    <AnimatedPageBackground>
      <div className="animate-fade-in">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <Calendar size={28} className="text-primary-600 mr-3" />
          <div>
            <h1 className="text-[30px] font-bold text-[#494c61]">Appointments</h1>
            <p className="text-gray-600">Manage your schedule and patient appointments</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button 
            variant="outline"
            onClick={() => setFilterStatus(filterStatus === 'all' ? 'scheduled' : 'all')}
          >
            <Filter size={16} className="mr-2" />
            {filterStatus === 'all' ? 'All Statuses' : `Filter: ${filterStatus}`}
          </Button>
          <Button 
            onClick={() => setIsAddAppointmentModalOpen(true)}
            style={{ backgroundColor: '#01b9d4' }}
            className="text-white hover:bg-opacity-90"
          >
            <Plus size={16} className="mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          // Today's appointments would typically be scheduled or in-progress
          setGridViewStatus('scheduled');
          setShowGridView(true);
        }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                <p className="text-2xl font-bold text-gray-900">{stats.todayCount}</p>
              </div>
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <CalendarDays size={16} className="text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Week</p>
                <p className="text-2xl font-bold text-gray-900">{stats.weekCount}</p>
              </div>
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <Users size={16} className="text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          setGridViewStatus('scheduled');
          setShowGridView(true);
        }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ready to Start</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingCheckins}</p>
              </div>
              <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center">
                <Timer size={16} className="text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completionRate}%</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <TrendingUp size={16} className="text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => {
          setGridViewStatus('pending');
          setShowGridView(true);
        }}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Pending Approvals</p>
                <p className="text-2xl font-bold text-gray-900">{stats.requestedCount}</p>
              </div>
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <AlertCircle size={16} className="text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search by patient name, doctor, or appointment type..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="scheduled">Scheduled</option>
                <option value="in-progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select
                value={filterDoctor}
                onChange={(e) => setFilterDoctor(e.target.value)}
                className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              >
                <option value="all">All Doctors</option>
                {doctors.map(doctor => (
                  <option key={doctor.id} value={doctor.id}>
                    {doctor.full_name}
                  </option>
                ))}
                <option value="">Unassigned</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Calendar navigation */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <Button 
                variant="outline" 
                size="sm"
                onClick={view === 'month' ? goToPreviousMonth : goToPreviousWeek}
              >
                <ChevronLeft size={16} />
              </Button>
              <h2 className="text-lg font-medium">
                {view === 'month' 
                  ? format(currentDate, 'MMMM yyyy')
                  : `${format(startOfCurrentWeek, 'MMMM d')} - ${format(addDays(startOfCurrentWeek, 6), 'MMMM d, yyyy')}`
                }
              </h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={view === 'month' ? goToNextMonth : goToNextWeek}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className="flex space-x-2">
              {['day', 'week', 'month'].map((viewType) => (
                <Button 
                  key={viewType}
                  variant={view === viewType ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setView(viewType as any)}
                  style={view === viewType ? { backgroundColor: '#01b9d4' } : {}}
                  className={view === viewType ? 'text-white' : ''}
                >
                  {viewType.charAt(0).toUpperCase() + viewType.slice(1)}
                </Button>
              ))}
              <Button 
                variant="outline"
                size="sm"
                onClick={goToToday}
              >
                Today
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Month view */}
      {view === 'month' && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-7 gap-1">
              {/* Day headers */}
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                  {day}
                </div>
              ))}
              
              {/* Calendar days */}
              {monthDays.map((day, i) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const dayAppointments = appointmentsByDate[dateStr] || [];
                const isCurrentDay = isToday(day);
                
                return (
                  <div 
                    key={i}
                    className={`min-h-[80px] p-1 border border-gray-200 cursor-pointer hover:bg-gray-50 ${
                      isCurrentDay ? 'bg-blue-50 border-blue-300' : ''
                    }`}
                    onClick={() => {
                      setCurrentDate(day);
                      setView('day');
                    }}
                  >
                    <div className={`text-sm font-medium ${
                      isCurrentDay ? 'text-blue-600' : 'text-gray-900'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayAppointments.slice(0, 2).map(apt => (
                        <div 
                          key={apt.id}
                          className={`text-xs p-1 rounded truncate ${
                            apt.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                            apt.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                            apt.status === 'in-progress' ? 'bg-amber-100 text-amber-800' :
                            apt.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {apt.time.slice(0, 5)} {apt.patient?.first_name}
                        </div>
                      ))}
                      {dayAppointments.length > 2 && (
                        <div className="text-xs text-gray-500">
                          +{dayAppointments.length - 2} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Week view */}
      {view === 'week' && (
        <ModernWeekView
          weekDays={weekDays}
          appointments={filteredAppointments}
          onAppointmentClick={(appointment) => navigate(`/patients/${appointment.patient_id}`)}
          onCheckIn={handleCheckIn}
          onCancel={handleCancel}
          onReschedule={handleReschedule}
        />
      )}

      {/* Day view */}
      {view === 'day' && (
        <DayTimelineView
          selectedDate={currentDate}
          appointments={filteredAppointments}
          onAppointmentClick={(appointment) => navigate(`/patients/${appointment.patient_id}`)}
          onCheckIn={handleCheckIn}
          onCancel={handleCancel}
          onReschedule={handleReschedule}
        />
      )}

      {/* Upcoming appointments list */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Upcoming Appointments</CardTitle>
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                className="mr-2"
                onClick={() => {
                  const newOrder = filterStatus === 'all' ? 'scheduled' : 'all';
                  setFilterStatus(newOrder);
                }}
              >
                <Filter size={16} className="mr-2" />
                {filterStatus === 'all' ? 'All' : filterStatus}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Sort logic here
                }}
              >
                <ArrowUpDown size={16} className="mr-2" />
                Sort
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <AlertCircle size={40} className="mx-auto text-error-500 mb-2" />
              <p className="text-error-600">{error}</p>
            </div>
          ) : filteredAppointments.length > 0 ? (
            <div className="space-y-4">
              {filteredAppointments
                .filter(app => ['pending', 'scheduled'].includes(app.status))
                .slice(0, 5)
                .map((appointment) => (
                  <motion.div 
                    key={appointment.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                  >
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                        <User size={16} className="text-gray-500" />
                      </div>
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {appointment.patient?.first_name} {appointment.patient?.last_name}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {format(new Date(appointment.date), 'MMM d, yyyy')} at {appointment.time} • {appointment.type}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Badge
                        variant={getStatusColor(appointment.status)}
                        size="sm"
                        className="mr-3"
                      >
                        {appointment.status}
                      </Badge>
                      
                      {appointment.status === 'scheduled' && (
                        <div className="flex space-x-2">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCheckIn(appointment.id);
                            }}
                          >
                            <CheckCircle2 size={14} className="mr-1" />
                            Check-in
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleReschedule(appointment);
                            }}
                          >
                            <Calendar size={14} className="mr-1" />
                            Reschedule
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="text-red-600 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCancel(appointment.id);
                            }}
                          >
                            <XCircle size={14} className="mr-1" />
                            Cancel
                          </Button>
                        </div>
                      )}
                      
                      <Button variant="ghost" size="sm">
                        <MoreVertical size={16} />
                      </Button>
                    </div>
                  </motion.div>
                ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar size={40} className="mx-auto text-gray-300" />
              <p className="mt-2 text-gray-500">No upcoming appointments found</p>
              <Button 
                variant="outline" 
                size="sm"
                className="mt-4"
                onClick={() => setIsAddAppointmentModalOpen(true)}
              >
                <Plus size={16} className="mr-2" />
                Schedule Appointment
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Appointment Modal */}
      <FormModal
        isOpen={isAddAppointmentModalOpen}
        onClose={() => setIsAddAppointmentModalOpen(false)}
        title="Schedule New Appointment"
      >
        <AddAppointmentForm 
          onSuccess={() => {
            setIsAddAppointmentModalOpen(false);
            fetchAppointments();
          }}
        />
      </FormModal>

      {/* Reschedule Appointment Modal */}
      {selectedAppointmentForReschedule && (
        <RescheduleAppointmentModal
          isOpen={isRescheduleModalOpen}
          onClose={() => {
            setIsRescheduleModalOpen(false);
            setSelectedAppointmentForReschedule(null);
          }}
          appointment={selectedAppointmentForReschedule}
          onReschedule={() => {
            setIsRescheduleModalOpen(false);
            setSelectedAppointmentForReschedule(null);
            fetchAppointments();
          }}
        />
      )}

      {/* Appointment Grid View */}
      {showGridView && user?.practice_id && (
        <AppointmentGridView
          status={gridViewStatus}
          practiceId={user.practice_id}
          onClose={() => setShowGridView(false)}
        />
      )}
      </div>
    </AnimatedPageBackground>
  );
};

export default Appointments;