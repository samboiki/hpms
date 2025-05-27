import React, { useState } from 'react';
import { X, Calendar, Clock, User, Phone, Mail, FileText, Check, XCircle, Edit2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import Button from '../ui/Button';
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">Appointment Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status Badge */}
          <div className="flex items-center justify-between">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(appointment.status)}`}>
              {appointment.status}
            </span>
            <span className="text-sm text-gray-500">
              ID: {appointment.id.slice(0, 8)}
            </span>
          </div>

          {/* Patient Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <User className="w-4 h-4 mr-2" />
              Patient Information
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-600">Name:</span>{' '}
                <span className="font-medium">
                  {appointment.patient?.first_name} {appointment.patient?.last_name}
                </span>
              </p>
              {appointment.patient?.cell_number && (
                <p className="flex items-center">
                  <Phone className="w-3 h-3 mr-2 text-gray-400" />
                  {appointment.patient.cell_number}
                </p>
              )}
              {appointment.patient?.email && (
                <p className="flex items-center">
                  <Mail className="w-3 h-3 mr-2 text-gray-400" />
                  {appointment.patient.email}
                </p>
              )}
            </div>
          </div>

          {/* Appointment Details */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Appointment Details
            </h3>
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-gray-600">Date:</span>{' '}
                <span className="font-medium">
                  {format(new Date(appointment.date), 'EEEE, MMMM d, yyyy')}
                </span>
              </p>
              <p>
                <span className="text-gray-600">Time:</span>{' '}
                <span className="font-medium">{appointment.time}</span>
              </p>
              <p>
                <span className="text-gray-600">Duration:</span>{' '}
                <span className="font-medium">{appointment.duration} minutes</span>
              </p>
              <p>
                <span className="text-gray-600">Type:</span>{' '}
                <span className="font-medium capitalize">{appointment.type}</span>
              </p>
            </div>
          </div>

          {/* Notes */}
          <div>
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <FileText className="w-4 h-4 mr-2" />
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full p-3 border rounded-lg text-sm"
              rows={4}
              placeholder="Add appointment notes..."
            />
            {notes !== appointment.notes && (
              <Button
                onClick={handleNotesUpdate}
                disabled={isUpdating}
                variant="secondary"
                size="sm"
                className="mt-2"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Update Notes
              </Button>
            )}
          </div>

          {/* Actions */}
          <div className="border-t pt-6 space-y-3">
            <h3 className="font-medium text-gray-900 mb-3">Actions</h3>
            
            {appointment.status === 'scheduled' && (
              <div className="flex gap-3">
                {onStartVisit && (
                  <Button
                    onClick={() => onStartVisit(appointment.id)}
                    disabled={isUpdating}
                    variant="primary"
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Start Visit
                  </Button>
                )}
                <Button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={isUpdating}
                  variant="secondary"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Appointment
                </Button>
              </div>
            )}

            {appointment.status === 'in-progress' && (
              <div className="flex gap-3">
                {onCompleteVisit && (
                  <Button
                    onClick={() => onCompleteVisit(appointment.id)}
                    disabled={isUpdating}
                    variant="primary"
                    className="flex-1"
                  >
                    <Check className="w-4 h-4 mr-2" />
                    Complete Visit
                  </Button>
                )}
                <Button
                  onClick={() => handleStatusChange('cancelled')}
                  disabled={isUpdating}
                  variant="secondary"
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Visit
                </Button>
              </div>
            )}

            {appointment.status === 'cancelled' && ['admin', 'doctor'].includes(currentUserRole) && (
              <Button
                onClick={handleDelete}
                disabled={isUpdating}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Appointment
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}