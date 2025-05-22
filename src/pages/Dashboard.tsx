import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Calendar, 
  DollarSign,
  Clock,
  User,
  FileText,
  ChevronRight,
  Plus,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfToday } from 'date-fns';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';

interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: string;
  notes?: string;
  patient: {
    first_name: string;
    last_name: string;
  };
  doctor: {
    full_name: string;
  };
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startOfToday());

  useEffect(() => {
    fetchAppointments();
  }, [selectedDate]);

  const fetchAppointments = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:patient_id (
            id,
            first_name,
            last_name
          ),
          doctor:doctor_id (
            id,
            full_name
          )
        `)
        .eq('date', format(selectedDate, 'yyyy-MM-dd'))
        .order('time');

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to load appointments');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      // Start a visit for this appointment
      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert([{
          appointment_id: appointmentId,
          visit_date: format(new Date(), 'yyyy-MM-dd'),
          visit_time: format(new Date(), 'HH:mm:ss'),
          visit_type: 'consultation',
          status: 'in-progress'
        }])
        .select()
        .single();

      if (visitError) throw visitError;

      // Update appointment status
      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'in-progress' })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      // Refresh appointments
      fetchAppointments();

      // Navigate to the visit page
      if (visitData) {
        navigate(`/visits/${visitData.id}`);
      }
    } catch (error) {
      console.error('Error checking in appointment:', error);
      alert('Failed to check in appointment');
    }
  };

  const handleCancel = async (appointmentId: string) => {
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      if (error) throw error;
      fetchAppointments();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'azure';
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'scheduled':
        return <Clock size={16} />;
      case 'in-progress':
        return <Activity size={16} />;
      case 'completed':
        return <CheckCircle2 size={16} />;
      case 'cancelled':
        return <XCircle size={16} />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-brand-light text-brand-primary">
                <Users size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <h3 className="text-2xl font-bold text-gray-900">2,420</h3>
                <p className="text-xs text-success-600">↑ 20% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                <Calendar size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Today's Appointments</p>
                <h3 className="text-2xl font-bold text-gray-900">{appointments.length}</h3>
                <p className="text-xs text-success-600">↑ 12% from yesterday</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-green-100 text-green-600">
                <Activity size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Consultations</p>
                <h3 className="text-2xl font-bold text-gray-900">
                  {appointments.filter(a => a.status === 'in-progress').length}
                </h3>
                <p className="text-xs text-success-600">↑ 5% from average</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-3 rounded-full bg-amber-100 text-amber-600">
                <DollarSign size={24} />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue (Month)</p>
                <h3 className="text-2xl font-bold text-gray-900">$12,500</h3>
                <p className="text-xs text-success-600">↑ 18% from last month</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Add Bar */}
      <Card className="bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div>
              <h2 className="text-xl font-bold">Quick Actions</h2>
              <p className="text-white/80">Schedule appointments and manage patient visits</p>
            </div>
            <div className="mt-4 md:mt-0">
              <Button 
                onClick={() => setIsAddAppointmentModalOpen(true)}
                className="bg-white text-[#01b9d4] hover:bg-white/90"
              >
                <Plus size={16} className="mr-2" />
                New Appointment
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Date Navigation */}
      <div className="flex items-center justify-between">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setSelectedDate(prev => addDays(prev, -1))}
        >
          <ArrowLeft size={16} className="mr-2" />
          Previous Day
        </Button>
        
        <h2 className="text-lg font-medium text-gray-900">
          {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          {format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
            <span className="ml-2 text-sm bg-brand-primary/10 text-brand-primary px-2 py-1 rounded-full">
              Today
            </span>
          )}
        </h2>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setSelectedDate(prev => addDays(prev, 1))}
        >
          Next Day
          <ArrowRight size={16} className="ml-2" />
        </Button>
      </div>

      {/* Today's Appointments */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Today's Appointments</CardTitle>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/appointments')}
          >
            View All
          </Button>
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
          ) : appointments.length > 0 ? (
            <div className="space-y-4">
              {appointments.map((appointment) => (
                <div 
                  key={appointment.id}
                  className={`
                    flex items-center justify-between p-4 rounded-lg
                    ${appointment.status === 'scheduled' ? 'bg-blue-50 border-l-4 border-blue-500' : 
                      appointment.status === 'in-progress' ? 'bg-green-50 border-l-4 border-green-500' : 
                      appointment.status === 'cancelled' ? 'bg-red-50 border-l-4 border-red-500' : 
                      'bg-gray-50 border-l-4 border-gray-500'}
                  `}
                >
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                        <User size={20} className={`
                          ${appointment.status === 'scheduled' ? 'text-blue-500' : 
                            appointment.status === 'in-progress' ? 'text-green-500' : 
                            appointment.status === 'cancelled' ? 'text-red-500' : 
                            'text-gray-500'}
                        `} />
                      </div>
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {appointment.patient.first_name} {appointment.patient.last_name}
                      </h3>
                      <div className="flex items-center text-sm text-gray-500">
                        <Clock size={14} className="mr-1" />
                        {appointment.time} • {appointment.type} • {appointment.doctor?.full_name || 'No doctor assigned'}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={getStatusColor(appointment.status)}
                      size="sm"
                      className="flex items-center space-x-1"
                    >
                      {getStatusIcon(appointment.status)}
                      <span className="ml-1">{appointment.status}</span>
                    </Badge>
                    
                    {appointment.status === 'scheduled' && (
                      <>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-white"
                          onClick={() => handleCheckIn(appointment.id)}
                        >
                          Check-in
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="bg-white text-red-600 hover:bg-red-50"
                          onClick={() => handleCancel(appointment.id)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                    
                    {appointment.status === 'in-progress' && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-white"
                        onClick={() => navigate(`/patients/${appointment.patient_id}`)}
                      >
                        View Patient
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Calendar size={40} className="mx-auto text-gray-300" />
              <p className="mt-2 text-gray-500">No appointments scheduled for today</p>
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

      {/* Recent Activity */}
      <Card>
        <CardHeader className="flex justify-between items-center">
          <CardTitle>Recent Activity</CardTitle>
          <Button variant="ghost" size="sm">
            View All
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex-shrink-0 mt-1">
                <FileText size={16} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    New patient registered
                  </p>
                  <span className="text-xs text-gray-500">
                    2 hours ago
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  John Doe was registered as a new patient
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
            
            <div className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex-shrink-0 mt-1">
                <FileText size={16} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    Lab results uploaded
                  </p>
                  <span className="text-xs text-gray-500">
                    3 hours ago
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  Lab results for Sarah Johnson have been uploaded
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
            
            <div className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors">
              <div className="flex-shrink-0 mt-1">
                <FileText size={16} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-900">
                    Appointment rescheduled
                  </p>
                  <span className="text-xs text-gray-500">
                    5 hours ago
                  </span>
                </div>
                <p className="text-sm text-gray-500 truncate">
                  Michael Brown's appointment was rescheduled to tomorrow
                </p>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
          </div>
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
  );
};

export default Dashboard;