import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '../../utils/cn';

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);   // start open

  return (
    <div className="flex h-screen overflow-hidden">
      {/* permanent sidebar */}
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        isMobile={false}
      />

      {/* main scroll area */}
      <main
        className={cn(
          'flex-1 overflow-y-auto bg-gray-50 transition-all duration-300',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]'
        )}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;