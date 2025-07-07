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
  Banknote,
  Building2,
  User,
  Stethoscope,
  Eye,
  Printer,
  Mail,
  Edit3,
  Sparkles,
  Crown,
  ShieldCheck
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';

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

interface PremiumInvoiceTableProps {
  patientId: string;
  onVisitClick?: (visitId: string) => void;
  onInvoiceView?: (invoice: Invoice) => void;
  onStatusChange?: (invoiceId: string, newStatus: 'paid' | 'pending' | 'overdue' | 'cancelled') => void;
  onEmailInvoice?: (invoice: Invoice) => void;
  onPrintInvoice?: (invoice: Invoice) => void;
}

const PremiumInvoiceTable: React.FC<PremiumInvoiceTableProps> = ({
  patientId,
  onVisitClick,
  onInvoiceView,
  onStatusChange,
  onEmailInvoice,
  onPrintInvoice
}) => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [sortBy, setSortBy] = useState<'date' | 'amount' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [editingStatus, setEditingStatus] = useState<string | null>(null);
  const [statusDropdown, setStatusDropdown] = useState<string | null>(null);

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

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      
      // ⏱️ TIMING: Optimized billing query
      const billingStartTime = performance.now();
      
      // Step 1: Get invoices with visit information in parallel
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

      // Step 2: Get services for all invoices in one query
      const invoiceIds = invoicesResult.data.map(inv => inv.id);
      const { data: servicesData } = await supabase
        .from('invoice_services')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: true });

      // Step 3: Process and combine data
      const visitMap = new Map(visitsResult.data?.map(v => [v.id, v]) || []);
      const servicesByInvoice = new Map<string, Service[]>();
      
      // Group services by invoice
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
          patient_portion: service.patient_portion || service.total_price
        });
      });

      // Combine into final invoice objects
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
      console.log(`⏱️ Enhanced billing query: ${(billingEndTime - billingStartTime).toFixed(2)}ms for ${processedInvoices.length} invoices`);

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
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          dot: 'bg-emerald-500'
        };
      case 'pending':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          dot: 'bg-amber-500'
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

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 rounded-xl"></div>
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

  if (filteredInvoices.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
        <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-700 mb-2">No invoices found</h3>
        <p className="text-gray-500">
          {filter !== 'all' ? `No ${filter} invoices found for this patient.` : 'This patient has no billing history yet.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Invoice History
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {filteredInvoices.length} invoice{filteredInvoices.length !== 1 ? 's' : ''} • 
            Total: N$ {filteredInvoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}
          </p>
        </div>

        {/* Filters and Sort */}
        <div className="flex items-center gap-3">
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

      {/* Premium Invoice Table */}
      <div className="bg-gradient-to-br from-white via-blue-50/30 to-purple-50/30 rounded-2xl border-2 border-blue-200 overflow-hidden shadow-xl backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gradient-to-r from-slate-50 via-blue-50 to-purple-50 border-b-2 border-blue-200">
              <tr>
                <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-blue-600" />
                    Invoice
                  </div>
                </th>
                <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-600" />
                    Visit Details
                  </div>
                </th>
                <th className="px-6 py-5 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    Services
                  </div>
                </th>
                <th className="px-6 py-5 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-end gap-2">
                    <DollarSign className="w-4 h-4 text-emerald-600" />
                    Amount
                  </div>
                </th>
                <th className="px-6 py-5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-orange-600" />
                    Status
                  </div>
                </th>
                <th className="px-6 py-5 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">
                  <div className="flex items-center justify-center gap-2">
                    <Activity className="w-4 h-4 text-indigo-600" />
                    Actions
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="bg-gradient-to-br from-white via-slate-50/30 to-blue-50/20 divide-y-2 divide-slate-100">
              {filteredInvoices.map((invoice) => {
                const isExpanded = expandedInvoices.has(invoice.id);
                const statusColors = getStatusColor(invoice.payment_status);

                return (
                  <React.Fragment key={invoice.id}>
                    {/* Main Invoice Row */}
                    <motion.tr
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="group hover:bg-gradient-to-r hover:from-blue-50/70 hover:via-purple-50/50 hover:to-cyan-50/70 transition-all duration-300 cursor-pointer border-l-4 border-transparent hover:border-l-blue-400"
                      onClick={() => toggleExpanded(invoice.id)}
                    >
                      {/* Invoice Info */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            className="relative"
                          >
                            <div className="p-3 bg-gradient-to-br from-emerald-400 via-blue-500 to-purple-600 rounded-xl shadow-lg border border-white/20">
                              <div className="relative">
                                <Receipt className="w-6 h-6 text-white drop-shadow-sm" />
                                <Crown className="w-3 h-3 text-yellow-300 absolute -top-1 -right-1" />
                              </div>
                            </div>
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
                              <Sparkles className="w-2 h-2 text-white" />
                            </div>
                          </motion.div>
                          <div>
                            <p className="font-semibold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
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
                          <motion.button
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onVisitClick?.(invoice.visit_id);
                            }}
                            className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-50 via-blue-50 to-indigo-50 border-2 border-cyan-200 rounded-xl hover:from-cyan-100 hover:via-blue-100 hover:to-indigo-100 hover:border-cyan-300 transition-all duration-300 shadow-sm hover:shadow-md"
                          >
                            <div className="p-1 bg-gradient-to-r from-cyan-500 to-blue-600 rounded-lg">
                              <Calendar className="w-3 h-3 text-white" />
                            </div>
                            <div className="text-left">
                              <p className="text-sm font-bold text-cyan-700">
                                Visit #{invoice.visit_number || 'N/A'}
                              </p>
                              <p className="text-xs font-medium text-blue-600">
                                {format(parseISO(invoice.visit_date), 'MMM dd, yyyy')}
                              </p>
                            </div>
                            <ExternalLink className="w-3 h-3 text-cyan-500" />
                          </motion.button>
                        ) : (
                          <div className="text-gray-400 text-sm">No visit linked</div>
                        )}
                      </td>

                      {/* Services Summary */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            <motion.div
                              animate={{ rotate: isExpanded ? 90 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ChevronRight className="w-4 h-4 text-gray-400" />
                            </motion.div>
                            <span className="text-sm font-medium text-gray-700">
                              {invoice.services.length} service{invoice.services.length !== 1 ? 's' : ''}
                            </span>
                          </div>
                          <motion.div
                            whileHover={{ scale: 1.1 }}
                            className="px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full"
                          >
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </motion.div>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-6 py-4">
                        <div className="text-right space-y-1">
                          <p className="text-xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'Rubik, sans-serif' }}>
                            N$ {invoice.total.toFixed(2)}
                          </p>
                          {invoice.medical_aid_covered > 0 && (
                            <div className="flex items-center justify-end gap-1">
                              <Building2 className="w-3 h-3 text-emerald-500" />
                              <p className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                                Aid: N$ {invoice.medical_aid_covered.toFixed(2)}
                              </p>
                            </div>
                          )}
                          {invoice.patient_portion > 0 && (
                            <div className="flex items-center justify-end gap-1">
                              <User className="w-3 h-3 text-blue-500" />
                              <p className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-1 rounded-full">
                                Patient: N$ {invoice.patient_portion.toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 text-center">
                        <motion.div
                          whileHover={{ scale: 1.05, y: -2 }}
                          className={`inline-flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${statusColors.bg} ${statusColors.text} ${statusColors.border} shadow-sm hover:shadow-md transition-all duration-200`}
                        >
                          <div className={`w-3 h-3 rounded-full ${statusColors.dot} animate-pulse`}></div>
                          <div className="p-1 bg-white/50 rounded-lg">
                            {getStatusIcon(invoice.payment_status)}
                          </div>
                          <span className="text-sm font-bold tracking-wide">
                            {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                          </span>
                        </motion.div>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <motion.button
                            whileHover={{ scale: 1.15, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onInvoiceView?.(invoice);
                            }}
                            className="p-2.5 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl hover:from-blue-600 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl group"
                            title="View Invoice Details"
                          >
                            <Eye className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.15, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEmailInvoice?.(invoice);
                            }}
                            className="p-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 text-white rounded-xl hover:from-emerald-600 hover:to-teal-700 transition-all duration-200 shadow-lg hover:shadow-xl group"
                            title="Email Invoice"
                          >
                            <Mail className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.15, y: -2 }}
                            whileTap={{ scale: 0.9 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onPrintInvoice?.(invoice);
                            }}
                            className="p-2.5 bg-gradient-to-r from-gray-500 to-slate-600 text-white rounded-xl hover:from-gray-600 hover:to-slate-700 transition-all duration-200 shadow-lg hover:shadow-xl group"
                            title="Print Invoice"
                          >
                            <Printer className="w-4 h-4 group-hover:scale-110 transition-transform" />
                          </motion.button>
                          <div className="relative">
                            <motion.button
                              whileHover={{ scale: 1.15, y: -2 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setStatusDropdown(statusDropdown === invoice.id ? null : invoice.id);
                              }}
                              className="p-2.5 bg-gradient-to-r from-orange-500 to-red-600 text-white rounded-xl hover:from-orange-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl group"
                              title="Edit Status"
                            >
                              <Edit3 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                            </motion.button>
                            
                            {/* Status Dropdown */}
                            <AnimatePresence>
                              {statusDropdown === invoice.id && (
                                <motion.div
                                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                  animate={{ opacity: 1, y: 0, scale: 1 }}
                                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                  className="status-dropdown absolute top-full right-0 mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl z-50 min-w-[160px] overflow-hidden"
                                >
                                  {(['paid', 'pending', 'overdue', 'cancelled'] as const).map((status) => {
                                    const statusConfig = getStatusColor(status);
                                    return (
                                      <motion.button
                                        key={status}
                                        whileHover={{ backgroundColor: '#f8fafc' }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          onStatusChange?.(invoice.id, status);
                                          setStatusDropdown(null);
                                        }}
                                        className={`w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-slate-50 transition-colors ${
                                          invoice.payment_status === status ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                                        }`}
                                      >
                                        <div className={`w-3 h-3 rounded-full ${statusConfig.dot}`}></div>
                                        <div className="p-1 rounded-lg">
                                          {getStatusIcon(status)}
                                        </div>
                                        <span className="text-sm font-semibold text-gray-700 capitalize">
                                          {status}
                                        </span>
                                      </motion.button>
                                    );
                                  })}
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </div>
                      </td>
                    </motion.tr>

                    {/* Expanded Services Row */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.tr
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.3, ease: 'easeInOut' }}
                        >
                          <td colSpan={6} className="px-6 py-0">
                            <motion.div
                              initial={{ y: -20, opacity: 0 }}
                              animate={{ y: 0, opacity: 1 }}
                              exit={{ y: -20, opacity: 0 }}
                              className="bg-gradient-to-br from-cyan-50/80 via-blue-50/60 to-purple-50/80 border-2 border-cyan-200 rounded-2xl p-8 mb-6 shadow-inner backdrop-blur-sm"
                            >
                              <div className="flex items-center justify-between mb-6">
                                <h4 className="text-xl font-bold text-slate-800 flex items-center gap-3">
                                  <div className="p-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl">
                                    <FileText className="w-6 h-6 text-white" />
                                  </div>
                                  Service Breakdown
                                </h4>
                                {invoice.chief_complaint && (
                                  <div className="flex items-center gap-3 px-4 py-2 bg-gradient-to-r from-white to-slate-50 border-2 border-slate-200 rounded-xl shadow-sm">
                                    <div className="p-1 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg">
                                      <Stethoscope className="w-4 h-4 text-white" />
                                    </div>
                                    <span className="text-sm font-semibold text-slate-700">{invoice.chief_complaint}</span>
                                  </div>
                                )}
                              </div>

                              {/* Services Table */}
                              <div className="bg-gradient-to-br from-white via-slate-50/50 to-blue-50/30 rounded-2xl border-2 border-slate-200 overflow-hidden shadow-lg">
                                <table className="w-full">
                                  <thead className="bg-gradient-to-r from-slate-100 via-blue-100/50 to-purple-100/50">
                                    <tr>
                                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        <div className="flex items-center gap-2">
                                          <Hash className="w-3 h-3 text-blue-600" />
                                          Code
                                        </div>
                                      </th>
                                      <th className="px-5 py-4 text-left text-xs font-bold text-slate-700 uppercase tracking-wider">Description</th>
                                      <th className="px-5 py-4 text-center text-xs font-bold text-slate-700 uppercase tracking-wider">Qty</th>
                                      <th className="px-5 py-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">Unit Price</th>
                                      <th className="px-5 py-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        <div className="flex items-center justify-end gap-2">
                                          <Building2 className="w-3 h-3 text-emerald-600" />
                                          Medical Aid
                                        </div>
                                      </th>
                                      <th className="px-5 py-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        <div className="flex items-center justify-end gap-2">
                                          <User className="w-3 h-3 text-blue-600" />
                                          Patient Portion
                                        </div>
                                      </th>
                                      <th className="px-5 py-4 text-right text-xs font-bold text-slate-700 uppercase tracking-wider">
                                        <div className="flex items-center justify-end gap-2">
                                          <DollarSign className="w-3 h-3 text-purple-600" />
                                          Total
                                        </div>
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y-2 divide-slate-100">
                                    {invoice.services.map((service, index) => (
                                      <motion.tr
                                        key={service.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.1 }}
                                        className="hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/30 transition-all duration-200"
                                      >
                                        <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                                          {service.code}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-gray-700">
                                          {service.description}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-center text-gray-600">
                                          {service.quantity}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                          N$ {service.unit_price.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-emerald-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                          N$ {service.medical_aid_covered.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-medium text-blue-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                          N$ {service.patient_portion.toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-sm text-right font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                          N$ {service.total_price.toFixed(2)}
                                        </td>
                                      </motion.tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-gradient-to-r from-slate-100 to-blue-100 border-t-2 border-slate-200">
                                    <tr>
                                      <td colSpan={4} className="px-5 py-4 text-sm font-bold text-slate-800 text-right tracking-wide">
                                        Invoice Total:
                                      </td>
                                      <td className="px-5 py-4 text-lg font-black text-emerald-700 text-right" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                        N$ {invoice.medical_aid_covered.toFixed(2)}
                                      </td>
                                      <td className="px-5 py-4 text-lg font-black text-blue-700 text-right" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                        N$ {invoice.patient_portion.toFixed(2)}
                                      </td>
                                      <td className="px-5 py-4 text-xl font-black text-slate-900 text-right tracking-tight" style={{ fontFamily: 'Rubik, sans-serif' }}>
                                        N$ {invoice.total.toFixed(2)}
                                      </td>
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>

                              {/* Payment Details */}
                              {invoice.payment_method && (
                                <div className="mt-4 flex items-center justify-between p-4 bg-white border border-gray-200 rounded-lg">
                                  <div className="flex items-center gap-2">
                                    <CreditCard className="w-5 h-5 text-gray-500" />
                                    <span className="text-sm font-medium text-gray-700">Payment Method:</span>
                                    <span className="text-sm text-gray-900 capitalize">{invoice.payment_method}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Hash className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm text-gray-500">Reference: {invoice.invoice_number}</span>
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          </td>
                        </motion.tr>
                      )}
                    </AnimatePresence>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PremiumInvoiceTable;