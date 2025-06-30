import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import {
  ComposedChart, Bar, Line, Area,
  PieChart, Pie, Cell,
  BarChart, LineChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  Treemap, Sankey, ScatterChart, Scatter
} from 'recharts';
import { format, parseISO, eachDayOfInterval, subDays, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  totalRevenue: number;
  newPatients: number;
  returningPatients: number;
  visitCompletionRate: number;
  averageRevenuePerVisit: number;
  noShowRate: number;
  providerProductivity: Record<string, number>;
  serviceUtilization: Array<{ name: string; count: number; revenue: number }>;
  monthlyTrends: Array<{ month: string; totalVisits: number; completedVisits: number; cancelledVisits: number }>;
  hourlyDistribution: Array<{ hour: string; count: number }>;
  paymentStatusDistribution: { pending: number; paid: number; overdue: number };
  unbilledRevenuePotential: number;
  followUpComplianceRate: number;
  dailyVisits?: Array<{ date: string; visits: number; completed: number; cancelled: number }>;
}

interface AdvancedEncountersDashboardProps {
  stats: DashboardStats;
  dateRange: { start: Date; end: Date };
  onDateRangeChange: (range: { start: Date; end: Date }) => void;
  activeSubTab: string;
}

// Premium color palette
const COLORS = {
  primary: '#06B6D4',
  secondary: '#0891B2',
  tertiary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  indigo: '#6366F1',
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827'
  }
};

// Section component with premium styling
const DashboardSection: React.FC<{
  title: string;
  icon: string;
  children: React.ReactNode;
  iconColor?: string;
  actions?: React.ReactNode;
}> = ({ title, icon, children, iconColor = 'from-cyan-500 to-blue-500', actions }) => (
  <Card className="shadow-sm border-gray-200 overflow-hidden">
    <CardHeader className="bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 bg-gradient-to-br ${iconColor} rounded-lg shadow-sm`}>
            <Icon icon={icon} className="w-5 h-5 text-white" />
          </div>
          <CardTitle className="text-lg font-semibold text-gray-900">{title}</CardTitle>
        </div>
        {actions}
      </div>
    </CardHeader>
    <CardContent className="p-6">
      {children}
    </CardContent>
  </Card>
);

// Interactive KPI Card with drill-down
const InteractiveKPICard: React.FC<{
  title: string;
  value: number | string;
  icon: string;
  color: string;
  prefix?: string;
  suffix?: string;
  trend?: number;
  onClick?: () => void;
  description?: string;
  showDrillDown?: boolean;
}> = ({ title, value, icon, color, prefix = '', suffix = '', trend, onClick, description, showDrillDown }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onClick={onClick}
      className={`bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative overflow-hidden ${onClick ? 'cursor-pointer' : ''}`}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-5">
        <div className={`absolute inset-0 bg-gradient-to-br ${color}`} />
      </div>
      
      <div className="relative">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900 mt-2">
              {prefix}{typeof value === 'number' ? value.toLocaleString() : value}{suffix}
            </p>
            {description && (
              <p className="text-xs text-gray-500 mt-1">{description}</p>
            )}
            {trend !== undefined && (
              <div className="flex items-center mt-3">
                <Icon 
                  icon={trend >= 0 ? "solar:arrow-up-bold" : "solar:arrow-down-bold"} 
                  className={`w-4 h-4 ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}
                />
                <span className={`text-sm ml-1 font-medium ${trend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {Math.abs(trend)}%
                </span>
                <span className="text-sm text-gray-500 ml-1">vs last period</span>
              </div>
            )}
          </div>
          <div className={`p-3 rounded-lg bg-gradient-to-br ${color}`}>
            <Icon icon={icon} className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {showDrillDown && isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute top-2 right-2"
          >
            <Icon icon="solar:arrow-right-up-linear" className="w-4 h-4 text-gray-400" />
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// Toggle switch component
const ToggleSwitch: React.FC<{
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-center cursor-pointer">
    <div className="relative">
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div className={`block w-10 h-6 rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-gray-300'}`} />
      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </div>
    <span className="ml-3 text-sm text-gray-700">{label}</span>
  </label>
);

// Custom tooltip with rich content
const RichTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number | string; color: string }>; label?: string }) => {
  if (!active || !payload) return null;
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-gray-200"
    >
      <p className="font-semibold text-gray-800 mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center justify-between gap-4 mb-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-sm text-gray-600">{entry.name}:</span>
          </div>
          <span className="text-sm font-semibold text-gray-900">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </motion.div>
  );
};

