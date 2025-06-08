import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { 
  LayoutDashboard, 
  Users, 
  ChevronRight,
  ChevronLeft,
  X,
  Wallet,
  Microscope,
  UserRound,
  Cog,
  Package2,
  Bell,
  LogOut,
  Building2,
  DollarSign,
  Crown,
  Calendar,
  Receipt
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
  const { logout, isSuperAdmin, canManagePractices } = useAuthStore();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Calendar, label: 'Appointments', path: '/appointments' },
    { icon: Microscope, label: 'Requests', path: '/requests' },
    { icon: Package2, label: 'Inventory', path: '/inventory' },
    { icon: Bell, label: 'Messages', path: '/messages' },
    { icon: Receipt, label: 'Billing', path: '/billing' },
    { icon: Wallet, label: 'Finance', path: '/finance' },
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
        {!collapsed && (
          <div className="font-semibold text-lg text-white">
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
          to="/practice-profile"
          className={({ isActive }) => cn(
            "flex items-center px-3 py-2 rounded-lg text-white/80 hover:bg-white/10",
            isActive ? "bg-white/20" : "",
            collapsed && !isMobile && "justify-center"
          )}
        >
          <Building2 size={18} />
          {(!collapsed || isMobile) && <span className="ml-3 text-sm">Practice</span>}
        </NavLink>

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

        <button
          onClick={logout}
          className={cn(
            "w-full flex items-center px-3 py-2 rounded-lg text-white/80 hover:bg-white/10",
            collapsed && !isMobile && "justify-center"
          )}
        >
          <LogOut size={18} />
          {(!collapsed || isMobile) && <span className="ml-3 text-sm">Logout</span>}
        </button>
      </div>
    </div>
  );
};

export default Sidebar;