import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Send, MessageSquare, Phone, User, Clock, Sparkles, FileText } from 'lucide-react';
import Button from '../ui/Button';
import FullScreenModal from '../ui/FullScreenModal';
import { communicationService } from '../../services/communicationService';
import { useTheme } from '../../stores/themeStore';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface SendMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: {
    id: string;
    first_name: string;
    last_name: string;
    cell_number: string;
  } | null;
}

const SendMessageModal: React.FC<SendMessageModalProps> = ({ isOpen, onClose, patient }) => {
  const { currentTheme } = useTheme();
  const { user } = useAuthStore();
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(patient?.cell_number || '');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showTemplates, setShowTemplates] = useState(false);


  // Runtime dimension checking
  React.useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const modalElement = document.querySelector('[data-testid="sms-modal"]') as HTMLElement;
        if (modalElement) {
          const rect = modalElement.getBoundingClientRect();
          console.log('📱 SMS MODAL DEBUG: Actual modal dimensions:', {
            width: rect.width,
            height: rect.height,
            viewportWidth: window.innerWidth,
            viewportHeight: window.innerHeight,
            widthPercentage: (rect.width / window.innerWidth * 100).toFixed(1) + '%',
            heightPercentage: (rect.height / window.innerHeight * 100).toFixed(1) + '%'
          });
        } else {
          console.log('📱 SMS MODAL DEBUG: Modal element not found in DOM');
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Initialize phone number when modal opens
  React.useEffect(() => {
    if (isOpen && patient?.cell_number) {
      setPhoneNumber(patient.cell_number);
    }
  }, [isOpen, patient]);

  // Get practice_id from user metadata or local storage
  const practiceId = user?.user_metadata?.practice_id || localStorage.getItem('currentPracticeId');

  const handleSend = async () => {
    if (!message.trim() || !phoneNumber.trim()) {
      alert('Please enter both phone number and message content');
      return;
    }

    if (!practiceId) {
      alert('Practice ID not found. Please ensure you are logged in properly.');
      return;
    }

    setIsSending(true);
    setSendStatus('idle');

    try {
      // Use centralized communication service
      const response = await communicationService.sendSMS({
        practiceId: practiceId as string,
        recipientPhone: phoneNumber,
        messageContent: message,
        messageType: 'custom',
        patientId: patient?.id,
        metadata: {
          sentBy: user?.email || 'Unknown',
          sentByUserId: user?.id,
          source: 'SendMessageModal'
        }
      });
      
      if (response.success) {
        setSendStatus('success');
        setMessage('');
        setTimeout(() => {
          onClose();
          setSendStatus('idle');
        }, 2000);
      } else {
        setSendStatus('error');
        console.error('SMS sending failed:', response.error);
        alert(`Failed to send SMS: ${response.error || 'Unknown error'}`);
      }
    } catch (error) {
      setSendStatus('error');
      console.error('Error sending SMS:', error);
      alert('Failed to send SMS. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const quickMessages = [
    "Please confirm your appointment scheduled for tomorrow.",
    "Your appointment has been rescheduled. Please call to confirm.",
    "Reminder: Please bring your ID and medical aid card to your appointment.",
    "Your test results are ready. Please schedule a follow-up appointment.",
    "Please take your medication as prescribed. Contact us if you have any questions."
  ];

  const smsTemplates = [
    {
      name: "Appointment Reminder",
      category: "appointment",
      message: "Hi {{patientName}}, this is a reminder about your appointment tomorrow at OneHealth Practice. Please arrive 15 minutes early. Call us if you need to reschedule: +264 61 123 4567"
    },
    {
      name: "Birthday Greeting",
      category: "birthday",
      message: "🎉 Happy Birthday {{patientName}}! Wishing you a healthy and wonderful year ahead. Special birthday offer: 15% off your next health screening. Call us to book!"
    },
    {
      name: "Test Results Ready",
      category: "results",
      message: "Hello {{patientName}}, your test results from your recent visit are now available. Please log into your patient portal or call us to discuss. OneHealth Practice: +264 61 123 4567"
    },
    {
      name: "Payment Reminder",
      category: "billing",
      message: "Dear {{patientName}}, this is a friendly reminder about your outstanding invoice. You can pay online via our portal or visit our reception. Thank you - OneHealth Practice"
    },
    {
      name: "Medication Reminder",
      category: "medication",
      message: "Hello {{patientName}}, this is a reminder to take your prescribed medication as directed. If you have any side effects or questions, please contact us immediately: +264 61 123 4567"
    },
    {
      name: "Follow-up Required",
      category: "followup",
      message: "Hi {{patientName}}, Dr. {{doctorName}} has requested a follow-up appointment. Please call us to schedule at your earliest convenience: +264 61 123 4567. OneHealth Practice"
    }
  ];

  const handleQuickMessage = (quickMsg: string) => {
    setMessage(quickMsg);
  };

  const handleTemplateSelect = (template: any) => {
    const personalizedMessage = template.message.replace('{{patientName}}', patient?.first_name || 'Patient');
    setMessage(personalizedMessage);
    setShowTemplates(false);
  };

  return (
    <FullScreenModal isOpen={isOpen} onClose={onClose} modalId="send-message-modal">
      <div className="h-full bg-white flex flex-col">
            {/* Header */}
            <div className={`bg-gradient-to-r ${currentTheme.gradients.sidebar} p-6 text-white`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Send Message</h2>
                    <p className="text-blue-100 text-sm">
                      {patient ? `${patient.first_name} ${patient.last_name}` : 'Patient'}
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
              {/* Patient Info */}
              {patient && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900">
                        {patient.first_name} {patient.last_name}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3 h-3" />
                        {patient.cell_number}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Phone Number Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Phone Number
                </label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
                    placeholder="Enter phone number"
                  />
                </div>
              </div>

              {/* Professional SMS Templates */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    SMS Templates
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
                      {smsTemplates.map((template, index) => (
                        <button
                          key={index}
                          onClick={() => handleTemplateSelect(template)}
                          className="text-left p-3 bg-white hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg transition-all duration-200 group"
                        >
                          <div className="font-medium text-gray-900 text-sm group-hover:text-blue-700">
                            {template.name}
                          </div>
                          <div className="text-xs text-gray-600 group-hover:text-blue-600 mt-1 line-clamp-2">
                            {template.message.substring(0, 80)}...
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
                    {quickMessages.map((quickMsg, index) => (
                      <button
                        key={index}
                        onClick={() => handleQuickMessage(quickMsg)}
                        className="w-full text-left p-3 bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-lg text-sm transition-all duration-200"
                      >
                        {quickMsg}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Message Input */}
              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Message
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="w-full p-4 bg-gray-50 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all resize-none"
                  placeholder="Type your message here..."
                />
                <div className="text-xs text-gray-500 flex justify-between">
                  <span>{message.length} characters</span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Standard SMS rates apply
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
                    Message sent successfully!
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
                    Failed to send message. Please try again.
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
                disabled={isSending || !message.trim() || !phoneNumber.trim()}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 flex items-center gap-2"
              >
                {isSending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Send Message
                  </>
                )}
              </Button>
            </div>
          </div>
    </FullScreenModal>
  );
};

export default SendMessageModal;