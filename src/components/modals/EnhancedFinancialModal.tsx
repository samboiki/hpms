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
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
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

  useEffect(() => {
    if (isOpen && activeTab === 'batches') {
      fetchBatchData();
    }
    if (isOpen && activeTab === 'financial') {
      fetchInvoiceData();
    }
  }, [isOpen, activeTab]);

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
      .select('*')
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
              <p className="text-xl font-bold text-green-800">N$125,000</p>
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
              <p className="text-xl font-bold text-blue-800">45</p>
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
              <p className="text-xl font-bold text-orange-800">N$5,200</p>
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
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">N${invoice.amount.toFixed(2)}</td>
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
              <p className="text-2xl font-bold text-blue-800">{batches.filter(b => b.status === 'active').length}</p>
              <p className="text-xs text-blue-500">Ready to send</p>
            </div>
            <Package className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Completed Batches</p>
              <p className="text-2xl font-bold text-green-800">{batches.filter(b => b.status === 'completed').length}</p>
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
                      <p className="text-sm font-medium text-green-600">N${batch.total_amount.toFixed(2)}</p>
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
                      <p className="text-sm font-medium text-green-600">N${batch.total_amount.toFixed(2)}</p>
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

  const renderChart = () => {
    const maxValue = Math.max(...data.chartData.datasets[0].data);
    
    return (
      <div className="space-y-6">
        {/* Bar chart */}
        <div className="bg-gray-50 rounded-xl p-6">
          <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Financial Distribution
          </h4>
          <div className="space-y-3">
            {data.chartData.labels.map((label, index) => {
              const value = data.chartData.datasets[0].data[index];
              const percentage = (value / maxValue) * 100;
              
              return (
                <div key={label} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-gray-700">{label}</span>
                    <span className="font-bold text-gray-900">{value}</span>
                  </div>
                  <div className="bg-gray-200 rounded-full h-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${percentage}%` }}
                      transition={{ duration: 1, delay: index * 0.1 }}
                      className={`h-2 rounded-full bg-gradient-to-r ${colorMap.finance}`}
                    />
                  </div>
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
              <p className="text-2xl font-bold">N$125,000</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">This Month</p>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <p className="text-xl font-bold">N$18,500</p>
              </div>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Outstanding</p>
              <p className="text-lg font-semibold">N$5,200</p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm">
              <p className="text-white/80 text-sm">Active Batches</p>
              <p className="text-lg font-semibold">{batches.filter(b => b.status === 'active').length}</p>
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
              {activeTab === 'overview' && renderChart()}
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