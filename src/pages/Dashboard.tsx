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
  ChevronLeft,
  ChevronRight,
  XCircle,
  Search,
  Filter,
  Building2,
  ArrowUpDown,
  MoreVertical,
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

      const { error: appointmentError } = await supabase
        .from('appointments')
        .update({ status: 'in-progress' })
        .eq('id', appointmentId);

      if (appointmentError) throw appointmentError;

      fetchAppointments();

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
        navigate(`/visits/${data.id}`);
      } else {
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

        const { error: appointmentError } = await supabase
          .from('appointments')
          .update({ status: 'in-progress' })
          .eq('id', appt.id);

        if (appointmentError) throw appointmentError;

        navigate(`/visits/${visitData.id}`);
      }
    } catch (err) {
      console.error('Error opening visit:', err);
      alert('Could not create/open visit');
    }
  };

  // Calculate statistics
  const todayPatients = appointments.filter(a => a.status !== 'cancelled').length;
  const seenPatients = appointments.filter(a => a.status === 'completed').length;
  const inProgressPatients = appointments.filter(a => a.status === 'in-progress').length;
  const waitingPatients = appointments.filter(a => a.status === 'scheduled' || a.status === 'confirmed').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header Section with Welcome and Quick Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Welcome Card */}
        <Card className="lg:col-span-1 bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white">
          <CardContent className="p-6">
            <div className="flex items-center space-x-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Building2 size={24} className="text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Welcome Back</h2>
                <p className="text-white/80">Today is {format(new Date(), 'EEEE, MMMM d')}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button 
                className="bg-white/20 hover:bg-white/30 text-white border-none"
                onClick={() => setIsAddAppointmentModalOpen(true)}
              >
                <Calendar size={16} className="mr-2" />
                New Appointment
              </Button>
              <Button 
                className="bg-white/20 hover:bg-white/30 text-white border-none"
                onClick={() => navigate('/patients')}
              >
                <Users size={16} className="mr-2" />
                View Patients
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-blue-100 text-blue-600">
                  <Users size={20} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Today's Patients</p>
                  <div className="flex items-baseline">
                    <h3 className="text-2xl font-bold text-gray-900">{todayPatients}</h3>
                    <div className="ml-2 flex space-x-2 text-xs">
                      <span className="text-green-600">{seenPatients} Seen</span>
                      <span className="text-amber-600">{inProgressPatients} In Progress</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-purple-100 text-purple-600">
                  <Microscope size={20} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Lab Results</p>
                  <div className="flex items-baseline">
                    <h3 className="text-2xl font-bold text-gray-900">12</h3>
                    <span className="ml-2 text-xs text-purple-600">4 Pending</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white shadow-md hover:shadow-lg transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="p-3 rounded-full bg-rose-100 text-rose-600">
                  <ImageIcon size={20} />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-500">Imaging</p>
                  <div className="flex items-baseline">
                    <h3 className="text-2xl font-bold text-gray-900">8</h3>
                    <span className="ml-2 text-xs text-rose-600">3 Pending</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column - Quick Actions & Tasks */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Actions Card */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Activity size={18} className="mr-2 text-[#01b9d4]" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-2">
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200"
                  onClick={() => setIsAddAppointmentModalOpen(true)}
                >
                  <Calendar size={16} className="mr-2 text-blue-500" />
                  New Appointment
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-green-50 hover:text-green-700 hover:border-green-200"
                  onClick={() => navigate('/patients')}
                >
                  <Users size={16} className="mr-2 text-green-500" />
                  Register Patient
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-purple-50 hover:text-purple-700 hover:border-purple-200"
                  onClick={() => navigate('/requests')}
                >
                  <Microscope size={16} className="mr-2 text-purple-500" />
                  Lab Orders
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full justify-start hover:bg-amber-50 hover:text-amber-700 hover:border-amber-200"
                  onClick={() => navigate('/finance')}
                >
                  <FileText size={16} className="mr-2 text-amber-500" />
                  Create Invoice
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Critical Tasks Card */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center">
                <AlertCircle size={18} className="mr-2 text-amber-500" />
                Critical Tasks
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Microscope size={16} className="text-amber-600 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Blood Test Results</p>
                        <p className="text-xs text-gray-500">John Smith • STAT</p>
                      </div>
                    </div>
                    <Badge variant="warning" size="sm">Urgent</Badge>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                      Review
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <ImageIcon size={16} className="text-purple-600 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">X-Ray Review</p>
                        <p className="text-xs text-gray-500">Sarah Johnson • Chest</p>
                      </div>
                    </div>
                    <Badge variant="azure" size="sm">Pending</Badge>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                      View
                    </Button>
                  </div>
                </div>

                <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Pill size={16} className="text-rose-600 mr-2 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-900">Prescription Renewal</p>
                        <p className="text-xs text-gray-500">Michael Brown • Expires Today</p>
                      </div>
                    </div>
                    <Badge variant="error" size="sm">Critical</Badge>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="outline" size="sm" className="text-xs h-7 px-2">
                      Process
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's Doctors Card */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <CardTitle className="text-lg font-semibold flex items-center">
                <Stethoscope size={18} className="mr-2 text-green-500" />
                Today's Doctors
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <User size={16} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Dr. Sarah Johnson</p>
                      <p className="text-xs text-gray-500">8 Appointments</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm">Available</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
                      <User size={16} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Dr. Michael Chen</p>
                      <p className="text-xs text-gray-500">5 Appointments</p>
                    </div>
                  </div>
                  <Badge variant="success" size="sm">Available</Badge>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center mr-3">
                      <User size={16} className="text-gray-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">Dr. Emily Wilson</p>
                      <p className="text-xs text-gray-500">3 Appointments</p>
                    </div>
                  </div>
                  <Badge variant="glass" size="sm">On Leave</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Appointment Timeline */}
        <div className="lg:col-span-3 space-y-6">
          {/* Search & Filter Bar */}
          <Card className="bg-white shadow-md">
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search appointments or patients..."
                    className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-[#01b9d4] focus:border-[#01b9d4]"
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="flex items-center"
                  >
                    <Filter size={16} className="mr-2" />
                    Filter
                  </Button>
                  <Button 
                    onClick={() => setIsAddAppointmentModalOpen(true)}
                    className="bg-[#01b9d4] text-white hover:bg-opacity-90"
                  >
                    <Plus size={16} className="mr-2" />
                    New Appointment
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Appointment Timeline */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Calendar size={18} className="mr-2 text-[#01b9d4]" />
                  Appointment Schedule
                </CardTitle>
                <div className="flex items-center space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => onDateChange(subDays(date, 1))}
                  >
                    <ChevronLeft size={14} className="mr-1" />
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => onDateChange(new Date())}
                  >
                    Today
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="text-xs"
                    onClick={() => onDateChange(addDays(date, 1))}
                  >
                    Next
                    <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="h-[600px]"> {/* Fixed height for timeline */}
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
            </CardContent>
          </Card>

          {/* Upcoming Appointments Summary */}
          <Card className="bg-white shadow-md">
            <CardHeader className="pb-2 border-b border-gray-100">
              <div className="flex justify-between items-center">
                <CardTitle className="text-lg font-semibold flex items-center">
                  <Clock size={18} className="mr-2 text-amber-500" />
                  Upcoming Appointments
                </CardTitle>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="text-xs"
                  onClick={() => navigate('/appointments')}
                >
                  View All
                  <ArrowRight size={14} className="ml-1" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-3">
                {appointments
                  .filter(a => ['scheduled', 'confirmed'].includes(a.status))
                  .slice(0, 3)
                  .map((appointment) => (
                    <div 
                      key={appointment.id}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                      onClick={() => handleView(appointment)}
                    >
                      <div className="flex items-center">
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                          <User size={18} className="text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {appointment.patient.first_name} {appointment.patient.last_name}
                          </p>
                          <div className="flex items-center text-xs text-gray-500">
                            <Clock size={12} className="mr-1" />
                            {appointment.time} • {appointment.type}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center">
                        <Badge
                          variant={appointment.status === 'scheduled' ? 'azure' : 'success'}
                          size="sm"
                          className="mr-3"
                        >
                          {appointment.status}
                        </Badge>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical size={16} />
                        </Button>
                      </div>
                    </div>
                  ))}

                {appointments.filter(a => ['scheduled', 'confirmed'].includes(a.status)).length === 0 && (
                  <div className="text-center py-6">
                    <Calendar size={32} className="mx-auto text-gray-300 mb-2" />
                    <p className="text-gray-500">No upcoming appointments</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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
            fetchAppointments();
          }}
        />
      </FormModal>
    </div>
  );
};

export default Dashboard;