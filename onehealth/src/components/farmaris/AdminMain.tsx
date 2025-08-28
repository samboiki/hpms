'use client';

import React, { useState, useEffect } from 'react';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';

function AdminMain() {
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
    return <AdminDashboard onLogout={handleLogout} />;
  }

  return <AdminLogin onLogin={handleLogin} />;
}

export default AdminMain;