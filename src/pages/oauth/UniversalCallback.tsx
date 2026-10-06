import React, { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
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
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('OAuth callback received:', { code: !!code, state: !!state, error });

      // Handle OAuth errors (messages below are shown to clinic staff, technical detail goes to the console)
      if (error) {
        console.error('Google returned an OAuth error:', error, urlParams.get('error_description'));
        throw new Error(error === 'access_denied'
          ? 'Google sign-in was cancelled, so Gmail was not connected.'
          : 'Google sign-in did not complete. Please try connecting Gmail again.');
      }

      if (!code || !state) {
        throw new Error('No Google sign-in response was found. Please start connecting Gmail again from Settings.');
      }

      // Decode state
      let stateData: { practice_id: string; redirect_origin: string };
      try {
        stateData = JSON.parse(atob(state));
      } catch (e) {
        throw new Error('The Google sign-in response was not recognised. Please start connecting Gmail again from Settings.');
      }

      const { practice_id } = stateData;

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('You are signed out of HPMS. Please sign in and connect Gmail again.');
      }

      // Get OAuth app credentials
      setMessage('Checking the practice Gmail settings...');
      const { data: oauthApp, error: oauthError } = await supabase
        .from('practice_oauth_apps')
        .select('client_id, client_secret')
        .eq('practice_id', practice_id)
        .eq('provider', 'google')
        .single();

      if (oauthError || !oauthApp) {
        console.error('OAuth app error:', oauthError);
        throw new Error('Gmail is not set up for this practice yet. Set it up under Settings > Social first.');
      }

      // Exchange code for tokens
      setMessage('Confirming access with Google...');
      
      // For development, use the exact URL that's configured in Google Cloud Console
      const isDevelopment = window.location.hostname === 'localhost';
      const redirectUri = isDevelopment 
        ? 'http://localhost:5000/api/oauth/callback'
        : `${window.location.origin}/api/oauth/callback`;
      
      console.log('Using redirect URI for token exchange:', redirectUri);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code,
          client_id: oauthApp.client_id,
          client_secret: oauthApp.client_secret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        throw new Error('Google did not accept the sign-in. Please try connecting Gmail again.');
      }

      const tokens = await tokenResponse.json();
      console.log('Tokens received:', { 
        access_token: !!tokens.access_token, 
        refresh_token: !!tokens.refresh_token,
        expires_in: tokens.expires_in
      });

      // Get user info
      setMessage('Reading the Google account details...');
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        throw new Error('Could not read the Google account details. Please try connecting Gmail again.');
      }

      const userInfo = await userInfoResponse.json();
      console.log('User info:', { email: userInfo.email });

      // Save credentials to database
      setMessage('Saving the Gmail connection...');
      const credentialData = {
        practice_id,
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

      // First try to delete any existing credentials
      await supabase
        .from('practice_oauth_credentials')
        .delete()
        .eq('practice_id', practice_id)
        .eq('provider', 'google')
        .eq('email', userInfo.email);

      // Then insert new credentials
      const { data, error: dbError } = await supabase
        .from('practice_oauth_credentials')
        .insert(credentialData)
        .select();

      if (dbError) {
        console.error('Database error:', dbError);
        
        // If insert fails, try calling an edge function with service role
        const { error: functionError } = await supabase.functions.invoke('save-oauth-credentials', {
          body: credentialData
        });

        if (functionError) {
          console.error('Saving through the edge function also failed:', functionError);
          throw new Error('The Gmail connection could not be saved. Please try again.');
        }
      }

      console.log('OAuth credentials saved successfully!', data);
      
      setStatus('success');
      setMessage(`Gmail connected successfully for ${userInfo.email}!`);
      toast.success(`Gmail connected successfully for ${userInfo.email}!`);
      
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