import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const GmailDirectTest: React.FC = () => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const testDirectSave = async () => {
    if (!practiceId) return;

    try {
      setLoading(true);
      setResult(null);

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Not authenticated');
      }

      // Test data
      const testCredentials = {
        practice_id: practiceId,
        provider: 'google',
        email: 'test-direct@gmail.com',
        refresh_token: 'test_refresh_token_' + Date.now(),
        access_token: 'test_access_token',
        token_expires_at: new Date(Date.now() + 3600000).toISOString(),
        scopes: ['https://www.googleapis.com/auth/gmail.send'],
        metadata: {
          name: 'Test Direct User',
          verified_email: true,
        },
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      console.log('Attempting to save:', testCredentials);

      // Try direct insert
      const { data, error } = await supabase
        .from('practice_oauth_credentials')
        .insert(testCredentials)
        .select();

      if (error) {
        console.error('Insert error:', error);
        setResult({
          success: false,
          error: error.message,
          details: error,
          hint: error.hint || 'No hint available'
        });
      } else {
        console.log('Insert success:', data);
        setResult({
          success: true,
          data: data,
          message: 'Credentials saved successfully!'
        });

        // Clean up after 5 seconds
        setTimeout(async () => {
          await supabase
            .from('practice_oauth_credentials')
            .delete()
            .eq('id', data[0].id);
          console.log('Test data cleaned up');
        }, 5000);
      }
    } catch (err: any) {
      console.error('Test error:', err);
      setResult({
        success: false,
        error: err.message,
        details: err
      });
    } finally {
      setLoading(false);
    }
  };

  const processRealOAuth = async () => {
    try {
      setLoading(true);
      setResult(null);

      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');

      if (!code || !state) {
        throw new Error('No OAuth parameters found in URL');
      }

      // Decode state
      const stateData = JSON.parse(atob(state));
      
      // Get OAuth app
      const { data: oauthApp } = await supabase
        .from('practice_oauth_apps')
        .select('client_id, client_secret')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .single();

      if (!oauthApp) {
        throw new Error('OAuth app not found');
      }

      // Exchange code for tokens
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

      const tokens = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        throw new Error(`Token exchange failed: ${JSON.stringify(tokens)}`);
      }

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

      const { data, error } = await supabase
        .from('practice_oauth_credentials')
        .insert(credentialData)
        .select();

      if (error) {
        throw error;
      }

      setResult({
        success: true,
        message: `Gmail connected successfully for ${userInfo.email}!`,
        data: data
      });

    } catch (err: any) {
      console.error('OAuth processing error:', err);
      setResult({
        success: false,
        error: err.message,
        details: err
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-yellow-50 rounded-lg border border-yellow-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold text-yellow-900">
          Gmail Direct Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            onClick={testDirectSave}
            disabled={loading}
            variant="outline"
            size="sm"
            className="text-yellow-700 border-yellow-300"
          >
            {loading ? (
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
            ) : (
              <Icon icon="solar:database-bold-duotone" className="w-4 h-4" />
            )}
            Test Direct Save
          </Button>

          {window.location.search.includes('code=') && (
            <Button
              onClick={processRealOAuth}
              disabled={loading}
              variant="outline"
              size="sm"
              className="text-green-700 border-green-300"
            >
              {loading ? (
                <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
              ) : (
                <Icon icon="solar:key-bold-duotone" className="w-4 h-4" />
              )}
              Process OAuth Code
            </Button>
          )}
        </div>

        {result && (
          <div className={`rounded-lg p-4 border ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
            <pre className="text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-xs text-yellow-700">
          <p className="font-semibold mb-1">Debug Info:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Practice ID: {practiceId}</li>
            <li>Has OAuth Code: {window.location.search.includes('code=') ? 'Yes' : 'No'}</li>
            <li>URL: {window.location.href}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};