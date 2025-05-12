import React, { useState } from 'react';
import { 
  Calendar, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  User,
  Clock,
  Filter,
  MoreVertical
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { useAppointmentsStore } from '../stores/appointmentsStore';
import { usePatientsStore } from '../stores/patientsStore';
import Badge from '../components/ui/Badge';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfWeek, addWeeks, subWeeks, parseISO } from 'date-fns';

const Appointments: React.FC = () => {
  const { appointments } = useAppointmentsStore();
  const { patients } = usePatientsStore();
  const navigate = useNavigate();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week' | 'month'>('week');
  
  // Generate dates for week view
  const startOfCurrentWeek = startOfWeek(currentDate);
  const weekDays = [...Array(7)].map((_, i) => addDays(startOfCurrentWeek, i));
  
  // Go to previous/next week
  const goToPreviousWeek = () => setCurrentDate(subWeeks(currentDate, 1));
  const goToNextWeek = () => setCurrentDate(addWeeks(currentDate, 1));
  
  // Filter appointments for the current week
  const currentWeekAppointments = appointments.filter(appointment => {
    const appointmentDate = parseISO(appointment.date);
    const weekStart = startOfWeek(currentDate);
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

  // Find patient by ID
  const getPatientById = (id: string) => {
    return patients.find(patient => patient.id === id);
  };

  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row items-center justify-between mb-6">
        <div className="flex items-center">
          <Calendar size={28} className="text-primary-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
            <p className="text-gray-600">Manage your schedule and patient appointments</p>
          </div>
        </div>
        <div className="mt-4 md:mt-0 flex space-x-3">
          <Button variant="outline">
            <Filter size={16} className="mr-2" />
            Filter
          </Button>
          <Button>
            <Plus size={16} className="mr-2" />
            New Appointment
          </Button>
        </div>
      </div>

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
              >
                Day
              </Button>
              <Button 
                variant={view === 'week' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setView('week')}
              >
                Week
              </Button>
              <Button 
                variant={view === 'month' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setView('month')}
              >
                Month
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Week view */}
      <div className="grid grid-cols-7 gap-4 mb-6">
        {weekDays.map((day, i) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
          const dayAppointments = appointmentsByDate[dateStr] || [];
          
          return (
            <Card 
              key={i}
              className={`${isToday ? 'ring-2 ring-primary-500' : ''}`}
            >
              <CardHeader className="py-3 px-4 text-center bg-gray-50 rounded-t-lg">
                <p className="text-xs text-gray-500 uppercase">
                  {format(day, 'EEE')}
                </p>
                <p className={`text-lg font-semibold ${isToday ? 'text-primary-600' : 'text-gray-800'}`}>
                  {format(day, 'd')}
                </p>
              </CardHeader>
              <CardContent className="p-2 min-h-[200px]">
                {dayAppointments.length > 0 ? (
                  <div className="space-y-2">
                    {dayAppointments.map((appointment) => {
                      const patient = getPatientById(appointment.patientId);
                      
                      return (
                        <div 
                          key={appointment.id}
                          className={`p-2 rounded text-xs ${
                            appointment.status === 'confirmed' ? 'bg-success-50 border-l-2 border-success-500' :
                            appointment.status === 'scheduled' ? 'bg-warning-50 border-l-2 border-warning-500' :
                            appointment.status === 'cancelled' ? 'bg-error-50 border-l-2 border-error-500' :
                            'bg-gray-50 border-l-2 border-gray-500'
                          }`}
                          onClick={() => navigate(`/patients/${appointment.patientId}`)}
                        >
                          <div className="flex justify-between items-start">
                            <p className="font-medium">{appointment.time}</p>
                            <Button variant="ghost" size="sm" className="h-5 w-5 p-0">
                              <MoreVertical size={12} />
                            </Button>
                          </div>
                          <p className="mt-1 font-medium text-gray-800">
                            {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                          </p>
                          <div className="flex items-center mt-1 text-gray-500">
                            <Clock size={10} className="mr-1" />
                            <span>{appointment.duration} min</span>
                          </div>
                        </div>
                      );
                    })}
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

      {/* Upcoming appointments list */}
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Appointments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {appointments
              .filter(app => app.status === 'scheduled' || app.status === 'confirmed')
              .slice(0, 5)
              .map((appointment) => {
                const patient = getPatientById(appointment.patientId);
                
                return (
                  <div 
                    key={appointment.id}
                    className="flex items-center justify-between p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/patients/${appointment.patientId}`)}
                  >
                    <div className="flex items-center">
                      {patient?.avatar ? (
                        <img 
                          src={patient.avatar} 
                          alt={`${patient.firstName} ${patient.lastName}`}
                          className="w-10 h-10 rounded-full object-cover mr-4"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-4">
                          <User size={16} className="text-gray-500" />
                        </div>
                      )}
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-900">
                          {patient ? `${patient.firstName} ${patient.lastName}` : 'Unknown Patient'}
                        </h4>
                        <p className="text-xs text-gray-500">
                          {appointment.date} at {appointment.time} • {appointment.type}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <Badge
                        variant={
                          appointment.status === 'confirmed' ? 'success' :
                          appointment.status === 'scheduled' ? 'warning' : 'gray'
                        }
                        size="sm"
                        className="mr-3"
                      >
                        {appointment.status}
                      </Badge>
                      <Button variant="ghost" size="sm">
                        <MoreVertical size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Appointments;