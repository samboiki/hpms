import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { supabase } from '../lib/supabase';
import { usePractice } from '../contexts/PracticeContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { startOfMonth, endOfMonth, subMonths, parseISO, isToday, format } from 'date-fns';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Import existing components
import LaboratoryTabContent from '../components/requests/LaboratoryTabContent';
import ImagingTabContent from '../components/requests/ImagingTabContent';
import FollowUpAutomationTab from '../components/encounters/FollowUpAutomationTab';

interface DashboardStats {
  totalVisits: number;
  completedVisits: number;
  pendingVisits: number;
  todayVisits: number;
  monthlyVisits: number;
  lastMonthVisits: number;
  avgVisitDuration: number;
  noShowRate: number;
  pendingLabs: number;
  completedLabs: number;
  pendingImaging: number;
  completedImaging: number;
  totalPrescriptions: number;
  totalRevenue: number;
  medicalAidRevenue: number;
  patientRevenue: number;
  providerProductivity: { [key: string]: number };
  visitTypes: { [key: string]: number };
  departmentDistribution: { [key: string]: number };
  monthlyTrends: Array<{ month: string; totalVisits: number; completedVisits: number; cancelledVisits: number }>;
  diagnosisDistribution: Array<{ diagnosis: string; count: number }>;
  topMedications: Array<{ name: string; count: number }>;
  revenueByService: Array<{ service: string; revenue: number }>;
  hourlyDistribution: Array<{ hour: string; count: number }>;
  visitDurationDistribution: Array<{ duration: string; count: number }>;
}

// Chart color schemes
const CHART_COLORS = {
  primary: ['#6366f1', '#8b5cf6', '#a855f7', '#c084fc', '#d8b4fe'],
  secondary: ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'],
  success: ['#10b981', '#34d399', '#6ee7b7', '#a7f3d0', '#d1fae5'],
  warning: ['#f59e0b', '#fbbf24', '#fcd34d', '#fde68a', '#fef3c7'],
  danger: ['#ef4444', '#f87171', '#fca5a5', '#fecaca', '#fee2e2'],
  gradient: {
    primary: 'url(#colorPrimary)',
    secondary: 'url(#colorSecondary)',
    success: 'url(#colorSuccess)',
  }
};

