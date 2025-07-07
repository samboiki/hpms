import React from 'react';
import { motion } from 'framer-motion';
import { Mail, MessageSquare } from 'lucide-react';
import FormModal from '../modals/FormModal';
import { Patient } from '../../stores/patientsStoreNew';

interface PremiumSmsModalProps {
  isOpen: boolean;
  onClose: () => void;
  filteredPatients: Patient[];
  smsPhone: string;
  setSmsPhone: (phone: string) => void;
  smsContent: string;
  setSmsContent: (content: string) => void;
  isSendingSms: boolean;
  isSendingBulkSms: boolean;
  onSendSms: () => void;
  onSendBulkSms: () => void;
}

export const PremiumSmsModal: React.FC<PremiumSmsModalProps> = ({
  isOpen,
  onClose,
  filteredPatients,
  smsPhone,
  setSmsPhone,
  smsContent,
  setSmsContent,
  isSendingSms,
  isSendingBulkSms,
  onSendSms,
  onSendBulkSms,
}) => {
  const isBulkMode = filteredPatients.length > 0;
  const isLoading = isBulkMode ? isSendingBulkSms : isSendingSms;
  
  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title=""
      hideHeader={true}
    >
      <div className="relative bg-gradient-to-br from-white via-blue-50/30 to-purple-50/20 rounded-2xl shadow-2xl overflow-hidden">
        <div className="relative bg-gradient-to-r from-[#01b9d5] to-purple-600 p-6 text-white">
          <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-purple-600/20 backdrop-blur-sm"></div>
          <div className="relative flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Mail className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Send SMS Message</h2>
              <p className="text-blue-100 text-sm">
                {isBulkMode
                  ? `Sending to ${filteredPatients.length} filtered patients`
                  : 'Contact Next of Kin directly'
                }
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {!isBulkMode && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700">Phone Number</label>
              <input
                type="tel"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value)}
                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all font-mono text-gray-800"
                placeholder="Enter phone number"
              />
            </div>
          )}

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-gray-700">Message Content</label>
            <div className="relative">
              <textarea
                rows={4}
                value={smsContent}
                onChange={(e) => setSmsContent(e.target.value)}
                className="w-full p-4 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#01b9d5]/30 focus:border-[#01b9d5] transition-all resize-none"
                placeholder="Type your message here..."
              />
              <div className="absolute bottom-3 right-3 text-xs text-gray-400">
                Character count: {smsContent.length}/1600
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-100">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.98 }}
              onClick={isBulkMode ? onSendBulkSms : onSendSms}
              disabled={isLoading || !smsContent.trim() || (!isBulkMode && !smsPhone.trim())}
              className="flex-1 px-6 py-3 bg-gradient-to-r from-[#01b9d5] to-purple-600 text-white rounded-xl shadow-lg hover:shadow-2xl transition-all font-semibold flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Sending...
                </>
              ) : (
                <>
                  <MessageSquare className="w-4 h-4" />
                  Send SMS
                </>
              )}
            </motion.button>
          </div>
        </div>
      </div>
    </FormModal>
  );
};