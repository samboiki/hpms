'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  Building2, 
  Users, 
  MessageSquare, 
  DollarSign, 
  FileText, 
  Settings, 
  Shield, 
  TrendingUp,
  Stethoscope,
  Calendar,
  CreditCard,
  HeadphonesIcon,
  Database,
  Bell,
  FileCode2
} from 'lucide-react'

interface NavItem {
  name: string
  href: string
  icon: any
  description: string
  badge?: string
}

const navigation: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    description: 'Overview and system metrics'
  },
  {
    name: 'Practice Management',
    href: '/dashboard/practices',
    icon: Building2,
    description: 'Manage all practices'
  },
  {
    name: 'User Administration',
    href: '/dashboard/users',
    icon: Users,
    description: 'System-wide user management'
  },
  {
    name: 'Tariff Management',
    href: '/dashboard/tariffs',
    icon: DollarSign,
    description: 'Pricing and service codes'
  },
  {
    name: 'SMS Management',
    href: '/dashboard/sms',
    icon: MessageSquare,
    description: 'SMS allocation and monitoring'
  },
  {
    name: 'SMS Logs',
    href: '/dashboard/sms-logs',
    icon: FileText,
    description: 'SMS history and delivery tracking'
  },
  {
    name: 'Analytics & Reports',
    href: '/dashboard/analytics',
    icon: TrendingUp,
    description: 'Performance analytics'
  },
  {
    name: 'Patient Data',
    href: '/dashboard/patients',
    icon: Stethoscope,
    description: 'Cross-practice patient insights'
  },
  {
    name: 'Appointments',
    href: '/dashboard/appointments',
    icon: Calendar,
    description: 'System-wide appointment monitoring'
  },
  {
    name: 'Billing & Finance',
    href: '/dashboard/billing',
    icon: CreditCard,
    description: 'Financial oversight'
  },
  {
    name: 'Support Center',
    href: '/dashboard/support',
    icon: HeadphonesIcon,
    description: 'Help desk and tickets'
  },
  {
    name: 'System Logs',
    href: '/dashboard/logs',
    icon: FileText,
    description: 'Audit trails and activity'
  },
  {
    name: 'Database',
    href: '/dashboard/database',
    icon: Database,
    description: 'Database management'
  },
  {
    name: 'System Blueprint',
    href: '/dashboard/blueprint',
    icon: FileCode2,
    description: 'Technical documentation',
    badge: 'NEW'
  },
  {
    name: 'Notifications',
    href: '/dashboard/notifications',
    icon: Bell,
    description: 'System alerts'
  },
  {
    name: 'Security',
    href: '/dashboard/security',
    icon: Shield,
    description: 'Security and compliance'
  },
  {
    name: 'Settings',
    href: '/dashboard/settings',
    icon: Settings,
    description: 'System configuration'
  }
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-white border-r border-gray-200">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-onehealth-500 to-onehealth-600 flex items-center justify-center">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-poppins font-semibold text-gray-900">OneHealth</h1>
            <p className="text-xs font-montserrat text-gray-500">Admin Portal</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'group flex items-center px-3 py-2.5 text-sm font-montserrat rounded-lg transition-all duration-200',
                isActive
                  ? 'bg-onehealth-50 text-onehealth-700 border-l-4 border-onehealth-500'
                  : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
              )}
            >
              <item.icon
                className={cn(
                  'mr-3 h-5 w-5 flex-shrink-0 transition-colors',
                  isActive
                    ? 'text-onehealth-600'
                    : 'text-gray-400 group-hover:text-gray-600'
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'font-medium truncate',
                    isActive ? 'text-onehealth-700' : 'text-gray-900'
                  )}>
                    {item.name}
                  </div>
                  {item.badge && (
                    <span className="inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full bg-gradient-to-r from-purple-500 to-blue-600 text-white">
                      {item.badge}
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 truncate mt-0.5">
                  {item.description}
                </div>
              </div>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-gray-200 p-4">
        <div className="text-xs font-montserrat text-gray-500 text-center">
          OneHealth Admin v1.0.0
        </div>
      </div>
    </div>
  )
}