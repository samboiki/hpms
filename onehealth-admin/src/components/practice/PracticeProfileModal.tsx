import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import type { Practice } from '../../types/practice.types';

interface PracticeProfileModalProps {
  practice: Practice | null;
  isOpen: boolean;
  onClose: () => void;
}

export const PracticeProfileModal: React.FC<PracticeProfileModalProps> = ({
  practice,
  isOpen,
  onClose,
}) => {
  if (!practice) return null;

  const getStatusColor = (status: string) => {
    const colors = {
      lead: 'bg-gray-100 text-gray-800 border-gray-300',
      contacted: 'bg-blue-100 text-blue-800 border-blue-300',
      qualified: 'bg-purple-100 text-purple-800 border-purple-300',
      onboarding: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      active: 'bg-green-100 text-green-800 border-green-300',
      inactive: 'bg-red-100 text-red-800 border-red-300',
    };
    return colors[status as keyof typeof colors] || colors.lead;
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      lead: 'solar:star-bold-duotone',
      contacted: 'solar:phone-calling-bold-duotone',
      qualified: 'solar:verified-check-bold-duotone',
      onboarding: 'solar:clipboard-list-bold-duotone',
      active: 'solar:shield-check-bold-duotone',
      inactive: 'solar:close-circle-bold-duotone',
    };
    return icons[status as keyof typeof icons] || icons.lead;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            >
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 px-8 py-6 text-white">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                        <Icon icon="solar:buildings-3-bold-duotone" className="w-8 h-8" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">{practice.name}</h2>
                        <p className="text-purple-100 text-sm capitalize">
                          {practice.practice_type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${getStatusColor(practice.status)}`}>
                        <Icon icon={getStatusIcon(practice.status)} className="w-4 h-4" />
                        {practice.status.charAt(0).toUpperCase() + practice.status.slice(1)}
                      </span>
                      <span className="px-3 py-1.5 bg-white/20 backdrop-blur-sm rounded-full text-sm font-medium">
                        {practice.subscription_tier}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-full transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-8 overflow-y-auto max-h-[calc(90vh-180px)]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Contact Information */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon="solar:phone-calling-bold-duotone" className="w-5 h-5 text-purple-500" />
                      Contact Information
                    </h3>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-4 rounded-xl border border-gray-200/50 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Email</p>
                          <p className="text-sm text-gray-900">{practice.email}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Phone</p>
                          <p className="text-sm text-gray-900">{practice.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <Icon icon="solar:map-point-bold-duotone" className="w-4 h-4 text-green-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Location</p>
                          <p className="text-sm text-gray-900">{practice.city}, {practice.country}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Practice Details */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                      <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-indigo-500" />
                      Practice Details
                    </h3>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100/30 p-4 rounded-xl border border-gray-200/50 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Registered</p>
                          <p className="text-sm text-gray-900">
                            {new Date(practice.created_at).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <Icon icon="solar:crown-bold-duotone" className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Subscription Tier</p>
                          <p className="text-sm text-gray-900 capitalize">{practice.subscription_tier}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-pink-100 rounded-lg">
                          <Icon icon="solar:tag-bold-duotone" className="w-4 h-4 text-pink-600" />
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 font-medium">Practice ID</p>
                          <p className="text-sm text-gray-900 font-mono">{practice.id.slice(0, 13)}...</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex gap-3 justify-end">
                  <button className="px-6 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium">
                    <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                    Edit Practice
                  </button>
                  <button className="px-6 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all flex items-center gap-2 font-medium">
                    <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
                    View Full Details
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
