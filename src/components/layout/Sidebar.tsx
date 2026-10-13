import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { Icon } from '@iconify/react';
import { useAuthStore } from '../../stores/authStore';
import { useScreenAccess } from '../../hooks/useScreenAccess';
import { sidebarShowsPath } from '../../utils/auth/screenAccess';
import { useTheme } from '../../stores/themeStore';
import { unreadMessagesService } from '../../services/unreadMessagesService';
import { NotificationBadge } from '../ui/NotificationBadge';
import { supabase } from '../../lib/supabase';
import { motion } from 'framer-motion';
import { APP_COLOR, SECTION_COLORS } from '../../config/sectionColors';
import { isOptometryPractice } from '../../utils/billing/tariffRules';
import { prefetchPage } from '../../pageLoaders';

/** A page's code starts downloading when the pointer rests on, a finger touches, or the keyboard reaches its link */
const prefetchLinkTarget = (event: React.SyntheticEvent) => {
  const link = (event.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
  if (link) prefetchPage(link.pathname);
};

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
  const { isSuperAdmin, user, selectedPracticeId } = useAuthStore();
  // Who the practice lets open Finance and Stock (Settings > Users > Screen access)
  const screenAccess = useScreenAccess();
  const { currentTheme } = useTheme();
  const location = useLocation();
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
      bgGradient: SECTION_COLORS.patients.iconBox,
      iconColor: 'text-white'
    },
    { 
      icon: 'solar:clipboard-list-bold-duotone', 
      label: 'Encounters', 
      path: '/encounters', 
      isRoute: true, 
      bgGradient: SECTION_COLORS.encounters.iconBox,
      iconColor: 'text-white'
    },
    {
      icon: 'solar:letter-bold-duotone',
      label: 'Messages',
      path: '/communications',
      // The badge counts unread staff messages: with some waiting, the link opens the Messaging tab that holds them
      to: unreadCount > 0 ? '/communications?tab=messaging' : '/communications',
      isRoute: true,
      badge: unreadCount > 0 ? unreadCount : undefined,
      bgGradient: SECTION_COLORS.messages.iconBox,
      iconColor: 'text-white'
    },
    { 
      icon: 'solar:wallet-money-bold-duotone', 
      label: 'Finance', 
      path: '/finance', 
      isRoute: true, 
      bgGradient: SECTION_COLORS.finance.iconBox,
      iconColor: 'text-white'
    },
    { 
      // Medicines and consumables: deliveries, dispensing, stock take (proposals/2026-10-07-dispensing-and-stock.sql)
      icon: 'solar:box-bold-duotone', 
      label: 'Stock',
      path: '/stock',
      isRoute: true,
      bgGradient: SECTION_COLORS.stock.iconBox,
      iconColor: 'text-white'
    },
    // Optometry practices only: lab orders, frames, the optometry reports and benefit notes (not a section: app purple)
    ...(isOptometryPractice(practiceData?.practice_type) ? [{
      icon: 'solar:glasses-bold-duotone',
      label: 'Optometry',
      path: '/optometry',
      isRoute: true,
      bgGradient: APP_COLOR.iconBox,
      iconColor: 'text-white'
    }] : []),
  ];

  // Every practice administrator manages the practice's own tariff list, co-payments and levies (Admin > Tariffs);
  // the rest of Administration is for OneHealth support and practice managers
  // Manage Practices and the blueprint open for OneHealth support only (the pages refuse anyone else, also a practice
  // administrator flagged "can manage practices"): never a link that ends at "Access Denied"
  const showAdministration = isSuperAdmin();
  const showTariffs = showAdministration || user?.role === 'admin';
  const adminItems: Array<{ icon: string; label: string; path: string; practiceAdmins: boolean; badge?: number }> = [
    { icon: 'solar:crown-bold-duotone', label: 'Manage Practices', path: '/admin/practices', practiceAdmins: false },
    { icon: 'solar:dollar-bold-duotone', label: 'Tariffs', path: '/admin/tariffs', practiceAdmins: true },
    // OneHealth support keeps each fund's claim rules; practice administrators read them and keep their own notes
    { icon: 'solar:shield-plus-bold-duotone', label: 'Medical aid funds', path: '/admin/funds', practiceAdmins: true },
  ].filter(item => showAdministration || item.practiceAdmins);

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
          title={collapsed && !isMobile ? 'Dashboard' : undefined}
          aria-label={collapsed && !isMobile ? 'Dashboard' : undefined}
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
            title="Close menu"
            aria-label="Close menu"
          >
            <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6" />
          </button>
        )}
      </div>

      <nav className="flex-1 flex flex-col p-2 overflow-y-auto" onMouseOver={prefetchLinkTarget} onFocus={prefetchLinkTarget} onTouchStart={prefetchLinkTarget}>
        {/* Main Navigation Section */}
        <div className="flex-1">
          {/* Finance and Stock are hidden from roles the practice has not given access */}
          {navItems.filter((item) => sidebarShowsPath(user, item.path, screenAccess)).map((item) => {
            if (item.isRoute) {
              return (
                <NavLink
                  key={item.path}
                  to={'to' in item && item.to ? item.to : item.path}
                  className={({ isActive }) => cn(
                    "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group",
                    "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                    isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                    collapsed && !isMobile && "justify-center"
                  )}
                  onClick={isMobile ? onMobileClose : undefined}
                  // The collapsed bar hides the unread badge: its tooltip and screen-reader name carry the count
                  title={collapsed && !isMobile ? (item.badge ? `${item.label} (${item.badge} unread)` : item.label) : undefined}
                  aria-label={collapsed && !isMobile ? (item.badge ? `${item.label} (${item.badge} unread)` : item.label) : undefined}
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
          {showTariffs && (
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
                  // The collapsed bar hides the unread badge: its tooltip and screen-reader name carry the count
                  title={collapsed && !isMobile ? (item.badge ? `${item.label} (${item.badge} unread)` : item.label) : undefined}
                  aria-label={collapsed && !isMobile ? (item.badge ? `${item.label} (${item.badge} unread)` : item.label) : undefined}
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
              {showAdministration && (
              <NavLink
                to="/admin/blueprint"
                className={({ isActive }) => cn(
                  "flex items-center px-4 py-3 rounded-xl mb-2 transition-all duration-200 min-h-[48px] group relative overflow-hidden",
                  "hover:bg-white/15 hover:shadow-lg hover:scale-[1.02]",
                  isActive ? "text-white bg-white/25 shadow-lg border border-white/20" : "text-white/90",
                  collapsed && !isMobile && "justify-center"
                )}
                onClick={isMobile ? onMobileClose : undefined}
                title={collapsed && !isMobile ? 'System Blueprint' : undefined}
                aria-label={collapsed && !isMobile ? 'System Blueprint' : undefined}
              >
                {({ isActive }) => (
                  <>
                    {/* Animated background */}
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-blue-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className={cn(
                      "p-2 rounded-xl relative z-10",
                      isActive ? "bg-gradient-to-br from-purple-500 to-blue-600" : ""
                    )}>
                      <Icon icon="solar:document-text-bold-duotone" className={cn("w-6 h-6", isActive ? "text-white" : "text-white")} />
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
              )}
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
            title={collapsed && !isMobile ? 'Settings' : undefined}
            aria-label={collapsed && !isMobile ? 'Settings' : undefined}
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
              aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
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

          {/* Collapse Toggle (desktop only: the mobile menu cannot collapse, so the button did nothing there) */}
          {!isMobile && (
            <button
              onClick={onToggle}
              className={cn(
                "w-full flex items-center px-4 py-3 rounded-xl mb-2 text-white/90 hover:bg-white/15 hover:shadow-lg hover:scale-[1.02] transition-all duration-200 min-h-[48px]",
                collapsed && "justify-center"
              )}
              title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? (
                <Icon icon="solar:sidebar-minimalistic-bold-duotone" className="w-6 h-6" />
              ) : (
                <>
                  <Icon icon="solar:sidebar-minimalistic-bold-duotone" className="w-6 h-6" />
                  <span className="ml-3 text-sm font-medium">Collapse Sidebar</span>
                </>
              )}
            </button>
          )}
        </div>
      </nav>

    </div>
  );
};

export default Sidebar;