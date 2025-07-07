import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
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
    { icon: 'solar:widget-bold-duotone', label: 'Dashboard', path: '/', isRoute: true },
    { icon: 'solar:users-group-rounded-bold-duotone', label: 'Patients', path: '/patients', isRoute: false, onClick: onOpenPatients },
    { icon: 'solar:clipboard-list-bold-duotone', label: 'Encounters', path: '/encounters', isRoute: true },
    { icon: 'solar:letter-bold-duotone', label: 'Messages', path: '/communications', isRoute: true, badge: unreadCount > 0 ? unreadCount : undefined },
    { icon: 'solar:test-tube-bold-duotone', label: 'Automation Test', path: '/automation-test', isRoute: true },
    { icon: 'solar:wallet-money-bold-duotone', label: 'Finance', path: '/finance', isRoute: true },
  ];

  const adminItems = [
    { icon: 'solar:crown-bold-duotone', label: 'Manage Practices', path: '/admin/practices' },
    { icon: 'solar:dollar-circle-bold-duotone', label: 'Tariff Management', path: '/admin/tariffs' },
  ];

  return (
    <div 
      className={cn(
        isMobile 
          ? `fixed left-0 top-0 h-full bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md transition-all duration-300 z-50 w-[280px]`
          : `fixed left-4 top-4 h-[calc(100vh-32px)] bg-gradient-to-b ${currentTheme.gradients.sidebar} backdrop-blur-md rounded-2xl transition-all duration-300 z-30`,
        "shadow-[0_20px_60px_rgb(0,0,0,0.15)] border border-white/10",
        !isMobile && collapsed ? "w-[72px]" : !isMobile && "w-[240px]"
      )}
    >
      <div className="flex items-center justify-between h-20 px-4 border-b border-white/10">
        {/* Practice Logo */}
        <motion.div 
          className="flex items-center gap-3"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
        >
          {practiceData?.logo_url ? (
            <motion.img
              src={practiceData.logo_url}
              alt={practiceData.name}
              className={cn(
                "object-contain",
                collapsed && !isMobile ? "h-10 w-10" : "h-14 w-auto max-w-[180px]"
              )}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.2 }}
            />
          ) : (
            <div className={cn(
              "flex items-center",
              collapsed && !isMobile ? "justify-center" : "gap-3"
            )}>
              <motion.div 
                className={cn(
                  "rounded-xl flex items-center justify-center",
                  collapsed && !isMobile ? "w-10 h-10" : "w-12 h-12"
                )}
                style={{ 
                  background: `linear-gradient(135deg, ${practiceData?.primary_color || '#6366f1'} 0%, ${practiceData?.secondary_color || practiceData?.primary_color || '#818cf8'} 100%)`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                }}
                whileHover={{ scale: 1.1, rotate: 5 }}
                transition={{ duration: 0.2 }}
              >
                <Icon icon="solar:health-bold-duotone" className="w-6 h-6 text-white" />
              </motion.div>
              {(!collapsed || isMobile) && (
                <div className="text-white">
                  <h2 className="font-bold text-lg leading-tight">{practiceData?.name || 'Practice'}</h2>
                  <p className="text-xs text-white/70">Healthcare Excellence</p>
                </div>
              )}
            </div>
          )}
        </motion.div>

        {isMobile && (
          <button
            onClick={onMobileClose}
            className="p-2 rounded-md text-white/80 hover:text-white md:hidden"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-5 h-5" />
          </button>
        )}
      </div>

      <nav className="p-2">
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
                <Icon icon={item.icon} className="w-5 h-5" />
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
            );
          } else {
            return (
              <button
                key={item.path}
                onClick={() => {
                  item.onClick?.();
                  if (isMobile) onMobileClose?.();
                }}
                className={cn(
                  "w-full flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
                  "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02] text-white/90",
                  collapsed && !isMobile && "justify-center"
                )}
              >
                <Icon icon={item.icon} className="w-5 h-5" />
                {(!collapsed || isMobile) && (
                  <span className="ml-3 text-sm font-medium">{item.label}</span>
                )}
              </button>
            );
          }
        })}

        {/* Settings and Controls Section */}
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
          <Icon icon="solar:settings-bold-duotone" className="w-5 h-5" />
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
              <Icon icon="solar:minimize-square-bold-duotone" className="w-5 h-5" />
            ) : (
              <Icon icon="solar:maximize-square-bold-duotone" className="w-5 h-5" />
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
            "w-full flex items-center px-4 py-3 rounded-xl mb-2 text-white/90 hover:bg-white/15 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 min-h-[48px]",
            collapsed && !isMobile && "justify-center"
          )}
        >
          {collapsed ? (
            <Icon icon="solar:alt-arrow-right-bold-duotone" className="w-5 h-5" />
          ) : (
            <>
              <Icon icon="solar:alt-arrow-left-bold-duotone" className="w-5 h-5" />
              {(!collapsed || isMobile) && <span className="ml-3 text-sm font-medium">Collapse</span>}
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
            <Icon icon="solar:sun-bold-duotone" className="w-5 h-5" />
          ) : (
            <Icon icon="solar:moon-bold-duotone" className="w-5 h-5" />
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
                  "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
                  "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                  isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                  collapsed && !isMobile && "justify-center"
                )}
                onClick={isMobile ? onMobileClose : undefined}
              >
                <Icon icon={item.icon} className="w-5 h-5" />
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
          </>
        )}
      </nav>

    </div>
  );
};

export default Sidebar;