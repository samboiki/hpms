import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { 
  LayoutDashboard, 
  Users, 
  Calendar, 
  FileText, 
  Settings,
  LogOut,
  ChevronRight,
  ChevronLeft,
  X,
  DollarSign
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
  const { logout } = useAuthStore();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Calendar, label: 'Schedule', path: '/appointments' },
    { icon: DollarSign, label: 'Finance', path: '/finance' },
    { icon: FileText, label: 'Records', path: '/records' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div 
      className={cn(
        "fixed left-4 top-4 h-[calc(100vh-32px)] bg-white rounded-xl transition-all duration-300 z-30",
        "shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
        collapsed && !isMobile ? "w-[72px]" : "w-[240px]"
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-gray-100">
        {isMobile && (
          <button
            onClick={onMobileClose}
            className="absolute right-4 top-4 p-2 rounded-md text-gray-400 hover:text-gray-600 md:hidden"
          >
            <X size={20} />
          </button>
        )}
        {!collapsed && (
          <div className="font-semibold text-lg text-brand-blue">
            REMEDICA
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
              "hover:bg-gray-50",
              isActive ? "text-brand-blue bg-blue-50" : "text-gray-600",
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

      {!isMobile && (
        <button
          onClick={onToggle}
          className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-md hover:shadow-lg transition-shadow"
        >
          {collapsed ? (
            <ChevronRight size={16} className="text-gray-600" />
          ) : (
            <ChevronLeft size={16} className="text-gray-600" />
          )}
        </button>
      )}

      <div className="absolute bottom-4 left-0 right-0 px-2">
        <button
          onClick={logout}
          className={cn(
            "flex items-center w-full px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors min-h-[44px]",
            collapsed && !isMobile && "justify-center"
          )}
        >
          <LogOut size={20} strokeWidth={1.5} />
          {(!collapsed || isMobile) && (
            <span className="ml-3 text-sm font-medium">Logout</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;