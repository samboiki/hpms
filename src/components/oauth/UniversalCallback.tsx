import { useEffect } from 'react';
import { Icon } from '@iconify/react';

// This component handles the OAuth callback by invoking the edge function
export default function UniversalCallback() {
  useEffect(() => {
    // The edge function will handle everything server-side
    // Just pass the current URL to it
    const currentUrl = window.location.href;
    
    // For edge function, we need to handle this server-side
    // So we'll redirect to the edge function URL directly
    const edgeFunctionUrl = currentUrl.replace('/api/oauth/callback', '/functions/v1/universal-oauth-callback');
    window.location.href = edgeFunctionUrl;
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-50">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
        <div className="text-center">
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
        </div>
      </div>
    </div>
  );
}