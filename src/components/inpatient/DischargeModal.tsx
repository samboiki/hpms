import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { format } from 'date-fns';
import { toast } from 'react-hot-toast';
import { useInpatientStore } from '../../stores/inpatientStore';
import { PremiumInput, PremiumTextarea, PremiumSelect } from '../ui/PremiumInput';

interface DischargeModalProps {
  isOpen: boolean;
  onClose: () => void;
  admission: any;
  onDischarge?: () => void;
}

const DischargeModal: React.FC<DischargeModalProps> = ({
  isOpen,
  onClose,
  admission,
  onDischarge
}) => {
  const { dischargePatient } = useInpatientStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  // Form state
  const [dischargeData, setDischargeData] = useState({
    dischargeType: 'home',
    dischargeDisposition: 'improved',
    finalDiagnosis: '',
    icd10Code: '',
    proceduresPerformed: '',
    medicationsOnDischarge: '',
    dischargeInstructions: '',
    followUpDate: '',
    followUpDoctor: '',
    referralTo: '',
    referralReason: '',
    homeCarePlan: '',
    patientEducation: [],
    familyEducation: false,
    dischargeChecklist: {
      medicationReconciliation: false,
      dischargeNoteCompleted: false,
      followUpScheduled: false,
      patientEducated: false,
      belongingsReturned: false,
      finalBillGenerated: false
    }
  });

  const steps = [
    { id: 0, label: 'Discharge Summary', icon: 'solar:document-text-bold-duotone' },
    { id: 1, label: 'Medications & Instructions', icon: 'solar:pills-bold-duotone' },
    { id: 2, label: 'Follow-up & Referrals', icon: 'solar:calendar-add-bold-duotone' },
    { id: 3, label: 'Checklist & Review', icon: 'solar:checklist-minimalistic-bold-duotone' }
  ];

  const handleInputChange = (field: string, value: any) => {
    if (field.startsWith('checklist.')) {
      const checklistField = field.replace('checklist.', '');
      setDischargeData(prev => ({
        ...prev,
        dischargeChecklist: {
          ...prev.dischargeChecklist,
          [checklistField]: value
        }
      }));
    } else {
      setDischargeData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return !!(dischargeData.finalDiagnosis && dischargeData.dischargeType);
      case 1:
        return !!(dischargeData.medicationsOnDischarge && dischargeData.dischargeInstructions);
      case 2:
        return true; // Optional step
      case 3:
        return Object.values(dischargeData.dischargeChecklist).every(v => v === true);
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(activeStep)) {
      setActiveStep(prev => Math.min(prev + 1, steps.length - 1));
    } else {
      toast.error('Please complete all required fields');
    }
  };

  const handlePrevious = () => {
    setActiveStep(prev => Math.max(prev - 1, 0));
  };

  const handleDischarge = async () => {
    if (!validateStep(3)) {
      toast.error('Please complete all checklist items');
      return;
    }

    setIsSubmitting(true);
    try {
      await dischargePatient(admission.id, dischargeData);
      toast.success('Patient discharged successfully');
      onDischarge?.();
      onClose();
    } catch (error) {
      console.error('Error discharging patient:', error);
      toast.error('Failed to discharge patient');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !admission) return null;

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 bg-gradient-to-r from-orange-50 to-red-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-orange-500 to-red-500 rounded-xl shadow-lg">
                    <Icon icon="solar:clipboard-remove-bold-duotone" className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">Discharge Planning</h2>
                    <p className="text-sm text-gray-600 mt-0.5">
                      {admission.patient?.first_name} {admission.patient?.last_name} • {admission.admission_number}
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/50 rounded-xl transition-colors"
                >
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              {/* Progress Steps */}
              <div className="flex items-center justify-between mt-6">
                {steps.map((step, index) => (
                  <div key={step.id} className="flex items-center flex-1">
                    <button
                      onClick={() => setActiveStep(step.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                        activeStep === step.id
                          ? 'bg-white shadow-md'
                          : activeStep > step.id
                          ? 'bg-green-100 text-green-700'
                          : 'text-gray-400'
                      }`}
                    >
                      <Icon icon={step.icon} className="w-5 h-5" />
                      <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                    </button>
                    {index < steps.length - 1 && (
                      <div className={`flex-1 h-1 mx-2 rounded-full ${
                        activeStep > step.id ? 'bg-green-400' : 'bg-gray-200'
                      }`} />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
              <AnimatePresence mode="wait">
                {/* Step 0: Discharge Summary */}
                {activeStep === 0 && (
                  <motion.div
                    key="step0"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-orange-500" />
                        Discharge Information
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        <PremiumSelect
                          label="Discharge Type"
                          value={dischargeData.dischargeType}
                          onChange={(e) => handleInputChange('dischargeType', e.target.value)}
                          icon="solar:home-bold-duotone"
                          iconColor="text-orange-500"
                          required
                        >
                          <option value="">Select discharge type</option>
                          <option value="home">Home</option>
                          <option value="transfer">Transfer to Another Facility</option>
                          <option value="rehabilitation">Rehabilitation Center</option>
                          <option value="hospice">Hospice Care</option>
                          <option value="ama">Against Medical Advice</option>
                          <option value="deceased">Deceased</option>
                        </PremiumSelect>

                        <PremiumSelect
                          label="Patient Condition"
                          value={dischargeData.dischargeDisposition}
                          onChange={(e) => handleInputChange('dischargeDisposition', e.target.value)}
                          icon="solar:health-bold-duotone"
                          iconColor="text-green-500"
                          required
                        >
                          <option value="">Select condition</option>
                          <option value="improved">Improved</option>
                          <option value="stable">Stable</option>
                          <option value="unchanged">Unchanged</option>
                          <option value="deteriorated">Deteriorated</option>
                        </PremiumSelect>
                      </div>

                      <div className="mt-4">
                        <PremiumTextarea
                          label="Final Diagnosis"
                          value={dischargeData.finalDiagnosis}
                          onChange={(e) => handleInputChange('finalDiagnosis', e.target.value)}
                          placeholder="Enter final diagnosis..."
                          icon="solar:stethoscope-bold-duotone"
                          iconColor="text-blue-500"
                          rows={3}
                          required
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-4 mt-4">
                        <PremiumInput
                          label="ICD-10 Code"
                          value={dischargeData.icd10Code}
                          onChange={(e) => handleInputChange('icd10Code', e.target.value)}
                          placeholder="e.g., J18.9"
                          icon="solar:code-bold-duotone"
                          iconColor="text-purple-500"
                        />

                        <PremiumTextarea
                          label="Procedures Performed"
                          value={dischargeData.proceduresPerformed}
                          onChange={(e) => handleInputChange('proceduresPerformed', e.target.value)}
                          placeholder="List procedures..."
                          icon="solar:medical-kit-bold-duotone"
                          iconColor="text-indigo-500"
                          rows={2}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 1: Medications & Instructions */}
                {activeStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Icon icon="solar:pills-bold-duotone" className="w-5 h-5 text-green-500" />
                        Medications & Patient Instructions
                      </h4>

                      <PremiumTextarea
                        label="Medications on Discharge"
                        value={dischargeData.medicationsOnDischarge}
                        onChange={(e) => handleInputChange('medicationsOnDischarge', e.target.value)}
                        placeholder="List all medications with dosage and frequency..."
                        icon="solar:pills-3-bold-duotone"
                        iconColor="text-green-500"
                        rows={4}
                        required
                      />

                      <div className="mt-4">
                        <PremiumTextarea
                          label="Discharge Instructions"
                          value={dischargeData.dischargeInstructions}
                          onChange={(e) => handleInputChange('dischargeInstructions', e.target.value)}
                          placeholder="Activity restrictions, wound care, diet, etc..."
                          icon="solar:clipboard-text-bold-duotone"
                          iconColor="text-blue-500"
                          rows={4}
                          required
                        />
                      </div>

                      <div className="mt-4">
                        <PremiumTextarea
                          label="Home Care Plan"
                          value={dischargeData.homeCarePlan}
                          onChange={(e) => handleInputChange('homeCarePlan', e.target.value)}
                          placeholder="Home care instructions..."
                          icon="solar:home-smile-bold-duotone"
                          iconColor="text-purple-500"
                          rows={3}
                        />
                      </div>

                      <div className="mt-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={dischargeData.familyEducation}
                            onChange={(e) => handleInputChange('familyEducation', e.target.checked)}
                            className="w-4 h-4 text-cyan-600 bg-gray-100 border-gray-300 rounded focus:ring-cyan-500"
                          />
                          <span className="text-sm text-gray-700">Family/Caregiver education provided</span>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Follow-up & Referrals */}
                {activeStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Icon icon="solar:calendar-add-bold-duotone" className="w-5 h-5 text-blue-500" />
                        Follow-up Arrangements
                      </h4>

                      <div className="grid grid-cols-2 gap-4">
                        <PremiumInput
                          type="date"
                          label="Follow-up Date"
                          value={dischargeData.followUpDate}
                          onChange={(e) => handleInputChange('followUpDate', e.target.value)}
                          icon="solar:calendar-bold-duotone"
                          iconColor="text-blue-500"
                        />

                        <PremiumInput
                          label="Follow-up Doctor"
                          value={dischargeData.followUpDoctor}
                          onChange={(e) => handleInputChange('followUpDoctor', e.target.value)}
                          placeholder="Doctor name..."
                          icon="solar:user-bold-duotone"
                          iconColor="text-cyan-500"
                        />
                      </div>

                      <div className="mt-6">
                        <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                          <Icon icon="solar:arrow-right-up-bold-duotone" className="w-5 h-5 text-purple-500" />
                          Referrals
                        </h4>

                        <div className="grid grid-cols-2 gap-4">
                          <PremiumInput
                            label="Refer To"
                            value={dischargeData.referralTo}
                            onChange={(e) => handleInputChange('referralTo', e.target.value)}
                            placeholder="Specialist/Department..."
                            icon="solar:users-group-rounded-bold-duotone"
                            iconColor="text-purple-500"
                          />

                          <PremiumTextarea
                            label="Referral Reason"
                            value={dischargeData.referralReason}
                            onChange={(e) => handleInputChange('referralReason', e.target.value)}
                            placeholder="Reason for referral..."
                            icon="solar:document-medicine-bold-duotone"
                            iconColor="text-indigo-500"
                            rows={2}
                          />
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Checklist & Review */}
                {activeStep === 3 && (
                  <motion.div
                    key="step3"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-6 rounded-xl border border-gray-200/50">
                      <h4 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                        <Icon icon="solar:checklist-minimalistic-bold-duotone" className="w-5 h-5 text-green-500" />
                        Discharge Checklist
                      </h4>

                      <div className="space-y-3">
                        {Object.entries({
                          medicationReconciliation: 'Medication reconciliation completed',
                          dischargeNoteCompleted: 'Discharge summary completed',
                          followUpScheduled: 'Follow-up appointment scheduled',
                          patientEducated: 'Patient/family education provided',
                          belongingsReturned: 'Patient belongings returned',
                          finalBillGenerated: 'Final bill generated and explained'
                        }).map(([key, label]) => (
                          <label key={key} className="flex items-center gap-3 p-3 bg-white rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={dischargeData.dischargeChecklist[key as keyof typeof dischargeData.dischargeChecklist]}
                              onChange={(e) => handleInputChange(`checklist.${key}`, e.target.checked)}
                              className="w-5 h-5 text-green-600 bg-gray-100 border-gray-300 rounded focus:ring-green-500"
                            />
                            <span className="text-sm text-gray-700">{label}</span>
                            {dischargeData.dischargeChecklist[key as keyof typeof dischargeData.dischargeChecklist] && (
                              <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-500 ml-auto" />
                            )}
                          </label>
                        ))}
                      </div>

                      {/* Summary Review */}
                      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <h5 className="text-sm font-semibold text-blue-900 mb-3">Discharge Summary Review</h5>
                        <div className="space-y-2 text-sm text-blue-800">
                          <p><strong>Type:</strong> {dischargeData.dischargeType}</p>
                          <p><strong>Condition:</strong> {dischargeData.dischargeDisposition}</p>
                          <p><strong>Diagnosis:</strong> {dischargeData.finalDiagnosis}</p>
                          {dischargeData.followUpDate && (
                            <p><strong>Follow-up:</strong> {format(new Date(dischargeData.followUpDate), 'PPP')}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <button
                onClick={handlePrevious}
                disabled={activeStep === 0}
                className={`px-4 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                  activeStep === 0
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon icon="solar:arrow-left-bold-duotone" className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium"
                >
                  Cancel
                </button>

                {activeStep < steps.length - 1 ? (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white rounded-xl font-medium hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    Next
                    <Icon icon="solar:arrow-right-bold-duotone" className="w-4 h-4" />
                  </button>
                ) : (
                  <button
                    onClick={handleDischarge}
                    disabled={isSubmitting || !validateStep(3)}
                    className={`px-6 py-2 rounded-xl font-medium transition-all flex items-center gap-2 ${
                      isSubmitting || !validateStep(3)
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:shadow-lg'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Icon icon="solar:spinner-bold-duotone" className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4" />
                        Complete Discharge
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};

export default DischargeModal;