import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, Users, Mail, MessageSquare, Phone, User, CheckCircle, Shield, Crown } from 'lucide-react';
import Button from '../ui/Button';
import { useTheme } from '../../stores/themeStore';

interface Recipient {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  cell_number?: string;
}

interface PremiumConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  type: 'email' | 'sms';
  recipients: Recipient[];
  title?: string;
  message?: string;
}

const PremiumConfirmationModal: React.FC<PremiumConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  type,
  recipients,
  title,
  message
}) => {
  const { currentTheme } = useTheme();

  const validRecipients = recipients.filter(r => 
    type === 'email' ? (r.email && r.email.trim() !== '') : (r.cell_number && r.cell_number.trim() !== '')
  );

  const invalidCount = recipients.length - validRecipients.length;
  const patientCount = (count: number) => `${count} ${count === 1 ? 'patient' : 'patients'}`;
  const contactLabel = type === 'email' ? 'email addresses' : 'phone numbers';

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
          {/* Premium Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-gradient-to-br from-black/60 via-black/70 to-black/80 backdrop-blur-xl"
          />

          {/* Premium Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 30 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-gray-200/30 overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(255, 255, 255, 0.05)'
            }}
          >
            {/* Premium Header */}
            <div className={`relative bg-gradient-to-r ${currentTheme.gradients.sidebar} p-8 text-white overflow-hidden`}>
              {/* Background Pattern */}
              <div className="absolute inset-0 opacity-10">
                <div className="absolute top-0 left-0 w-32 h-32 bg-white rounded-full -translate-x-16 -translate-y-16"></div>
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-white rounded-full translate-x-12 translate-y-12"></div>
              </div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm border border-white/30">
                    {type === 'email' ? (
                      <Mail className="w-7 h-7" />
                    ) : (
                      <MessageSquare className="w-7 h-7" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Crown className="w-5 h-5 text-yellow-300" />
                      <h2 className="text-2xl font-bold tracking-tight">
                        {title || `Send ${type === 'email' ? 'Email' : 'SMS'}`}
                      </h2>
                    </div>
                    <p className="text-blue-100/90 text-sm font-medium">
                      Professional Healthcare Communication
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-3 hover:bg-white/10 rounded-xl transition-all duration-200 hover:scale-110"
                  aria-label="Close"
                  title="Close"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            {/* Premium Content */}
            <div className="p-8 space-y-6">
              {/* Summary Card */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-200/50">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-blue-100 rounded-xl">
                    <Users className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 mb-1">
                      Communication Summary
                    </h3>
                    <div className="space-y-1 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="font-medium text-green-700">
                          {patientCount(validRecipients.length)} with valid {contactLabel}
                        </span>
                      </div>
                      {invalidCount > 0 && (
                        <div className="flex items-center gap-2">
                          <X className="w-4 h-4 text-orange-500" />
                          <span className="text-orange-600">
                            {patientCount(invalidCount)} without valid {contactLabel} (will be skipped)
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipients Preview */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-blue-600" />
                  <h4 className="text-lg font-semibold text-gray-900">
                    Recipients ({validRecipients.length})
                  </h4>
                </div>
                
                <div className="bg-gray-50 rounded-xl border border-gray-200 max-h-48 overflow-y-auto">
                  <div className="p-4 space-y-3">
                    {validRecipients.slice(0, 8).map((recipient, index) => (
                      <div key={recipient.id} className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-100">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <User className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 truncate">
                            {recipient.first_name} {recipient.last_name}
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            {type === 'email' ? (
                              <>
                                <Mail className="w-3 h-3" />
                                <span className="truncate">{recipient.email}</span>
                              </>
                            ) : (
                              <>
                                <Phone className="w-3 h-3" />
                                <span>{recipient.cell_number}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {validRecipients.length > 8 && (
                      <div className="text-center p-3 text-sm text-gray-500 bg-gray-100 rounded-lg">
                        ... and {validRecipients.length - 8} more recipients
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Message Preview */}
              {message && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700">Message Preview</h4>
                  <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                    <p className="text-sm text-gray-700 line-clamp-3">{message}</p>
                  </div>
                </div>
              )}

              {/* Professional Notice */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Shield className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-1">Check before sending</p>
                    <p>Make sure the recipients and the message are correct: a message cannot be recalled once it has been sent.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Premium Footer */}
            <div className="p-8 bg-gradient-to-r from-gray-50 to-gray-100 border-t border-gray-200/50">
              <div className="flex gap-4 justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="px-6 py-3 font-medium"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleConfirm}
                  className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-medium flex items-center gap-3 shadow-lg hover:shadow-xl transition-all duration-200"
                  disabled={validRecipients.length === 0}
                  title={validRecipients.length === 0 ? `None of the selected patients have ${contactLabel}` : undefined}
                >
                  <Send className="w-5 h-5" />
                  Send to {patientCount(validRecipients.length)}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PremiumConfirmationModal;