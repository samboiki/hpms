import React, { useState } from 'react';
import { 
  Plus,
  Calendar,
  Clock,
  MessageSquare,
  Mail,
  Users,
  ChevronRight,
  Check,
  X,
  Sparkles,
  Zap,
  Settings,
  Bell,
  Gift,
  Heart,
  DollarSign,
  FileText,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WorkflowStep {
  id: string;
  type: 'trigger' | 'template' | 'timing' | 'confirm';
  completed: boolean;
}

interface WorkflowData {
  name: string;
  trigger: string;
  template: string;
  timing: {
    when: 'immediate' | 'before' | 'after';
    value: number;
    unit: 'minutes' | 'hours' | 'days';
    sendTime?: string;
  };
  audience: 'all' | 'segment';
}

const VisualWorkflowBuilder: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [workflowData, setWorkflowData] = useState<WorkflowData>({
    name: '',
    trigger: '',
    template: '',
    timing: {
      when: 'before',
      value: 24,
      unit: 'hours',
      sendTime: '09:00'
    },
    audience: 'all'
  });

  const steps: WorkflowStep[] = [
    { id: 'trigger', type: 'trigger', completed: false },
    { id: 'template', type: 'template', completed: false },
    { id: 'timing', type: 'timing', completed: false },
    { id: 'confirm', type: 'confirm', completed: false }
  ];

  const triggers = [
    { id: 'appointment_scheduled', name: 'Appointment Scheduled', icon: Calendar, color: 'blue' },
    { id: 'appointment_reminder', name: 'Appointment Reminder', icon: Bell, color: 'indigo' },
    { id: 'patient_birthday', name: 'Patient Birthday', icon: Gift, color: 'pink' },
    { id: 'visit_completed', name: 'Visit Completed', icon: Check, color: 'green' },
    { id: 'payment_due', name: 'Payment Due', icon: DollarSign, color: 'yellow' },
    { id: 'screening_due', name: 'Health Screening Due', icon: Heart, color: 'red' }
  ];

  const templates = [
    // Appointment templates
    { id: 'reminder_sms', name: 'Appointment Reminder SMS', type: 'SMS', icon: MessageSquare, triggers: ['appointment_scheduled', 'appointment_reminder'] },
    { id: 'reminder_email', name: 'Appointment Reminder Email', type: 'EMAIL', icon: Mail, triggers: ['appointment_scheduled', 'appointment_reminder'] },
    { id: 'confirmation_sms', name: 'Appointment Confirmation SMS', type: 'SMS', icon: MessageSquare, triggers: ['appointment_scheduled'] },
    
    // Birthday templates
    { id: 'birthday_sms', name: 'Birthday Greeting SMS', type: 'SMS', icon: MessageSquare, triggers: ['patient_birthday'] },
    { id: 'birthday_email', name: 'Birthday Special Offer Email', type: 'EMAIL', icon: Mail, triggers: ['patient_birthday'] },
    
    // Visit/Follow-up templates
    { id: 'followup_email', name: 'Post-Visit Follow-up Email', type: 'EMAIL', icon: Mail, triggers: ['visit_completed'] },
    { id: 'followup_sms', name: 'Care Instructions SMS', type: 'SMS', icon: MessageSquare, triggers: ['visit_completed'] },
    { id: 'satisfaction_email', name: 'Visit Satisfaction Survey', type: 'EMAIL', icon: Mail, triggers: ['visit_completed'] },
    
    // Payment templates
    { id: 'payment_sms', name: 'Payment Due SMS', type: 'SMS', icon: MessageSquare, triggers: ['payment_due'] },
    { id: 'payment_email', name: 'Payment Reminder Email', type: 'EMAIL', icon: Mail, triggers: ['payment_due'] },
    { id: 'payment_options', name: 'Payment Plan Options Email', type: 'EMAIL', icon: Mail, triggers: ['payment_due'] },
    
    // Screening templates
    { id: 'screening_sms', name: 'Health Screening Reminder SMS', type: 'SMS', icon: MessageSquare, triggers: ['screening_due'] },
    { id: 'screening_email', name: 'Annual Checkup Reminder Email', type: 'EMAIL', icon: Mail, triggers: ['screening_due'] }
  ];

  const getTimingPresets = (trigger: string) => {
    switch (trigger) {
      case 'appointment_scheduled':
      case 'appointment_reminder':
        return [
          { label: 'Immediately', when: 'immediate', value: 0, unit: 'minutes' },
          { label: '1 week before', when: 'before', value: 7, unit: 'days' },
          { label: '3 days before', when: 'before', value: 3, unit: 'days' },
          { label: '24 hours before', when: 'before', value: 24, unit: 'hours' },
          { label: '2 hours before', when: 'before', value: 2, unit: 'hours' }
        ];
      
      case 'patient_birthday':
        return [
          { label: 'On birthday at 9 AM', when: 'immediate', value: 0, unit: 'minutes' },
          { label: '1 day before', when: 'before', value: 1, unit: 'days' },
          { label: '1 week before', when: 'before', value: 7, unit: 'days' }
        ];
      
      case 'visit_completed':
        return [
          { label: 'Immediately', when: 'immediate', value: 0, unit: 'minutes' },
          { label: '1 hour after', when: 'after', value: 1, unit: 'hours' },
          { label: '1 day after', when: 'after', value: 1, unit: 'days' },
          { label: '3 days after', when: 'after', value: 3, unit: 'days' },
          { label: '1 week after', when: 'after', value: 7, unit: 'days' }
        ];
      
      case 'payment_due':
        return [
          { label: '3 days before due', when: 'before', value: 3, unit: 'days' },
          { label: '1 day before due', when: 'before', value: 1, unit: 'days' },
          { label: 'On due date', when: 'immediate', value: 0, unit: 'minutes' },
          { label: '7 days after due', when: 'after', value: 7, unit: 'days' },
          { label: '14 days after due', when: 'after', value: 14, unit: 'days' },
          { label: '30 days after due', when: 'after', value: 30, unit: 'days' }
        ];
      
      case 'screening_due':
        return [
          { label: '1 month before', when: 'before', value: 30, unit: 'days' },
          { label: '2 weeks before', when: 'before', value: 14, unit: 'days' },
          { label: '1 week before', when: 'before', value: 7, unit: 'days' },
          { label: 'On due date', when: 'immediate', value: 0, unit: 'minutes' }
        ];
      
      default:
        return [
          { label: 'Immediately', when: 'immediate', value: 0, unit: 'minutes' },
          { label: '1 day after', when: 'after', value: 1, unit: 'days' }
        ];
    }
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    console.log('Workflow created:', workflowData);
    onClose();
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 0:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Choose a Trigger</h3>
              <p className="text-gray-600">When should this workflow start?</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              {triggers.map((trigger) => {
                const Icon = trigger.icon;
                return (
                  <motion.button
                    key={trigger.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setWorkflowData({ ...workflowData, trigger: trigger.id });
                      handleNext();
                    }}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      workflowData.trigger === trigger.id
                        ? 'border-[#01b9d5] bg-[#01b9d5]/10'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <Icon className={`w-8 h-8 mx-auto mb-2 text-${trigger.color}-500`} />
                    <p className="font-medium text-gray-900">{trigger.name}</p>
                  </motion.button>
                );
              })}
            </div>
          </div>
        );

      case 1:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Select a Template</h3>
              <p className="text-gray-600">What message should be sent?</p>
            </div>
            
            <div className="space-y-3">
              {templates
                .filter(template => template.triggers.includes(workflowData.trigger))
                .map((template) => {
                  const Icon = template.icon;
                  return (
                    <motion.button
                      key={template.id}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => {
                        setWorkflowData({ ...workflowData, template: template.id });
                        handleNext();
                      }}
                      className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        workflowData.template === template.id
                          ? 'border-[#01b9d5] bg-[#01b9d5]/10'
                          : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <Icon className={`w-6 h-6 ${
                        template.type === 'SMS' ? 'text-purple-500' : 'text-blue-500'
                      }`} />
                      <div className="text-left flex-1">
                        <p className="font-medium text-gray-900">{template.name}</p>
                        <p className="text-sm text-gray-600">{template.type}</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        template.type === 'SMS' 
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {template.type}
                      </span>
                    </motion.button>
                  );
                })}
            </div>
            
            {templates.filter(template => template.triggers.includes(workflowData.trigger)).length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <p>No templates available for this trigger.</p>
                <p className="text-sm mt-2">Please select a different trigger.</p>
              </div>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Set Timing</h3>
              <p className="text-gray-600">When should the message be sent?</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              {getTimingPresets(workflowData.trigger).map((preset) => (
                <motion.button
                  key={preset.label}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    setWorkflowData({
                      ...workflowData,
                      timing: {
                        when: preset.when as any,
                        value: preset.value,
                        unit: preset.unit as any,
                        sendTime: workflowData.timing.sendTime
                      }
                    });
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    workflowData.timing.when === preset.when && 
                    workflowData.timing.value === preset.value && 
                    workflowData.timing.unit === preset.unit
                      ? 'border-[#01b9d5] bg-[#01b9d5]/10'
                      : 'border-gray-200 hover:border-gray-300 bg-white'
                  }`}
                >
                  <p className="font-medium text-sm text-gray-900">{preset.label}</p>
                </motion.button>
              ))}
            </div>

            {workflowData.timing.when !== 'immediate' && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Send at specific time (optional)
                </label>
                <input
                  type="time"
                  value={workflowData.timing.sendTime}
                  onChange={(e) => setWorkflowData({
                    ...workflowData,
                    timing: { ...workflowData.timing, sendTime: e.target.value }
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              className="w-full py-3 bg-[#01b9d5] text-white rounded-xl font-medium hover:bg-[#01a3c7] transition-colors"
            >
              Continue
            </motion.button>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Review Your Workflow</h3>
              <p className="text-gray-600">Everything look good?</p>
            </div>
            
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-semibold text-gray-900 mb-3">Workflow Name</h4>
                <input
                  type="text"
                  value={workflowData.name}
                  onChange={(e) => setWorkflowData({ ...workflowData, name: e.target.value })}
                  placeholder="e.g., 24 Hour Appointment Reminder"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Trigger:</span>
                  <span className="font-medium">{triggers.find(t => t.id === workflowData.trigger)?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Template:</span>
                  <span className="font-medium">{templates.find(t => t.id === workflowData.template)?.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Timing:</span>
                  <span className="font-medium">
                    {workflowData.timing.when === 'immediate' ? 'Immediately' : 
                     `${workflowData.timing.value} ${workflowData.timing.unit} ${workflowData.timing.when}`}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={handleBack}
                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Back
              </button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleComplete}
                className="flex-1 py-3 px-4 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300"
              >
                Create Workflow
              </motion.button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress Bar */}
        <div className="bg-gray-100 p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-gray-900">Create Workflow</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
                  index <= currentStep
                    ? 'bg-[#01b9d5] text-white'
                    : 'bg-gray-300 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-1 ${
                    index < currentStep ? 'bg-[#01b9d5]' : 'bg-gray-300'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default VisualWorkflowBuilder;