import React from 'react';
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

function App() {
  const { isAuthenticated } = useAuthStore();

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
        <Route path="finance" element={<Finance />} />
        <Route path="practice-profile" element={<PracticeProfile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export default App;