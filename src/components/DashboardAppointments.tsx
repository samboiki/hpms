import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppointmentsStore } from '../stores/appointmentsStore';
import { format } from 'date-fns';
import { 
  User, 
  Clock, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Plus
} from 'lucide-react';
import Button from './ui/Button';
import Badge from './ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import FormModal from './modals/FormModal';
import AddAppointmentForm from './forms/AddAppointmentForm';

const DashboardAppointments: React.FC = () => {
  const navigate = useNavigate();
  const { appointments, fetchAppointments, checkInAppointment, cancelAppointment, isLoading, error } = useAppointmentsStore();
  const [isAddAppointmentModalOpen, setIsAddAppointmentModalOpen] = useState(false);
  
  useEffect(() => {
    // Fetch today's appointments
    fetchAppointments(format(new Date(), 'yyyy-MM-dd'));
  }, [fetchAppointments]);

  const handleCheckIn = async (appointmentId: string) => {
    const visitId = await checkInAppointment(appointmentId);
    if (visitId) {
      const appointment = appointments.find(a => a.id === appointmentId);
      if (appointment?.patient_id) {
        navigate(`/patients/${appointment.patient_id}`);
      }
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
    <Card>
      <CardHeader className="flex justify-between items-center">
        <CardTitle className="flex items-center">
          <Calendar size={20} className="mr-2 text-[#01b9d4]" />
          Today's Appointments
        </CardTitle>
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setIsAddAppointmentModalOpen(true)}
        >
          <Plus size={16} className="mr-2" />
          New Appointment
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
                    appointment.status === 'confirmed' ? 'bg-green-50 border-l-4 border-green-500' :
                    appointment.status === 'in-progress' ? 'bg-amber-50 border-l-4 border-amber-500' :
                    appointment.status === 'cancelled' ? 'bg-red-50 border-l-4 border-red-500' :
                    'bg-gray-50 border-l-4 border-gray-500'}
                `}
              >
                <div className="flex items-center space-x-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center">
                      <User size={20} className={`
                        ${appointment.status === 'scheduled' ? 'text-blue-500' : 
                          appointment.status === 'confirmed' ? 'text-green-500' :
                          appointment.status === 'in-progress' ? 'text-amber-500' :
                          appointment.status === 'cancelled' ? 'text-red-500' :
                          'text-gray-500'}
                      `} />
                    </div>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">
                      {appointment.patient?.first_name} {appointment.patient?.last_name}
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
                  >
                    {appointment.status}
                  </Badge>
                  
                  {appointment.status === 'scheduled' && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-white"
                        onClick={() => handleCheckIn(appointment.id)}
                      >
                        <CheckCircle2 size={14} className="mr-1" />
                        Check-in
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="bg-white text-red-600 hover:bg-red-50"
                        onClick={() => handleCancel(appointment.id)}
                      >
                        <XCircle size={14} className="mr-1" />
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

      {/* Add Appointment Modal */}
      <FormModal
        isOpen={isAddAppointmentModalOpen}
        onClose={() => setIsAddAppointmentModalOpen(false)}
        title="Schedule New Appointment"
      >
        <AddAppointmentForm 
          onSuccess={() => {
            setIsAddAppointmentModalOpen(false);
            fetchAppointments(format(new Date(), 'yyyy-MM-dd'));
          }}
        />
      </FormModal>
    </Card>
  );
};

export default DashboardAppointments;