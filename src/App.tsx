import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import { supabase } from './lib/supabase';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Settings from './pages/Settings';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import { useAuthStore } from './stores/authStore';
import NotFound from './pages/NotFound';
import PracticeProfile from './pages/PracticeProfile';
import EnhancedPracticeProfile from './pages/EnhancedPracticeProfile';
import Inventory from './pages/Inventory';
import PracticesManagement from './pages/admin/PracticesManagement';
import TariffManagement from './pages/admin/TariffManagement';
import BillingWorkflow from './pages/BillingWorkflow';
import { Toaster } from 'react-hot-toast';
import { PracticeTariffsProvider } from './contexts/PracticeTariffsContext';
import { PracticeProvider } from './contexts/PracticeContext';
import ThemeProvider from './components/providers/ThemeProvider';
import EmergencySchemaExporter from './emergency-schema-exporter';

function App() {
  const { isAuthenticated, login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        login(session.user.email!, '');
      }
      setIsLoading(false);
    });

    // Cleanup subscription
    return () => {
      subscription.unsubscribe();
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
    <ThemeProvider>
      <PracticeProvider>
        <PracticeTariffsProvider>
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
            <Route path="/" element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="patients" element={<Patients />} />
              <Route path="billing/workflow" element={<BillingWorkflow />} />
              <Route path="practice-profile" element={<EnhancedPracticeProfile />} />
              <Route path="admin/practices" element={<PracticesManagement />} />
              <Route path="admin/tariffs" element={<TariffManagement />} />
              <Route path="settings" element={<Settings />} />
              <Route path="emergency-export" element={<EmergencySchemaExporter />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </PracticeTariffsProvider>
      </PracticeProvider>
    </ThemeProvider>
  );
}

export default App;