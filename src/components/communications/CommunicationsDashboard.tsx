import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import {
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { communicationService } from '../../services/communicationService';
import { usePractice } from '../../contexts/PracticeContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import {
  bundleUsage,
  summarizeEmail,
  summarizeSms,
  type BundleUsage,
  type EmailSummary,
  type SmsSummary
} from './communicationStats';

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

// Every figure comes from the practice's own SMS/email logs and bundles (see communicationStats).
// This screen used to show invented numbers: fixed totals scaled by period, random charts and
// hard-coded success rates.
interface DashboardStats {
  sms: SmsSummary & BundleUsage;
  email: EmailSummary & BundleUsage;
}

type TabType = 'analytics' | 'performance' | 'insights';
type ChartFilterType = 'sms' | 'email';

// Pie slice styles, in order of message-type count (gradients are defined in the pie chart)
const TYPE_STYLES = [
  { fill: 'url(#appointmentGradient)', color: '#F59E0B', bg: 'bg-amber-50' },
  { fill: 'url(#invoiceGradient)', color: '#EA580C', bg: 'bg-orange-50' },
  { fill: 'url(#thankyouGradient)', color: '#FDBA74', bg: 'bg-amber-50' },
  { fill: 'url(#paymentGradient)', color: '#FDE68A', bg: 'bg-yellow-50' },
  { fill: 'url(#birthdayGradient)', color: '#FECACA', bg: 'bg-red-50' }
];

interface CommunicationsDashboardProps {
  /** Opens another tab of the Communications page (used by the quick actions) */
  onOpenTab?: (tab: 'messaging' | 'automations' | 'templates' | 'log') => void;
}

