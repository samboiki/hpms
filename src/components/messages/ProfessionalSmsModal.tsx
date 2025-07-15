import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import FormModal from '../modals/FormModal';
import { Patient } from '../../stores/patientsStoreNew';
import { usePractice } from '../../contexts/PracticeContext';
import { toast } from 'react-hot-toast';

interface ProfessionalSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  patientName?: string;
  patientPhone?: string;
  onSend?: (phone: string, message: string) => void;
  isSending?: boolean;
  recipients?: Array<{ id: string; first_name: string; last_name: string; cell_number?: string }>;
}

interface SmsTemplate {
  id: string;
  name: string;
  content: string;
  icon: string;
  color: string;
}

const smsTemplates: SmsTemplate[] = [
  {
    id: 'appointment-reminder',
    name: 'Appointment Reminder',
    content: 'Hi {{patientName}}, this is a reminder about your appointment on {{currentDate}} at {{currentTime}} with {{practiceName}}. Please arrive 15 minutes early. Reply CONFIRM to confirm or CANCEL to cancel.',
    icon: 'solar:calendar-bold-duotone',
    color: 'blue'
  },
  {
    id: 'test-results',
    name: 'Test Results Ready',
    content: 'Hi {{patientName}}, your test results are ready for collection. Please visit {{practiceName}} during business hours or call us at {{practicePhone}} to discuss your results.',
    icon: 'solar:test-tube-bold-duotone',
    color: 'green'
  },
  {
    id: 'follow-up',
    name: 'Follow-up Care',
    content: 'Hi {{patientName}}, we hope you\'re feeling better after your recent visit. If you have any concerns, please call us at {{practicePhone}}. - {{practiceName}}',
    icon: 'solar:heart-bold-duotone',
    color: 'pink'
  },
  {
    id: 'birthday',
    name: 'Birthday Wishes',
    content: 'Happy Birthday {{patientName}}! 🎉 From all of us at {{practiceName}}, we wish you good health and happiness. Enjoy {{birthdayOffer}} on your next visit!',
    icon: 'solar:gift-bold-duotone',
    color: 'yellow'
  },
  {
    id: 'custom',
    name: 'Custom Message',
    content: '',
    icon: 'solar:pen-bold-duotone',
    color: 'gray'
  }
];

const availableVariables = [
  { key: '{{patientName}}', description: 'Full patient name' },
  { key: '{{patientFirstName}}', description: 'First name only' },
  { key: '{{patientLastName}}', description: 'Last name only' },
  { key: '{{practiceName}}', description: 'Your practice name' },
  { key: '{{practicePhone}}', description: 'Practice phone' },
  { key: '{{practiceEmail}}', description: 'Practice email' },
  { key: '{{currentDate}}', description: 'Today\'s date' },
  { key: '{{currentTime}}', description: 'Current time' },
  { key: '{{birthdayOffer}}', description: 'Birthday discount' },
];

