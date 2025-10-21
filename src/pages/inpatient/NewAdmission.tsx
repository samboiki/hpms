import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePatientsStoreNew } from '../../stores/patientsStoreNew';
import { useInpatientStore } from '../../stores/inpatientStore';
import { useAuthStore } from '../../stores/authStore';
import { usePractice } from '../../contexts/PracticeContext';
import { InpatientService } from '../../services/inpatientService';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

const NewAdmission: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const patientIdFromUrl = searchParams.get('patientId');

  const { practiceId } = usePractice();
  const { user } = useAuthStore();
  const { patients, fetchPatients } = usePatientsStoreNew();
  const { beds, wards, fetchWards, fetchAllBedsWithStatus } = useInpatientStore();

  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doctors, setDoctors] = useState<any[]>([]);

  // Form data
  const [admissionData, setAdmissionData] = useState({
    patient_id: patientIdFromUrl || '',
    practice_id: practiceId || '',
    admission_type: 'scheduled' as 'emergency' | 'scheduled' | 'transfer_in' | 'referral' | 'newborn',
    admission_source: 'outpatient_clinic' as 'emergency_room' | 'outpatient_clinic' | 'transfer_hospital' | 'physician_referral' | 'walk_in',
    chief_complaint: '',
    primary_diagnosis: '',
    attending_doctor_id: '',
    admitting_doctor_id: '',
    expected_discharge_date: '',
    insurance_verified: false,
    special_requirements: [] as string[],
    isolation_required: false,
    fall_risk: false,
    allergy_alert: false,
    bed_id: '',
  });

  const [selectedPatient, setSelectedPatient] = useState<any>(null);
  const [patientSearch, setPatientSearch] = useState('');

  useEffect(() => {
    if (practiceId) {
      fetchPatients(practiceId);
      fetchWards(practiceId);
      fetchAllBedsWithStatus(practiceId);
      fetchDoctors();
    }
  }, [practiceId]);

  useEffect(() => {
    if (patientIdFromUrl && patients.length > 0) {
      const patient = patients.find(p => p.id === patientIdFromUrl);
      if (patient) {
        setSelectedPatient(patient);
        setAdmissionData(prev => ({ ...prev, patient_id: patient.id }));
        setCurrentStep(2); // Skip to admission details
      }
    }
  }, [patientIdFromUrl, patients]);

  const fetchDoctors = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, role')
        .in('role', ['doctor', 'admin'])
        .eq('practice_id', practiceId);

      if (error) throw error;
      setDoctors(data || []);
    } catch (error) {
      console.error('Error fetching doctors:', error);
    }
  };

  const handlePatientSelect = (patient: any) => {
    setSelectedPatient(patient);
    setAdmissionData(prev => ({ ...prev, patient_id: patient.id }));
  };

  const handleSubmitAdmission = async () => {
    if (!selectedPatient) {
      toast.error('Please select a patient');
      return;
    }

    if (!admissionData.chief_complaint || !admissionData.primary_diagnosis) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = admissionData.bed_id
        ? await InpatientService.quickAdmitWithBed({
            ...admissionData,
            patient_id: selectedPatient.id,
          })
        : await InpatientService.createAdmission({
            ...admissionData,
            patient_id: selectedPatient.id,
          });

      if (result.error) {
        throw result.error;
      }

      toast.success(`Patient admitted successfully! Admission #${result.data?.admission_number}`);
      navigate('/inpatient/admissions');
    } catch (error) {
      console.error('Error admitting patient:', error);
      toast.error('Failed to admit patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getAvailableBedsForWard = (wardId: string) => {
    return beds.filter(bed => bed.ward_id === wardId && bed.status === 'available');
  };

  const filteredPatients = patients.filter(patient =>
    `${patient.first_name} ${patient.last_name}`.toLowerCase().includes(patientSearch.toLowerCase()) ||
    patient.id_number?.includes(patientSearch)
  );

  const steps = [
    { number: 1, title: 'Select Patient', icon: 'solar:user-bold-duotone' },
    { number: 2, title: 'Admission Details', icon: 'solar:clipboard-text-bold-duotone' },
    { number: 3, title: 'Bed Assignment', icon: 'solar:bed-bold-duotone' },
    { number: 4, title: 'Review & Confirm', icon: 'solar:check-circle-bold-duotone' },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">New Patient Admission</h1>
          <p className="text-gray-600 mt-1">Admit a patient to the hospital</p>
        </div>
        <button
          onClick={() => navigate('/inpatient/admissions')}
          className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 flex items-center gap-2"
        >
          <Icon icon="solar:arrow-left-bold-duotone" className="w-5 h-5" />
          Back to Admissions
        </button>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    currentStep >= step.number
                      ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white'
                      : 'bg-gray-200 text-gray-500'
                  }`}
                >
                  <Icon icon={step.icon} className="w-6 h-6" />
                </div>
                <span className={`text-sm mt-2 ${currentStep >= step.number ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div className={`h-1 w-24 mx-4 ${currentStep > step.number ? 'bg-rose-500' : 'bg-gray-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        {/* Step 1: Patient Selection */}
        {currentStep === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Select Patient</h2>

            <div className="relative">
              <Icon icon="solar:magnifer-bold-duotone" className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search patients by name or ID number..."
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
              {filteredPatients.map(patient => (
                <div
                  key={patient.id}
                  onClick={() => handlePatientSelect(patient)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    selectedPatient?.id === patient.id
                      ? 'border-rose-500 bg-rose-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                      {patient.first_name?.[0]}{patient.last_name?.[0]}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">
                        {patient.first_name} {patient.last_name}
                      </h3>
                      <p className="text-sm text-gray-500">
                        ID: {patient.id_number || 'N/A'} • {patient.gender} • {patient.date_of_birth || 'DOB N/A'}
                      </p>
                    </div>
                    {selectedPatient?.id === patient.id && (
                      <Icon icon="solar:check-circle-bold" className="w-6 h-6 text-rose-500" />
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep(2)}
                disabled={!selectedPatient}
                className={`px-6 py-2 rounded-lg flex items-center gap-2 ${
                  selectedPatient
                    ? 'bg-gradient-to-r from-rose-500 to-pink-600 text-white hover:shadow-lg'
                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                }`}
              >
                Continue
                <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 2: Admission Details */}
        {currentStep === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Admission Details</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={admissionData.admission_type}
                  onChange={(e) => setAdmissionData({ ...admissionData, admission_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                >
                  <option value="scheduled">Scheduled</option>
                  <option value="emergency">Emergency</option>
                  <option value="transfer_in">Transfer In</option>
                  <option value="referral">Referral</option>
                  <option value="newborn">Newborn</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admission Source
                </label>
                <select
                  value={admissionData.admission_source}
                  onChange={(e) => setAdmissionData({ ...admissionData, admission_source: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                >
                  <option value="outpatient_clinic">Outpatient Clinic</option>
                  <option value="emergency_room">Emergency Room</option>
                  <option value="transfer_hospital">Transfer from Hospital</option>
                  <option value="physician_referral">Physician Referral</option>
                  <option value="walk_in">Walk In</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Attending Doctor
                </label>
                <select
                  value={admissionData.attending_doctor_id}
                  onChange={(e) => setAdmissionData({ ...admissionData, attending_doctor_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                >
                  <option value="">Select Doctor</option>
                  {doctors.map(doctor => (
                    <option key={doctor.id} value={doctor.id}>{doctor.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Discharge Date
                </label>
                <input
                  type="date"
                  value={admissionData.expected_discharge_date}
                  onChange={(e) => setAdmissionData({ ...admissionData, expected_discharge_date: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Chief Complaint <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={admissionData.chief_complaint}
                  onChange={(e) => setAdmissionData({ ...admissionData, chief_complaint: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  placeholder="Describe the primary reason for admission..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primary Diagnosis <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={admissionData.primary_diagnosis}
                  onChange={(e) => setAdmissionData({ ...admissionData, primary_diagnosis: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500"
                  placeholder="Enter primary diagnosis..."
                />
              </div>

              {/* Special Requirements */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requirements
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={admissionData.insurance_verified}
                      onChange={(e) => setAdmissionData({ ...admissionData, insurance_verified: e.target.checked })}
                      className="mr-2"
                    />
                    <span>Insurance Verified</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={admissionData.isolation_required}
                      onChange={(e) => setAdmissionData({ ...admissionData, isolation_required: e.target.checked })}
                      className="mr-2"
                    />
                    <span>Isolation Required</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={admissionData.fall_risk}
                      onChange={(e) => setAdmissionData({ ...admissionData, fall_risk: e.target.checked })}
                      className="mr-2"
                    />
                    <span>Fall Risk</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={admissionData.allergy_alert}
                      onChange={(e) => setAdmissionData({ ...admissionData, allergy_alert: e.target.checked })}
                      className="mr-2"
                    />
                    <span>Allergy Alert</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(1)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Icon icon="solar:arrow-left-bold-duotone" className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep(3)}
                className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg hover:shadow-lg flex items-center gap-2"
              >
                Continue
                <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Bed Assignment */}
        {currentStep === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bed Assignment (Optional)</h2>
            <p className="text-sm text-gray-600 mb-4">Select a bed for the patient or skip to assign later.</p>

            {wards.map(ward => {
              const availableBeds = getAvailableBedsForWard(ward.id);
              if (availableBeds.length === 0) return null;

              return (
                <div key={ward.id} className="border rounded-lg p-4">
                  <h3 className="font-medium text-gray-900 mb-3">
                    {ward.ward_name} ({availableBeds.length} beds available)
                  </h3>
                  <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                    {availableBeds.map(bed => (
                      <button
                        key={bed.id}
                        onClick={() => setAdmissionData({ ...admissionData, bed_id: bed.id })}
                        className={`p-2 rounded-lg text-sm font-medium transition-all ${
                          admissionData.bed_id === bed.id
                            ? 'bg-rose-500 text-white'
                            : 'bg-green-100 text-green-700 hover:bg-green-200'
                        }`}
                      >
                        {bed.bed_number}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(2)}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Icon icon="solar:arrow-left-bold-duotone" className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={() => setCurrentStep(4)}
                className="px-6 py-2 bg-gradient-to-r from-rose-500 to-pink-600 text-white rounded-lg hover:shadow-lg flex items-center gap-2"
              >
                {admissionData.bed_id ? 'Continue' : 'Skip Bed Assignment'}
                <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Step 4: Review & Confirm */}
        {currentStep === 4 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-4"
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Review & Confirm</h2>

            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Patient:</span>
                <span className="text-sm font-medium text-gray-900">
                  {selectedPatient?.first_name} {selectedPatient?.last_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Admission Type:</span>
                <span className="text-sm font-medium text-gray-900 capitalize">{admissionData.admission_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Chief Complaint:</span>
                <span className="text-sm font-medium text-gray-900">{admissionData.chief_complaint}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Primary Diagnosis:</span>
                <span className="text-sm font-medium text-gray-900">{admissionData.primary_diagnosis}</span>
              </div>
              {admissionData.bed_id && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Assigned Bed:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {beds.find(b => b.id === admissionData.bed_id)?.bed_number || 'N/A'}
                  </span>
                </div>
              )}
              {admissionData.attending_doctor_id && (
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Attending Doctor:</span>
                  <span className="text-sm font-medium text-gray-900">
                    {doctors.find(d => d.id === admissionData.attending_doctor_id)?.name || 'N/A'}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-between">
              <button
                onClick={() => setCurrentStep(3)}
                disabled={isSubmitting}
                className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center gap-2"
              >
                <Icon icon="solar:arrow-left-bold-duotone" className="w-5 h-5" />
                Back
              </button>
              <button
                onClick={handleSubmitAdmission}
                disabled={isSubmitting}
                className="px-6 py-2 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-lg hover:shadow-lg flex items-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                    Admitting...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5" />
                    Confirm Admission
                  </>
                )}
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default NewAdmission;