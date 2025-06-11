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
  Users,
  Maximize2,
  Minimize2,
  Package,
  Send,
  Calendar,
  FileText,
  CheckCircle
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
import { useAuthStore } from '../../stores/authStore';

interface BatchData {
  batch_id: string;
  practice_number: string;
  batch_number: string;
  batch_date: string;
  medical_aid_reference: string;
  status: string;
  total_invoices: number;
  total_amount: number;
  created_at: string;
  sent_at: string | null;
  confirmed_at: string | null;
  medical_aid_name: string;
  medical_aid_short_name: string;
  medical_aid_email: string;
  medical_aid_logo_url: string;
  medical_aid_theme_color: string;
  practice_name: string;
  practice_email: string;
  detail_transactions: number;
  total_detail_transactions: number;
  total_amount_detail_transactions: number;
  dat_filename: string;
}

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

// Medical aid theme colors mapping
const MEDICAL_AID_THEMES: Record<string, string> = {
  'MAG1': '#76a5af',
  'NAMM': '#ee5a60', 
  'NHPM': '#50caf0',
  'NMC1': '#1f97d5',
  'PROS': '#9c8f6c'
};

// Utility functions for color manipulation
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

const lightenColor = (hex: string, percent: number) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const r = Math.min(255, Math.floor(rgb.r + (255 - rgb.r) * percent));
  const g = Math.min(255, Math.floor(rgb.g + (255 - rgb.g) * percent));
  const b = Math.min(255, Math.floor(rgb.b + (255 - rgb.b) * percent));
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const createMatteColor = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  // Mix with grey to create matte effect
  const greyMix = 0.3;
  const grey = 128;
  
  const r = Math.floor(rgb.r * (1 - greyMix) + grey * greyMix);
  const g = Math.floor(rgb.g * (1 - greyMix) + grey * greyMix);
  const b = Math.floor(rgb.b * (1 - greyMix) + grey * greyMix);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
};

