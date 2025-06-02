import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, Phone, User, Clock } from 'lucide-react';
import Button from '../ui/Button';
import { defaultSMSService } from '../../services/smsPortal';

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
  const [message, setMessage] = useState('');
  const [phoneNumber, setPhoneNumber] = useState(patient?.cell_number || '');
  const [isSending, setIsSending] = useState(false);
  const [sendStatus, setSendStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleSend = async () => {
    if (!message.trim() || !phoneNumber.trim()) {
      alert('Please enter both phone number and message content');
      return;
    }

    setIsSending(true);
    setSendStatus('idle');

    try {
      const response = await defaultSMSService.sendSMS(phoneNumber, message);
      
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
      }
    } catch (error) {
      setSendStatus('error');
      console.error('Error sending SMS:', error);
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

  const handleQuickMessage = (quickMsg: string) => {
    setMessage(quickMsg);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-200/50 overflow-hidden"
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 text-white">
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
            <div className="p-6 space-y-6">
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

              {/* Quick Messages */}
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-gray-700">
                  Quick Messages
                </label>
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SendMessageModal;