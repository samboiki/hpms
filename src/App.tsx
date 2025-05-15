import React, { useEffect, useState } from 'react';
import { Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Appointments from './pages/Appointments';
import PatientDetail from './pages/PatientDetail';
import Finance from './pages/Finance';
import Settings from './pages/Settings';
import Layout from './components/layout/Layout';
import Login from './pages/auth/Login';
import { useAuthStore } from './stores/authStore';
import NotFound from './pages/NotFound';
import PracticeProfile from './pages/PracticeProfile';
import { supabase } from './lib/supabase';
import Requests from './pages/Requests';

function App() {
  const { isAuthenticated, login } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      if (session?.user) {
        // Re-authenticate with the session
        await login(session.user.email!, ''); // Password not needed for session auth
      }
    } catch (error) {
      console.error('Error checking auth status:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="patients" element={<Patients />} />
        <Route path="patients/:id" element={<PatientDetail />} />
        <Route path="appointments" element={<Appointments />} />
        <Route path="requests" element={<Requests />} />
        <Route path="finance" element={<Finance />} />
        <Route path="practice-profile" element={<PracticeProfile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;