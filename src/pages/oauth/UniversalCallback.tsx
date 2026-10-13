import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { completeGmailConnect, describeGoogleCallbackError, readGmailCallback } from '../../services/gmailConnectService';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const UniversalCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Finishing the Google sign-in...');
  const navigate = useNavigate();

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      const callback = readGmailCallback(window.location.search);

      // Handle OAuth errors (messages below are shown to clinic staff, technical detail goes to the console)
      if (callback?.kind === 'error') {
        console.error('Google returned an OAuth error:', callback.error, new URLSearchParams(window.location.search).get('error_description'));
        throw new Error(describeGoogleCallbackError(callback.error));
      }

      if (!callback) {
        throw new Error('No Google sign-in response was found. Please start connecting Gmail again from Settings.');
      }

      // The server checks the signed state, exchanges the code with the practice's stored client secret and saves
      // the tokens: the browser never handles either
      setMessage('Confirming access with Google...');
      const result = await completeGmailConnect(callback);
      if (!result.ok) {
        throw new Error(result.message);
      }

      setStatus('success');
      setMessage(`Gmail connected successfully for ${result.email}!`);
      toast.success(`Gmail connected successfully for ${result.email}!`);
      
      // Back to Settings > Social, where the Gmail card shows the connection. The result was already
      // toasted here; oauth_* params would only be read by the Social tab and toasted a second time.
      setTimeout(() => {
        navigate('/settings?tab=social');
      }, 2000);

    } catch (error: any) {
      console.error('OAuth callback error:', error);
      const friendlyMessage = error?.message || 'Gmail could not be connected. Please try again.';
      setStatus('error');
      setMessage(friendlyMessage);
      toast.error(friendlyMessage);

      // Redirect to settings after a delay
      setTimeout(() => {
        navigate('/settings?tab=social');
      }, 3000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <Icon 
                icon="solar:refresh-circle-bold-duotone" 
                className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" 
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connecting Gmail
              </h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <Icon 
                icon="solar:check-circle-bold-duotone" 
                className="w-16 h-16 text-green-500 mx-auto mb-4" 
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Success!
              </h2>
              <p className="text-gray-600">{message}</p>
              <p className="text-sm text-gray-500 mt-2">Redirecting to settings...</p>
            </>
          )}

          {status === 'error' && (
            <>
              <Icon 
                icon="solar:close-circle-bold-duotone" 
                className="w-16 h-16 text-red-500 mx-auto mb-4" 
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Gmail was not connected
              </h2>
              <p className="text-red-600 mb-4">{message}</p>
              <p className="text-gray-600 text-sm">
                Redirecting back to settings...
              </p>
            </>
          )}

          <div className="mt-8">
            <p className="text-xs text-gray-500">
              OneHealth Gmail connection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalCallback;