import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Phone, Mail, Calendar, Clock, MapPin, Building2, UserPlus, Check, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { format, isValid } from 'date-fns';
import { Icon } from '@iconify/react';
import { buildBookingPatientUpdate } from './bookingPatientUpdate';

interface BookingRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  visit: any;
  onConfirm: () => void;
}

interface Doctor {
  id: string;
  full_name: string;
  role: string;
}

interface Branch {
  id: string;
  name: string;
  address?: string;
  city?: string;
}

const BookingRequestModal: React.FC<BookingRequestModalProps> = ({
  isOpen,
  onClose,
  visit,
  onConfirm
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [selectedBranchId, setSelectedBranchId] = useState(visit?.branch_id || '');
  const [patientData, setPatientData] = useState({
    first_name: visit?.patient?.first_name || '',
    last_name: visit?.patient?.last_name || '',
    email: visit?.patient?.email || '',
    cell_number: visit?.patient?.cell_number || '',
    id_number: '',
    date_of_birth: '',
    gender: 'other' as 'male' | 'female' | 'other',
    address: '',
    city: '',
    occupation: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
  });

  useEffect(() => {
    if (isOpen && visit) {
      fetchDoctorsAndBranches();
    }
  }, [isOpen, visit]);

  const fetchDoctorsAndBranches = async () => {
    try {
      // Get the signed-in user's practice_id. Without the id filter .single() fails as soon as the
      // user can see colleagues' rows, and the doctor list stayed empty
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userData } = await supabase
        .from('users')
        .select('practice_id')
        .eq('id', user.id)
        .single();

      if (!userData?.practice_id) {
        toast.error('Could not load doctors for your practice. Please close and try again.');
        return;
      }

      // Fetch doctors
      const { data: doctorsData } = await supabase
        .from('users')
        .select('id, full_name, role')
        .eq('practice_id', userData.practice_id)
        .eq('role', 'doctor')
        // Deactivated doctors can't be assigned new bookings
        .or('is_active.is.null,is_active.eq.true')
        .order('full_name');

      if (doctorsData) {
        setDoctors(doctorsData);
      }

      // Fetch branches
      const { data: branchesData } = await supabase
        .from('branches')
        .select('id, name, address, city')
        .eq('practice_id', userData.practice_id)
        .eq('is_active', true)
        .order('name');

      if (branchesData) {
        setBranches(branchesData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedDoctorId) {
      toast.error('Please select a doctor');
      return;
    }

    if (branches.length > 0 && !selectedBranchId) {
      toast.error('Please select a branch');
      return;
    }

    setIsLoading(true);
    try {
      // Update patient information if needed (only filled-in fields, so nothing on file is wiped)
      const patientUpdate = buildBookingPatientUpdate(patientData);
      if (visit.patient?.id && Object.keys(patientUpdate).length > 0) {
        const { error: patientError } = await supabase
          .from('patients')
          .update({
            ...patientUpdate,
            updated_at: new Date().toISOString()
          })
          .eq('id', visit.patient.id);

        if (patientError) throw patientError;
      }

      // Update visit with doctor and branch assignment
      const updateData: any = {
        doctor_id: selectedDoctorId,
        is_confirmed: true,
        updated_at: new Date().toISOString()
      };

      if (selectedBranchId) {
        updateData.branch_id = selectedBranchId;
      }

      const { error: visitError } = await supabase
        .from('visits')
        .update(updateData)
        .eq('id', visit.id);

      if (visitError) throw visitError;

      toast.success('Booking confirmed successfully!');
      onConfirm();
      onClose();
    } catch (error) {
      console.error('Error confirming booking:', error);
      toast.error('Failed to confirm booking');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen || !visit) return null;

  // The scheduler passes its appointment shape (date/time/type) while raw visits use scheduled_date/
  // scheduled_time; reading only the latter gave an invalid date, and date-fns format() threw on it
  const bookingStart = new Date(`${visit.scheduled_date ?? visit.date}T${visit.scheduled_time ?? visit.time}`);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={onClose}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-yellow-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-lg">
                      <Calendar className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">Booking Request</h2>
                      <p className="text-sm text-gray-600">Review and confirm website booking</p>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Close"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-200px)]">
                {/* Booking Details */}
                <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200">
                  <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-orange-600" />
                    Booking Details
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Date & Time</p>
                      <p className="font-medium text-gray-900">
                        {isValid(bookingStart)
                          ? `${format(bookingStart, 'd MMMM yyyy')} at ${format(bookingStart, 'h:mm a')}`
                          : 'Not set'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Visit Type</p>
                      <p className="font-medium text-gray-900 capitalize">{visit.visit_type || visit.type || 'Consultation'}</p>
                    </div>
                  </div>
                  {visit.notes && (
                    <div className="mt-3">
                      <p className="text-sm text-gray-600">Request Details</p>
                      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{visit.notes}</p>
                    </div>
                  )}
                </div>

                {/* Patient Information */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-gray-600" />
                    Patient Information
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input
                        type="text"
                        value={patientData.first_name}
                        onChange={(e) => setPatientData({ ...patientData, first_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input
                        type="text"
                        value={patientData.last_name}
                        onChange={(e) => setPatientData({ ...patientData, last_name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={patientData.email}
                        onChange={(e) => setPatientData({ ...patientData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                      <input
                        type="tel"
                        value={patientData.cell_number}
                        onChange={(e) => setPatientData({ ...patientData, cell_number: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">ID Number</label>
                      <input
                        type="text"
                        value={patientData.id_number}
                        onChange={(e) => setPatientData({ ...patientData, id_number: e.target.value })}
                        placeholder="Required for patient records"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                      <input
                        type="date"
                        value={patientData.date_of_birth}
                        onChange={(e) => setPatientData({ ...patientData, date_of_birth: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                </div>

                {/* Assignment */}
                <div>
                  <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Icon icon="solar:user-check-bold-duotone" className="w-5 h-5 text-gray-600" />
                    Assignment
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign Doctor <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedDoctorId}
                        onChange={(e) => setSelectedDoctorId(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="">Select a doctor</option>
                        {doctors.map((doctor) => (
                          <option key={doctor.id} value={doctor.id}>
                            {doctor.full_name}
                          </option>
                        ))}
                      </select>
                    </div>
                    {branches.length > 0 && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Branch <span className="text-red-500">*</span>
                        </label>
                        <select
                          value={selectedBranchId}
                          onChange={(e) => setSelectedBranchId(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                        >
                          <option value="">Select a branch</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.id}>
                              {branch.name} {branch.city && `- ${branch.city}`}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>The patient is only notified if the Appointment Confirmation automation is on (Communications &gt; Automations)</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmBooking}
                      disabled={isLoading || !selectedDoctorId || (branches.length > 0 && !selectedBranchId)}
                      title={
                        !selectedDoctorId
                          ? 'Select a doctor first'
                          : branches.length > 0 && !selectedBranchId
                          ? 'Select a branch first'
                          : undefined
                      }
                      className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-lg hover:from-green-600 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isLoading ? (
                        <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 animate-spin" />
                      ) : (
                        <Check className="w-5 h-5" />
                      )}
                      Confirm Booking
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default BookingRequestModal;