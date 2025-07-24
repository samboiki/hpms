import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { cn } from '../../utils/cn';

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fullscreen functionality
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={false}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
          onOpenPatients={() => setIsPatientModalOpen(true)}
        />
      </div>
      
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40 lg:hidden" 
            onClick={() => setIsMobileSidebarOpen(false)}
          />
          
          {/* Mobile Sidebar */}
          <Sidebar
            collapsed={false}
            onToggle={() => {}}
            isMobile={true}
            onMobileClose={() => setIsMobileSidebarOpen(false)}
            isFullscreen={isFullscreen}
            onToggleFullscreen={toggleFullscreen}
            onOpenPatients={() => setIsPatientModalOpen(true)}
          />
        </>
      )}

      {/* Main Content */}
      <main
        className={cn(
          'flex-1 overflow-y-auto transition-all duration-300 bg-gray-100',
          !isMobile && (sidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]'),
          isMobile && 'ml-0'
        )}
      >
        <Outlet context={{ 
          toggleMobileSidebar: () => setIsMobileSidebarOpen(!isMobileSidebarOpen),
          isMobileSidebarOpen
        }} />
      </main>

    </div>
  );
};

export default Layout;