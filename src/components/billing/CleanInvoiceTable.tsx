import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Receipt,
  ChevronDown,
  ChevronRight,
  Calendar,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  FileText,
  Hash,
  DollarSign,
  Activity,
  Building2,
  User,
  Printer,
  Mail,
  Edit3,
  Trash2,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import PrintStatementModal from '../modals/PrintStatementModal';

interface Invoice {
  id: string;
  invoice_number: string;
  visit_id: string;
  visit_date?: string;
  visit_number?: number;
  chief_complaint?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  payment_method?: string;
  total: number;
  created_at: string;
  services: Service[];
  medical_aid_covered: number;
  patient_portion: number;
}

interface Service {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  medical_aid_covered: number;
  patient_portion: number;
}

interface CleanInvoiceTableProps {
  patientId: string;
  onVisitClick?: (visitId: string) => void;
  onStatusChange?: (invoiceId: string, newStatus: 'paid' | 'pending' | 'overdue' | 'cancelled') => void;
  onEmailInvoice?: (invoice: Invoice) => void;
  onPrintInvoice?: (invoice: Invoice) => void;
  onDeleteInvoice?: (invoice: Invoice) => void;
  isPrintingPDF?: boolean;
}

const CleanInvoiceTable: React.FC<CleanInvoiceTableProps> = ({
  patientId,
  onVisitClick,
  onStatusChange,
  onEmailInvoice,
  onPrintInvoice,
  onDeleteInvoice,
  isPrintingPDF = false
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);
  const [showPrintStatementModal, setShowPrintStatementModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState<string | null>(null);

  useEffect(() => {
    if (patientId) {
      fetchInvoices();
    }
  }, [patientId]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest('.status-dropdown')) {
        setStatusDropdown(null);
      }
    };

    if (statusDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [statusDropdown]);

  // Handle invoice deletion with real-time update
  const handleDeleteInvoice = async (invoiceId: string) => {
    try {
      console.log('🗑️ Starting deletion for invoice:', invoiceId);
      
      // Delete invoice services first
      const { error: servicesError } = await supabase
        .from('invoice_services')
        .delete()
        .eq('invoice_id', invoiceId);
      
      if (servicesError) {
        throw new Error(`Failed to delete invoice services: ${servicesError.message}`);
      }
      
      // Delete the invoice
      const { error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .delete()
        .eq('id', invoiceId);
      
      if (invoiceError) {
        throw new Error(`Failed to delete invoice: ${invoiceError.message}`);
      }
      
      // Update local state immediately without refresh
      setInvoices(prevInvoices => prevInvoices.filter(inv => inv.id !== invoiceId));
      
      console.log('✅ Invoice deleted successfully');
      setShowDeleteModal(null);
      
      // Optional: call parent callback if provided
      if (onDeleteInvoice) {
        const deletedInvoice = invoices.find(inv => inv.id === invoiceId);
        if (deletedInvoice) {
          onDeleteInvoice(deletedInvoice);
        }
      }
      
    } catch (error) {
      console.error('❌ Error deleting invoice:', error);
      setShowDeleteModal(null);
    }
  };

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      const billingStartTime = performance.now();
      
      const [invoicesResult, visitsResult] = await Promise.all([
        supabase
          .from('invoices_enhanced')
          .select('id, invoice_number, visit_id, payment_status, payment_method, total, created_at')
          .eq('patient_id', patientId)
          .order('created_at', { ascending: false }),
          
        supabase
          .from('visits')
          .select('id, visit_date, visit_number, chief_complaint')
          .eq('patient_id', patientId)
      ]);

      if (invoicesResult.error) throw invoicesResult.error;
      if (!invoicesResult.data || invoicesResult.data.length === 0) {
        setInvoices([]);
        setLoading(false);
        return;
      }

      const invoiceIds = invoicesResult.data.map(inv => inv.id);
      const { data: servicesData } = await supabase
        .from('invoice_services')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: true });

      const visitMap = new Map(visitsResult.data?.map(v => [v.id, v]) || []);
      const servicesByInvoice = new Map<string, Service[]>();
      
      servicesData?.forEach(service => {
        if (!servicesByInvoice.has(service.invoice_id)) {
          servicesByInvoice.set(service.invoice_id, []);
        }
        servicesByInvoice.get(service.invoice_id)?.push({
          id: service.id,
          code: service.code,
          description: service.description,
          quantity: service.quantity,
          unit_price: service.unit_price,
          total_price: service.total_price,
          medical_aid_covered: service.medical_aid_covered || 0,
          patient_portion: service.patient_portion || 0
        });
      });

      const processedInvoices: Invoice[] = invoicesResult.data.map(invoice => {
        const visit = visitMap.get(invoice.visit_id);
        const services = servicesByInvoice.get(invoice.id) || [];
        const medicalAidTotal = services.reduce((sum, s) => sum + s.medical_aid_covered, 0);
        const patientTotal = services.reduce((sum, s) => sum + s.patient_portion, 0);

        return {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          visit_id: invoice.visit_id,
          visit_date: visit?.visit_date,
          visit_number: visit?.visit_number,
          chief_complaint: visit?.chief_complaint,
          payment_status: invoice.payment_status || 'pending',
          payment_method: invoice.payment_method,
          total: invoice.total || 0,
          created_at: invoice.created_at,
          services,
          medical_aid_covered: medicalAidTotal,
          patient_portion: patientTotal
        };
      });

      const billingEndTime = performance.now();
      console.log(`⏱️ Billing query: ${(billingEndTime - billingStartTime).toFixed(2)}ms`);

      setInvoices(processedInvoices);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      setInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (invoiceId: string) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedInvoices(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          bg: 'bg-green-50',
          text: 'text-green-700',
          border: 'border-green-200',
          dot: 'bg-green-500'
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          text: 'text-yellow-700',
          border: 'border-yellow-200',
          dot: 'bg-yellow-500'
        };
      case 'overdue':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-200',
          dot: 'bg-red-500'
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          dot: 'bg-gray-500'
        };
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'overdue':
        return <AlertTriangle className="w-4 h-4" />;
      default:
        return <Activity className="w-4 h-4" />;
    }
  };

  // Filter and sort invoices
  const filteredInvoices = invoices
    .filter(invoice => filter === 'all' || invoice.payment_status === filter)
    .sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'amount':
          comparison = a.total - b.total;
          break;
        case 'status':
          comparison = a.payment_status.localeCompare(b.payment_status);
          break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

  // Calculate stats
  const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const paidAmount = filteredInvoices
    .filter(inv => inv.payment_status === 'paid')
    .reduce((sum, inv) => sum + inv.total, 0);
  const pendingAmount = filteredInvoices
    .filter(inv => inv.payment_status === 'pending')
    .reduce((sum, inv) => sum + inv.total, 0);
  const overdueAmount = filteredInvoices
    .filter(inv => inv.payment_status === 'overdue')
    .reduce((sum, inv) => sum + inv.total, 0);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 rounded w-32"></div>
                  <div className="h-4 bg-gray-200 rounded w-24"></div>
                </div>
              </div>
              <div className="h-8 bg-gray-200 rounded w-24"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Total Invoiced</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Rubik, sans-serif', color: '#4f575e' }}>
                N$ <span style={{ color: '#4f575e' }}>{Math.floor(totalAmount)}</span><span style={{ color: '#8B9197' }}>.{(totalAmount % 1).toFixed(2).slice(2)}</span>
              </p>
            </div>
            <div className="p-2 bg-blue-100 rounded-lg">
              <Receipt className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Paid</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Rubik, sans-serif', color: '#4f575e' }}>
                N$ <span style={{ color: '#4f575e' }}>{Math.floor(paidAmount)}</span><span style={{ color: '#8B9197' }}>.{(paidAmount % 1).toFixed(2).slice(2)}</span>
              </p>
            </div>
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Pending</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Rubik, sans-serif', color: '#4f575e' }}>
                N$ <span style={{ color: '#4f575e' }}>{Math.floor(pendingAmount)}</span><span style={{ color: '#8B9197' }}>.{(pendingAmount % 1).toFixed(2).slice(2)}</span>
              </p>
            </div>
            <div className="p-2 bg-yellow-100 rounded-lg">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase">Overdue</p>
              <p className="text-2xl font-bold" style={{ fontFamily: 'Rubik, sans-serif', color: '#4f575e' }}>
                N$ <span style={{ color: '#4f575e' }}>{Math.floor(overdueAmount)}</span><span style={{ color: '#8B9197' }}>.{(overdueAmount % 1).toFixed(2).slice(2)}</span>
              </p>
            </div>
            <div className="p-2 bg-red-100 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Invoice History
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="flex items-center gap-3">
          {/* Print Statement Button */}
          <button
            onClick={() => {
              console.log('🖨️ Print Statement button clicked');
              console.log('📊 Current invoices:', invoices.length);
              console.log('🔍 Filtered invoices:', filteredInvoices.length);
              console.log('📋 Current modal state:', showPrintStatementModal);
              setShowPrintStatementModal(true);
              console.log('✅ Modal state set to true');
              
              // Debug: Check if modal renders in DOM after state change
              setTimeout(() => {
                const modalElement = document.querySelector('[data-testid="print-statement-modal"]');
                console.log('🔍 Modal element found in DOM:', !!modalElement);
                if (!modalElement) {
                  console.error('❌ PrintStatementModal not found in DOM!');
                  // Fallback alert
                  alert('PrintStatementModal debug: Modal not appearing in DOM. Check console for details.');
                } else {
                  console.log('✅ Modal found with z-index:', modalElement.style.zIndex);
                  console.log('📍 Modal computed style:', window.getComputedStyle(modalElement));
                }
              }, 100);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-md hover:from-purple-700 hover:to-indigo-700 transition-all duration-200 shadow-sm text-xs font-medium"
            title="Print Statement"
          >
            <FileText className="w-3.5 h-3.5" />
            Statement
          </button>
          
          {/* Status Filter */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {(['all', 'paid', 'pending', 'overdue'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  filter === status
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>

          {/* Sort */}
          <select
            value={`${sortBy}-${sortOrder}`}
            onChange={(e) => {
              const [sort, order] = e.target.value.split('-');
              setSortBy(sort as any);
              setSortOrder(order as any);
            }}
            className="text-xs border border-gray-300 rounded-lg px-3 py-1.5 bg-white"
          >
            <option value="date-desc">Newest First</option>
            <option value="date-asc">Oldest First</option>
            <option value="amount-desc">Highest Amount</option>
            <option value="amount-asc">Lowest Amount</option>
            <option value="status-asc">Status A-Z</option>
          </select>
        </div>
      </div>

      {/* Clean Invoice Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Visit Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Services
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-sm text-gray-500">No invoices found</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((invoice, index) => {
                  const isExpanded = expandedInvoices.has(invoice.id);
                  const statusColors = getStatusColor(invoice.payment_status);

                  return (
                    <React.Fragment key={invoice.id}>
                      {/* Main Invoice Row */}
                      <tr 
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => toggleExpanded(invoice.id)}
                      >
                        {/* Invoice Info */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-gray-100 rounded-full text-sm font-semibold text-gray-600">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                #{invoice.invoice_number}
                              </p>
                              <p className="text-xs text-gray-500">
                                {format(parseISO(invoice.created_at), 'MMM dd, yyyy')}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Visit Details */}
                        <td className="px-6 py-4">
                          {invoice.visit_date ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onVisitClick?.(invoice.visit_id);
                              }}
                              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 border border-gray-200 rounded-md hover:bg-gray-200 transition-colors text-sm"
                            >
                              <Calendar className="w-3 h-3 text-gray-600" />
                              <span className="font-medium text-gray-700">
                                Visit #{invoice.visit_number || 'N/A'}
                              </span>
                              <ExternalLink className="w-3 h-3 text-gray-500" />
                            </button>
                          ) : (
                            <span className="text-gray-400 text-sm">No visit linked</span>
                          )}
                        </td>

                        {/* Services Summary */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </motion.div>
                            <span className="text-sm text-gray-600">
                              {invoice.services.length} service{invoice.services.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </td>

                        {/* Amount */}
                        <td className="px-6 py-4 text-right">
                          <p className="font-bold text-gray-900">
                            N$ {invoice.total.toFixed(2)}
                          </p>
                          {invoice.medical_aid_covered > 0 && (
                            <p className="text-xs text-green-600 font-semibold">
                              Aid: N$ {invoice.medical_aid_covered.toFixed(2)}
                            </p>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors.bg} ${statusColors.text} ${statusColors.border} border`}>
                            <div className={`w-1.5 h-1.5 rounded-full ${statusColors.dot}`}></div>
                            {getStatusIcon(invoice.payment_status)}
                            <span className="capitalize">{invoice.payment_status}</span>
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('📧 Email invoice button clicked for invoice:', invoice.invoice_number);
                                onEmailInvoice?.(invoice);
                              }}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-sm border border-gray-200"
                              title="Email Invoice"
                            >
                              <Mail className="w-4 h-4 text-green-600" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🖨️ Print invoice button clicked for invoice:', invoice.invoice_number);
                                onPrintInvoice?.(invoice);
                              }}
                              disabled={isPrintingPDF}
                              className={`p-2 rounded-lg transition-colors shadow-sm border ${
                                isPrintingPDF 
                                  ? 'bg-gray-300 text-gray-500 border-gray-300 cursor-not-allowed' 
                                  : 'bg-gray-100 hover:bg-gray-200 border-gray-200'
                              }`}
                              title={isPrintingPDF ? "Generating PDF..." : "Print Invoice"}
                            >
                              {isPrintingPDF ? (
                                <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin"></div>
                              ) : (
                                <Printer className="w-4 h-4 text-gray-600" />
                              )}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🗑️ Delete invoice button clicked for invoice:', invoice.invoice_number);
                                setShowDeleteModal(invoice.id);
                              }}
                              className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-sm border border-gray-200"
                              title="Delete Invoice"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  console.log('✏️ Edit status button clicked for invoice:', invoice.invoice_number);
                                  setStatusDropdown(statusDropdown === invoice.id ? null : invoice.id);
                                }}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors shadow-sm border border-gray-200"
                                title="Change Status"
                              >
                                <Edit3 className="w-4 h-4 text-orange-600" />
                              </button>
                              
                              {/* Status Dropdown */}
                              <AnimatePresence>
                                {statusDropdown === invoice.id && (
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="status-dropdown absolute top-full right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[140px] overflow-hidden"
                                  >
                                    {(['paid', 'pending', 'overdue', 'cancelled'] as const).map((status) => {
                                      const statusConfig = getStatusColor(status);
                                      return (
                                        <button
                                          key={status}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            onStatusChange?.(invoice.id, status);
                                            setStatusDropdown(null);
                                          }}
                                          className={`w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-gray-50 transition-colors ${
                                            invoice.payment_status === status ? 'bg-blue-50' : ''
                                          }`}
                                        >
                                          <div className={`w-2 h-2 rounded-full ${statusConfig.dot}`}></div>
                                          {getStatusIcon(status)}
                                          <span className="capitalize">{status}</span>
                                        </button>
                                      );
                                    })}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Services Row */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={6} className="px-6 py-0 bg-gray-50">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.3 }}
                                className="overflow-hidden"
                              >
                                <div className="py-4">
                                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Service Details
                                  </h4>
                                  
                                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                    <table className="w-full">
                                      <thead className="bg-gray-50">
                                        <tr>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                                          <th className="px-4 py-2 text-center text-xs font-medium text-gray-500">Qty</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Price</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Medical Aid</th>
                                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Patient Portion</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100">
                                        {invoice.services.map((service) => (
                                          <tr key={service.id} className="text-sm">
                                            <td className="px-4 py-2 font-mono text-gray-900">{service.code}</td>
                                            <td className="px-4 py-2 text-gray-700">{service.description}</td>
                                            <td className="px-4 py-2 text-center text-gray-600">{service.quantity}</td>
                                            <td className="px-4 py-2 text-right text-gray-900">N$ {service.unit_price.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right font-medium text-gray-900">N$ {service.total_price.toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-sm text-green-600">N$ {(service.medical_aid_covered || 0).toFixed(2)}</td>
                                            <td className="px-4 py-2 text-right text-sm font-semibold text-gray-900">
                                              {service.patient_portion && service.patient_portion > 0 ? 
                                                `N$ ${service.patient_portion.toFixed(2)}` : 
                                                '-'
                                              }
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Print Statement Modal */}
      <PrintStatementModal 
        isOpen={showPrintStatementModal}
        onClose={() => setShowPrintStatementModal(false)}
        patientId={patientId}
        invoices={filteredInvoices}
      />
      
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-gray-900">Delete Invoice</h3>
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this invoice? This action cannot be undone.
                </p>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-gray-900">
                Invoice: #{invoices.find(inv => inv.id === showDeleteModal)?.invoice_number}
              </p>
              <p className="text-xs text-gray-600">
                Total: N$ {invoices.find(inv => inv.id === showDeleteModal)?.total.toFixed(2)}
              </p>
              <p className="text-xs text-gray-600">
                Services: {invoices.find(inv => inv.id === showDeleteModal)?.services.length || 0}
              </p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(null)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteInvoice(showDeleteModal)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete Invoice
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CleanInvoiceTable;