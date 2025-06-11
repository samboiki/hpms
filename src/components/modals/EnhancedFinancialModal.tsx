import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { 
  X, 
  DollarSign,
  TrendingUp,
  TrendingDown,
  BarChart3,
  PieChart,
  Download,
  Printer,
  Eye,
  Send,
  FileText,
  Package,
  Clock,
  CheckCircle,
  AlertTriangle,
  Users,
  Calendar,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Mail,
  Building,
  CreditCard,
  Receipt,
  Activity,
  Target
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart
} from 'recharts';
import { supabase } from '../../lib/supabase';

interface ChartData {
  labels: string[];
  datasets: {
    label: string;
    data: number[];
    backgroundColor?: string;
    borderColor?: string;
    borderWidth?: number;
  }[];
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
  chartData: ChartData;
  timeSeriesData?: ChartData;
  insights: string[];
  actionItems?: string[];
}

interface Batch {
  id: string;
  batch_number: number;
  medical_aid_reference: string;
  medical_aid_name: string;
  total_invoices: number;
  total_amount: number;
  status: 'active' | 'sent' | 'completed';
  created_at: string;
  sent_at?: string;
  dat_filename: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  patient_name: string;
  amount: number;
  status: 'paid' | 'unpaid' | 'partial';
  created_at: string;
  due_date: string;
  medical_aid?: string;
}

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
  data: FinancialData;
}

