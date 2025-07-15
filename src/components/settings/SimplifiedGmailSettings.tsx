import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export const SimplifiedGmailSettings: React.FC = () => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(true);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  
  // Check if OAuth app is configured
  const [hasOAuthApp, setHasOAuthApp] = useState(false);

  useEffect(() => {
    checkGmailStatus();
  }, [practiceId]);

  const checkGmailStatus = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      
      // Check OAuth app
      const { data: oauthApp } = await supabase
        .from('practice_oauth_apps')
        .select('client_id')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();
      
      setHasOAuthApp(!!oauthApp);
      
      // Check connection
      const { data: connection } = await supabase
        .from('practice_oauth_credentials')
        .select('email, connected_at')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();
      
      if (connection) {
        setGmailConnected(true);
        setConnectedEmail(connection.email);
      }
    } catch (error) {
      console.error('Error checking Gmail status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickConnect = () => {
    if (!hasOAuthApp) {
      toast.error('Please add Google OAuth credentials first in the OAuth Applications tab');
      return;
    }
    
    // Show setup instructions
    setShowSetup(true);
  };

  const handleDisconnect = async () => {
    if (!confirm('Are you sure you want to disconnect Gmail?')) return;

    try {
      const { error } = await supabase
        .from('practice_oauth_credentials')
        .delete()
        .eq('practice_id', practiceId)
        .eq('provider', 'google');

      if (error) throw error;

      setGmailConnected(false);
      setConnectedEmail(null);
      toast.success('Gmail disconnected');
    } catch (error) {
      console.error('Error disconnecting Gmail:', error);
      toast.error('Failed to disconnect Gmail');
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
    <div className="space-y-6">
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
                  Send emails directly from your Gmail account
                </p>
              </div>
            </div>
            {gmailConnected && (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <Icon icon="solar:check-circle-bold" className="w-4 h-4 mr-1" />
                Connected
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {gmailConnected ? (
            <div className="space-y-4">
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-900">Gmail Connected</p>
                    <p className="text-sm text-green-700 mt-1">
                      Sending emails as: {connectedEmail}
                    </p>
                  </div>
                  <Icon icon="solar:check-circle-bold-duotone" className="w-8 h-8 text-green-600" />
                </div>
              </div>
              
              <Button
                onClick={handleDisconnect}
                variant="outline"
                className="w-full text-red-600 border-red-300 hover:bg-red-50"
              >
                <Icon icon="solar:unlink-bold" className="w-4 h-4 mr-2" />
                Disconnect Gmail
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {!hasOAuthApp ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-900">Setup Required</p>
                      <p className="text-sm text-amber-700 mt-1">
                        First, add your Google OAuth credentials in the OAuth Applications tab.
                      </p>
                      <Button
                        variant="link"
                        className="text-amber-700 p-0 h-auto mt-2"
                        onClick={() => {
                          const authTab = document.querySelector('[data-tab="auth"]');
                          if (authTab instanceof HTMLElement) {
                            authTab.click();
                          }
                        }}
                      >
                        Go to OAuth Applications →
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-center py-4">
                    <Icon icon="solar:letter-unread-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">
                      Connect your Gmail account to send professional emails
                    </p>
                    <Button
                      onClick={handleQuickConnect}
                      className="bg-gradient-to-r from-red-500 to-red-600 text-white"
                    >
                      <Icon icon="logos:google-icon" className="w-5 h-5 mr-2" />
                      Connect Gmail Account
                    </Button>
                  </div>
                  
                  {showSetup && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg"
                    >
                      <h4 className="font-medium text-blue-900 mb-2">Quick Setup Instructions:</h4>
                      <ol className="list-decimal list-inside text-sm text-blue-800 space-y-2">
                        <li>
                          <strong>For personal Gmail:</strong> Enable "Less secure app access" or use App Password
                        </li>
                        <li>
                          <strong>For Google Workspace:</strong> Enable API access for your domain
                        </li>
                        <li>
                          Click the button below to authorize HPMS to send emails
                        </li>
                      </ol>
                      <div className="mt-4 p-3 bg-white rounded-lg border border-blue-300">
                        <p className="text-sm font-medium text-gray-700 mb-2">
                          Want to avoid OAuth complexity?
                        </p>
                        <p className="text-xs text-gray-600">
                          Consider using App Passwords instead - it's simpler and more reliable for automated sending.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200">
        <CardContent className="p-6">
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Icon icon="solar:info-square-bold-duotone" className="w-5 h-5 text-purple-600" />
            How Gmail Integration Works
          </h3>
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              <p>Each practice adds their own Google OAuth credentials (one-time setup)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              <p>Connect the Gmail account you want to send emails from</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              <p>All emails will be sent from that Gmail account with full tracking</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-xs font-bold">4</span>
              <p>If Gmail fails or isn't connected, emails automatically use backup provider</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};