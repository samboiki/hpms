import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { useTheme } from '../../stores/themeStore';
import { unreadMessagesService } from '../../services/unreadMessagesService';
import { NotificationBadge } from '../ui/NotificationBadge';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  onMobileClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onOpenPatients?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  collapsed, 
  onToggle, 
  isMobile,
  onMobileClose,
  isFullscreen = false,
  onToggleFullscreen,
  onOpenPatients
}) => {
  const { isSuperAdmin, canManagePractices, user, selectedPracticeId } = useAuthStore();
  const { currentTheme } = useTheme();
  const location = useLocation();
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [practiceData, setPracticeData] = useState<any>(null);

  // Subscribe to unread messages
  useEffect(() => {
    if (user?.id && user?.practice_id) {
      console.log('[Sidebar] Initializing unread messages service with practice:', user.practice_id);
      unreadMessagesService.initialize(user.id, user.practice_id);
      const unsubscribe = unreadMessagesService.subscribe(setUnreadCount);
      return () => {
        unsubscribe();
      };
    }
  }, [user?.id, user?.practice_id]);

  // Fetch practice data
  useEffect(() => {
    const fetchPracticeData = async () => {
      const practiceId = selectedPracticeId || user?.practice_id;
      if (!practiceId) return;

      try {
        const { data, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', practiceId)
          .single();

        if (error) throw error;
        setPracticeData(data);
      } catch (error) {
        console.error('Error fetching practice data:', error);
      }
    };

    fetchPracticeData();
  }, [selectedPracticeId, user?.practice_id]);

  const navItems = [
    { 
      icon: 'solar:user-bold-duotone', 
      label: 'Patients', 
      path: '/patients', 
      isRoute: true, 
      bgGradient: 'bg-gradient-to-r from-purple-500 to-indigo-600',
      iconColor: 'text-white'
    },
    { 
      icon: 'solar:clipboard-list-bold-duotone', 
      label: 'Encounters', 
      path: '/encounters', 
      isRoute: true, 
      bgGradient: 'bg-gradient-to-br from-cyan-500 to-blue-500',
      iconColor: 'text-white'
    },
    { 
      icon: 'solar:letter-bold-duotone', 
      label: 'Messages', 
      path: '/communications', 
      isRoute: true, 
      badge: unreadCount > 0 ? unreadCount : undefined, 
      bgGradient: 'bg-gradient-to-br from-amber-500 to-orange-600',
      iconColor: 'text-white'
    },
    {
      icon: 'solar:wallet-money-bold-duotone',
      label: 'Finance',
      path: '/finance',
      isRoute: true,
      bgGradient: 'bg-gradient-to-r from-cyan-500 to-cyan-600',
      iconColor: 'text-white'
    },
    {
      icon: 'solar:hospital-bold-duotone',
      label: 'Inpatient',
      path: '/inpatient',
      isRoute: true,
      bgGradient: 'bg-gradient-to-br from-[#01b9d4] to-[#0197d4]',
      iconColor: 'text-white'
    },
  ];

  const adminItems = [
    { icon: 'solar:crown-bold-duotone', label: 'Manage Practices', path: '/admin/practices' },
    { icon: 'solar:dollar-circle-bold-duotone', label: 'Tariff Management', path: '/admin/tariffs' },
  ];

  return (
    <div 
      className={cn(
        isMobile 
          ? `fixed right-0 top-0 h-full bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md transition-all duration-300 z-50 w-[280px]`
          : `fixed left-4 top-4 h-[calc(100vh-32px)] bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md rounded-2xl transition-all duration-300 z-30`,
        "shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-white/10 flex flex-col",
        !isMobile && collapsed ? "w-[72px]" : !isMobile && "w-[240px]"
      )}
    >
      <div className="flex items-center justify-between h-20 px-4 border-b border-white/10">
        {/* Dashboard Icon */}
        <NavLink
          to="/"
          className={({ isActive }) => cn(
            "flex items-center gap-3 transition-opacity",
            isActive ? "" : "hover:opacity-90"
          )}
        >
          {({ isActive }) => (
            <motion.div 
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <div className={cn(
                "flex items-center",
                collapsed && !isMobile ? "justify-center" : "gap-3"
              )}>
                <motion.div 
                  className={cn(
                    "rounded-xl flex items-center justify-center",
                    collapsed && !isMobile ? "w-10 h-10" : "w-12 h-12",
                    isActive ? "bg-purple-500" : ""
                  )}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  transition={{ duration: 0.2 }}
                >
                  <Icon icon="solar:widget-bold-duotone" className={cn("w-7 h-7", isActive ? "text-white" : "text-gray-500")} />
                </motion.div>
                {(!collapsed || isMobile) && (
                  <div className="text-white">
                    <h2 className="font-bold text-lg leading-tight">Dashboard</h2>
                    <p className="text-xs text-white/70">Control Center</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </NavLink>

        {isMobile && (
          <button
            onClick={onMobileClose}
            className="p-2 rounded-md text-white/80 hover:text-white md:hidden"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 flex flex-col p-2 overflow-y-auto">
        {/* Main Navigation Section */}
        <div className="flex-1">
          {navItems.map((item) => {
            if (item.isRoute) {
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) => cn(
                    "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
                    "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                    isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                    collapsed && !isMobile && "justify-center"
                  )}
                  onClick={isMobile ? onMobileClose : undefined}
                >
                  {({ isActive }) => (
                    <>
                      <div className={cn("p-2 rounded-xl", isActive ? item.bgGradient : "")}>
                        <Icon icon={item.icon} className={cn("w-6 h-6", isActive ? item.iconColor : "text-white")} />
                      </div>
                      {(!collapsed || isMobile) && (
                        <span className="ml-3 text-sm font-medium flex-1">{item.label}</span>
                      )}
                      {/* Keep badge in same position regardless of collapsed state */}
                      {item.badge && item.badge > 0 && (!collapsed || isMobile) && (
                        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 shadow-md border-2 border-white">
                          {item.badge > 99 ? '99+' : item.badge}
                        </div>
                      )}
                    </>
                  )}
                </NavLink>
              );
            } else {
              const isActive = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  onClick={() => {
                    item.onClick?.();
                    if (isMobile) onMobileClose?.();
                  }}
                  className={cn(
                    "w-full flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
                    "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                    isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                    collapsed && !isMobile && "justify-center"
                  )}
                >
                  <div className={cn("p-2 rounded-xl", isActive ? item.bgGradient : "")}>
                    <Icon icon={item.icon} className={cn("w-6 h-6", isActive ? item.iconColor : "text-white")} />
                  </div>
                  {(!collapsed || isMobile) && (
                    <span className="ml-3 text-sm font-medium">{item.label}</span>
                  )}
                </button>
              );
            }
          })}

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
                    "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
                    "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                    isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                    collapsed && !isMobile && "justify-center"
                  )}
                  onClick={isMobile ? onMobileClose : undefined}
                >
                  <Icon icon={item.icon} className="w-6 h-6" />
                  {(!collapsed || isMobile) && (
                    <span className="ml-3 text-sm font-medium flex-1">{item.label}</span>
                  )}
                  {/* Keep badge in same position regardless of collapsed state */}
                  {item.badge && item.badge > 0 && (!collapsed || isMobile) && (
                    <div className="bg-gradient-to-r from-red-500 to-red-600 text-white text-[10px] font-bold rounded-full min-w-[20px] h-[20px] flex items-center justify-center px-1.5 shadow-md border-2 border-white">
                      {item.badge > 99 ? '99+' : item.badge}
                    </div>
                  )}
                </NavLink>
              ))}
              
              {/* System Blueprint - Premium Feature */}
              <NavLink
                to="/admin/blueprint"
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group relative overflow-hidden",
                  "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                  isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                  collapsed && !isMobile && "justify-center"
                )}
                onClick={isMobile ? onMobileClose : undefined}
              >
                {({ isActive }) => (
                  <>
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className={cn(
                      "p-2 rounded-xl relative z-10",
                      isActive ? "bg-gradient-to-br from-purple-500 to-blue-600" : ""
                    )}>
                      <Icon icon="solar:blueprint-bold-duotone" className={cn("w-6 h-6", isActive ? "text-white" : "text-white")} />
                    </div>
                    {(!collapsed || isMobile) && (
                      <>
                        <span className="ml-3 text-sm font-medium flex-1 relative z-10">System Blueprint</span>
                        <div className="bg-gradient-to-r from-purple-500 to-blue-600 text-white text-[9px] font-bold rounded-full px-2 py-0.5 shadow-sm">
                          NEW
                        </div>
                      </>
                    )}
                  </>
                )}
              </NavLink>
            </>
          )}
        </div>

        {/* Bottom Controls Section */}
        <div className="mt-auto pt-4 border-t border-white/10">
          {/* Settings */}
          <NavLink
            to="/settings"
            className={({ isActive }) => cn(
              "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
              "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
              isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
              collapsed && !isMobile && "justify-center"
            )}
            onClick={isMobile ? onMobileClose : undefined}
          >
            <Icon icon="solar:settings-bold-duotone" className="w-6 h-6" />
            {(!collapsed || isMobile) && (
              <span className="ml-3 text-sm font-medium">Settings</span>
            )}
          </NavLink>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={cn(
                "w-full flex items-center px-4 py-3 rounded-xl mb-2 text-white/90 hover:bg-white/15 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 min-h-[48px]",
                collapsed && !isMobile && "justify-center"
              )}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Icon icon="solar:quit-full-screen-bold-duotone" className="w-6 h-6" />
              ) : (
                <Icon icon="solar:full-screen-bold-duotone" className="w-6 h-6" />
              )}
              {(!collapsed || isMobile) && (
                <span className="ml-3 text-sm font-medium">
                  {isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
                </span>
              )}
            </button>
          )}

          {/* Collapse Toggle */}
          <button
            onClick={onToggle}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl mb-2 text-white/90 hover:bg-white/15 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 min-h-[48px]",
              collapsed && !isMobile && "justify-center"
            )}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
          >
            {collapsed ? (
              <Icon icon="solar:sidebar-minimalistic-bold-duotone" className="w-6 h-6" />
            ) : (
              <>
                <Icon icon="solar:sidebar-minimalistic-bold-duotone" className="w-6 h-6" />
                {(!collapsed || isMobile) && <span className="ml-3 text-sm font-medium">Collapse Sidebar</span>}
              </>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className={cn(
              "w-full flex items-center px-4 py-3 rounded-xl mb-2 text-white/90 hover:bg-white/15 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 min-h-[48px]",
              collapsed && !isMobile && "justify-center"
            )}
            title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {isDarkMode ? (
              <Icon icon="solar:sun-2-bold-duotone" className="w-6 h-6" />
            ) : (
              <Icon icon="solar:moon-stars-bold-duotone" className="w-6 h-6" />
            )}
            {(!collapsed || isMobile) && (
              <span className="ml-3 text-sm font-medium">
                {isDarkMode ? "Switch to Light" : "Switch to Dark"}
              </span>
            )}
          </button>
        </div>
      </nav>

    </div>
  );
};

export default Sidebar;