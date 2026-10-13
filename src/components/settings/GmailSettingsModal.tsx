import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { loadGmailConnection, startGmailConnect } from '../../services/gmailConnectService';
import { useAuthStore } from '../../stores/authStore';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { describeDbError, ensureRowsUpdated } from './UserManagement/staffUtils';

interface GmailSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnectionChange?: () => void;
}

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}

interface GmailCredentials {
  email: string;
  connected_at: string | null;
  last_used_at: string | null;
  metadata: {
    name?: string;
    picture?: string;
    verified_email?: boolean;
  };
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) => {
  // Escape cancels, as Cancel does (only this confirmation, not the Gmail window under it)
  useEscapeToClose(isOpen, onClose);
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            key="confirm-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-[60]"
          />
          <motion.div
            key="confirm-modal"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-[61] p-4"
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Icon icon="solar:danger-triangle-bold-duotone" className="w-6 h-6 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              </div>
              
              <p className="text-gray-600 mb-6">{message}</p>
              
              <div className="flex gap-3 justify-end">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="min-w-[100px]"
                >
                  {cancelText}
                </Button>
                <Button
                  onClick={() => {
                    onConfirm();
                    onClose();
                  }}
                  className="min-w-[100px] bg-red-600 text-white hover:bg-red-700"
                >
                  {confirmText}
                </Button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export const GmailSettingsModal: React.FC<GmailSettingsModalProps> = ({ 
  isOpen, 
  onClose,
  onConnectionChange 
}) => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<GmailCredentials | null>(null);
  const [hasOAuthApp, setHasOAuthApp] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  // The connection is the practice's: administrators and doctors may remove it (the database refuses anyone else)
  const role = useAuthStore((state) => state.user?.role);
  const canDisconnect = role === 'admin' || role === 'doctor';
  // Escape closes the window, as its X does
  useEscapeToClose(isOpen, onClose);

  useEffect(() => {
    if (isOpen) {
      checkGmailStatus();
    }
  }, [isOpen, practiceId]);

  const checkGmailStatus = async () => {
    try {
      setLoading(true);

      // Check OAuth app configuration
      const { data: oauthApp } = await supabase
        .from('practice_oauth_apps')
        .select('client_id')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      setHasOAuthApp(!!oauthApp);

      // The connected account: its address, dates and profile, never its tokens
      const connection = await loadGmailConnection(practiceId);
      setCredentials(connection
        ? {
            email: connection.email,
            connected_at: connection.connectedAt,
            last_used_at: connection.lastUsedAt,
            metadata: { name: connection.name ?? undefined, picture: connection.picture ?? undefined }
          }
        : null);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
      toast.error('Could not check the Gmail connection. Please close this window and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!hasOAuthApp) {
      toast.error('Please add Google OAuth credentials first');
      return;
    }

    // The server signs the sign-in for this practice and person. Google then sends the browser back to Settings,
    // which hands the code to the server: the browser never sees the client secret or the tokens.
    const start = await startGmailConnect(practiceId);
    if (!start.ok) {
      toast.error(start.message);
      return;
    }
    window.location.assign(start.url);
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      
      const { data: removed, error } = await supabase
        .from('practice_oauth_credentials')
        .delete()
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .select('id');

      if (error) throw error;
      // A refused delete removes nothing and reports no error: never say "disconnected" then
      ensureRowsUpdated(removed, 'The Gmail connection');

      // Show success toast once
      toast.success('Gmail disconnected successfully');
      setCredentials(null);
      
      // Emit disconnect event
      const event = new CustomEvent('gmail-disconnected');
      window.dispatchEvent(event);
      
      if (onConnectionChange) {
        onConnectionChange();
      }
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast.error(describeDbError(error, 'Gmail could not be disconnected'));
    } finally {
      setDisconnecting(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTestingSend(true);
      
      // Get user's email for test
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.email) {
        toast.error('No user email found');
        return;
      }

      // Call the centralized email gateway
      const { data, error } = await supabase.functions.invoke('centralized-email-gateway', {
        body: {
          practiceId,
          recipientEmail: user.email,
          subject: 'Test Email from OneHealth',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Test email</h2>
              <p>This is a test email from your OneHealth practice management system.</p>
              <p>It checks the practice's Gmail connection for <strong>${credentials?.email}</strong>.</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 12px;">
                Sent from OneHealth Practice Management System
              </p>
            </div>
          `,
          emailType: 'test'
        }
      });

      if (error) throw error;

      // When Gmail fails the gateway still sends, through OneHealth's own email: then Gmail is not working
      if ((data as { provider?: string } | null)?.provider !== 'gmail') {
        toast.error(`Gmail could not send it: the test email went to ${user.email} through OneHealth's own email instead. Reconnect Gmail and try again.`);
        return;
      }
      toast.success(`Test email sent to ${user.email} through Gmail`);
    } catch (error) {
      console.error('Error sending test email:', error);
      toast.error('Failed to send test email');
    } finally {
      setTestingSend(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            key="gmail-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-50 z-50"
          />

          {/* Modal */}
          <motion.div
            key="gmail-modal-content"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
          >
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-lg">
                      <Icon icon="logos:google-gmail" className="w-6 h-6" />
                    </div>
                    <h2 className="text-xl font-semibold text-white">Gmail Settings</h2>
                  </div>
                  <button
                    onClick={onClose}
                    aria-label="Close Gmail settings"
                    title="Close"
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  >
                    <Icon icon="solar:close-circle-bold" className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
                  </div>
                ) : credentials ? (
                  <>
                    {/* Connected State */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                      <div className="flex items-start gap-4">
                        <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-600 flex-shrink-0" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-green-900 text-lg mb-2">Gmail Connected</h3>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:letter-bold" className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-800">{credentials.email}</span>
                            </div>
                            
                            {credentials.metadata?.name && (
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:user-bold" className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800">{credentials.metadata.name}</span>
                              </div>
                            )}
                            
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:calendar-bold" className="w-4 h-4 text-green-600" />
                              <span className="text-sm text-green-800">
                                Connected{credentials.connected_at ? ` ${format(new Date(credentials.connected_at), 'dd MMM yyyy')}` : ''}
                              </span>
                            </div>
                            
                            {credentials.last_used_at && (
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:history-bold" className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800">
                                  Last used {format(new Date(credentials.last_used_at), 'dd MMM yyyy')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {credentials.metadata?.picture && (
                          <img
                            src={credentials.metadata.picture}
                            alt={credentials.metadata.name || credentials.email}
                            className="w-16 h-16 rounded-full border-2 border-green-200"
                          />
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        onClick={handleTestEmail}
                        disabled={testingSend}
                        className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
                      >
                        {testingSend ? (
                          <>
                            <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 mr-2" />
                            Send Test Email
                          </>
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => setShowConfirmModal(true)}
                        disabled={disconnecting || !canDisconnect}
                        title={canDisconnect ? undefined : 'Only administrators and doctors can disconnect Gmail'}
                        variant="outline"
                        className="flex-1 border-red-300 text-red-600 hover:bg-red-50"
                      >
                        {disconnecting ? (
                          <>
                            <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
                            Disconnecting...
                          </>
                        ) : (
                          <>
                            <Icon icon="solar:link-broken-bold" className="w-5 h-5 mr-2" />
                            Disconnect Gmail
                          </>
                        )}
                      </Button>
                    </div>

                    {/* Info */}
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <h4 className="font-medium text-blue-900 mb-2">How Gmail Integration Works</h4>
                      <ul className="space-y-1 text-sm text-blue-800">
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-circle-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Automated emails are sent from your Gmail account</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-circle-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Perfect for automated emails and workflows</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-circle-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Secure OAuth 2.0 authentication</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-circle-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>No password storage - uses secure tokens</span>
                        </li>
                      </ul>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Not Connected State */}
                    <div className="text-center py-8">
                      <Icon icon="solar:link-broken-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Gmail Not Connected</h3>
                      <p className="text-gray-600 mb-6">
                        Connect your Gmail account to send automated emails from your practice
                      </p>
                      
                      {hasOAuthApp ? (
                        <Button
                          onClick={handleConnect}
                          className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                        >
                          <Icon icon="logos:google-icon" className="w-5 h-5 mr-2" />
                          Connect with Google
                        </Button>
                      ) : (
                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 max-w-md mx-auto">
                          <Icon icon="solar:info-circle-bold-duotone" className="w-6 h-6 text-amber-600 mx-auto mb-2" />
                          <p className="text-sm text-amber-800 mb-3">
                            Gmail needs your practice's Google sign-in details first. Close this window, click
                            "Add Account" on this page, choose Gmail and enter your Google OAuth Client ID and
                            Client Secret.
                          </p>
                          {/* This button only closes the window: the 'navigate-to-oauth' listener in Settings.tsx
                              looks for a tab element that does not exist, so the steps above say where to go */}
                          <Button
                            variant="outline"
                            onClick={() => {
                              onClose();
                              const event = new CustomEvent('navigate-to-oauth');
                              window.dispatchEvent(event);
                            }}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            <Icon icon="solar:settings-bold" className="w-4 h-4 mr-2" />
                            Close and add Gmail details
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Benefits */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <Icon icon="solar:magic-stick-3-bold-duotone" className="w-8 h-8 text-purple-600 mb-2" />
                        <h4 className="font-medium text-gray-900 mb-1">Automated Emails</h4>
                        <p className="text-sm text-gray-600">
                          Perfect for automated workflows and patient communications
                        </p>
                      </div>
                      
                      <div className="bg-gray-50 rounded-lg p-4">
                        <Icon icon="solar:shield-check-bold-duotone" className="w-8 h-8 text-green-600 mb-2" />
                        <h4 className="font-medium text-gray-900 mb-1">Secure & Private</h4>
                        <p className="text-sm text-gray-600">
                          OAuth 2.0 authentication without storing passwords
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
      
      {/* Confirmation Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleDisconnect}
        title="Disconnect Gmail?"
        message="Are you sure you want to disconnect your Gmail account? Emails then go out through OneHealth's own email until you reconnect."
        confirmText="Disconnect"
        cancelText="Cancel"
      />
    </AnimatePresence>
  );
};