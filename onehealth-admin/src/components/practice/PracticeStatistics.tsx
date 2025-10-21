import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

interface PracticeStatisticsProps {
  stats: {
    totalPractices: number;
    activePractices: number;
    pendingApproval: number;
    totalBranches: number;
    leadCount?: number;
    contactedCount?: number;
    qualifiedCount?: number;
    onboardingCount?: number;
  } | null;
}

export const PracticeStatistics: React.FC<PracticeStatisticsProps> = ({ stats }) => {
  const displayStats = [
    {
      label: 'Total Practices',
      value: stats?.totalPractices || 0,
      description: 'registered',
      badge: 'TOTAL',
      icon: 'solar:buildings-3-bold-duotone',
      delay: 0.05,
      color: 'from-blue-500 to-blue-600',
    },
    {
      label: 'Active Practices',
      value: stats?.activePractices || 0,
      description: 'operational',
      badge: 'ACTIVE',
      icon: 'solar:shield-check-bold-duotone',
      delay: 0.1,
      color: 'from-green-500 to-green-600',
    },
    {
      label: 'Pending Approval',
      value: stats?.pendingApproval || 0,
      description: 'awaiting review',
      badge: 'PENDING',
      icon: 'solar:clock-circle-bold-duotone',
      delay: 0.15,
      color: 'from-yellow-500 to-yellow-600',
    },
    {
      label: 'Total Branches',
      value: stats?.totalBranches || 0,
      description: 'locations',
      badge: 'BRANCHES',
      icon: 'solar:map-point-bold-duotone',
      delay: 0.2,
      color: 'from-purple-500 to-purple-600',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
      {displayStats.map((stat) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: stat.delay, duration: 0.3 }}
          className="bg-white rounded-xl p-4 border border-gray-200 hover:border-purple-300 transition-all duration-200 group relative overflow-hidden shadow-sm hover:shadow-md"
        >
          <div className={`absolute -right-2 -top-2 opacity-5 group-hover:opacity-10 transition-opacity duration-300`}>
            <Icon icon={stat.icon} className="w-20 h-20 transform rotate-12" />
          </div>
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-2 bg-gradient-to-br ${stat.color} rounded-lg`}>
                <Icon icon={stat.icon} className="w-5 h-5 text-white" />
              </div>
              <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full font-medium">
                {stat.badge}
              </div>
            </div>
            <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-gray-900 group-hover:scale-105 transition-transform duration-300">
              {stat.value}
            </p>
            <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
};
