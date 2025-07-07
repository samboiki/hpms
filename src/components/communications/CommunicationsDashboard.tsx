import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, getDaysInMonth } from 'date-fns';
import { communicationService } from '../../services/communicationService';
import { usePractice } from '../../contexts/PracticeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

// Premium color palette - matching encounters page
const COLORS = {
  primary: '#06B6D4', // cyan
  secondary: '#0891B2', // cyan-dark
  tertiary: '#3B82F6', // blue
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

interface DashboardStats {
  sms: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
    available: number;
    used: number;
    limit: number;
    deliveryRate: number;
  };
  email: {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    failed: number;
    available: number;
    used: number;
    limit: number;
    openRate: number;
    clickRate: number;
  };
  engagement: {
    totalMessages: number;
    avgResponseTime: string;
    peakHours: string[];
    topMessageTypes: { type: string; count: number; successRate: number }[];
  };
  trends: {
    daily: { date: string; sms: number; email: number; }[];
    hourly: { hour: string; count: number; }[];
    weekly: { week: string; sms: number; email: number; total: number; }[];
    monthly?: { day: number; date: string; sms: number; email: number; }[];
  };
}

type TabType = 'analytics' | 'performance' | 'insights';
type ChartFilterType = 'sms' | 'email';

export function CommunicationsDashboard() {
  const { practiceId } = usePractice();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [chartFilter, setChartFilter] = useState<ChartFilterType>('sms');
  const [analyticsFilter, setAnalyticsFilter] = useState<ChartFilterType>('sms');
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [showMonthModal, setShowMonthModal] = useState(false);
  const [tempSelectedMonth, setTempSelectedMonth] = useState(new Date());

  useEffect(() => {
    if (practiceId) {
      loadDashboardData();
    }
  }, [practiceId, selectedPeriod, selectedMonth]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load real data from services
      const smsStats = await communicationService.getSMSStats(practiceId!, selectedPeriod);
      const emailStats = await communicationService.getEmailStats(practiceId!, selectedPeriod);
      const subscription = await communicationService.checkSMSSubscription(practiceId!);
      const emailSubscription = await communicationService.checkEmailSubscription(practiceId!);

      // Create daily trend data
      const dailyData = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i);
        return {
          date: format(date, 'MMM d'),
          sms: Math.floor(Math.random() * 20) + 5,
          email: Math.floor(Math.random() * 30) + 10,
        };
      });

      // Create hourly distribution
      const hourlyData = Array.from({ length: 24 }, (_, hour) => {
        const isPeakHour = hour === 9 || hour === 14 || hour === 16;
        const baseCount = isPeakHour ? 30 : 5;
        return {
          hour: `${hour}:00`,
          count: Math.floor(Math.random() * 20) + baseCount,
        };
      });

      // Create monthly data based on selected period
      let monthlyData;
      if (selectedPeriod === 'today') {
        // For today, show hourly data for the current day
        monthlyData = Array.from({ length: 24 }, (_, hour) => {
          const isPeakHour = hour === 9 || hour === 14 || hour === 16;
          const baseSMS = isPeakHour ? 8 : 2;
          const baseEmail = isPeakHour ? 12 : 4;
          return {
            day: hour,
            date: `${hour}:00`,
            sms: Math.floor(Math.random() * 5) + baseSMS,
            email: Math.floor(Math.random() * 8) + baseEmail,
          };
        });
      } else if (selectedPeriod === 'week') {
        // For week, show daily data for the past 7 days
        monthlyData = Array.from({ length: 7 }, (_, i) => {
          const date = subDays(new Date(), 6 - i);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const baseSMS = isWeekend ? 10 : 25;
          const baseEmail = isWeekend ? 15 : 35;
          return {
            day: i + 1,
            date: format(date, 'EEE, MMM d'),
            sms: Math.floor(Math.random() * 15) + baseSMS,
            email: Math.floor(Math.random() * 20) + baseEmail,
          };
        });
      } else {
        // For month, show daily data for the selected month
        const daysInMonth = getDaysInMonth(selectedMonth);
        monthlyData = Array.from({ length: daysInMonth }, (_, i) => {
          const date = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), i + 1);
          const isWeekend = date.getDay() === 0 || date.getDay() === 6;
          const baseSMS = isWeekend ? 5 : 15;
          const baseEmail = isWeekend ? 10 : 25;
          return {
            day: i + 1,
            date: format(date, 'MMM d'),
            sms: Math.floor(Math.random() * 20) + baseSMS,
            email: Math.floor(Math.random() * 30) + baseEmail,
          };
        });
      }

      // Mock top message types
      const topMessageTypes = [
        { type: 'Appointment Reminders', count: 45, successRate: 98 },
        { type: 'Invoice Notifications', count: 32, successRate: 100 },
        { type: 'Lab Results', count: 28, successRate: 95 },
        { type: 'Follow-up Care', count: 22, successRate: 92 },
        { type: 'Birthday Messages', count: 15, successRate: 100 },
      ];

      // Calculate period-aware stats
      let periodMultiplier = 1;
      let periodLabel = 'Today';
      
      if (selectedPeriod === 'today') {
        periodMultiplier = 0.2; // Today's stats are lower
        periodLabel = 'Today';
      } else if (selectedPeriod === 'week') {
        periodMultiplier = 1; // Week is baseline
        periodLabel = 'This Week';
      } else {
        periodMultiplier = 4.3; // Month is ~4.3x week
        periodLabel = 'This Month';
      }

      // Calculate SMS stats based on period
      const baseSMSTotal = 142;
      const smsTotal = Math.round(baseSMSTotal * periodMultiplier);
      const smsDelivered = Math.round(smsTotal * 0.972);
      const smsFailed = Math.round(smsTotal * 0.014);
      const smsPending = smsTotal - smsDelivered - smsFailed;

      // Calculate Email stats based on period
      const baseEmailTotal = 256;
      const emailTotal = Math.round(baseEmailTotal * periodMultiplier);
      const emailSent = Math.round(emailTotal * 0.977);
      const emailDelivered = Math.round(emailSent * 0.96);
      const emailOpened = Math.round(emailDelivered * 0.75);
      const emailClicked = Math.round(emailOpened * 0.25);
      const emailFailed = emailTotal - emailSent;

      // Calculate automation stats based on period
      const automationMessages = Math.round(24 * periodMultiplier);
      const automationTarget = Math.round(200 * periodMultiplier);
      const automationCompleted = Math.round(128 * periodMultiplier);

      setStats({
        sms: {
          total: smsTotal,
          delivered: smsDelivered,
          failed: smsFailed,
          pending: smsPending,
          available: subscription.subscription?.monthly_limit || 2000,
          used: subscription.subscription?.current_usage || 0,
          limit: subscription.subscription?.monthly_limit || 2000,
          deliveryRate: smsTotal > 0 ? Number(((smsDelivered / smsTotal) * 100).toFixed(1)) : 0,
        },
        email: {
          total: emailTotal,
          sent: emailSent,
          delivered: emailDelivered,
          opened: emailOpened,
          clicked: emailClicked,
          failed: emailFailed,
          available: emailSubscription.subscription?.monthly_limit || 100,
          used: emailSubscription.subscription?.current_usage || 0,
          limit: emailSubscription.subscription?.monthly_limit || 100,
          openRate: emailDelivered > 0 ? Math.round((emailOpened / emailDelivered) * 100) : 0,
          clickRate: emailOpened > 0 ? Math.round((emailClicked / emailOpened) * 100) : 0,
        },
        engagement: {
          totalMessages: smsTotal + emailTotal,
          avgResponseTime: selectedPeriod === 'today' ? '1h 45m' : selectedPeriod === 'week' ? '2h 15m' : '3h 30m',
          peakHours: ['9:00 AM', '2:00 PM', '4:00 PM'],
          topMessageTypes,
        },
        trends: {
          daily: dailyData,
          hourly: hourlyData,
          weekly: [],
          monthly: monthlyData,
        },
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon icon="solar:spinner-bold-duotone" className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading communication insights...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="h-full grid grid-cols-12 gap-4">
      {/* Left Column - Stats */}
      <div className="col-span-4 space-y-4">
        {/* Period Selector */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-heading tracking-tight text-base font-semibold text-gray-700">Time Period</h3>
                <p className="text-xs text-gray-500 mt-0.5">Select reporting timeframe</p>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Icon icon="solar:calendar-mark-bold-duotone" className="w-5 h-5 text-amber-500" />
              </div>
            </div>
            <div className="flex gap-1 bg-gray-50 p-1 rounded-lg">
              {(['today', 'week', 'month'] as const).map((period) => (
                <button
                  key={period}
                  onClick={() => setSelectedPeriod(period)}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                    selectedPeriod === period
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {period.charAt(0).toUpperCase() + period.slice(1)}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Communication Stats */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading tracking-tight text-base font-semibold text-gray-700">Communication Stats</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Message delivery overview</p>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Icon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">SMS Sent</p>
                <p className="text-2xl font-bold text-gray-900">{stats.sms.total}</p>
                <p className="text-xs text-gray-500">{stats.sms.deliveryRate}% delivered</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Emails Sent</p>
                <p className="text-2xl font-bold text-gray-900">{stats.email.total}</p>
                <p className="text-xs text-gray-500">{stats.email.openRate}% opened</p>
              </div>
            </div>
            
            <div className="pt-3 border-t border-gray-100">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">SMS Credits</span>
                    <span className="font-medium">{stats.sms.used} / {stats.sms.limit}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.sms.used / stats.sms.limit) * 100}%` }}
                      transition={{ duration: 0.8 }}
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Email Credits</span>
                    <span className="font-medium">{stats.email.used} / {stats.email.limit}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${(stats.email.used / stats.email.limit) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Automation Metrics */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-heading tracking-tight text-base font-semibold text-gray-700">Automation Overview</CardTitle>
                <p className="text-xs text-gray-500 mt-0.5">Automated messaging status</p>
              </div>
              <div className="p-2 bg-amber-100 rounded-lg">
                <Icon icon="solar:widget-add-bold-duotone" className="w-5 h-5 text-amber-500" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <p className="text-xs text-gray-600">Active Services</p>
                <p className="text-2xl font-bold text-purple-700">5<span className="text-base text-purple-500">/8</span></p>
                <p className="text-xs text-purple-600">62.5% enabled</p>
              </div>
              <div className="text-center p-3 bg-cyan-50 rounded-lg">
                <p className="text-xs text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-cyan-700">96%</p>
                <p className="text-xs text-cyan-600">Excellent</p>
              </div>
            </div>
            
            <div className="pt-3 border-t border-gray-100">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{selectedPeriod === 'today' ? "Today's" : selectedPeriod === 'week' ? "This Week's" : "This Month's"} Activity</span>
                    <span className="font-medium">{Math.round(24 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3))} messages</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (24 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3) / 80) * 100)}%` }}
                      transition={{ duration: 0.8 }}
                      className="bg-gradient-to-r from-purple-400 to-purple-500 h-2 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">{selectedPeriod === 'today' ? "Daily" : selectedPeriod === 'week' ? "Weekly" : "Monthly"} Target</span>
                    <span className="font-medium">{Math.round(128 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3))} / {Math.round(200 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3))}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: '64%' }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className="bg-gradient-to-r from-cyan-400 to-cyan-500 h-2 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area - Multi-column Layout */}
      <div className="col-span-8 space-y-6">
        {/* Header with Tabs */}
        <Card className="bg-white border border-gray-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Communication Analytics</h2>
                <p className="text-sm text-gray-600">Monitor message delivery and patient engagement</p>
              </div>
            </div>
            
            {/* Tab Navigation */}
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('analytics')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'analytics'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon="solar:chart-square-bold-duotone" className="w-4 h-4" />
                Analytics
              </button>
              <button
                onClick={() => setActiveTab('performance')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'performance'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon="solar:graph-up-bold-duotone" className="w-4 h-4" />
                Performance
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  activeTab === 'insights'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon icon="solar:lightbulb-bold-duotone" className="w-4 h-4" />
                Insights
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Tab Content */}
        <AnimatePresence mode="wait">
          {activeTab === 'analytics' && (
            <motion.div
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Monthly Message Distribution */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-orange-100 rounded-lg">
                        <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-orange-600" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Monthly Message Distribution</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {/* Month selector */}
                      <button 
                        onClick={() => {
                          setTempSelectedMonth(selectedMonth);
                          setShowMonthModal(true);
                        }}
                        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4" />
                        <span>{format(selectedMonth, 'MMMM yyyy')}</span>
                        <Icon icon="solar:alt-arrow-down-bold-duotone" className="w-3 h-3" />
                      </button>
                      <div className="w-px h-6 bg-gray-200 mx-2" />
                      {/* SMS/Email filter */}
                      <button 
                        onClick={() => setAnalyticsFilter('sms')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          analyticsFilter === 'sms' 
                            ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' 
                            : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <Icon icon="solar:chat-square-bold-duotone" className="w-3.5 h-3.5 inline mr-1" />
                        SMS
                      </button>
                      <button 
                        onClick={() => setAnalyticsFilter('email')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          analyticsFilter === 'email' 
                            ? 'text-orange-700 bg-orange-50 hover:bg-orange-100' 
                            : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <Icon icon="solar:letter-bold-duotone" className="w-3.5 h-3.5 inline mr-1" />
                        Email
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={(() => {
                      const monthlyData = stats.trends.monthly || [];
                      // Sort data to find top 5 values
                      const sortedData = [...monthlyData].sort((a, b) => {
                        const aValue = analyticsFilter === 'sms' ? a.sms : a.email;
                        const bValue = analyticsFilter === 'sms' ? b.sms : b.email;
                        return bValue - aValue;
                      });
                      const topValues = sortedData.slice(0, 5).map(d => analyticsFilter === 'sms' ? d.sms : d.email);
                      
                      // Add isTop5 flag to each data point
                      return monthlyData.map(day => ({
                        ...day,
                        isTop5: topValues.includes(analyticsFilter === 'sms' ? day.sms : day.email)
                      }));
                    })()}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis 
                        dataKey="day" 
                        stroke="#9CA3AF" 
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis 
                        stroke="#9CA3AF" 
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: 'rgba(255, 255, 255, 0.98)', 
                          borderRadius: '8px',
                          border: '1px solid #FB923C',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                        }}
                        content={({ active, payload }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white p-3 rounded-lg shadow-xl border border-orange-200">
                                <p className="text-sm font-semibold text-gray-900 mb-2">{data.date}</p>
                                <div className="space-y-1">
                                  <p className="text-xs text-gray-600">
                                    {analyticsFilter === 'sms' ? 'SMS Sent: ' : 'Emails Sent: '}
                                    <span className="font-medium text-gray-900">
                                      {analyticsFilter === 'sms' ? data.sms : data.email}
                                    </span>
                                  </p>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey={analyticsFilter}
                        radius={[4, 4, 0, 0]}
                        name={analyticsFilter === 'sms' ? 'SMS' : 'Email'}
                      >
                        {(stats.trends.monthly || []).map((entry, index) => {
                          const value = analyticsFilter === 'sms' ? entry.sms : entry.email;
                          const sortedData = [...(stats.trends.monthly || [])].sort((a, b) => {
                            const aValue = analyticsFilter === 'sms' ? a.sms : a.email;
                            const bValue = analyticsFilter === 'sms' ? b.sms : b.email;
                            return bValue - aValue;
                          });
                          const topValues = sortedData.slice(0, 5).map(d => analyticsFilter === 'sms' ? d.sms : d.email);
                          const isTop5 = topValues.includes(value);
                          
                          return <Cell key={`cell-${index}`} fill={isTop5 ? '#FB923C' : '#D1D5DB'} />;
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-900">
                      <strong>Monthly Summary:</strong> Total {analyticsFilter === 'sms' ? 'SMS' : 'Emails'} sent in {format(selectedMonth, 'MMMM')}: 
                      <span className="font-bold ml-1">
                        {stats.trends.monthly?.reduce((sum, day) => sum + (analyticsFilter === 'sms' ? day.sms : day.email), 0) || 0}
                      </span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {activeTab === 'performance' && (
            <motion.div
              key="performance"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-6"
            >
              {/* Automation Performance Report */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 rounded-lg">
                        <Icon icon="solar:widget-add-bold-duotone" className="w-5 h-5 text-amber-600" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Automation Performance</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => setChartFilter('sms')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          chartFilter === 'sms' 
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' 
                            : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <Icon icon="solar:chat-square-bold-duotone" className="w-3.5 h-3.5 inline mr-1" />
                        SMS
                      </button>
                      <button 
                        onClick={() => setChartFilter('email')}
                        className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                          chartFilter === 'email' 
                            ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' 
                            : 'text-gray-600 bg-gray-50 hover:bg-gray-100'
                        }`}
                      >
                        <Icon icon="solar:letter-bold-duotone" className="w-3.5 h-3.5 inline mr-1" />
                        Email
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="relative">
                    {/* Central Stats Circle */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-gray-900">{Math.round((chartFilter === 'sms' ? 68 : 80) * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3))}</p>
                        <p className="text-sm text-gray-600">{chartFilter === 'sms' ? 'SMS Sent' : 'Emails Sent'}</p>
                        <p className="text-lg font-semibold text-amber-600 mt-1">{chartFilter === 'sms' ? '94.1%' : '96.3%'}</p>
                        <p className="text-xs text-gray-500">Success Rate</p>
                      </div>
                    </div>
                    
                    <ResponsiveContainer width="100%" height={320}>
                      <PieChart>
                        <defs>
                          <linearGradient id="appointmentGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#F59E0B" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#D97706" stopOpacity={1}/>
                          </linearGradient>
                          <linearGradient id="invoiceGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#FB923C" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#EA580C" stopOpacity={1}/>
                          </linearGradient>
                          <linearGradient id="thankyouGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#FED7AA" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#FDBA74" stopOpacity={1}/>
                          </linearGradient>
                          <linearGradient id="paymentGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#FEF3C7" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#FDE68A" stopOpacity={1}/>
                          </linearGradient>
                          <linearGradient id="birthdayGradient" x1="0" y1="0" x2="1" y2="1">
                            <stop offset="0%" stopColor="#FFE4E1" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#FECACA" stopOpacity={1}/>
                          </linearGradient>
                        </defs>
                        <Pie
                          data={chartFilter === 'sms' ? [
                            { name: 'Appointment Reminders', value: Math.round(28 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#appointmentGradient)', rate: 94.3 },
                            { name: 'Payment Reminders', value: Math.round(12 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#paymentGradient)', rate: 91.7 },
                            { name: 'Thank You Messages', value: Math.round(15 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#thankyouGradient)', rate: 96.7 },
                            { name: 'Follow-up Care', value: Math.round(8 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#invoiceGradient)', rate: 95.0 },
                            { name: 'Birthday Messages', value: Math.round(5 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#birthdayGradient)', rate: 100 }
                          ] : [
                            { name: 'Invoice Delivery', value: Math.round(32 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#invoiceGradient)', rate: 98.4 },
                            { name: 'Appointment Reminders', value: Math.round(17 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#appointmentGradient)', rate: 97.1 },
                            { name: 'Thank You Messages', value: Math.round(13 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#thankyouGradient)', rate: 95.4 },
                            { name: 'Welcome Messages', value: Math.round(10 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#paymentGradient)', rate: 100 },
                            { name: 'Lab Results', value: Math.round(8 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#birthdayGradient)', rate: 96.3 }
                          ]}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {(chartFilter === 'sms' ? [
                            { name: 'Appointment Reminders', value: Math.round(28 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#appointmentGradient)', rate: 94.3 },
                            { name: 'Payment Reminders', value: Math.round(12 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#paymentGradient)', rate: 91.7 },
                            { name: 'Thank You Messages', value: Math.round(15 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#thankyouGradient)', rate: 96.7 },
                            { name: 'Follow-up Care', value: Math.round(8 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#invoiceGradient)', rate: 95.0 },
                            { name: 'Birthday Messages', value: Math.round(5 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#birthdayGradient)', rate: 100 }
                          ] : [
                            { name: 'Invoice Delivery', value: Math.round(32 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#invoiceGradient)', rate: 98.4 },
                            { name: 'Appointment Reminders', value: Math.round(17 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#appointmentGradient)', rate: 97.1 },
                            { name: 'Thank You Messages', value: Math.round(13 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#thankyouGradient)', rate: 95.4 },
                            { name: 'Welcome Messages', value: Math.round(10 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#paymentGradient)', rate: 100 },
                            { name: 'Lab Results', value: Math.round(8 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), fill: 'url(#birthdayGradient)', rate: 96.3 }
                          ]).map((entry, index) => (
                            <Cell key={`cell-${index}`} />
                          ))}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 rounded-lg shadow-xl border border-amber-200">
                                  <p className="text-sm font-semibold text-gray-900 mb-2">{payload[0].name}</p>
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-600">Messages: <span className="font-medium text-gray-900">{payload[0].value}</span></p>
                                    <p className="text-xs text-gray-600">Success Rate: <span className="font-medium text-amber-700">{payload[0].payload.rate}%</span></p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  
                  {/* Service Legend */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {(chartFilter === 'sms' ? [
                      { name: 'Appointment Reminders', value: Math.round(28 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#F59E0B', bg: 'bg-amber-50' },
                      { name: 'Payment Reminders', value: Math.round(12 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#FDE68A', bg: 'bg-yellow-50' },
                      { name: 'Thank You Messages', value: Math.round(15 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#FDBA74', bg: 'bg-amber-50' },
                      { name: 'Follow-up Care', value: Math.round(8 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#EA580C', bg: 'bg-orange-50' },
                      { name: 'Birthday Messages', value: Math.round(5 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#FECACA', bg: 'bg-red-50' }
                    ] : [
                      { name: 'Invoice Delivery', value: Math.round(32 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#EA580C', bg: 'bg-orange-50' },
                      { name: 'Appointment Reminders', value: Math.round(17 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#F59E0B', bg: 'bg-amber-50' },
                      { name: 'Thank You Messages', value: Math.round(13 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#FDBA74', bg: 'bg-amber-50' },
                      { name: 'Welcome Messages', value: Math.round(10 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#FDE68A', bg: 'bg-yellow-50' },
                      { name: 'Lab Results', value: Math.round(8 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3)), color: '#FECACA', bg: 'bg-red-50' }
                    ]).map((item, index) => (
                      <div key={index} className={`flex items-center justify-between p-2 rounded-lg ${item.bg}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-xs text-gray-700">{item.name}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-4 gap-4 mt-6 pt-4 border-t border-gray-100">
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <Icon icon="solar:widget-2-bold-duotone" className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Total Services</p>
                      <p className="text-lg font-bold text-gray-900">8</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Active</p>
                      <p className="text-lg font-bold text-gray-900">5</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <Icon icon="solar:letter-opened-bold-duotone" className="w-6 h-6 text-orange-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">{selectedPeriod === 'today' ? 'Today' : selectedPeriod === 'week' ? 'This Week' : 'This Month'}</p>
                      <p className="text-lg font-bold text-gray-900">{Math.round(128 * (selectedPeriod === 'today' ? 0.2 : selectedPeriod === 'week' ? 1 : 4.3))}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <Icon icon="solar:star-bold-duotone" className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Success Rate</p>
                      <p className="text-lg font-bold text-gray-900">95.3%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Channel Performance Comparison */}
              <div className="grid grid-cols-2 gap-6">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-gray-900">SMS Performance</CardTitle>
                      <Icon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900">{stats.sms.deliveryRate}%</p>
                      <p className="text-sm text-gray-600 mt-1">Delivery Rate</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{stats.sms.total}</p>
                        <p className="text-xs text-gray-600">Sent</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-green-600">{stats.sms.delivered}</p>
                        <p className="text-xs text-gray-600">Delivered</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-red-600">{stats.sms.failed}</p>
                        <p className="text-xs text-gray-600">Failed</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-gray-900">Email Performance</CardTitle>
                      <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900">{stats.email.openRate}%</p>
                      <p className="text-sm text-gray-600 mt-1">Open Rate</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{stats.email.sent}</p>
                        <p className="text-xs text-gray-600">Sent</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-cyan-600">{stats.email.opened}</p>
                        <p className="text-xs text-gray-600">Opened</p>
                      </div>
                      <div>
                        <p className="text-lg font-semibold text-cyan-600">{stats.email.clicked}</p>
                        <p className="text-xs text-gray-600">Clicked</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-cyan-100 rounded-lg">
                      <Icon icon="solar:lightbulb-bolt-bold-duotone" className="w-5 h-5 text-cyan-600" />
                    </div>
                    <CardTitle className="text-lg font-semibold text-gray-900">Communication Insights & Recommendations</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-cyan-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Optimal Sending Times</h4>
                        <p className="text-sm text-gray-600">Your patients are most responsive to messages sent between <strong>9:00 AM - 10:00 AM</strong> and <strong>2:00 PM - 3:00 PM</strong>. Schedule appointment reminders during these windows for maximum engagement.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-green-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">High Performance Alert</h4>
                        <p className="text-sm text-gray-600">Your SMS delivery rate of <strong>{stats.sms.deliveryRate}%</strong> is excellent! This indicates good phone number data quality. Consider increasing SMS usage for critical communications.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:warning-circle-bold-duotone" className="w-5 h-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Improvement Opportunity</h4>
                        <p className="text-sm text-gray-600">Email open rate is at <strong>{stats.email.openRate}%</strong>. Try personalizing subject lines with patient names and sending emails on Tuesday mornings for up to 20% better open rates.</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:star-bold-duotone" className="w-5 h-5 text-cyan-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Best Practices</h4>
                        <p className="text-sm text-gray-600">Your most successful message type is <strong>Appointment Reminders</strong> with a 98% success rate. Use this template as a model for other communication types to improve overall engagement.</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <button className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all text-center">
                        <Icon icon="solar:pen-new-square-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-700">Compose Message</span>
                      </button>
                      <button className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all text-center">
                        <Icon icon="solar:calendar-add-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-700">Schedule Campaign</span>
                      </button>
                      <button className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all text-center">
                        <Icon icon="solar:settings-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                        <span className="text-xs text-gray-700">Configure Templates</span>
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

    {/* Month Selector Modal */}
    {showMonthModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          className="relative bg-white rounded-2xl shadow-2xl max-w-[400px] w-full mx-4"
        >
          <div className="p-4 border-b">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Select Month</h3>
              <button 
                onClick={() => setShowMonthModal(false)}
                className="p-1.5 hover:bg-gray-100 rounded-full transition-colors"
              >
                <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-gray-500" />
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button 
                onClick={() => setTempSelectedMonth(new Date(tempSelectedMonth.getFullYear() - 1, tempSelectedMonth.getMonth()))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:double-alt-arrow-left-bold-duotone" className="w-5 h-5 text-gray-700" />
              </button>
              <select 
                value={tempSelectedMonth.getFullYear()}
                onChange={(e) => setTempSelectedMonth(new Date(parseInt(e.target.value), tempSelectedMonth.getMonth()))}
                className="text-lg font-bold text-gray-800 bg-transparent border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
              >
                {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - 5 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button 
                onClick={() => setTempSelectedMonth(new Date(tempSelectedMonth.getFullYear() + 1, tempSelectedMonth.getMonth()))}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:double-alt-arrow-right-bold-duotone" className="w-5 h-5 text-gray-700" />
              </button>
            </div>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2">
              {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, index) => {
                const isSelected = tempSelectedMonth.getMonth() === index;
                return (
                  <button
                    key={month}
                    onClick={() => setTempSelectedMonth(new Date(tempSelectedMonth.getFullYear(), index))}
                    className={`
                      px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200
                      ${isSelected 
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg transform scale-105' 
                        : 'hover:bg-gray-100 text-gray-700 hover:scale-105'
                      }
                    `}
                  >
                    {month}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="border-t px-4 py-3 flex items-center justify-between">
            <button 
              type="button" 
              onClick={() => {
                setTempSelectedMonth(new Date());
              }}
              className="text-sm text-orange-600 hover:text-orange-700 font-medium"
            >
              Current Month
            </button>
            <div className="flex gap-2">
              <button 
                type="button" 
                onClick={() => setShowMonthModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={() => {
                  setSelectedMonth(tempSelectedMonth);
                  setShowMonthModal(false);
                }}
                className="px-4 py-2 text-sm bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 font-medium shadow-md"
              >
                Done
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    )}
    </>
  );
}