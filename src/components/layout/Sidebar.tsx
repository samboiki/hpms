import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { 
  LayoutDashboard, 
  Users, 
  ChevronRight,
  ChevronLeft,
  X,
  UserRound,
  Cog,
  Bell,
  Building2,
  DollarSign,
  Crown,
  Expand,
  Minimize,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  onMobileClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  isMobile,
  onMobileClose,
  isFullscreen = false,
  onToggleFullscreen
}) => {
  const { isSuperAdmin, canManagePractices } = useAuthStore();
  const [isDarkMode, setIsDarkMode] = useState(false);

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Bell, label: 'Messages', path: '/messages' },
  ];

  const adminItems = [
    { icon: Crown, label: 'Manage Practices', path: '/admin/practices' },
    { icon: DollarSign, label: 'Tariff Management', path: '/admin/tariffs' },
  ];

  return (
    <div 
      className={cn(
        isMobile 
          ? "fixed left-0 top-0 h-full bg-[#4f575e] transition-all duration-300 z-50 w-[280px]"
          : "fixed left-4 top-4 h-[calc(100vh-32px)] bg-[#4f575e] rounded-xl transition-all duration-300 z-30",
        "shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
        !isMobile && collapsed ? "w-[72px]" : !isMobile && "w-[240px]"
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-white/10">
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="absolute right-4 top-4 p-2 rounded-md text-white/80 hover:text-white md:hidden"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <nav className="p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2 rounded-lg mb-1 transition-colors min-h-[44px]",
              "hover:bg-white/10",
              isActive ? "text-white bg-white/20" : "text-white/80",
              collapsed && !isMobile && "justify-center"
            )}
            onClick={isMobile ? onMobileClose : undefined}
          >
            <item.icon size={20} strokeWidth={1.5} />
            {(!collapsed || isMobile) && (
              <span className="ml-3 text-sm font-medium">{item.label}</span>
            )}
          </NavLink>
        ))}

        {/* Settings and Controls Section */}
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            "flex items-center px-3 py-2 rounded-lg mb-1 transition-colors min-h-[44px]",
            "hover:bg-white/10",
            isActive ? "text-white bg-white/20" : "text-white/80",
            collapsed && !isMobile && "justify-center"
          )}
          onClick={isMobile ? onMobileClose : undefined}
        >
          <Cog size={20} strokeWidth={1.5} />
          {(!collapsed || isMobile) && (
            <span className="ml-3 text-sm font-medium">Settings</span>
          )}
        </NavLink>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg mb-1 text-white/80 hover:bg-white/10 min-h-[44px]",
              collapsed && !isMobile && "justify-center"
            )}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize size={20} strokeWidth={1.5} />
            ) : (
              <Expand size={20} strokeWidth={1.5} />
            )}
            {(!collapsed || isMobile) && (
              <span className="ml-3 text-sm font-medium">
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </span>
            )}
          </button>
        )}

        <button
          onClick={onToggle}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-lg mb-1 text-white/80 hover:bg-white/10 min-h-[44px]",
            collapsed && !isMobile && "justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight size={20} strokeWidth={1.5} />
          ) : (
            <>
              <ChevronLeft size={20} strokeWidth={1.5} />
              {(!collapsed || isMobile) && <span className="ml-3 text-sm font-medium">Collapse</span>}
            </>
          )}
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setIsDarkMode(!isDarkMode)}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-lg mb-1 text-white/80 hover:bg-white/10 min-h-[44px]",
            collapsed && !isMobile && "justify-center"
          )}
          title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
        >
          {isDarkMode ? (
            <Sun size={20} strokeWidth={1.5} />
          ) : (
            <Moon size={20} strokeWidth={1.5} />
          )}
          {(!collapsed || isMobile) && (
            <span className="ml-3 text-sm font-medium">
              {isDarkMode ? "Light Mode" : "Dark Mode"}
            </span>
          )}
        </button>

        {/* Admin Section */}
        {(isSuperAdmin() || canManagePractices()) && (
          <>
            {(!collapsed || isMobile) && (
              <div className="px-3 py-2 mt-4 mb-2">
                <div className="text-xs font-semibold text-white/60 uppercase tracking-wider">
                  Administration
                </div>
              </div>
            )}
            {adminItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => cn(
                  "flex items-center px-3 py-2 rounded-lg mb-1 transition-colors min-h-[44px]",
                  "hover:bg-white/10",
                  isActive ? "text-white bg-white/20" : "text-white/80",
                  collapsed && !isMobile && "justify-center"
                )}
                onClick={isMobile ? onMobileClose : undefined}
              >
                <item.icon size={20} strokeWidth={1.5} />
                {(!collapsed || isMobile) && (
                  <span className="ml-3 text-sm font-medium">{item.label}</span>
                )}
              </NavLink>
            ))}
          </>
        )}
      </nav>

    </div>
  );
};

export default Sidebar;