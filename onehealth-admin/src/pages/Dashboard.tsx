import { useEffect, useState, useMemo } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { useAdminMetrics } from '../hooks/useAdminMetrics';

// Stat Card Component - Compact Version (EXACT from master-facility-list)
const StatCard = ({ icon, value, label, trend, color, delay }: any) => {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value);
    const duration = 1500;
    const increment = end / 60;

    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setDisplayValue(end);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(start));
      }
    }, duration / 60);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-700 transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className={`w-10 h-10 ${color} bg-opacity-10 dark:bg-opacity-20 rounded-lg flex items-center justify-center`}>
          <Icon icon={icon} className={`text-xl ${color.replace('bg-', 'text-')}`} />
        </div>
        {trend && (
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
            trend > 0 ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
          }`}>
            {trend > 0 ? '+' : ''}{trend}%
          </span>
        )}
      </div>
      <div>
        <div className="text-2xl font-bold text-gray-900 dark:text-white">{displayValue.toLocaleString()}</div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{label}</div>
      </div>
    </motion.div>
  );
};

// Practice Type Item (EXACT from master-facility-list)
const PracticeTypeItem = ({ label, value, percentage, color, index }: any) => (
  <motion.div
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: index * 0.05 }}
    className="flex items-center gap-3 p-3"
  >
    <div className={`w-2 h-8 ${color} rounded`} />
    <div className="flex-1">
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-900 dark:text-white">{label}</span>
        <span className="text-sm font-bold text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className={`h-full ${color}`}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.05 }}
        />
      </div>
    </div>
    <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-10 text-right">{percentage}%</span>
  </motion.div>
);

// Region Comparison - Compact (EXACT from master-facility-list)
const RegionItem = ({ region, value, total, index }: any) => {
  const percentage = Math.round((value / total) * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: index * 0.05 }}
      className="p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors"
    >
      <div className="flex justify-between items-center mb-1.5">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{region}</span>
        <span className="text-xs font-bold text-gray-900 dark:text-white">{value}</span>
      </div>
      <div className="flex gap-1">
        <motion.div
          className="h-5 bg-purple-600 rounded flex items-center justify-center text-white text-xs font-medium"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          {percentage > 12 && `${percentage}%`}
        </motion.div>
        <div className="h-5 bg-gray-100 dark:bg-gray-700 rounded flex-1" />
      </div>
    </motion.div>
  );
};

// Activity Item Component - Compact (EXACT from master-facility-list)
const ActivityItem = ({ activity, index }: any) => {
  const getActivityIcon = (type: string) => {
    switch (type) {
      case 'practice_added': return 'solar:buildings-3-bold-duotone';
      case 'practice_updated': return 'solar:pen-bold-duotone';
      case 'request_approved': return 'solar:check-circle-bold-duotone';
      case 'request_rejected': return 'solar:close-circle-bold-duotone';
      case 'user_added': return 'solar:user-plus-bold-duotone';
      case 'system_update': return 'solar:settings-bold-duotone';
      default: return 'solar:bell-bold-duotone';
    }
  };

  const getActivityColor = (type: string) => {
    switch (type) {
      case 'practice_added': return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400';
      case 'practice_updated': return 'bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400';
      case 'request_approved': return 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400';
      case 'request_rejected': return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400';
      case 'user_added': return 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400';
      case 'system_update': return 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400';
      default: return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffInMinutes = Math.floor((now.getTime() - time.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h`;
    return `${Math.floor(diffInMinutes / 1440)}d`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg transition-colors cursor-pointer"
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${getActivityColor(activity.type)}`}>
        <Icon icon={getActivityIcon(activity.type)} className="text-sm" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-900 dark:text-white font-medium truncate">{activity.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{getTimeAgo(activity.timestamp)}</p>
      </div>
    </motion.div>
  );
};

// Dot Matrix Visualization (EXACT from master-facility-list)
const DotMatrix = ({ data, total }: { data: [string, number][]; total: number }) => {
  const colors = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b'];

  return (
    <div className="grid grid-cols-10 gap-1.5">
      {[...Array(100)].map((_, i) => {
        let cumulative = 0;
        let dotColor = '#f3f4f6';

        for (let j = 0; j < data.length; j++) {
          const [, count] = data[j];
          cumulative += (count as number / total) * 100;
          if (i < cumulative) {
            dotColor = colors[j % colors.length];
            break;
          }
        }

        return (
          <motion.div
            key={i}
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: dotColor }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: i * 0.005, duration: 0.2 }}
            whileHover={{ scale: 1.5 }}
          />
        );
      })}
    </div>
  );
};

// Comparison Bar (EXACT from master-facility-list)
const ComparisonBar = ({ label1, value1, label2, value2, index }: any) => {
  const total = value1 + value2;
  const percent1 = (value1 / total) * 100;
  const percent2 = (value2 / total) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1 }}
      className="space-y-1.5"
    >
      <div className="flex justify-between text-xs">
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label1}</span>
        <span className="font-semibold text-gray-700 dark:text-gray-300">{label2}</span>
      </div>
      <div className="flex gap-1">
        <motion.div
          className="h-6 bg-purple-600 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          initial={{ width: 0 }}
          animate={{ width: `${percent1}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {percent1 > 15 && value1}
        </motion.div>
        <motion.div
          className="h-6 bg-blue-400 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          initial={{ width: 0 }}
          animate={{ width: `${percent2}%` }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          {percent2 > 15 && value2}
        </motion.div>
      </div>
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>{percent1.toFixed(1)}%</span>
        <span>{percent2.toFixed(1)}%</span>
      </div>
    </motion.div>
  );
};

