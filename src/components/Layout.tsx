import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Icon } from '@iconify/react'
import clsx from 'clsx'

interface LayoutProps {
  children: React.ReactNode
}

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: 'solar:chart-bold-duotone' },
  { name: 'Practice Management', href: '/practice-management', icon: 'solar:buildings-bold-duotone' },
  { name: 'User Administration', href: '/user-administration', icon: 'solar:users-group-rounded-bold-duotone' },
  { name: 'Tariff Management', href: '/tariff-management', icon: 'solar:bill-list-bold-duotone' },
  { name: 'SMS Management', href: '/sms-management', icon: 'solar:chat-round-bold-duotone' },
  { name: 'SMS Logs', href: '/sms-logs', icon: 'solar:document-text-bold-duotone' },
  { name: 'Analytics & Reports', href: '/analytics', icon: 'solar:graph-bold-duotone' },
  { name: 'Patient Data', href: '/patient-data', icon: 'solar:user-heart-bold-duotone' },
  { name: 'Appointments', href: '/appointments', icon: 'solar:calendar-bold-duotone' },
  { name: 'Billing & Finance', href: '/billing-finance', icon: 'solar:card-bold-duotone' },
  { name: 'Support Center', href: '/support-center', icon: 'solar:help-bold-duotone' },
  { name: 'System Logs', href: '/system-logs', icon: 'solar:server-bold-duotone' },
  { name: 'Database', href: '/database', icon: 'solar:database-bold-duotone' },
  { name: 'System Blueprint', href: '/system-blueprint', icon: 'solar:document-bold-duotone', badge: 'NEW' },
  { name: 'Notifications', href: '/notifications', icon: 'solar:bell-bold-duotone' },
  { name: 'Security', href: '/security', icon: 'solar:shield-check-bold-duotone' },
  { name: 'Settings', href: '/settings', icon: 'solar:settings-bold-duotone' },
]

export function Layout({ children }: LayoutProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const location = useLocation()

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className={clsx(
        'bg-white shadow-lg transition-all duration-300 flex-shrink-0',
        isSidebarOpen ? 'w-64' : 'w-16'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-200">
          <div className={clsx('flex items-center', !isSidebarOpen && 'justify-center w-full')}>
            <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center">
              <Icon icon="solar:health-bold-duotone" className="w-5 h-5 text-white" />
            </div>
            {isSidebarOpen && (
              <div className="ml-3">
                <h1 className="text-lg font-heading font-semibold text-gray-900">OneHealth</h1>
                <p className="text-xs text-gray-500">Admin Portal</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Icon icon="solar:hamburger-menu-bold-duotone" className="w-5 h-5 text-gray-600" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || (item.href === '/dashboard' && location.pathname === '/')

            return (
              <Link
                key={item.name}
                to={item.href}
                className={clsx(
                  'sidebar-item group relative',
                  isActive && 'active',
                  !isSidebarOpen && 'justify-center px-2'
                )}
                title={!isSidebarOpen ? item.name : undefined}
              >
                <Icon icon={item.icon} className="w-5 h-5 flex-shrink-0" />
                {isSidebarOpen && (
                  <>
                    <span className="ml-3 text-sm font-medium">{item.name}</span>
                    {item.badge && (
                      <span className="ml-auto inline-block px-2 py-0.5 text-xs font-medium bg-brand-100 text-brand-800 rounded-full">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {!isSidebarOpen && item.badge && (
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-brand-500 rounded-full"></div>
                )}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4">
          <div className={clsx('flex items-center', !isSidebarOpen && 'justify-center')}>
            <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
              <Icon icon="solar:user-bold-duotone" className="w-4 h-4 text-gray-600" />
            </div>
            {isSidebarOpen && (
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-900">Dr. Hilma Amalwa</p>
                <p className="text-xs text-gray-500">admin@newcharmdentalpractice.com</p>
              </div>
            )}
          </div>
          {isSidebarOpen && (
            <div className="mt-3 text-xs text-center text-gray-400">
              OneHealth Admin v1.0.0
            </div>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-heading font-semibold text-gray-900">
                Welcome back, Dr. Hilma!
              </h2>
              <p className="text-sm text-gray-600">
                Here's what's happening at New Charm Dental Practice today.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search practices, users, or data..."
                  className="w-80 px-4 py-2 pl-10 pr-4 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent"
                />
                <Icon icon="solar:magnifier-bold-duotone" className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              </div>
              <button className="p-2 text-gray-400 hover:text-gray-600 relative">
                <Icon icon="solar:bell-bold-duotone" className="w-6 h-6" />
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}