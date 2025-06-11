import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  X, 
  TrendingUp,
  PieChart,
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
import { Line, Doughnut } from 'react-chartjs-2';
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

interface EnhancedFinancialModalProps {
  isOpen: boolean;
  onClose: () => void;
  data?: Record<string, unknown>;
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
  onClose
}) => {
  const [analytics, setAnalytics] = useState<FinancialAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [selectedChartType, setSelectedChartType] = useState<'default' | 'line-area' | 'stacked-bars' | 'radar' | 'bubble' | 'polar' | 'scatter' | 'mixed'>('default');

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

  if (analyticsLoading) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-3xl p-12 text-center"
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className="w-16 h-16 border-4 border-gradient-to-r from-purple-400 to-pink-400 border-t-purple-600 rounded-full mx-auto mb-4"
          />
          <motion.p 
            className="text-gray-600 font-medium text-lg"
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            ✨ Loading your financial insights...
          </motion.p>
        </motion.div>
      </div>,
      document.body
    );
  }

  if (!analytics) {
    return createPortal(
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-12 text-center"
        >
          <div className="text-6xl mb-4">🎭</div>
          <p className="text-gray-500 text-lg">No financial data available - let's get started!</p>
          <button
            onClick={onClose}
            className="mt-4 px-6 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-colors"
          >
            Close
          </button>
        </motion.div>
      </div>,
      document.body
    );
  }

  // Chart configurations with real data
  const revenueChartData = {
    labels: analytics.monthlyTrends.map(trend => trend.month),
    datasets: [
      {
        label: 'Revenue',
        data: analytics.monthlyTrends.map(trend => trend.revenue),
        borderColor: brandColors.primary,
        backgroundColor: brandColors.primary + '20',
        borderWidth: 4,
        fill: selectedChartType === 'line-area',
        tension: 0.4,
        pointBackgroundColor: brandColors.primary,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 12
      }
    ]
  };

  const serviceDistributionData = {
    labels: analytics.serviceBreakdown.map(service => service.name),
    datasets: [
      {
        data: analytics.serviceBreakdown.map(service => service.value),
        backgroundColor: [
          brandColors.primary,
          brandColors.secondary,
          brandColors.tertiary,
          brandColors.quaternary,
          brandColors.accent1,
          brandColors.accent2
        ],
        borderColor: '#ffffff',
        borderWidth: 4,
        hoverOffset: 12
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: '#1f2937',
        bodyColor: '#374151',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        cornerRadius: 12,
        padding: 16,
        callbacks: {
          label: function(context: {dataset: {label: string}, parsed: {y: number}}) {
            return `${context.dataset.label}: N$${context.parsed.y?.toFixed(2) || 0}`;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(243, 244, 246, 0.8)',
          borderDash: [5, 5]
        },
        ticks: {
          color: '#6b7280',
          font: { size: 12 },
          callback: function(value: number) {
            return 'N$' + value.toLocaleString();
          }
        }
      },
      x: {
        grid: { display: false },
        ticks: {
          color: '#6b7280',
          font: { size: 12 }
        }
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-[9999]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative bg-gradient-to-br from-blue-50 via-white to-purple-50 rounded-3xl shadow-2xl overflow-hidden max-w-7xl w-full max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Joyful Header */}
        <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 p-8 text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12" />
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-4xl">💰</div>
              <div>
                <h2 className="text-3xl font-bold">Financial Analytics</h2>
                <p className="text-white/80">Your practice's success story</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
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

          {/* Header Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-8">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold font-rubik">N${analytics.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">This Month</p>
              <p className="text-xl font-bold font-rubik">N${analytics.monthlyRevenue.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Outstanding</p>
              <p className="text-lg font-semibold font-rubik">N${analytics.outstandingAmount.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Collection Rate</p>
              <p className="text-lg font-semibold font-rubik">
                {((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-8">
          {/* Performance Metrics Cards */}
          <motion.div 
            className="grid grid-cols-2 md:grid-cols-4 gap-6"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.6 }}
          >
            {[
              { 
                label: 'Total Invoices', 
                value: analytics.paidInvoices + analytics.pendingInvoices, 
                icon: '📊',
                color: 'from-blue-400 to-blue-600',
                change: '+12%'
              },
              { 
                label: 'Paid Invoices', 
                value: analytics.paidInvoices, 
                icon: '✅', 
                color: 'from-green-400 to-green-600',
                change: '+8%'
              },
              { 
                label: 'Pending Invoices', 
                value: analytics.pendingInvoices, 
                icon: '⏳', 
                color: 'from-yellow-400 to-orange-500',
                change: '-5%'
              },
              { 
                label: 'Avg Invoice', 
                value: `N$${analytics.avgInvoiceValue.toFixed(0)}`, 
                icon: '🎯',
                color: 'from-purple-400 to-purple-600',
                change: '+15%'
              }
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                whileHover={{ scale: 1.05, y: -5 }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-2xl">{stat.icon}</span>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">
                    {stat.change}
                  </span>
                </div>
                <p className="text-3xl font-bold font-rubik mb-1" style={{ color: brandColors.primary }}>
                  {stat.value}
                </p>
                <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Chart Type Selector */}
          <motion.div 
            className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="text-3xl">🎨</div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800">Chart Playground</h3>
                <p className="text-gray-500">Choose your visualization adventure</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
              {[
                { key: 'default', label: 'Classic Grid', icon: '📊' },
                { key: 'line-area', label: 'Smooth Lines', icon: '📈' },
                { key: 'stacked-bars', label: 'Stack Attack', icon: '📉' },
                { key: 'radar', label: 'Spider Web', icon: '🕸️' },
                { key: 'bubble', label: 'Bubble Fun', icon: '🫧' },
                { key: 'polar', label: 'Polar Bear', icon: '🎯' },
                { key: 'scatter', label: 'Star Field', icon: '⭐' },
                { key: 'mixed', label: 'Rainbow Mix', icon: '🌈' }
              ].map((chartType) => (
                <motion.button
                  key={chartType.key}
                  onClick={() => setSelectedChartType(chartType.key as typeof selectedChartType)}
                  className={`relative p-4 rounded-2xl text-center transition-all duration-300 ${
                    selectedChartType === chartType.key
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg scale-105'
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <div className="text-3xl mb-2">{chartType.icon}</div>
                  <div className="text-xs font-bold">{chartType.label}</div>
                </motion.button>
              ))}
            </div>
          </motion.div>

          {/* Main Charts Grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Revenue Chart */}
            <motion.div 
              className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600 shadow-lg">
                      <TrendingUp className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800">📈 Revenue Trends</h4>
                      <p className="text-gray-500 text-sm">Your growth trajectory</p>
                    </div>
                  </div>
                  <div className="text-2xl animate-pulse">🚀</div>
                </div>
                <div className="h-80">
                  <Line data={revenueChartData} options={chartOptions} />
                </div>
              </div>
            </motion.div>

            {/* Service Distribution */}
            <motion.div 
              className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
              whileHover={{ y: -5, scale: 1.02 }}
              transition={{ duration: 0.3 }}
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600 shadow-lg">
                      <PieChart className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-xl font-bold text-gray-800">🍰 Service Mix</h4>
                      <p className="text-gray-500 text-sm">Revenue slice by slice</p>
                    </div>
                  </div>
                  <div className="text-2xl animate-pulse">🎯</div>
                </div>
                <div className="h-80">
                  <Doughnut data={serviceDistributionData} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom' as const,
                        labels: {
                          padding: 20,
                          font: { size: 12 },
                          color: '#6b7280'
                        }
                      },
                      tooltip: {
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
                        titleColor: '#1f2937',
                        bodyColor: '#374151',
                        borderColor: '#e5e7eb',
                        borderWidth: 1,
                        cornerRadius: 12,
                        padding: 16,
                        callbacks: {
                          label: function(context: {dataset: {data: number[]}, parsed: number, label: string}) {
                            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: N$${context.parsed?.toFixed(2)} (${percentage}%)`;
                          }
                        }
                      }
                    },
                    cutout: '60%'
                  }} />
                </div>
              </div>
            </motion.div>
          </div>

          {/* Top Services Mini Table */}
          <motion.div 
            className="bg-white rounded-3xl p-8 shadow-xl border border-gray-100"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.6 }}
          >
            <div className="flex items-center gap-4 mb-6">
              <div className="text-3xl">🏆</div>
              <h3 className="text-2xl font-bold text-gray-800">Top Revenue Generators</h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Rank</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Service</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Count</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Revenue</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.topServices.slice(0, 8).map((service, index) => (
                    <motion.tr 
                      key={service.name}
                      className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.9 + index * 0.1 }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{['🥇', '🥈', '🥉', '🏅', '⭐', '💫', '✨', '🌟'][index]}</span>
                          <span className="font-medium text-gray-700">#{index + 1}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-medium text-gray-800">
                          {service.name.length > 40 ? service.name.substring(0, 40) + '...' : service.name}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-600">{service.count}x</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-bold font-rubik" style={{ color: Object.values(brandColors)[index % Object.values(brandColors).length] }}>
                          N${service.value.toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="text-gray-600 font-rubik">
                          N${(service.value / service.count).toFixed(0)}
                        </span>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>

          {/* Fun Financial Summary */}
          <motion.div 
            className="bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-500 rounded-3xl p-8 text-white relative overflow-hidden"
            initial={{ y: 80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            transition={{ delay: 1.0, duration: 0.8, type: "spring" }}
          >
            <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full -ml-16 -mb-16" />
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-6xl opacity-10">🎉</div>
            
            <div className="relative z-10">
              <div className="text-center mb-8">
                <div className="text-4xl mb-4">🎊</div>
                <h3 className="text-3xl font-bold mb-2">Congratulations!</h3>
                <p className="text-white/80">Your practice is performing exceptionally well</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
                <motion.div 
                  className="bg-white/20 backdrop-blur-sm rounded-2xl p-6"
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                >
                  <div className="text-3xl mb-2">🔥</div>
                  <p className="text-2xl font-bold font-rubik mb-1">
                    {((analytics.medicalAidRevenue / analytics.totalRevenue) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-white/80">Medical Aid Coverage</p>
                </motion.div>
                
                <motion.div 
                  className="bg-white/20 backdrop-blur-sm rounded-2xl p-6"
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                >
                  <div className="text-3xl mb-2">⚡</div>
                  <p className="text-2xl font-bold font-rubik mb-1">
                    {analytics.revenueGrowth >= 0 ? '+' : ''}{analytics.revenueGrowth.toFixed(1)}%
                  </p>
                  <p className="text-sm text-white/80">Growth Rate</p>
                </motion.div>
                
                <motion.div 
                  className="bg-white/20 backdrop-blur-sm rounded-2xl p-6"
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                >
                  <div className="text-3xl mb-2">🚀</div>
                  <p className="text-2xl font-bold font-rubik mb-1">
                    {((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)}%
                  </p>
                  <p className="text-sm text-white/80">Collection Rate</p>
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default EnhancedFinancialModal;