export default function Dashboard() {
  const { metrics, topPractices } = useAdminMetrics();

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [recentActivities] = useState([
    {
      id: 1,
      type: 'practice_added',
      title: 'New Practice Registered',
      description: 'HealthCare Plus joined the platform',
      user: 'Dr. Sarah Johnson',
      timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    },
    {
      id: 2,
      type: 'request_approved',
      title: 'Access Request Approved',
      description: 'John Smith granted practice manager access',
      user: 'System Admin',
      timestamp: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
    },
    {
      id: 3,
      type: 'practice_updated',
      title: 'Practice Information Updated',
      description: 'Contact details updated for City Medical Centre',
      user: 'Mary Williams',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    },
    {
      id: 4,
      type: 'user_added',
      title: 'New User Added',
      description: 'Peter Brown added as Regional Coordinator',
      user: 'System Admin',
      timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    },
  ]);

  // Mock data for practice types
  const practiceTypes = useMemo(() => {
    const types: Record<string, number> = {};
    topPractices.forEach(practice => {
      const type = practice.practice_type || 'Unknown';
      types[type] = (types[type] || 0) + 1;
    });
    return Object.entries(types).sort(([, a], [, b]) => (b as number) - (a as number));
  }, [topPractices]);

  // Mock regions
  const regions = [
    ['Gauteng', 45],
    ['Western Cape', 32],
    ['KwaZulu-Natal', 24],
    ['Eastern Cape', 12],
    ['Free State', 8]
  ];

  const total = metrics?.totalPractices || 0;
  const approvedCount = metrics?.activePractices || 0;
  const pendingCount = metrics?.pendingApproval || 0;
  const inactiveCount = total - approvedCount - pendingCount;

  const practiceColors = ['bg-purple-500', 'bg-blue-500', 'bg-indigo-500', 'bg-pink-500', 'bg-green-500'];

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="p-4">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
              <Icon icon="solar:widget-5-bold-duotone" className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">Welcome back! Here's your practice management overview</p>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="flex flex-col gap-4 mb-6">
          <div className="hidden lg:flex flex-wrap items-center gap-2">
            {/* Status Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  statusFilter === 'all'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  statusFilter === 'active'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                Active
              </button>
              <button
                onClick={() => setStatusFilter('pending')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  statusFilter === 'pending'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                Pending
              </button>
              <button
                onClick={() => setStatusFilter('inactive')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  statusFilter === 'inactive'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                Inactive
              </button>
            </div>

            {/* Practice Type Filter */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setTypeFilter('all')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  typeFilter === 'all'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                All Types
              </button>
              <button
                onClick={() => setTypeFilter('hospitals')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  typeFilter === 'hospitals'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon icon="solar:hospital-bold-duotone" className="w-4 h-4" />
                Hospitals
              </button>
              <button
                onClick={() => setTypeFilter('clinics')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  typeFilter === 'clinics'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon icon="solar:health-bold-duotone" className="w-4 h-4" />
                Clinics
              </button>
              <button
                onClick={() => setTypeFilter('dental')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-1 ${
                  typeFilter === 'dental'
                    ? 'bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm'
                    : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <Icon icon="solar:shield-check-bold-duotone" className="w-4 h-4" />
                Dental
              </button>
            </div>

            {/* Region Filter */}
            <div className="relative">
              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-4 py-1.5 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm font-medium transition-all text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none pr-8"
              >
                <option value="all">All Regions</option>
                <option value="gauteng">Gauteng</option>
                <option value="western-cape">Western Cape</option>
                <option value="kwazulu-natal">KwaZulu-Natal</option>
              </select>
              <Icon icon="solar:alt-arrow-down-linear" className="w-3 h-3 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-600 dark:text-gray-400" />
            </div>

            <div className="ml-auto flex items-center gap-4 text-sm">
              {(statusFilter !== 'all' || typeFilter !== 'all' || regionFilter !== 'all' || searchQuery) && (
                <button
                  onClick={() => {
                    setStatusFilter('all');
                    setTypeFilter('all');
                    setRegionFilter('all');
                    setSearchQuery('');
                  }}
                  className="px-3 py-1 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors flex items-center gap-1 font-medium"
                >
                  <Icon icon="solar:close-circle-bold" className="w-4 h-4" />
                  Clear Filters
                </button>
              )}
              <div className="text-gray-500 dark:text-gray-400">
                <span className="font-semibold text-gray-900 dark:text-white">{total}</span> results
              </div>
            </div>
          </div>

          {/* Search Bar with Shimmer Effect - EXACT from master-facility-list */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500 group-hover:duration-200"></div>
              <div className="relative bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden transition-colors duration-300 group-hover:bg-gray-100 dark:group-hover:bg-gray-700">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 z-10 pointer-events-none">
                  <Icon icon="solar:magnifer-linear" className="w-5 h-5 transition-colors duration-300 text-gray-600 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300" />
                </div>
                <input
                  type="text"
                  placeholder="Search practices, regions, or contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="relative w-full pl-12 pr-4 py-3.5 bg-transparent text-base text-gray-800 dark:text-gray-200 placeholder-gray-600 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-500 dark:focus:placeholder-gray-500 transition-colors duration-300"
                />
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/30 dark:via-white/10 to-transparent pointer-events-none"></div>
              </div>
            </div>
            <button className="relative group" title="Clear filters">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl opacity-0 group-hover:opacity-75 blur transition duration-500"></div>
              <div
                onClick={() => {
                  setStatusFilter('all');
                  setTypeFilter('all');
                  setRegionFilter('all');
                  setSearchQuery('');
                }}
                className="relative px-4 py-3.5 rounded-xl transition-all bg-gray-200 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-gray-700 dark:text-gray-300" />
              </div>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard
            icon="solar:buildings-3-bold-duotone"
            value={total}
            label={statusFilter === 'all' && typeFilter === 'all' && regionFilter === 'all' && !searchQuery ? 'Total Practices' : 'Filtered Results'}
            trend={null}
            color="bg-purple-500"
            delay={0}
          />
          <StatCard
            icon="solar:check-circle-bold-duotone"
            value={approvedCount}
            label="Active Practices"
            trend={12}
            color="bg-green-500"
            delay={0.1}
          />
          <StatCard
            icon="solar:file-text-bold-duotone"
            value={pendingCount}
            label="Pending Review"
            trend={null}
            color="bg-yellow-500"
            delay={0.2}
          />
          <StatCard
            icon="solar:close-circle-bold-duotone"
            value={inactiveCount}
            label="Inactive"
            trend={null}
            color="bg-gray-500"
            delay={0.3}
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Practice Distribution */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Practice Types</h3>
              <button className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300">View All</button>
            </div>
            <div className="space-y-1">
              {practiceTypes.slice(0, 5).map(([label, value], i) => (
                <PracticeTypeItem
                  key={label}
                  label={label}
                  value={value}
                  percentage={Math.round(((value as number) / total) * 100)}
                  color={practiceColors[i % practiceColors.length]}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Dot Matrix Visualization */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Distribution Map</h3>
              <Icon icon="solar:widget-4-bold-duotone" className="text-lg text-purple-600 dark:text-purple-400" />
            </div>
            <DotMatrix data={practiceTypes.slice(0, 4) as [string, number][]} total={total} />
            <div className="grid grid-cols-2 gap-2 mt-3">
              {practiceTypes.slice(0, 4).map(([type], i) => {
                const colors = ['bg-purple-600', 'bg-blue-400', 'bg-green-400', 'bg-orange-400'];
                return (
                  <div key={type} className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${colors[i]}`} />
                    <span className="text-xs text-gray-600 dark:text-gray-400 truncate">{type}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Regional Comparison */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Top Regions</h3>
              <Icon icon="solar:chart-2-bold-duotone" className="text-lg text-purple-600 dark:text-purple-400" />
            </div>
            <div className="space-y-2.5">
              {regions.slice(0, 3).map(([region, count], i) => (
                <ComparisonBar
                  key={region}
                  label1={region as string}
                  value1={count}
                  label2="Others"
                  value2={total - (count as number)}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Recent Activity</h3>
              <button className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold">
                View All
              </button>
            </div>
            <div className="space-y-1.5">
              {recentActivities.map((activity, index) => (
                <ActivityItem key={activity.id} activity={activity} index={index} />
              ))}
            </div>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Regional Overview */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Regional Overview</h3>
              <select className="text-xs border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option>Top 5 Regions</option>
                <option>All Regions</option>
              </select>
            </div>
            <div className="space-y-2">
              {regions.map(([region, count], i) => (
                <RegionItem
                  key={region}
                  region={region}
                  value={count}
                  total={total}
                  index={i}
                />
              ))}
            </div>
          </div>

          {/* Status Breakdown */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Practice Status</h3>
              <Icon icon="solar:pie-chart-bold-duotone" className="text-lg text-purple-600 dark:text-purple-400" />
            </div>
            <div className="space-y-3">
              <ComparisonBar
                label1="Active"
                value1={approvedCount}
                label2="Pending"
                value2={pendingCount}
                index={0}
              />
              <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="text-center">
                  <div className="text-xl font-bold text-green-600 dark:text-green-400">{approvedCount}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Active</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{pendingCount}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Pending</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-gray-600 dark:text-gray-400">{total}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">Total</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <button className="flex items-center gap-2.5 p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-xl transition-colors group border border-purple-100 dark:border-purple-800">
            <div className="w-10 h-10 bg-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:add-square-bold" className="text-lg text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Add Practice</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Register new</p>
            </div>
            <Icon icon="solar:arrow-right-linear" className="text-gray-400 dark:text-gray-500 group-hover:text-purple-600 dark:group-hover:text-purple-400 flex-shrink-0" />
          </button>

          <button className="flex items-center gap-2.5 p-3 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors group border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:document-text-bold" className="text-lg text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Requests</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">{pendingCount} pending</p>
            </div>
            <Icon icon="solar:arrow-right-linear" className="text-gray-400 dark:text-gray-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 flex-shrink-0" />
          </button>

          <button className="flex items-center gap-2.5 p-3 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-xl transition-colors group border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:export-bold" className="text-lg text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Export</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">Download data</p>
            </div>
            <Icon icon="solar:arrow-right-linear" className="text-gray-400 dark:text-gray-500 group-hover:text-green-600 dark:group-hover:text-green-400 flex-shrink-0" />
          </button>

          <button className="flex items-center gap-2.5 p-3 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-xl transition-colors group border border-gray-100 dark:border-gray-700 hover:border-orange-200 dark:hover:border-orange-800">
            <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
              <Icon icon="solar:chart-2-bold" className="text-lg text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Reports</p>
              <p className="text-xs text-gray-600 dark:text-gray-400">View analytics</p>
            </div>
            <Icon icon="solar:arrow-right-linear" className="text-gray-400 dark:text-gray-500 group-hover:text-orange-600 dark:group-hover:text-orange-400 flex-shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}
