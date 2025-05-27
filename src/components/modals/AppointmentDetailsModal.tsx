import React from 'react';
import { X, Phone, Mail, Calendar, Clock, User, FileText, MapPin, Activity } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { motion, AnimatePresence } from 'framer-motion';

interface AppointmentDetailsModalProps {
  appointment: {
    id: string;
    patient_id: string;
    doctor_id: string;
    date: string;
    time: string;
    duration: number;
    type: string;
    status: 'pending' | 'scheduled' | 'in-progress' | 'completed' | 'cancelled' | 'no-show';
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
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={onClose}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-[#01b9d4] to-[#0197d4] text-white p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">Appointment Details</h2>
                    <div className="flex items-center gap-4 text-white/90">
                      <span className="flex items-center gap-1">
                        <Calendar size={16} />
                        {format(parseISO(appointment.date), 'MMMM d, yyyy')}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={16} />
                        {appointment.time}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="text-white/80 hover:text-white transition-colors"
                  >
                    <X size={24} />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
                {/* Status and Type */}
                <div className="flex items-center justify-between">
                  <Badge variant={getStatusColor(appointment.status)} size="lg">
                    {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ')}
                  </Badge>
                  <span className="text-sm text-gray-500">
                    Duration: {appointment.duration} minutes
                  </span>
                </div>

                {/* Patient Information */}
                <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <User size={18} className="text-[#01b9d4]" />
                    Patient Information
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium">
                        {appointment.patient.first_name} {appointment.patient.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Gender</p>
                      <p className="font-medium">{appointment.patient.gender || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Age</p>
                      <p className="font-medium">{getAge(appointment.patient.date_of_birth)} years</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Contact</p>
                      <p className="font-medium flex items-center gap-1">
                        <Phone size={14} />
                        {appointment.patient.cell_number || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Appointment Details */}
                <div className="bg-blue-50 rounded-xl p-4 space-y-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Activity size={18} className="text-[#01b9d4]" />
                    Appointment Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Type</p>
                      <p className="font-medium">{appointment.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Doctor</p>
                      <p className="font-medium">{appointment.doctor?.full_name || 'N/A'}</p>
                    </div>
                  </div>
                  {appointment.notes && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Notes</p>
                      <p className="text-gray-700 bg-white rounded-lg p-3">{appointment.notes}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="border-t border-gray-200 p-6 bg-gray-50">
                <div className="flex justify-end gap-3">
                  <Button variant="outline" onClick={onClose}>
                    Close
                  </Button>
                  
                  {canEdit && (
                    <>
                      {/* Scheduled appointment actions */}
                      {appointment.status === 'scheduled' && (
                        <>
                          {onEdit && (
                            <Button
                              variant="outline"
                              onClick={() => onEdit(appointment)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              Reschedule
                            </Button>
                          )}
                          {onCancel && (
                            <Button
                              variant="outline"
                              onClick={() => onCancel(appointment.id)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Cancel
                            </Button>
                          )}
                          {onStartVisit && (
                            <Button
                              onClick={() => onStartVisit(appointment.id)}
                              className="bg-[#01b9d4] text-white hover:bg-[#0197d4]"
                            >
                              Start Visit
                            </Button>
                          )}
                        </>
                      )}
                      
                      {/* In-progress appointment actions */}
                      {appointment.status === 'in-progress' && (
                        <>
                          {onCancel && (
                            <Button
                              variant="outline"
                              onClick={() => onCancel(appointment.id)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Cancel Visit
                            </Button>
                          )}
                          {onCompleteVisit && (
                            <Button
                              onClick={() => onCompleteVisit(appointment.id)}
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                            >
                              Complete Visit
                            </Button>
                          )}
                        </>
                      )}
                      
                      {/* Pending appointment actions */}
                      {appointment.status === 'pending' && (
                        <>
                          {onEdit && (
                            <Button
                              variant="outline"
                              onClick={() => onEdit(appointment)}
                              className="text-blue-600 border-blue-200 hover:bg-blue-50"
                            >
                              Reschedule
                            </Button>
                          )}
                          {onCancel && (
                            <Button
                              variant="outline"
                              onClick={() => onCancel(appointment.id)}
                              className="text-red-600 border-red-200 hover:bg-red-50"
                            >
                              Reject
                            </Button>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AppointmentDetailsModal;