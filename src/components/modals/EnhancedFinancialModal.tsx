import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  X, 
  TrendingUp,
  TrendingDown,
  PieChart,
  BarChart3,
  DollarSign,
  Filter,
  Download,
  Printer,
  Target,
  CreditCard,
  Clock,
  Users
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  PieChart as RechartsPieChart,
  Pie,
  Cell, 
  ResponsiveContainer, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ComposedChart,
  Area,
  AreaChart
} from 'recharts';
import { supabase } from '../../lib/supabase';

interface FinancialKPIs {
  totalBilledMTD: number;
  totalCollectedMTD: number;
  totalOutstanding: number;
  claimsInProgress: number;
  monthlyRevenueTrend: { month: string; revenue: number; medical_aid: number; patient: number }[];
  invoiceVolumeTrend: { month: string; count: number }[];
  revenueByStatus: { name: string; value: number; color: string }[];
  topServices: { name: string; revenue: number; count: number; avg: number }[];
  medicalAidBreakdown: { provider: string; value: number; percentage: number }[];
  practitionerPerformance: { name: string; revenue: number; patients: number }[];
}

interface FinancialData {
  type: 'finance';
  title: string;
  subtitle: string;
  overview: {
    total: number;
    change: string;
    isPositive: boolean;
    period: string;
  };
  breakdown: {
    label: string;
    value: number;
    percentage: number;
    color: string;
  }[];
  chartData: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
    }[];
  };
  timeSeriesData?: {
    labels: string[];
    datasets: {
      label: string;
      data: number[];
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
    }[];
  };
  insights: string[];
  actionItems?: string[];
}

interface EnhancedFinancialModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: FinancialData;
}

// Color palette for consistent theming
const COLORS = {
  primary: '#8B5CF6',
  secondary: '#06B6D4', 
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280',
  light: '#F3F4F6'
};

const PIE_COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#EC4899'];

