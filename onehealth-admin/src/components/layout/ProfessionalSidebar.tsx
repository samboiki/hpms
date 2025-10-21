import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../contexts/ThemeContext'

interface MenuItem {
  id: string
  label: string
  icon: string
  path: string
  badge?: string
}

const menuItems: MenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: 'solar:widget-5-bold-duotone',
    path: '/dashboard',
  },
  {
    id: 'practices',
    label: 'Practice Management',
    icon: 'solar:buildings-3-bold-duotone',
    path: '/practice-management',
  },
  {
    id: 'tariff',
    label: 'Tariff Management',
    icon: 'solar:bill-list-bold-duotone',
    path: '/tariff-management',
  },
  {
    id: 'sms',
    label: 'SMS & Communications',
    icon: 'solar:chat-round-bold-duotone',
    path: '/sms-management',
  },
  {
    id: 'analytics',
    label: 'Analytics & Reports',
    icon: 'solar:graph-bold-duotone',
    path: '/analytics',
  },
  {
    id: 'patients',
    label: 'Patient Data',
    icon: 'solar:user-heart-bold-duotone',
    path: '/patient-data',
  },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: 'solar:calendar-bold-duotone',
    path: '/appointments',
  },
  {
    id: 'billing',
    label: 'Billing & Finance',
    icon: 'solar:card-bold-duotone',
    path: '/billing-finance',
  },
  {
    id: 'support',
    label: 'Support Center',
    icon: 'solar:help-bold-duotone',
    path: '/support-center',
  },
  {
    id: 'logs',
    label: 'System Logs',
    icon: 'solar:server-bold-duotone',
    path: '/system-logs',
  },
  {
    id: 'database',
    label: 'Database',
    icon: 'solar:database-bold-duotone',
    path: '/database',
  },
  {
    id: 'blueprint',
    label: 'System Blueprint',
    icon: 'solar:document-bold-duotone',
    path: '/system-blueprint',
    badge: 'NEW',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: 'solar:bell-bold-duotone',
    path: '/notifications',
  },
  {
    id: 'security',
    label: 'Security',
    icon: 'solar:shield-check-bold-duotone',
    path: '/security',
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: 'solar:settings-bold-duotone',
    path: '/settings',
  },
]

export function ProfessionalSidebar() {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const { darkMode, toggleDarkMode } = useTheme()

  const isActive = (path: string) => {
    return location.pathname === path || (path === '/dashboard' && location.pathname === '/')
  }

  return (
    <motion.div
      initial={false}
      animate={{ width: isCollapsed ? 80 : 280 }}
      className="relative h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col"
    >
      {/* Logo Section */}
      <div className="h-20 flex items-center justify-between px-6 border-b border-gray-200 dark:border-gray-800">
        <AnimatePresence mode="wait">
          {!isCollapsed && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex items-center gap-3"
            >
              <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Icon icon="solar:health-bold-duotone" className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white">OneHealth</h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Admin Portal</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
        >
          <Icon
            icon={isCollapsed ? 'solar:alt-arrow-right-bold-duotone' : 'solar:alt-arrow-left-bold-duotone'}
            className="w-5 h-5 text-gray-600 dark:text-gray-400"
          />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const active = isActive(item.path)

          return (
            <Link
              key={item.id}
              to={item.path}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group relative ${
                active
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg shadow-purple-500/25'
                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              {/* Active Indicator */}
              {active && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-white rounded-r-full"
                />
              )}

              {/* Icon */}
              <div className={`flex-shrink-0 ${isCollapsed ? 'mx-auto' : ''}`}>
                <Icon icon={item.icon} className="w-6 h-6" />
              </div>

              {/* Label */}
              {!isCollapsed && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex-1 text-left"
                >
                  <span className="font-medium text-sm">{item.label}</span>
                </motion.div>
              )}

              {/* Badge */}
              {!isCollapsed && item.badge && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="px-2 py-0.5 text-xs font-bold bg-red-500 text-white rounded-full"
                >
                  {item.badge}
                </motion.span>
              )}
            </Link>
          )
        })}
      </nav>

      {/* Bottom Section */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-800 space-y-2">
        {/* Dark Mode Toggle */}
        <button
          onClick={toggleDarkMode}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
        >
          <Icon
            icon={darkMode ? 'solar:sun-bold-duotone' : 'solar:moon-bold-duotone'}
            className="w-6 h-6"
          />
          {!isCollapsed && (
            <span className="font-medium text-sm">{darkMode ? 'Light Mode' : 'Dark Mode'}</span>
          )}
        </button>

        {/* User Profile */}
        <div
          className={`flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 ${
            isCollapsed ? 'justify-center' : ''
          }`}
        >
          <div className="relative">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold">
              AD
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
          </div>

          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">admin@onehealth.com</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}
