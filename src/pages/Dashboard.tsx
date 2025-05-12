import React from 'react';
import { Card } from '../components/ui/Card';
import { Activity, Users, Calendar, DollarSign } from 'lucide-react';

const Dashboard = () => {
  const stats = [
    {
      title: 'Total Patients',
      value: '2,420',
      change: '+20%',
      icon: <Users className="h-4 w-4" />,
    },
    {
      title: 'Appointments Today',
      value: '15',
      change: '+12%',
      icon: <Calendar className="h-4 w-4" />,
    },
    {
      title: 'Active Consultations',
      value: '5',
      change: '+5%',
      icon: <Activity className="h-4 w-4" />,
    },
    {
      title: 'Revenue (Month)',
      value: '$12,500',
      change: '+18%',
      icon: <DollarSign className="h-4 w-4" />,
    },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-6">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        {stats.map((stat, index) => (
          <Card key={index} className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm font-medium text-gray-600">{stat.title}</div>
              <div className="p-2 bg-gray-100 rounded-full">{stat.icon}</div>
            </div>
            <div className="flex items-baseline">
              <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
              <span className="ml-2 text-sm font-medium text-green-600">{stat.change}</span>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Appointments</h2>
          {/* Add appointment list content here */}
        </Card>
        
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>
          {/* Add activity feed content here */}
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;