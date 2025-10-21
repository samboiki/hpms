import React, { useMemo } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

const COLORS = {
  primary: '#01b9d5',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  success: '#10b981',
  warning: '#f59e0b',
  info: '#3b82f6',
  danger: '#ef4444',
  teal: '#14b8a6'
};

interface Ward {
  id: string;
  ward_name?: string;
  name?: string;
  ward_type?: string;
  total_beds?: number;
  occupied_beds?: number;
  department_id?: string;
}

interface Department {
  id: string;
  code?: string;
  created_at?: string;
  updated_at?: string;
}

interface DepartmentStatisticsTabProps {
  selectedDepartment: Department;
  wards: Ward[];
  beds?: unknown[];
  practiceStaff: unknown[];
}

const DepartmentStatisticsTab: React.FC<DepartmentStatisticsTabProps> = ({
  selectedDepartment,
  wards,
  practiceStaff,
}) => {
  const departmentWards = wards.filter(w => w.department_id === selectedDepartment?.id);
  const totalBeds = departmentWards.reduce((sum, ward) => sum + (ward.total_beds || 0), 0);
  const occupiedBeds = departmentWards.reduce((sum, ward) => sum + (ward.occupied_beds || 0), 0);
  const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  const stats = [
    {
      label: 'Total Wards',
      value: departmentWards.length,
      icon: 'solar:hospital-bold-duotone',
      color: 'from-blue-400 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-700'
    },
    {
      label: 'Total Beds',
      value: totalBeds,
      icon: 'solar:bed-bold-duotone',
      color: 'from-purple-400 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-700'
    },
    {
      label: 'Occupied Beds',
      value: occupiedBeds,
      icon: 'solar:user-heart-bold-duotone',
      color: 'from-green-400 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-700'
    },
    {
      label: 'Occupancy Rate',
      value: `${occupancyRate}%`,
      icon: 'solar:chart-bold-duotone',
      color: occupancyRate >= 90 ? 'from-red-400 to-red-600' :
              occupancyRate >= 70 ? 'from-yellow-400 to-yellow-600' :
              'from-green-400 to-green-600',
      bgColor: occupancyRate >= 90 ? 'bg-red-50' :
               occupancyRate >= 70 ? 'bg-yellow-50' :
               'bg-green-50',
      textColor: occupancyRate >= 90 ? 'text-red-700' :
                 occupancyRate >= 70 ? 'text-yellow-700' :
                 'text-green-700'
    },
    {
      label: 'Department Staff',
      value: practiceStaff.length,
      icon: 'solar:users-group-rounded-bold-duotone',
      color: 'from-indigo-400 to-indigo-600',
      bgColor: 'bg-indigo-50',
      textColor: 'text-indigo-700'
    },
    {
      label: 'Available Beds',
      value: totalBeds - occupiedBeds,
      icon: 'solar:check-circle-bold-duotone',
      color: 'from-teal-400 to-teal-600',
      bgColor: 'bg-teal-50',
      textColor: 'text-teal-700'
    }
  ];

  const wardStats = departmentWards.map(ward => ({
    name: ward.ward_name || ward.name,
    type: ward.ward_type || 'General',
    totalBeds: ward.total_beds || 0,
    occupiedBeds: ward.occupied_beds || 0,
    occupancyRate: ward.total_beds > 0
      ? Math.round((ward.occupied_beds / ward.total_beds) * 100)
      : 0
  }));

  // Healthcare Analytics Metrics
  const healthcareMetrics = useMemo(() => {
    // Average Length of Stay (ALOS) - simulated data per ward
    const alosData = departmentWards.map(ward => ({
      ward: ward.ward_name || ward.name,
      days: Math.round(3 + Math.random() * 5) // Simulated 3-8 days
    }));

    // Bed Occupancy Ratio over time (last 12 months)
    const borData = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        occupancy: Math.round(60 + Math.random() * 35) // 60-95%
      };
    });

    // Bed Turn Over data per ward
    const btoData = departmentWards.map(ward => ({
      ward: ward.ward_name || ward.name,
      turnover: Number((1.5 + Math.random() * 2).toFixed(1)) // 1.5-3.5 times
    }));

    // Outpatient Visit Rate (last 12 months)
    const visitRateData = Array.from({ length: 12 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (11 - i));
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        visits: Math.round(200 + Math.random() * 300) // 200-500 visits
      };
    });

    // Turn Over Interval (TOI) - days between discharge and next admission
    const toiData = departmentWards.map(ward => ({
      ward: ward.ward_name || ward.name,
      interval: Number((0.5 + Math.random() * 2).toFixed(1)) // 0.5-2.5 days
    }));

    // Current metrics summary
    const avgLengthOfStay = alosData.length > 0
      ? (alosData.reduce((sum, d) => sum + d.days, 0) / alosData.length).toFixed(1)
      : '0';

    const currentBOR = occupancyRate;

    const avgBedTurnover = btoData.length > 0
      ? (btoData.reduce((sum, d) => sum + d.turnover, 0) / btoData.length).toFixed(1)
      : '0';

    const monthlyVisits = visitRateData.length > 0
      ? visitRateData[visitRateData.length - 1].visits
      : 0;

    const avgTOI = toiData.length > 0
      ? (toiData.reduce((sum, d) => sum + d.interval, 0) / toiData.length).toFixed(1)
      : '0';

    return {
      alosData,
      borData,
      btoData,
      visitRateData,
      toiData,
      summary: {
        avgLengthOfStay,
        currentBOR,
        avgBedTurnover,
        monthlyVisits,
        avgTOI
      }
    };
  }, [departmentWards, occupancyRate]);

  // Custom tooltip
  interface TooltipPayload {
    color: string;
    name: string;
    value: number;
    dataKey: string;
  }

  interface TooltipProps {
    active?: boolean;
    payload?: TooltipPayload[];
    label?: string;
  }

  const CustomTooltip = ({ active, payload, label }: TooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/95 backdrop-blur-sm p-3 rounded-lg shadow-xl border border-gray-200">
          <p className="font-semibold text-gray-800">{label}</p>
          {payload.map((entry: TooltipPayload, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {entry.value}
              {entry.dataKey === 'occupancy' && '%'}
              {entry.dataKey === 'days' && ' days'}
              {entry.dataKey === 'interval' && ' days'}
              {entry.dataKey === 'turnover' && 'x'}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Overview Statistics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Department Overview</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.textColor}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.color}`}>
                  <Icon icon={stat.icon} className="w-5 h-5 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Healthcare Analytics Metrics */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
          <Icon icon="solar:chart-2-bold-duotone" className="w-6 h-6 text-purple-500" />
          Healthcare Analytics Metrics
        </h3>

        {/* Key Metrics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-4 shadow-lg border border-blue-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-blue-400 to-cyan-500 rounded-lg">
                <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-white" />
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.avgLengthOfStay}</h4>
            <p className="text-sm text-gray-600 font-medium">Avg Length of Stay</p>
            <p className="text-xs text-blue-600 mt-1">days</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 shadow-lg border border-purple-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-purple-400 to-pink-500 rounded-lg">
                <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-white" />
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.currentBOR}%</h4>
            <p className="text-sm text-gray-600 font-medium">Bed Occupancy Ratio</p>
            <p className="text-xs text-purple-600 mt-1">current</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-4 shadow-lg border border-green-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-green-400 to-emerald-500 rounded-lg">
                <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-white" />
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.avgBedTurnover}x</h4>
            <p className="text-sm text-gray-600 font-medium">Bed Turnover</p>
            <p className="text-xs text-green-600 mt-1">average</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl p-4 shadow-lg border border-orange-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-orange-400 to-amber-500 rounded-lg">
                <Icon icon="solar:users-group-rounded-bold-duotone" className="w-5 h-5 text-white" />
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.monthlyVisits}</h4>
            <p className="text-sm text-gray-600 font-medium">Outpatient Visits</p>
            <p className="text-xs text-orange-600 mt-1">this month</p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gradient-to-br from-indigo-50 to-violet-50 rounded-xl p-4 shadow-lg border border-indigo-100"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="p-2 bg-gradient-to-br from-indigo-400 to-violet-500 rounded-lg">
                <Icon icon="solar:clock-circle-bold-duotone" className="w-5 h-5 text-white" />
              </div>
            </div>
            <h4 className="text-2xl font-bold text-gray-800">{healthcareMetrics.summary.avgTOI}</h4>
            <p className="text-sm text-gray-600 font-medium">Turnover Interval</p>
            <p className="text-xs text-indigo-600 mt-1">days</p>
          </motion.div>
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Average Length of Stay Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6 }}
            className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
          >
            <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-blue-500 to-cyan-500 rounded-full" />
              Average Length of Stay
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={healthcareMetrics.alosData}>
                <defs>
                  <linearGradient id="colorALOS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.info} stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ward" stroke="#666" />
                <YAxis stroke="#666" label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="days" fill="url(#colorALOS)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bed Occupancy Ratio Trend */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.7 }}
            className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
          >
            <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
              Bed Occupancy Ratio
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={healthcareMetrics.borData}>
                <defs>
                  <linearGradient id="colorBOR" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.secondary} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.accent} stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" label={{ value: 'Occupancy %', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="occupancy"
                  stroke={COLORS.secondary}
                  strokeWidth={2}
                  fill="url(#colorBOR)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Bed Turnover Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.8 }}
            className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
          >
            <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-green-500 to-emerald-500 rounded-full" />
              Bed Turnover Rate
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={healthcareMetrics.btoData}>
                <defs>
                  <linearGradient id="colorBTO" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.teal} stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ward" stroke="#666" />
                <YAxis stroke="#666" label={{ value: 'Times', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="turnover" fill="url(#colorBTO)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Outpatient Visit Rate */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9 }}
            className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
          >
            <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-orange-500 to-amber-500 rounded-full" />
              Outpatient Visit Rate
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={healthcareMetrics.visitRateData}>
                <defs>
                  <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS.warning} stopOpacity={0.8}/>
                    <stop offset="95%" stopColor={COLORS.warning} stopOpacity={0.1}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#666" />
                <YAxis stroke="#666" label={{ value: 'Visits', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke={COLORS.warning}
                  strokeWidth={3}
                  dot={{ fill: COLORS.warning, r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Turnover Interval Chart */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1.0 }}
            className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100"
          >
            <h4 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-gradient-to-b from-indigo-500 to-violet-500 rounded-full" />
              Turnover Interval
            </h4>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={healthcareMetrics.toiData}>
                <defs>
                  <linearGradient id="colorTOI" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.6}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="ward" stroke="#666" />
                <YAxis stroke="#666" label={{ value: 'Days', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="interval" fill="url(#colorTOI)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>
      </div>

      {/* Ward Performance */}
      {wardStats.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Ward Performance</h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ward Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Beds
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occupied
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occupancy
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {wardStats.map((ward, index) => (
                  <motion.tr
                    key={index}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    className="hover:bg-gray-50 transition-colors"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {ward.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 capitalize">
                      {ward.type}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {ward.totalBeds}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-center">
                      {ward.occupiedBeds}
                    </td>
                    <td className="px-4 py-3 text-sm text-center">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                        ward.occupancyRate >= 90
                          ? 'bg-red-100 text-red-800'
                          : ward.occupancyRate >= 70
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {ward.occupancyRate}%
                      </span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Department Information */}
      <div>
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Department Details</h3>
        <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
          <div className="flex items-center gap-3">
            <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">Department Code:</span>
            <span className="text-sm font-medium text-gray-900">{selectedDepartment?.code || 'Not set'}</span>
          </div>
          <div className="flex items-center gap-3">
            <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">Created:</span>
            <span className="text-sm font-medium text-gray-900">
              {selectedDepartment?.created_at
                ? new Date(selectedDepartment.created_at).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Icon icon="solar:refresh-bold-duotone" className="w-5 h-5 text-gray-400" />
            <span className="text-sm text-gray-600">Last Updated:</span>
            <span className="text-sm font-medium text-gray-900">
              {selectedDepartment?.updated_at
                ? new Date(selectedDepartment.updated_at).toLocaleDateString()
                : 'Unknown'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DepartmentStatisticsTab;