const EnhancedFinancialModal: React.FC<EnhancedFinancialModalProps> = ({
  isOpen,
  onClose,
  data
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'batches'>('overview');
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '3m' | '6m'>('30d');
  const [batches, setBatches] = useState<Batch[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<Batch | null>(null);
  const [showInvoiceDetails, setShowInvoiceDetails] = useState(false);
  const [analytics, setAnalytics] = useState<FinancialAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && activeTab === 'batches') {
      fetchBatchData();
    }
    if (isOpen && activeTab === 'financial') {
      fetchInvoiceData();
    }
    if (isOpen && activeTab === 'overview') {
      fetchFinancialAnalytics();
    }
  }, [isOpen, activeTab, dateRange]);

  const fetchBatchData = async () => {
    setIsLoading(true);
    try {
      // Fetch batch data from our new batch management system
      const { data: batchData, error } = await supabase
        .from('batch_headers')
        .select(`
          id,
          batch_number,
          medical_aid_reference,
          total_invoices,
          total_amount,
          status,
          created_at,
          sent_at,
          medical_aid_providers:medical_aid_reference (
            name,
            short_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedBatches: Batch[] = (batchData || []).map(batch => ({
        id: batch.id,
        batch_number: batch.batch_number,
        medical_aid_reference: batch.medical_aid_reference,
        medical_aid_name: batch.medical_aid_providers?.name || batch.medical_aid_reference,
        total_invoices: batch.total_invoices,
        total_amount: batch.total_amount,
        status: batch.status as 'active' | 'sent' | 'completed',
        created_at: batch.created_at,
        sent_at: batch.sent_at,
        dat_filename: `0540001133241_${batch.batch_number}_${batch.medical_aid_reference}`
      }));

      setBatches(formattedBatches);
    } catch (error) {
      console.error('Error fetching batch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchInvoiceData = async () => {
    setIsLoading(true);
    try {
      // Fetch real invoice data from invoices_enhanced table
      const { data: invoiceData, error } = await supabase
        .from('invoices_enhanced')
        .select(`
          id,
          invoice_number,
          patient_id,
          total,
          payment_status,
          medical_aid_status,
          issue_date,
          due_date,
          patients (
            first_name,
            last_name
          ),
          medical_aid_details (
            provider
          )
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const formattedInvoices: Invoice[] = (invoiceData || []).map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        patient_name: `${inv.patients?.first_name || ''} ${inv.patients?.last_name || ''}`.trim(),
        amount: parseFloat(inv.total || '0'),
        status: inv.payment_status === 'paid' ? 'paid' : 
                inv.payment_status === 'partial' ? 'partial' : 'unpaid',
        created_at: inv.issue_date,
        due_date: inv.due_date,
        medical_aid: inv.medical_aid_details?.[0]?.provider || 'Self Pay'
      }));
      
      setInvoices(formattedInvoices);
    } catch (error) {
      console.error('Error fetching invoice data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFinancialAnalytics = async () => {
    setAnalyticsLoading(true);
    try {
      // Calculate date range based on selection
      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '3m':
          startDate = subMonths(now, 3);
          break;
        case '6m':
          startDate = subMonths(now, 6);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      // Use performance-optimized views for faster loading
      const [dashboardData, monthlyData, servicesData] = await Promise.all([
        // Main dashboard KPIs
        supabase
          .from('financial_dashboard_fast')
          .select('*')
          .limit(1),
        
        // Monthly trends
        supabase
          .from('monthly_revenue_summary')
          .select('*')
          .gte('month', startDate.toISOString().split('T')[0])
          .order('month', { ascending: true }),
        
        // Top services
        supabase
          .from('top_services_aggregate')
          .select('*')
          .limit(10)
      ]);

      // Fallback to regular queries if views don't exist
      if (dashboardData.error || monthlyData.error || servicesData.error) {
        console.log('Views not available, falling back to regular queries...');
        
        // Fetch invoices with services for comprehensive analysis
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

        const { data: servicesDataFallback, error: servicesError } = await supabase
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

        // Calculate analytics (fallback method)
        const invoices = invoicesData || [];
        const services = servicesDataFallback || [];
        
        return await processAnalyticsData(invoices, services, startDate, now);
      }

      // Use optimized view data if available
      const dashboard = dashboardData.data?.[0];
      const monthlyTrends = monthlyData.data || [];
      const topServices = servicesData.data || [];

      if (dashboard) {
        // Use pre-calculated data from views for faster performance
        setAnalytics({
          totalRevenue: parseFloat(dashboard.total_revenue || '0'),
          monthlyRevenue: parseFloat(dashboard.monthly_revenue || '0'),
          outstandingAmount: parseFloat(dashboard.outstanding_amount || '0'),
          paidInvoices: dashboard.paid_invoices || 0,
          pendingInvoices: dashboard.pending_invoices || 0,
          medicalAidRevenue: parseFloat(dashboard.medical_aid_revenue || '0'),
          selfPayRevenue: parseFloat(dashboard.self_pay_revenue || '0'),
          revenueGrowth: parseFloat(dashboard.revenue_growth_percent || '0'),
          avgInvoiceValue: parseFloat(dashboard.avg_invoice_value || '0'),
          topServices: topServices.map(service => ({
            name: service.service_name,
            value: parseFloat(service.total_revenue || '0'),
            count: service.frequency || 0
          })),
          monthlyTrends: monthlyTrends.map(month => ({
            month: format(new Date(month.month), 'MMM yyyy'),
            revenue: parseFloat(month.total_revenue || '0'),
            invoices: month.total_invoices || 0,
            medical_aid: parseFloat(month.medical_aid_revenue || '0'),
            self_pay: parseFloat(month.self_pay_revenue || '0')
          })),
          serviceBreakdown: topServices.slice(0, 6).map((service, index) => ({
            name: service.service_name.length > 25 ? service.service_name.substring(0, 25) + '...' : service.service_name,
            value: parseFloat(service.total_revenue || '0'),
            color: ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5a2b'][index]
          })),
          paymentStatusBreakdown: [
            {
              status: 'Paid',
              count: dashboard.paid_invoices || 0,
              value: parseFloat(dashboard.total_revenue || '0') - parseFloat(dashboard.outstanding_amount || '0'),
              color: '#10b981'
            },
            {
              status: 'Pending',
              count: dashboard.pending_invoices || 0,
              value: parseFloat(dashboard.outstanding_amount || '0'),
              color: '#f59e0b'
            }
          ]
        });
        return;
      }

    } catch (error) {
      console.error('Error fetching financial analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  // Helper function for fallback data processing
  const processAnalyticsData = async (invoices: any[], services: any[], startDate: Date, now: Date) => {
    const totalRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
    const medicalAidRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.medical_aid_total || '0'), 0);
    const selfPayRevenue = invoices.reduce((sum, inv) => sum + parseFloat(inv.patient_total || '0'), 0);
    
    const paidInvoices = invoices.filter(inv => inv.payment_status === 'paid').length;
    const pendingInvoices = invoices.filter(inv => inv.payment_status === 'pending').length;
    const outstandingAmount = invoices
      .filter(inv => inv.payment_status !== 'paid')
      .reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);

    const avgInvoiceValue = invoices.length > 0 ? totalRevenue / invoices.length : 0;

    // Calculate previous period for growth
    const previousStartDate = new Date(startDate.getTime() - (now.getTime() - startDate.getTime()));
    const { data: previousData } = await supabase
      .from('invoices_enhanced')
      .select('total')
      .gte('issue_date', previousStartDate.toISOString().split('T')[0])
      .lt('issue_date', startDate.toISOString().split('T')[0]);

    const previousRevenue = (previousData || []).reduce((sum, inv) => sum + parseFloat(inv.total || '0'), 0);
    const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

    // Calculate current month revenue
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
    const colors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5a2b'];
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
  };

  const handleSendBatch = async (batch: Batch) => {
    try {
      // Generate .dat file content
      const datContent = await generateDatFile(batch);
      
      // Create blob and download
      const blob = new Blob([datContent], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${batch.dat_filename}.dat`;
      a.click();
      URL.revokeObjectURL(url);

      // Update batch status to sent
      const { error } = await supabase
        .from('batch_headers')
        .update({ 
          status: 'sent', 
          sent_at: new Date().toISOString() 
        })
        .eq('id', batch.id);

      if (error) throw error;

      // Refresh batch data
      fetchBatchData();
    } catch (error) {
      console.error('Error sending batch:', error);
    }
  };

  const generateDatFile = async (batch: Batch): Promise<string> => {
    // Fetch batch details
    const { data: batchHeader } = await supabase
      .from('batch_headers')
      .select('*')
      .eq('id', batch.id)
      .single();

    const { data: batchDetails } = await supabase
      .from('batch_details')
      .select(`
        *,
        invoices_enhanced (
          invoice_number,
          issue_date,
          patient_id,
          patients (
            first_name,
            last_name,
            id_number,
            date_of_birth,
            gender
          )
        )
      `)
      .eq('batch_header_id', batch.id)
      .order('transaction_number_in_batch');

    const { data: batchTrailer } = await supabase
      .from('batch_trailer')
      .select('*')
      .eq('batch_header_id', batch.id)
      .single();

    let datContent = '';

    // Header line
    if (batchHeader) {
      const headerLine = [
        '1', // Header Identifier
        batchHeader.practice_number,
        batchHeader.system_identification,
        batchHeader.transaction_type,
        batchHeader.batch_number,
        format(new Date(batchHeader.batch_date), 'yyyyMMdd'),
        batchHeader.source_software,
        batchHeader.source_software_version
      ].join(',');
      datContent += headerLine + '\n';
    }

    // Detail lines
    if (batchDetails) {
      for (const detail of batchDetails) {
        const detailLine = [
          detail.transaction_id,
          detail.transaction_number_in_batch,
          detail.system_transaction_number || '',
          detail.system_patient_reference_number,
          detail.type_of_service,
          detail.medical_aid_reference,
          detail.not_used_1,
          detail.medical_aid_membership_number,
          detail.member_surname,
          detail.member_initials,
          detail.patient_name,
          format(new Date(detail.patient_date_of_birth), 'yyyyMMdd'),
          detail.bhf_tariff_code,
          detail.service_amount,
          detail.diagnosis,
          detail.discount_amount,
          format(new Date(detail.service_date), 'yyyyMMdd'),
          detail.number_of_services,
          detail.service_fee,
          detail.modifier_1,
          detail.modifier_2,
          detail.modifier_3,
          detail.modifier_4,
          detail.invoice_number,
          detail.referring_doctor,
          detail.nappi_code,
          detail.referred_to_practice_number,
          detail.not_used_2,
          detail.practice_number,
          detail.hospital_indicator,
          detail.authorisation_number,
          detail.resubmission_flag,
          detail.diagnostic_code,
          detail.diagnostic_code_type,
          detail.dosage_description,
          detail.not_used_3,
          detail.treating_doctor_hpcsa_number,
          detail.tooth_numbers,
          detail.gender,
          detail.tariff_code_type,
          detail.cpt_cdt_code,
          detail.free_text,
          detail.place_of_service,
          detail.referring_doctor_2,
          detail.tracking_number,
          detail.reading_additions,
          detail.lens_prescription,
          detail.density_of_tint,
          detail.patient_id_number,
          detail.service_time || '',
          detail.employer_name,
          detail.employee_number,
          detail.date_of_injury ? format(new Date(detail.date_of_injury), 'yyyyMMdd') : '',
          detail.iod_reference_number
        ].join(',');
        datContent += detailLine + '\n';
      }
    }

    // Trailer line
    if (batchTrailer) {
      const trailerLine = [
        batchTrailer.trailer_identifier,
        batchTrailer.total_detail_transactions,
        batchTrailer.total_amount_detail_transactions
      ].join(',');
      datContent += trailerLine + '\n';
    }

    return datContent;
  };

  if (!isOpen) return null;

  const colorMap = {
    finance: 'from-purple-500 to-indigo-600'
  };

  const renderFinancialOverview = () => (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-green-600">Total Revenue</p>
              <p className="text-xl font-bold text-green-800 font-rubik">N$125,000</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500 rounded-lg">
              <Receipt className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-blue-600">Paid Invoices</p>
              <p className="text-xl font-bold text-blue-800 font-rubik">45</p>
            </div>
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-red-50 p-4 rounded-xl border border-orange-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-500 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-orange-600">Outstanding</p>
              <p className="text-xl font-bold text-orange-800 font-rubik">N$5,200</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toggle for detailed invoice table */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-800">Invoice Management</h3>
        <button
          onClick={() => setShowInvoiceDetails(!showInvoiceDetails)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
        >
          <Eye className="w-4 h-4" />
          {showInvoiceDetails ? 'Hide Details' : 'View All Invoices'}
        </button>
      </div>

      {/* Detailed Invoice Table */}
      <AnimatePresence>
        {showInvoiceDetails && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden"
          >
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold text-gray-800">All Invoices</h4>
                <div className="flex items-center gap-2">
                  <button className="p-2 text-gray-500 hover:text-gray-700">
                    <Search className="w-4 h-4" />
                  </button>
                  <button className="p-2 text-gray-500 hover:text-gray-700">
                    <Filter className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Invoice #</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Patient</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Amount</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Due Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-500">Medical Aid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{invoice.invoice_number}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{invoice.patient_name}</td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 font-rubik">N${invoice.amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                          invoice.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {invoice.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{format(new Date(invoice.due_date), 'MMM d, yyyy')}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{invoice.medical_aid}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderBatchManagement = () => (
    <div className="space-y-6">
      {/* Batch Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-4 rounded-xl border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Active Batches</p>
              <p className="text-2xl font-bold text-blue-800 font-rubik">{batches.filter(b => b.status === 'active').length}</p>
              <p className="text-xs text-blue-500">Ready to send</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Completed Batches</p>
              <p className="text-2xl font-bold text-green-800 font-rubik">{batches.filter(b => b.status === 'completed').length}</p>
              <p className="text-xs text-green-500">Successfully sent</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>
      </div>

      {/* Active Batches Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-blue-500" />
          Active Batches
        </h3>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : batches.filter(batch => batch.status === 'active').length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No active batches</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.filter(batch => batch.status === 'active').map((batch) => (
              <motion.div
                key={batch.id}
                layout
                className="bg-white rounded-xl border border-gray-200 p-4"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-100 rounded-lg">
                      <Building className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{batch.medical_aid_name}</h4>
                      <p className="text-sm text-gray-500">Batch #{batch.batch_number} • {batch.total_invoices} invoices</p>
                      <p className="text-sm font-medium text-green-600 font-rubik">N${batch.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedBatch(batch)}
                      className="px-3 py-1 text-sm text-blue-600 hover:text-blue-800"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() => handleSendBatch(batch)}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Send className="w-4 h-4" />
                      Send Batch
                    </button>
                  </div>
                </div>
                
                {selectedBatch?.id === batch.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-4 pt-4 border-t border-gray-200"
                  >
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Medical Aid</p>
                        <p className="font-medium">{batch.medical_aid_reference}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Created</p>
                        <p className="font-medium">{format(new Date(batch.created_at), 'MMM d, yyyy')}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">File Name</p>
                        <p className="font-medium">{batch.dat_filename}.dat</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                          {batch.status}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Batches Section */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
          <CheckCircle className="w-5 h-5 text-green-500" />
          Completed Batches
        </h3>
        {batches.filter(batch => batch.status === 'sent' || batch.status === 'completed').length === 0 ? (
          <div className="text-center p-8 text-gray-500">
            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>No completed batches</p>
          </div>
        ) : (
          <div className="space-y-3">
            {batches.filter(batch => batch.status === 'sent' || batch.status === 'completed').map((batch) => (
              <div key={batch.id} className="bg-gray-50 rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-lg">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-800">{batch.medical_aid_name}</h4>
                      <p className="text-sm text-gray-500">Batch #{batch.batch_number} • Sent {batch.sent_at ? format(new Date(batch.sent_at), 'MMM d, yyyy') : 'Unknown'}</p>
                      <p className="text-sm font-medium text-green-600 font-rubik">N${batch.total_amount.toFixed(2)}</p>
                    </div>
                  </div>
                  <span className="inline-flex px-3 py-1 text-sm font-medium rounded-full bg-green-100 text-green-800">
                    {batch.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderEnhancedOverview = () => {
    if (analyticsLoading) {
      return (
        <motion.div 
          className="flex items-center justify-center p-16"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="text-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full mx-auto mb-4"
            />
            <motion.p 
              className="text-gray-600 font-medium"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              Loading financial analytics...
            </motion.p>
          </div>
        </motion.div>
      );
    }

    if (!analytics) {
      return (
        <motion.div 
          className="text-center p-12"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <AlertTriangle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No financial data available</p>
        </motion.div>
      );
    }

    // Premium color palette
    const colors = {
      primary: '#6366f1',
      secondary: '#8b5cf6', 
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#06b6d4'
    };

    // Custom tooltip styles
    const CustomTooltip = ({ active, payload, label }: any) => {
      if (active && payload && payload.length) {
        return (
          <motion.div 
            className="bg-white/95 backdrop-blur-sm p-4 rounded-lg shadow-xl border border-gray-200"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.15 }}
          >
            <p className="font-semibold text-gray-800 mb-2">{label}</p>
            {payload.map((entry: any, index: number) => (
              <p key={index} className="text-sm font-rubik" style={{ color: entry.color }}>
                {entry.name}: N${entry.value?.toFixed(2)}
              </p>
            ))}
          </motion.div>
        );
      }
      return null;
    };

    return (
      <motion.div 
        className="space-y-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
      >
        {/* Premium Date Range Selector */}
        <div className="flex items-center justify-between">
          <motion.h3 
            className="text-2xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            Financial Analytics
          </motion.h3>
          <motion.div 
            className="flex gap-1 p-1 bg-gray-100 rounded-xl"
            initial={{ x: 20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {[
              { key: '7d', label: '7D' },
              { key: '30d', label: '30D' },
              { key: '3m', label: '3M' },
              { key: '6m', label: '6M' }
            ].map((range) => (
              <motion.button
                key={range.key}
                onClick={() => setDateRange(range.key as any)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-300 ${
                  dateRange === range.key
                    ? 'bg-white text-purple-600 shadow-lg shadow-purple-500/25'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-white/50'
                }`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {range.label}
              </motion.button>
            ))}
          </motion.div>
        </div>

        {/* Premium Metrics Cards */}
        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          {[
            {
              title: 'Total Revenue',
              value: `N$${analytics.totalRevenue.toFixed(2)}`,
              change: analytics.revenueGrowth,
              icon: DollarSign,
              gradient: 'from-emerald-500 to-green-600',
              bg: 'from-emerald-50 to-green-50',
              border: 'border-emerald-200'
            },
            {
              title: 'Monthly Revenue',
              value: `N$${analytics.monthlyRevenue.toFixed(2)}`,
              subtitle: `Avg: N$${analytics.avgInvoiceValue.toFixed(2)}`,
              icon: Activity,
              gradient: 'from-blue-500 to-cyan-600',
              bg: 'from-blue-50 to-cyan-50',
              border: 'border-blue-200'
            },
            {
              title: 'Medical Aid Revenue',
              value: `N$${analytics.medicalAidRevenue.toFixed(2)}`,
              subtitle: `${analytics.totalRevenue > 0 ? ((analytics.medicalAidRevenue / analytics.totalRevenue) * 100).toFixed(1) : 0}% of total`,
              icon: CreditCard,
              gradient: 'from-purple-500 to-indigo-600',
              bg: 'from-purple-50 to-indigo-50',
              border: 'border-purple-200'
            },
            {
              title: 'Outstanding',
              value: `N$${analytics.outstandingAmount.toFixed(2)}`,
              subtitle: `${analytics.pendingInvoices} pending`,
              icon: AlertTriangle,
              gradient: 'from-orange-500 to-red-600',
              bg: 'from-orange-50 to-red-50',
              border: 'border-orange-200'
            }
          ].map((metric, index) => (
            <motion.div
              key={metric.title}
              className={`relative p-6 rounded-2xl bg-gradient-to-br ${metric.bg} border ${metric.border} overflow-hidden group hover:shadow-xl transition-all duration-300`}
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              whileHover={{ y: -4, scale: 1.02 }}
            >
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                  <div className={`p-2 rounded-xl bg-gradient-to-r ${metric.gradient}`}>
                    <metric.icon className="w-5 h-5 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-bold text-gray-800 mb-1 font-rubik">{metric.value}</p>
                {metric.change !== undefined && (
                  <div className="flex items-center gap-1">
                    {metric.change >= 0 ? (
                      <TrendingUp className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600" />
                    )}
                    <span className={`text-sm font-medium font-rubik ${metric.change >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {Math.abs(metric.change).toFixed(1)}%
                    </span>
                  </div>
                )}
                {metric.subtitle && (
                  <p className="text-sm text-gray-600 mt-1">{metric.subtitle}</p>
                )}
              </div>
              <div className={`absolute inset-0 bg-gradient-to-r ${metric.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
            </motion.div>
          ))}
        </motion.div>

        {/* Premium Charts Grid */}
        <motion.div 
          className="grid grid-cols-1 xl:grid-cols-2 gap-8"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
        >
          {/* Revenue Trend Chart - Premium Style */}
          <motion.div 
            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
            whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-500 to-indigo-600">
                  <TrendingUp className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-800">Revenue Trends</h4>
                  <p className="text-gray-500 text-sm">Last 6 months performance</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={analytics.monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" strokeWidth={1} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="revenue" 
                    stroke="#8b5cf6" 
                    strokeWidth={3}
                    fill="url(#revenueGradient)"
                    dot={{ fill: '#8b5cf6', strokeWidth: 2, r: 6 }}
                    activeDot={{ r: 8, stroke: '#8b5cf6', strokeWidth: 2, fill: 'white' }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Medical Aid vs Self Pay - Modern Bars */}
          <motion.div 
            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
            whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-blue-500 to-cyan-600">
                  <BarChart3 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-800">Payment Sources</h4>
                  <p className="text-gray-500 text-sm">Medical Aid vs Self Pay breakdown</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={analytics.monthlyTrends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="medicalAidGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8b5cf6" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#a78bfa" stopOpacity={1}/>
                    </linearGradient>
                    <linearGradient id="selfPayGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#67e8f9" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" strokeWidth={1} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="medical_aid" 
                    fill="url(#medicalAidGradient)" 
                    name="Medical Aid"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar 
                    dataKey="self_pay" 
                    fill="url(#selfPayGradient)" 
                    name="Self Pay"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Top Services - Elegant Horizontal Bars */}
          <motion.div 
            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
            whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8 pb-4">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-green-600">
                  <Target className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-800">Top Services</h4>
                  <p className="text-gray-500 text-sm">Highest revenue generating services</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={analytics.topServices.slice(0, 5)} layout="horizontal" margin={{ top: 10, right: 30, left: 100, bottom: 0 }}>
                  <defs>
                    <linearGradient id="servicesGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={1}/>
                      <stop offset="95%" stopColor="#34d399" stopOpacity={1}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" strokeWidth={1} />
                  <XAxis 
                    type="number" 
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: '#6b7280' }}
                  />
                  <YAxis 
                    dataKey="name" 
                    type="category" 
                    width={100}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: '#6b7280' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="value" 
                    fill="url(#servicesGradient)"
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </motion.div>

          {/* Service Distribution - Modern Donut */}
          <motion.div 
            className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden"
            whileHover={{ y: -2, boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.15)" }}
            transition={{ duration: 0.3 }}
          >
            <div className="p-8">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-2xl bg-gradient-to-r from-orange-500 to-red-600">
                  <PieChart className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-gray-800">Service Distribution</h4>
                  <p className="text-gray-500 text-sm">Revenue by service category</p>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={320}>
                <RechartsPieChart>
                  <Pie
                    data={analytics.serviceBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={110}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {analytics.serviceBreakdown.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color}
                        stroke="white"
                        strokeWidth={2}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </RechartsPieChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
        </motion.div>

        {/* Premium Quick Stats */}
        <motion.div 
          className="bg-gradient-to-r from-slate-50 via-gray-50 to-slate-50 rounded-3xl p-8 border border-gray-200"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.6 }}
        >
          <h4 className="text-xl font-bold text-gray-800 mb-6 text-center">Performance Metrics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { label: 'Total Invoices', value: analytics.paidInvoices + analytics.pendingInvoices, color: 'text-gray-700' },
              { label: 'Paid Invoices', value: analytics.paidInvoices, color: 'text-emerald-600' },
              { label: 'Pending Invoices', value: analytics.pendingInvoices, color: 'text-orange-600' },
              { 
                label: 'Collection Rate', 
                value: `${analytics.paidInvoices + analytics.pendingInvoices > 0 
                  ? ((analytics.paidInvoices / (analytics.paidInvoices + analytics.pendingInvoices)) * 100).toFixed(1)
                  : 0}%`, 
                color: 'text-purple-600' 
              }
            ].map((stat, index) => (
              <motion.div 
                key={stat.label}
                className="text-center p-4 bg-white rounded-2xl shadow-sm border border-gray-100"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 1.4 + index * 0.1 }}
                whileHover={{ scale: 1.05 }}
              >
                <p className={`text-3xl font-bold mb-2 font-rubik ${stat.color}`}>{stat.value}</p>
                <p className="text-sm text-gray-600 font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
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
        <div className={`bg-gradient-to-r ${colorMap.finance} p-6 text-white`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <DollarSign className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl font-bold">{data.title}</h2>
                <p className="text-white/90">{data.subtitle}</p>
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

          {/* Overview stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Total Revenue</p>
              <p className="text-2xl font-bold font-rubik">
                {analytics ? `N$${analytics.totalRevenue.toFixed(2)}` : 'N$0.00'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">This Month</p>
              <div className="flex items-center gap-2">
                {analytics && analytics.revenueGrowth >= 0 ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
                <p className="text-xl font-bold font-rubik">
                  {analytics ? `N$${analytics.monthlyRevenue.toFixed(2)}` : 'N$0.00'}
                </p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Outstanding</p>
              <p className="text-lg font-semibold font-rubik">
                {analytics ? `N$${analytics.outstandingAmount.toFixed(2)}` : 'N$0.00'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Active Batches</p>
              <p className="text-lg font-semibold font-rubik">{batches.filter(b => b.status === 'active').length}</p>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <div className="flex">
            {[
              { id: 'overview', label: 'Overview', icon: BarChart3 },
              { id: 'financial', label: 'Financial Overview', icon: DollarSign },
              { id: 'batches', label: 'Batch Management', icon: Package }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-4 font-medium transition-colors border-b-2 ${
                  activeTab === tab.id
                    ? `border-current text-gray-900 bg-gray-50`
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'overview' && renderEnhancedOverview()}
              {activeTab === 'financial' && renderFinancialOverview()}
              {activeTab === 'batches' && renderBatchManagement()}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>,
    document.body
  );
};

export default EnhancedFinancialModal;