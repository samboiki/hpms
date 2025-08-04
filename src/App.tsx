import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientDetail from './pages/PatientDetail';
import Settings from './pages/Settings';
import Communications from './pages/Communications';
import TestCommunication from './pages/TestCommunication';
import TestSMSSend from './pages/TestSMSSend';
import TestSMSDirectSend from './pages/TestSMSDirectSend';
import WorkingSMSTest from './pages/WorkingSMSTest';
import TestSMSWithAuth from './pages/TestSMSWithAuth';
import Encounters from './pages/Encounters';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import { useAuthStoreFast as useAuthStore } from './stores/authStoreFast';
import NotFound from './pages/NotFound';
import PracticeProfile from './pages/PracticeProfile';
import EnhancedPracticeProfile from './pages/EnhancedPracticeProfile';
import Inventory from './pages/Inventory';
import PracticesManagement from './pages/admin/PracticesManagement';
import TariffManagement from './pages/admin/TariffManagement';
import SystemBlueprint from './pages/admin/SystemBlueprint';
import BillingWorkflow from './pages/BillingWorkflow';
import Finance from './pages/Finance';
import { Toaster } from 'react-hot-toast';
import { PracticeTariffsProvider } from './contexts/PracticeTariffsContext';
import { PracticeProvider } from './contexts/PracticeContext';
import ThemeProvider from './components/providers/ThemeProvider';
import EmergencySchemaExporter from './emergency-schema-exporter';
import { automationProcessingService } from './services/automationProcessingService';
import UniversalCallback from './pages/oauth/UniversalCallback';
import { LaggedPremiumCursor } from './components/ui/LaggedPremiumCursor';
import TestCursor from './pages/TestCursor';
import { CacheWarmer } from './components/CacheWarmer';
import { RoutePrefetcher } from './components/RoutePrefetcher';
import TestCache from './pages/TestCache';
import TestQueryProtection from './pages/TestQueryProtection';
import { PerformanceMonitor } from './components/PerformanceMonitor';

function App() {
  const { isAuthenticated, login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        login(session.user.email!, '');
        
        // Start automatic automation processing when user is authenticated
        // Don't await to prevent blocking
        automationProcessingService.start().catch(error => {
          console.error('Failed to start automation service:', error);
        });
      } else {
        // Stop processing when user logs out
        automationProcessingService.stop();
      }
      setIsLoading(false);
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        login(session.user.email!, '');
        // Don't await to prevent blocking
        automationProcessingService.start().catch(error => {
          console.error('Failed to start automation service:', error);
        });
      }
      setIsLoading(false);
    }).catch(error => {
      console.error('Error getting session:', error);
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
      automationProcessingService.stop();
    };
  }, [login]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <>
        <LaggedPremiumCursor />
        <Login />
      </>
    );
  }

  return (
    <PracticeProvider>
      <ThemeProvider>
        <PracticeTariffsProvider>
          <CacheWarmer />
          <RoutePrefetcher />
          <LaggedPremiumCursor />
          <PerformanceMonitor />
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                style: {
                  background: '#10b981',
                },
              },
              error: {
                style: {
                  background: '#ef4444',
                },
              },
            }}
          />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/test-cursor" element={<><LaggedPremiumCursor /><TestCursor /></>} />
            <Route path="/test-cache" element={<TestCache />} />
            <Route path="/test-protection" element={<TestQueryProtection />} />
            <Route path="/oauth/universal-callback" element={<UniversalCallback />} />
            <Route path="/api/oauth/callback" element={<UniversalCallback />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="patients/:patientId/visit/:visitId" element={<PatientDetail />} />
              <Route path="encounters" element={<Encounters />} />
              <Route path="communications" element={<Communications />} />
              <Route path="test-communication" element={<TestCommunication />} />
              <Route path="test-sms-send" element={<TestSMSSend />} />
              <Route path="test-sms-direct" element={<TestSMSDirectSend />} />
              <Route path="working-sms-test" element={<WorkingSMSTest />} />
              <Route path="test-sms-auth" element={<TestSMSWithAuth />} />
              <Route path="finance" element={<Finance />} />
              <Route path="billing/workflow" element={<BillingWorkflow />} />
              <Route path="practice-profile" element={<EnhancedPracticeProfile />} />
              <Route path="admin/practices" element={<PracticesManagement />} />
              <Route path="admin/tariffs" element={<TariffManagement />} />
              <Route path="admin/blueprint" element={<SystemBlueprint />} />
              <Route path="settings" element={<Settings />} />
              <Route path="emergency-export" element={<EmergencySchemaExporter />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </PracticeTariffsProvider>
      </ThemeProvider>
    </PracticeProvider>
  );
}

export default App;