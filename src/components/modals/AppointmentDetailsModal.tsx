import React from 'react';
import { X, Phone, Mail, Calendar, Clock, User, FileText, MapPin, Activity, CheckCircle, XCircle, Edit3, AlertCircle } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Badge from '../ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../stores/themeStore';

interface AppointmentDetailsModalProps {
  appointment: {
    id: string;
    patient_id: string;
    doctor_id: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show' | 'ready';
    notes?: string;
    patient: {
      id: string;
      first_name: string;
      last_name: string;
      cell_number?: string;
      date_of_birth?: string;
      gender?: string;
    };
    doctor?: {
      id: string;
      full_name: string;
    };
  };
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (appointment: any) => void;
  onCancel?: (appointmentId: string) => void;
  onComplete?: (appointmentId: string) => void;
  onStartVisit?: (appointmentId: string) => void;
  onCompleteVisit?: (appointmentId: string) => void;
  canEdit?: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending':
      return 'amber';
    case 'scheduled':
      return 'azure';
    case 'in-progress':
      return 'amber';
    case 'completed':
      return 'slate';
    case 'cancelled':
      return 'coral';
    case 'no-show':
      return 'orange';
    default:
      return 'slate';
  }
};

const AppointmentDetailsModal: React.FC<AppointmentDetailsModalProps> = ({
  appointment,
  isOpen,
  onClose,
  onEdit,
  onCancel,
  onComplete: _onComplete, // Deprecated - use onStartVisit instead
  onStartVisit,
  onCompleteVisit,
  canEdit = false,
}) => {
  const { currentTheme } = useTheme();
  if (!isOpen) return null;

  const getAge = (dateOfBirth?: string) => {
    if (!dateOfBirth) return 'N/A';
    const birth = parseISO(dateOfBirth);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      return age - 1;
    }
    return age;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            {/* Themed Header */}
            <div className={`bg-gradient-to-r ${currentTheme.gradients.sidebar} text-white p-6 rounded-t-lg`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">Appointment Details</h2>
                  <p className="text-white/90 mt-1">
                    {format(parseISO(appointment.date), 'EEEE, d MMMM yyyy')} at {appointment.time}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
                  title="Close"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Patient Information */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-gray-600" />
                  Patient Information
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Name:</span>
                    <span className="ml-2 font-medium">
                      {appointment.patient.first_name} {appointment.patient.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Age:</span>
                    <span className="ml-2 font-medium">
                      {appointment.patient.date_of_birth ? `${getAge(appointment.patient.date_of_birth)} years` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Gender:</span>
                    <span className="ml-2 font-medium capitalize">{appointment.patient.gender || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2 font-medium">{appointment.patient.cell_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Appointment Details */}
              <div className="bg-blue-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-600" />
                  Appointment Details
                </h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 font-medium capitalize">{appointment.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-medium">{appointment.duration} minutes</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Doctor:</span>
                    <span className="ml-2 font-medium">{appointment.doctor?.full_name || 'Not assigned'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Status:</span>
                    <Badge variant={getStatusColor(appointment.status)} size="sm" className="ml-2">
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ')}
                    </Badge>
                  </div>
                </div>
                {appointment.notes && (
                  <div className="mt-3">
                    <span className="text-gray-600 text-sm">Notes:</span>
                    <p className="mt-1 text-sm bg-white p-2 rounded border border-blue-200">
                      {appointment.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Actions Section */}
              {canEdit && appointment.status === 'scheduled' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Available Actions
                  </h3>
                  <div className="flex gap-3">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(appointment)}
                        className="flex-1 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Reschedule
                      </button>
                    )}
                    {onCancel && (
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel this appointment?')) onCancel(appointment.id);
                        }}
                        className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel
                      </button>
                    )}
                    {onStartVisit && (
                      <button
                        onClick={() => onStartVisit(appointment.id)}
                        className="flex-1 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Start Visit
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {canEdit && appointment.status === 'in-progress' && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-amber-600" />
                    Visit Actions
                  </h3>
                  <div className="flex gap-3">
                    {onCancel && (
                      <button
                        onClick={() => {
                          if (window.confirm('Cancel this visit? It is already in progress.')) onCancel(appointment.id);
                        }}
                        className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Cancel Visit
                      </button>
                    )}
                    {onCompleteVisit && (
                      <button
                        onClick={() => onCompleteVisit(appointment.id)}
                        className="flex-1 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete Visit
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {canEdit && appointment.status === 'pending' && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                    Pending Actions
                  </h3>
                  <div className="flex gap-3">
                    {onEdit && (
                      <button
                        onClick={() => onEdit(appointment)}
                        className="flex-1 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <Edit3 className="w-4 h-4" />
                        Reschedule
                      </button>
                    )}
                    {onCancel && (
                      <button
                        onClick={() => {
                          if (window.confirm('Reject this booking request?')) onCancel(appointment.id);
                        }}
                        className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    )}
                  </div>
                </div>
              )}
              
              {/* Close button for all statuses */}
              <div className="flex justify-end mt-4">
                <button
                  onClick={onClose}
                  className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AppointmentDetailsModal;