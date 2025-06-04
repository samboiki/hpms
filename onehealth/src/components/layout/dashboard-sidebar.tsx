'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'
import {
  Heart,
  LayoutDashboard,
  Building2,
  Users,
  Receipt,
  Settings,
  BarChart3,
  FileText,
  Calendar,
  UserPlus,
  CreditCard,
  Shield,
  X,
  Menu,
} from 'lucide-react'

const navigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['admin', 'practice_manager', 'doctor', 'nurse', 'receptionist'],
  },
  {
    name: 'Practices',
    href: '/dashboard/practices',
    icon: Building2,
    roles: ['admin', 'practice_manager'],
  },
  {
    name: 'Users',
    href: '/dashboard/users',
    icon: Users,
    roles: ['admin', 'practice_manager'],
  },
  {
    name: 'Patients',
    href: '/dashboard/patients',
    icon: UserPlus,
    roles: ['admin', 'practice_manager', 'doctor', 'nurse', 'receptionist'],
  },
  {
    name: 'Appointments',
    href: '/dashboard/appointments',
    icon: Calendar,
    roles: ['admin', 'practice_manager', 'doctor', 'nurse', 'receptionist'],
  },
  {
    name: 'Tariffs',
    href: '/dashboard/tariffs',
    icon: Receipt,
    roles: ['admin', 'practice_manager'],
  },
  {
    name: 'Billing',
    href: '/dashboard/billing',
    icon: CreditCard,
    roles: ['admin', 'practice_manager', 'receptionist'],
  },
  {
    name: 'Analytics',
    href: '/dashboard/analytics',
    icon: BarChart3,
    roles: ['admin', 'practice_manager'],
  },
  {
    name: 'Reports',
    href: '/dashboard/reports',
    icon: FileText,
    roles: ['admin', 'practice_manager'],
  },
  {
    name: 'Audit Logs',
    href: '/dashboard/audit-logs',
    icon: Shield,
    roles: ['admin'],
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    roles: ['admin', 'practice_manager'],
  },
]

export function DashboardSidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const pathname = usePathname()
  const { profile, currentPractice } = useAuth()

  const filteredNavigation = navigation.filter(item => 
    profile?.role && item.roles.includes(profile.role)
  )

  const SidebarContent = () => (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-16 shrink-0 items-center px-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-br from-onehealth-500 to-onehealth-600 rounded-lg flex items-center justify-center">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gradient">OneHealth</span>
        </div>
      </div>

      {/* Current Practice */}
      {currentPractice && (
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider">
            Current Practice
          </div>
          <div className="text-sm font-medium text-gray-900 truncate">
            {currentPractice.name}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-2 py-4">
        {filteredNavigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors',
                isActive
                  ? 'bg-onehealth-100 text-onehealth-900'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0',
                  isActive ? 'text-onehealth-600' : 'text-gray-400 group-hover:text-gray-500'
                )}
              />
              {item.name}
            </Link>
          )
        })}
      </nav>

      {/* User info */}
      <div className="flex-shrink-0 border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-onehealth-100 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-onehealth-700">
              {profile?.first_name?.charAt(0)}{profile?.last_name?.charAt(0)}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {profile?.display_name || `${profile?.first_name} ${profile?.last_name}`}
            </p>
            <p className="text-xs text-gray-500 truncate capitalize">
              {profile?.role?.replace('_', ' ')}
            </p>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile sidebar */}
      <div className={cn(
        'fixed inset-0 flex z-50 lg:hidden',
        isMobileOpen ? 'block' : 'hidden'
      )}>
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75" />
        <div className="relative flex w-full max-w-xs flex-1 flex-col bg-white">
          <div className="absolute top-0 right-0 -mr-12 pt-2">
            <button
              type="button"
              className="ml-1 flex h-10 w-10 items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-6 w-6 text-white" />
            </button>
          </div>
          <SidebarContent />
        </div>
        <div className="w-14 flex-shrink-0" />
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-0 flex-1 flex-col border-r border-gray-200 bg-white">
          <SidebarContent />
        </div>
      </div>

      {/* Mobile menu button */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 bg-white px-4 py-4 shadow-sm sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-gray-700 lg:hidden"
          onClick={() => setIsMobileOpen(true)}
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-gray-900">
          OneHealth
        </div>
      </div>
    </>
  )
}