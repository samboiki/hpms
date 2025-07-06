import React, { useState, useRef, useEffect } from 'react';
import { Icon } from '@iconify/react';
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
        
        <button className="relative p-2 text-transparent bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text hover:bg-gray-50 rounded-lg group">
          <Icon icon="solar:bell-bold-duotone" width={20} height={20} className="text-transparent bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text" />
          <span className="absolute top-2 right-2 w-2 h-2 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-full" />
        </button>

        <div className="relative" ref={dropdownRef}>
          <Button
            variant="ghost"
            className="flex items-center space-x-3"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <div className="flex items-center">
              <div className="relative">
                {user?.avatar ? (
                  <>
                    <div className="absolute inset-0 w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600 -m-0.5"></div>
                    <img 
                      src={user.avatar} 
                      alt={user.name} 
                      className="relative w-8 h-8 rounded-full object-cover ring-2 ring-white"
                    />
                  </>
                ) : (
                  <div className="relative">
                    <div className="absolute inset-0 w-9 h-9 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600"></div>
                    <div className="relative w-8 h-8 rounded-full bg-white flex items-center justify-center font-medium text-transparent bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text m-0.5">
                      {user?.name.charAt(0)}
                    </div>
                  </div>
                )}
              </div>
              <div className="ml-3 text-right">
                <div className="text-sm font-medium text-gray-900">
                  {user?.name}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {user?.role}
                </div>
              </div>
              <Icon icon="solar:alt-arrow-down-bold-duotone" width={16} height={16} className="ml-2 text-transparent bg-gradient-to-r from-purple-500 to-indigo-600 bg-clip-text" />
            </div>
          </Button>

          {isDropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg py-1 z-[9999] border border-gray-100">
              <div className="px-4 py-2 border-b border-gray-100">
                <p className="text-sm font-medium text-gray-900 truncate">{user?.name}</p>
                <p className="text-xs text-gray-500 break-words" style={{ wordBreak: 'break-word' }}>{user?.email}</p>
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
                    <Icon icon="solar:settings-bold-duotone" width={16} height={16} className="mr-2" />
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
                <Icon icon="solar:settings-bold-duotone" width={16} height={16} className="mr-2" />
                Settings
              </button>
              
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center"
              >
                <Icon icon="solar:logout-2-bold-duotone" width={16} height={16} className="mr-2" />
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