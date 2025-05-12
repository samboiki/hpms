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
  ChevronLeft
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle }) => {
  const { logout } = useAuthStore();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Calendar, label: 'Schedule', path: '/appointments' },
    { icon: FileText, label: 'Records', path: '/records' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  return (
    <div 
      className={cn(
        "fixed left-0 top-0 h-screen bg-white border-r border-gray-100 transition-all duration-300 z-30",
        collapsed ? "w-[72px]" : "w-[240px]"
      )}
    >
      <div className="flex items-center h-16 px-4 border-b border-gray-100">
        {!collapsed && (
          <div className="font-semibold text-lg text-brand-blue">
            REMEDICA
          </div>
        )}
      </div>

      <div className="p-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex items-center px-3 py-2 rounded-lg mb-1 transition-colors",
              "hover:bg-gray-50",
              isActive ? "text-brand-blue bg-blue-50" : "text-gray-600",
              collapsed && "justify-center"
            )}
          >
            <item.icon size={20} strokeWidth={1.5} />
            {!collapsed && (
              <span className="ml-3 text-sm font-medium">{item.label}</span>
            )}
          </NavLink>
        ))}
      </div>

      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 bg-white border border-gray-200 rounded-full p-1 shadow-soft"
      >
        {collapsed ? (
          <ChevronRight size={16} className="text-gray-600" />
        ) : (
          <ChevronLeft size={16} className="text-gray-600" />
        )}
      </button>

      <div className="absolute bottom-4 left-0 right-0 px-2">
        <button
          onClick={logout}
          className={cn(
            "flex items-center w-full px-3 py-2 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors",
            collapsed && "justify-center"
          )}
        >
          <LogOut size={20} strokeWidth={1.5} />
          {!collapsed && (
            <span className="ml-3 text-sm font-medium">Logout</span>
          )}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;