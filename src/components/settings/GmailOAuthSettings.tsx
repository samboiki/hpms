import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface GmailConnection {
  connected: boolean;
  email: string | null;
  connected_at: string | null;
  last_used_at: string | null;
  message?: string;
}

export const GmailOAuthSettings: React.FC = () => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [gmailConnection, setGmailConnection] = useState<GmailConnection | null>(null);
  const [automationStats, setAutomationStats] = useState<Array<{
    automation_id: string;
    automation_name: string;
    email_sent: number;
    success_rate: number;
    last_executed: string | null;
  }> | null>(null);

  // OAuth configuration
  const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const REDIRECT_URI = `${window.location.origin}/settings/gmail-callback`;
  const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const checkGmailConnection = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('check_gmail_connection', {
        p_practice_id: practiceId
      });

      if (error) throw error;
      setGmailConnection(data);

      // Load automation statistics
      const { data: stats } = await supabase.rpc('get_practice_automation_stats', {
        p_practice_id: practiceId,
        p_days_back: 30
      });
      
      if (stats) {
        setAutomationStats(stats);
      }
    } catch (error) {
      console.error('Error checking Gmail connection:', error);
      setGmailConnection({
        connected: false,
        email: null,
        connected_at: null,
        last_used_at: null,
        message: 'Failed to check connection status'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkGmailConnection();

    // Check for OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    if (code) {
      handleOAuthCallback(code);
    }
  }, [practiceId]);

  const handleOAuthCallback = async (code: string) => {
    try {
      setConnecting(true);
      
      // Call edge function to exchange code for tokens
      const { data, error } = await supabase.functions.invoke('gmail-oauth-callback', {
        body: {
          code,
          redirect_uri: REDIRECT_URI,
          practice_id: practiceId
        }
      });

      if (error) throw error;

      toast.success('Gmail account connected successfully!');
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, '/settings');
      
      // Refresh connection status
      await checkGmailConnection();
    } catch (error) {
      console.error('OAuth callback error:', error);
      toast.error('Failed to connect Gmail account');
    } finally {
      setConnecting(false);
    }
  };

  const initiateGmailOAuth = () => {
    if (!GOOGLE_CLIENT_ID) {
      toast.error('Google OAuth is not configured. Please contact support.');
      return;
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', GOOGLE_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', SCOPES);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('state', practiceId || '');

    window.location.href = authUrl.toString();
  };

  const disconnectGmail = async () => {
    if (!confirm('Are you sure you want to disconnect your Gmail account? Automated emails will stop working.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('practice_oauth_credentials')
        .delete()
        .eq('practice_id', practiceId)
        .eq('provider', 'google');

      if (error) throw error;

      toast.success('Gmail account disconnected');
      await checkGmailConnection();
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast.error('Failed to disconnect Gmail account');
    }
  };

  if (loading) {
    return (
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Gmail Connection Status */}
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Icon icon="logos:google-gmail" className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Gmail Integration</CardTitle>
                <p className="text-sm text-gray-500">
                  Connect your Gmail account to send automated emails
                </p>
              </div>
            </div>
            {gmailConnection?.connected ? (
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-1" />
                  Connected
                </span>
              </div>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                Not Connected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gmailConnection?.connected ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-green-900">Gmail Connected</h4>
                    <p className="text-sm text-green-700 mt-1">
                      Email: {gmailConnection.email}
                    </p>
                    {gmailConnection.connected_at && (
                      <p className="text-xs text-green-600 mt-1">
                        Connected since: {new Date(gmailConnection.connected_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  Automated emails will be sent from this account
                </div>
                <Button
                  onClick={disconnectGmail}
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                >
                  <Icon icon="solar:unlink-bold" className="w-4 h-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-amber-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-amber-900">Connect Gmail for Automations</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Connect your Gmail account to send automated emails to patients
                    </p>
                    <ul className="text-sm text-amber-700 mt-2 space-y-1">
                      <li className="flex items-center gap-2">
                        <Icon icon="solar:check-bold" className="w-4 h-4" />
                        Welcome emails for new patients
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon icon="solar:check-bold" className="w-4 h-4" />
                        Appointment confirmations and reminders
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon icon="solar:check-bold" className="w-4 h-4" />
                        Lab results notifications
                      </li>
                      <li className="flex items-center gap-2">
                        <Icon icon="solar:check-bold" className="w-4 h-4" />
                        Follow-up care instructions
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <Button
                  onClick={initiateGmailOAuth}
                  disabled={connecting}
                  className="bg-gradient-to-r from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700"
                >
                  {connecting ? (
                    <>
                      <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
                      Connecting...
                    </>
                  ) : (
                    <>
                      <Icon icon="logos:google-icon" className="w-5 h-5 mr-2" />
                      Connect with Google
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Automation Statistics */}
      {automationStats && automationStats.length > 0 && (
        <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-gray-900">
              Email Automation Performance (Last 30 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {automationStats
                .filter(stat => stat.email_sent > 0)
                .map(stat => (
                  <div key={stat.automation_id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="font-medium text-gray-900">{stat.automation_name}</p>
                      <p className="text-sm text-gray-500">
                        {stat.email_sent} emails sent
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        {stat.success_rate}% success
                      </p>
                      {stat.last_executed && (
                        <p className="text-xs text-gray-500">
                          Last sent: {new Date(stat.last_executed).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Security Notice */}
      <Card className="bg-gray-50 rounded-lg border border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Icon icon="solar:shield-check-bold-duotone" className="w-5 h-5 text-gray-600 mt-0.5" />
            <div className="flex-1 text-sm text-gray-600">
              <p className="font-medium text-gray-900 mb-1">Security & Privacy</p>
              <ul className="space-y-1">
                <li>• Your Gmail credentials are encrypted and stored securely</li>
                <li>• We only request permission to send emails on your behalf</li>
                <li>• No access to read your existing emails</li>
                <li>• You can disconnect at any time</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};