// Custom Tooltip Component
interface TooltipPayload {
  color: string;
  name: string;
  value: number | string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white p-3 rounded-lg shadow-lg border border-gray-200">
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {payload.map((entry, index) => (
          <p key={index} className="text-sm" style={{ color: entry.color }}>
            {entry.name}: {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Encounters Dashboard Component with Real Charts
const EncountersDashboard: React.FC<{ stats: DashboardStats }> = ({ stats }) => {
  return (
    <div className="space-y-6">
      {/* Dashboard Sub-tabs */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="clinical">Clinical Analytics</TabsTrigger>
          <TabsTrigger value="financial">Financial Analytics</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Today's Visits</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.todayVisits}</p>
                  <p className="text-xs text-gray-500 mt-1">Active now</p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Icon icon="solar:calendar-bold-duotone" className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Monthly Visits</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.monthlyVisits}</p>
                  <div className="flex items-center mt-1">
                    <Icon 
                      icon={stats.monthlyVisits > stats.lastMonthVisits ? "solar:arrow-up-bold" : "solar:arrow-down-bold"} 
                      className={`w-4 h-4 ${stats.monthlyVisits > stats.lastMonthVisits ? 'text-green-600' : 'text-red-600'}`}
                    />
                    <span className={`text-xs ml-1 ${stats.monthlyVisits > stats.lastMonthVisits ? 'text-green-600' : 'text-red-600'}`}>
                      {Math.abs(((stats.monthlyVisits - stats.lastMonthVisits) / stats.lastMonthVisits * 100) || 0).toFixed(1)}%
                    </span>
                  </div>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Icon icon="solar:chart-bold-duotone" className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Completion Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    {((stats.completedVisits / stats.totalVisits) * 100 || 0).toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{stats.completedVisits} of {stats.totalVisits}</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Icon icon="solar:check-circle-bold-duotone" className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">No-Show Rate</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.noShowRate}%</p>
                  <p className="text-xs text-gray-500 mt-1">This month</p>
                </div>
                <div className="p-3 bg-red-100 rounded-lg">
                  <Icon icon="solar:close-circle-bold-duotone" className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Visit Trends Chart */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Visit Trends (Last 12 Months)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={stats.monthlyTrends}>
                  <defs>
                    <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorSecondary" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="month" stroke="#6b7280" fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Area 
                    type="monotone" 
                    dataKey="totalVisits" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#colorPrimary)"
                    name="Total Visits"
                    strokeWidth={2}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="completedVisits" 
                    stroke="#10b981" 
                    fillOpacity={1} 
                    fill="url(#colorSecondary)"
                    name="Completed"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Provider Productivity and Visit Types */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Provider Productivity Chart */}
            <Card className="shadow-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Provider Productivity</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart 
                    data={Object.entries(stats.providerProductivity).map(([name, visits]) => ({ name, visits }))}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" stroke="#6b7280" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={100} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="visits" fill="#6366f1" radius={[0, 8, 8, 0]}>
                      {Object.entries(stats.providerProductivity).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Visit Types Distribution */}
            <Card className="shadow-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Visit Types Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={Object.entries(stats.visitTypes).map(([type, count]) => ({ name: type, value: count }))}
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {Object.entries(stats.visitTypes).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS.secondary[index % CHART_COLORS.secondary.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Clinical Analytics Tab */}
        <TabsContent value="clinical" className="space-y-6 mt-6">
          {/* Diagnosis Distribution */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Top 10 Diagnoses</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={stats.diagnosisDistribution}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="diagnosis" angle={-45} textAnchor="end" height={100} fontSize={12} />
                  <YAxis stroke="#6b7280" fontSize={12} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[8, 8, 0, 0]}>
                    {stats.diagnosisDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lab and Imaging Status */}
            <Card className="shadow-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Lab & Imaging Status</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: 'Lab Requests', pending: stats.pendingLabs, completed: stats.completedLabs },
                      { name: 'Imaging', pending: stats.pendingImaging, completed: stats.completedImaging }
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                    <Bar dataKey="completed" fill="#10b981" name="Completed" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Visit Duration Distribution */}
            <Card className="shadow-sm border-0">
              <CardHeader>
                <CardTitle className="text-lg font-semibold">Visit Duration Pattern</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={stats.visitDurationDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="duration" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} />
                    <Line 
                      type="monotone" 
                      dataKey="count" 
                      stroke="#6366f1" 
                      strokeWidth={3}
                      dot={{ fill: '#6366f1', r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Medications Chart */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Most Prescribed Medications</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.topMedications.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.topMedications} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis type="number" stroke="#6b7280" fontSize={12} />
                    <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={150} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="count" fill="#10b981" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No medication data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Analytics Tab */}
        <TabsContent value="financial" className="space-y-6 mt-6">
          {/* Revenue Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.totalRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">This month</p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <Icon icon="solar:dollar-bold-duotone" className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Medical Aid Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.medicalAidRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {((stats.medicalAidRevenue / stats.totalRevenue) * 100 || 0).toFixed(1)}% of total
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Icon icon="solar:card-bold-duotone" className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </motion.div>

            <motion.div whileHover={{ y: -4 }} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Patient Revenue</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">
                    ${stats.patientRevenue.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {((stats.patientRevenue / stats.totalRevenue) * 100 || 0).toFixed(1)}% of total
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Icon icon="solar:user-bold-duotone" className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Revenue by Payment Type */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Revenue Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Medical Aid', value: stats.medicalAidRevenue },
                      { name: 'Patient Payments', value: stats.patientRevenue }
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill="#3b82f6" />
                    <Cell fill="#8b5cf6" />
                  </Pie>
                  <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Revenue by Service Type */}
          <Card className="shadow-sm border-0">
            <CardHeader>
              <CardTitle className="text-lg font-semibold">Revenue by Service Type</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.revenueByService.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={stats.revenueByService}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="service" stroke="#6b7280" fontSize={12} />
                    <YAxis stroke="#6b7280" fontSize={12} />
                    <Tooltip content={<CustomTooltip />} formatter={(value: number) => `$${value.toLocaleString()}`} />
                    <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]}>
                      {stats.revenueByService.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS.success[index % CHART_COLORS.success.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No service revenue data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Main Encounters Page Component
const Encounters: React.FC = () => {
  const { practiceId } = usePractice();
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [activeLabSubTab, setActiveLabSubTab] = useState<string>('requests');
  const [activeImagingSubTab, setActiveImagingSubTab] = useState<string>('requests');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalVisits: 0,
    completedVisits: 0,
    pendingVisits: 0,
    todayVisits: 0,
    monthlyVisits: 0,
    lastMonthVisits: 0,
    avgVisitDuration: 25,
    noShowRate: 0,
    pendingLabs: 0,
    completedLabs: 0,
    pendingImaging: 0,
    completedImaging: 0,
    totalPrescriptions: 0,
    totalRevenue: 0,
    medicalAidRevenue: 0,
    patientRevenue: 0,
    providerProductivity: {},
    visitTypes: {},
    departmentDistribution: {},
    monthlyTrends: [],
    diagnosisDistribution: [],
    topMedications: [],
    revenueByService: [],
    hourlyDistribution: [],
    visitDurationDistribution: [],
  });

  // Fetch comprehensive statistics
  useEffect(() => {
    if (practiceId) {
      fetchDashboardStats();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceId]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      
      // Get current month date range
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const lastMonthStart = startOfMonth(subMonths(now, 1));
      const lastMonthEnd = endOfMonth(subMonths(now, 1));

      // Fetch all data in parallel for performance
      const [
        visitsData,
        labsData,
        imagingData,
        medicationsData,
        monthlyTrendsData,
        diagnosisData,
        revenueData,
        medicationUsageData
      ] = await Promise.all([
        // Visits data
        supabase
          .from('visits')
          .select('*, doctor:doctor_id(full_name)')
          .eq('practice_id', practiceId),
        
        // Lab requests
        supabase
          .from('lab_requests')
          .select('*')
          .eq('practice_id', practiceId),
        
        // Imaging requests
        supabase
          .from('imaging_requests')
          .select('*')
          .eq('practice_id', practiceId),
        
        // Medications
        supabase
          .from('medications')
          .select('*')
          .eq('practice_id', practiceId),
        
        // Monthly trends
        supabase.rpc('get_visit_trends_by_month', { p_practice_id: practiceId }).select('*'),
        
        // Diagnosis distribution
        supabase
          .from('visits')
          .select('diagnosis')
          .eq('practice_id', practiceId)
          .not('diagnosis', 'is', null)
          .not('diagnosis', 'eq', ''),
        
        // Revenue data
        supabase
          .from('invoices_enhanced')
          .select('*')
          .eq('practice_id', practiceId)
          .gte('created_at', monthStart.toISOString())
          .lte('created_at', monthEnd.toISOString()),
        
        // Medication usage
        supabase
          .from('medications')
          .select('medication_name')
          .eq('practice_id', practiceId)
          .not('medication_name', 'is', null),
      ]);

      const visits = visitsData.data || [];
      const labs = labsData.data || [];
      const imaging = imagingData.data || [];
      const medications = medicationsData.data || [];
      const invoices = revenueData.data || [];

      // Calculate basic statistics
      const totalVisits = visits.length;
      const completedVisits = visits.filter(v => v.status === 'completed').length;
      const pendingVisits = visits.filter(v => v.status === 'in-progress' || v.status === 'scheduled').length;
      const todayVisits = visits.filter(v => v.visit_date && isToday(parseISO(v.visit_date))).length;
      
      const monthlyVisits = visits.filter(v => {
        if (!v.visit_date) return false;
        const visitDate = parseISO(v.visit_date);
        return visitDate >= monthStart && visitDate <= monthEnd;
      }).length;

      const lastMonthVisits = visits.filter(v => {
        if (!v.visit_date) return false;
        const visitDate = parseISO(v.visit_date);
        return visitDate >= lastMonthStart && visitDate <= lastMonthEnd;
      }).length;

      // Calculate no-show rate
      const cancelledVisits = visits.filter(v => v.is_cancelled).length;
      const noShowRate = totalVisits > 0 ? Math.round((cancelledVisits / totalVisits) * 100) : 0;

      // Lab and imaging stats
      const pendingLabs = labs.filter(l => l.status === 'pending').length;
      const completedLabs = labs.filter(l => l.status === 'completed').length;
      const pendingImaging = imaging.filter(i => i.status === 'pending').length;
      const completedImaging = imaging.filter(i => i.status === 'completed').length;

      // Provider productivity
      const providerProductivity: { [key: string]: number } = {};
      visits.forEach(visit => {
        const doctorName = visit.doctor?.full_name || 'Unknown Provider';
        providerProductivity[doctorName] = (providerProductivity[doctorName] || 0) + 1;
      });

      // Visit types distribution
      const visitTypes: { [key: string]: number } = {};
      visits.forEach(visit => {
        const type = visit.visit_type || 'General Consultation';
        visitTypes[type] = (visitTypes[type] || 0) + 1;
      });

      // Process diagnosis distribution
      const diagnosisCounts: { [key: string]: number } = {};
      (diagnosisData.data || []).forEach(visit => {
        if (visit.diagnosis) {
          diagnosisCounts[visit.diagnosis] = (diagnosisCounts[visit.diagnosis] || 0) + 1;
        }
      });
      
      const diagnosisDistribution = Object.entries(diagnosisCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([diagnosis, count]) => ({ diagnosis, count }));

      // Process monthly trends - use actual data or create sample
      interface MonthlyTrendItem {
        month: string;
        visit_count: number;
        completed_count: number;
        cancelled_count: number;
      }
      
      const monthlyTrends = monthlyTrendsData.data?.length > 0 
        ? monthlyTrendsData.data.map((item: MonthlyTrendItem) => ({
            month: format(parseISO(item.month), 'MMM yyyy'),
            totalVisits: item.visit_count,
            completedVisits: item.completed_count,
            cancelledVisits: item.cancelled_count
          }))
        : Array.from({ length: 12 }, (_, i) => {
            const date = subMonths(now, 11 - i);
            const monthVisits = visits.filter(v => {
              if (!v.visit_date) return false;
              const visitDate = parseISO(v.visit_date);
              return visitDate.getMonth() === date.getMonth() && 
                     visitDate.getFullYear() === date.getFullYear();
            });
            return {
              month: format(date, 'MMM yyyy'),
              totalVisits: monthVisits.length,
              completedVisits: monthVisits.filter(v => v.status === 'completed').length,
              cancelledVisits: monthVisits.filter(v => v.is_cancelled).length
            };
          });

      // Process medication data
      const medicationCounts: { [key: string]: number } = {};
      (medicationUsageData.data || []).forEach(med => {
        if (med.medication_name) {
          medicationCounts[med.medication_name] = (medicationCounts[med.medication_name] || 0) + 1;
        }
      });
      
      const topMedications = Object.entries(medicationCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

      // Calculate revenue
      const totalRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
      const medicalAidRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.medical_aid_total) || 0), 0);
      const patientRevenue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.patient_total) || 0), 0);

      // Mock department distribution (since it's not in the database)
      const departmentDistribution = {
        'General Practice': 40,
        'Dental': 30,
        'Specialist': 20,
        'Emergency': 10,
      };

      // Mock visit duration distribution
      const visitDurationDistribution = [
        { duration: '0-15 min', count: 15 },
        { duration: '15-30 min', count: 45 },
        { duration: '30-45 min', count: 25 },
        { duration: '45-60 min', count: 10 },
        { duration: '60+ min', count: 5 },
      ];

      setStats({
        totalVisits,
        completedVisits,
        pendingVisits,
        todayVisits,
        monthlyVisits,
        lastMonthVisits,
        avgVisitDuration: 25,
        noShowRate,
        pendingLabs,
        completedLabs,
        pendingImaging,
        completedImaging,
        totalPrescriptions: medications.length,
        totalRevenue,
        medicalAidRevenue,
        patientRevenue,
        providerProductivity,
        visitTypes,
        departmentDistribution,
        monthlyTrends,
        diagnosisDistribution,
        topMedications,
        revenueByService: [],
        hourlyDistribution: [],
        visitDurationDistribution,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const tabIcons = {
    dashboard: "solar:chart-square-bold-duotone",
    labs: "solar:test-tube-bold-duotone",
    imaging: "solar:scan-bold-duotone",
    followup: "solar:calendar-add-bold-duotone",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header Section - Following Settings Page Style */}
        <div className="rounded-xl">
          <div className="p-4 md:p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <Icon icon="solar:clipboard-list-bold-duotone" className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-800">Encounters</h1>
                <p className="text-sm text-gray-500 mt-0.5">Comprehensive encounter management and analytics</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation - Following Settings Page Style */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
          <div className="grid grid-cols-4 gap-0 w-full">
            {(['dashboard', 'labs', 'imaging', 'followup'] as const).map((tab) => {
              const iconName = tabIcons[tab];
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-3 sm:py-4 text-xs sm:text-sm font-medium transition-all duration-200 capitalize min-h-[60px] ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-lg'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Icon icon={iconName} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                  <span className="truncate text-center sm:text-left">{tab === 'followup' ? 'Follow-up' : tab}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="min-h-[600px]">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <EncountersDashboard stats={stats} />
              </motion.div>
            )}

            {activeTab === 'labs' && (
              <motion.div
                key="labs"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3 -ml-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <Icon icon="solar:test-tube-bold-duotone" className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Laboratory Management</CardTitle>
                        <p className="text-sm text-gray-500">Manage lab requests and results</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeLabSubTab} onValueChange={setActiveLabSubTab}>
                      <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="requests">Lab Requests</TabsTrigger>
                        <TabsTrigger value="results">Lab Results</TabsTrigger>
                        <TabsTrigger value="pending">Pending Tests</TabsTrigger>
                      </TabsList>
                      <TabsContent value="requests" className="mt-6">
                        <LaboratoryTabContent />
                      </TabsContent>
                      <TabsContent value="results" className="mt-6">
                        <div className="text-center py-12">
                          <Icon icon="solar:document-text-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">Lab results management coming soon</p>
                        </div>
                      </TabsContent>
                      <TabsContent value="pending" className="mt-6">
                        <div className="text-center py-12">
                          <Icon icon="solar:clock-circle-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">Pending tests tracking coming soon</p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'imaging' && (
              <motion.div
                key="imaging"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3 -ml-2">
                      <div className="p-2 bg-purple-100 rounded-lg">
                        <Icon icon="solar:scan-bold-duotone" className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Imaging Management</CardTitle>
                        <p className="text-sm text-gray-500">Manage imaging requests and results</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeImagingSubTab} onValueChange={setActiveImagingSubTab}>
                      <TabsList className="grid grid-cols-3 w-full">
                        <TabsTrigger value="requests">Imaging Requests</TabsTrigger>
                        <TabsTrigger value="results">Imaging Results</TabsTrigger>
                        <TabsTrigger value="pending">Pending Scans</TabsTrigger>
                      </TabsList>
                      <TabsContent value="requests" className="mt-6">
                        <ImagingTabContent />
                      </TabsContent>
                      <TabsContent value="results" className="mt-6">
                        <div className="text-center py-12">
                          <Icon icon="solar:gallery-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">Imaging results management coming soon</p>
                        </div>
                      </TabsContent>
                      <TabsContent value="pending" className="mt-6">
                        <div className="text-center py-12">
                          <Icon icon="solar:hourglass-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">Pending scans tracking coming soon</p>
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'diagnostics' && (
              <motion.div
                key="diagnostics"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3 -ml-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <Icon icon="solar:document-medicine-bold-duotone" className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Diagnostic Codes</CardTitle>
                        <p className="text-sm text-gray-500">Manage ICD-10 codes and diagnoses</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Diagnosis Distribution Chart */}
                      <div>
                        <h3 className="text-md font-semibold text-gray-800 mb-4">Current Diagnosis Distribution</h3>
                        <ResponsiveContainer width="100%" height={400}>
                          <BarChart data={stats.diagnosisDistribution}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis dataKey="diagnosis" angle={-45} textAnchor="end" height={100} fontSize={12} />
                            <YAxis stroke="#6b7280" fontSize={12} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="count" fill="#6366f1" radius={[8, 8, 0, 0]}>
                              {stats.diagnosisDistribution.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                      
                      <div className="text-center py-8 border-t">
                        <Icon icon="solar:code-square-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <p className="text-gray-500 mb-2">ICD-10 code management coming soon</p>
                        <p className="text-xs text-gray-400">Currently using free-text diagnosis field</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'prescriptions' && (
              <motion.div
                key="prescriptions"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="bg-white rounded-lg border border-gray-200 shadow-sm">
                  <CardHeader>
                    <div className="flex items-center gap-3 -ml-2">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <Icon icon="solar:pills-3-bold-duotone" className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <CardTitle className="text-lg font-semibold text-gray-900">Prescriptions</CardTitle>
                        <p className="text-sm text-gray-500">Medication management and analytics</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Total Prescriptions</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.totalPrescriptions}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">Unique Medications</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.topMedications.length}</p>
                        </div>
                        <div className="bg-gray-50 rounded-lg p-4">
                          <p className="text-sm text-gray-600">This Month</p>
                          <p className="text-2xl font-bold text-gray-900">{stats.totalPrescriptions}</p>
                        </div>
                      </div>

                      {/* Top Medications Chart */}
                      {stats.topMedications.length > 0 ? (
                        <div>
                          <h3 className="text-md font-semibold text-gray-800 mb-4">Most Prescribed Medications</h3>
                          <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={stats.topMedications} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                              <XAxis type="number" stroke="#6b7280" fontSize={12} />
                              <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={12} width={150} />
                              <Tooltip content={<CustomTooltip />} />
                              <Bar dataKey="count" fill="#6366f1" radius={[0, 8, 8, 0]}>
                                {stats.topMedications.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={CHART_COLORS.primary[index % CHART_COLORS.primary.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <Icon icon="solar:jar-of-pills-2-bold-duotone" className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                          <p className="text-gray-500">No prescription data available</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {activeTab === 'followup' && (
              <motion.div
                key="followup"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <FollowUpAutomationTab />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};

export default Encounters;