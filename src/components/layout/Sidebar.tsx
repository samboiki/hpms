import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  Settings,
  ChevronRight,
  ChevronLeft,
  X,
  Wallet,
  Microscope,
  LogOut,
  User,
  Building2
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  onMobileClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  isMobile,
  onMobileClose 
}) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Calendar, label: 'Schedule', path: '/appointments' },
    { icon: Microscope, label: 'Requests', path: '/requests' },
    { icon: Wallet, label: 'Finance', path: '/finance' },
    { icon: Building2, label: 'Practice', path: '/practice-profile' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-full bg-brand-sidebar transition-all duration-300 z-30",
        collapsed && !isMobile ? "w-[72px]" : "w-[240px]"
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
        {!collapsed && (
          <div className="font-semibold text-lg text-white">
            REMEDICA
          </div>
        )}
      </div>

      <nav className="p-2 h-[calc(100vh-64px-80px)] overflow-y-auto">
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
      </nav>

      {/* User Profile Section */}
      <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-4">
        {!collapsed ? (
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                {user?.name?.charAt(0) || <User size={16} />}
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-white">{user?.name || 'User'}</p>
                <p className="text-xs text-white/70">{user?.role || 'Role'}</p>
              </div>
            </div>
            <button 
              onClick={handleLogout}
              className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <button
            onClick={handleLogout}
            className="w-full flex justify-center p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          >
            <LogOut size={18} />
          </button>
        )}

        {/* Collapse Button */}
        <button
          onClick={onToggle}
          className={cn(
            "mt-4 flex items-center w-full px-3 py-2 rounded-lg text-white/80 hover:bg-white/10 transition-colors min-h-[44px]",
            collapsed && !isMobile && "justify-center"
          )}
        >
          {collapsed ? (
            <ChevronRight size={20} strokeWidth={1.5} />
          ) : (
            <>
              <ChevronLeft size={20} strokeWidth={1.5} />
              <span className="ml-3 text-sm font-medium">Collapse</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;