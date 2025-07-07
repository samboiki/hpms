'use client'

import React from 'react'
import { Bell, Search, User, LogOut, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/use-auth'

export function AdminHeader() {
  const { user, signOut } = useAuth()

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Search */}
      <div className="flex items-center space-x-4 flex-1 max-w-md">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Search practices, users, or data..."
            className="pl-10 bg-gray-50 border-gray-200 focus:bg-white font-montserrat"
          />
        </div>
      </div>

      {/* Right section */}
      <div className="flex items-center space-x-4">
        {/* Notifications */}
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
            3
          </span>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-start space-x-2 px-3">
              <div className="h-8 w-8 rounded-full bg-onehealth-100 flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-onehealth-600" />
              </div>
              <div className="text-left hidden sm:block overflow-hidden">
                <div className="text-sm font-poppins font-medium text-gray-900">
                  {user?.user_metadata?.full_name || 'Admin User'}
                </div>
                <div className="text-xs font-montserrat text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>
                  {user?.email}
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-1 overflow-hidden">
                <p className="text-sm font-poppins font-medium leading-none">
                  {user?.user_metadata?.full_name || 'Admin User'}
                </p>
                <p className="text-xs font-montserrat leading-none text-muted-foreground break-words" style={{ wordBreak: 'break-word' }}>
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" />
              <span className="font-montserrat">Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" />
              <span className="font-montserrat">Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="text-red-600">
              <LogOut className="mr-2 h-4 w-4" />
              <span className="font-montserrat">Sign out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}