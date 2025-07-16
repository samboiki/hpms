import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

export const OAuthRedirectTest: React.FC = () => {
  const [redirectUri, setRedirectUri] = useState('http://localhost:5000/api/oauth/callback');

  const testRedirectUris = [
    'http://localhost:5000/api/oauth/callback',
    'http://localhost:5000/settings',
    `${window.location.origin}/api/oauth/callback`,
    `${window.location.origin}/settings`,
    'http://localhost:3000/api/oauth/callback',
    'http://localhost:5173/api/oauth/callback',
    'http://localhost:5174/api/oauth/callback',
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <Card className="bg-purple-50 rounded-lg border border-purple-300 shadow-lg">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-purple-900">
          🔍 OAuth Redirect URI Tester
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-white rounded-lg p-4 border border-purple-200">
          <p className="text-sm font-semibold text-purple-900 mb-2">Current Environment:</p>
          <div className="space-y-1 text-xs font-mono">
            <p>Origin: {window.location.origin}</p>
            <p>Hostname: {window.location.hostname}</p>
            <p>Port: {window.location.port || '(default)'}</p>
            <p>Protocol: {window.location.protocol}</p>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-purple-900">Select the correct redirect URI:</p>
          <p className="text-xs text-purple-700">Choose the one that matches what you have in Google Cloud Console</p>
          
          <div className="space-y-2">
            {testRedirectUris.map((uri) => (
              <div key={uri} className="flex items-center gap-2">
                <input
                  type="radio"
                  id={uri}
                  name="redirectUri"
                  value={uri}
                  checked={redirectUri === uri}
                  onChange={(e) => setRedirectUri(e.target.value)}
                  className="text-purple-600"
                />
                <label htmlFor={uri} className="text-sm text-gray-700 flex-1 font-mono">
                  {uri}
                </label>
                <button
                  onClick={() => copyToClipboard(uri)}
                  className="text-xs text-purple-600 hover:text-purple-700"
                >
                  Copy
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200">
          <p className="text-xs text-amber-800">
            <strong>Important:</strong> The redirect URI in your code MUST match EXACTLY what's in Google Cloud Console.
            This includes the protocol (http/https), hostname, port, and path.
          </p>
        </div>

        <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
          <p className="text-xs font-semibold text-blue-900 mb-1">To fix the mismatch:</p>
          <ol className="text-xs text-blue-800 list-decimal list-inside space-y-1">
            <li>Copy the correct URI from above</li>
            <li>Go to Google Cloud Console → Credentials</li>
            <li>Add it to "Authorized redirect URIs"</li>
            <li>Save and wait 1-2 minutes</li>
            <li>Update the code to use: <code className="bg-blue-100 px-1 rounded">{redirectUri}</code></li>
          </ol>
        </div>
      </CardContent>
    </Card>
  );
};