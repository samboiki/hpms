import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { describeDbError, ensureRowsUpdated, formatRole, formatStaffName } from './staffUtils';

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
}

interface DeleteUserModalProps {
  user: UserData;
  /** Reason the change is not allowed (self / last administrator), shown instead of the action. */
  blocker?: string | null;
  onClose: () => void;
  onSuccess: (isActive: boolean) => void;
}

/**
 * Deactivates or reactivates a staff member. Historically named "delete": it never removes
 * the user row, so payroll, leave, timesheet and visit history stay intact.
 */
export const DeleteUserModal: React.FC<DeleteUserModalProps> = ({ user, blocker, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const isDeactivating = user.is_active !== false;
  const displayName = formatStaffName(user);

  const handleConfirm = async () => {
    if (blocker) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .update({ is_active: !isDeactivating, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('id');

      if (error) throw error;
      ensureRowsUpdated(data, `${displayName}'s status`);

      toast.success(
        isDeactivating
          ? `${displayName} has been deactivated`
          : `${displayName} has been reactivated`
      );
      onSuccess(!isDeactivating);
    } catch (error) {
      console.error('Error changing staff status:', error);
      toast.error(describeDbError(error, isDeactivating ? 'Could not deactivate staff member' : 'Could not reactivate staff member'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-start gap-4 p-6">
          <div className={`p-3 rounded-xl flex-shrink-0 ${isDeactivating ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
            <Icon
              icon={isDeactivating ? 'solar:user-block-rounded-bold-duotone' : 'solar:user-check-rounded-bold-duotone'}
              className="w-6 h-6"
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900">
                {isDeactivating ? 'Deactivate staff member' : 'Reactivate staff member'}
              </h3>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Close"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-3 rounded-lg bg-gray-50 p-3 text-sm">
              <p className="font-medium text-gray-900">{displayName}</p>
              <p className="text-gray-600">{user.email}</p>
              <p className="text-gray-600">{formatRole(user.role)}</p>
            </div>

            {blocker ? (
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                <Icon icon="solar:danger-triangle-bold-duotone" className="w-5 h-5 flex-shrink-0" />
                <span>{blocker}</span>
              </div>
            ) : isDeactivating ? (
              <ul className="mt-4 space-y-1.5 text-sm text-gray-600">
                <li className="flex gap-2"><Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />Their payroll, leave, timesheet and visit history is kept.</li>
                <li className="flex gap-2"><Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mt-0.5 text-green-600 flex-shrink-0" />They move to the inactive staff list and can be reactivated at any time.</li>
                <li className="flex gap-2"><Icon icon="solar:info-circle-bold-duotone" className="w-4 h-4 mt-0.5 text-amber-600 flex-shrink-0" />They are excluded from new payroll runs and leave carry-over.</li>
              </ul>
            ) : (
              <p className="mt-4 text-sm text-gray-600">
                {displayName} will appear in the active staff list again with their existing records.
              </p>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {blocker ? 'Close' : 'Cancel'}
          </button>
          {!blocker && (
            <button
              type="button"
              onClick={handleConfirm}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-60 disabled:cursor-not-allowed ${
                isDeactivating ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {loading && <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 animate-spin" />}
              {loading
                ? (isDeactivating ? 'Deactivating...' : 'Reactivating...')
                : (isDeactivating ? 'Deactivate' : 'Reactivate')}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  );
};
