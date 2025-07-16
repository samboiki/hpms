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
  const [practiceOAuthApp, setPracticeOAuthApp] = useState<{ client_id: string; client_secret: string } | null>(null);
  const [automationStats, setAutomationStats] = useState<Array<{
    automation_id: string;
    automation_name: string;
    email_sent: number;
    success_rate: number;
    last_executed: string | null;
  }> | null>(null);

  // OAuth configuration - Client-side callback
  // Use the exact redirect URI that's configured in Google Cloud Console
  const GMAIL_REDIRECT_URI = 'http://localhost:5000/settings';
  
  const SCOPES = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/userinfo.email'
  ].join(' ');

  const checkGmailConnection = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      
      // First check if practice has OAuth app configured
      const { data: oauthApp, error: oauthError } = await supabase
        .from('practice_oauth_apps')
        .select('client_id, client_secret')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();
      
      if (oauthApp && !oauthError) {
        setPracticeOAuthApp(oauthApp);
      }
      
      // First try the RPC function
      try {
        const { data: rpcData, error: rpcError } = await supabase.rpc('check_gmail_connection', {
          p_practice_id: practiceId
        });

        if (!rpcError && rpcData) {
          setGmailConnection(rpcData);
        } else {
          // Fallback: Check credentials directly
          const { data: creds, error: credsError } = await supabase
            .from('practice_oauth_credentials')
            .select('email, connected_at, updated_at')
            .eq('practice_id', practiceId)
            .eq('provider', 'google')
            .single();

          if (creds && !credsError) {
            setGmailConnection({
              connected: true,
              email: creds.email,
              connected_at: creds.connected_at,
              last_used_at: creds.updated_at
            });
          } else {
            setGmailConnection({
              connected: false,
              email: null,
              connected_at: null,
              last_used_at: null
            });
          }
        }
      } catch (fallbackError) {
        console.error('Error checking Gmail connection:', fallbackError);
        // Try direct table query as final fallback
        const { data: creds } = await supabase
          .from('practice_oauth_credentials')
          .select('email, connected_at, updated_at')
          .eq('practice_id', practiceId)
          .eq('provider', 'google')
          .single();

        if (creds) {
          setGmailConnection({
            connected: true,
            email: creds.email,
            connected_at: creds.connected_at,
            last_used_at: creds.updated_at
          });
        } else {
          setGmailConnection({
            connected: false,
            email: null,
            connected_at: null,
            last_used_at: null
          });
        }
      }

      // Load automation statistics (optional, don't fail if RPC doesn't exist)
      try {
        const { data: stats } = await supabase.rpc('get_practice_automation_stats', {
          p_practice_id: practiceId,
          p_days_back: 30
        });
        
        if (stats) {
          setAutomationStats(stats);
        }
      } catch (e) {
        // Ignore RPC errors
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

    // Check for OAuth success/error from universal callback
    const urlParams = new URLSearchParams(window.location.search);
    const oauthSuccess = urlParams.get('oauth_success');
    const oauthError = urlParams.get('oauth_error');
    const oauthEmail = urlParams.get('oauth_email');
    
    if (oauthSuccess === 'true') {
      toast.success(`Gmail connected successfully${oauthEmail ? ` for ${oauthEmail}` : ''}!`);
      // Clear URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
      // Refresh connection status
      checkGmailConnection();
    } else if (oauthError) {
      const errorDescription = urlParams.get('oauth_error_description') || 'Unknown error';
      toast.error(`Failed to connect Gmail: ${errorDescription}`);
      // Clear URL parameters
      const newUrl = window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, [practiceId]);

  // Auto-process OAuth code when component mounts if we have one
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code && practiceOAuthApp && !loading && !connecting) {
      console.log('Auto-processing OAuth code...');
      initiateGmailOAuth();
    }
  }, [practiceOAuthApp, loading]);


  const initiateGmailOAuth = async () => {
    if (!practiceOAuthApp) {
      toast.error('Please add Google OAuth credentials in the OAuth Applications section first.');
      return;
    }

    setConnecting(true);

    // If we already have an OAuth code in the URL, process it
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
      // Process the OAuth code directly here
      try {
        // Exchange code for tokens
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: practiceOAuthApp.client_id,
            client_secret: practiceOAuthApp.client_secret,
            redirect_uri: GMAIL_REDIRECT_URI,
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
          await checkGmailConnection();
          
          // Emit custom event to notify other components
          const event = new CustomEvent('gmail-connected', { 
            detail: { 
              email: userInfo.email,
              name: userInfo.name,
              picture: userInfo.picture 
            } 
          });
          window.dispatchEvent(event);
        } else {
          console.error('Save error:', saveError);
          toast.error('Failed to save credentials');
        }
      } catch (err: any) {
        console.error('OAuth processing error:', err);
        toast.error(err.message);
      } finally {
        setConnecting(false);
      }
    } else {
      // No code, initiate OAuth flow
      const stateData = {
        practice_id: practiceId,
        redirect_origin: window.location.origin
      };
      const state = btoa(JSON.stringify(stateData));

      // Create OAuth URL
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.append('client_id', practiceOAuthApp.client_id);
      authUrl.searchParams.append('redirect_uri', GMAIL_REDIRECT_URI);
      authUrl.searchParams.append('response_type', 'code');
      authUrl.searchParams.append('scope', SCOPES);
      authUrl.searchParams.append('access_type', 'offline');
      authUrl.searchParams.append('prompt', 'consent');
      authUrl.searchParams.append('state', state);

      // Direct redirect (no popup) for better reliability
      window.location.href = authUrl.toString();
    }
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

      // Don't show toast here - let the component that initiated disconnect handle it
      
      // Emit disconnect event
      const event = new CustomEvent('gmail-disconnected');
      window.dispatchEvent(event);
      
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

              {!practiceOAuthApp ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
                  <Icon icon="solar:danger-triangle-bold-duotone" className="w-8 h-8 text-red-600 mx-auto mb-2" />
                  <h4 className="font-medium text-red-900 mb-1">OAuth Credentials Required</h4>
                  <p className="text-sm text-red-700 mb-3">
                    Please add Google OAuth credentials first to enable Gmail integration.
                  </p>
                  <p className="text-xs text-red-600 mb-4">
                    Go to the "OAuth Applications" tab and add your Google Client ID and Secret.
                  </p>
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                    <p className="text-xs font-semibold text-amber-900 mb-1">Important Setup Steps:</p>
                    <ol className="text-xs text-amber-800 space-y-1 list-decimal list-inside">
                      <li>In Google Cloud Console, add this exact redirect URI:</li>
                      <li className="ml-4 font-mono bg-amber-100 p-1 rounded">{window.location.origin}/settings</li>
                      <li>Make sure you're signed into the correct Google account</li>
                      <li>If using Google Workspace, ensure OAuth is enabled for external apps</li>
                    </ol>
                  </div>
                  <Button
                    variant="outline"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                    onClick={() => {
                      // Navigate to OAuth Applications tab
                      const authTab = document.querySelector('[data-tab="auth"]');
                      if (authTab instanceof HTMLElement) {
                        authTab.click();
                      }
                    }}
                  >
                    <Icon icon="solar:settings-bold" className="w-4 h-4 mr-2" />
                    Go to OAuth Applications
                  </Button>
                </div>
              ) : (
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
              )}
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

      {/* Debug Information */}
      {!gmailConnection?.connected && (
        <Card className="bg-blue-50 rounded-lg border border-blue-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-blue-900 mb-2">OAuth Setup Information</p>
                <div className="bg-white rounded-lg p-3 border border-blue-200">
                  <p className="text-xs font-semibold text-gray-700 mb-1">Universal Redirect URI (for ALL practices):</p>
                  <code className="block bg-gray-100 p-2 rounded text-xs text-gray-800 break-all">
                    {GMAIL_REDIRECT_URI}
                  </code>
                  <p className="text-xs text-gray-600 mt-2">
                    ✅ This ONE URI works for ALL practices - no need to add individual URIs!
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Each practice uses their own Client ID and Secret, but shares this redirect URI.
                  </p>
                </div>
                <div className="mt-3 text-xs text-blue-800">
                  <p className="font-semibold mb-1">To fix redirect_uri_mismatch error:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Go to <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Google Cloud Console → Credentials</a></li>
                    <li>Click on your OAuth 2.0 Client ID</li>
                    <li>In "Authorized redirect URIs", add the URI shown above</li>
                    <li>Click "Save" and wait a few minutes for changes to propagate</li>
                    <li>Try connecting again</li>
                  </ol>
                </div>
              </div>
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

      {/* Debug: Check credentials */}
      {!gmailConnection?.connected && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              const { data, error } = await supabase
                .from('practice_oauth_credentials')
                .select('*')
                .eq('practice_id', practiceId)
                .eq('provider', 'google');
              
              console.log('OAuth Credentials:', data);
              console.log('Error:', error);
              
              if (data && data.length > 0) {
                toast.success(`Found ${data.length} Gmail credential(s)`);
              } else {
                toast.error('No Gmail credentials found');
              }
            }}
          >
            Debug: Check Credentials
          </Button>
        </div>
      )}

    </motion.div>
  );
};