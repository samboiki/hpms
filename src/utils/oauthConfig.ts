// OAuth configuration helper
export const getOAuthRedirectUri = () => {
  const currentUrl = window.location.href;
  
  // If we're on the OAuth callback page, extract the redirect URI that was used
  if (currentUrl.includes('/api/oauth/callback')) {
    // The OAuth flow already redirected here, so use this as the redirect URI
    return window.location.origin + '/api/oauth/callback';
  }
  
  // For localhost development, check the actual port being used
  if (window.location.hostname === 'localhost') {
    const port = window.location.port || '5000';
    
    // If we're on port 5173 or 5174 (Vite default), but Google is configured for 5000
    if (port === '5173' || port === '5174') {
      console.warn(`App is running on port ${port} but OAuth might be configured for port 5000`);
      // Use port 5000 as that's what's configured in Google Cloud Console
      return 'http://localhost:5000/api/oauth/callback';
    }
    
    return `http://localhost:${port}/api/oauth/callback`;
  }
  
  // For production
  return window.location.origin + '/api/oauth/callback';
};

// Alternative: Use settings page as redirect URI
export const getOAuthRedirectUriSettings = () => {
  if (window.location.hostname === 'localhost') {
    const port = window.location.port || '5000';
    
    // If we're on port 5173 or 5174 (Vite default), but Google is configured for 5000
    if (port === '5173' || port === '5174') {
      return 'http://localhost:5000/settings';
    }
    
    return `http://localhost:${port}/settings`;
  }
  
  return window.location.origin + '/settings';
};