const EnhancedFinancialModal: React.FC<EnhancedFinancialModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'insights'>('overview');
  const [dateRange, setDateRange] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [loading, setLoading] = useState(false);

  // Optimized data fetching with minimal queries
  const fetchFinancialKPIs = useCallback(async () => {
    setLoading(true);
    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      
      // Calculate date ranges based on selection
      const monthsBack = dateRange === '30d' ? 1 : 
                        dateRange === '3m' ? 3 : 
                        dateRange === '6m' ? 6 : 12;
      
      const periodStart = subMonths(now, monthsBack);

      // Single optimized query for invoices data
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices_enhanced')
        .select(`
          id,
          total,
          medical_aid_total,
          patient_total,
          payment_status,
          issue_date,
          due_date,
          practitioner_id,
          patient_id
        `)
        .gte('issue_date', periodStart.toISOString().split('T')[0])
        .order('issue_date', { ascending: false });

      // Single query for services data
      const { data: servicesData, error: servicesError } = await supabase
        .from('invoice_services')
        .select(`
          description,
          total_price,
          quantity,
          invoice_id
        `);

      // Single query for batch data (claims in progress)
      const { data: batchData, error: batchError } = await supabase
        .from('batch_headers')
        .select('total_amount, status')
        .eq('status', 'sent');

      if (invoicesError) throw invoicesError;
      if (servicesError) throw servicesError;
      if (batchError) throw batchError;

      const invoices = invoicesData || [];
      const services = servicesData || [];
      const batches = batchData || [];

      // Calculate KPIs efficiently
      const totalBilledMTD = invoices
        .filter(inv => new Date(inv.issue_date) >= monthStart)
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      const totalCollectedMTD = invoices
        .filter(inv => inv.payment_status === 'paid' && new Date(inv.issue_date) >= monthStart)
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      const totalOutstanding = invoices
        .filter(inv => inv.payment_status === 'pending' || inv.payment_status === 'overdue')
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      const claimsInProgress = batches
        .reduce((sum, batch) => sum + parseFloat(batch.total_amount || '0'), 0);

      // Monthly revenue trend (last 6 months)
      const monthlyRevenueTrend = [];
      for (let i = 5; i >= 0; i--) {
        const month = subMonths(now, i);
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        
        const monthInvoices = invoices.filter(inv => {
          const issueDate = new Date(inv.issue_date);
          return issueDate >= monthStart && issueDate <= monthEnd;
        });

        monthlyRevenueTrend.push({
          month: format(month, 'MMM yyyy'),
          revenue: monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0),
          medical_aid: monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.medical_aid_total || '0'), 0),
          patient: monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.patient_total || '0'), 0)
        });
      }

      // Invoice volume trend
      const invoiceVolumeTrend = monthlyRevenueTrend.map(trend => ({
        month: trend.month,
        count: invoices.filter(inv => {
          const issueDate = new Date(inv.issue_date);
          const monthStart = startOfMonth(new Date(trend.month + ' 1'));
          const monthEnd = endOfMonth(monthStart);
          return issueDate >= monthStart && issueDate <= monthEnd;
        }).length
      }));

      // Revenue by payment status
      const paid = invoices.filter(inv => inv.payment_status === 'paid')
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
      const pending = invoices.filter(inv => inv.payment_status === 'pending')
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
      const overdue = invoices.filter(inv => inv.payment_status === 'overdue')
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      const revenueByStatus = [
        { name: 'Paid', value: paid, color: COLORS.success },
        { name: 'Pending', value: pending, color: COLORS.warning },
        { name: 'Overdue', value: overdue, color: COLORS.danger }
      ].filter(item => item.value > 0);

      // Top 5 services by revenue (filter by invoice IDs in date range)
      const invoiceIds = new Set(invoices.map(inv => inv.id));
      const filteredServices = services.filter(service => 
        service.invoice_id && invoiceIds.has(service.invoice_id)
      );
      
      const serviceGroups = filteredServices.reduce((acc, service) => {
        const key = service.description || 'Unknown Service';
        if (!acc[key]) {
          acc[key] = { name: key, revenue: 0, count: 0 };
        }
        acc[key].revenue += parseFloat(service.total_price || '0');
        acc[key].count += service.quantity || 1;
        return acc;
      }, {} as Record<string, { name: string; revenue: number; count: number }>);

      const topServices = Object.values(serviceGroups)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5)
        .map(service => ({
          ...service,
          avg: service.count > 0 ? service.revenue / service.count : 0
        }));

      // Get medical aid data separately for breakdown
      const patientIds = [...new Set(invoices.map(inv => inv.patient_id).filter(Boolean))];
      let medicalAidBreakdown: { provider: string; value: number; percentage: number }[] = [];
      
      if (patientIds.length > 0) {
        const { data: medicalAidData } = await supabase
          .from('medical_aid_details')
          .select('patient_id, provider')
          .in('patient_id', patientIds);

        if (medicalAidData) {
          // Create lookup map for patient medical aid providers
          const patientProviderMap = medicalAidData.reduce((acc, item) => {
            acc[item.patient_id] = item.provider;
            return acc;
          }, {} as Record<string, string>);

          // Calculate medical aid breakdown
          const medicalAidGroups = invoices
            .filter(inv => inv.patient_id && patientProviderMap[inv.patient_id])
            .reduce((acc, inv) => {
              const provider = patientProviderMap[inv.patient_id!];
              if (!acc[provider]) {
                acc[provider] = 0;
              }
              acc[provider] += parseFloat(inv.medical_aid_total || '0');
              return acc;
            }, {} as Record<string, number>);

          const totalMedicalAid = Object.values(medicalAidGroups).reduce((sum, value) => sum + value, 0);
          medicalAidBreakdown = Object.entries(medicalAidGroups)
            .map(([provider, value]) => ({
              provider,
              value,
              percentage: totalMedicalAid > 0 ? (value / totalMedicalAid) * 100 : 0
            }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 5);
        }
      }

      // Practitioner performance (simplified)
      const practitionerGroups = invoices
        .filter(inv => inv.practitioner_id)
        .reduce((acc, inv) => {
          const practitionerId = inv.practitioner_id;
          if (!acc[practitionerId]) {
            acc[practitionerId] = { revenue: 0, patients: new Set() };
          }
          acc[practitionerId].revenue += parseFloat(inv.total || '0');
          if (inv.patient_id) {
            acc[practitionerId].patients.add(inv.patient_id);
          }
          return acc;
        }, {} as Record<string, { revenue: number; patients: Set<string> }>);

      const practitionerPerformance = Object.entries(practitionerGroups)
        .map(([id, data]) => ({
          name: `Practitioner ${id.slice(0, 8)}`, // Simplified name
          revenue: data.revenue,
          patients: data.patients.size
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setKpis({
        totalBilledMTD,
        totalCollectedMTD,
        totalOutstanding,
        claimsInProgress,
        monthlyRevenueTrend,
        invoiceVolumeTrend,
        revenueByStatus,
        topServices,
        medicalAidBreakdown,
        practitionerPerformance
      });

    } catch (error) {
      console.error('Error fetching financial KPIs:', error);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    if (isOpen) {
      fetchFinancialKPIs();
    }
  }, [isOpen, fetchFinancialKPIs]);

  if (!isOpen) return null;

  const renderKPICards = () => {
    if (!kpis) return null;

    const kpiData = [
      {
        title: 'Total Billed (MTD)',
        value: `N$${kpis.totalBilledMTD.toLocaleString()}`,
        icon: DollarSign,
        color: COLORS.primary,
        change: '+12.3%'
      },
      {
        title: 'Total Collected (MTD)', 
        value: `N$${kpis.totalCollectedMTD.toLocaleString()}`,
        icon: CreditCard,
        color: COLORS.success,
        change: '+8.7%'
      },
      {
        title: 'Total Outstanding',
        value: `N$${kpis.totalOutstanding.toLocaleString()}`,
        icon: Clock,
        color: COLORS.warning,
        change: '-5.2%'
      },
      {
        title: 'Claims in Progress',
        value: `N$${kpis.claimsInProgress.toLocaleString()}`,
        icon: Target,
        color: COLORS.secondary,
        change: '+2.1%'
      }
    ];

    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {kpiData.map((kpi, index) => (
          <motion.div
            key={kpi.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between mb-2">
              <kpi.icon className="w-5 h-5 text-gray-400" />
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                kpi.change.startsWith('+') ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {kpi.change}
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 font-rubik mb-1">{kpi.value}</p>
            <p className="text-sm text-gray-600">{kpi.title}</p>
          </motion.div>
        ))}
      </div>
    );
  };

  const renderCharts = () => {
    if (!kpis) return null;

    return (
      <div className="space-y-6">
        {/* Monthly Revenue Trend */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Monthly Revenue Trend
          </h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={kpis.monthlyRevenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                />
                <YAxis 
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={{ stroke: '#E5E7EB' }}
                  tickFormatter={(value) => `N$${(value / 1000).toFixed(0)}k`}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: '#374151',
                    border: 'none',
                    borderRadius: '8px',
                    color: 'white',
                    fontSize: '12px'
                  }}
                  formatter={(value: number, name: string) => [
                    `N$${value.toLocaleString()}`,
                    name === 'medical_aid' ? 'Medical Aid' : name === 'patient' ? 'Patient' : 'Total Revenue'
                  ]}
                />
                <Legend />
                <Area 
                  type="monotone" 
                  dataKey="revenue" 
                  stroke={COLORS.primary} 
                  fill={COLORS.primary} 
                  fillOpacity={0.1}
                  name="Total Revenue"
                />
                <Bar dataKey="medical_aid" fill={COLORS.secondary} name="Medical Aid" />
                <Bar dataKey="patient" fill={COLORS.success} name="Patient" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue by Status & Top Services */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by Payment Status */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Revenue by Payment Status
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <RechartsPieChart>
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`N$${value.toLocaleString()}`, 'Amount']}
                  />
                  <Pie
                    data={kpis.revenueByStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={30}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {kpis.revenueByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Invoice Volume Trend */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              Invoice Volume Trend
            </h4>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={kpis.invoiceVolumeTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis 
                    dataKey="month" 
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <YAxis 
                    tick={{ fontSize: 12, fill: '#6B7280' }}
                    axisLine={{ stroke: '#E5E7EB' }}
                  />
                  <Tooltip 
                    contentStyle={{
                      backgroundColor: '#374151',
                      border: 'none',
                      borderRadius: '8px',
                      color: 'white',
                      fontSize: '12px'
                    }}
                    formatter={(value: number) => [`${value} invoices`, 'Count']}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Top Services Table */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Top 5 Services by Revenue</h4>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Service</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Count</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Revenue</th>
                  <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {kpis.topServices.map((service, index) => (
                  <tr key={service.name} className="border-b border-gray-100">
                    <td className="py-2 px-3 text-sm font-medium text-gray-800">
                      {service.name.length > 30 ? service.name.substring(0, 30) + '...' : service.name}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600">{service.count}</td>
                    <td className="py-2 px-3 text-sm font-semibold text-gray-900 font-rubik">
                      N${service.revenue.toLocaleString()}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600 font-rubik">
                      N${service.avg.toFixed(0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-7xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-500 to-indigo-600 p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{data.title}</h2>
                <p className="text-white/80">{data.subtitle}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-white/20 rounded-lg px-3 py-2">
                <Filter className="w-4 h-4" />
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                  className="bg-transparent border-none text-white text-sm focus:outline-none"
                >
                  <option value="30d" className="text-gray-900">30 Days</option>
                  <option value="3m" className="text-gray-900">3 Months</option>
                  <option value="6m" className="text-gray-900">6 Months</option>
                  <option value="12m" className="text-gray-900">12 Months</option>
                </select>
              </div>
              <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                <Download className="w-5 h-5" />
              </button>
              <button className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors">
                <Printer className="w-5 h-5" />
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8 px-6">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'analytics', label: 'Financial Analytics', icon: TrendingUp },
              { key: 'insights', label: 'Insights', icon: Users }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as typeof activeTab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 flex items-center gap-2 ${
                  activeTab === key
                    ? 'border-purple-500 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading financial analytics...</p>
              </div>
            </div>
          )}

          {!loading && !kpis && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No financial data available</p>
              <button
                onClick={fetchFinancialKPIs}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && kpis && (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {renderKPICards()}
                  {renderCharts()}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {renderKPICards()}
                  {renderCharts()}
                  
                  {/* Medical Aid Breakdown */}
                  {kpis.medicalAidBreakdown.length > 0 && (
                    <div className="bg-gray-50 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">Medical Aid Revenue Breakdown</h4>
                      <div className="space-y-3">
                        {kpis.medicalAidBreakdown.map((provider, index) => (
                          <div key={provider.provider} className="flex items-center justify-between">
                            <span className="font-medium text-gray-700">{provider.provider}</span>
                            <div className="flex items-center gap-3">
                              <div className="w-24 bg-gray-200 rounded-full h-2">
                                <div 
                                  className="h-2 rounded-full bg-purple-500" 
                                  style={{ width: `${provider.percentage}%` }}
                                />
                              </div>
                              <span className="font-semibold text-gray-900 w-20 text-right font-rubik">
                                N${provider.value.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="space-y-6">
                  {/* Key Insights */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.insights.map((insight, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-blue-50 border border-blue-200 rounded-lg p-4"
                      >
                        <p className="text-blue-800 font-medium">{insight}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Action Items */}
                  {data.actionItems && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">Recommended Actions</h4>
                      <div className="space-y-3">
                        {data.actionItems.map((action, index) => (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                          >
                            <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0" />
                            <p className="text-amber-800">{action}</p>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default EnhancedFinancialModal;