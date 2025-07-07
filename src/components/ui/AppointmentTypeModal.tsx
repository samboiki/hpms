import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';

interface AppointmentTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: string) => void;
  selectedType?: string;
}

const appointmentTypes = [
  {
    value: 'consultation',
    label: 'Consultation',
    description: 'General medical consultation',
    icon: 'solar:stethoscope-bold-duotone',
    color: 'from-blue-400 to-blue-600'
  },
  {
    value: 'follow-up',
    label: 'Follow-up',
    description: 'Review of previous treatment',
    icon: 'solar:refresh-circle-bold-duotone',
    color: 'from-green-400 to-green-600'
  },
  {
    value: 'procedure',
    label: 'Procedure',
    description: 'Medical procedure or treatment',
    icon: 'solar:heart-pulse-bold-duotone',
    color: 'from-purple-400 to-purple-600'
  },
  {
    value: 'emergency',
    label: 'Emergency',
    description: 'Urgent medical attention',
    icon: 'solar:shield-warning-bold-duotone',
    color: 'from-red-400 to-red-600'
  }
];

export const AppointmentTypeModal: React.FC<AppointmentTypeModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  selectedType
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="fixed inset-0 flex items-center justify-center p-4 z-50"
          >
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
              {/* Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-800">Select Appointment Type</h2>
                    <p className="text-sm text-gray-500 mt-1">Choose the type of appointment</p>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-400" />
                  </button>
                </div>
              </div>

              {/* Options */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {appointmentTypes.map((type, index) => (
                    <motion.button
                      type="button"
                      key={type.value}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.02, duration: 0.2 }}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onSelect(type.value);
                        onClose();
                      }}
                      className={`p-6 rounded-xl border-2 transition-all duration-200 text-left group relative overflow-hidden
                        ${selectedType === type.value 
                          ? 'border-purple-500 bg-purple-50' 
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                    >
                      
                      <div className="relative flex items-start gap-4">
                        <div className="p-3 rounded-lg bg-gray-100">
                          <Icon icon={type.icon} className="w-6 h-6 text-gray-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-800 mb-1">{type.label}</h3>
                          <p className="text-sm text-gray-500">{type.description}</p>
                        </div>
                        {selectedType === type.value && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="absolute top-4 right-4"
                          >
                            <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-purple-500" />
                          </motion.div>
                        )}
                      </div>
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};