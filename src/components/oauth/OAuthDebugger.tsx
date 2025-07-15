import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Icon } from '@iconify/react';
import Button from '../ui/Button';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';

export const OAuthDebugger: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { practiceId } = usePractice();
  const [debugInfo, setDebugInfo] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Capture all URL parameters
    const params = new URLSearchParams(location.search);
    const allParams: Record<string, string> = {};
    
    params.forEach((value, key) => {
      allParams[key] = value;
    });

    setDebugInfo({
      urlParams: allParams,
      timestamp: new Date().toISOString(),
      currentPath: location.pathname,
      practiceId
    });

    // Check if we have OAuth success/error params
    if (params.get('oauth_success') || params.get('oauth_error')) {
      checkOAuthStatus();
    }
  }, [location, practiceId]);

  const checkOAuthStatus = async () => {
    if (!practiceId) return;

    try {
      const { data, error } = await supabase
        .from('practice_oauth_credentials')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('provider', 'google')
        .order('created_at', { ascending: false })
        .limit(1);

      setDebugInfo(prev => ({
        ...prev,
        latestCredential: data?.[0] || null,
        credentialError: error
      }));
    } catch (err) {
      console.error('Error checking OAuth status:', err);
    }
  };

  const simulateOAuthCallback = async () => {
    setLoading(true);
    try {
      // Create a test state
      const stateData = {
        practice_id: practiceId,
        redirect_origin: window.location.origin
      };
      const state = btoa(JSON.stringify(stateData));

      // Simulate calling the edge function
      const response = await fetch(
        'https://jjxlfunlbyayxwvlpgwt.supabase.co/functions/v1/gmail-oauth-callback',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: 'test_authorization_code',
            state,
            test_mode: true
          })
        }
      );

      const result = await response.text();
      setDebugInfo((prev: Record<string, any>) => ({
        ...prev,
        edgeFunctionTest: {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: result
        }
      }));
    } catch (error: any) {
      setDebugInfo((prev: Record<string, any>) => ({
        ...prev,
        edgeFunctionTest: {
          error: error.message
        }
      }));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">
          OAuth Flow Debugger
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">Current URL Parameters</h4>
          <pre className="text-xs text-blue-800 overflow-auto bg-white p-2 rounded">
            {JSON.stringify(debugInfo.urlParams || {}, null, 2)}
          </pre>
        </div>

        {debugInfo.latestCredential && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-medium text-green-900 mb-2">Latest OAuth Credential</h4>
            <pre className="text-xs text-green-800 overflow-auto bg-white p-2 rounded">
              {JSON.stringify({
                email: debugInfo.latestCredential.email,
                connected_at: debugInfo.latestCredential.connected_at,
                has_refresh_token: !!debugInfo.latestCredential.refresh_token,
                scopes: debugInfo.latestCredential.scopes
              }, null, 2)}
            </pre>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            onClick={simulateOAuthCallback}
            variant="outline"
            disabled={loading}
          >
            {loading ? (
              <>
                <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 mr-2 animate-spin" />
                Testing Edge Function...
              </>
            ) : (
              <>
                <Icon icon="solar:test-tube-bold-duotone" className="w-4 h-4 mr-2" />
                Test Edge Function
              </>
            )}
          </Button>

          <Button
            onClick={() => window.location.reload()}
            variant="outline"
          >
            <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 mr-2" />
            Refresh Page
          </Button>

          <Button
            onClick={() => navigate('/settings')}
            variant="outline"
          >
            <Icon icon="solar:arrow-left-bold-duotone" className="w-4 h-4 mr-2" />
            Back to Settings
          </Button>
        </div>

        {debugInfo.edgeFunctionTest && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-900 mb-2">Edge Function Test Result</h4>
            <pre className="text-xs text-amber-800 overflow-auto bg-white p-2 rounded">
              {JSON.stringify(debugInfo.edgeFunctionTest, null, 2)}
            </pre>
          </div>
        )}

        <div className="text-xs text-gray-500 mt-4">
          <p>Debug Info:</p>
          <ul className="list-disc list-inside ml-2">
            <li>Practice ID: {practiceId}</li>
            <li>Current Path: {location.pathname}</li>
            <li>Timestamp: {debugInfo.timestamp}</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};