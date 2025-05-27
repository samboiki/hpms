import React, { useState } from 'react';
import { X, Calendar, Clock, User, Phone, Mail, FileText, Check, XCircle, Edit2, Trash2, Activity, Stethoscope } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../../lib/supabase';

interface AppointmentActionModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  onUpdate: () => void;
  currentUserRole: string;
  onStartVisit?: (appointmentId: string) => void;
  onCompleteVisit?: (appointmentId: string) => void;
}

export default function AppointmentActionModal({
  isOpen,
  onClose,
  appointment,
  onUpdate,
  currentUserRole,
  onStartVisit,
  onCompleteVisit
}: AppointmentActionModalProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [notes, setNotes] = useState(appointment?.notes || '');

  if (!isOpen || !appointment) return null;

  const handleStatusChange = async (newStatus: string) => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointment.id);

      if (error) throw error;

      // If scheduling, send notification (in real app)
      if (newStatus === 'scheduled') {
        console.log('Appointment scheduled, notify patient');
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating appointment:', error);
      alert('Failed to update appointment status');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNotesUpdate = async () => {
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', appointment.id);

      if (error) throw error;
      
      onUpdate();
      alert('Notes updated successfully');
    } catch (error) {
      console.error('Error updating notes:', error);
      alert('Failed to update notes');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    
    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .delete()
        .eq('id', appointment.id);

      if (error) throw error;
      
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error deleting appointment:', error);
      alert('Failed to delete appointment');
    } finally {
      setIsUpdating(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'in-progress': return 'bg-yellow-100 text-yellow-800';
      case 'no-show': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
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
            {/* Gradient Header */}
            <div className={`bg-gradient-to-r ${
              appointment.status === 'scheduled' ? 'from-blue-500 to-blue-600' :
              appointment.status === 'in-progress' ? 'from-amber-500 to-orange-600' :
              appointment.status === 'completed' ? 'from-green-500 to-green-600' :
              appointment.status === 'cancelled' ? 'from-red-500 to-red-600' :
              'from-gray-500 to-gray-600'
            } text-white p-6 rounded-t-lg`}>
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold">Appointment Management</h2>
                  <p className="text-white/90 mt-1">
                    {appointment.status === 'scheduled' ? 'Ready to start visit' :
                     appointment.status === 'in-progress' ? 'Visit in progress' :
                     'View appointment details'}
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
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
                      {appointment.patient?.first_name} {appointment.patient?.last_name}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Phone:</span>
                    <span className="ml-2 font-medium">{appointment.patient?.cell_number || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Email:</span>
                    <span className="ml-2 font-medium">{appointment.patient?.email || 'N/A'}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Gender:</span>
                    <span className="ml-2 font-medium capitalize">{appointment.patient?.gender || 'N/A'}</span>
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
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-medium">
                      {format(new Date(appointment.date), 'EEEE, MMMM d, yyyy')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Time:</span>
                    <span className="ml-2 font-medium">{appointment.time}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Type:</span>
                    <span className="ml-2 font-medium capitalize">{appointment.type}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Duration:</span>
                    <span className="ml-2 font-medium">{appointment.duration} minutes</span>
                  </div>
                </div>
                
                {/* Status Badge */}
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-600 text-sm">Status:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(appointment.status)}`}>
                      {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1).replace('-', ' ')}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500">
                    ID: {appointment.id.slice(0, 8)}
                  </span>
                </div>
              </div>

              {/* Notes */}
              {(appointment.notes || notes) && (
                <div className="bg-purple-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-purple-600" />
                    Notes
                  </h3>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-4 py-2 border border-purple-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white"
                    rows={4}
                    placeholder="Add appointment notes..."
                  />
                  {notes !== appointment.notes && (
                    <button
                      onClick={handleNotesUpdate}
                      disabled={isUpdating}
                      className="mt-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2 text-sm disabled:opacity-50"
                    >
                      <Edit2 className="w-4 h-4" />
                      Update Notes
                    </button>
                  )}
                </div>
              )}

              {/* Actions Section */}
              {appointment.status === 'scheduled' && (
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-600" />
                    Available Actions
                  </h3>
                  <div className="flex gap-3">
                    {onStartVisit && (
                      <button
                        onClick={() => onStartVisit(appointment.id)}
                        disabled={isUpdating}
                        className="flex-1 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Start Visit
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange('cancelled')}
                      disabled={isUpdating}
                      className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Appointment
                    </button>
                  </div>
                </div>
              )}

              {appointment.status === 'in-progress' && (
                <div className="bg-amber-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Stethoscope className="w-5 h-5 text-amber-600" />
                    Visit Actions
                  </h3>
                  <div className="flex gap-3">
                    {onCompleteVisit && (
                      <button
                        onClick={() => onCompleteVisit(appointment.id)}
                        disabled={isUpdating}
                        className="flex-1 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        <Check className="w-4 h-4" />
                        Complete Visit
                      </button>
                    )}
                    <button
                      onClick={() => handleStatusChange('cancelled')}
                      disabled={isUpdating}
                      className="flex-1 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" />
                      Cancel Visit
                    </button>
                  </div>
                </div>
              )}

              {appointment.status === 'cancelled' && ['admin', 'doctor'].includes(currentUserRole) && (
                <div className="bg-red-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Administrative Actions</h3>
                  <button
                    onClick={handleDelete}
                    disabled={isUpdating}
                    className="w-full px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Appointment
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}