export const ProfessionalSmsModal: React.FC<ProfessionalSmsModalProps> = ({
  isOpen,
  onClose,
  patient,
  patientName,
  patientPhone,
  onSend,
  isSending = false,
  recipients = []
}) => {
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<SmsTemplate | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { practiceData } = usePractice();

  // Initialize phone number
  useEffect(() => {
    if (patient?.cell_number) {
      setPhone(patient.cell_number);
    } else if (patientPhone) {
      setPhone(patientPhone);
    } else if (recipients.length === 1 && recipients[0].cell_number) {
      setPhone(recipients[0].cell_number);
    }
  }, [patient, patientPhone, recipients]);

  const getRecipientDisplay = () => {
    if (recipients.length > 1) {
      return `${recipients.length} recipients`;
    } else if (patient) {
      return `${patient.first_name} ${patient.last_name}`;
    } else if (patientName) {
      return patientName;
    } else if (recipients.length === 1) {
      return `${recipients[0].first_name} ${recipients[0].last_name}`;
    }
    return 'Unknown';
  };

  const replaceVariables = (text: string): string => {
    const firstName = patient?.first_name || recipients[0]?.first_name || 'John';
    const lastName = patient?.last_name || recipients[0]?.last_name || 'Smith';
    const fullName = `${firstName} ${lastName}`;
    
    const variables: Record<string, string> = {
      '{{patientName}}': fullName,
      '{{patientFirstName}}': firstName,
      '{{patientLastName}}': lastName,
      '{{practiceName}}': practiceData?.name || 'HealthCare Clinic',
      '{{practicePhone}}': practiceData?.contact_phone || '(555) 123-4567',
      '{{practiceEmail}}': practiceData?.email || 'info@healthcare.com',
      '{{currentDate}}': new Date().toLocaleDateString(),
      '{{currentTime}}': new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '{{birthdayOffer}}': '15% off',
    };

    let processedText = text;
    Object.entries(variables).forEach(([key, value]) => {
      processedText = processedText.replace(new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    });
    
    return processedText;
  };

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMessage = message.substring(0, start) + variable + message.substring(end);
    setMessage(newMessage);
    
    // Reset cursor position
    setTimeout(() => {
      textarea.selectionStart = start + variable.length;
      textarea.selectionEnd = start + variable.length;
      textarea.focus();
    }, 0);
  };

  const handleTemplateSelect = (template: SmsTemplate) => {
    setSelectedTemplate(template);
    if (template.content) {
      setMessage(template.content);
    }
    setShowTemplateDropdown(false);
  };

  const handleSend = () => {
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (recipients.length > 1) {
      // Multiple recipients
      recipients.forEach(recipient => {
        if (recipient.cell_number && onSend) {
          onSend(recipient.cell_number, message);
        }
      });
    } else if (phone && onSend) {
      // Single recipient
      onSend(phone, message);
    }
  };

  const characterCount = message.length;
  const smsCount = Math.ceil(characterCount / 160) || 1;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Send SMS Message"
      icon="solar:smartphone-2-bold-duotone"
    >
      <div className="space-y-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        {/* Recipient Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:user-rounded-bold-duotone" className="w-5 h-5 text-purple-600" />
            Recipient Information
          </h3>
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sending to</p>
                <p className="font-medium text-gray-900">{getRecipientDisplay()}</p>
              </div>
              {recipients.length <= 1 && (
                <div>
                  <p className="text-sm text-gray-600">Phone Number</p>
                  <p className="font-medium text-gray-900">{phone || 'No number available'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Message Template */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-purple-600" />
            Message Template
          </h3>
          <div className="relative">
            <button
              onClick={() => setShowTemplateDropdown(!showTemplateDropdown)}
              className="w-full p-3 bg-white border border-gray-300 rounded-lg flex items-center justify-between hover:border-purple-400 transition-colors"
            >
              {selectedTemplate ? (
                <div className="flex items-center gap-3">
                  <Icon icon={selectedTemplate.icon} className="w-5 h-5 text-purple-600" />
                  <span className="font-medium text-gray-900">{selectedTemplate.name}</span>
                </div>
              ) : (
                <span className="text-gray-500">Select a template...</span>
              )}
              <Icon icon="solar:alt-arrow-down-bold" className={`w-5 h-5 text-gray-400 transition-transform ${showTemplateDropdown ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
              {showTemplateDropdown && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute z-10 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden"
                >
                  {smsTemplates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-purple-50 transition-colors text-left"
                    >
                      <Icon icon={template.icon} className="w-5 h-5 text-purple-600" />
                      <span className="font-medium text-gray-900">{template.name}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Message Composition */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:chat-round-text-bold-duotone" className="w-5 h-5 text-purple-600" />
            Message Content
          </h3>
          
          <div className="space-y-3">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              placeholder="Type your message here..."
              style={{ fontFamily: 'Montserrat, sans-serif' }}
            />
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">
                {characterCount} characters • {smsCount} SMS
              </span>
              <span className="text-purple-600 font-medium">
                {recipients.length > 1 ? `Sending to ${recipients.length} recipients` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Available Variables */}
        <div>
          <h3 className="text-xs font-medium text-gray-600 mb-2">Available Variables</h3>
          <div className="flex flex-wrap gap-2">
            {availableVariables.map((variable) => (
              <motion.button
                key={variable.key}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => insertVariable(variable.key)}
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-all"
                title={variable.description}
              >
                <Icon icon="solar:code-bold" className="w-3.5 h-3.5 text-purple-600" />
                <code className="text-xs font-mono text-purple-700">{variable.key}</code>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Live Preview */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:eye-bold-duotone" className="w-5 h-5 text-purple-600" />
            Live Preview
          </h3>
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
            <div className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-start gap-3">
                <Icon icon="solar:smartphone-bold-duotone" className="w-5 h-5 text-purple-600 mt-1" />
                <div className="flex-1">
                  <p className="text-sm text-gray-800 whitespace-pre-wrap">
                    {message ? replaceVariables(message) : 'Your message will appear here...'}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    From: {practiceData?.name || 'HealthCare Clinic'} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4 border-t">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
          >
            Cancel
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSend}
            disabled={!message.trim() || isSending}
            className="flex-1 px-4 py-2.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSending ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                Sending...
              </>
            ) : (
              <>
                <Icon icon="solar:letter-bold-duotone" className="w-5 h-5" />
                Send SMS
              </>
            )}
          </motion.button>
        </div>
      </div>
    </FormModal>
  );
};

export default ProfessionalSmsModal;