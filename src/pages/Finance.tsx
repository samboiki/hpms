import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Icon } from '@iconify/react';
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
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';
import { useTheme } from '../stores/themeStore';
import { Card, CardContent } from '../components/ui/Card';
import { toast } from 'react-hot-toast';

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

// Color palette for consistent theming - Premium cyan-blue finance theme
const COLORS = {
  primary: '#06B6D4',   // Cyan primary
  secondary: '#0891B2', // Darker cyan
  success: '#10B981',   // Green
  warning: '#F59E0B',
  danger: '#EF4444',
  gray: '#6B7280',
  light: '#F3F4F6'
};

const PIE_COLORS = ['#06B6D4', '#0891B2', '#0E7490', '#10B981', '#F59E0B', '#3B82F6'];

// Heartbeat animation styles
const heartbeatStyles = `
  @keyframes heartbeat {
    0% { transform: scale(1); }
    14% { transform: scale(1.15); }
    28% { transform: scale(1); }
    42% { transform: scale(1.15); }
    70% { transform: scale(1); }
  }
  .heartbeat-ring {
    animation: heartbeat 1.5s infinite;
  }
`;

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

const Finance: React.FC = () => {
  const { currentTheme } = useTheme();
  const { user, selectedPracticeId } = useAuthStore();
  
  // Inject heartbeat animation styles
  React.useEffect(() => {
    const styleId = 'heartbeat-animation-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = heartbeatStyles;
      document.head.appendChild(style);
    }
    
    return () => {
      const existingStyle = document.getElementById(styleId);
      if (existingStyle) {
        existingStyle.remove();
      }
    };
  }, []);

  const [activeTab, setActiveTab] = useState<'overview' | 'income' | 'expenses' | 'invoicing' | 'payments' | 'reports' | 'accounting' | 'batch-management'>('overview');
  const [dateRange, setDateRange] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [batches, setBatches] = useState<BatchData[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchFilters, setBatchFilters] = useState<{paid: boolean, unpaid: boolean, active: boolean}>({
    paid: false,
    unpaid: false, 
    active: true
  });
  const [submittingBatches, setSubmittingBatches] = useState<Set<string>>(new Set());
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);

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
      toast.error('Failed to load financial data');
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
      
      // For super admins or users without practice ID, try to get the first available practice
      if (user?.is_super_admin) {
        console.log('🔧 User is super admin, trying to get first practice...');
        try {
          const { data: practices, error } = await supabase
            .from('practices')
            .select('id, name')
            .limit(1);
          
          if (!error && practices && practices.length > 0) {
            const firstPracticeId = practices[0].id;
            console.log('✅ Using first practice:', firstPracticeId, practices[0].name);
            // Continue with this practice ID
            await fetchBatchDataForPractice(firstPracticeId);
            return;
          } else {
            console.log('❌ No practices found in database');
          }
        } catch (error) {
          console.error('❌ Error fetching practices:', error);
        }
      }
      
      // Set empty batches and return
      setBatches([]);
      return;
    }
    
    await fetchBatchDataForPractice(practiceId);
  }, [selectedPracticeId, user, batchFilters]);

  // Helper function to fetch batch data for a specific practice
  const fetchBatchDataForPractice = async (practiceId: string) => {
    console.log('✅ Using practice ID:', practiceId);
    
    setBatchLoading(true);
    try {
      // Method 1: Try using the simple RPC function (best compatibility)
      console.log('🔍 Attempting to use get_practice_batches_simple function...');
      try {
        const { data: simpleData, error: simpleRpcError } = await supabase
          .rpc('get_practice_batches_simple', { 
            p_practice_id: practiceId 
          });
        
        if (!simpleRpcError && simpleData && simpleData.length > 0) {
          console.log('✅ Successfully fetched batches using simple RPC function');
          console.log('📊 Found batches count:', simpleData.length);
          setBatches(simpleData);
          return;
        } else if (simpleRpcError) {
          console.log('⚠️ get_practice_batches_simple RPC error:', simpleRpcError.message);
        }
      } catch (simpleRpcErr) {
        console.log('⚠️ Simple RPC function not available, trying with doctors...');
      }

      // Method 2: Try using the detailed RPC function with doctor info
      console.log('🔍 Attempting to use get_practice_batches_with_doctors function...');
      try {
        const { data: doctorData, error: doctorRpcError } = await supabase
          .rpc('get_practice_batches_with_doctors', { 
            p_practice_id: practiceId 
          });
        
        if (!doctorRpcError && doctorData && doctorData.length > 0) {
          console.log('✅ Successfully fetched batches using doctor RPC function');
          console.log('📊 Found batches count:', doctorData.length);
          setBatches(doctorData);
          return;
        } else if (doctorRpcError) {
          console.log('⚠️ get_practice_batches_with_doctors RPC error:', doctorRpcError.message);
        }
      } catch (doctorRpcErr) {
        console.log('⚠️ Doctor RPC function not available, falling back to original...');
      }

      // Method 3: Try the original RPC functions as fallback
      console.log('🔍 Attempting to use get_practice_batches function...');
      try {
        const { data: batchData, error: rpcError } = await supabase
          .rpc('get_practice_batches', { 
            p_practice_id: practiceId 
          });
        
        if (!rpcError && batchData && batchData.length > 0) {
          console.log('✅ Successfully fetched batches using original RPC function');
          console.log('📊 Found batches count:', batchData.length);
          setBatches(batchData);
          return;
        } else if (rpcError) {
          console.log('⚠️ get_practice_batches RPC error:', rpcError.message);
        }
      } catch (rpcErr) {
        console.log('⚠️ Original RPC function not available, trying direct...');
      }
      
      // Method 4: Fallback to practice number lookup and view query
      console.log('🏥 Fetching practice data for ID:', practiceId);
      
      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select('id, name, practice_number')
        .eq('id', practiceId)
        .single();

      if (practiceError) {
        console.error('❌ Practice query error:', practiceError);
        
        // Method 5: Try direct batch_headers query by practice_id
        console.log('🔄 Trying direct batch_headers query by practice_id...');
        const { data: directBatches, error: directError } = await supabase
          .from('batch_headers')
          .select(`
            *,
            medical_aid_providers (
              name,
              short_name,
              email,
              logo_url,
              theme_color
            ),
            practices (
              name,
              contact_email
            )
          `)
          .eq('practice_id', practiceId)
          .order('created_at', { ascending: false });
        
        if (!directError && directBatches && directBatches.length > 0) {
          console.log('✅ Found batches using direct query:', directBatches.length);
          
          // Transform to match the view structure
          const transformedBatches = directBatches.map(batch => ({
            batch_id: batch.id,
            practice_number: batch.practice_number,
            batch_number: batch.batch_number,
            batch_date: batch.batch_date,
            medical_aid_reference: batch.medical_aid_reference,
            status: batch.status,
            total_invoices: batch.total_invoices || 0,
            total_amount: batch.total_amount || 0,
            created_at: batch.created_at,
            sent_at: batch.sent_at,
            confirmed_at: batch.confirmed_at,
            medical_aid_name: batch.medical_aid_providers?.name || 'Unknown Medical Aid',
            medical_aid_short_name: batch.medical_aid_providers?.short_name || 'UNK',
            medical_aid_email: batch.medical_aid_providers?.email || 'unknown@example.com',
            medical_aid_logo_url: batch.medical_aid_providers?.logo_url,
            medical_aid_theme_color: batch.medical_aid_providers?.theme_color,
            practice_name: batch.practices?.name || 'Unknown Practice',
            practice_email: batch.practices?.contact_email || 'unknown@example.com',
            detail_transactions: 0, // Would need separate query
            total_detail_transactions: 0,
            total_amount_detail_transactions: 0,
            dat_filename: `${batch.practice_number || 'UNKNOWN'}_${batch.batch_number || 1}_${batch.medical_aid_reference}`
          }));
          
          setBatches(transformedBatches);
          return;
        }
        
        console.log('❌ No batches found via direct query, checking system-wide...');
      } else {
        console.log('🏥 Practice found:', practiceData);
        
        // Method 6: Query using practice_number if available
        if (practiceData.practice_number) {
          console.log('🔍 Querying batches with practice_number:', practiceData.practice_number);
          
          const { data: batchData, error: batchError } = await supabase
            .from('batch_management_view')
            .select('*')
            .eq('practice_number', practiceData.practice_number)
            .order('created_at', { ascending: false });
          
          if (!batchError && batchData && batchData.length > 0) {
            console.log('✅ Found batches via practice_number:', batchData.length);
            setBatches(batchData);
            return;
          }
          
          if (batchError) {
            console.error('❌ Batch view query error:', batchError);
          }
        }
      }
      
      // Method 7: Final fallback - check if there are any batches in the system
      console.log('🔍 Checking for any batches in the system...');
      const { data: anyBatches, count } = await supabase
        .from('batch_management_view')
        .select('*', { count: 'exact', head: false })
        .limit(10);
      
      console.log('📊 Total batches in system:', count);
      console.log('📋 Sample batches:', anyBatches);
      
      if (anyBatches && anyBatches.length > 0) {
        console.log('⚠️ Found batches in system but none for this practice');
        console.log('🔧 Consider checking practice_number mapping');
      } else {
        console.log('ℹ️ No batches found in the entire system - this is normal for new installations');
      }
      
      setBatches([]);
      
    } catch (error) {
      console.error('❌ Error fetching batch data:', error);
      setBatches([]);
    } finally {
      setBatchLoading(false);
    }
  };

  // --- Function to handle individual batch submission ---
  const handleIndividualSubmit = async (batchId: string) => {
    // Show a loading spinner for this specific button
    setSubmittingBatches(prev => new Set(prev).add(batchId));
    try {
      console.log(`🚀 Invoking Edge Function 'send-batch-email' for batch: ${batchId}`);
      
      const { data, error } = await supabase.functions.invoke('send-batch-email', {
        body: { batch_id: batchId },
      });

      if (error) {
        throw new Error((error as any).message);
      }
      
      console.log('✅ Success:', data.message);
      toast.success(`Success: ${data.message}`);

      // Refresh the batch list to show the new 'sent' status
      fetchBatchData();

    } catch (error) {
      console.error(`❌ Failed to send batch ${batchId}:`, error);
      
      // Try to get more detailed error information
      let errorMessage = 'Unknown error occurred';
      if (error && typeof error === 'object') {
        if ('message' in error) {
          errorMessage = (error as any).message;
        } else if ('error' in error) {
          errorMessage = (error as any).error;
        } else {
          errorMessage = JSON.stringify(error);
        }
      }
      
      console.log('📋 Full error details:', {
        error,
        message: errorMessage,
        batchId
      });
      
      toast.error(`Error submitting batch: ${errorMessage}`);
    } finally {
      // Remove the loading spinner for this button
      setSubmittingBatches(prev => {
        const newSet = new Set(prev);
        newSet.delete(batchId);
        return newSet;
      });
    }
  };

  // --- Function to handle submitting all active batches ---
  const handleSubmitAll = async () => {
    const activeBatchesToSubmit = batches.filter(batch => batch.status === 'active');

    if (activeBatchesToSubmit.length === 0) {
      toast.error("No active batches to submit.");
      return;
    }

    setIsSubmittingAll(true);
    
    // Attempt all submissions, even if some fail
    await Promise.allSettled(
      activeBatchesToSubmit.map(batch => handleIndividualSubmit(batch.batch_id))
    );

    setIsSubmittingAll(false);

    toast.success(`"Submit All" process complete. Please check the status of individual batches.`);
    
    // Refresh data after all submissions are attempted
    fetchBatchData();
  };

  useEffect(() => {
    console.log('🚀 Finance page loaded - activeTab:', activeTab);
    console.log('🏥 selectedPracticeId:', selectedPracticeId);
    console.log('👤 user:', user);
    
    fetchFinancialKPIs();
    if (activeTab === 'batch-management') {
      console.log('📊 Batch management tab active - triggering fetch');
      fetchBatchData();
    }
  }, [activeTab, fetchFinancialKPIs, fetchBatchData]);

  // Add debug logging when tab changes
  useEffect(() => {
    if (activeTab === 'batch-management') {
      console.log('📊 Switched to batch management tab');
      fetchBatchData();
    }
  }, [activeTab, fetchBatchData]);

  // Refetch data when filter changes
  useEffect(() => {
    if (activeTab === 'batch-management') {
      console.log('🔄 Filter changed, refetching batch data');
      fetchBatchData();
    }
  }, [batchFilters, activeTab, fetchBatchData]);

  const tabVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
    exit: { opacity: 0, y: -10, transition: { duration: 0.2 } }
  };

  const renderCharts = () => {
    if (!kpis) return null;

    return (
      <div className="space-y-6">
        {/* Monthly Revenue Trend */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Icon icon="solar:chart-line-bold-duotone" className="w-5 h-5 text-cyan-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800">Monthly Revenue Trend</h4>
            </div>
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
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
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
          </CardContent>
        </Card>

        {/* Revenue by Status & Invoice Volume */}
        <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
          {/* Revenue by Payment Status */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Icon icon="solar:pie-chart-2-bold-duotone" className="w-5 h-5 text-cyan-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800">Revenue by Payment Status</h4>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
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
            </CardContent>
          </Card>

          {/* Invoice Volume Trend */}
          <Card className="border-gray-200 shadow-sm">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Icon icon="solar:chart-square-bold-duotone" className="w-5 h-5 text-blue-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-800">Invoice Volume Trend</h4>
              </div>
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
                        backgroundColor: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                      formatter={(value: number) => [`${value} invoices`, 'Count']}
                    />
                    <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Services Table */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Icon icon="solar:list-check-bold-duotone" className="w-5 h-5 text-amber-600" />
              </div>
              <h4 className="text-lg font-semibold text-gray-800">Top 5 Services by Revenue</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">Service</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">Count</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">Revenue</th>
                    <th className="text-left py-3 px-3 text-sm font-medium text-gray-600">Avg Price</th>
                  </tr>
                </thead>
                <tbody>
                  {kpis.topServices.map((service, index) => (
                    <tr key={service.name} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-3 text-sm font-medium text-gray-800">
                        {service.name.length > 30 ? service.name.substring(0, 30) + '...' : service.name}
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-600">{service.count}</td>
                      <td className="py-3 px-3 text-sm font-semibold text-gray-900">
                        N${service.revenue.toLocaleString()}
                      </td>
                      <td className="py-3 px-3 text-sm text-gray-600">
                        N${service.avg.toFixed(0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
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

    // Filter batches based on multiple selected filters
    const filteredBatches = batches.filter(batch => {
      // If no filters are active, show nothing
      if (!batchFilters.paid && !batchFilters.unpaid && !batchFilters.active) return false;
      
      // Show if any of the active filters match
      return (batchFilters.paid && batch.status === 'paid') ||
             (batchFilters.unpaid && batch.status === 'unpaid') ||
             (batchFilters.active && batch.status === 'active');
    });

    if (filteredBatches.length === 0) {
      return (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6">
            {/* Header with controls */}
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-cyan-100 rounded-lg">
                  <Icon icon="solar:box-bold-duotone" className="w-5 h-5 text-cyan-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800">
                  Batches ({filteredBatches.length})
                </h3>
              </div>
              
              <div className="flex items-center gap-6">
                {/* Filter Toggles */}
                <div className="flex items-center gap-4">
                  {/* Paid Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Paid</span>
                    <button
                      onClick={() => setBatchFilters(prev => ({ ...prev, paid: !prev.paid }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        batchFilters.paid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          batchFilters.paid ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Unpaid Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Unpaid</span>
                    <button
                      onClick={() => setBatchFilters(prev => ({ ...prev, unpaid: !prev.unpaid }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        batchFilters.unpaid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          batchFilters.unpaid ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {/* Active Toggle */}
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">Active</span>
                    <button
                      onClick={() => setBatchFilters(prev => ({ ...prev, active: !prev.active }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        batchFilters.active ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          batchFilters.active ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>
                </div>
                
                {/* Submit All Button */}
                <button 
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                  onClick={handleSubmitAll}
                  disabled={isSubmittingAll || batches.filter(b => b.status === 'active').length === 0}
                >
                  {isSubmittingAll ? (
                    <>
                      <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:send-square-bold-duotone" className="w-4 h-4" />
                      Submit All Active
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="text-center py-12">
              <Icon icon="solar:box-minimalistic-bold-duotone" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No batches found for selected filters</p>
              <p className="text-sm text-gray-400">Batches will appear here when they are created</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-6">
          {/* Header with controls */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Icon icon="solar:box-bold-duotone" className="w-5 h-5 text-cyan-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">
                Batches ({filteredBatches.length})
              </h3>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Filter Toggles */}
              <div className="flex items-center gap-4">
                {/* Paid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Paid</span>
                  <button
                    onClick={() => setBatchFilters(prev => ({ ...prev, paid: !prev.paid }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      batchFilters.paid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        batchFilters.paid ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Unpaid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Unpaid</span>
                  <button
                    onClick={() => setBatchFilters(prev => ({ ...prev, unpaid: !prev.unpaid }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      batchFilters.unpaid ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        batchFilters.unpaid ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Active</span>
                  <button
                    onClick={() => setBatchFilters(prev => ({ ...prev, active: !prev.active }))}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      batchFilters.active ? 'bg-gradient-to-r from-cyan-500 to-blue-500' : 'bg-gray-200'
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        batchFilters.active ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
              
              {/* Submit All Button */}
              <button 
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium"
                onClick={handleSubmitAll}
                disabled={isSubmittingAll || batches.filter(b => b.status === 'active').length === 0}
              >
                {isSubmittingAll ? (
                  <>
                    <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon icon="solar:send-square-bold-duotone" className="w-4 h-4" />
                    Submit All Active
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Professional table-style batch cards */}
          <div className="overflow-hidden rounded-lg border border-gray-200">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-center py-4 px-6 text-sm font-medium text-gray-600">Batch #</th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Medical Aid</th>
                    <th className="py-4 px-4"></th>
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
                    const isSubmitting = submittingBatches.has(batch.batch_id);
                    
                    return (
                      <motion.tr
                        key={batch.batch_id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors group"
                      >
                        {/* Batch Number Badge with Heartbeat Animation */}
                        <td className="py-4 px-6 text-center">
                          <div className="relative inline-flex items-center justify-center">
                            {/* Heartbeat ring for active batches only */}
                            {batch.status === 'active' && (
                              <div 
                                className="absolute inset-0 rounded-full heartbeat-ring"
                                style={{ 
                                  background: `linear-gradient(45deg, ${themeColor}40, ${lightenColor(themeColor, 0.3)}60)`,
                                  transform: 'scale(1.4)'
                                }}
                              />
                            )}
                            <div 
                              className="relative inline-flex items-center justify-center w-8 h-8 rounded-full text-white font-bold text-xs shadow-sm z-10"
                              style={{ backgroundColor: themeColor }}
                            >
                              {batch.batch_number}
                            </div>
                          </div>
                        </td>

                        {/* Medical Aid Info */}
                        <td className="py-4 px-6">
                          <div>
                            <div className="text-sm text-gray-600 font-medium">
                              {batch.medical_aid_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              {batch.medical_aid_reference}
                            </div>
                          </div>
                        </td>

                        {/* Medical Aid Logo Column */}
                        <td className="py-4 px-4 text-center">
                          {batch.medical_aid_logo_url ? (
                            <img 
                              src={batch.medical_aid_logo_url} 
                              alt={batch.medical_aid_name}
                              className="w-12 h-12 rounded-lg object-contain bg-white p-1 shadow-sm mx-auto"
                            />
                          ) : (
                            <div 
                              className="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-xs shadow-sm mx-auto"
                              style={{ backgroundColor: themeColor }}
                            >
                              {batch.medical_aid_short_name.substring(0, 2)}
                            </div>
                          )}
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
                                className="text-xl font-bold"
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
                                className="text-xl font-bold"
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
                            <div className="text-2xl font-bold text-gray-800">
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
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                              onClick={() => handleIndividualSubmit(batch.batch_id)}
                              disabled={isSubmitting || isSubmittingAll || batch.status !== 'active'}
                            >
                              {isSubmitting ? (
                                <Icon icon="solar:refresh-circle-bold-duotone" className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Icon icon="solar:send-square-bold-duotone" className="w-4 h-4" />
                                  Submit
                                </>
                              )}
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
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Premium Header - Matching Settings Page Style */}
        <div className="rounded-xl p-4 md:p-5">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                {/* Finance Icon with Gradient Background */}
                <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-xl shadow-lg">
                  <Icon icon="solar:wallet-money-bold-duotone" className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-800">
                    Finance
                  </h1>
                  <p className="text-sm text-gray-500 mt-0.5">Manage revenue, payments, and batch submissions</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Date Range Filter */}
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border border-gray-200">
                <Icon icon="solar:calendar-bold-duotone" className="w-4 h-4 text-gray-500" />
                <select 
                  value={dateRange} 
                  onChange={(e) => setDateRange(e.target.value as typeof dateRange)}
                  className="bg-transparent border-0 text-sm text-gray-700 focus:outline-none transition-colors"
                >
                  <option value="30d">30 Days</option>
                  <option value="3m">3 Months</option>
                  <option value="6m">6 Months</option>
                  <option value="12m">12 Months</option>
                </select>
              </div>
              
              {/* User Avatar - Matching Settings Style */}
              {user && (
                <div className="relative group">
                  {/* Pulsating outer ring */}
                  <div className={`absolute inset-0 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full blur-lg opacity-30 group-hover:opacity-50 transition-opacity duration-300`}></div>
                  <div className={`absolute -inset-1 bg-gradient-to-br ${currentTheme.gradients.sidebar} rounded-full opacity-50`}></div>
                  
                  {/* Avatar circle */}
                  <div className="relative h-16 w-16 rounded-full overflow-hidden border-4 border-white shadow-2xl group-hover:scale-105 transition-transform duration-300">
                    <img 
                      src={user.avatar || `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`}
                      alt={user.name}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        e.currentTarget.src = `https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=64&h=64&fit=crop&crop=face`;
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs Navigation - Outside of content area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="border-b border-gray-200 p-2">
            <div className="grid grid-cols-4 md:grid-cols-8 gap-0">
              {[
                { key: 'overview', label: 'Overview', icon: 'solar:chart-square-bold-duotone' },
                { key: 'invoicing', label: 'Invoicing', icon: 'solar:document-text-bold-duotone' },
                { key: 'payments', label: 'Payments', icon: 'solar:wallet-bold-duotone' },
                { key: 'income', label: 'Income', icon: 'solar:money-bag-bold-duotone' },
                { key: 'expenses', label: 'Expenses', icon: 'solar:card-transfer-bold-duotone' },
                { key: 'reports', label: 'Reports', icon: 'solar:graph-new-up-bold-duotone' },
                { key: 'accounting', label: 'Accounting', icon: 'solar:calculator-bold-duotone' },
                { key: 'batch-management', label: 'Batches', icon: 'solar:box-bold-duotone' }
              ].map(({ key, label, icon }) => {
                const isActive = activeTab === key;
                return (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key as typeof activeTab)}
                    className={`relative flex flex-col items-center justify-center gap-1 px-2 py-3 text-xs font-medium transition-all duration-200 capitalize min-h-[60px] ${
                      isActive
                        ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                  >
                    <Icon icon={icon} className={`w-5 h-5 ${isActive ? 'text-white' : ''} flex-shrink-0`} />
                    <span className="truncate text-center">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">

          {/* Tab Content */}
          <div className="p-6">
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div
                  key="loading"
                  variants={tabVariants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="flex items-center justify-center py-12"
                >
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-600 mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading financial analytics...</p>
                  </div>
                </motion.div>
              )}

              {!loading && kpis && (
                <>
                  {activeTab === 'overview' && (
                    <motion.div
                      key="overview"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* KPI Cards - Only shown in Overview tab */}
                      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.1 }}
                          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:dollar-circle-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500">MTD</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-800">N${kpis.totalBilledMTD.toLocaleString()}</p>
                          <p className="text-sm text-gray-500 mt-1">Total Billed</p>
                        </motion.div>
                        
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.2 }}
                          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-red-100 rounded-lg">
                              <Icon icon="solar:bill-list-bold-duotone" className="w-5 h-5 text-red-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500">Pending</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-800">N${kpis.totalOutstanding.toLocaleString()}</p>
                          <p className="text-sm text-gray-500 mt-1">Outstanding</p>
                        </motion.div>
                        
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:hand-money-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500">MTD</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-800">N${kpis.totalCollectedMTD.toLocaleString()}</p>
                          <p className="text-sm text-gray-500 mt-1">Collected</p>
                        </motion.div>
                        
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.4 }}
                          className="bg-white rounded-xl p-6 shadow-sm border border-gray-200"
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className="p-2 bg-blue-100 rounded-lg">
                              <Icon icon="solar:documents-bold-duotone" className="w-5 h-5 text-blue-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-500">Processing</span>
                          </div>
                          <p className="text-2xl font-bold text-gray-800">N${kpis.claimsInProgress.toLocaleString()}</p>
                          <p className="text-sm text-gray-500 mt-1">Claims in Progress</p>
                        </motion.div>
                      </div>

                      {/* Analytics Charts - Now in Overview */}
                      {renderCharts()}
                      
                      {/* Medical Aid Breakdown */}
                      {kpis.medicalAidBreakdown.length > 0 && (
                        <Card className="border-gray-200 shadow-sm">
                          <CardContent className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-indigo-100 rounded-lg">
                                <Icon icon="solar:heart-pulse-bold-duotone" className="w-5 h-5 text-indigo-600" />
                              </div>
                              <h4 className="text-lg font-semibold text-gray-800">Medical Aid Revenue Breakdown</h4>
                            </div>
                            <div className="space-y-3">
                              {kpis.medicalAidBreakdown.map((provider, index) => (
                                <div key={provider.provider} className="flex items-center justify-between">
                                  <span className="font-medium text-gray-700">{provider.provider}</span>
                                  <div className="flex items-center gap-3">
                                    <div className="w-24 bg-gray-200 rounded-full h-2">
                                      <div 
                                        className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500" 
                                        style={{ width: `${provider.percentage}%` }}
                                      />
                                    </div>
                                    <span className="font-semibold text-gray-900 w-20 text-right">
                                      N${provider.value.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </motion.div>
                  )}

                  {activeTab === 'income' && (
                    <motion.div
                      key="income"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* Income Overview */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:money-bag-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Income Sources</h4>
                          </div>
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-cyan-50 to-blue-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600 mb-2">Total Income (Current Month)</p>
                              <p className="text-3xl font-bold text-gray-800">N${kpis.totalBilledMTD.toLocaleString()}</p>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600 mb-1">Medical Aid Income</p>
                                <p className="text-xl font-semibold text-gray-800">
                                  N${kpis.monthlyRevenueTrend[kpis.monthlyRevenueTrend.length - 1]?.medical_aid.toLocaleString() || 0}
                                </p>
                              </div>
                              <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600 mb-1">Patient Income</p>
                                <p className="text-xl font-semibold text-gray-800">
                                  N${kpis.monthlyRevenueTrend[kpis.monthlyRevenueTrend.length - 1]?.patient.toLocaleString() || 0}
                                </p>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Top Revenue Services */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:chart-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Top Revenue Services</h4>
                          </div>
                          <div className="space-y-3">
                            {kpis.topServices.map((service, index) => (
                              <div key={service.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div>
                                  <p className="font-medium text-gray-800">{service.name}</p>
                                  <p className="text-sm text-gray-600">{service.count} visits</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">N${service.revenue.toLocaleString()}</p>
                                  <p className="text-xs text-gray-600">Avg: N${service.avg.toFixed(2)}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {activeTab === 'expenses' && (
                    <motion.div
                      key="expenses"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* Expenses Overview */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-red-100 rounded-lg">
                              <Icon icon="solar:card-transfer-bold-duotone" className="w-5 h-5 text-red-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Expense Overview</h4>
                          </div>
                          <div className="space-y-4">
                            <div className="bg-gradient-to-r from-red-50 to-orange-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600 mb-2">Outstanding Payments</p>
                              <p className="text-3xl font-bold text-gray-800">N${kpis.totalOutstanding.toLocaleString()}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600 mb-1">Claims in Progress</p>
                              <p className="text-xl font-semibold text-gray-800">N${kpis.claimsInProgress.toLocaleString()}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Payment Status Distribution */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg">
                              <Icon icon="solar:wallet-bold-duotone" className="w-5 h-5 text-amber-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Payment Status</h4>
                          </div>
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <RechartsPieChart>
                                <Pie
                                  data={kpis.revenueByStatus}
                                  cx="50%"
                                  cy="50%"
                                  labelLine={false}
                                  label={({ name, value, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                  outerRadius={80}
                                  fill="#8884d8"
                                  dataKey="value"
                                >
                                  {kpis.revenueByStatus.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color || PIE_COLORS[index % PIE_COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => `N$${value.toLocaleString()}`} />
                              </RechartsPieChart>
                            </ResponsiveContainer>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {activeTab === 'invoicing' && (
                    <motion.div
                      key="invoicing"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* Invoice Management Header */}
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800">Invoice Management</h3>
                          <p className="text-sm text-gray-600 mt-1">Create, manage, and track patient invoices</p>
                        </div>
                        <button className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg">
                          <Icon icon="solar:add-circle-bold-duotone" className="w-5 h-5" />
                          <span>Create Invoice</span>
                        </button>
                      </div>

                      {/* Recent Invoices */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Recent Invoices</h4>
                          </div>
                          <div className="space-y-3">
                            {/* Sample invoice items */}
                            {[
                              { id: 'INV-2024-001', patient: 'John Doe', amount: 2500, status: 'paid', date: '2024-01-15' },
                              { id: 'INV-2024-002', patient: 'Jane Smith', amount: 1800, status: 'pending', date: '2024-01-16' },
                              { id: 'INV-2024-003', patient: 'Bob Johnson', amount: 3200, status: 'overdue', date: '2024-01-10' }
                            ].map((invoice) => (
                              <div key={invoice.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                                <div>
                                  <p className="font-medium text-gray-800">{invoice.id}</p>
                                  <p className="text-sm text-gray-600">{invoice.patient}</p>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-gray-900">N${invoice.amount.toLocaleString()}</p>
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    invoice.status === 'paid' ? 'bg-green-100 text-green-800' :
                                    invoice.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                    'bg-red-100 text-red-800'
                                  }`}>
                                    {invoice.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <button className="w-full mt-4 py-2 text-cyan-600 hover:text-cyan-700 font-medium transition-colors">
                            View All Invoices →
                          </button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {activeTab === 'payments' && (
                    <motion.div
                      key="payments"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* Payments Overview */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:wallet-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Payment Processing</h4>
                          </div>
                          
                          {/* Payment Stats */}
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600">Today's Collections</p>
                              <p className="text-2xl font-bold text-gray-800">N$12,450</p>
                            </div>
                            <div className="bg-gradient-to-r from-blue-50 to-cyan-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600">Pending Payments</p>
                              <p className="text-2xl font-bold text-gray-800">N$34,200</p>
                            </div>
                            <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600">Overdue Amount</p>
                              <p className="text-2xl font-bold text-gray-800">N$8,900</p>
                            </div>
                          </div>

                          {/* Recent Payments */}
                          <h5 className="font-medium text-gray-700 mb-3">Recent Payments</h5>
                          <div className="space-y-2">
                            {[
                              { patient: 'Sarah Williams', amount: 1500, method: 'Card', time: '10:30 AM' },
                              { patient: 'Mike Davis', amount: 2200, method: 'EFT', time: '09:15 AM' },
                              { patient: 'Lisa Brown', amount: 800, method: 'Cash', time: '08:45 AM' }
                            ].map((payment, index) => (
                              <div key={index} className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                                <div className="flex items-center gap-3">
                                  <Icon icon={payment.method === 'Card' ? 'solar:card-bold-duotone' : payment.method === 'EFT' ? 'solar:transfer-horizontal-bold-duotone' : 'solar:cash-out-bold-duotone'} 
                                    className="w-5 h-5 text-gray-600" />
                                  <div>
                                    <p className="font-medium text-gray-800">{payment.patient}</p>
                                    <p className="text-xs text-gray-500">{payment.time} • {payment.method}</p>
                                  </div>
                                </div>
                                <p className="font-semibold text-gray-900">N${payment.amount.toLocaleString()}</p>
                              </div>
                            ))}
                          </div>
                          
                          <button className="w-full mt-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all duration-200 shadow-md hover:shadow-lg font-medium">
                            Record New Payment
                          </button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {activeTab === 'reports' && (
                    <motion.div
                      key="reports"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* Financial Reports */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-cyan-100 rounded-lg">
                              <Icon icon="solar:graph-new-up-bold-duotone" className="w-5 h-5 text-cyan-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Financial Reports</h4>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[
                              { name: 'Profit & Loss Statement', icon: 'solar:chart-line-bold-duotone', description: 'Revenue, expenses, and net income', lastGenerated: '2 days ago' },
                              { name: 'Balance Sheet', icon: 'solar:pie-chart-2-bold-duotone', description: 'Assets, liabilities, and equity', lastGenerated: '1 week ago' },
                              { name: 'Cash Flow Statement', icon: 'solar:money-bag-bold-duotone', description: 'Cash inflows and outflows', lastGenerated: '3 days ago' },
                              { name: 'Tax Summary Report', icon: 'solar:document-text-bold-duotone', description: 'VAT and income tax summary', lastGenerated: '1 month ago' },
                              { name: 'Accounts Receivable Aging', icon: 'solar:calendar-bold-duotone', description: 'Outstanding invoice aging analysis', lastGenerated: 'Today' },
                              { name: 'Revenue by Service', icon: 'solar:health-bold-duotone', description: 'Income breakdown by medical services', lastGenerated: 'Yesterday' }
                            ].map((report) => (
                              <div key={report.name} className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-gray-100 rounded-lg">
                                    <Icon icon={report.icon} className="w-5 h-5 text-gray-600" />
                                  </div>
                                  <div className="flex-1">
                                    <h5 className="font-medium text-gray-800">{report.name}</h5>
                                    <p className="text-sm text-gray-600 mt-1">{report.description}</p>
                                    <p className="text-xs text-gray-500 mt-2">Last generated: {report.lastGenerated}</p>
                                  </div>
                                  <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                    <Icon icon="solar:download-bold-duotone" className="w-4 h-4 text-gray-600" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                          
                          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600" />
                              <p className="text-sm text-blue-800">Reports are generated automatically based on your financial data and can be exported to PDF or Excel.</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {activeTab === 'accounting' && (
                    <motion.div
                      key="accounting"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                      className="space-y-6"
                    >
                      {/* General Ledger & Journal Entries */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Chart of Accounts */}
                        <Card className="border-gray-200 shadow-sm">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-100 rounded-lg">
                                  <Icon icon="solar:folder-with-files-bold-duotone" className="w-5 h-5 text-cyan-600" />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800">Chart of Accounts</h4>
                              </div>
                              <button className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                                Add Account
                              </button>
                            </div>
                            
                            <div className="space-y-2">
                              {[
                                { code: '1000', name: 'Cash', type: 'Asset', balance: 125000 },
                                { code: '1200', name: 'Accounts Receivable', type: 'Asset', balance: 45000 },
                                { code: '2000', name: 'Accounts Payable', type: 'Liability', balance: 12000 },
                                { code: '3000', name: 'Revenue - Medical Services', type: 'Revenue', balance: 280000 },
                                { code: '4000', name: 'Operating Expenses', type: 'Expense', balance: 95000 }
                              ].map((account) => (
                                <div key={account.code} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer">
                                  <div>
                                    <p className="font-medium text-gray-800">{account.code} - {account.name}</p>
                                    <p className="text-xs text-gray-500">{account.type}</p>
                                  </div>
                                  <p className="font-semibold text-gray-900">N${account.balance.toLocaleString()}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>

                        {/* Journal Entries */}
                        <Card className="border-gray-200 shadow-sm">
                          <CardContent className="p-6">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-cyan-100 rounded-lg">
                                  <Icon icon="solar:notebook-bold-duotone" className="w-5 h-5 text-cyan-600" />
                                </div>
                                <h4 className="text-lg font-semibold text-gray-800">Recent Journal Entries</h4>
                              </div>
                              <button className="text-cyan-600 hover:text-cyan-700 text-sm font-medium">
                                New Entry
                              </button>
                            </div>
                            
                            <div className="space-y-3">
                              {[
                                { date: '2024-01-16', description: 'Medical supplies purchase', debit: 5000, credit: 5000 },
                                { date: '2024-01-15', description: 'Patient payment received', debit: 2500, credit: 2500 },
                                { date: '2024-01-14', description: 'Staff salaries', debit: 45000, credit: 45000 }
                              ].map((entry, index) => (
                                <div key={index} className="p-3 border border-gray-200 rounded-lg">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs text-gray-500">{entry.date}</p>
                                    <div className="flex gap-4 text-xs">
                                      <span className="text-green-600">DR: N${entry.debit.toLocaleString()}</span>
                                      <span className="text-red-600">CR: N${entry.credit.toLocaleString()}</span>
                                    </div>
                                  </div>
                                  <p className="text-sm text-gray-800">{entry.description}</p>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* Reconciliation Status */}
                      <Card className="border-gray-200 shadow-sm">
                        <CardContent className="p-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div className="p-2 bg-amber-100 rounded-lg">
                              <Icon icon="solar:check-circle-bold-duotone" className="w-5 h-5 text-amber-600" />
                            </div>
                            <h4 className="text-lg font-semibold text-gray-800">Bank Reconciliation</h4>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600">Bank Balance</p>
                              <p className="text-xl font-bold text-gray-800">N$125,000</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600">Book Balance</p>
                              <p className="text-xl font-bold text-gray-800">N$124,500</p>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-lg">
                              <p className="text-sm text-gray-600">Difference</p>
                              <p className="text-xl font-bold text-amber-600">N$500</p>
                            </div>
                          </div>
                          <button className="w-full mt-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium">
                            Start Reconciliation
                          </button>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}

                  {activeTab === 'batch-management' && (
                    <motion.div
                      key="batch-management"
                      variants={tabVariants}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      {renderBatchManagement()}
                    </motion.div>
                  )}
                </>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Finance;