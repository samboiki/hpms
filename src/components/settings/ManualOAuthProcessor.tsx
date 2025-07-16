import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import toast from 'react-hot-toast';
import { getOAuthRedirectUri, getOAuthRedirectUriSettings } from '../../utils/oauthConfig';

export const ManualOAuthProcessor: React.FC = () => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [tokens, setTokens] = useState<any>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [autoProcessing, setAutoProcessing] = useState(true);

  const processOAuthManually = async () => {
    try {
      setLoading(true);
      setResult(null);
      setStep(1);

      // Step 1: Get OAuth parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (!code || !state) {
        throw new Error('No OAuth code found in URL');
      }

      // Skip the session storage check for now to allow manual reprocessing

      // Step 2: Get OAuth app credentials
      setStep(2);
      const { data: oauthApp, error: appError } = await supabase
        .from('practice_oauth_apps')
        .select('client_id, client_secret')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      if (appError || !oauthApp) {
        throw new Error(`OAuth app not found: ${appError?.message}`);
      }

      // Step 3: Exchange code for tokens
      setStep(3);
      
      // Show what redirect URI we're using
      // Use the exact same redirect URI that was used in the OAuth initiation
      const redirectUri = 'http://localhost:5000/settings';
      
      console.log('=== OAuth Debug Info ===');
      console.log('Current URL:', window.location.href);
      console.log('Window origin:', window.location.origin);
      console.log('Window hostname:', window.location.hostname);
      console.log('Window port:', window.location.port);
      console.log('Using redirect URI:', redirectUri);
      console.log('OAuth Code:', code?.substring(0, 20) + '...');
      console.log('=======================');
      
      // Try both possible redirect URIs
      console.log('Possible redirect URIs:');
      console.log('1. API Callback:', getOAuthRedirectUri());
      console.log('2. Settings page:', getOAuthRedirectUriSettings());
      
      const tokenParams = {
        code,
        client_id: oauthApp.client_id,
        client_secret: oauthApp.client_secret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      };
      
      console.log('Token exchange params:', tokenParams);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(tokenParams),
      });

      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Token exchange error:', tokenData);
        throw new Error(`Token exchange failed: ${tokenData.error || 'Unknown error'} - ${tokenData.error_description || ''}`);
      }

      setTokens(tokenData);

      // Step 4: Get user info
      setStep(4);
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });

      const userData = await userInfoResponse.json();
      setUserInfo(userData);

      // Step 5: Manual save - show the data
      setStep(5);
      const credentialData = {
        practice_id: practiceId,
        provider: 'google',
        email: userData.email,
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        token_expires_at: new Date(Date.now() + tokenData.expires_in * 1000).toISOString(),
        scopes: tokenData.scope?.split(' ') || [],
        metadata: {
          name: userData.name,
          picture: userData.picture,
          verified_email: userData.verified_email,
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Show the credential data for manual copying
      setResult({
        success: true,
        credentialData,
        message: 'OAuth processed successfully! Copy the SQL below to save credentials manually.',
        sql: `
-- Run this SQL in Supabase SQL Editor to save the credentials:
INSERT INTO practice_oauth_credentials (
  practice_id,
  provider,
  email,
  refresh_token,
  access_token,
  token_expires_at,
  scopes,
  metadata,
  connected_at,
  updated_at
) VALUES (
  '${practiceId}',
  'google',
  '${userData.email}',
  '${tokenData.refresh_token}',
  '${tokenData.access_token}',
  '${new Date(Date.now() + tokenData.expires_in * 1000).toISOString()}',
  ARRAY[${tokenData.scope?.split(' ').map((s: string) => `'${s}'`).join(', ')}],
  '${JSON.stringify({
    name: userData.name,
    picture: userData.picture,
    verified_email: userData.verified_email,
  })}'::jsonb,
  NOW(),
  NOW()
);`
      });

      // Try to save directly one more time
      const { error: saveError } = await supabase
        .from('practice_oauth_credentials')
        .insert(credentialData);

      if (!saveError) {
        toast.success('Credentials saved successfully!');
        setResult({
          success: true,
          message: 'Gmail credentials saved successfully!'
        });
        // Clean up the URL to remove OAuth params
        setTimeout(() => {
          window.location.href = '/settings?tab=social&oauth_success=true';
        }, 2000);
      } else {
        console.error('Save error:', saveError);
        setResult({
          success: false,
          error: `Failed to save: ${saveError.message}`,
          details: saveError
        });
      }

    } catch (err: any) {
      console.error('Manual processing error:', err);
      
      // Check if this is an invalid_grant error (code already used)
      if (err.message.includes('invalid_grant')) {
        setResult({
          success: false,
          error: 'This OAuth code has already been used. Please start the connection process again.',
          details: err
        });
        
        // Clear the URL after 3 seconds
        setTimeout(() => {
          window.location.href = '/settings?tab=social';
        }, 3000);
      } else {
        setResult({
          success: false,
          error: err.message,
          details: err
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const copySQL = () => {
    if (result?.sql) {
      navigator.clipboard.writeText(result.sql);
      toast.success('SQL copied to clipboard!');
    }
  };

  if (!window.location.search.includes('code=')) {
    return null;
  }

  return (
    <Card className="bg-orange-50 rounded-lg border border-orange-300 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-orange-900">
          🔧 Manual OAuth Processor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-orange-200">
          <p className="text-sm text-orange-800 mb-3">
            OAuth code detected! Click the button below to process it manually:
          </p>
          
          <Button
            onClick={processOAuthManually}
            disabled={loading}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white"
          >
            {loading ? (
              <>
                <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
                Processing Step {step}/5...
              </>
            ) : (
              <>
                <Icon icon="solar:play-bold-duotone" className="w-5 h-5 mr-2" />
                Process OAuth Code Manually
              </>
            )}
          </Button>
        </div>

        {/* Progress Steps */}
        {loading && (
          <div className="space-y-2">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-green-600' : 'text-gray-400'}`}>
              <Icon icon={step >= 1 ? "solar:check-circle-bold" : "solar:circle-bold"} className="w-5 h-5" />
              <span className="text-sm">Step 1: Extract OAuth code</span>
            </div>
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-green-600' : 'text-gray-400'}`}>
              <Icon icon={step >= 2 ? "solar:check-circle-bold" : "solar:circle-bold"} className="w-5 h-5" />
              <span className="text-sm">Step 2: Get OAuth app credentials</span>
            </div>
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-green-600' : 'text-gray-400'}`}>
              <Icon icon={step >= 3 ? "solar:check-circle-bold" : "solar:circle-bold"} className="w-5 h-5" />
              <span className="text-sm">Step 3: Exchange code for tokens</span>
            </div>
            <div className={`flex items-center gap-2 ${step >= 4 ? 'text-green-600' : 'text-gray-400'}`}>
              <Icon icon={step >= 4 ? "solar:check-circle-bold" : "solar:circle-bold"} className="w-5 h-5" />
              <span className="text-sm">Step 4: Get user info</span>
            </div>
            <div className={`flex items-center gap-2 ${step >= 5 ? 'text-green-600' : 'text-gray-400'}`}>
              <Icon icon={step >= 5 ? "solar:check-circle-bold" : "solar:circle-bold"} className="w-5 h-5" />
              <span className="text-sm">Step 5: Save credentials</span>
            </div>
          </div>
        )}

        {/* Token Info */}
        {tokens && (
          <div className="bg-green-50 rounded-lg p-3 border border-green-200">
            <p className="text-sm font-semibold text-green-800 mb-1">✅ Tokens Retrieved:</p>
            <p className="text-xs text-green-700">Access Token: {tokens.access_token?.substring(0, 20)}...</p>
            <p className="text-xs text-green-700">Refresh Token: {tokens.refresh_token?.substring(0, 20)}...</p>
          </div>
        )}

        {/* User Info */}
        {userInfo && (
          <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
            <p className="text-sm font-semibold text-blue-800 mb-1">✅ User Info:</p>
            <p className="text-xs text-blue-700">Email: {userInfo.email}</p>
            <p className="text-xs text-blue-700">Name: {userInfo.name}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-lg p-4 border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            {result.success ? (
              <>
                <p className="font-semibold text-green-800 mb-2">{result.message}</p>
                {result.sql && (
                  <>
                    <div className="bg-white rounded p-2 border border-green-200 mb-2">
                      <pre className="text-xs overflow-auto">{result.sql}</pre>
                    </div>
                    <Button
                      onClick={copySQL}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Icon icon="solar:copy-bold" className="w-4 h-4 mr-1" />
                      Copy SQL
                    </Button>
                  </>
                )}
              </>
            ) : (
              <>
                <p className="font-semibold text-red-800 mb-2">Error: {result.error}</p>
                <pre className="text-xs overflow-auto bg-white p-2 rounded">
                  {JSON.stringify(result.details, null, 2)}
                </pre>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};