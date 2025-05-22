import React from 'react';
import Modal from 'react-modal';
import { 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  MessageCircle, 
  UserCog,
  Clock,
  Calendar,
  Edit3,
  X
} from 'lucide-react';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { format } from 'date-fns';

interface Appointment {
  id: string;
  patient_id: string;
  date: string;
  time: string;
  duration: number;
  type: string;
  status: string;
  notes?: string;
  patient?: {
    first_name: string;
    last_name: string;
  };
  doctor?: {
    full_name: string;
  };
}

interface AppointmentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment;
  onStatusChange: (status: string) => void;
  onEdit: () => void;
  onMessage: () => void;
}

const AppointmentActionModal: React.FC<AppointmentActionModalProps> = ({
  isOpen,
  onClose,
  appointment,
  onStatusChange,
  onEdit,
  onMessage
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'bg-blue-50 text-blue-700 border-blue-200';
      case 'confirmed':
        return 'bg-green-50 text-green-700 border-green-200';
      case 'cancelled':
        return 'bg-red-50 text-red-700 border-red-200';
      case 'completed':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'no-show':
        return 'bg-gray-50 text-gray-700 border-gray-200';
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200';
    }
  };

  const getEndTime = (startTime: string, duration: number) => {
    const [hours, minutes] = startTime.split(':').map(Number);
    const date = new Date();
    date.setHours(hours, minutes);
    date.setMinutes(date.getMinutes() + duration);
    return format(date, 'HH:mm');
  };

  return (
    <Modal
      isOpen={isOpen}
      onRequestClose={onClose}
      className="fixed inset-0 flex items-center justify-center p-4"
      overlayClassName="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
      style={{
        content: {
          position: 'relative',
          border: 'none',
          background: 'none',
          overflow: 'visible',
          borderRadius: '0.75rem',
          outline: 'none',
          padding: '0',
        }
      }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#01b9d4] to-[#0197d4] p-6 text-white">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">
                {appointment.patient?.first_name} {appointment.patient?.last_name}
              </h2>
              <div className="flex items-center mt-2 space-x-4 text-white/80">
                <div className="flex items-center">
                  <Calendar size={16} className="mr-2" />
                  {format(new Date(appointment.date), 'MMMM d, yyyy')}
                </div>
                <div className="flex items-center">
                  <Clock size={16} className="mr-2" />
                  {appointment.time} - {getEndTime(appointment.time, appointment.duration)}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          <div className="mt-4">
            <Badge
              variant={
                appointment.status === 'scheduled' ? 'azure' :
                appointment.status === 'confirmed' ? 'success' :
                appointment.status === 'cancelled' ? 'error' :
                appointment.status === 'completed' ? 'success' :
                'glass'
              }
              size="sm"
              className="uppercase tracking-wider"
            >
              {appointment.status}
            </Badge>
          </div>
        </div>

        {/* Actions */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="flex items-center justify-center p-4"
              onClick={() => onStatusChange('confirmed')}
              disabled={appointment.status === 'confirmed'}
            >
              <CheckCircle2 size={24} className="mb-2 text-green-600" />
              <span>Check In</span>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-center p-4"
              onClick={() => onStatusChange('cancelled')}
              disabled={appointment.status === 'cancelled'}
            >
              <XCircle size={24} className="mb-2 text-red-600" />
              <span>Cancel</span>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-center p-4"
              onClick={() => onStatusChange('no-show')}
              disabled={appointment.status === 'no-show'}
            >
              <AlertTriangle size={24} className="mb-2 text-orange-600" />
              <span>Mark No-Show</span>
            </Button>

            <Button
              variant="outline"
              className="flex items-center justify-center p-4"
              onClick={onMessage}
            >
              <MessageCircle size={24} className="mb-2 text-blue-600" />
              <span>Message Patient</span>
            </Button>
          </div>

          <div className="border-t border-gray-100 pt-4 flex justify-between">
            <Button
              variant="outline"
              onClick={onEdit}
              className="flex items-center"
            >
              <Edit3 size={16} className="mr-2" />
              Edit Appointment
            </Button>

            <Button
              onClick={() => onStatusChange('completed')}
              disabled={appointment.status === 'completed'}
              className="flex items-center bg-[#01b9d4] text-white hover:bg-opacity-90"
            >
              <UserCog size={16} className="mr-2" />
              Send to Doctor
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default AppointmentActionModal;