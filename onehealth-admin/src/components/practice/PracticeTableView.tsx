import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import type { Practice } from '../../types/practice.types';

interface PracticeTableViewProps {
  practices: Practice[];
  onViewPractice: (practice: Practice) => void;
  loading?: boolean;
}

export const PracticeTableView: React.FC<PracticeTableViewProps> = ({
  practices,
  onViewPractice,
  loading = false,
}) => {
  const [sortField, setSortField] = useState<'name' | 'status' | 'created_at'>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  const getStatusColor = (status: string) => {
    const colors = {
      lead: 'bg-gray-100 text-gray-800',
      contacted: 'bg-blue-100 text-blue-800',
      qualified: 'bg-purple-100 text-purple-800',
      onboarding: 'bg-yellow-100 text-yellow-800',
      active: 'bg-green-100 text-green-800',
      inactive: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || colors.lead;
  };

  const handleSort = (field: 'name' | 'status' | 'created_at') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedPractices = [...practices].sort((a, b) => {
    let compareValue = 0;

    if (sortField === 'name') {
      compareValue = a.name.localeCompare(b.name);
    } else if (sortField === 'status') {
      compareValue = a.status.localeCompare(b.status);
    } else if (sortField === 'created_at') {
      compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    }

    return sortOrder === 'asc' ? compareValue : -compareValue;
  });

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="animate-pulse p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex gap-4">
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded flex-1"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('name')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Practice Name
                  <Icon
                    icon={sortField === 'name' && sortOrder === 'desc' ? 'solar:sort-vertical-bold-duotone' : 'solar:sort-vertical-bold-duotone'}
                    className={`w-4 h-4 ${sortField === 'name' ? 'text-purple-600' : 'text-gray-400'}`}
                  />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </span>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('status')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Status
                  <Icon
                    icon="solar:sort-vertical-bold-duotone"
                    className={`w-4 h-4 ${sortField === 'status' ? 'text-purple-600' : 'text-gray-400'}`}
                  />
                </button>
              </th>
              <th className="px-6 py-3 text-left">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Contact
                </span>
              </th>
              <th className="px-6 py-3 text-left">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Location
                </span>
              </th>
              <th className="px-6 py-3 text-left">
                <button
                  onClick={() => handleSort('created_at')}
                  className="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                  Registered
                  <Icon
                    icon="solar:sort-vertical-bold-duotone"
                    className={`w-4 h-4 ${sortField === 'created_at' ? 'text-purple-600' : 'text-gray-400'}`}
                  />
                </button>
              </th>
              <th className="px-6 py-3 text-right">
                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {sortedPractices.map((practice, index) => (
              <motion.tr
                key={practice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => onViewPractice(practice)}
                className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg">
                      <Icon icon="solar:buildings-3-bold-duotone" className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-white">{practice.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                        {practice.subscription_tier}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">
                    {practice.practice_type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(practice.status)}`}>
                    {practice.status.charAt(0).toUpperCase() + practice.status.slice(1)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Icon icon="solar:letter-bold-duotone" className="w-4 h-4 text-gray-400" />
                      {practice.email}
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                      <Icon icon="solar:phone-bold-duotone" className="w-4 h-4 text-gray-400" />
                      {practice.phone}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Icon icon="solar:map-point-bold-duotone" className="w-4 h-4 text-gray-400" />
                    <span>{practice.city}, {practice.country}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-600 dark:text-gray-300">
                    {new Date(practice.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewPractice(practice);
                      }}
                      className="p-2 text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="View Details"
                    >
                      <Icon icon="solar:eye-bold-duotone" className="w-4 h-4" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        // Edit handler
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                      title="Edit Practice"
                    >
                      <Icon icon="solar:pen-bold-duotone" className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      {practices.length === 0 && (
        <div className="text-center py-12">
          <Icon icon="solar:buildings-3-bold-duotone" className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No practices found</h3>
          <p className="text-gray-500 dark:text-gray-400">Try adjusting your filters</p>
        </div>
      )}
    </div>
  );
};