const EnhancedFinancialModal: React.FC<EnhancedFinancialModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'insights' | 'batch-management'>('overview');
  const [dateRange, setDateRange] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [showAllBatches, setShowAllBatches] = useState(false);
  const [batchFilter, setBatchFilter] = useState<'all' | 'paid' | 'unpaid' | 'active'>('all');
  
  const { user, selectedPracticeId } = useAuthStore();

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

  // Fetch batch management data
  const fetchBatchData = useCallback(async () => {
    console.log('🔍 fetchBatchData called');
    console.log('📍 selectedPracticeId:', selectedPracticeId);
    console.log('👤 user:', user);
    console.log('🏥 user.practice_id:', user?.practice_id);
    
    // Use selectedPracticeId or fallback to user's practice_id
    const practiceId = selectedPracticeId || user?.practice_id;
    
    if (!practiceId) {
      console.warn('❌ No practice ID found (neither selectedPracticeId nor user.practice_id)');
      console.log('🔧 Available user fields:', user ? Object.keys(user) : 'No user');
      return;
    }
    
    console.log('✅ Using practice ID:', practiceId);
    
    setBatchLoading(true);
    try {
      console.log('🏥 Fetching practice data for ID:', practiceId);
      
      // First try to get practice details to check what fields are available
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('*')
        .eq('id', practiceId)
        .single();

      console.log('🏥 Practice query result:', { practiceData, practiceError });

      if (practiceError) {
        console.error('❌ Practice query error:', practiceError);
        throw practiceError;
      }
      
      // Log available practice fields
      console.log('🔎 Available practice fields:', Object.keys(practiceData || {}));
      
      // Try practice_number first, then fallback to practice id or other identifier
      let practiceIdentifier = practiceData?.practice_number || practiceData?.id || practiceId;
      console.log('🔑 Using practice identifier:', practiceIdentifier);
      
      // Test if batch_management_view exists and what columns it has
      console.log('📊 Testing batch_management_view access...');
      const { data: testData, error: testError } = await supabase
        .from('batch_management_view')
        .select('*')
        .limit(1);
      
      console.log('📊 Batch view test result:', { testData, testError });
      
      if (testError) {
        console.error('❌ Batch view access error:', testError);
        // Try the actual batch_headers table instead
        console.log('🔄 Trying batch_headers table instead...');
        const { data: headersData, error: headersError } = await supabase
          .from('batch_headers')
          .select('*')
          .limit(5);
        
        console.log('📋 Batch headers result:', { headersData, headersError });
        setBatches([]);
        return;
      }
      
      // Log all available data in the view
      console.log('📋 Sample batch data structure:', testData?.[0] ? Object.keys(testData[0]) : 'No data');
      
      // Fetch batch data using practice identifier
      console.log('🔍 Querying batches with practice_number:', practiceIdentifier);
      console.log('🔄 Show all batches toggle:', showAllBatches);
      
      let query = supabase
        .from('batch_management_view')
        .select('*')
        .eq('practice_number', practiceIdentifier);
      
      // Only filter by 'active' status if showAllBatches is false
      if (!showAllBatches) {
        query = query.eq('status', 'active');
      }
      
      const { data: batchData, error: batchError } = await query
        .order('created_at', { ascending: false });

      console.log('📊 Batch query result:', { batchData, batchError });
      console.log('📊 Found batches count:', batchData?.length || 0);
      
      if (batchError) {
        console.error('❌ Batch query error:', batchError);
        throw batchError;
      }

      // Also try without status filter to see if there are any batches at all
      console.log('🔍 Checking for any batches (without status filter)...');
      const { data: allBatchData, error: allBatchError } = await supabase
        .from('batch_management_view')
        .select('*')
        .eq('practice_number', practiceIdentifier);
      
      console.log('📊 All batches result:', { allBatchData, allBatchError });
      console.log('📊 All batches count:', allBatchData?.length || 0);
      
      if (allBatchData && allBatchData.length > 0) {
        console.log('📋 Available batch statuses:', [...new Set(allBatchData.map(b => b.status))]);
      }

      // If no batches found with our identifier, let's see what practice numbers exist
      if (!allBatchData || allBatchData.length === 0) {
        console.log('🔍 No batches found with practice identifier:', practiceIdentifier);
        console.log('🔍 Let me check what practice numbers exist in the batch view...');
        
        const { data: allPracticeNumbers, error: practiceNumbersError } = await supabase
          .from('batch_management_view')
          .select('practice_number, practice_name')
          .limit(10);
        
        console.log('📋 Available practice numbers in batch view:', allPracticeNumbers);
        
        // Also check if there are any batches at all
        const { data: anyBatches, error: anyBatchesError } = await supabase
          .from('batch_management_view')
          .select('practice_number, practice_name, status')
          .limit(5);
        
        console.log('📋 Sample batches from view:', anyBatches);
      }

      setBatches(batchData || []);
    } catch (error) {
      console.error('❌ Error fetching batch data:', error);
      setBatches([]);
    } finally {
      setBatchLoading(false);
    }
  }, [selectedPracticeId, user, showAllBatches]);

  useEffect(() => {
    if (isOpen) {
      console.log('🚀 Modal opened - activeTab:', activeTab);
      console.log('🏥 selectedPracticeId:', selectedPracticeId);
      console.log('👤 user:', user);
      
      fetchFinancialKPIs();
      if (activeTab === 'batch-management') {
        console.log('📊 Batch management tab active - triggering fetch');
        fetchBatchData();
      }
    }
  }, [isOpen, activeTab, fetchFinancialKPIs, fetchBatchData]);

  // Add debug logging when tab changes
  useEffect(() => {
    if (activeTab === 'batch-management' && isOpen) {
      console.log('📊 Switched to batch management tab');
      fetchBatchData();
    }
  }, [activeTab, isOpen, fetchBatchData]);

  // Refetch data when filter changes
  useEffect(() => {
    if (activeTab === 'batch-management' && isOpen) {
      console.log('🔄 Filter changed, refetching batch data');
      fetchBatchData();
    }
  }, [batchFilter, activeTab, isOpen, fetchBatchData]);

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
      <div className={`grid gap-4 mb-6 ${
        isMaximized ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'
      }`}>
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
          <div className={isMaximized ? "h-96" : "h-64"}>
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
        <div className={`grid gap-6 ${
          isMaximized ? 'grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'
        }`}>
          {/* Revenue by Payment Status */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <PieChart className="w-5 h-5" />
              Revenue by Payment Status
            </h4>
            <div className={isMaximized ? "h-80" : "h-48"}>
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
            <div className={isMaximized ? "h-80" : "h-48"}>
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

          {/* Top Services Table - Show in third column when maximized */}
          {isMaximized && (
            <div className="bg-gray-50 rounded-xl p-6">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">Top Services</h4>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Service</th>
                      <th className="text-left py-2 px-3 text-sm font-medium text-gray-600">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpis.topServices.slice(0, 6).map((service, index) => (
                      <tr key={service.name} className="border-b border-gray-100">
                        <td className="py-2 px-3 text-sm font-medium text-gray-800">
                          {service.name.length > 20 ? service.name.substring(0, 20) + '...' : service.name}
                        </td>
                        <td className="py-2 px-3 text-sm font-semibold text-gray-900 font-rubik">
                          N${service.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Top Services Table - Show below when not maximized */}
        {!isMaximized && (
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
        )}
      </div>
    );
  };

  const renderBatchManagement = () => {
    if (batchLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-gray-500">Loading batch data...</p>
          </div>
        </div>
      );
    }

    // Filter batches based on the selected filter
    const filteredBatches = batches.filter(batch => {
      if (batchFilter === 'all') return true;
      if (batchFilter === 'paid') return batch.status === 'paid';
      if (batchFilter === 'unpaid') return batch.status === 'unpaid';
      if (batchFilter === 'active') return batch.status === 'active';
      return true;
    });

    if (filteredBatches.length === 0) {
      return (
        <div className="space-y-4">
          {/* Header with controls */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Package className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-xl font-bold text-[#4f575e]">
                Batches ({filteredBatches.length})
              </h3>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Filter Toggles */}
              <div className="flex items-center gap-4">
                {/* Show All Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-600 font-medium">Show All</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300 ${
                      batchFilter === 'all' 
                        ? 'bg-gradient-to-r from-gray-400 to-gray-500' 
                        : 'bg-gradient-to-r from-gray-300 to-gray-400'
                    }`}
                    onClick={() => setBatchFilter('all')}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilter === 'all' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {/* Paid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#01b9d5' }}>Paid</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                    style={{
                      backgroundColor: batchFilter === 'paid' ? '#01b9d5' : '#e5e7eb'
                    }}
                    onClick={() => setBatchFilter('paid')}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilter === 'paid' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {/* Unpaid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#ec8222' }}>Unpaid</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                    style={{
                      backgroundColor: batchFilter === 'unpaid' ? '#ec8222' : '#e5e7eb'
                    }}
                    onClick={() => setBatchFilter('unpaid')}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilter === 'unpaid' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium" style={{ color: '#6c67f0' }}>Active</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                    style={{
                      backgroundColor: batchFilter === 'active' ? '#6c67f0' : '#e5e7eb'
                    }}
                    onClick={() => setBatchFilter('active')}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilter === 'active' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              </div>
              
              {/* Submit All Button */}
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-full hover:from-slate-600 hover:to-slate-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                onClick={() => {
                  console.log('🚀 Submit all batches triggered');
                  // Add submit all logic here
                }}
              >
                <Send className="w-4 h-4" />
                Submit All
              </button>
            </div>
          </div>

          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No {batchFilter !== 'all' ? batchFilter : ''} batches found</p>
            <p className="text-sm text-gray-400">Batches will appear here when they are created</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header with controls */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-xl font-bold text-[#4f575e]">
              Batches ({filteredBatches.length})
            </h3>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Filter Toggles */}
            <div className="flex items-center gap-4">
              {/* Show All Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 font-medium">Show All</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300 ${
                    batchFilter === 'all' 
                      ? 'bg-gradient-to-r from-gray-400 to-gray-500' 
                      : 'bg-gradient-to-r from-gray-300 to-gray-400'
                  }`}
                  onClick={() => setBatchFilter('all')}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilter === 'all' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Paid Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: '#01b9d5' }}>Paid</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                  style={{
                    backgroundColor: batchFilter === 'paid' ? '#01b9d5' : '#e5e7eb'
                  }}
                  onClick={() => setBatchFilter('paid')}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilter === 'paid' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Unpaid Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: '#ec8222' }}>Unpaid</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                  style={{
                    backgroundColor: batchFilter === 'unpaid' ? '#ec8222' : '#e5e7eb'
                  }}
                  onClick={() => setBatchFilter('unpaid')}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilter === 'unpaid' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium" style={{ color: '#6c67f0' }}>Active</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                  style={{
                    backgroundColor: batchFilter === 'active' ? '#6c67f0' : '#e5e7eb'
                  }}
                  onClick={() => setBatchFilter('active')}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilter === 'active' ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            </div>
            
            {/* Submit All Button */}
            <button 
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-full hover:from-slate-600 hover:to-slate-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
              onClick={() => {
                console.log('🚀 Submit all batches triggered');
                // Add submit all logic here
              }}
            >
              <Send className="w-4 h-4" />
              Submit All
            </button>
          </div>
        </div>

        {/* Professional table-style batch cards */}
        <div className="bg-gray-50 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-white border-b border-gray-200">
                  <th className="text-center py-4 px-6 text-sm font-medium text-gray-600">Batch #</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Medical Aid</th>
                  <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Created Date</th>
                  <th className="text-center py-4 px-6 text-sm font-medium text-gray-600">Invoices & Services</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Total Amount</th>
                  <th className="text-right py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBatches.map((batch, index) => {
                  const themeColor = batch.medical_aid_theme_color || MEDICAL_AID_THEMES[batch.medical_aid_reference] || '#6B7280';
                  const lightColor = lightenColor(themeColor, 0.85);
                  
                  return (
                    <motion.tr
                      key={batch.batch_id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="border-b border-gray-100 hover:bg-gray-25 transition-colors group"
                      style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa' }}
                    >
                      {/* Batch Number Badge */}
                      <td className="py-4 px-6 text-center">
                        <div 
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-xs shadow-sm"
                          style={{ backgroundColor: themeColor }}
                        >
                          {batch.batch_number}
                        </div>
                      </td>

                      {/* Medical Aid Info */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-4">
                          <div className="relative">
                            {batch.medical_aid_logo_url ? (
                              <img 
                                src={batch.medical_aid_logo_url} 
                                alt={batch.medical_aid_name}
                                className={`w-16 h-16 rounded-lg object-contain bg-white p-2 shadow-sm ${
                                  batch.status === 'active' 
                                    ? 'ring-2 ring-[#6c67f0] animate-pulse' 
                                    : 'border border-gray-200'
                                }`}
                              />
                            ) : (
                              <div 
                                className={`w-16 h-16 rounded-lg flex items-center justify-center text-white font-bold text-sm shadow-sm ${
                                  batch.status === 'active' 
                                    ? 'ring-2 ring-[#6c67f0] animate-pulse' 
                                    : ''
                                }`}
                                style={{ backgroundColor: themeColor }}
                              >
                                {batch.medical_aid_short_name.substring(0, 2)}
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="text-sm text-gray-600 font-medium">
                              {batch.medical_aid_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {batch.medical_aid_reference}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700 font-medium">
                          {format(new Date(batch.batch_date), 'MMM dd, yyyy')}
                        </div>
                      </td>

                      {/* Invoices & Services */}
                      <td className="py-4 px-6 text-center">
                        <div className="flex justify-center items-center gap-6">
                          <div className="flex flex-col items-center">
                            <div 
                              className="text-xl font-bold font-rubik"
                              style={{ color: themeColor }}
                            >
                              {batch.total_invoices}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              Invoices
                            </div>
                          </div>
                          <div className="w-px h-8 bg-gray-300"></div>
                          <div className="flex flex-col items-center">
                            <div 
                              className="text-xl font-bold font-rubik"
                              style={{ color: lightenColor(themeColor, 0.3) }}
                            >
                              {batch.detail_transactions}
                            </div>
                            <div className="text-xs text-gray-500 uppercase tracking-wide">
                              Services
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Total Amount */}
                      <td className="py-4 px-6 text-right">
                        <div className="flex flex-col items-end">
                          <div className="text-2xl font-bold text-gray-600 font-rubik">
                            {(() => {
                              const amount = parseFloat(batch.total_amount);
                              const formatted = amount.toLocaleString('en-US', { 
                                minimumFractionDigits: 2, 
                                maximumFractionDigits: 2 
                              });
                              const [wholePart, centsPart] = formatted.split('.');
                              return (
                                <>
                                  N${wholePart}
                                  {centsPart && <span className="text-gray-400">.{centsPart}</span>}
                                </>
                              );
                            })()}
                          </div>
                          <div className="text-xs text-gray-500 uppercase tracking-wide">
                            Total
                          </div>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-6">
                        <div className="flex justify-end">
                          <button
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-full hover:from-slate-600 hover:to-slate-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                            onClick={() => {
                              console.log('🚀 Submit batch triggered for:', batch.batch_id);
                              // Add individual batch submit logic here
                            }}
                          >
                            <Send className="w-4 h-4" />
                            Submit
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return createPortal(
    <div 
      className={`fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[9999] ${
        isMaximized ? 'p-0' : 'p-4'
      }`} 
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ 
          opacity: 1, 
          scale: 1, 
          y: 0
        }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`relative bg-white shadow-2xl overflow-hidden w-full overflow-y-auto ${
          isMaximized ? 'rounded-none h-full' : 'rounded-2xl max-w-7xl max-h-[90vh]'
        }`}
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
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isMaximized ? "Minimize" : "Maximize"}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
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
              { key: 'insights', label: 'Insights', icon: Users },
              { key: 'batch-management', label: 'Batch Management', icon: Package }
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

              {activeTab === 'batch-management' && (
                <div className="space-y-6">
                  {renderBatchManagement()}
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