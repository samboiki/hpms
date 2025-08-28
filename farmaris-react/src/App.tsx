import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import FarmarisLanding from './components/FarmarisLanding';
import AdminLogin from './components/AdminLogin';

function AdminRoute() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    // Check if already logged in
    const adminSession = localStorage.getItem('farmaris_admin');
    if (adminSession === 'true') {
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (loggedIn: boolean) => {
    setIsLoggedIn(loggedIn);
  };

  const handleLogout = () => {
    localStorage.removeItem('farmaris_admin');
    localStorage.removeItem('farmaris_admin_user');
    setIsLoggedIn(false);
  };

  if (isLoggedIn) {
    // For now, we'll show a simple dashboard message
    // You can replace this with a full AdminDashboard component later
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-lg shadow p-8">
            <div className="flex justify-between items-center mb-6">
              <h1 className="text-2xl font-bold text-gray-800">Farm Aris Admin Dashboard</h1>
              <button
                onClick={handleLogout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
            <div className="text-center py-12">
              <h2 className="text-xl font-semibold text-gray-700 mb-4">
                Admin Dashboard - Coming Soon!
              </h2>
              <p className="text-gray-600">
                The full admin dashboard with registration management, analytics, and reporting features will be available soon.
              </p>
              <div className="mt-8">
                <a 
                  href="/"
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 inline-block"
                >
                  Back to Event Page
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <AdminLogin onLogin={handleLogin} />;
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<FarmarisLanding />} />
        <Route path="/admin" element={<AdminRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
