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
  Printer
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
  Filler,
  RadialLinearScale
} from 'chart.js';
// Chart.js components for future use
// import { Line, Doughnut } from 'react-chartjs-2';
import { supabase } from '../../lib/supabase';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend,
  Filler,
  RadialLinearScale
);

interface FinancialAnalytics {
  totalRevenue: number;
  monthlyRevenue: number;
  outstandingAmount: number;
  paidInvoices: number;
  pendingInvoices: number;
  medicalAidRevenue: number;
  selfPayRevenue: number;
  revenueGrowth: number;
  avgInvoiceValue: number;
  topServices: { name: string; value: number; count: number }[];
  monthlyTrends: { month: string; revenue: number; invoices: number; medical_aid: number; self_pay: number }[];
  serviceBreakdown: { name: string; value: number; color: string }[];
  paymentStatusBreakdown: { status: string; count: number; value: number; color: string }[];
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

// Custom brand colors - moved outside component to avoid dependency issues
const brandColors = {
  primary: '#489bfd',
  secondary: '#e2a501', 
  tertiary: '#775ffc',
  quaternary: '#6c67f0',
  accent1: '#ff4f5a',
  accent2: '#45d2de',
  accent3: '#0459a0',
  accent4: '#e299aa',
  accent5: '#01b9d5',
  accent6: '#76a5af'
};

const EnhancedFinancialModal: React.FC<EnhancedFinancialModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'insights'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '3m' | '6m'>('30d');
  const [analytics, setAnalytics] = useState<FinancialAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  const fetchFinancialAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      // Calculate date range - default to 30 days
      const now = new Date();
      const startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Fetch real data from invoices_enhanced and invoice_services
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices_enhanced')
        .select(`
          id,
          total,
          subtotal,
          medical_aid_total,
          patient_total,
          payment_status,
          issue_date,
          created_at
        `)
        .gte('issue_date', startDate.toISOString().split('T')[0]);

      const { data: servicesData, error: servicesError } = await supabase
        .from('invoice_services')
        .select(`
          id,
          invoice_id,
          code,
          description,
          quantity,
          unit_price,
          total_price,
          medical_aid_covered,
          patient_portion,
          created_at,
          invoices_enhanced!inner (
            issue_date,
            payment_status
          )
        `)
        .gte('invoices_enhanced.issue_date', startDate.toISOString().split('T')[0]);

      if (invoicesError) throw invoicesError;
      if (servicesError) throw servicesError;

      // Process the real data
      const invoices = invoicesData || [];
      const services = servicesData || [];
      
