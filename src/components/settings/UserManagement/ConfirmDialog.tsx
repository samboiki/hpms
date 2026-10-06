import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

type ConfirmTone = 'danger' | 'warning' | 'success' | 'primary';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: React.ReactNode;
  confirmLabel: string;
  tone?: ConfirmTone;
  isLoading?: boolean;
  /** Show a text box (e.g. a rejection reason). */
  commentLabel?: string;
  commentPlaceholder?: string;
  commentRequired?: boolean;
  onConfirm: (comment: string) => void;
  onCancel: () => void;
}

const TONE_STYLES: Record<ConfirmTone, { icon: string; iconWrap: string; button: string }> = {
  danger: {
    icon: 'solar:danger-triangle-bold-duotone',
    iconWrap: 'bg-red-100 text-red-600',
    button: 'bg-red-600 hover:bg-red-700 focus:ring-red-500'
  },
  warning: {
    icon: 'solar:danger-circle-bold-duotone',
    iconWrap: 'bg-amber-100 text-amber-600',
    button: 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500'
  },
  success: {
    icon: 'solar:check-circle-bold-duotone',
    iconWrap: 'bg-green-100 text-green-600',
    button: 'bg-green-600 hover:bg-green-700 focus:ring-green-500'
  },
  primary: {
    icon: 'solar:info-circle-bold-duotone',
    iconWrap: 'bg-purple-100 text-purple-600',
    button: 'bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-600 hover:to-indigo-700 focus:ring-purple-500'
  }
};

/**
 * Confirmation step for actions that change staff, leave, payroll or timesheet records.
 * Rendered in a portal so it is never clipped or offset by animated parents.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  tone = 'primary',
  isLoading = false,
  commentLabel,
  commentPlaceholder,
  commentRequired = false,
  onConfirm,
  onCancel
}) => {
  const [comment, setComment] = useState('');
  const [showCommentError, setShowCommentError] = useState(false);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  // Fresh, focused form each time the dialog opens (kept while a save is in flight)
  useEffect(() => {
    if (!isOpen) return;
    setComment('');
    setShowCommentError(false);
    cancelButtonRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isLoading) onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  const styles = TONE_STYLES[tone];

  const handleConfirm = () => {
    if (commentLabel && commentRequired && !comment.trim()) {
      setShowCommentError(true);
      return;
    }
    onConfirm(comment.trim());
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="staff-confirm-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isLoading) onCancel();
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start gap-4 p-6">
          <div className={`flex-shrink-0 rounded-xl p-3 ${styles.iconWrap}`}>
            <Icon icon={styles.icon} className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 id="staff-confirm-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h3>
            <div className="mt-2 text-sm text-gray-600">{message}</div>
            {commentLabel && (
              <div className="mt-4">
                <label htmlFor="staff-confirm-comment" className="mb-1 block text-sm font-medium text-gray-700">
                  {commentLabel}
                  {commentRequired && <span className="text-red-500"> *</span>}
                </label>
                <textarea
                  id="staff-confirm-comment"
                  value={comment}
                  onChange={(event) => {
                    setComment(event.target.value);
                    if (showCommentError) setShowCommentError(false);
                  }}
                  rows={3}
                  placeholder={commentPlaceholder}
                  className={`w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 ${
                    showCommentError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {showCommentError && (
                  <p className="mt-1 text-sm text-red-600">Please enter a reason before continuing.</p>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-3 rounded-b-2xl border-t border-gray-100 bg-gray-50 px-6 py-4">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isLoading}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles.button}`}
          >
            {isLoading && <Icon icon="solar:refresh-bold-duotone" className="h-4 w-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default ConfirmDialog;
