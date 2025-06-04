'use client'

import { useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { Button } from '@/components/ui/button'
import {
  ChevronDown,
  Bell,
  Search,
  Settings,
  User,
  LogOut,
  Building2,
  Check,
} from 'lucide-react'

export function DashboardHeader() {
  const { profile, currentPractice, practices, switchPractice, signOut } = useAuth()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showPracticeMenu, setShowPracticeMenu] = useState(false)

  const handleSignOut = async () => {
    await signOut()
    setShowUserMenu(false)
  }

  const handlePracticeSwitch = (practiceId: string) => {
    switchPractice(practiceId)
    setShowPracticeMenu(false)
  }

  return (
    <div className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Search */}
      <div className="flex flex-1 gap-x-4 self-stretch lg:gap-x-6">
        <div className="relative flex flex-1 items-center">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            className="block h-full w-full border-0 py-0 pl-10 pr-0 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm"
            placeholder="Search patients, appointments..."
            type="search"
          />
        </div>
      </div>

      <div className="flex items-center gap-x-4 lg:gap-x-6">
        {/* Practice Selector */}
        {practices.length > 1 && (
          <div className="relative">
            <button
              type="button"
              className="flex items-center gap-x-1.5 rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 hover:bg-gray-50"
              onClick={() => setShowPracticeMenu(!showPracticeMenu)}
            >
              <Building2 className="h-4 w-4 text-gray-400" />
              <span className="hidden lg:block">{currentPractice?.name}</span>
              <ChevronDown className="h-4 w-4 text-gray-400" />
            </button>

            {showPracticeMenu && (
              <div className="absolute right-0 z-10 mt-2 w-56 origin-top-right rounded-md bg-white shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                <div className="py-1">
                  {practices.map((practice) => (
                    <button
                      key={practice.id}
                      onClick={() => handlePracticeSwitch(practice.id)}
                      className="flex w-full items-center justify-between px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                    >
                      <span>{practice.name}</span>
                      {currentPractice?.id === practice.id && (
                        <Check className="h-4 w-4 text-onehealth-600" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Notifications */}
        <button
          type="button"
          className="relative rounded-full bg-white p-1.5 text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-onehealth-500 focus:ring-offset-2"
        >
          <Bell className="h-6 w-6" />
          {/* Notification badge */}
          <span className="absolute -top-1 -right-1 block h-4 w-4 rounded-full bg-red-400 text-xs text-white text-center leading-4">
            3
          </span>
        </button>

        {/* Profile dropdown */}
        <div className="relative">
          <button
            type="button"
            className="flex items-center gap-x-1.5 rounded-full bg-white text-sm focus:outline-none focus:ring-2 focus:ring-onehealth-500 focus:ring-offset-2"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="h-8 w-8 rounded-full bg-onehealth-100 flex items-center justify-center">
              <span className="text-sm font-medium text-onehealth-700">
                {profile?.first_name?.charAt(0)}{profile?.last_name?.charAt(0)}
              </span>
            </div>
            <span className="hidden lg:flex lg:items-center">
              <span className="ml-2 text-sm font-semibold leading-6 text-gray-900">
                {profile?.display_name || `${profile?.first_name} ${profile?.last_name}`}
              </span>
              <ChevronDown className="ml-2 h-5 w-5 text-gray-400" />
            </span>
          </button>

          {showUserMenu && (
            <div className="absolute right-0 z-10 mt-2.5 w-48 origin-top-right rounded-md bg-white py-2 shadow-lg ring-1 ring-gray-900/5 focus:outline-none">
              <div className="px-3 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.display_name || `${profile?.first_name} ${profile?.last_name}`}
                </p>
                <p className="text-xs text-gray-500 capitalize">
                  {profile?.role?.replace('_', ' ')}
                </p>
                <p className="text-xs text-gray-500">{profile?.email}</p>
              </div>
              
              <a
                href="/dashboard/profile"
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <User className="mr-3 h-4 w-4" />
                Your profile
              </a>
              
              <a
                href="/dashboard/settings"
                className="flex items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <Settings className="mr-3 h-4 w-4" />
                Settings
              </a>
              
              <div className="border-t border-gray-100 my-1"></div>
              
              <button
                onClick={handleSignOut}
                className="flex w-full items-center px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                <LogOut className="mr-3 h-4 w-4" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}