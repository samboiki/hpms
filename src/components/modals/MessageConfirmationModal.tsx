import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, MessageSquare, Mail, X } from 'lucide-react';
import FormModal from './FormModal';

interface MessageConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'sms' | 'email';
  recipientName?: string;
  recipientContact?: string;
}

const MessageConfirmationModal: React.FC<MessageConfirmationModalProps> = ({
  isOpen,
  onClose,
  type,
  recipientName,
  recipientContact
}) => {
  const isEmail = type === 'email';
  
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      hideHeader={true}
      className="max-w-md"
    >
      <div className="relative bg-gradient-to-br from-white via-green-50/30 to-emerald-50/20 rounded-2xl shadow-2xl overflow-hidden">
        {/* Success Header */}
        <div className="relative bg-gradient-to-r from-green-500 to-emerald-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/20 to-emerald-600/20 backdrop-blur-sm"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <CheckCircle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">Message Sent!</h2>
                <p className="text-green-100 text-sm">
                  Your {isEmail ? 'email' : 'SMS'} has been sent
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Success Animation */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="text-center mb-6"
          >
            <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
              {isEmail ? (
                <Mail className="w-8 h-8 text-white" />
              ) : (
                <MessageSquare className="w-8 h-8 text-white" />
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-800 mb-2">
              {isEmail ? 'Email Sent' : 'SMS Sent'}
            </h3>
            <p className="text-gray-600 text-sm">
              Your message has been successfully sent
              {recipientName && (
                <> to <span className="font-semibold">{recipientName}</span></>
              )}
              {recipientContact && (
                <> at <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">{recipientContact}</span></>
              )}
            </p>
          </motion.div>

          {/* Additional Info */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4 border border-gray-200 mb-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <CheckCircle className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-800 text-sm">What happens next</h4>
                <p className="text-xs text-gray-600 mt-1">
                  {isEmail 
                    ? 'The email has been queued for delivery and will reach the recipient shortly.'
                    : 'The SMS has been passed to the SMS provider and usually arrives within a few minutes.'
                  }
                </p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClose}
            className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl hover:shadow-lg transition-all font-medium flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Continue
          </motion.button>
        </div>
      </div>
    </FormModal>
  );
};

export default MessageConfirmationModal;