import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import toast from 'react-hot-toast';

export default function GmailOAuthHandler() {
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const [processing, setProcessing] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const processOAuthCallback = async () => {
      try {
        // Get the current URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        console.log('Gmail OAuth Handler - Processing callback:', { code: !!code, state: !!state, error });

        // Handle OAuth errors
        if (error) {
          throw new Error(`OAuth error: ${urlParams.get('error_description') || error}`);
        }

        if (!code || !state) {
          throw new Error('Missing OAuth parameters');
        }

        // Decode state
        let stateData: { practice_id: string; redirect_origin: string };
        try {
          stateData = JSON.parse(atob(state));
        } catch (e) {
          throw new Error('Invalid state parameter');
        }

        if (stateData.practice_id !== practiceId) {
          throw new Error('Practice ID mismatch');
        }

        // Get OAuth app credentials
        const { data: oauthApp, error: oauthError } = await supabase
          .from('practice_oauth_apps')
          .select('client_id, client_secret')
          .eq('practice_id', practiceId)
          .eq('provider', 'google')
          .single();

        if (oauthError || !oauthApp) {
          throw new Error('OAuth app not configured');
        }

        // Exchange code for tokens directly
        console.log('Exchanging code for tokens...');
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            code,
            client_id: oauthApp.client_id,
            client_secret: oauthApp.client_secret,
            redirect_uri: `${window.location.origin}/api/oauth/callback`,
            grant_type: 'authorization_code',
          }),
        });

        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error('Token exchange failed:', errorData);
          throw new Error('Failed to exchange authorization code');
        }

        const tokens = await tokenResponse.json();
        console.log('Tokens received:', { 
          access_token: !!tokens.access_token, 
          refresh_token: !!tokens.refresh_token,
          expires_in: tokens.expires_in
        });

        // Get user info
        const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            Authorization: `Bearer ${tokens.access_token}`,
          },
        });

        if (!userInfoResponse.ok) {
          throw new Error('Failed to get user info');
        }

        const userInfo = await userInfoResponse.json();
        console.log('User info:', { email: userInfo.email });

        // Save credentials directly to Supabase
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

        console.log('Saving OAuth credentials...');
        
        // Try to insert/update the credentials
        const { data, error: dbError } = await supabase
          .from('practice_oauth_credentials')
          .upsert(credentialData, {
            onConflict: 'practice_id,provider,email',
            ignoreDuplicates: false
          })
          .select();

        if (dbError) {
          console.error('Database error:', dbError);
          // If upsert fails, try direct insert
          const { error: insertError } = await supabase
            .from('practice_oauth_credentials')
            .insert(credentialData);
          
          if (insertError) {
            throw new Error(`Failed to save credentials: ${insertError.message}`);
          }
        }

        console.log('OAuth credentials saved successfully!', data);
        toast.success(`Gmail connected successfully for ${userInfo.email}!`);
        
        // Redirect to settings with success
        navigate('/settings?oauth_success=true&oauth_email=' + encodeURIComponent(userInfo.email));
        
      } catch (error: any) {
        console.error('OAuth processing error:', error);
        setError(error.message);
        toast.error(error.message);
        
        // Redirect to settings with error after 3 seconds
        setTimeout(() => {
          navigate('/settings?oauth_error=' + encodeURIComponent(error.message));
        }, 3000);
      } finally {
        setProcessing(false);
      }
    };

    if (practiceId) {
      processOAuthCallback();
    }
  }, [practiceId, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {processing ? (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
              <h2 className="mt-4 text-lg font-semibold text-gray-900">Connecting Gmail...</h2>
              <p className="mt-2 text-sm text-gray-600">Please wait while we complete the connection.</p>
            </>
          ) : error ? (
            <>
              <div className="text-red-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Connection Failed</h2>
              <p className="mt-2 text-sm text-red-600">{error}</p>
              <p className="mt-4 text-sm text-gray-600">Redirecting to settings...</p>
            </>
          ) : (
            <>
              <div className="text-green-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-gray-900">Success!</h2>
              <p className="mt-2 text-sm text-gray-600">Gmail connected successfully.</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}