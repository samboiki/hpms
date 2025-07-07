import React, { useState, useEffect } from 'react';
import { X, CheckCircle, XCircle, User, Calendar, Clock, AlertCircle } from 'lucide-react';
import { Visit } from '../../types/enhanced-visit.types';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';

interface VisitConfirmationModalProps {
  visit: Visit;
  onConfirm: (visitId: string, doctorId?: string) => void;
  onReject: (visitId: string, reason?: string) => void;
  onClose: () => void;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

export default function VisitConfirmationModal({ 
  visit, 
  onConfirm, 
  onReject, 
  onClose 
}: VisitConfirmationModalProps) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>(visit.doctor_id || '');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, role')
        .in('role', ['doctor', 'admin'])
        .order('full_name');

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await onConfirm(visit.id, selectedDoctorId || undefined);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async () => {
    setLoading(true);
    try {
      await onReject(visit.id, rejectReason);
    } finally {
      setLoading(false);
    }
  };

  const getPatientAge = () => {
    if (!visit.patient?.date_of_birth) return null;
    const dob = new Date(visit.patient.date_of_birth);
    const age = Math.floor((new Date().getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return `${age} years`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Confirm Website Booking
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Review and confirm this booking request
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Patient Information */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Patient Information</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {visit.patient?.first_name} {visit.patient?.last_name}
                  </p>
                  <p className="text-xs text-gray-500">{getPatientAge()}</p>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600">Contact</p>
                <p className="text-sm font-medium">{visit.patient?.cell_number}</p>
                <p className="text-xs text-gray-500">{visit.patient?.email}</p>
              </div>
            </div>
          </div>

          {/* Visit Details */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Visit Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Date</p>
                  <p className="text-sm font-medium">
                    {format(new Date(visit.scheduled_date || visit.visit_date), 'EEEE, MMMM d, yyyy')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-600">Time</p>
                  <p className="text-sm font-medium">
                    {visit.scheduled_time || visit.visit_time || 'Not specified'}
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3">
              <p className="text-sm text-gray-600">Visit Type</p>
              <p className="text-sm font-medium capitalize">{visit.visit_type}</p>
            </div>
            {visit.chief_complaint && (
              <div className="mt-3">
                <p className="text-sm text-gray-600">Chief Complaint</p>
                <p className="text-sm font-medium">{visit.chief_complaint}</p>
              </div>
            )}
            {visit.notes && (
              <div className="mt-3">
                <p className="text-sm text-gray-600">Additional Notes</p>
                <p className="text-sm text-gray-900">{visit.notes}</p>
              </div>
            )}
          </div>

          {/* Doctor Assignment */}
          {!showRejectForm && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Assign Doctor
              </label>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              >
                <option value="">Select a doctor</option>
                {doctors.map((doctor) => (
                  <option key={doctor.id} value={doctor.id}>
                    Dr. {doctor.full_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Reject Form */}
          {showRejectForm && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for Rejection (Optional)
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Provide a reason for rejecting this booking..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
              />
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 bg-gray-50">
          {!showRejectForm ? (
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowRejectForm(true)}
                className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={handleConfirm}
                disabled={!selectedDoctorId || loading}
                className="px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <CheckCircle className="w-4 h-4" />
                {loading ? 'Confirming...' : 'Confirm Booking'}
              </button>
            </div>
          ) : (
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowRejectForm(false);
                  setRejectReason('');
                }}
                className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                {loading ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}