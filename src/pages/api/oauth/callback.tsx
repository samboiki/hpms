import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';

// This component handles the OAuth callback redirect
export default function OAuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      // Get the current URL
      const url = new URL(window.location.href);
      
      // Invoke the edge function with the full URL
      const { data, error } = await supabase.functions.invoke('universal-oauth-callback', {
        body: {
          url: url.toString()
        }
      });

      if (error) {
        console.error('OAuth callback error:', error);
        navigate('/settings?oauth_error=callback_failed');
      } else {
        // The edge function will handle the redirect
        window.location.href = data.redirect_url;
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Processing OAuth callback...</p>
      </div>
    </div>
  );
}