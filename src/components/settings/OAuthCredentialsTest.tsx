import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { supabase } from '../../lib/supabase';
import { usePractice } from '../../contexts/PracticeContext';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const OAuthCredentialsTest: React.FC = () => {
  const { practiceId } = usePractice();
  const [loading, setLoading] = useState(false);
  const [credentials, setCredentials] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testCredentials = async () => {
    try {
      setLoading(true);
      setError(null);
      setCredentials(null);

      // Try to fetch credentials
      const { data, error: fetchError } = await supabase
        .from('practice_oauth_credentials')
        .select('*')
        .eq('practice_id', practiceId)
        .eq('provider', 'google');

      if (fetchError) {
        setError(`Fetch error: ${fetchError.message}`);
        return;
      }

      setCredentials(data);

      // If we have credentials, test the refresh token
      if (data && data.length > 0 && data[0].refresh_token) {
        const cred = data[0];
        
        // Test refresh token
        const response = await fetch('https://oauth2.googleapis.com/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            refresh_token: cred.refresh_token,
            client_id: 'YOUR_CLIENT_ID_HERE', // This would need to be fetched from practice_oauth_apps
            client_secret: 'YOUR_CLIENT_SECRET_HERE', // This would need to be fetched from practice_oauth_apps
            grant_type: 'refresh_token',
          }),
        });

        if (response.ok) {
          setCredentials([{
            ...cred,
            refresh_test: 'SUCCESS - Refresh token is valid!'
          }]);
        } else {
          setCredentials([{
            ...cred,
            refresh_test: 'FAILED - Refresh token might be invalid'
          }]);
        }
      }
    } catch (err: any) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-yellow-50 rounded-lg border border-yellow-300 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-yellow-900">
          🔍 OAuth Credentials Test
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-yellow-800">
          This will test if OAuth credentials are properly saved in the database.
        </p>
        
        <Button
          onClick={testCredentials}
          disabled={loading}
          className="w-full bg-yellow-600 hover:bg-yellow-700 text-white"
        >
          {loading ? (
            <>
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-5 h-5 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <Icon icon="solar:test-tube-bold-duotone" className="w-5 h-5 mr-2" />
              Test OAuth Credentials
            </>
          )}
        </Button>

        {error && (
          <div className="bg-red-50 rounded-lg p-3 border border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {credentials && (
          <div className="bg-white rounded-lg p-3 border border-yellow-200">
            <p className="text-sm font-semibold text-gray-800 mb-2">
              Found {credentials.length} credential(s):
            </p>
            {credentials.map((cred: any, index: number) => (
              <div key={index} className="mb-3 p-2 bg-gray-50 rounded">
                <p className="text-xs text-gray-700">
                  <strong>Email:</strong> {cred.email}
                </p>
                <p className="text-xs text-gray-700">
                  <strong>Provider:</strong> {cred.provider}
                </p>
                <p className="text-xs text-gray-700">
                  <strong>Has Refresh Token:</strong> {cred.refresh_token ? 'YES ✅' : 'NO ❌'}
                </p>
                <p className="text-xs text-gray-700">
                  <strong>Has Access Token:</strong> {cred.access_token ? 'YES ✅' : 'NO ❌'}
                </p>
                <p className="text-xs text-gray-700">
                  <strong>Connected At:</strong> {new Date(cred.connected_at).toLocaleString()}
                </p>
                {cred.refresh_test && (
                  <p className={`text-xs mt-1 ${cred.refresh_test.includes('SUCCESS') ? 'text-green-700' : 'text-red-700'}`}>
                    <strong>Refresh Test:</strong> {cred.refresh_test}
                  </p>
                )}
              </div>
            ))}
            
            <div className="mt-3 p-2 bg-blue-50 rounded border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>SQL to check manually:</strong>
              </p>
              <code className="block text-xs bg-white p-1 rounded mt-1">
                SELECT * FROM practice_oauth_credentials WHERE practice_id = '{practiceId}' AND provider = 'google';
              </code>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};