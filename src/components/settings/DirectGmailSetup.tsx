import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

interface DirectGmailSetupProps {
  onSuccess?: () => void;
}

export const DirectGmailSetup: React.FC<DirectGmailSetupProps> = ({ onSuccess }) => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [credentials, setCredentials] = useState({
    email: '',
    appPassword: ''
  });
  const [showHelp, setShowHelp] = useState(false);

  const handleDirectSetup = async () => {
    if (!credentials.email || !credentials.appPassword) {
      toast.error('Please enter both email and app password');
      return;
    }

    try {
      setLoading(true);

      // Store credentials directly
      const { error } = await supabase
        .from('practice_oauth_credentials')
        .upsert({
          practice_id: practiceId,
          provider: 'google',
          email: credentials.email,
          // Store app password encrypted (in production, use proper encryption)
          refresh_token: btoa(credentials.appPassword), // Base64 encode for now
          metadata: {
            auth_type: 'app_password',
            setup_date: new Date().toISOString()
          },
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast.success('Gmail connected successfully!');
      setCredentials({ email: '', appPassword: '' });
      
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error setting up Gmail:', error);
      toast.error('Failed to setup Gmail connection');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    if (!credentials.email || !credentials.appPassword) {
      toast.error('Please enter credentials first');
      return;
    }

    try {
      setTestingConnection(true);
      
      // Test the connection by sending a test email
      const { data, error } = await supabase.functions.invoke('test-gmail-connection', {
        body: {
          email: credentials.email,
          appPassword: credentials.appPassword,
          practiceId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Connection test successful! You can now save the credentials.');
      } else {
        toast.error('Connection test failed. Please check your credentials.');
      }
    } catch (error) {
      console.error('Test connection error:', error);
      toast.error('Failed to test connection');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-50 rounded-lg">
                <Icon icon="logos:google-gmail" className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg font-semibold text-gray-900">Direct Gmail Setup</CardTitle>
                <p className="text-sm text-gray-500">
                  Connect Gmail using App Password (no redirects needed)
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowHelp(!showHelp)}
            >
              <Icon icon="solar:question-circle-bold-duotone" className="w-5 h-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Help Section */}
            {showHelp && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <h4 className="font-medium text-blue-900 mb-2">How to get Gmail App Password:</h4>
                <ol className="list-decimal list-inside text-sm text-blue-800 space-y-1">
                  <li>Go to <a href="https://myaccount.google.com/security" target="_blank" rel="noopener noreferrer" className="underline">Google Account Security</a></li>
                  <li>Enable 2-Step Verification if not already enabled</li>
                  <li>Search for "App passwords" or go to <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" className="underline">App Passwords</a></li>
                  <li>Select app: "Mail" and device: "Other (Custom name)"</li>
                  <li>Enter name: "HPMS Email Integration"</li>
                  <li>Copy the generated 16-character password</li>
                  <li>Use it below (spaces will be removed automatically)</li>
                </ol>
                <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-xs font-semibold text-amber-900 mb-1">⚠️ Important:</p>
                  <p className="text-xs text-amber-800">
                    This is for App Passwords only, NOT OAuth Client IDs. 
                    App passwords are 16-character codes like "abcd efgh ijkl mnop".
                    If you have a Client ID like "123456...apps.googleusercontent.com", 
                    that's for OAuth setup which is different.
                  </p>
                </div>
              </div>
            )}

            {/* Email Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gmail Address
              </label>
              <div className="relative">
                <Icon icon="solar:letter-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  value={credentials.email}
                  onChange={(e) => setCredentials({ ...credentials, email: e.target.value })}
                  placeholder="admin@newcharmdentalpractice.com"
                  className="w-full pl-10 pr-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* App Password Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                App Password
              </label>
              <div className="relative">
                <Icon icon="solar:key-bold-duotone" className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="password"
                  value={credentials.appPassword}
                  onChange={(e) => setCredentials({ ...credentials, appPassword: e.target.value.replace(/\s/g, '') })}
                  placeholder="xxxx xxxx xxxx xxxx"
                  className="w-full pl-10 pr-3 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
              </div>
              <p className="text-xs text-gray-500 mt-1">
                16-character app password from Google (spaces will be removed)
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <Button
                onClick={testConnection}
                variant="outline"
                disabled={!credentials.email || !credentials.appPassword || testingConnection}
                className="flex-1"
              >
                {testingConnection ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 mr-2 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:test-tube-bold-duotone" className="w-4 h-4 mr-2" />
                    Test Connection
                  </>
                )}
              </Button>
              <Button
                onClick={handleDirectSetup}
                disabled={!credentials.email || !credentials.appPassword || loading}
                className="flex-1 bg-gradient-to-r from-red-500 to-red-600 text-white"
              >
                {loading ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:check-circle-bold-duotone" className="w-4 h-4 mr-2" />
                    Save Gmail Setup
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Benefits Card */}
      <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <Icon icon="solar:shield-check-bold-duotone" className="w-6 h-6 text-green-600 mt-0.5" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Benefits of App Password Method</h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                  <span>No OAuth redirects or complex setup</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                  <span>Works immediately - no waiting for approvals</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                  <span>More reliable for automated sending</span>
                </li>
                <li className="flex items-start gap-2">
                  <Icon icon="solar:check-circle-bold" className="w-4 h-4 text-green-600 mt-0.5" />
                  <span>Can be revoked anytime from Google Account</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};