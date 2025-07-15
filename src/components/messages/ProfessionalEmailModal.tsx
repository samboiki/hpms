import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import FormModal from '../modals/FormModal';
import { Patient } from '../../stores/patientsStoreNew';
import { usePractice } from '../../contexts/PracticeContext';
import { toast } from 'react-hot-toast';

interface ProfessionalEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSend: (email: string, subject: string, message: string) => void;
  isSending?: boolean;
  recipients?: Array<{ id: string; first_name: string; last_name: string; email?: string }>;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  icon: string;
  color: string;
}

const emailTemplates: EmailTemplate[] = [
  {
    id: 'appointment-confirmation',
    name: 'Appointment Confirmation',
    subject: 'Appointment Confirmation - {{practiceName}}',
    content: `Dear {{patientName}},

This email confirms your appointment with {{practiceName}}.

Date: {{currentDate}}
Time: {{currentTime}}

Please arrive 15 minutes early for check-in. If you need to reschedule, please contact us at {{practicePhone}}.

Best regards,
{{practiceName}} Team`,
    icon: 'solar:calendar-bold-duotone',
    color: 'blue'
  },
  {
    id: 'test-results',
    name: 'Test Results Available',
    subject: 'Your Test Results Are Ready - {{practiceName}}',
    content: `Dear {{patientName}},

Your recent test results are now available. Please schedule a follow-up appointment to discuss your results with your healthcare provider.

To schedule your appointment, please call us at {{practicePhone}} or reply to this email.

Best regards,
{{practiceName}} Medical Team`,
    icon: 'solar:test-tube-bold-duotone',
    color: 'green'
  },
  {
    id: 'welcome',
    name: 'Welcome to Practice',
    subject: 'Welcome to {{practiceName}}',
    content: `Dear {{patientName}},

Welcome to {{practiceName}}! We're honored that you've chosen us as your healthcare partner.

Our contact information:
Phone: {{practicePhone}}
Email: {{practiceEmail}}

We look forward to supporting your health and wellness journey.

Warm regards,
The {{practiceName}} Team`,
    icon: 'solar:user-check-rounded-bold-duotone',
    color: 'teal'
  },
  {
    id: 'birthday',
    name: 'Birthday Wishes',
    subject: 'Happy Birthday from {{practiceName}}! 🎉',
    content: `Dear {{patientName}},

On behalf of everyone at {{practiceName}}, we wish you a very Happy Birthday!

As our birthday gift to you, enjoy {{birthdayOffer}} on your next visit.

Warmest wishes,
The {{practiceName}} Family`,
    icon: 'solar:gift-bold-duotone',
    color: 'yellow'
  },
  {
    id: 'custom',
    name: 'Custom Email',
    subject: '',
    content: '',
    icon: 'solar:pen-bold-duotone',
    color: 'gray'
  }
];

const availableVariables = [
  { key: '{{patientName}}', description: 'Full patient name' },
  { key: '{{patientFirstName}}', description: 'First name' },
  { key: '{{patientLastName}}', description: 'Last name' },
  { key: '{{practiceName}}', description: 'Practice name' },
  { key: '{{practicePhone}}', description: 'Practice phone' },
  { key: '{{practiceEmail}}', description: 'Practice email' },
  { key: '{{currentDate}}', description: 'Today\'s date' },
  { key: '{{currentTime}}', description: 'Current time' },
  { key: '{{birthdayOffer}}', description: 'Birthday offer' },
  { key: '{{referralBonus}}', description: 'Referral bonus' },
  { key: '{{reviewLink}}', description: 'Review link' },
  { key: '{{programName}}', description: 'Program name' },
];

export const ProfessionalEmailModal: React.FC<ProfessionalEmailModalProps> = ({
  isOpen,
  onClose,
  patient,
  onSend,
  isSending = false,
  recipients = []
}) => {
  const [email, setEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [showTemplateDropdown, setShowTemplateDropdown] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { practiceData } = usePractice();

  // Initialize email
  useEffect(() => {
    if (patient?.email) {
      setEmail(patient.email);
    } else if (recipients.length === 1 && recipients[0].email) {
      setEmail(recipients[0].email);
    }
  }, [patient, recipients]);

  const getRecipientDisplay = () => {
    if (recipients.length > 1) {
      return `${recipients.length} recipients`;
    } else if (patient) {
      return `${patient.first_name} ${patient.last_name}`;
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
      '{{practiceEmail}}': practiceData?.email || 'noreply@healthcare.com',
      '{{currentDate}}': new Date().toLocaleDateString(),
      '{{currentTime}}': new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      '{{birthdayOffer}}': '15% off your next visit',
      '{{referralBonus}}': '$50 credit',
      '{{reviewLink}}': 'https://g.page/r/healthcare/review',
      '{{programName}}': 'Wellness Wednesday',
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

  const handleTemplateSelect = (template: EmailTemplate) => {
    setSelectedTemplate(template);
    if (template.subject) {
      setSubject(template.subject);
    }
    if (template.content) {
      setMessage(template.content);
    }
    setShowTemplateDropdown(false);
  };

  const handleSend = () => {
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (recipients.length > 1) {
      // Multiple recipients
      recipients.forEach(recipient => {
        if (recipient.email && onSend) {
          onSend(recipient.email, subject, message);
        }
      });
    } else if (email && onSend) {
      // Single recipient
      onSend(email, subject, message);
    }
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Email"
      icon="solar:letter-bold-duotone"
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
                  <p className="text-sm text-gray-600">Email Address</p>
                  <p className="font-medium text-gray-900">{email || 'No email available'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Email Template */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-purple-600" />
            Email Template
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
                  {emailTemplates.map(template => (
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

        {/* Email Details */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Icon icon="solar:chat-line-bold-duotone" className="w-5 h-5 text-purple-600" />
              Email Content
            </h3>
            
            {/* Subject */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">Subject Line</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                placeholder="Enter email subject..."
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              />
            </div>

            {/* Message */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Message</label>
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={8}
                className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                placeholder="Type your email message here..."
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              />
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
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Email Header */}
              <div className="bg-gray-100 p-4 border-b">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">From:</span>
                    <span className="text-sm font-medium">{practiceData?.name || 'HealthCare Clinic'}</span>
                    <span className="text-sm text-gray-500">&lt;{practiceData?.email || 'noreply@healthcare.com'}&gt;</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">To:</span>
                    <span className="text-sm font-medium">{getRecipientDisplay()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">Subject:</span>
                    <span className="text-sm font-medium">{subject ? replaceVariables(subject) : 'Email subject...'}</span>
                  </div>
                </div>
              </div>
              
              {/* Email Body */}
              <div className="p-4">
                <p className="text-sm text-gray-800 whitespace-pre-wrap">
                  {message ? replaceVariables(message) : 'Your email content will appear here...'}
                </p>
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
            disabled={!subject.trim() || !message.trim() || isSending}
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
                Send Email
              </>
            )}
          </motion.button>
        </div>
      </div>
    </FormModal>
  );
};

export default ProfessionalEmailModal;