import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';

const UniversalCallback: React.FC = () => {
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth callback...');

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    try {
      // This page acts as a bridge to call the edge function
      const response = await supabase.functions.invoke('universal-oauth-callback', {
        body: {
          url: window.location.href
        }
      });

      if (response.error) {
        throw response.error;
      }

      // The edge function will handle the redirect
      setStatus('success');
      setMessage('OAuth callback processed successfully. Redirecting...');
    } catch (error) {
      console.error('OAuth callback error:', error);
      setStatus('error');
      setMessage((error as Error).message || 'Failed to process OAuth callback');
      
      // Redirect to settings with error after a delay
      setTimeout(() => {
        window.location.href = `/settings?oauth_error=${encodeURIComponent((error as Error).message || 'Unknown error')}`;
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
                Processing OAuth Callback
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
            </>
          )}

          {status === 'error' && (
            <>
              <Icon 
                icon="solar:close-circle-bold-duotone" 
                className="w-16 h-16 text-red-500 mx-auto mb-4" 
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                OAuth Error
              </h2>
              <p className="text-red-600 mb-4">{message}</p>
              <p className="text-gray-600 text-sm">
                Redirecting back to settings...
              </p>
            </>
          )}

          <div className="mt-8">
            <p className="text-xs text-gray-500">
              OneHealth Universal OAuth Handler
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UniversalCallback;