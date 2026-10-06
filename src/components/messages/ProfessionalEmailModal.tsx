import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import FormModal from '../modals/FormModal';
import { Patient } from '../../stores/patientsStoreNew';
import { usePractice } from '../../contexts/PracticeContext';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { fillPlaceholders, findPlaceholders, formatMessageDate } from './messageText';

interface ProfessionalEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient?: Patient | null;
  onSend: (recipients: any[], subject: string, message: string, attachments?: File[]) => Promise<{ success: boolean; successCount: number; failureCount: number }>;
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

// Filled per recipient: here for a single patient, by the sender (onSend) for a bulk send
const PATIENT_VARIABLES = ['patientName', 'patientFirstName', 'patientLastName'];

const emailTemplates: EmailTemplate[] = [
  {
    id: 'appointment-confirmation',
    name: 'Appointment Confirmation',
    subject: 'Appointment Confirmation - {{practiceName}}',
    // The appointment date and time must be typed in; they used to be filled with today's date and the current time
    content: `Dear {{patientName}},

This email confirms your appointment with {{practiceName}}.

Date: {{appointmentDate}}
Time: {{appointmentTime}}

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
  const [attachments, setAttachments] = useState<File[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { practiceId } = usePractice();
  const [practiceData, setPracticeData] = useState<{
    name: string;
    contact_phone?: string;
    contact_email?: string;
    email?: string;
    domain?: string;
    address?: string;
  } | null>(null);

  // Initialize email
  useEffect(() => {
    if (patient?.email) {
      setEmail(patient.email);
    } else if (recipients.length === 1 && recipients[0].email) {
      setEmail(recipients[0].email);
    }
  }, [patient, recipients]);

  // Fetch practice data
  useEffect(() => {
    const fetchPracticeData = async () => {
      if (!practiceId) return;
      
      try {
        const { data, error } = await supabase
          .from('practices')
          .select('name, contact_phone, contact_email, domain, address')
          .eq('id', practiceId)
          .single();
          
        if (data && !error) {
          setPracticeData(data);
        }
      } catch (error) {
        console.error('Error fetching practice data:', error);
      }
    };
    
    fetchPracticeData();
  }, [practiceId]);

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

  // Only real values are filled in; anything unknown stays as {{variable}} and blocks sending.
  // (Offers, referral bonuses, a review link and a programme name used to be made up here.)
  const practiceValues = (): Record<string, string> => ({
    practiceName: practiceData?.name || '',
    practicePhone: practiceData?.contact_phone || '',
    practiceEmail: practiceData?.contact_email || practiceData?.email || '',
    currentDate: formatMessageDate(new Date()),
    currentTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  });

  const replaceVariables = (text: string, specificPatient?: any): string => {
    const targetPatient = specificPatient || patient || recipients[0];
    const firstName = (targetPatient?.first_name || '').trim();
    const lastName = (targetPatient?.last_name || '').trim();
    return fillPlaceholders(text, {
      ...practiceValues(),
      patientName: `${firstName} ${lastName}`.trim(),
      patientFirstName: firstName,
      patientLastName: lastName,
    });
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

  const handleSend = async () => {
    attachments.forEach((file, index) => {
    });
    
    if (!subject.trim()) {
      toast.error('Please enter a subject');
      return;
    }
    if (!message.trim()) {
      toast.error('Please enter a message');
      return;
    }

    // Pass raw templates to be processed individually for each patient

    try {
      // Determine recipients list
      let recipientsList: any[] = [];
      
      if (recipients.length > 0) {
        // Multiple recipients or bulk sending
        recipientsList = recipients.filter(r => r.email && r.email.trim() !== '');
      } else if (patient && email) {
        // Single patient - process template for this specific patient
        const processedSubject = replaceVariables(subject, patient);
        const processedMessage = replaceVariables(message, patient);
        const unfilled = findPlaceholders(`${processedSubject}\n${processedMessage}`);
        if (unfilled.length > 0) {
          toast.error(`Please replace ${unfilled.join(', ')} before sending`);
          return;
        }

        recipientsList = [{ 
          id: patient.id, 
          first_name: patient.first_name, 
          last_name: patient.last_name, 
          email: email 
        }];
        
        // For single patient, process templates here and pass processed versions
        const result = await onSend(recipientsList, processedSubject, processedMessage, attachments);
        if (result.success) {
          onClose();
        }
        return;
      }
      
      if (recipientsList.length === 0) {
        toast.error('No valid recipients found');
        return;
      }
      
      // Practice details and today's date are the same for every recipient, so fill them here;
      // the sender fills in each patient's name
      const bulkSubject = fillPlaceholders(subject, practiceValues());
      const bulkMessage = fillPlaceholders(message, practiceValues());
      const unfilled = findPlaceholders(`${bulkSubject}\n${bulkMessage}`, PATIENT_VARIABLES);
      if (unfilled.length > 0) {
        toast.error(`Please replace ${unfilled.join(', ')} before sending`);
        return;
      }

      // Call the bulk handler with all recipients at once (templates will be processed individually)
      const result = await onSend(recipientsList, bulkSubject, bulkMessage, attachments);
      
      // Modal is closed by the parent component based on success
      if (result.success) {
        onClose();
      }
      
    } catch (error) {
      toast.error('Failed to send emails. Please try again.');
    }
    
  };

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Compose Email"
      icon="solar:letter-bold-duotone"
      className="max-w-7xl"
    >
      <div className="grid grid-cols-12 gap-6" style={{ fontFamily: 'Montserrat, sans-serif' }}>
        {/* Left Column - Form Fields */}
        <div className="col-span-8 space-y-6">
        {/* Recipient Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:user-rounded-bold-duotone" className="w-5 h-5 text-purple-600" />
            Recipient Information
          </h3>
          <div className="bg-gray-200 rounded-xl p-4">
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
              className="w-full p-3 bg-gray-200 rounded-lg flex items-center justify-between hover:bg-gray-100 transition-colors"
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
                className="w-full p-3 bg-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none transition-colors hover:bg-gray-100"
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
                className="w-full p-4 bg-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:outline-none resize-none transition-colors hover:bg-gray-100"
                placeholder="Type your email message here..."
                style={{ fontFamily: 'Montserrat, sans-serif' }}
              />
            </div>

            {/* Attachments */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Attachments</label>
              <div className="space-y-3">
                {/* File Upload Area */}
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-purple-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon icon="solar:cloud-upload-bold-duotone" className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600 mb-1">Click to upload files</p>
                  <p className="text-xs text-gray-500">Support for PDF, DOC, DOCX, JPG, PNG (max 10MB per file)</p>
                </div>
                
                {/* Hidden File Input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.txt"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    files.forEach((file, index) => {
                    });
                    
                    const validFiles = files.filter(file => file.size <= 10 * 1024 * 1024); // 10MB limit
                    
                    if (validFiles.length !== files.length) {
                      toast.error('Some files exceed the 10MB limit and were not added');
                    }
                    
                    setAttachments(prev => {
                      const newAttachments = [...prev, ...validFiles];
                      return newAttachments;
                    });
                  }}
                  className="hidden"
                />
                
                {/* Attachment List */}
                {attachments.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-700">Attached Files:</h4>
                    {attachments.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Icon 
                            icon={file.type.includes('pdf') ? 'solar:file-text-bold-duotone' : 
                                  file.type.includes('image') ? 'solar:gallery-bold-duotone' : 
                                  'solar:document-bold-duotone'} 
                            className="w-4 h-4 text-gray-600" 
                          />
                          <span className="text-sm text-gray-700">{file.name}</span>
                          <span className="text-xs text-gray-500">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                        </div>
                        <button
                          onClick={() => {
                            setAttachments(prev => {
                              const newAttachments = prev.filter((_, i) => i !== index);
                              return newAttachments;
                            });
                          }}
                          aria-label={`Remove ${file.name}`}
                          title="Remove attachment"
                          className="text-red-500 hover:text-red-700 transition-colors"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
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

        </div>

        {/* Right Column - Live Preview */}
        <div className="col-span-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Icon icon="solar:eye-bold-duotone" className="w-5 h-5 text-purple-600" />
            Live Preview
          </h3>
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200 sticky top-0">
            <div className="bg-white rounded-lg shadow-sm overflow-hidden">
              {/* Email Header */}
              <div className="bg-gray-50 p-4 border-b">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-600">From:</span>
                    <span className="text-sm font-medium">{practiceData?.name || 'Your practice'}</span>
                    {(practiceData?.contact_email || practiceData?.email) && (
                      <span className="text-sm text-gray-500">&lt;{practiceData?.contact_email || practiceData?.email}&gt;</span>
                    )}
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
      </div>

      {/* Action Buttons - Full Width */}
      <div className="flex gap-3 pt-6 mt-6 border-t">
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
            title={!subject.trim() ? 'Enter a subject first' : !message.trim() ? 'Type a message or choose a template first' : undefined}
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
    </FormModal>
  );
};

export default ProfessionalEmailModal;