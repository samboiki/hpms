import React, { useState } from 'react';
import Icon, { SolarIcons } from '../ui/Icon';
import Button from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { useAuthStore } from '../../stores/authStore';
import { UserDirectory } from './UserManagement/UserDirectory';
import { PayrollManagement } from './UserManagement/PayrollManagement';
import { LeaveManagement } from './UserManagement/LeaveManagement';
import { TimesheetManagement } from './UserManagement/TimesheetManagement';
import { motion } from 'framer-motion';

type TabType = 'directory' | 'payroll' | 'leave' | 'timesheets' | 'reports';

export const ComprehensiveUserManagement: React.FC = () => {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('directory');

  // Check user permissions
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'doctor';
  const canViewPayroll = isAdmin || isManager;
  const canViewReports = isAdmin || isManager;

  const tabs = [
    {
      id: 'directory' as TabType,
      label: 'User Directory',
      icon: SolarIcons.users,
      description: 'Manage staff profiles and assignments',
      color: 'from-blue-500 to-cyan-600',
      visible: true
    },
    {
      id: 'payroll' as TabType,
      label: 'Payroll',
      icon: SolarIcons.wallet,
      description: 'Salaries, payslips, and compensation',
      color: 'from-green-500 to-emerald-600',
      visible: canViewPayroll
    },
    {
      id: 'leave' as TabType,
      label: 'Leave Management',
      icon: SolarIcons.calendar,
      description: 'Leave requests and balances',
      color: 'from-purple-500 to-indigo-600',
      visible: true
    },
    {
      id: 'timesheets' as TabType,
      label: 'Timesheets',
      icon: SolarIcons.clock,
      description: 'Work hours and attendance',
      color: 'from-orange-500 to-red-600',
      visible: true
    },
    {
      id: 'reports' as TabType,
      label: 'Reports & Analytics',
      icon: SolarIcons.chartSquare,
      description: 'HR insights and analytics',
      color: 'from-pink-500 to-rose-600',
      visible: canViewReports
    }
  ];

  const visibleTabs = tabs.filter(tab => tab.visible);
  const activeTabData = tabs.find(tab => tab.id === activeTab);

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <Card className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white border-0 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-sm"></div>
        <CardContent className="p-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-white/20 rounded-2xl backdrop-blur-sm">
                <Icon icon={SolarIcons.userGroup} className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-3xl font-bold">Human Resources Hub</h2>
                <p className="text-purple-100 mt-1">
                  Complete employee lifecycle management
                </p>
              </div>
            </div>
            <div className="hidden lg:flex items-center gap-6">
              <div className="text-right">
                <div className="text-2xl font-bold">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </div>
                <div className="text-purple-100">Current Period</div>
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mt-8">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon icon={SolarIcons.users} className="w-6 h-6 text-purple-200 mb-2" />
              <div className="text-2xl font-bold">--</div>
              <div className="text-sm text-purple-200">Total Employees</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon icon={SolarIcons.checkCircle} className="w-6 h-6 text-green-300 mb-2" />
              <div className="text-2xl font-bold">--</div>
              <div className="text-sm text-purple-200">On Duty Today</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon icon={SolarIcons.plane} className="w-6 h-6 text-yellow-300 mb-2" />
              <div className="text-2xl font-bold">--</div>
              <div className="text-sm text-purple-200">On Leave</div>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
              <Icon icon={SolarIcons.document} className="w-6 h-6 text-blue-300 mb-2" />
              <div className="text-2xl font-bold">--</div>
              <div className="text-sm text-purple-200">Pending Requests</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Navigation Tabs */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-0">
          {visibleTabs.map((tab, index) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative group transition-all duration-300 ${
                  index > 0 ? 'border-l border-gray-200' : ''
                }`}
              >
                <div className={`p-6 ${
                  isActive 
                    ? 'bg-gradient-to-br ' + tab.color + ' text-white shadow-lg' 
                    : 'bg-white hover:bg-gray-50 text-gray-700'
                }`}>
                  <Icon 
                    icon={tab.icon} 
                    className={`w-8 h-8 mx-auto mb-2 ${
                      isActive ? 'text-white' : 'text-gray-600 group-hover:text-gray-900'
                    }`} 
                  />
                  <div className={`font-semibold text-sm ${
                    isActive ? 'text-white' : 'text-gray-900'
                  }`}>
                    {tab.label}
                  </div>
                  <div className={`text-xs mt-1 ${
                    isActive ? 'text-white/80' : 'text-gray-500'
                  }`}>
                    {tab.description}
                  </div>
                </div>
                {isActive && (
                  <motion.div
                    layoutId="activeTabIndicator"
                    className="absolute inset-0 border-2 border-white/30 rounded-lg pointer-events-none"
                    transition={{ type: "spring", duration: 0.5 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content Area */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* Tab Content */}
        {activeTab === 'directory' && <UserDirectory />}
        
        {activeTab === 'payroll' && (
          canViewPayroll ? (
            <PayrollManagement />
          ) : (
            <AccessDenied feature="Payroll Management" />
          )
        )}
        
        {activeTab === 'leave' && <LeaveManagement />}
        
        {activeTab === 'timesheets' && <TimesheetManagement />}
        
        {activeTab === 'reports' && (
          canViewReports ? (
            <ReportsAndAnalytics />
          ) : (
            <AccessDenied feature="Reports & Analytics" />
          )
        )}
      </motion.div>
    </div>
  );
};

// Access Denied Component
const AccessDenied: React.FC<{ feature: string }> = ({ feature }) => (
  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
    <CardContent className="p-12 text-center">
      <div className="p-4 bg-red-100 rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
        <Icon icon={SolarIcons.shieldWarning} className="w-8 h-8 text-red-600" />
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">Access Restricted</h3>
      <p className="text-gray-600 max-w-md mx-auto">
        You don't have permission to access {feature}. This feature is only available to administrators and managers.
      </p>
    </CardContent>
  </Card>
);

// Placeholder for Reports Component
const ReportsAndAnalytics: React.FC = () => (
  <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
    <CardHeader>
      <CardTitle>Reports & Analytics</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[
          { title: 'Payroll Summary', icon: SolarIcons.documentText, color: 'bg-green-100 text-green-600' },
          { title: 'Leave Analysis', icon: SolarIcons.chartPie, color: 'bg-purple-100 text-purple-600' },
          { title: 'Attendance Report', icon: SolarIcons.calendar, color: 'bg-blue-100 text-blue-600' },
          { title: 'Employee Overview', icon: SolarIcons.users, color: 'bg-orange-100 text-orange-600' },
          { title: 'Timesheet Summary', icon: SolarIcons.clock, color: 'bg-pink-100 text-pink-600' },
          { title: 'Audit Trail', icon: SolarIcons.history, color: 'bg-gray-100 text-gray-600' }
        ].map((report) => (
          <div key={report.title} className="group cursor-pointer">
            <div className="bg-gray-50 rounded-lg p-6 hover:shadow-md transition-all duration-200 border border-gray-200">
              <div className={`p-3 ${report.color} rounded-lg w-fit mb-4`}>
                <Icon icon={report.icon} className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{report.title}</h3>
              <p className="text-sm text-gray-600">Generate and export detailed reports</p>
              <Button variant="ghost" size="sm" className="mt-4">
                View Report →
              </Button>
            </div>
          </div>
        ))}
      </div>
    </CardContent>
  </Card>
);