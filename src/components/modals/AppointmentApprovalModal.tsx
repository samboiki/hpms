import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, User, CheckCircle, XCircle, Edit3, UserPlus } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { formatDoctorName } from '../../utils/formatDoctorName';

interface AppointmentApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: any;
  onApprove: (appointmentId: string, doctorId: string) => Promise<void>;
  onReject: (appointmentId: string, reason?: string) => Promise<void>;
  onReschedule: (appointmentId: string) => void;
}

export default function AppointmentApprovalModal({
  isOpen,
  onClose,
  appointment,
  onApprove,
  onReject,
  onReschedule
}: AppointmentApprovalModalProps) {
  const [doctors, setDoctors] = useState<any[]>([]);
  const [selectedDoctor, setSelectedDoctor] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showRejectForm, setShowRejectForm] = useState(false);

  useEffect(() => {
    if (isOpen && appointment) {
      console.log('📋 Appointment data:', appointment);
      fetchDoctors();
    }
  }, [isOpen, appointment]);

  const fetchDoctors = async () => {
    try {
      console.log('🔍 Fetching doctors for practice:', appointment.practice_id);
      
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('role', 'doctor')
        .eq('practice_id', appointment.practice_id);

      if (error) throw error;
      
      console.log('✅ Found doctors:', data);
      setDoctors(data || []);
      
      // Pre-select first doctor if available
      if (data && data.length > 0) {
        setSelectedDoctor(data[0].id);
      }
    } catch (error) {
      console.error('❌ Error fetching doctors:', error);
      toast.error('Could not load the list of doctors. Please close and try again.');
    }
  };

  const handleApprove = async () => {
    if (!selectedDoctor) {
      toast.error('Please select a doctor');
      return;
    }

    setIsProcessing(true);
    try {
      await onApprove(appointment.id, selectedDoctor);
      onClose();
    } catch (error) {
      console.error('Error approving appointment:', error);
      toast.error('Failed to approve appointment');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async () => {
    setIsProcessing(true);
    try {
      await onReject(appointment.id, rejectReason);
      onClose();
    } catch (error) {
      console.error('Error rejecting appointment:', error);
      toast.error('Failed to reject appointment');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen || !appointment) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-lg">
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-2xl font-bold">Appointment Approval</h2>
                <p className="text-blue-100 mt-1">Review and approve pending appointment</p>
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
                    {appointment.patient?.first_name} {appointment.patient?.last_name}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <span className="ml-2 font-medium">{appointment.patient?.cell_number}</span>
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
                    {format(new Date(appointment.date), 'EEEE, d MMMM yyyy')}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Time:</span>
                  <span className="ml-2 font-medium">
                    {appointment.time}
                  </span>
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
              {appointment.notes && (
                <div className="mt-3">
                  <span className="text-gray-600">Notes:</span>
                  <p className="mt-1 text-sm bg-white p-2 rounded border border-blue-200">
                    {appointment.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Doctor Assignment */}
            {!showRejectForm && (
              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-green-600" />
                  Assign Doctor
                </h3>
                <select
                  value={selectedDoctor}
                  onChange={(e) => setSelectedDoctor(e.target.value)}
                  className="w-full px-4 py-2 border border-green-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                >
                  <option value="">Select a doctor...</option>
                  {doctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {formatDoctorName(doctor.full_name)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reject Reason Form */}
            {showRejectForm && (
              <div className="bg-red-50 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-900 mb-3">Rejection Reason</h3>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Please provide a reason for rejection (optional)"
                  className="w-full px-4 py-2 border border-red-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  rows={3}
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 justify-end">
              {!showRejectForm ? (
                <>
                  <button
                    onClick={() => setShowRejectForm(true)}
                    disabled={isProcessing}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Reject
                  </button>
                  <button
                    onClick={() => onReschedule(appointment.id)}
                    disabled={isProcessing}
                    className="px-6 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <Edit3 className="w-4 h-4" />
                    Reschedule
                  </button>
                  <button
                    onClick={handleApprove}
                    disabled={isProcessing || !selectedDoctor}
                    title={!selectedDoctor ? 'Select a doctor first' : undefined}
                    className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Approve & Schedule
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setShowRejectForm(false)}
                    disabled={isProcessing}
                    className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={isProcessing}
                    className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    Confirm Rejection
                  </button>
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}