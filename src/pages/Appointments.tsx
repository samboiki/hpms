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
  ArrowUpDown
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAppointmentsStore } from '../stores/appointmentsStore';
import Badge from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO, isSameDay } from 'date-fns';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';
import { motion } from 'framer-motion';

const Appointments: React.FC = () => {
  const navigate = useNavigate();
  const { appointments, fetchAppointments, checkInAppointment, cancelAppointment, isLoading, error } = useAppointmentsStore();
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterDoctor, setFilterDoctor] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Generate dates for week view
  const startOfCurrentWeek = startOfWeek(currentDate, { weekStartsOn: 1 }); // Start on Monday
  const weekDays = [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
  
  // Navigation functions
  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  const goToToday = () => setCurrentDate(new Date());
  
  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  // Filter appointments for the current week
  const currentWeekAppointments = appointments.filter(appointment => {
    const appointmentDate = parseISO(appointment.date);
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    return appointmentDate >= weekStart && appointmentDate <= weekEnd;
  });

  // Group appointments by date
  const appointmentsByDate: Record<string, typeof appointments> = {};
  currentWeekAppointments.forEach(appointment => {
    if (!appointmentsByDate[appointment.date]) {
      appointmentsByDate[appointment.date] = [];
    }
    appointmentsByDate[appointment.date].push(appointment);
  });

  // Filter appointments based on search and filters
  const filteredAppointments = appointments.filter(appointment => {
    // Status filter
    if (filterStatus !== 'all' && appointment.status !== filterStatus) {
      return false;
    }
    
    // Doctor filter
    if (filterDoctor !== 'all' && appointment.doctor_id !== filterDoctor) {
      return false;
    }
    
    // Search term
    if (searchTerm) {
      const patientName = appointment.patient ? 
        `${appointment.patient.first_name} ${appointment.patient.last_name}`.toLowerCase() : '';
      const doctorName = appointment.doctor ? appointment.doctor.full_name.toLowerCase() : '';
      const searchLower = searchTerm.toLowerCase();
      
      return patientName.includes(searchLower) || doctorName.includes(searchLower);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'azure';
      case 'confirmed':
        return 'success';
      case 'in-progress':
        return 'warning';
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'glass';
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="animate-fade-in">
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

      {/* Search and Filter Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search appointments..."
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
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
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
                {/* This would be populated from your doctors data */}
                <option value="doctor1">Dr. Jane Smith</option>
                <option value="doctor2">Dr. Michael Chen</option>
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
                onClick={goToPreviousWeek}
              >
                <ChevronLeft size={16} />
              </Button>
              <h2 className="text-lg font-medium">
                {format(startOfCurrentWeek, 'MMMM d')} - {format(addDays(startOfCurrentWeek, 6), 'MMMM d, yyyy')}
              </h2>
              <Button 
                variant="outline" 
                size="sm"
                onClick={goToNextWeek}
              >
                <ChevronRight size={16} />
              </Button>
            </div>
            <div className="flex space-x-2">
              <Button 
                variant={view === 'day' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setView('day')}
                style={view === 'day' ? { backgroundColor: '#01b9d4' } : {}}
                className={view === 'day' ? 'text-white' : ''}
              >
                Day
              </Button>
              <Button 
                variant={view === 'week' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setView('week')}
                style={view === 'week' ? { backgroundColor: '#01b9d4' } : {}}
                className={view === 'week' ? 'text-white' : ''}
              >
                Week
              </Button>
              <Button 
                variant={view === 'month' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setView('month')}
                style={view === 'month' ? { backgroundColor: '#01b9d4' } : {}}
                className={view === 'month' ? 'text-white' : ''}
              >
                Month
              </Button>
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

      {/* Week view */}
      {view === 'week' && (
        <div className="grid grid-cols-7 gap-4 mb-6">
          {weekDays.map((day, i) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isToday = isSameDay(new Date(), day);
            const dayAppointments = appointmentsByDate[dateStr] || [];
            
            return (
              <Card 
                key={i}
                className={`${isToday ? 'ring-2 ring-[#01b9d4]' : ''}`}
              >
                <CardHeader className="py-3 px-4 text-center bg-gray-50 rounded-t-lg">
                  <p className="text-xs text-gray-500 uppercase">
                    {format(day, 'EEE')}
                  </p>
                  <p className={`text-lg font-semibold ${isToday ? 'text-[#01b9d4]' : 'text-gray-800'}`}>
                    {format(day, 'd')}
                  </p>
                </CardHeader>
                <CardContent className="p-2 min-h-[300px] max-h-[400px] overflow-y-auto">
                  {dayAppointments.length > 0 ? (
                    <div className="space-y-2">
                      {dayAppointments.map((appointment) => (
                        <motion.div 
                          key={appointment.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className={`p-2 rounded text-sm ${
                            appointment.status === 'confirmed' ? 'bg-green-50 border-l-2 border-green-500' :
                            appointment.status === 'scheduled' ? 'bg-blue-50 border-l-2 border-blue-500' :
                            appointment.status === 'in-progress' ? 'bg-amber-50 border-l-2 border-amber-500' :
                            appointment.status === 'cancelled' ? 'bg-red-50 border-l-2 border-red-500' :
                            'bg-gray-50 border-l-2 border-gray-500'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <p className="font-medium">{appointment.time}</p>
                            <Badge
                              variant={getStatusColor(appointment.status)}
                              size="sm"
                            >
                              {appointment.status}
                            </Badge>
                          </div>
                          <p className="mt-1 font-medium text-gray-800">
                            {appointment.patient?.first_name} {appointment.patient?.last_name}
                          </p>
                          <div className="flex items-center mt-1 text-gray-500">
                            <Clock size={10} className="mr-1" />
                            <span>{appointment.duration} min</span>
                            <span className="mx-1">•</span>
                            <span>{appointment.type}</span>
                          </div>
                          
                          {appointment.status === 'scheduled' && (
                            <div className="mt-2 flex space-x-1">
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="py-0 h-6 text-xs bg-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCheckIn(appointment.id);
                                }}
                              >
                                Check-in
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm"
                                className="py-0 h-6 text-xs bg-white text-red-600"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancel(appointment.id);
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center">
                      <p className="text-xs text-gray-400">No appointments</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Day view */}
      {view === 'day' && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{format(currentDate, 'EEEE, MMMM d, yyyy')}</CardTitle>
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
            ) : (
              <div className="space-y-4">
                {/* Time slots */}
                {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => {
                  const timeAppointments = appointments.filter(a => 
                    a.date === format(currentDate, 'yyyy-MM-dd') && 
                    a.time.startsWith(time.split(':')[0])
                  );
                  
                  return (
                    <div key={time} className="flex">
                      <div className="w-20 py-2 text-right pr-4 text-gray-500 font-medium">
                        {time}
                      </div>
                      <div className="flex-1 min-h-[60px] border-t border-gray-200 pt-2 relative">
                        {timeAppointments.length > 0 ? (
                          timeAppointments.map((appointment) => (
                            <motion.div
                              key={appointment.id}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              className={`
                                absolute left-0 p-2 rounded-r-lg shadow-sm w-[calc(100%-8px)]
                                ${appointment.status === 'confirmed' ? 'bg-green-50 border-l-2 border-green-500' :
                                  appointment.status === 'scheduled' ? 'bg-blue-50 border-l-2 border-blue-500' :
                                  appointment.status === 'in-progress' ? 'bg-amber-50 border-l-2 border-amber-500' :
                                  appointment.status === 'cancelled' ? 'bg-red-50 border-l-2 border-red-500' :
                                  'bg-gray-50 border-l-2 border-gray-500'}
                              `}
                              style={{
                                top: `${(parseInt(appointment.time.split(':')[1]) / 60) * 60}px`,
                                height: `${(appointment.duration / 60) * 60}px`
                              }}
                            >
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-sm">
                                    {appointment.patient?.first_name} {appointment.patient?.last_name}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {appointment.time} • {appointment.type}
                                  </p>
                                </div>
                                <Badge
                                  variant={getStatusColor(appointment.status)}
                                  size="sm"
                                >
                                  {appointment.status}
                                </Badge>
                              </div>
                              
                              {appointment.status === 'scheduled' && (
                                <div className="mt-2 flex space-x-1">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="py-0 h-6 text-xs bg-white"
                                    onClick={() => handleCheckIn(appointment.id)}
                                  >
                                    Check-in
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="py-0 h-6 text-xs bg-white text-red-600"
                                    onClick={() => handleCancel(appointment.id)}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              )}
                            </motion.div>
                          ))
                        ) : null}
                      </div>
                    </div>
                  );
                })}
                
                {appointments.filter(a => a.date === format(currentDate, 'yyyy-MM-dd')).length === 0 && (
                  <div className="text-center py-8">
                    <Calendar size={40} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-gray-500">No appointments scheduled for this day</p>
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
              </div>
            )}
          </CardContent>
        </Card>
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
                .filter(app => ['scheduled', 'confirmed'].includes(app.status))
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
      </div>
    </div>
  );
};

export default Appointments;