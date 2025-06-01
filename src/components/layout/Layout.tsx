import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Menu } from 'lucide-react';
import { cn } from '../../utils/cn';

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setMobileMenuOpen(false);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Menu Button */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-[#01b9d4] text-white rounded-lg shadow-lg"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Sidebar - Desktop */}
      <div className={cn("hidden lg:block", mobileMenuOpen && "hidden")}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={false}
        />
      </div>

      {/* Sidebar - Mobile Overlay */}
      {mobileMenuOpen && (
        <>
          <div 
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="lg:hidden fixed left-0 top-0 h-full z-50">
            <Sidebar
              collapsed={false}
              onToggle={() => {}}
              isMobile={true}
              onMobileClose={() => setMobileMenuOpen(false)}
            />
          </div>
        </>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 overflow-y-auto transition-all duration-300 bg-gray-50',
          !isMobile && (sidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]'),
          isMobile && 'ml-0 pl-16' // Add padding for mobile menu button
        )}
      >
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;