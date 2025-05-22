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
import DashboardAppointments from '../components/DashboardAppointments';

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
  } | null;
  doctor: {
    full_name: string;
  } | null;
}

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [recentVisits, setRecentVisits] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedDate]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch today's appointments
      const { data: appointmentsData, error: appointmentsError } = await supabase
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

      if (appointmentsError) throw appointmentsError;
      setAppointments(appointmentsData || []);

      // Fetch recent visits
      const { data: visitsData, error: visitsError } = await supabase
        .from('visits')
        .select(`
          id,
          visit_date,
          visit_time,
          visit_type,
          status,
          chief_complaint,
          patient:patient_id (
            id,
            first_name,
            last_name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (visitsError) throw visitsError;
      setRecentVisits(visitsData || []);

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async (appointmentId: string) => {
    try {
      // Start a visit for this appointment
      const { data: appointmentData, error: appointmentFetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (appointmentFetchError) throw appointmentFetchError;

      const { data: visitData, error: visitError } = await supabase
        .from('visits')
        .insert([{
          appointment_id: appointmentId,
          patient_id: appointmentData.patient_id,
          doctor_id: appointmentData.doctor_id,
          visit_date: format(new Date(), 'yyyy-MM-dd'),
          visit_time: format(new Date(), 'HH:mm:ss'),
          visit_type: appointmentData.type,
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
      fetchDashboardData();

      // Navigate to the patient page
      navigate(`/patients/${appointmentData.patient_id}`);
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
      fetchDashboardData();
    } catch (error) {
      console.error('Error cancelling appointment:', error);
      alert('Failed to cancel appointment');
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <CardTitle>Recent Activity</CardTitle>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentVisits.length > 0 ? (
                  recentVisits.map((visit) => (
                    <div 
                      key={visit.id}
                      className="flex items-start space-x-4 p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                      onClick={() => visit.patient?.id && navigate(`/patients/${visit.patient.id}`)}
                    >
                      <div className="flex-shrink-0 mt-1">
                        <FileText size={16} className="text-gray-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium text-gray-900">
                            {visit.patient?.first_name} {visit.patient?.last_name}
                          </p>
                          <span className="text-xs text-gray-500">
                            {new Date(visit.visit_date).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-sm text-gray-500 truncate">
                          {visit.chief_complaint || `${visit.visit_type} visit`}
                        </p>
                      </div>
                      <ChevronRight size={16} className="text-gray-400" />
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <Activity size={40} className="mx-auto text-gray-300" />
                    <p className="mt-2 text-gray-500">No recent activity</p>
                  </div>
                )}
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

          {/* Time Slots */}
          <Card>
            <CardHeader>
              <CardTitle>Daily Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'].map((time) => {
                  const timeAppointments = appointments.filter(a => 
                    a.time.startsWith(time.split(':')[0])
                  );
                  
                  return (
                    <div key={time} className="flex group hover:bg-gray-50">
                      <div className="w-20 py-4 text-right pr-4 text-gray-500 font-medium border-r border-gray-200 group-hover:text-brand-primary">
                        {time}
                      </div>
                      <div className="flex-1 min-h-[60px] border-b border-gray-100 py-2 px-4 relative">
                        {timeAppointments.length > 0 ? (
                          <div className="space-y-2">
                            {timeAppointments.map((appointment) => (
                              <div
                                key={appointment.id}
                                className={`
                                  p-2 rounded-lg shadow-sm
                                  ${appointment.status === 'scheduled' ? 'bg-blue-50 border-l-2 border-blue-500' : 
                                    appointment.status === 'confirmed' ? 'bg-green-50 border-l-2 border-green-500' :
                                    appointment.status === 'in-progress' ? 'bg-amber-50 border-l-2 border-amber-500' :
                                    appointment.status === 'cancelled' ? 'bg-red-50 border-l-2 border-red-500' :
                                    'bg-gray-50 border-l-2 border-gray-500'}
                                `}
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
                                  <div className="flex space-x-1">
                                    {appointment.status === 'scheduled' && (
                                      <>
                                        <Button 
                                          variant="outline" 
                                          size="sm"
                                          className="py-0 h-6 text-xs bg-white"
                                          onClick={() => handleCheckIn(appointment.id)}
                                        >
                                          Check-in
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Today's Appointments */}
        <div className="lg:col-span-1 h-full">
          <DashboardAppointments />
        </div>
      </div>

      {/* Add Appointment Modal */}
      <FormModal
        isOpen={isAddAppointmentModalOpen}
        onClose={() => setIsAddAppointmentModalOpen(false)}
        title="Schedule New Appointment"
      >
        <AddAppointmentForm 
          onSuccess={() => {
            setIsAddAppointmentModalOpen(false);
            fetchDashboardData();
          }}
        />
      </FormModal>
    </div>
  );
};

export default Dashboard;