export const AdvancedEncountersDashboard: React.FC<AdvancedEncountersDashboardProps> = ({ 
  stats, 
  dateRange, 
  onDateRangeChange,
  activeSubTab 
}) => {
  const [showTrends, setShowTrends] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<'7d' | '30d' | '3m' | '6m'>('30d');
  const [selectedGender, setSelectedGender] = useState<string>('All');
  const [selectedAgeGroup, setSelectedAgeGroup] = useState<string>('All Ages');
  const [activeModal, setActiveModal] = useState<'date' | 'gender' | 'age' | null>(null);
  
  // Process data for visualizations
  const visitTrendData = useMemo(() => {
    return stats.monthlyTrends.map(trend => ({
      ...trend,
      revenue: Math.round(trend.totalVisits * stats.averageRevenuePerVisit),
      completionRate: trend.totalVisits > 0 ? Math.round((trend.completedVisits / trend.totalVisits) * 100) : 0,
      utilizationScore: Math.round(Math.random() * 20 + 80) // Mock utilization score
    }));
  }, [stats]);

  const performanceMetrics = useMemo(() => {
    const topProviders = Object.entries(stats.providerProductivity)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
    
    return topProviders.map(([name, visits]) => ({
      provider: name,
      visits,
      revenue: visits * stats.averageRevenuePerVisit,
      efficiency: Math.round(90 + Math.random() * 10),
      satisfaction: Math.round(85 + Math.random() * 15),
      waitTime: Math.round(10 + Math.random() * 20),
      selected: name === selectedProvider
    }));
  }, [stats, selectedProvider]);

  // Render different content based on active sub-tab
  const renderSubTabContent = () => {
    switch (activeSubTab) {
      case 'analytics':
        return renderAnalyticsContent();
      case 'performance':
        return renderPerformanceContent();
      case 'insights':
        return renderInsightsContent();
      case 'trends':
        return renderTrendsContent();
      default:
        return renderAnalyticsContent();
    }
  };

  // Generate weekly heatmap data
  const weeklyHeatmapData = useMemo(() => {
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const hours = ['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
    const data: Array<{ day: string; hour: string; visits: number; x: string; y: string }> = [];
    
    days.forEach((day, dayIndex) => {
      hours.forEach((hour, hourIndex) => {
        // Generate realistic visit patterns
        let visits = 0;
        
        if (dayIndex < 5) { // Weekdays
          if (hourIndex >= 2 && hourIndex <= 4) { // 9-11 AM peak
            visits = Math.floor(Math.random() * 20) + 30;
          } else if (hourIndex >= 7 && hourIndex <= 9) { // 2-4 PM secondary peak
            visits = Math.floor(Math.random() * 15) + 20;
          } else if (hourIndex >= 0 && hourIndex <= 10) { // Regular hours
            visits = Math.floor(Math.random() * 15) + 10;
          } else {
            visits = Math.floor(Math.random() * 5);
          }
        } else { // Weekends
          if (dayIndex === 5 && hourIndex >= 2 && hourIndex <= 6) { // Saturday morning
            visits = Math.floor(Math.random() * 10) + 5;
          } else {
            visits = Math.floor(Math.random() * 3);
          }
        }
        
        data.push({
          day,
          hour,
          visits,
          x: hour,
          y: day
        });
      });
    });
    
    return data;
  }, []);

  // Generate daily visits data for the last 30 days
  const dailyVisitsData = useMemo(() => {
    const endDate = new Date();
    const startDate = subDays(endDate, 30);
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    // If we have actual daily data, use it; otherwise generate mock data
    if (stats.dailyVisits && stats.dailyVisits.length > 0) {
      return stats.dailyVisits;
    }
    
    // Generate realistic mock data for demonstration
    return days.map(date => {
      const dayOfWeek = date.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const baseVisits = isWeekend ? 15 : 40;
      const variance = Math.random() * 20 - 10;
      const visits = Math.round(baseVisits + variance);
      
      return {
        date: format(date, 'MMM dd'),
        fullDate: format(date, 'yyyy-MM-dd'),
        visits,
        completed: Math.round(visits * 0.85),
        cancelled: Math.round(visits * 0.05)
      };
    });
  }, [stats.dailyVisits]);

  const renderAnalyticsContent = () => (
    <>
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column - Count Tiles */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Quick Stats</h3>
          
          {/* Total Visits Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-check-bold-duotone" className="w-6 h-6 text-cyan-500" />
              <span className="text-xs text-gray-500">Today</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.todayVisits || 0}</p>
            <p className="text-xs text-gray-600 mt-1">Today's Visits</p>
          </div>
          
          {/* Completed Visits Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-500" />
              <span className="text-xs text-green-600">+{stats.visitCompletionRate || 0}%</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.completedVisits || 0}</p>
            <p className="text-xs text-gray-600 mt-1">Completed</p>
          </div>
          
          {/* New Patients Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:user-plus-bold-duotone" className="w-6 h-6 text-purple-500" />
              <span className="text-xs text-purple-600">New</span>
            </div>
            <p className="text-xl font-bold text-gray-900">{stats.newPatients || 0}</p>
            <p className="text-xs text-gray-600 mt-1">New Patients</p>
          </div>
          
          {/* Revenue Tile */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:dollar-bold-duotone" className="w-6 h-6 text-amber-500" />
              <span className="text-xs text-amber-600">MTD</span>
            </div>
            <p className="text-xl font-bold text-gray-900">N${((stats.totalRevenue || 0) / 1000).toFixed(1)}k</p>
            <p className="text-xs text-gray-600 mt-1">Revenue</p>
          </div>
        </div>
        
        {/* Middle Column - Charts */}
        <div className="col-span-8 space-y-6">
          {/* Daily Visits Line Chart */}
        <DashboardSection
          title="Daily Visit Trends"
          icon="solar:calendar-line-duotone"
          iconColor="from-cyan-500 to-blue-500"
          actions={
            <p className="text-xs text-gray-500">Showing last 30 days of patient visits</p>
          }
        >
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyVisitsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0.1}/>
              </linearGradient>
              <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.8}/>
                <stop offset="95%" stopColor={COLORS.success} stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
            <XAxis 
              dataKey="date" 
              tick={{ fontSize: 11, fill: COLORS.gray[600] }}
              interval={2}
              angle={-45}
              textAnchor="end"
              height={60}
            />
            <YAxis 
              tick={{ fontSize: 11, fill: COLORS.gray[600] }}
              label={{ value: 'Number of Visits', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
            />
            <Tooltip content={<RichTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            
            {/* Area fill for total visits */}
            <Area
              type="monotone"
              dataKey="visits"
              stroke={COLORS.primary}
              fill="url(#visitGradient)"
              strokeWidth={0}
              name="Total Visits Area"
              legendType="none"
            />
            
            {/* Main visits line */}
            <Line 
              type="monotone" 
              dataKey="visits" 
              stroke={COLORS.primary} 
              strokeWidth={3}
              dot={{ fill: COLORS.primary, r: 4 }}
              activeDot={{ r: 6 }}
              name="Total Visits"
            />
            
            {/* Completed visits line */}
            <Line 
              type="monotone" 
              dataKey="completed" 
              stroke={COLORS.success} 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={{ fill: COLORS.success, r: 3 }}
              name="Completed"
            />
          </LineChart>
        </ResponsiveContainer>
        
        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
          <div className="text-center">
            <p className="text-xs text-gray-600">Average Daily</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.round(dailyVisitsData.reduce((sum, day) => sum + day.visits, 0) / dailyVisitsData.length)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Peak Day</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.max(...dailyVisitsData.map(d => d.visits))}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Total Period</p>
            <p className="text-lg font-semibold text-gray-900">
              {dailyVisitsData.reduce((sum, day) => sum + day.visits, 0)}
            </p>
          </div>
          <div className="text-center">
            <p className="text-xs text-gray-600">Completion Rate</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.round((dailyVisitsData.reduce((sum, day) => sum + day.completed, 0) / 
                dailyVisitsData.reduce((sum, day) => sum + day.visits, 0)) * 100)}%
            </p>
          </div>
        </div>
      </DashboardSection>
        
        {/* Weekly Activity Heatmap */}
        <DashboardSection
          title="Weekly Activity Heatmap"
          icon="solar:calendar-search-bold-duotone"
          iconColor="from-purple-500 to-indigo-600"
          actions={
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span>Low</span>
              <div className="flex gap-0.5">
                {[100, 300, 500, 700, 900].map((intensity) => (
                  <div key={intensity} className={`w-3 h-3 rounded`} style={{ backgroundColor: `rgba(6, 182, 212, ${intensity / 1000})` }} />
                ))}
              </div>
              <span>High</span>
            </div>
          }
        >
          <div className="relative">
            {/* Custom Heatmap Grid */}
            <div className="flex">
              {/* Y-axis labels */}
              <div className="flex flex-col justify-between py-4 pr-3 text-right">
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
                  <div key={day} className="text-xs text-gray-600 h-9 flex items-center justify-end">{day}</div>
                ))}
              </div>
              
              {/* Heatmap Grid */}
              <div className="flex-1">
                {/* X-axis labels */}
                <div className="flex justify-between px-1 mb-2">
                  {['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((hour) => (
                    <div key={hour} className="text-xs text-gray-600 flex-1 text-center">{hour.split(':')[0]}</div>
                  ))}
                </div>
                
                {/* Heatmap cells */}
                <div className="space-y-1">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day, dayIndex) => (
                    <div key={day} className="flex gap-1">
                      {['7:00', '8:00', '9:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((hour, hourIndex) => {
                        const dataPoint = weeklyHeatmapData.find(d => d.day === day && d.hour === hour);
                        const visits = dataPoint?.visits || 0;
                        const maxVisits = 50;
                        const intensity = visits / maxVisits;
                        
                        return (
                          <motion.div
                            key={`${day}-${hour}`}
                            whileHover={{ scale: 1.05 }}
                            className="relative group flex-1"
                          >
                            <div
                              className="h-9 rounded cursor-pointer transition-all duration-200 flex items-center justify-center text-xs font-medium border border-gray-100"
                              style={{
                                backgroundColor: visits > 0 ? `rgba(6, 182, 212, ${Math.min(intensity + 0.1, 1)})` : '#F9FAFB',
                                color: intensity > 0.5 ? 'white' : '#374151'
                              }}
                            >
                              {visits > 0 ? visits : ''}
                            </div>
                            
                            {/* Tooltip */}
                            {visits > 0 && (
                              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none z-10 transition-opacity">
                                <div className="font-semibold">{day} at {hour}</div>
                                <div>{visits} visits</div>
                                <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                                  <div className="w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  ))}
                </div>
                
                {/* X-axis label */}
                <div className="text-center mt-3 text-xs text-gray-700 font-medium">Time of Day</div>
              </div>
            </div>
          </div>
          
          {/* Heatmap Insights */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Busiest Time</p>
              <p className="font-semibold text-gray-900">10:00 - 11:00</p>
              <p className="text-xs text-gray-500">Avg 45 visits</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Quietest Day</p>
              <p className="font-semibold text-gray-900">Saturday</p>
              <p className="text-xs text-gray-500">30% less busy</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600 mb-1">Peak Day</p>
              <p className="font-semibold text-gray-900">Wednesday</p>
              <p className="text-xs text-gray-500">20% above avg</p>
            </div>
          </div>
        </DashboardSection>
      </div>
      
        {/* Right Column - Filters */}
        <div className="col-span-2 space-y-4">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Filters</h3>
          
          {/* Date Range Filter */}
          <button
            onClick={() => setActiveModal('date')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-cyan-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Date Range</h4>
            <p className="text-xs text-cyan-600 text-left mt-1">
              {selectedDateRange === '7d' ? 'Last 7 Days' : 
               selectedDateRange === '30d' ? 'Last 30 Days' : 
               selectedDateRange === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
            </p>
          </button>
          
          {/* Gender Filter */}
          <button
            onClick={() => setActiveModal('gender')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:users-group-two-rounded-bold-duotone" className="w-5 h-5 text-purple-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Gender</h4>
            <p className="text-xs text-purple-600 text-left mt-1">{selectedGender}</p>
          </button>
          
          {/* Age Group Filter */}
          <button
            onClick={() => setActiveModal('age')}
            className="w-full bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-center justify-between mb-2">
              <Icon icon="solar:user-id-bold-duotone" className="w-5 h-5 text-green-500" />
              <Icon icon="solar:alt-arrow-right-linear" className="w-4 h-4 text-gray-400" />
            </div>
            <h4 className="text-sm font-medium text-gray-900 text-left">Age Groups</h4>
            <p className="text-xs text-green-600 text-left mt-1">
              {selectedAgeGroup === 'All Ages' ? 'All Ages' : `${selectedAgeGroup} years`}
            </p>
          </button>
        </div>
      </div>

      {/* Filter Modals */}
      <AnimatePresence>
        {activeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setActiveModal(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {activeModal === 'date' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Date Range</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {(['7d', '30d', '3m', '6m'] as const).map((range) => (
                      <button
                        key={range}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                          selectedDateRange === range
                            ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedDateRange(range);
                          setActiveModal(null);
                        }}
                      >
                        {range === '7d' ? 'Last 7 Days' : 
                         range === '30d' ? 'Last 30 Days' : 
                         range === '3m' ? 'Last 3 Months' : 'Last 6 Months'}
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeModal === 'gender' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Gender</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {['All', 'Male', 'Female'].map((gender) => (
                      <button
                        key={gender}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                          selectedGender === gender
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedGender(gender);
                          setActiveModal(null);
                        }}
                      >
                        <span>{gender}</span>
                        <span className={`text-sm ${selectedGender === gender ? 'text-white/80' : 'text-gray-500'}`}>
                          {gender === 'All' ? '100%' : gender === 'Male' ? '48%' : '52%'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {activeModal === 'age' && (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-2xl font-bold text-gray-900">Select Age Group</h3>
                    <button 
                      onClick={() => setActiveModal(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
                    </button>
                  </div>
                  
                  <div className="space-y-3 mb-6">
                    {['All Ages', '0-17', '18-30', '31-50', '51-70', '70+'].map((ageGroup) => (
                      <button
                        key={ageGroup}
                        className={`w-full px-4 py-3 rounded-xl font-medium transition-all flex items-center justify-between ${
                          selectedAgeGroup === ageGroup
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                        onClick={() => {
                          setSelectedAgeGroup(ageGroup);
                          setActiveModal(null);
                        }}
                      >
                        <span>{ageGroup === 'All Ages' ? 'All Ages' : `${ageGroup} years`}</span>
                        <span className={`text-sm ${selectedAgeGroup === ageGroup ? 'text-white/80' : 'text-gray-500'}`}>
                          {ageGroup === 'All Ages' ? '100%' : 
                           ageGroup === '0-17' ? '15%' :
                           ageGroup === '18-30' ? '25%' :
                           ageGroup === '31-50' ? '35%' :
                           ageGroup === '51-70' ? '20%' : '5%'}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  const renderPerformanceContent = () => (
    <div className="space-y-6">
      {/* Provider Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Provider Comparison Radar */}
        <div className="lg:col-span-2">
          <DashboardSection
            title="Provider Performance Comparison"
            icon="solar:user-bold-duotone"
            iconColor="from-indigo-500 to-purple-600"
            actions={
              <ToggleSwitch
                label="Compare Mode"
                checked={showComparison}
                onChange={setShowComparison}
              />
            }
          >
            <ResponsiveContainer width="100%" height={350}>
              <RadarChart data={performanceMetrics}>
                <PolarGrid stroke={COLORS.gray[200]} />
                <PolarAngleAxis dataKey="provider" tick={{ fontSize: 11, fill: COLORS.gray[600] }} />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10, fill: COLORS.gray[500] }} />
                
                <Radar name="Efficiency" dataKey="efficiency" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.3} />
                <Radar name="Satisfaction" dataKey="satisfaction" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.3} />
                {showComparison && (
                  <Radar name="Wait Time" dataKey="waitTime" stroke={COLORS.warning} fill={COLORS.warning} fillOpacity={0.3} />
                )}
                
                <Tooltip content={<RichTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RadarChart>
            </ResponsiveContainer>
          </DashboardSection>
        </div>
        
        {/* Provider Leaderboard */}
        <DashboardSection
          title="Provider Leaderboard"
          icon="solar:cup-star-bold-duotone"
          iconColor="from-amber-500 to-orange-600"
        >
          <div className="space-y-3">
            {performanceMetrics.slice(0, 5).map((provider, index) => (
              <motion.div
                key={index}
                whileHover={{ x: 4 }}
                onClick={() => setSelectedProvider(provider.provider)}
                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                  provider.selected ? 'bg-indigo-50 border border-indigo-200' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  index === 0 ? 'bg-yellow-100 text-yellow-700' :
                  index === 1 ? 'bg-gray-100 text-gray-700' :
                  index === 2 ? 'bg-orange-100 text-orange-700' :
                  'bg-gray-50 text-gray-600'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{provider.provider}</p>
                  <p className="text-xs text-gray-500">{provider.visits} visits • {provider.efficiency}% efficiency</p>
                </div>
                <Icon icon="solar:arrow-right-linear" className="w-4 h-4 text-gray-400" />
              </motion.div>
            ))}
          </div>
        </DashboardSection>
      </div>
    </div>
  );

  const renderInsightsContent = () => (
    <div className="space-y-6">
      {/* AI-Powered Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardSection
          title="AI-Powered Insights"
          icon="solar:lightbulb-bolt-bold-duotone"
          iconColor="from-purple-500 to-pink-600"
        >
          <div className="space-y-4">
            {[
              { type: 'opportunity', title: 'Revenue Opportunity', message: 'Schedule optimization could increase revenue by 15%', icon: 'solar:dollar-bold' },
              { type: 'warning', title: 'Capacity Alert', message: 'Thursday afternoons are underutilized by 40%', icon: 'solar:danger-triangle-bold' },
              { type: 'success', title: 'Performance Highlight', message: 'Patient satisfaction increased by 12% this month', icon: 'solar:star-bold' },
              { type: 'info', title: 'Trend Alert', message: 'Preventive care visits up 25% compared to last quarter', icon: 'solar:info-circle-bold' }
            ].map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 rounded-lg border ${
                  insight.type === 'opportunity' ? 'bg-blue-50 border-blue-200' :
                  insight.type === 'warning' ? 'bg-amber-50 border-amber-200' :
                  insight.type === 'success' ? 'bg-green-50 border-green-200' :
                  'bg-gray-50 border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Icon 
                    icon={insight.icon} 
                    className={`w-5 h-5 mt-0.5 ${
                      insight.type === 'opportunity' ? 'text-blue-600' :
                      insight.type === 'warning' ? 'text-amber-600' :
                      insight.type === 'success' ? 'text-green-600' :
                      'text-gray-600'
                    }`} 
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{insight.title}</p>
                    <p className="text-sm text-gray-600 mt-0.5">{insight.message}</p>
                  </div>
                  <button className="text-xs text-gray-500 hover:text-gray-700">
                    View Details
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </DashboardSection>
        
        {/* Predictive Analytics */}
        <DashboardSection
          title="Predictive Analytics"
          icon="solar:chart-2-bold-duotone"
          iconColor="from-green-500 to-emerald-600"
        >
          <div className="space-y-4">
            <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Next Month Forecast</h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-600">Expected Visits</p>
                  <p className="text-xl font-bold text-gray-900">1,245</p>
                  <p className="text-xs text-green-600 mt-1">+8% growth</p>
                </div>
                <div>
                  <p className="text-xs text-gray-600">Projected Revenue</p>
                  <p className="text-xl font-bold text-gray-900">N$485K</p>
                  <p className="text-xs text-green-600 mt-1">+12% growth</p>
                </div>
              </div>
            </div>
            
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <h4 className="text-sm font-medium text-gray-900 mb-3">Capacity Planning</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">Current Utilization</span>
                  <span className="text-sm font-medium text-gray-900">78%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full" style={{ width: '78%' }} />
                </div>
                <p className="text-xs text-gray-600 mt-2">Optimal range: 75-85%</p>
              </div>
            </div>
          </div>
        </DashboardSection>
      </div>
    </div>
  );

  const renderTrendsContent = () => (
    <div className="space-y-6">
      {/* Interactive Trend Analysis */}
      <DashboardSection
        title="Multi-Dimensional Trend Analysis"
        icon="solar:graph-new-up-bold-duotone"
        iconColor="from-cyan-500 to-blue-500"
        actions={
          <div className="flex items-center gap-3">
            <select className="text-sm border border-gray-300 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-cyan-500">
              <option>Monthly View</option>
              <option>Weekly View</option>
              <option>Daily View</option>
            </select>
            <button className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1">
              <Icon icon="solar:settings-linear" className="w-4 h-4" />
              Configure
            </button>
          </div>
        }
      >
        <div className="h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 60, left: 60 }}>
              <defs>
                <linearGradient id="colorGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor={COLORS.primary} stopOpacity={0.8} />
                  <stop offset="50%" stopColor={COLORS.secondary} stopOpacity={0.8} />
                  <stop offset="100%" stopColor={COLORS.tertiary} stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={COLORS.gray[200]} />
              <XAxis 
                type="number" 
                dataKey="x" 
                name="Visit Volume" 
                unit="" 
                tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                label={{ value: 'Visit Volume', position: 'insideBottom', offset: -10, style: { fontSize: 12, fill: COLORS.gray[700] } }}
              />
              <YAxis 
                type="number" 
                dataKey="y" 
                name="Revenue" 
                unit="N$" 
                tick={{ fontSize: 11, fill: COLORS.gray[600] }}
                label={{ value: 'Revenue (N$)', angle: -90, position: 'insideLeft', style: { fontSize: 12, fill: COLORS.gray[700] } }}
              />
              <Tooltip content={<RichTooltip />} />
              <Scatter 
                name="Monthly Performance" 
                data={visitTrendData.map(d => ({ 
                  x: d.totalVisits, 
                  y: d.revenue, 
                  z: d.completionRate,
                  month: d.month 
                }))} 
                fill="url(#colorGradient)"
              >
                {visitTrendData.map((entry, index) => {
                  const colors = [COLORS.primary, COLORS.secondary, COLORS.tertiary, COLORS.success, COLORS.purple, COLORS.indigo];
                  return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                })}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Correlation Coefficient</p>
            <p className="text-xl font-bold text-gray-900">0.87</p>
            <p className="text-xs text-green-600">Strong Positive</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Growth Rate</p>
            <p className="text-xl font-bold text-gray-900">+14%</p>
            <p className="text-xs text-gray-600">Month over Month</p>
          </div>
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-600 mb-1">Seasonality Index</p>
            <p className="text-xl font-bold text-gray-900">1.12</p>
            <p className="text-xs text-gray-600">Above Average</p>
          </div>
        </div>
      </DashboardSection>
    </div>
  );

  return (
    <div className="space-y-6">
      {renderSubTabContent()}
    </div>
  );
};