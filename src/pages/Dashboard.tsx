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
import { format, addDays, startOfToday, setHours, setMinutes } from 'date-fns';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';
import { AppointmentTimeline } from '../components/DashboardAppointments';

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

  const handleView = async (appt: Appointment) => {
    try {
      // Get the visit for this appointment
      const { data, error } = await supabase
        .from('visits')
        .select('id')
        .eq('appointment_id', appt.id)
        .eq('status', 'in-progress')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        throw error;
      }

      if (data) {
        // Visit exists, navigate to it
        navigate(`/visits/${data.id}`);
      } else {
        // No visit, create one
        const { data: visitData, error: visitError } = await supabase
          .from('visits')
          .insert([{
            appointment_id: appt.id,
            patient_id: appt.patient_id,
            doctor_id: appt.doctor_id,
            visit_date: appt.date,
            visit_time: appt.time,
            visit_type: appt.type,
            status: 'in-progress'
          }])
          .select()
          .single();

        if (visitError) throw visitError;

        // Update appointment status
        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'in-progress' })
          .eq('id', appt.id);

        if (appointmentError) throw appointmentError;

        // Navigate to the visit
        navigate(`/visits/${visitData.id}`);
      }
    } catch (err) {
      console.error('Error opening visit:', err);
      alert('Could not create/open visit');
    }
  };

  return (
    <div className="grid grid-cols-12 gap-6 h-full p-6">
      {/* === MAIN COLUMN (stats, quick actions, whatever) === */}
      <div className="col-span-12 xl:col-span-8 space-y-6 overflow-y-auto pr-2">
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
      </div>

      {/* === TIMELINE COLUMN === */}
      <div className="col-span-12 xl:col-span-4 h-full flex flex-col">
        <AppointmentTimeline
          date={selectedDate}
          onCheckIn={handleCheckIn}
          onCancel={handleCancel}
          onView={handleView}
          isLoading={isLoading}
          error={error}
          appointments={appointments}
        />
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
            fetchAppointments();
          }}
        />
      </FormModal>
    </div>
  );
};

export default Dashboard;