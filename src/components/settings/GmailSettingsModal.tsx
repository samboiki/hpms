import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

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
  connected_at: string;
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

      // Check Gmail credentials
      const { data: creds } = await supabase
        .from('practice_oauth_credentials')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      setCredentials(creds);
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!hasOAuthApp) {
      toast.error('Please add Google OAuth credentials first');
      return;
    }

    // Check if we have an OAuth code in the URL - if so, process it
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Process the OAuth code
      try {
        // Get OAuth app credentials first
        const { data: oauthApp, error: appError } = await supabase
          .from('practice_oauth_apps')
          .select('client_id, client_secret')
          .eq('practice_id', practiceId)
          .eq('provider', 'google')
          .single();

        if (appError || !oauthApp) {
          toast.error('OAuth credentials not found');
          return;
        }

        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: oauthApp.client_id,
            client_secret: oauthApp.client_secret,
            redirect_uri: 'http://localhost:5000/settings',
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const error = await tokenResponse.text();
          throw new Error(`Token exchange failed: ${error}`);
        }

        const tokens = await tokenResponse.json();

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        const userInfo = await userInfoResponse.json();

        // Save credentials
        const credentialData = {
          practice_id: practiceId,
          provider: 'google',
          email: userInfo.email,
          refresh_token: tokens.refresh_token,
          access_token: tokens.access_token,
          token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
          scopes: tokens.scope?.split(' ') || [],
          metadata: {
            name: userInfo.name,
            picture: userInfo.picture,
            verified_email: userInfo.verified_email,
          },
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error: saveError } = await supabase
          .from('practice_oauth_credentials')
          .insert(credentialData);

        if (!saveError) {
          toast.success('Gmail connected successfully!');
          // Clear URL and refresh
          window.history.replaceState({}, document.title, window.location.pathname + '?tab=social');
          await checkGmailStatus();
          if (onConnectionChange) {
            onConnectionChange();
          }
        } else {
          console.error('Save error:', saveError);
          toast.error('Failed to save credentials');
        }
      } catch (err: any) {
        console.error('OAuth processing error:', err);
        toast.error(err.message);
      }
      return;
    }

    // No code present, initiate OAuth flow
    try {
      // Get OAuth app credentials
      const { data: oauthApp, error } = await supabase
        .from('practice_oauth_apps')
        .select('client_id')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      if (error || !oauthApp) {
        toast.error('OAuth credentials not found');
        return;
      }

      // Create OAuth URL and redirect
      const stateData = {
        practice_id: practiceId,
        redirect_origin: window.location.origin
      };
      const state = btoa(JSON.stringify(stateData));

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', oauthApp.client_id);
      authUrl.searchParams.append('redirect_uri', 'http://localhost:5000/settings');
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', [
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.compose',
        'https://www.googleapis.com/auth/userinfo.email'
      ].join(' '));
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      authUrl.searchParams.append('state', state);

      window.location.href = authUrl.toString();
    } catch (error) {
      console.error('Error initiating OAuth:', error);
      toast.error('Failed to initiate OAuth connection');
    }
  };

  const handleDisconnect = async () => {
    try {
      setDisconnecting(true);
      
      const { error } = await supabase
        .from('practice_oauth_credentials')
        .delete()
        .eq('practice_id', practiceId)
        .eq('provider', 'google');

      if (error) throw error;

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
      toast.error('Failed to disconnect Gmail');
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
      const { error } = await supabase.functions.invoke('centralized-email-gateway', {
        body: {
          practiceId,
          recipientEmail: user.email,
          subject: 'Test Email from OneHealth',
          htmlContent: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2>Test Email Successful!</h2>
              <p>This is a test email from your OneHealth practice management system.</p>
              <p>Gmail integration is working correctly for <strong>${credentials?.email}</strong>.</p>
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

      toast.success(`Test email sent to ${user.email}`);
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
                    className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                  >
                    <Icon icon="solar:close-bold" className="w-5 h-5" />
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
                              <Icon icon="solar:mail-bold" className="w-4 h-4 text-green-600" />
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
                                Connected {new Date(credentials.connected_at).toLocaleDateString()}
                              </span>
                            </div>
                            
                            {credentials.last_used_at && (
                              <div className="flex items-center gap-2">
                                <Icon icon="solar:history-bold" className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-800">
                                  Last used {new Date(credentials.last_used_at).toLocaleDateString()}
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
                        disabled={disconnecting}
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
                            <Icon icon="solar:unlink-bold" className="w-5 h-5 mr-2" />
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
                          <Icon icon="solar:check-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Automated emails are sent from your Gmail account</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Perfect for automated emails and workflows</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
                          <span>Secure OAuth 2.0 authentication</span>
                        </li>
                        <li className="flex items-start gap-2">
                          <Icon icon="solar:check-bold" className="w-4 h-4 mt-0.5 flex-shrink-0" />
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
                            OAuth credentials required to connect Gmail
                          </p>
                          <Button
                            variant="outline"
                            onClick={() => {
                              onClose();
                              // Navigate to OAuth Applications tab
                              const event = new CustomEvent('navigate-to-oauth');
                              window.dispatchEvent(event);
                            }}
                            className="text-amber-700 border-amber-300 hover:bg-amber-50"
                          >
                            <Icon icon="solar:settings-bold" className="w-4 h-4 mr-2" />
                            Configure OAuth App
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Benefits */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-gray-50 rounded-lg p-4">
                        <Icon icon="solar:automation-bold-duotone" className="w-8 h-8 text-purple-600 mb-2" />
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
        message="Are you sure you want to disconnect your Gmail account? Automated emails will stop working until you reconnect."
        confirmText="Disconnect"
        cancelText="Cancel"
      />
    </AnimatePresence>
  );
};