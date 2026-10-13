import React, { useState, useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Icon } from '@iconify/react';
import Sidebar from './Sidebar';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../stores/themeStore';

const Layout: React.FC = () => {
  const practiceName = useAuthStore((state) => state.user?.practices?.name);
  const { currentTheme } = useTheme();
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
    <div className="flex h-screen supports-[height:100dvh]:h-[100dvh] overflow-hidden bg-gray-100">
      {/* Sidebar - Desktop Only */}
      <div className="hidden lg:block">
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          isMobile={false}
          isFullscreen={isFullscreen}
          onToggleFullscreen={toggleFullscreen}
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
          />
        </>
      )}

      {/* Main column */}
      <div
        className={cn(
          'flex-1 min-w-0 flex flex-col transition-all duration-300',
          !isMobile && (sidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]')
        )}
      >
        {/* Below lg the sidebar is hidden: this bar gives every page the menu */}
        <header className="lg:hidden flex-none flex items-center justify-between gap-3 h-14 px-4 bg-white/95 backdrop-blur border-b border-gray-200">
          <NavLink
            to="/"
            className="flex min-w-0 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            title="Dashboard"
          >
            <span className={cn('flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-sm', currentTheme.gradients.sidebar)}>
              <Icon icon="solar:widget-bold-duotone" className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="truncate text-sm font-semibold text-gray-800">{practiceName || 'Dashboard'}</span>
          </NavLink>
          <div className="flex flex-none items-center gap-2">
            <button
              type="button"
              onClick={() => setIsMobileSidebarOpen(true)}
              className="flex h-10 w-10 items-center justify-center rounded-xl text-gray-700 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              aria-label="Open menu"
              title="Menu"
            >
              <Icon icon="solar:hamburger-menu-bold-duotone" className="h-6 w-6" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Reserve the scrollbar's space so pages don't shift sideways when content gets shorter or longer */}
        <main className="flex-1 min-h-0 overflow-y-auto [scrollbar-gutter:stable] bg-gray-100">
          <Outlet context={{
            toggleMobileSidebar: () => setIsMobileSidebarOpen(!isMobileSidebarOpen),
            isMobileSidebarOpen
          }} />
        </main>
      </div>

    </div>
  );
};

export default Layout;