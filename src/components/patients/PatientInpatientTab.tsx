import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format, differenceInDays } from 'date-fns';
import { useInpatientStore } from '../../stores/inpatientStore';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { toast } from 'react-hot-toast';
import VitalsForm from '../forms/VitalsForm';
import DischargeModal from '../inpatient/DischargeModal';

interface PatientInpatientTabProps {
  patient: any;
  practiceId: string;
  onActionClick?: (action: string) => void;
}

const PatientInpatientTab: React.FC<PatientInpatientTabProps> = ({
  patient,
  practiceId,
  onActionClick
}) => {
  const [activeAdmission, setActiveAdmission] = useState<any>(null);
  const [showVitalsForm, setShowVitalsForm] = useState(false);
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [nursingNotes, setNursingNotes] = useState<any[]>([]);
  const [wardRounds, setWardRounds] = useState<any[]>([]);

  const {
    fetchAdmissions,
    activeAdmissions,
    fetchNursingRecords,
    fetchWardRounds,
    nursingRecords,
    wardRounds: storeWardRounds
  } = useInpatientStore();

  // Load admission data for this patient
  useEffect(() => {
    if (patient?.id && practiceId) {
      loadAdmissionData();
    }
  }, [patient?.id, practiceId]);

  const loadAdmissionData = async () => {
    try {
      await fetchAdmissions(practiceId, 'active');

      // Find active admission for this patient
      const patientAdmission = activeAdmissions.find(
        (admission: any) => admission.patient_id === patient.id
      );

      if (patientAdmission) {
        setActiveAdmission(patientAdmission);

        // Load nursing records and ward rounds
        await fetchNursingRecords(patientAdmission.id);
        await fetchWardRounds(patientAdmission.id);
        setNursingNotes(nursingRecords);
        setWardRounds(storeWardRounds);
      }
    } catch (error) {
      console.error('Error loading admission data:', error);
      toast.error('Failed to load admission data');
    }
  };

  if (!activeAdmission) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Icon icon="solar:hospital-bed-bold-duotone" className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-lg font-medium text-gray-600">Patient is not currently admitted</p>
        <button
          onClick={() => onActionClick?.('admit')}
          className="mt-4 px-4 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl hover:shadow-lg transition-all"
        >
          <Icon icon="solar:add-circle-bold-duotone" className="w-4 h-4 inline mr-2" />
          Admit Patient
        </button>
      </div>
    );
  }

  const lengthOfStay = differenceInDays(new Date(), new Date(activeAdmission.admission_date)) + 1;

  return (
    <div className="space-y-6">
      {/* Admission Overview Card */}
      <Card className="bg-gradient-to-br from-cyan-50 to-blue-50 border-cyan-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-gradient-to-br from-cyan-500 to-cyan-600 rounded-xl shadow-lg">
                <Icon icon="solar:hospital-bed-bold-duotone" className="w-6 h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Current Admission</CardTitle>
                <p className="text-sm text-gray-600">#{activeAdmission.admission_number}</p>
              </div>
            </div>
            <span className={`px-3 py-1 text-xs rounded-full font-medium ${
              activeAdmission.patient_condition === 'critical'
                ? 'bg-red-100 text-red-700'
                : activeAdmission.patient_condition === 'serious'
                ? 'bg-orange-100 text-orange-700'
                : 'bg-green-100 text-green-700'
            }`}>
              {activeAdmission.patient_condition || 'Stable'}
            </span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white/80 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Ward / Bed</p>
              <p className="text-sm font-semibold text-gray-900">
                {activeAdmission.current_bed?.ward_name} - Bed {activeAdmission.current_bed?.bed_number}
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Admission Date</p>
              <p className="text-sm font-semibold text-gray-900">
                {format(new Date(activeAdmission.admission_date), 'MMM dd, yyyy')}
              </p>
            </div>
            <div className="bg-white/80 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Length of Stay</p>
              <p className="text-sm font-semibold text-gray-900">{lengthOfStay} days</p>
            </div>
            <div className="bg-white/80 p-3 rounded-lg">
              <p className="text-xs text-gray-600">Attending Doctor</p>
              <p className="text-sm font-semibold text-gray-900">
                {activeAdmission.attending_doctor?.name || 'Not assigned'}
              </p>
            </div>
          </div>

          {/* Primary Diagnosis */}
          {activeAdmission.primary_diagnosis && (
            <div className="bg-white/80 p-4 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Icon icon="solar:stethoscope-bold-duotone" className="w-5 h-5 text-blue-600" />
                <h4 className="text-sm font-semibold text-gray-700">Primary Diagnosis</h4>
              </div>
              <p className="text-sm text-gray-900">{activeAdmission.primary_diagnosis}</p>
              {activeAdmission.primary_diagnosis_code && (
                <p className="text-xs text-gray-500 mt-1">ICD-10: {activeAdmission.primary_diagnosis_code}</p>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowVitalsForm(true)}
              className="px-4 py-2 bg-white border border-cyan-200 text-cyan-700 rounded-xl hover:bg-cyan-50 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:heart-pulse-bold-duotone" className="w-4 h-4" />
              Record Vitals
            </button>
            <button
              onClick={() => onActionClick?.('nursing-notes')}
              className="px-4 py-2 bg-white border border-purple-200 text-purple-700 rounded-xl hover:bg-purple-50 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:document-medicine-bold-duotone" className="w-4 h-4" />
              Nursing Notes
            </button>
            <button
              onClick={() => onActionClick?.('ward-round')}
              className="px-4 py-2 bg-white border border-blue-200 text-blue-700 rounded-xl hover:bg-blue-50 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:medical-kit-bold-duotone" className="w-4 h-4" />
              Ward Round
            </button>
            <button
              onClick={() => onActionClick?.('authorization')}
              className="px-4 py-2 bg-white border border-green-200 text-green-700 rounded-xl hover:bg-green-50 transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4" />
              Medical Aid Auth
            </button>
            <button
              onClick={() => setShowDischargeModal(true)}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl hover:shadow-lg transition-all flex items-center gap-2 text-sm font-medium"
            >
              <Icon icon="solar:clipboard-remove-bold-duotone" className="w-4 h-4" />
              Discharge Planning
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Medical Aid Authorization Status */}
      <Card className="bg-white border border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-green-600" />
            </div>
            <CardTitle className="text-base font-semibold text-gray-900">Medical Aid Authorization</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Status</p>
              <p className="text-sm font-bold text-green-600">
                {activeAdmission.insurance_verified ? 'Verified' : 'Pending'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Auth Number</p>
              <p className="text-sm font-bold text-gray-900">
                {activeAdmission.pre_authorization_number || 'N/A'}
              </p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">PMB</p>
              <p className="text-sm font-bold text-blue-600">Yes</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Coverage</p>
              <p className="text-sm font-bold text-gray-900">Full</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Activities */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Recent Nursing Notes */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:clipboard-heart-bold-duotone" className="w-5 h-5 text-purple-600" />
                <CardTitle className="text-base font-semibold text-gray-900">Recent Nursing Notes</CardTitle>
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-700">View All</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {nursingNotes.slice(0, 3).map((note, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">{note.nurse?.name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(note.created_at), 'MMM dd, HH:mm')}
                  </p>
                </div>
                <p className="text-sm text-gray-600">{note.nursing_notes}</p>
                {note.vital_signs_checked && (
                  <span className="inline-flex items-center gap-1 mt-2 text-xs text-green-600">
                    <Icon icon="solar:check-circle-bold-duotone" className="w-3 h-3" />
                    Vitals checked
                  </span>
                )}
              </div>
            ))}
            {nursingNotes.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No nursing notes yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Ward Rounds */}
        <Card className="bg-white border border-gray-200">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon icon="solar:medical-kit-bold-duotone" className="w-5 h-5 text-blue-600" />
                <CardTitle className="text-base font-semibold text-gray-900">Recent Ward Rounds</CardTitle>
              </div>
              <button className="text-xs text-blue-600 hover:text-blue-700">View All</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {wardRounds.slice(0, 3).map((round, index) => (
              <div key={index} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-start justify-between mb-1">
                  <p className="text-xs font-medium text-gray-700">{round.doctor?.name}</p>
                  <p className="text-xs text-gray-500">
                    {format(new Date(round.round_datetime), 'MMM dd, HH:mm')}
                  </p>
                </div>
                <p className="text-sm text-gray-600">{round.doctor_notes}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 text-xs rounded-full font-medium ${
                  round.patient_condition === 'improving'
                    ? 'bg-green-100 text-green-700'
                    : round.patient_condition === 'stable'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-orange-100 text-orange-700'
                }`}>
                  {round.patient_condition}
                </span>
              </div>
            ))}
            {wardRounds.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No ward rounds recorded</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Early Warning Score (EWS) */}
      <Card className="bg-white border border-gray-200">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 text-red-600" />
              </div>
              <CardTitle className="text-base font-semibold text-gray-900">Early Warning Score (EWS)</CardTitle>
            </div>
            <button
              onClick={() => setShowVitalsForm(true)}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Update Vitals
            </button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-6">
            <div className="text-center">
              <p className="text-4xl font-bold text-green-600">2</p>
              <p className="text-sm text-gray-600 mt-1">Low Risk</p>
              <p className="text-xs text-gray-500 mt-2">Last updated: 2 hours ago</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Resp Rate</p>
              <p className="text-sm font-semibold text-gray-900">18/min</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">Heart Rate</p>
              <p className="text-sm font-semibold text-gray-900">78 bpm</p>
            </div>
            <div className="text-center p-2 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">BP</p>
              <p className="text-sm font-semibold text-gray-900">120/80</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modals */}
      {showVitalsForm && (
        <VitalsForm
          patientId={patient.id}
          onClose={() => setShowVitalsForm(false)}
          onSave={() => {
            setShowVitalsForm(false);
            toast.success('Vitals recorded successfully');
            // Reload data
            loadAdmissionData();
          }}
        />
      )}

      {showDischargeModal && (
        <DischargeModal
          isOpen={showDischargeModal}
          onClose={() => setShowDischargeModal(false)}
          admission={activeAdmission}
          onDischarge={() => {
            setShowDischargeModal(false);
            // Reload data
            loadAdmissionData();
          }}
        />
      )}
    </div>
  );
};

export default PatientInpatientTab;