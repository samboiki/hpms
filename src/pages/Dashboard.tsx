import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';

function Dashboard() {
  console.log('🚀 Dashboard component starting...');
  
  // Early return with simple debug info
  if (typeof window !== 'undefined') {
    console.log('🌐 Window object exists');
    console.log('📍 Current URL:', window.location.href);
  }
  
  const { user } = useAuthStore();
  console.log('👤 User loaded:', user?.email || 'No user');
  const { currentTheme } = useTheme();
  console.log('🎨 Theme loaded:', currentTheme?.colors?.primary?.from || 'No theme');
  
  // Simple test render to verify component works
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-4xl font-bold text-red-600">🚨 DASHBOARD TEST - COMPONENT IS RENDERING</h1>
      <p className="text-lg mt-4">If you see this, the Dashboard component is working!</p>
      <div className="mt-4 p-4 bg-white rounded shadow">
        <p>Timestamp: {new Date().toISOString()}</p>
        <p>Window exists: {typeof window !== 'undefined' ? 'Yes' : 'No'}</p>
        <p>User: {user?.email || 'Not logged in'}</p>
        <p>Theme: {currentTheme?.name || 'No theme'}</p>
      </div>
    </div>
  );
}

export default Dashboard;