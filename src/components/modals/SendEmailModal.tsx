import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Mail, User, Clock, Users, Sparkles, FileText } from 'lucide-react';
import Button from '../ui/Button';
import FullScreenModal from '../ui/FullScreenModal';
import { useTheme } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/authStore';
import { professionalEmailTemplates, type ProfessionalEmailTemplate } from '../messages/EmailTemplates';

interface SendEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
  patients: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  }>;
}

const SendEmailModal: React.FC<SendEmailModalProps> = ({ isOpen, onClose, patients }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuthStore();
  const [subject, setSubject] = useState('Important Message from OneHealth Practice');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedTemplate, setSelectedTemplate] = useState<ProfessionalEmailTemplate | null>(null);
  const [showTemplates, setShowTemplates] = useState(false);

  // Debug modal state changes
  React.useEffect(() => {
    if (isOpen) {
      console.log('📧 EMAIL MODAL DEBUG: SendEmailModal OPENED - Recipients:', patients.length);
      console.log('📧 EMAIL MODAL DEBUG: Modal approach - FULL SCREEN with FullScreenModal wrapper');
      console.log('📧 EMAIL MODAL DEBUG: Current theme gradient:', currentTheme.gradients.sidebar);
      console.log('📧 EMAIL MODAL DEBUG: Z-index: 2147483647 (MAX VALUE), Position: fixed inset-0');
      console.log('📧 EMAIL MODAL DEBUG: Rendered via Portal to document.body with isolation');
      console.log('📧 EMAIL MODAL DEBUG: Patients:', patients.map(p => `${p.first_name} ${p.last_name}`));
      
      // Check for DOM conflicts
      const existingModals = document.querySelectorAll('[class*="z-"]');
      console.log('📧 EMAIL MODAL DEBUG: Existing modals with z-index:', existingModals.length);
      existingModals.forEach((modal, i) => {
        const classes = modal.className;
        if (classes.includes('z-')) {
          console.log(`📧 EMAIL MODAL DEBUG: Modal ${i}:`, classes);
        }
      });
    } else {
      console.log('📧 EMAIL MODAL DEBUG: SendEmailModal CLOSED');
    }
  }, [isOpen, patients, currentTheme]);

  // Runtime dimension checking
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const modalElement = document.querySelector('[data-testid="email-modal"]') as HTMLElement;
        if (modalElement) {
          const rect = modalElement.getBoundingClientRect();
          console.log('📧 EMAIL MODAL DEBUG: Actual modal dimensions:', {
            width: rect.width,
            height: rect.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            widthPercentage: (rect.width / window.innerWidth * 100).toFixed(1) + '%',
            heightPercentage: (rect.height / window.innerHeight * 100).toFixed(1) + '%'
          });
        } else {
          console.log('📧 EMAIL MODAL DEBUG: Modal element not found in DOM');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Initialize modal content
  React.useEffect(() => {
    if (isOpen && patients.length > 0) {
      // Set default message
      const defaultMessage = `Dear Patient,

We hope this message finds you in good health. This is a message from OneHealth Practice regarding your healthcare.

Please don't hesitate to contact us if you have any questions or concerns about your health or any scheduled appointments.

Best regards,
OneHealth Medical Team

Phone: +264 61 123 4567
Email: info@onehealth.com.na
Website: www.onehealth.com.na

---
This email was sent to you because you are a registered patient at OneHealth Practice. If you believe you received this email in error, please contact us immediately.`;

      setMessage(defaultMessage);
    }
  }, [isOpen, patients]);

  const handleSend = async () => {
    if (!subject.trim() || !message.trim()) {
      alert('Please enter both subject and message content');
      return;
    }

    if (patients.length === 0) {
      alert('No recipients selected');
      return;
    }

    setIsSending(true);
    setSendStatus('idle');

    try {
      console.log('📧 Sending emails to', patients.length, 'patients');
      
      // Here you would implement the actual email sending logic
      // For now, we'll simulate it
      const emailPromises = patients.map(async (patient) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            console.log('📧 Email sent to:', patient.email);
            resolve({ success: true, patient });
          }, Math.random() * 1000 + 500);
        });
      });

      await Promise.all(emailPromises);

      setSendStatus('success');
      setTimeout(() => {
        onClose();
        setSendStatus('idle');
        setSubject('Important Message from OneHealth Practice');
        setMessage('');
      }, 2000);
    } catch (error) {
      setSendStatus('error');
      console.error('Error sending emails:', error);
    } finally {
      setIsSending(false);
    }
  };

  const quickSubjects = [
    "Appointment Reminder - OneHealth Practice",
    "Important Health Information",
    "Test Results Available",
    "Medication Reminder",
    "Follow-up Appointment Required"
  ];

  const handleQuickSubject = (quickSubj: string) => {
    setSubject(quickSubj);
  };

  const handleTemplateSelect = (template: ProfessionalEmailTemplate) => {
    setSelectedTemplate(template);
    setSubject(template.subject);
    setMessage(template.body);
    setShowTemplates(false);
  };

  return (
    <FullScreenModal isOpen={isOpen} onClose={onClose} modalId="send-email-modal">
      <div className="h-full bg-white flex flex-col">
            {/* Header */}
            <div className={`bg-gradient-to-r ${currentTheme.gradients.sidebar} p-6 text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Send Email</h2>
                    <p className="text-blue-100 text-sm flex items-center gap-2">
                      <Users className="w-3 h-3" />
                      {patients.length} recipients
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              {/* Recipients Preview */}
              <div className="bg-gray-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Users className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">
                      Recipients ({patients.length})
                    </div>
                    <div className="text-sm text-gray-600">
                      {patients.slice(0, 3).map(p => `${p.first_name} ${p.last_name}`).join(', ')}
                      {patients.length > 3 && ` and ${patients.length - 3} more...`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Professional Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    Professional Templates
                  </label>
                  <button
                    onClick={() => setShowTemplates(!showTemplates)}
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
                  >
                    <FileText className="w-3 h-3" />
                    {showTemplates ? 'Hide' : 'Browse'} Templates
                  </button>
                </div>
                
                {showTemplates && (
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-200">
                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto">
                      {professionalEmailTemplates.slice(0, 8).map((template) => (
                        <button
                          key={template.id}
                          onClick={() => handleTemplateSelect(template)}
                          className="text-left p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-200 group"
                        >
                          <div className="font-medium text-gray-900 text-sm group-hover:text-blue-700">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-600 group-hover:text-blue-600 mt-1">
                            {template.description}
                          </div>
                          <div className="text-xs text-purple-600 mt-1 opacity-75">
                            Category: {template.category}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {!showTemplates && (
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {quickSubjects.map((quickSubj, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickSubject(quickSubj)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg text-sm transition-all duration-200"
                      >
                        {quickSubj}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Subject Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Subject
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                  placeholder="Enter email subject"
                />
              </div>

              {/* Message Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={8}
                  className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
                  placeholder="Type your message here..."
                />
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>{message.length} characters</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Professional email template
                  </span>
                </div>
              </div>

              {/* Status Messages */}
              {sendStatus === 'success' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-green-50 border border-green-200 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 text-green-700">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    Emails sent successfully to {patients.length} recipients!
                  </div>
                </motion.div>
              )}

              {sendStatus === 'error' && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <div className="flex items-center gap-2 text-red-700">
                    <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                    Failed to send emails. Please try again.
                  </div>
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200 flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={onClose}
                disabled={isSending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSend}
                disabled={isSending || !subject.trim() || !message.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending to {patients.length} recipients...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Email to {patients.length} patients
                  </>
                )}
              </Button>
            </div>
          </div>
    </FullScreenModal>
  );
};

export default SendEmailModal;