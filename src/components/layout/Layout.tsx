import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { cn } from '../../utils/cn';
import { useAuthStore } from '../../stores/authStore';
import { 
  LogOut, 
  Settings, 
  User, 
  Bell, 
  LayoutDashboard,
  Users,
  Microscope,
  Wallet,
  Package2,
  MessageSquare,
  Building2
} from 'lucide-react';
import Button from '../ui/Button';
import AnalogClock from 'react-analog-clock';

const Layout: React.FC = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const { user, logout } = useAuthStore();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Users, label: 'Patients', path: '/patients' },
    { icon: Microscope, label: 'Requests', path: '/requests' },
    { icon: Package2, label: 'Inventory', path: '/inventory' },
    { icon: MessageSquare, label: 'Messages', path: '/messages' },
    { icon: Wallet, label: 'Finance', path: '/finance' },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-16 bg-white border-b border-gray-200 z-50 px-6 flex items-center justify-between">
        <div className="flex items-center">
          <img 
            src="https://images.pexels.com/photos/5412/water-blue-ocean.jpg?auto=compress&cs=tinysrgb&w=100" 
            alt="Practice Logo" 
            className="h-10 w-10 object-cover rounded-lg mr-4"
          />
          <h1 className="text-xl font-bold text-gray-900">HealthCare Practice</h1>
        </div>

        <div className="flex items-center space-x-4">
          <Button variant="ghost" className="relative">
            <Bell size={20} />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </Button>
          <div className="flex items-center">
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.name} 
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-brand-primary/10 rounded-full flex items-center justify-center">
                <User size={16} className="text-brand-primary" />
              </div>
            )}
            <div className="ml-3 text-right">
              <p className="text-sm font-medium text-gray-900">{user?.name}</p>
              <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Sidebar */}
      <div 
        className={cn(
          "fixed left-4 top-20 h-[calc(100vh-5rem)] bg-[#01b9d4] rounded-xl transition-all duration-300 z-30",
          "shadow-[0_8px_30px_rgb(0,0,0,0.08)]",
          sidebarCollapsed ? "w-[72px]" : "w-[240px]"
        )}
      >
        {/* Welcome Card with Clock */}
        <div className="p-4 border-b border-white/10">
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 mb-2">
              <AnalogClock
                size={80}
                hourHandWidth={2}
                minuteHandWidth={2}
                secondHandWidth={1}
                hourMarksWidth={2}
                minuteMarksWidth={1}
                hourHandColor="#ffffff"
                minuteHandColor="#ffffff"
                secondHandColor="#ffffff"
                hourMarksColor="#ffffff"
                minuteMarksColor="#ffffff"
                centerColor="#ffffff"
                backgroundColor="transparent"
              />
            </div>
            {!sidebarCollapsed && (
              <div className="text-center text-white">
                <p className="text-sm font-medium">Welcome back</p>
                <p className="text-xs opacity-80">{new Date().toLocaleDateString()}</p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-2 flex-1">
          {navItems.map((item) => (
            <Button
              key={item.path}
              variant="ghost"
              className={cn(
                "w-full justify-start mb-1 text-white hover:bg-white/10",
                sidebarCollapsed ? "px-3" : "px-4"
              )}
            >
              <item.icon size={20} className={cn("flex-shrink-0", !sidebarCollapsed && "mr-3")} />
              {!sidebarCollapsed && <span>{item.label}</span>}
            </Button>
          ))}
        </nav>

        {/* Settings and Logout */}
        <div className="p-2 border-t border-white/10">
          <Button 
            variant="ghost" 
            className={cn(
              "w-full justify-start mb-1 text-white hover:bg-white/10",
              sidebarCollapsed ? "px-3" : "px-4"
            )}
          >
            <Settings size={20} className={cn("flex-shrink-0", !sidebarCollapsed && "mr-3")} />
            {!sidebarCollapsed && "Settings"}
          </Button>
          <Button 
            variant="ghost" 
            className={cn(
              "w-full justify-start text-white hover:bg-white/10",
              sidebarCollapsed ? "px-3" : "px-4"
            )}
            onClick={() => logout()}
          >
            <LogOut size={20} className={cn("flex-shrink-0", !sidebarCollapsed && "mr-3")} />
            {!sidebarCollapsed && "Logout"}
          </Button>
        </div>
      </div>

      {/* Main content */}
      <main
        className={cn(
          'flex-1 overflow-y-auto bg-gray-50 transition-all duration-300 pt-16',
          sidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]'
        )}
      >
        <div className="p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
};

export default Layout;