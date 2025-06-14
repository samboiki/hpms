import React, { useState, useRef, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, Settings, User } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import PracticeSwitcher from './PracticeSwitcher';

const Header: React.FC = () => {
  const { user, logout, isSuperAdmin, canManagePractices } = useAuthStore();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-end relative z-[100]">
      <div className="flex items-center space-x-4">
        {/* Practice Switcher - only show for super admins or multi-practice users */}
        <PracticeSwitcher />
        
        <button className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
          <Bell size={20} strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-red rounded-full" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            className="flex items-center space-x-3"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="flex items-center">
              {user?.avatar ? (
                <img 
                  src={user.avatar} 
                  alt={user.name} 
                  className="w-9 h-9 rounded-full object-cover"
                />
              ) : (
                <div className="w-9 h-9 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center font-medium">
                  {user?.name.charAt(0)}
                </div>
              )}
              <div className="ml-3 text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.name}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {user?.role}
                </div>
              </div>
              <ChevronDown size={16} className="ml-2 text-gray-500" />
            </div>
          </Button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-[9999] border border-gray-100">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900">{user?.name}</p>
                <p className="text-xs text-gray-500">{user?.email}</p>
              </div>
              
              {/* Super Admin Menu Items */}
              {isSuperAdmin() && (
                <>
                  <button
                    onClick={() => {
                      setIsDropdownOpen(false);
                      navigate('/admin/practices');
                    }}
                    className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
                  >
                    <Settings size={16} className="mr-2" />
                    Manage Practices
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                </>
              )}
              
              <button
                onClick={() => {
                  setIsDropdownOpen(false);
                  navigate('/settings');
                }}
                className="w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center"
              >
                <Settings size={16} className="mr-2" />
                Settings
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <LogOut size={16} className="mr-2" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;