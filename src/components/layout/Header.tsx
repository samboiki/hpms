import React from 'react';
import { Bell, Search } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';

const Header: React.FC = () => {
  const { user } = useAuthStore();

  return (
    <header className="h-16 bg-white border-b border-gray-100 px-6 flex items-center justify-between">
      <div className="flex items-center flex-1 max-w-xl">
        <div className="relative w-full">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search patients, appointments..."
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:border-brand-blue focus:ring-1 focus:ring-brand-blue"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <button className="relative p-2 text-gray-600 hover:bg-gray-50 rounded-lg">
          <Bell size={20} strokeWidth={1.5} />
          <span className="absolute top-2 right-2 w-2 h-2 bg-brand-red rounded-full" />
        </button>

        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {user?.name}
            </div>
            <div className="text-xs text-gray-500">
              {user?.role}
            </div>
          </div>
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
        </div>
      </div>
    </header>
  );
};

export default Header;