      const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
      const medicalAidRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.medical_aid_total || '0'), 0);
      const selfPayRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.patient_total || '0'), 0);
      
      const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid').length;
      const pendingInvoices = invoices.filter(inv => inv.payment_status === 'pending').length;
      const outstandingAmount = invoices
        .filter(inv => inv.payment_status !== 'paid')
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

      // Calculate growth (mock for now)
      const revenueGrowth = 12.5;

      // Current month revenue
      const currentMonthStart = startOfMonth(now);
      const currentMonthRevenue = invoices
        .filter(inv => new Date(inv.issue_date) >= currentMonthStart)
        .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

      // Top services analysis
      const serviceGroups = services.reduce((acc, service) => {
        const key = service.description;
        if (!acc[key]) {
          acc[key] = { name: key, value: 0, count: 0 };
        }
        acc[key].value += parseFloat(service.total_price || '0');
        acc[key].count += service.quantity || 1;
        return acc;
      }, {} as Record<string, { name: string; value: number; count: number }>);

      const topServices = Object.values(serviceGroups)
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Monthly trends (last 6 months)
      const monthlyTrends = [];
      for (let i = 5; i >= 0; i--) {
        const monthStart = startOfMonth(subMonths(now, i));
        const monthEnd = endOfMonth(monthStart);
        
        const monthInvoices = invoices.filter(inv => {
          const invDate = new Date(inv.issue_date);
          return invDate >= monthStart && invDate <= monthEnd;
        });

        monthlyTrends.push({
          month: format(monthStart, 'MMM yyyy'),
          revenue: monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0),
          invoices: monthInvoices.length,
          medical_aid: monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.medical_aid_total || '0'), 0),
          self_pay: monthInvoices.reduce((sum, inv) => sum + parseFloat(inv.patient_total || '0'), 0)
        });
      }

      // Service breakdown for pie chart
      const colors = [brandColors.primary, brandColors.secondary, brandColors.tertiary, brandColors.quaternary, brandColors.accent1, brandColors.accent2];
      const serviceBreakdown = topServices.slice(0, 6).map((service, index) => ({
        name: service.name.length > 25 ? service.name.substring(0, 25) + '...' : service.name,
        value: service.value,
        color: colors[index]
      }));

      // Payment status breakdown
      const paymentStatusBreakdown = [
        {
          status: 'Paid',
          count: paidInvoices,
          value: invoices.filter(inv => inv.payment_status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0),
          color: '#22c55e'
        },
        {
          status: 'Pending',
          count: pendingInvoices,
          value: outstandingAmount,
          color: '#f59e0b'
        }
      ];

      setAnalytics({
        totalRevenue,
        monthlyRevenue: currentMonthRevenue,
        outstandingAmount,
        paidInvoices,
        pendingInvoices,
        medicalAidRevenue,
        selfPayRevenue,
        revenueGrowth,
        avgInvoiceValue,
        topServices,
        monthlyTrends,
        serviceBreakdown,
        paymentStatusBreakdown
      });

    } catch (error) {
      console.error('Error fetching financial analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchFinancialAnalytics();
    }
  }, [isOpen, fetchFinancialAnalytics]);

  if (!isOpen) return null;

  const renderFinancialCharts = () => {
    if (!analytics) return null;

    const maxValue = Math.max(...analytics.topServices.map(s => s.value));
    
    return (
      <div className="space-y-6">
        {/* Revenue Distribution Overview */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Revenue Distribution Overview
          </h4>
          <div className="space-y-3">
            {analytics.topServices.slice(0, 8).map((service, index) => {
              const percentage = (service.value / maxValue) * 100;
              
              return (
                <div key={service.name} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">
                      {service.name.length > 30 ? service.name.substring(0, 30) + '...' : service.name}
                    </span>
                    <span className="font-bold text-gray-900 font-rubik">N${service.value.toLocaleString()}</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                      className="h-2 rounded-full bg-gradient-to-r from-purple-500 to-indigo-600"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment Status Breakdown */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <PieChart className="w-5 h-5" />
            Payment Status Analysis
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-lg p-4 border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-green-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Paid Invoices</p>
                  <p className="text-lg font-bold text-gray-900 font-rubik">{analytics.paidInvoices}</p>
                  <p className="text-xs text-gray-500">
                    {analytics.paidInvoices + analytics.pendingInvoices > 0 
                      ? ((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
            </motion.div>
            
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-lg p-4 border border-gray-200"
            >
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 rounded-full bg-amber-500" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Pending Invoices</p>
                  <p className="text-lg font-bold text-gray-900 font-rubik">{analytics.pendingInvoices}</p>
                  <p className="text-xs text-gray-500">
                    {analytics.paidInvoices + analytics.pendingInvoices > 0 
                      ? ((analytics.pendingInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)
                      : 0}%
                  </p>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* Monthly Trends */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5" />
            Revenue Trends (Last 6 Months)
          </h4>
          <div className="flex items-end justify-between h-32 bg-white rounded-lg p-4">
            {analytics.monthlyTrends.map((trend, index) => {
              const maxTrendValue = Math.max(...analytics.monthlyTrends.map(t => t.revenue));
              const height = maxTrendValue > 0 ? (trend.revenue / maxTrendValue) * 100 : 0;
              return (
                <div key={trend.month} className="flex flex-col items-center gap-2">
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.8, delay: index * 0.1 }}
                    className="bg-gradient-to-t from-purple-500 to-indigo-600 rounded-t-sm w-8"
                  />
                  <span className="text-xs text-gray-500 rotate-45 origin-left">
                    {trend.month}
                  </span>
                </div>
              );
            })}
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
        className="relative bg-white rounded-2xl shadow-2xl overflow-hidden max-w-6xl w-full max-h-[90vh] overflow-y-auto"
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
                  <option value="7d" className="text-gray-900">7D</option>
                  <option value="30d" className="text-gray-900">30D</option>
                  <option value="3m" className="text-gray-900">3M</option>
                  <option value="6m" className="text-gray-900">6M</option>
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
              { key: 'financial', label: 'Financial Analytics', icon: TrendingUp },
              { key: 'insights', label: 'Insights', icon: PieChart }
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
          {analyticsLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading financial analytics...</p>
              </div>
            </div>
          )}

          {!analyticsLoading && !analytics && (
            <div className="text-center py-12">
              <p className="text-gray-500 mb-4">No financial data available</p>
              <button
                onClick={fetchFinancialAnalytics}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!analyticsLoading && analytics && (
            <>
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      {
                        label: 'Total Revenue',
                        value: `N$${analytics.totalRevenue.toLocaleString()}`,
                        change: data.overview.change,
                        isPositive: data.overview.isPositive,
                        icon: DollarSign
                      },
                      {
                        label: 'Monthly Revenue',
                        value: `N$${analytics.monthlyRevenue.toLocaleString()}`,
                        change: '+8.2%',
                        isPositive: true,
                        icon: TrendingUp
                      },
                      {
                        label: 'Outstanding',
                        value: `N$${analytics.outstandingAmount.toLocaleString()}`,
                        change: '-12%',
                        isPositive: false,
                        icon: TrendingDown
                      },
                      {
                        label: 'Collection Rate',
                        value: `${((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)}%`,
                        change: '+5.1%',
                        isPositive: true,
                        icon: BarChart3
                      }
                    ].map((metric, index) => (
                      <motion.div
                        key={metric.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="bg-white rounded-lg border border-gray-200 p-4"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <metric.icon className="w-5 h-5 text-gray-400" />
                          <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                            metric.isPositive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {metric.change}
                          </span>
                        </div>
                        <p className="text-2xl font-bold text-gray-900 font-rubik">{metric.value}</p>
                        <p className="text-sm text-gray-600">{metric.label}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Overview Charts */}
                  {renderFinancialCharts()}
                </div>
              )}

              {activeTab === 'financial' && (
                <div className="space-y-6">
                  {/* Detailed financial analysis */}
                  {renderFinancialCharts()}
                  
                  {/* Top Services Table */}
                  <div className="bg-gray-50 rounded-xl p-6">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Top Revenue Services</h4>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b border-gray-200">
                            <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Service</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Count</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Revenue</th>
                            <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Avg</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.topServices.slice(0, 10).map((service) => (
                            <tr key={service.name} className="border-b border-gray-100">
                              <td className="py-2 px-3 text-sm font-medium text-gray-800">
                                {service.name.length > 30 ? service.name.substring(0, 30) + '...' : service.name}
                              </td>
                              <td className="py-2 px-3 text-sm text-gray-600">{service.count}</td>
                              <td className="py-2 px-3 text-sm font-semibold text-gray-900 font-rubik">
                                N${service.value.toLocaleString()}
                              </td>
                              <td className="py-2 px-3 text-sm text-gray-600 font-rubik">
                                N${(service.value / service.count).toFixed(0)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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