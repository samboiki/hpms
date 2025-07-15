import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Icon } from '@iconify/react';
import toast from 'react-hot-toast';

// This component handles OAuth callbacks from various providers
export default function UniversalCallback() {
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    handleOAuthCallback();
  }, []);

  const handleOAuthCallback = async () => {
    try {
      // Get parameters from URL
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      // Handle OAuth errors
      if (error) {
        const errorDescription = urlParams.get('error_description') || 'Unknown error';
        setError(`OAuth error: ${errorDescription}`);
        setProcessing(false);
        
        // Redirect to settings page with error
        setTimeout(() => {
          navigate('/settings?oauth_error=' + encodeURIComponent(error) + 
                   '&oauth_error_description=' + encodeURIComponent(errorDescription));
        }, 2000);
        return;
      }

      if (!code || !state) {
        throw new Error('Missing required parameters');
      }

      // Decode state to get practice_id
      let stateData: { practice_id: string; redirect_origin: string };
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        throw new Error('Invalid state parameter');
      }

      const { practice_id } = stateData;

      // Get current user session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Not authenticated. Please log in and try again.');
      }

      // Exchange code for tokens using authenticated edge function
      const { data, error: exchangeError } = await supabase.functions.invoke('exchange-oauth-code', {
        body: {
          code,
          practice_id,
          provider: 'google',
          redirect_uri: window.location.origin + '/api/oauth/callback'
        }
      });

      if (exchangeError || !data?.success) {
        throw new Error(data?.error || exchangeError?.message || 'Failed to exchange authorization code');
      }

      // Success! Redirect to settings page
      toast.success(`Gmail connected successfully for ${data.email}!`);
      navigate('/settings?oauth_success=true&oauth_email=' + encodeURIComponent(data.email));
      
    } catch (error) {
      console.error('OAuth callback error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      setProcessing(false);
      
      // Redirect to settings page with error
      setTimeout(() => {
        navigate('/settings?oauth_error=callback_failed&oauth_error_description=' + 
                 encodeURIComponent(error instanceof Error ? error.message : 'Unknown error'));
      }, 2000);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
          {processing ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 animate-ping">
                  <Icon icon="solar:refresh-circle-bold-duotone" className="w-16 h-16 text-purple-400 mx-auto opacity-75" />
                </div>
                <Icon icon="solar:refresh-circle-bold-duotone" className="w-16 h-16 text-purple-600 mx-auto relative animate-spin" />
              </div>
              <h2 className="mt-6 text-2xl font-bold text-gray-900">Connecting Your Account</h2>
              <p className="mt-2 text-gray-600">Please wait while we complete the authorization...</p>
              <div className="mt-6 flex justify-center space-x-2">
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-purple-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </>
          ) : error ? (
            <>
              <Icon 
                icon="solar:close-circle-bold-duotone" 
                className="w-16 h-16 text-red-500 mx-auto mb-4" 
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Failed
              </h2>
              <p className="text-red-600 mb-4">
                {error}
              </p>
              <p className="text-sm text-gray-600">
                Redirecting to settings...
              </p>
            </>
          ) : (
            <>
              <Icon 
                icon="solar:check-circle-bold-duotone" 
                className="w-16 h-16 text-green-500 mx-auto mb-4" 
              />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Successful!
              </h2>
              <p className="text-gray-600">
                Redirecting to settings...
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}