export function CommunicationsDashboard({ onOpenTab }: CommunicationsDashboardProps = {}) {
  const { practiceId } = usePractice();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'week' | 'month'>('week');
  const [activeTab, setActiveTab] = useState<TabType>('analytics');
  const [chartFilter, setChartFilter] = useState<ChartFilterType>('sms');
  const [analyticsFilter, setAnalyticsFilter] = useState<ChartFilterType>('sms');

  useEffect(() => {
    if (practiceId) {
      loadDashboardData();
    }
  }, [practiceId, selectedPeriod]);

  // The service counts from the start of today, or over the last 7 days / last month
  const periodText = selectedPeriod === 'today' ? 'today' : selectedPeriod === 'week' ? 'in the last 7 days' : 'in the last month';

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setLoadError(false);

      // Load real data from services
      const smsStats = await communicationService.getSMSStats(practiceId!, selectedPeriod);
      const emailStats = await communicationService.getEmailStats(practiceId!, selectedPeriod);
      const subscription = await communicationService.checkSMSSubscription(practiceId!);
      const emailSubscription = await communicationService.checkEmailSubscription(practiceId!);

      if (!smsStats && !emailStats) {
        // Both logs failed to load (the service returns null): say so instead of showing zeros
        setStats(null);
        setLoadError(true);
        return;
      }

      setStats({
        sms: { ...summarizeSms(smsStats), ...bundleUsage(subscription.subscription) },
        email: { ...summarizeEmail(emailStats), ...bundleUsage(emailSubscription.subscription) }
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
      setStats(null);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  if (loading || (!stats && !loadError)) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Icon icon="solar:refresh-bold-duotone" className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading communication insights...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96" role="alert">
        <div className="text-center">
          <Icon icon="solar:danger-circle-bold-duotone" className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">The communication figures could not be loaded</p>
          <button
            type="button"
            onClick={loadDashboardData}
            className="mt-3 px-4 py-2 text-sm font-medium text-white bg-cyan-600 rounded-lg hover:bg-cyan-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // Message types of the channel picked in the Performance tab, with their pie colours
  const performanceChannel = chartFilter === 'sms' ? stats.sms : stats.email;
  const performanceTypes = performanceChannel.types.map((type, index) => ({
    ...type,
    ...TYPE_STYLES[index % TYPE_STYLES.length]
  }));

  return (
    <>
      <div className="h-full grid grid-cols-12 gap-4">
      {/* Left Column - Stats (above the analytics on a phone or tablet) */}
      <div className="col-span-12 lg:col-span-4 space-y-4">
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
                <p className="text-xs text-gray-500">{stats.sms.successRate === null ? `None sent ${periodText}` : `${stats.sms.successRate}% successful`}</p>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">Emails Sent</p>
                <p className="text-2xl font-bold text-gray-900">{stats.email.total}</p>
                <p className="text-xs text-gray-500">
                  {stats.email.openRate !== null
                    ? `${stats.email.openRate}% opened`
                    : stats.email.total === 0 ? `None sent ${periodText}` : 'None delivered'}
                </p>
              </div>
            </div>

            <div className="pt-3 border-t border-gray-100">
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">SMS Credits</span>
                    <span className="font-medium">{stats.sms.hasBundle ? `${stats.sms.used} / ${stats.sms.limit}` : 'No active SMS bundle'}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.sms.percentUsed}%` }}
                      transition={{ duration: 0.8 }}
                      className="bg-gradient-to-r from-cyan-500 to-cyan-600 h-2 rounded-full"
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-gray-600">Email Credits</span>
                    <span className="font-medium">{stats.email.hasBundle ? `${stats.email.used} / ${stats.email.limit}` : 'No active email bundle'}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.email.percentUsed}%` }}
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
          <CardContent className="space-y-3">
            {/* The figures here (5/8 services, 96% success, targets) were invented: nothing measures them yet */}
            <p className="text-sm text-gray-600">
              Automation figures are not measured yet. The Automations tab shows which automations are switched on.
            </p>
            {onOpenTab && (
              <button
                type="button"
                onClick={() => onOpenTab('automations')}
                className="text-sm font-medium text-amber-600 hover:text-amber-700"
              >
                Open Automations →
              </button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Content Area - Multi-column Layout */}
      <div className="col-span-12 lg:col-span-8 space-y-6">
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
              {/* Messages by type. This was a "Monthly Message Distribution" of random daily numbers with
                  a month picker; the logs give totals per message type, not per day. */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-orange-100 rounded-lg">
                        <Icon icon="solar:calendar-bold-duotone" className="w-5 h-5 text-orange-600" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Messages by Type</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
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
                  {(analyticsFilter === 'sms' ? stats.sms.types : stats.email.types).length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <Icon icon="solar:chart-square-bold-duotone" className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="font-medium text-gray-700">No {analyticsFilter === 'sms' ? 'SMS' : 'emails'} sent {periodText}</p>
                      <p className="text-sm mt-1">Messages sent to patients are counted here by type.</p>
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={analyticsFilter === 'sms' ? stats.sms.types : stats.email.types}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis
                          dataKey="label"
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
                          allowDecimals={false}
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
                                  <p className="text-sm font-semibold text-gray-900 mb-2">{data.label}</p>
                                  <div className="space-y-1">
                                    <p className="text-xs text-gray-600">
                                      {analyticsFilter === 'sms' ? 'SMS Sent: ' : 'Emails Sent: '}
                                      <span className="font-medium text-gray-900">{data.count}</span>
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="count"
                          radius={[4, 4, 0, 0]}
                          fill="#FB923C"
                          name={analyticsFilter === 'sms' ? 'SMS' : 'Email'}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="mt-4 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <p className="text-sm text-orange-900">
                      <strong>Summary:</strong> {analyticsFilter === 'sms' ? 'SMS' : 'Emails'} sent {periodText}:
                      <span className="font-bold ml-1">
                        {analyticsFilter === 'sms' ? stats.sms.total : stats.email.total}
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
              {/* Share of each message type in the period (from the logs; was a fixed list with made-up rates) */}
              <Card className="bg-white border border-gray-200 shadow-sm">
                <CardHeader className="pb-3 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-amber-100 rounded-lg">
                        <Icon icon="solar:widget-add-bold-duotone" className="w-5 h-5 text-amber-600" />
                      </div>
                      <CardTitle className="text-lg font-semibold text-gray-900">Message Types</CardTitle>
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
                  {performanceTypes.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <Icon icon="solar:pie-chart-2-bold-duotone" className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                      <p className="font-medium text-gray-700">No {chartFilter === 'sms' ? 'SMS' : 'emails'} sent {periodText}</p>
                    </div>
                  ) : (
                  <>
                  <div className="relative">
                    {/* Central Stats Circle */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-gray-900">{performanceChannel.total}</p>
                        <p className="text-sm text-gray-600">{chartFilter === 'sms' ? 'SMS Sent' : 'Emails Sent'}</p>
                        <p className="text-lg font-semibold text-amber-600 mt-1">{performanceChannel.successRate === null ? '-' : `${performanceChannel.successRate}%`}</p>
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
                          data={performanceTypes.map(type => ({ name: type.label, value: type.count, fill: type.fill }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={80}
                          outerRadius={120}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {performanceTypes.map((type) => (
                            <Cell key={type.type} />
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

                  {/* Message type legend */}
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {performanceTypes.map((item) => (
                      <div key={item.type} className={`flex items-center justify-between p-2 rounded-lg ${item.bg}`}>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                          <span className="text-xs text-gray-700">{item.label}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-900">{item.count}</span>
                      </div>
                    ))}
                  </div>
                  </>
                  )}
                  {/* Two across on a phone, so no figure is cut off */}
                  <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-gray-100 md:grid-cols-4">
                    <div className="text-center p-3 bg-amber-50 rounded-lg">
                      <Icon icon="solar:widget-2-bold-duotone" className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Message Types</p>
                      <p className="text-lg font-bold text-gray-900">{performanceTypes.length}</p>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-lg">
                      <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Successful</p>
                      <p className="text-lg font-bold text-gray-900">{performanceChannel.succeeded}</p>
                    </div>
                    <div className="text-center p-3 bg-orange-50 rounded-lg">
                      <Icon icon="solar:letter-opened-bold-duotone" className="w-6 h-6 text-orange-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Failed</p>
                      <p className="text-lg font-bold text-gray-900">{performanceChannel.failed}</p>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-lg">
                      <Icon icon="solar:star-bold-duotone" className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                      <p className="text-xs text-gray-600">Success Rate</p>
                      <p className="text-lg font-bold text-gray-900">{performanceChannel.successRate === null ? '-' : `${performanceChannel.successRate}%`}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Channel Performance Comparison */}
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <Card className="bg-white border border-gray-200 shadow-sm">
                  <CardHeader className="pb-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg font-semibold text-gray-900">SMS Performance</CardTitle>
                      <Icon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-gray-400" />
                    </div>
                  </CardHeader>
                  <CardContent className="p-6 space-y-4">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-gray-900">{stats.sms.successRate === null ? '-' : `${stats.sms.successRate}%`}</p>
                      <p className="text-sm text-gray-600 mt-1">Sent successfully</p>
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
                      <p className="text-4xl font-bold text-gray-900">{stats.email.openRate === null ? '-' : `${stats.email.openRate}%`}</p>
                      <p className="text-sm text-gray-600 mt-1">Open Rate</p>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-lg font-semibold text-gray-900">{stats.email.succeeded}</p>
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
                  {/* Statements from this practice's own figures only (the old cards claimed "your patients
                      respond best at 9-10 AM", a 98% success rate and "up to 20% better open rates") */}
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:chat-round-dots-bold-duotone" className="w-5 h-5 text-cyan-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">SMS</h4>
                        <p className="text-sm text-gray-600">
                          {stats.sms.total === 0
                            ? `No SMS were sent ${periodText}.`
                            : `${stats.sms.succeeded} of ${stats.sms.total} SMS were sent successfully ${periodText} (${stats.sms.successRate}%).`}
                          {stats.sms.failed > 0 && ` ${stats.sms.failed} failed: check the cell numbers on those patients' records.`}
                        </p>
                        {/* Which ones failed, and whose they were, is in the Message log */}
                        {stats.sms.failed > 0 && onOpenTab && (
                          <button
                            type="button"
                            onClick={() => onOpenTab('log')}
                            className="mt-1 text-sm font-medium text-amber-600 hover:text-amber-700"
                          >
                            See them in the Message log →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <div className="flex items-start gap-3">
                      <Icon icon="solar:letter-bold-duotone" className="w-5 h-5 text-cyan-600 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-semibold text-gray-900 mb-1">Email</h4>
                        <p className="text-sm text-gray-600">
                          {stats.email.total === 0
                            ? `No emails were sent ${periodText}.`
                            : `${stats.email.succeeded} of ${stats.email.total} emails went out ${periodText}, and ${stats.email.opened} ${stats.email.opened === 1 ? 'was' : 'were'} opened. Opens are only counted when the email service reports them.`}
                          {stats.email.failed > 0 && ` ${stats.email.failed} could not be delivered: check those email addresses.`}
                        </p>
                        {stats.email.failed > 0 && onOpenTab && (
                          <button
                            type="button"
                            onClick={() => onOpenTab('log')}
                            className="mt-1 text-sm font-medium text-amber-600 hover:text-amber-700"
                          >
                            See them in the Message log →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {(stats.sms.types.length > 0 || stats.email.types.length > 0) && (
                    <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-start gap-3">
                        <Icon icon="solar:star-bold-duotone" className="w-5 h-5 text-cyan-600 mt-0.5" />
                        <div>
                          <h4 className="text-sm font-semibold text-gray-900 mb-1">Most sent</h4>
                          <p className="text-sm text-gray-600">
                            {stats.sms.types[0] && `SMS: ${stats.sms.types[0].label} (${stats.sms.types[0].count}). `}
                            {stats.email.types[0] && `Email: ${stats.email.types[0].label} (${stats.email.types[0].count}).`}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {onOpenTab && (
                    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => onOpenTab('messaging')}
                          className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all text-center"
                        >
                          <Icon icon="solar:pen-new-square-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                          <span className="text-xs text-gray-700">Open Messaging</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenTab('templates')}
                          className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-sm transition-all text-center"
                        >
                          <Icon icon="solar:settings-bold-duotone" className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                          <span className="text-xs text-gray-700">Configure Templates</span>
                        </button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
    </>
  );
}