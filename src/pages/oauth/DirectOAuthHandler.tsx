import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';

export default function DirectOAuthHandler() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing OAuth...');
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    processOAuth();
  }, []);

  const processOAuth = async () => {
    try {
      // Get URL parameters
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      
      if (!code || !state) {
        throw new Error('Missing OAuth parameters');
      }

      // Decode state
      const stateData = JSON.parse(atob(state));
      const practiceId = stateData.practice_id;

      setMessage('Creating direct database connection...');
      
      // Create a direct POST request to save credentials
      const response = await fetch('/api/save-oauth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
          state,
          practiceId,
          redirectUri: `${window.location.origin}/api/oauth/callback`
        })
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save OAuth credentials');
      }

      setStatus('success');
      setMessage('OAuth credentials saved successfully!');
      setDebugInfo(result);

      // Redirect after 2 seconds
      setTimeout(() => {
        navigate('/settings?oauth_success=true');
      }, 2000);

    } catch (error: any) {
      console.error('OAuth error:', error);
      setStatus('error');
      setMessage(error.message);
      setDebugInfo({ error: error.message, stack: error.stack });
    }
  };

  const copyDebugInfo = () => {
    navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    alert('Debug info copied to clipboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center">
          {status === 'processing' && (
            <>
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-16 h-16 text-blue-500 mx-auto mb-4 animate-spin" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Processing OAuth</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'success' && (
            <>
              <Icon icon="solar:check-circle-bold-duotone" className="w-16 h-16 text-green-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Success!</h2>
              <p className="text-gray-600">{message}</p>
            </>
          )}

          {status === 'error' && (
            <>
              <Icon icon="solar:close-circle-bold-duotone" className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">OAuth Error</h2>
              <p className="text-red-600">{message}</p>
            </>
          )}
        </div>

        {/* Debug Information */}
        <div className="mt-8 p-4 bg-gray-100 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold text-gray-700">Debug Information</h3>
            <button
              onClick={copyDebugInfo}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              Copy to Clipboard
            </button>
          </div>
          <pre className="text-xs overflow-auto bg-white p-2 rounded border border-gray-200">
            {JSON.stringify({
              url: window.location.href,
              params: Object.fromEntries(new URLSearchParams(window.location.search)),
              timestamp: new Date().toISOString(),
              ...debugInfo
            }, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  );
}