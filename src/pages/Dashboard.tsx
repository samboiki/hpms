import React, { useState, useEffect } from 'react';
import { 
  Activity, 
  Users, 
  Calendar,
  Microscope,
  AlertCircle,
  Plus,
  Stethoscope,
  FileText,
  Clock,
  User,
  Heart,
  ArrowRight,
  Pill,
  ImageIcon,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import { supabase } from '../lib/supabase';
import { useNavigate } from 'react-router-dom';
import { format, addDays, startOfToday, setHours, setMinutes } from 'date-fns';
import FormModal from '../components/modals/FormModal';
import AddAppointmentForm from '../components/forms/AddAppointmentForm';
import { AppointmentTimeline } from '../components/AppointmentTimeline';

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
      {/* Left Column - Quick Stats and Actions */}
      <div className="col-span-12 xl:col-span-3 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-4">
          <Card className="col-span-2">
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <Clock size={24} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Today's Patients</p>
                  <h3 className="text-2xl font-bold text-gray-900">
                    {appointments.filter(a => a.status !== 'cancelled').length}
                  </h3>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-emerald-600">
                      {appointments.filter(a => a.status === 'completed').length} Seen
                    </span>
                    <span className="text-xs text-amber-600">
                      {appointments.filter(a => a.status === 'in-progress').length} In Progress
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                  <Microscope size={24} />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Lab Results</p>
                  <h3 className="text-2xl font-bold text-gray-900">12</h3>
                  <p className="text-xs text-purple-600">4 Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-rose-100 text-rose-600">
                  <ImageIcon size={24} />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-gray-600">Imaging</p>
                  <h3 className="text-2xl font-bold text-gray-900">8</h3>
                  <p className="text-xs text-rose-600">3 Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setIsAddAppointmentModalOpen(true)}
              >
                <Calendar size={16} className="mr-2 text-blue-500" />
                New Appointment
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/patients/new')}
              >
                <Users size={16} className="mr-2 text-green-500" />
                Register Patient
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => navigate('/requests')}
              >
                <Microscope size={16} className="mr-2 text-purple-500" />
                Lab Orders
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pending Tasks */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Pending Tasks</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex items-center">
                  <Microscope size={16} className="text-amber-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">Blood Test Results</p>
                    <p className="text-xs text-gray-500">John Smith</p>
                  </div>
                </div>
                <Badge variant="warning" size="sm">Urgent</Badge>
              </div>

              <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-center">
                  <ImageIcon size={16} className="text-purple-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">X-Ray Review</p>
                    <p className="text-xs text-gray-500">Sarah Johnson</p>
                  </div>
                </div>
                <Badge variant="azure" size="sm">Pending</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Appointment Timeline */}
      <div className="col-span-12 xl:col-span-9 h-full">
        <AppointmentTimeline
          date={selectedDate}
          onDateChange={setSelectedDate}
          onUpdateAppointment={async (id, updates) => {
            try {
              const { error } = await supabase
                .from('appointments')
                .update(updates)
                .eq('id', id);
              
              if (error) throw error;
              fetchAppointments();
            } catch (err) {
              console.error('Error updating appointment:', err);
              throw err;
            }
          }}
          onView={handleView}
          isLoading={isLoading}
          error={error}
          appointments={appointments}
          onCreateAppointment={(date, time) => {
            setIsAddAppointmentModalOpen(true);
          }}
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