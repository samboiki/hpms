// Testing automatic deployment for onehealth-practice - 2025-08-05
import React, { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useParams, useSearchParams } from 'react-router-dom';
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
import { useAuthStore } from './stores/authStore';
import NotFound from './pages/NotFound';
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
import TestCursor from './pages/TestCursor';
import { CacheWarmer } from './components/CacheWarmer';
import { RoutePrefetcher } from './components/RoutePrefetcher';
import TestCache from './pages/TestCache';
import TestQueryProtection from './pages/TestQueryProtection';
import TestModalClick from './pages/TestModalClick';
import { PerformanceMonitor } from './components/PerformanceMonitor';

// Older links go to /patients/<id> (optionally ?visit=<id>); the Patients page opens a patient and a visit
// from its query string, so send them there instead of to "page not found"
const PatientLinkRedirect: React.FC = () => {
  const { patientId } = useParams();
  const [searchParams] = useSearchParams();
  const target = new URLSearchParams({ patientId: patientId ?? '' });
  const visitId = searchParams.get('visit');
  if (visitId) {
    target.set('visitId', visitId);
    target.set('action', 'edit-visit');
  }
  return <Navigate to={`/patients?${target.toString()}`} replace />;
};

// Route guard: admin pages need an admin (or super admin); the emergency export needs a super admin.
// Everyone else gets the standard not-found page instead of the tool.
const RequireRole: React.FC<{ allow: 'admin' | 'super_admin'; children: React.ReactElement }> = ({ allow, children }) => {
  const user = useAuthStore((state) => state.user);
  const allowed = !!user && (user.is_super_admin === true || (allow === 'admin' && user.role === 'admin'));
  return allowed ? children : <NotFound />;
};

function App() {
  const { isAuthenticated, login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        // Keep the spinner until the saved session is restored, so the login form doesn't flash on every reload
        login(session.user.email!, '').finally(() => setIsLoading(false));

        // Start automatic automation processing when user is authenticated
        // Don't await to prevent blocking
        automationProcessingService.start().catch(error => {
          console.error('Failed to start automation service:', error);
        });
      } else {
        // Stop processing when user logs out
        automationProcessingService.stop();
        setIsLoading(false);
      }
    });

    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        login(session.user.email!, '').finally(() => setIsLoading(false));
        // Don't await to prevent blocking
        automationProcessingService.start().catch(error => {
          console.error('Failed to start automation service:', error);
        });
      } else {
        setIsLoading(false);
      }
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
    return <Login />;
  }

  return (
    <PracticeProvider>
      <ThemeProvider>
        <PracticeTariffsProvider>
          <CacheWarmer />
          <RoutePrefetcher />
          {/* Developer tool: never shipped to clinic staff */}
          {import.meta.env.DEV && <PerformanceMonitor />}
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
            {/* Test pages exist only in local development, never in the deployed app */}
            {import.meta.env.DEV && <Route path="/test-cursor" element={<TestCursor />} />}
            {import.meta.env.DEV && <Route path="/test-cache" element={<TestCache />} />}
            {import.meta.env.DEV && <Route path="/test-protection" element={<TestQueryProtection />} />}
            {import.meta.env.DEV && <Route path="/test-modal-click" element={<TestModalClick />} />}
            <Route path="/oauth/universal-callback" element={<UniversalCallback />} />
            <Route path="/api/oauth/callback" element={<UniversalCallback />} />
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="patients/:patientId" element={<PatientLinkRedirect />} />
              <Route path="patients/:patientId/visit/:visitId" element={<PatientDetail />} />
              <Route path="encounters" element={<Encounters />} />
              <Route path="communications" element={<Communications />} />
              {/* SMS test pages: local development only (test-sms-direct bypasses the SMS gateway) */}
              {import.meta.env.DEV && <Route path="test-communication" element={<TestCommunication />} />}
              {import.meta.env.DEV && <Route path="test-sms-send" element={<TestSMSSend />} />}
              {import.meta.env.DEV && <Route path="test-sms-direct" element={<TestSMSDirectSend />} />}
              {import.meta.env.DEV && <Route path="working-sms-test" element={<WorkingSMSTest />} />}
              {import.meta.env.DEV && <Route path="test-sms-auth" element={<TestSMSWithAuth />} />}
              <Route path="finance" element={<Finance />} />
              <Route path="billing/workflow" element={<BillingWorkflow />} />
              <Route path="practice-profile" element={<EnhancedPracticeProfile />} />
              <Route path="admin/practices" element={<RequireRole allow="admin"><PracticesManagement /></RequireRole>} />
              <Route path="admin/tariffs" element={<RequireRole allow="admin"><TariffManagement /></RequireRole>} />
              <Route path="admin/blueprint" element={<RequireRole allow="admin"><SystemBlueprint /></RequireRole>} />
              <Route path="settings" element={<Settings />} />
              <Route path="emergency-export" element={<RequireRole allow="super_admin"><EmergencySchemaExporter /></RequireRole>} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </PracticeTariffsProvider>
      </ThemeProvider>
    </PracticeProvider>
  );
}

export default App;