import React, { useState, useEffect, useCallback, useRef } from 'react';
import { plainWords } from '../../utils/plainErrors';
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
  Users,
  Package,
  Send,
  Calendar,
  FileText,
  CheckCircle,
  Loader2,
  Maximize2,
  Minimize2,
  Banknote,
  Receipt,
  Wallet
} from 'lucide-react';
import { format } from 'date-fns';
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
import { useTheme } from '../../stores/themeStore';
import { financialKpiService, type FinancialKPIs } from '../../services/financialKpiService';
import { toast } from 'react-hot-toast';
import { formatNad, nadParts } from '../../utils/billing/money';

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

// formatNad throws on NaN, so a missing amount shows as N$ 0.00 instead of crashing the modal
const nad = (value: number | string | null | undefined) => formatNad(Number(value) || 0);

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
  const { currentTheme } = useTheme();
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
  const [activeTab, setActiveTab] = useState<'overview' | 'analytics' | 'insights' | 'batch-management'>('overview');
  const [dateRange, setDateRange] = useState<'30d' | '3m' | '6m' | '12m'>('30d');
  const [kpis, setKpis] = useState<FinancialKPIs | null>(null);
  const [isMaximized, setIsMaximized] = useState(false);

  const toggleMaximize = useCallback(() => {
    setIsMaximized(prev => !prev);
  }, []);
  const [batches, setBatches] = useState<BatchData[]>([]);
  // Start in loading state so the first open never flashes the "no data" state
  const [loading, setLoading] = useState(true);
  const [kpiError, setKpiError] = useState<string | null>(null);
  const kpiRequestIdRef = useRef(0);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchFilters, setBatchFilters] = useState<{paid: boolean, unpaid: boolean, active: boolean}>({
    paid: false,
    unpaid: false, 
    active: true
  });
  const [submittingBatches, setSubmittingBatches] = useState<Set<string>>(new Set());
  const [isSubmittingAll, setIsSubmittingAll] = useState(false);
  
  const { user, selectedPracticeId } = useAuthStore();

  // KPI data comes from the shared finance service (practice-scoped, always settles)
  const kpiPracticeId = selectedPracticeId || user?.practice_id || null;
  const fetchFinancialKPIs = useCallback(async () => {
    const requestId = ++kpiRequestIdRef.current;
    setLoading(true);
    setKpiError(null);
    try {
      const result = await financialKpiService.getFinancialKPIs(kpiPracticeId, dateRange);
      if (requestId === kpiRequestIdRef.current) {
        setKpis(result);
      }
    } catch (error) {
      console.error('Error fetching financial KPIs:', error);
      if (requestId === kpiRequestIdRef.current) {
        setKpis(null);
        setKpiError(error instanceof Error ? plainWords(error.message) : 'Failed to load financial data');
      }
    } finally {
      // Ignore superseded requests so a slow older response cannot clear a newer load
      if (requestId === kpiRequestIdRef.current) {
        setLoading(false);
      }
    }
  }, [kpiPracticeId, dateRange]);

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
      // Never fall back to some other practice's batches (e.g. the first practice in the system)
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
      // The practice's number, then its batches. Three database functions were tried first
      // (get_practice_batches_simple, _with_doctors, get_practice_batches): none exists, so every load
      // made three failed requests before reaching this query, which is what always answered
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

  // --- Function to handle individual batch submission (resolves true when the batch was sent) ---
  const handleIndividualSubmit = async (batchId: string): Promise<boolean> => {
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

      console.log('✅ Success:', data?.message);
      toast.success(data?.message || 'Batch sent to the medical aid');

      // Refresh the batch list to show the new 'sent' status
      fetchBatchData();
      return true;

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
      
      toast.error(`Could not submit the batch: ${errorMessage}`);
      return false;
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
      toast('No active batches to submit.');
      return;
    }

    const total = activeBatchesToSubmit.length;
    // Each batch is emailed to its medical aid and cannot be recalled, so confirm the bulk send
    if (!window.confirm(`Send all ${total} active batch${total === 1 ? '' : 'es'} to the medical aids now?`)) return;

    setIsSubmittingAll(true);

    // Attempt all submissions, even if some fail
    const results = await Promise.allSettled(
      activeBatchesToSubmit.map(batch => handleIndividualSubmit(batch.batch_id))
    );

    setIsSubmittingAll(false);

    const failed = results.filter(result => result.status !== 'fulfilled' || !result.value).length;
    if (failed === 0) {
      toast.success(`All ${total} batch${total === 1 ? '' : 'es'} submitted`);
    } else {
      toast.error(`${failed} of ${total} batch${total === 1 ? '' : 'es'} could not be submitted`);
    }

    // Refresh data after all submissions are attempted
    fetchBatchData();
  };

  // KPIs depend on open state, practice and date range only; batch data is handled by the effects below
  useEffect(() => {
    if (isOpen) {
      fetchFinancialKPIs();
    }
  }, [isOpen, fetchFinancialKPIs]);

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
  }, [batchFilters, activeTab, isOpen, fetchBatchData]);

  if (!isOpen) return null;


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
                    nad(value),
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
                    formatter={(value: number) => [nad(value), 'Amount']}
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
                          {nad(service.revenue)}
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
                      {nad(service.revenue)}
                    </td>
                    <td className="py-2 px-3 text-sm text-gray-600 font-rubik">
                      {nad(service.avg)}
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
        <div className="space-y-4">
          {/* Header with controls */}
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-1">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Package className="w-6 h-6 text-gray-600" />
              </div>
              <h3 className="text-2xl font-bold text-[#4f575e]">
                Batches ({filteredBatches.length})
              </h3>
            </div>
            
            <div className="flex items-center gap-6">
              {/* Filter Toggles */}
              <div className="flex items-center gap-4">
                {/* Paid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-rubik" style={{ color: '#01b9d5' }}>Paid</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                    style={{
                      backgroundColor: batchFilters.paid ? '#01b9d5' : '#e5e7eb'
                    }}
                    onClick={() => setBatchFilters(prev => ({ ...prev, paid: !prev.paid }))}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilters.paid ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {/* Unpaid Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-rubik" style={{ color: '#ec8222' }}>Unpaid</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                    style={{
                      backgroundColor: batchFilters.unpaid ? '#ec8222' : '#e5e7eb'
                    }}
                    onClick={() => setBatchFilters(prev => ({ ...prev, unpaid: !prev.unpaid }))}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilters.unpaid ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>

                {/* Active Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold font-rubik" style={{ color: '#6c67f0' }}>Active</span>
                  <div 
                    className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                    style={{
                      backgroundColor: batchFilters.active ? '#6c67f0' : '#e5e7eb'
                    }}
                    onClick={() => setBatchFilters(prev => ({ ...prev, active: !prev.active }))}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                        batchFilters.active ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              </div>
              
              {/* Submit All Button */}
              <button
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-lg hover:from-slate-600 hover:to-slate-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleSubmitAll}
                disabled={isSubmittingAll || batches.filter(b => b.status === 'active').length === 0}
                title={batches.some(b => b.status === 'active') ? 'Email every active batch to its medical aid' : 'No active batches to submit'}
              >
                {isSubmittingAll ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit All Active
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="text-center py-12">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-4">No batches found for selected filters</p>
            <p className="text-sm text-gray-400">Batches will appear here when they are created</p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {/* Header with controls */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-1">
            <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
              <Package className="w-6 h-6 text-gray-600" />
            </div>
            <h3 className="text-2xl font-bold text-[#4f575e]">
              Batches ({filteredBatches.length})
            </h3>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Filter Toggles */}
            <div className="flex items-center gap-4">
              {/* Paid Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-rubik" style={{ color: '#01b9d5' }}>Paid</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                  style={{
                    backgroundColor: batchFilters.paid ? '#01b9d5' : '#e5e7eb'
                  }}
                  onClick={() => setBatchFilters(prev => ({ ...prev, paid: !prev.paid }))}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilters.paid ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Unpaid Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-rubik" style={{ color: '#ec8222' }}>Unpaid</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                  style={{
                    backgroundColor: batchFilters.unpaid ? '#ec8222' : '#e5e7eb'
                  }}
                  onClick={() => setBatchFilters(prev => ({ ...prev, unpaid: !prev.unpaid }))}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilters.unpaid ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold font-rubik" style={{ color: '#6c67f0' }}>Active</span>
                <div 
                  className={`relative inline-flex h-6 w-12 cursor-pointer rounded-full transition-colors duration-300`}
                  style={{
                    backgroundColor: batchFilters.active ? '#6c67f0' : '#e5e7eb'
                  }}
                  onClick={() => setBatchFilters(prev => ({ ...prev, active: !prev.active }))}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform duration-300 mt-0.5 ${
                      batchFilters.active ? 'translate-x-6 ml-0.5' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </div>
            </div>
            
            {/* Submit All Button */}
            <button
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-lg hover:from-slate-600 hover:to-slate-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleSubmitAll}
              disabled={isSubmittingAll || batches.filter(b => b.status === 'active').length === 0}
              title={batches.some(b => b.status === 'active') ? 'Email every active batch to its medical aid' : 'No active batches to submit'}
            >
              {isSubmittingAll ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Submit All Active
                </>
              )}
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
                      className="border-b border-gray-100 hover:bg-gray-25 transition-colors group"
                      style={{ backgroundColor: index % 2 === 0 ? 'white' : '#fafafa' }}
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
                            {(batch.medical_aid_short_name || batch.medical_aid_reference || '').substring(0, 2)}
                          </div>
                        )}
                      </td>

                      {/* Created Date */}
                      <td className="py-4 px-6">
                        <div className="text-sm text-gray-700 font-medium">
                          {format(new Date(batch.batch_date), 'd MMM yyyy')}
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
                              const { whole, cents } = nadParts(Number(batch.total_amount) || 0);
                              return (
                                <>
                                  N$ {whole}
                                  <span className="text-gray-400">.{cents}</span>
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
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-lg hover:from-slate-600 hover:to-slate-700 transition-all duration-200 shadow-md hover:shadow-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            onClick={() => handleIndividualSubmit(batch.batch_id)}
                            disabled={isSubmitting || isSubmittingAll || batch.status !== 'active'}
                            title={batch.status === 'active' ? 'Email this batch to the medical aid' : 'Only active batches can be submitted'}
                          >
                            {isSubmitting ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Send className="w-4 h-4" />
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
      </div>
    );
  };

  return createPortal(
    <div 
      className={`fixed inset-0 z-[9999] ${
        isMaximized 
          ? 'bg-black/20 p-0' 
          : 'bg-black/50 backdrop-blur-sm flex items-center justify-center p-4'
      }`} 
      onClick={onClose}
    >
      <motion.div
        initial={{ 
          opacity: 0, 
          scale: isMaximized ? 1 : 0.95, 
          y: isMaximized ? 0 : 20 
        }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ 
          opacity: 0, 
          scale: isMaximized ? 1 : 0.95, 
          y: isMaximized ? 0 : 20 
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        className={`relative bg-white shadow-2xl overflow-hidden w-full overflow-y-auto transition-all duration-300 ${
          isMaximized 
            ? 'h-screen max-w-none max-h-none rounded-none' 
            : 'max-w-7xl max-h-[90vh] rounded-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-[#01b9d5] via-[#0891b2] to-[#0e7490] p-6 text-white">
          <div className="flex items-center justify-between mb-6">
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
              <button
                onClick={toggleMaximize}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title={isMaximized ? 'Minimize' : 'Maximize'}
                aria-label={isMaximized ? 'Minimize' : 'Maximize'}
              >
                {isMaximized ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
              </button>
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
                title="Close"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* Stat Cards in Header */}
          {kpis && (
            <div className={`grid gap-4 ${isMaximized ? 'grid-cols-4' : 'grid-cols-2 md:grid-cols-4'}`}>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 overflow-hidden"
              >
                <div className="absolute -top-2 -right-2 opacity-20 transform rotate-12">
                  <DollarSign className="w-12 h-12 text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-white/80 text-sm font-medium">Total Billed MTD</p>
                  <p className="text-white text-2xl font-bold">{nad(kpis.totalBilledMTD)}</p>
                  <p className="text-white/60 text-xs">This month</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 overflow-hidden"
              >
                <div className="absolute -top-2 -right-2 opacity-20 transform -rotate-12">
                  <Banknote className="w-12 h-12 text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-white/80 text-sm font-medium">Outstanding</p>
                  <p className="text-white text-2xl font-bold">{nad(kpis.totalOutstanding)}</p>
                  <p className="text-white/60 text-xs">Pending collection</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 overflow-hidden"
              >
                <div className="absolute -top-2 -right-2 opacity-20 transform rotate-6">
                  <Receipt className="w-12 h-12 text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-white/80 text-sm font-medium">Collected MTD</p>
                  <p className="text-white text-2xl font-bold">{nad(kpis.totalCollectedMTD)}</p>
                  <p className="text-white/60 text-xs">This month</p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="relative bg-white/10 backdrop-blur-sm rounded-xl p-4 border border-white/20 overflow-hidden"
              >
                <div className="absolute -top-2 -right-2 opacity-20 transform -rotate-6">
                  <Wallet className="w-12 h-12 text-white" />
                </div>
                <div className="relative z-10">
                  <p className="text-white/80 text-sm font-medium">Claims in Progress</p>
                  <p className="text-white text-2xl font-bold">{nad(kpis.claimsInProgress)}</p>
                  <p className="text-white/60 text-xs">Processing</p>
                </div>
              </motion.div>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 px-6">
          <div className="flex w-full">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'analytics', label: 'Financial Analytics', icon: TrendingUp },
              { key: 'insights', label: 'Insights', icon: Users },
              { key: 'batch-management', label: 'Batch Management', icon: Package }
            ].map(({ key, label, icon: Icon }, index) => {
              const isActive = activeTab === key;
              return (
                <motion.button
                  key={key}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    x: isActive ? [0, -2, 2, -1, 1, 0] : 0
                  }}
                  transition={{ 
                    opacity: { delay: index * 0.05, duration: 0.3 },
                    y: { delay: index * 0.05, duration: 0.3 },
                    x: isActive ? { 
                      duration: 0.5, 
                      repeat: Infinity, 
                      repeatDelay: 3,
                      ease: "easeInOut"
                    } : { duration: 0.3 }
                  }}
                  whileHover={{ 
                    scale: 1.02,
                    y: -2,
                    transition: { duration: 0.2 }
                  }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setActiveTab(key as typeof activeTab)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-300 relative ${
                    isActive
                      ? 'text-[#01b9d5] border-[#01b9d5] bg-gradient-to-t from-cyan-50 to-transparent'
                      : 'text-gray-500 border-transparent hover:text-[#01b9d5] hover:bg-cyan-50/50'
                  }`}
                >
                  <motion.div
                    animate={isActive ? { 
                      scale: [1, 1.2, 1, 1.2, 1],
                    } : { scale: 1 }}
                    transition={{ 
                      duration: isActive ? 1.2 : 0.3, 
                      ease: "easeInOut",
                      repeat: isActive ? Infinity : 0,
                      repeatDelay: 2
                    }}
                  >
                    <Icon className={`w-4 h-4 transition-all duration-300 ${
                      isActive ? 'text-[#01b9d5] drop-shadow-sm' : ''
                    }`} />
                  </motion.div>
                  <span className="hidden sm:inline font-medium">{label}</span>
                  
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-12" role="status">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading financial analytics...</p>
              </div>
            </div>
          )}

          {!loading && !kpis && (
            <div className="text-center py-12" role="alert">
              <p className="text-gray-500 mb-1">No financial data available</p>
              <p className="text-sm text-gray-400 mb-4">{kpiError || 'Financial data could not be loaded.'}</p>
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
                  {/* KPI Cards now shown in header */}
                  {kpis.invoiceCount === 0 ? (
                    <div className="text-center py-12 border border-dashed border-gray-200 rounded-xl">
                      <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" aria-hidden="true" />
                      <p className="font-medium text-gray-700">No invoices in this period</p>
                      <p className="text-sm text-gray-500 mt-1">Invoices are created when a visit is updated with billing services.</p>
                    </div>
                  ) : (
                    renderCharts()
                  )}
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-6">
                  {/* KPI Cards now shown in header */}
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
                                {nad(provider.value)}
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