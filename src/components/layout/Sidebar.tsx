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
  LogOut,
  ChevronDown,
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
  const { logout, isSuperAdmin, canManagePractices, user } = useAuthStore();
  const [showUserDropdown, setShowUserDropdown] = useState(false);

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
          ? "fixed left-0 top-0 h-full bg-gradient-to-br from-[#01b9d4] via-[#01a8c7] to-purple-600 transition-all duration-300 z-50 w-[280px]"
          : "fixed left-4 top-4 h-[calc(100vh-32px)] bg-gradient-to-br from-[#01b9d4] via-[#01a8c7] to-purple-600 rounded-xl transition-all duration-300 z-30",
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
        
        {/* User Avatar Section */}
        {user && (
          <div className="relative flex-1">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className={cn(
                "w-full flex items-center px-3 py-2 rounded-lg hover:bg-white/10 transition-colors",
                collapsed && !isMobile && "justify-center"
              )}
            >
              <div className="relative">
                <img
                  src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face`}
                  alt={user.name}
                  className="w-8 h-8 rounded-full object-cover border-2 border-white/20"
                  onError={(e) => {
                    e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=40&h=40&fit=crop&crop=face`;
                  }}
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 border-2 border-white rounded-full"></div>
              </div>
              {(!collapsed || isMobile) && (
                <>
                  <div className="ml-3 flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                    <p className="text-xs text-white/60 capitalize">{user.role}</p>
                  </div>
                  <ChevronDown 
                    size={16} 
                    className={cn(
                      "text-white/60 transition-transform",
                      showUserDropdown && "rotate-180"
                    )}
                  />
                </>
              )}
            </button>
            
            {/* Dropdown Menu */}
            {showUserDropdown && (!collapsed || isMobile) && (
              <div className="absolute top-full left-3 right-3 mt-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                <button
                  onClick={() => {
                    logout();
                    setShowUserDropdown(false);
                  }}
                  className="w-full flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <LogOut size={16} className="mr-2" />
                  Logout
                </button>
              </div>
            )}
          </div>
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

      <div className="mt-auto px-2 py-4 border-t border-white/15 space-y-1">
        <NavLink
          to="/settings"
          className={({ isActive }) => cn(
            "flex items-center px-3 py-2 rounded-lg text-white/80 hover:bg-white/10",
            isActive ? "bg-white/20" : "",
            collapsed && !isMobile && "justify-center"
          )}
        >
          <Cog size={18} />
          {(!collapsed || isMobile) && <span className="ml-3 text-sm">Settings</span>}
        </NavLink>

        {/* Fullscreen Toggle */}
        {onToggleFullscreen && (
          <button
            onClick={onToggleFullscreen}
            className={cn(
              "w-full flex items-center px-3 py-2 rounded-lg text-white/80 hover:bg-white/10",
              collapsed && !isMobile && "justify-center"
            )}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize size={18} />
            ) : (
              <Expand size={18} />
            )}
            {(!collapsed || isMobile) && (
              <span className="ml-3 text-sm">
                {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              </span>
            )}
          </button>
        )}

        <button
          onClick={onToggle}
          className={cn(
            "w-full mt-2 flex items-center px-3 py-2 rounded-lg text-white/80 hover:bg-white/10",
            collapsed && !isMobile && "justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight size={20} />
          ) : (
            <>
              <ChevronLeft size={20} />
              {!collapsed && <span className="ml-3 text-sm">Collapse</span>}
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;