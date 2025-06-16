import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TestTube,
  ImageIcon,
  Upload,
  Plus,
  Receipt,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Clock,
  User,
  Shield,
  Building2,
  TrendingUp,
  ChevronRight,
  Code
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../stores/themeStore';
import DocumentList from '../documents/DocumentList';
import EnhancedDocumentUploadModal from '../modals/EnhancedDocumentUploadModal';
import FormModal from '../modals/FormModal';
import PremiumInvoiceModal from '../modals/PremiumInvoiceModal';
import { supabase } from '../../lib/supabase';

// Lab Results Content Component
export const LabResultsContent: React.FC = () => {
  const { currentTheme } = useTheme();
  
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Lab Results & Imaging</h3>
          <p className="text-gray-500 text-sm">Diagnostic test results and medical imaging</p>
        </div>
      </div>
      
      <div className="grid md:grid-cols-2 gap-6">
        <div className="text-center py-8 bg-purple-50 rounded-xl border border-purple-100">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-violet-600 rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center">
            <TestTube className="w-6 h-6 text-white" />
          </div>
          <h4 className="font-semibold text-gray-800 mb-1">Lab Results</h4>
          <p className="text-gray-500 text-sm">Blood work, urine tests, etc.</p>
        </div>
        
        <div className="text-center py-8 bg-indigo-50 rounded-xl border border-indigo-100">
          <div className={`p-3 bg-gradient-to-r ${currentTheme.gradients.button} rounded-full w-12 h-12 mx-auto mb-3 flex items-center justify-center`}>
            <ImageIcon className="w-6 h-6 text-white" />
          </div>
          <h4 className="font-semibold text-gray-800 mb-1">Medical Imaging</h4>
          <p className="text-gray-500 text-sm">X-rays, CT scans, MRIs</p>
        </div>
      </div>
    </div>
  );
};

// Documents Content Component
export const DocumentsContent: React.FC<{ patientId: string; visitId?: string; onCountChange?: () => void }> = ({ patientId, visitId, onCountChange }) => {
  const { currentTheme } = useTheme();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleUploadSuccess = () => {
    console.log('📊 Document upload successful - refreshing list');
    setRefreshTrigger(prev => prev + 1);
    if (onCountChange) {
      onCountChange();
    }
  };

  const handleFileSelect = (files: FileList) => {
    console.log('📂 Files selected via drop area:', files.length);
    setIsUploadModalOpen(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    console.log('🎯 Files dropped on main area');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelect(files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  return (
    <div 
      className="space-y-6 relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 border-2 border-dashed rounded-xl z-10 flex items-center justify-center"
             style={{ 
               backgroundColor: `${currentTheme.colors.primary.from}10`,
               borderColor: currentTheme.colors.primary.from
             }}>
          <div className="text-center">
            <div className="p-4 rounded-full mx-auto mb-4 w-16 h-16 flex items-center justify-center"
                 style={{ backgroundColor: `${currentTheme.colors.primary.from}20` }}>
              <Upload className="w-8 h-8" style={{ color: currentTheme.colors.primary.from }} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: currentTheme.colors.primary.from }}>Drop files here to upload</h3>
            <p className="text-sm text-gray-600">Release to start uploading documents</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>Clinical Documents</h3>
          <p className="text-gray-500 text-sm">Upload and manage patient documents, lab results, and clinical files</p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05, y: -2 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsUploadModalOpen(true)}
          className="px-6 py-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl flex items-center gap-3 shadow-xl hover:shadow-2xl hover:shadow-[#01b9d5]/40 transition-all duration-300 font-bold text-sm border border-white/20 backdrop-blur-sm"
        >
          <div className="p-1 bg-white/20 rounded-lg">
            <Plus className="w-4 h-4" />
          </div>
          <span>Upload Documents</span>
          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
        </motion.button>
      </div>

      {/* Quick Drop Area */}
      <motion.div
        className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#01b9d4]/50 hover:bg-[#01b9d4]/5 transition-all duration-200 cursor-pointer"
        onClick={() => setIsUploadModalOpen(true)}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="p-3 bg-gray-100 rounded-full">
            <Upload className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Drop files here or click to upload
            </h4>
            <p className="text-xs text-gray-500">
              PDF, Images, Word docs, Excel files • Max 50MB
            </p>
          </div>
        </div>
      </motion.div>
      
      {/* Document List Section */}
      <DocumentList 
        patientId={patientId}
        refreshTrigger={refreshTrigger}
      />
      
      {/* Document Upload Modal */}
      <EnhancedDocumentUploadModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        patientId={patientId}
        visitId={visitId}
        onUploadSuccess={handleUploadSuccess}
      />
    </div>
  );
};

// Billing Content Component - Enhanced with real service data
export const BillingContent: React.FC<{ 
  patientId?: string;
  patient?: any;
  medicalAid?: any;
}> = ({ patientId, patient, medicalAid }) => {
  const { currentTheme } = useTheme();
  const navigate = useNavigate();
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isPremiumInvoiceModalOpen, setIsPremiumInvoiceModalOpen] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [billingStats, setBillingStats] = useState<any>({
    totalServices: 0,
    totalAmount: 0,
    paidAmount: 0,
    outstandingAmount: 0,
    medicalAidAmount: 0,
    patientAmount: 0
  });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'paid' | 'pending' | 'overdue'>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');

  React.useEffect(() => {
    if (patientId) {
      fetchBillingData();
    }
  }, [patientId]);

  const fetchBillingData = async () => {
    try {
      setLoading(true);
      
      // Step 1: Get patient invoices (without join)
      const { data: invoices, error: invoiceError } = await supabase
        .from('invoices_enhanced')
        .select('id, invoice_number, visit_id, payment_status, payment_method, total, created_at')
        .eq('patient_id', patientId)
        .order('created_at', { ascending: false });

      if (invoiceError || !invoices || invoices.length === 0) {
        console.error('No invoices found:', invoiceError);
        setServices([]);
        setBillingStats({
          totalServices: 0,
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          medicalAidAmount: 0,
          patientAmount: 0
        });
        setLoading(false);
        return;
      }

      // Step 2: Get visit data for invoices that have visit_id
      const visitIds = invoices
        .filter(inv => inv.visit_id)
        .map(inv => inv.visit_id);
      
      let visitsData = [];
      if (visitIds.length > 0) {
        const { data: visits } = await supabase
          .from('visits')
          .select('id, visit_date, visit_time, chief_complaint')
          .in('id', visitIds);
        visitsData = visits || [];
      }

      // Step 3: Get services for those invoices
      const invoiceIds = invoices.map(inv => inv.id);
      const { data: servicesData, error: servicesError } = await supabase
        .from('invoice_services')
        .select('*')
        .in('invoice_id', invoiceIds)
        .order('created_at', { ascending: false });

      if (servicesError) {
        console.error('Error fetching services:', servicesError);
        setServices([]);
        setBillingStats({
          totalServices: 0,
          totalAmount: 0,
          paidAmount: 0,
          outstandingAmount: 0,
          medicalAidAmount: 0,
          patientAmount: 0
        });
        return;
      }

      // Step 4: Group services by invoice and create invoice objects
      const invoiceMap = new Map();
      
      // Initialize invoices with visit data
      invoices.forEach(invoice => {
        const visit = visitsData.find(v => v.id === invoice.visit_id);
        invoiceMap.set(invoice.id, {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          visit_id: invoice.visit_id,
          visit_date: visit?.visit_date,
          visit_time: visit?.visit_time,
          chief_complaint: visit?.chief_complaint,
          payment_status: invoice.payment_status || 'pending',
          payment_method: invoice.payment_method,
          total: invoice.total || 0,
          created_at: invoice.created_at,
          services: [],
          service_count: 0,
          medical_aid_covered: 0,
          patient_portion: 0
        });
      });

      // Add services to their respective invoices
      servicesData?.forEach(service => {
        const invoice = invoiceMap.get(service.invoice_id);
        if (invoice) {
          // CORRECT medical aid coverage logic: depends on if patient has medical aid
          let serviceMedicalAid = 0;
          let servicePatientPortion = service.total_price; // Default: patient pays everything
          
          // If medical aid values are explicitly set in database, use them
          if (service.medical_aid_covered !== null && service.medical_aid_covered !== undefined) {
            serviceMedicalAid = service.medical_aid_covered;
            servicePatientPortion = service.patient_portion || (service.total_price - serviceMedicalAid);
          } else if (medicalAid) {
            // If patient has medical aid but values not set, assume medical aid covers everything
            serviceMedicalAid = service.total_price;
            servicePatientPortion = 0;
          }
          // If no medical aid, patient pays everything (default values already set)
          
          invoice.services.push({
            ...service,
            medical_aid_covered: serviceMedicalAid,
            patient_portion: servicePatientPortion
          });
          invoice.service_count += 1;
          invoice.medical_aid_covered += serviceMedicalAid;
          invoice.patient_portion += servicePatientPortion;
        }
      });

      // Convert map to array for rendering
      const transformedInvoices = Array.from(invoiceMap.values());
      setServices(transformedInvoices);
      
      // Calculate stats based on invoices
      const totalAmount = transformedInvoices.reduce((sum, invoice) => sum + invoice.total, 0);
      const paidAmount = transformedInvoices
        .filter(invoice => invoice.payment_status === 'paid')
        .reduce((sum, invoice) => sum + invoice.total, 0);
      const medicalAidAmount = transformedInvoices.reduce((sum, invoice) => sum + invoice.medical_aid_covered, 0);
      const totalServices = servicesData?.length || 0;
      
      setBillingStats({
        totalServices,
        totalAmount,
        paidAmount,
        outstandingAmount: totalAmount - paidAmount,
        medicalAidAmount,
        patientAmount: totalAmount - medicalAidAmount
      });
    } catch (error) {
      console.error('Error fetching billing data:', error);
      // Set empty data on error
      setServices([]);
      setBillingStats({
        totalServices: 0,
        totalAmount: 0,
        paidAmount: 0,
        outstandingAmount: 0,
        medicalAidAmount: 0,
        patientAmount: 0
      });
    } finally {
      setLoading(false);
    }
  };

  // Filter invoices
  const filteredInvoices = services.filter(invoice => {
    if (filter === 'all') return true;
    return invoice.payment_status === filter;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderBottomColor: currentTheme.colors.primary.from }}></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800 mb-1" style={{ fontFamily: 'Poppins, sans-serif' }}>
            Billing & Financial History
          </h3>
          <p className="text-gray-500 text-sm">Complete transaction records and payment history</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-md p-1">
            <button
              onClick={() => setViewMode('cards')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewMode === 'cards' 
                  ? 'bg-white text-gray-900 shadow-sm font-medium' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Cards
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs rounded transition-colors ${
                viewMode === 'list' 
                  ? 'bg-white text-gray-900 shadow-sm font-medium' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              List
            </button>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchBillingData}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Clock className="w-5 h-5 text-gray-600" />
          </motion.button>
        </div>
      </div>
      
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#489bfd]/10 rounded-lg">
              <Receipt className="w-5 h-5 text-[#489bfd]" />
            </div>
            <span className="text-xs font-medium text-[#489bfd]">Total Billed</span>
          </div>
          <p className="text-4xl font-bold text-[#489bfd] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.totalAmount)}</span>
            <span className="text-3xl opacity-60">.{String(billingStats.totalAmount.toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>{services.length} services</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#30b4be]/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-[#30b4be]" />
            </div>
            <span className="text-xs font-medium text-[#30b4be]">Collected</span>
          </div>
          <p className="text-4xl font-bold text-[#30b4be] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.paidAmount)}</span>
            <span className="text-3xl opacity-60">.{String(billingStats.paidAmount.toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1" style={{ fontFamily: 'Rubik, sans-serif' }}>
            {((billingStats.paidAmount / billingStats.totalAmount) * 100 || 0).toFixed(0)}% collected
          </p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#e98320]/10 rounded-lg">
              <Clock className="w-5 h-5 text-[#e98320]" />
            </div>
            <span className="text-xs font-medium text-[#e98320]">Pending</span>
          </div>
          <p className="text-4xl font-bold text-[#e98320] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.outstandingAmount)}</span>
            <span className="text-3xl opacity-60">.{String(billingStats.outstandingAmount.toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">Awaiting payment</p>
        </motion.div>

        <motion.div
          whileHover={{ y: -4 }}
          className="bg-white rounded-2xl p-6 border-2 border-dotted border-gray-300"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="p-2 bg-[#ff4f5a]/10 rounded-lg">
              <AlertCircle className="w-5 h-5 text-[#ff4f5a]" />
            </div>
            <span className="text-xs font-medium text-[#ff4f5a]">Overdue</span>
          </div>
          <p className="text-4xl font-bold text-[#ff4f5a] text-left" style={{ fontFamily: 'Rubik, sans-serif' }}>
            <span>N$ {Math.floor(billingStats.outstandingAmount * 0.3)}</span>
            <span className="text-3xl opacity-60">.{String((billingStats.outstandingAmount * 0.3).toFixed(2)).split('.')[1]}</span>
          </p>
          <p className="text-xs text-gray-600 mt-1">Requires attention</p>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-lg">
        {(['all', 'paid', 'pending', 'overdue'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`flex-1 px-4 py-2 text-sm font-medium rounded-md transition-all ${
              filter === status
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
            {status === 'all' && <span style={{ fontFamily: 'Rubik, sans-serif' }}> ({services.length})</span>}
          </button>
        ))}
      </div>

      {/* Invoices Display */}
      {filteredInvoices.length === 0 ? (
        <div className="bg-gray-50 rounded-xl p-8 text-center">
          <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-600 font-medium">No {filter !== 'all' ? filter : ''} invoices found</p>
        </div>
      ) : viewMode === 'list' ? (
        /* List View */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Visit</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => {
                return invoice.services.map((service, index) => {
                  const status = service.payment_status || invoice.payment_status || 'pending';
                  const statusColors = {
                    paid: 'bg-green-100 text-green-700 border-green-200',
                    pending: 'bg-amber-100 text-amber-700 border-amber-200',
                    overdue: 'bg-red-100 text-red-700 border-red-200'
                  };

                  // Brand colors for table amounts based on status
                  const statusBrandColors = {
                    paid: '#30b4be', // collected color
                    pending: '#e98320', // pending color  
                    overdue: '#ff4f5a' // overdue color
                  };

                  return (
                    <tr key={`${invoice.id}-${service.id}`} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {service.code}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">
                        {service.description}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {invoice.visit_date ? (
                          <button
                            onClick={() => navigate(`/patients/${patientId}?visit=${invoice.visit_id}`)}
                            className="bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent font-medium hover:from-[#01a0c4] hover:to-purple-700 transition-all duration-200"
                          >
                            {format(parseISO(invoice.visit_date), 'MMM dd')}
                          </button>
                        ) : (
                          <span className="text-gray-500">N/A</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        {service.quantity}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold" style={{ fontFamily: 'Rubik, sans-serif', color: statusBrandColors[status] }}>
                        <span>N$ {Math.floor(service.total_price)}</span>
                        <span className="opacity-60">.{String(service.total_price.toFixed(2)).split('.')[1]}</span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusColors[status]}`}>
                          {status.charAt(0).toUpperCase() + status.slice(1)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <button
                          onClick={() => {
                            setSelectedService({ ...service, invoice_number: invoice.invoice_number, visit_date: invoice.visit_date, visit_time: invoice.visit_time, chief_complaint: invoice.chief_complaint });
                            setShowDetails(true);
                          }}
                          className="bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent font-medium hover:from-[#01a0c4] hover:to-purple-700 transition-all duration-200"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Premium Invoice Card View */
        <div className="space-y-6">
          {filteredInvoices.map((invoice) => {
            const status = invoice.payment_status || 'pending';
            const statusColors = {
              paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              pending: 'bg-amber-50 text-amber-800 border-amber-200',
              overdue: 'bg-red-50 text-red-800 border-red-200'
            };

            const statusIcons = {
              paid: <CheckCircle2 className="w-4 h-4" />,
              pending: <Clock className="w-4 h-4" />,
              overdue: <AlertCircle className="w-4 h-4" />
            };

            return (
              <motion.div
                key={invoice.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -6, scale: 1.02 }}
                className="relative group cursor-pointer"
                onClick={() => {
                  setSelectedInvoice({
                    ...invoice,
                    patient_name: patient ? `${patient.first_name} ${patient.last_name}` : 'N/A',
                    patient_phone: patient?.cell_number || 'N/A',
                    patient_email: patient?.email || 'N/A',
                    medical_aid_provider: medicalAid?.provider || null,
                    chief_complaint: invoice.chief_complaint,
                    payment_status: invoice.payment_status || 'pending'
                  });
                  setIsInvoiceModalOpen(true);
                }}
              >
                {/* Premium animated gradient border wrapper */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d4]/20 via-purple-600/15 to-[#01b9d4]/20 rounded-2xl transform group-hover:scale-105 transition-all duration-500 blur-sm"></div>
                <div className="absolute inset-0 bg-gradient-to-br from-[#01b9d4]/10 to-purple-600/10 rounded-2xl group-hover:from-[#01b9d4]/20 group-hover:to-purple-600/20 transition-all duration-300"></div>
                
                {/* Main invoice card with patient theme styling */}
                <div className="relative bg-white/95 backdrop-blur-md border-2 border-[#01b9d4]/20 rounded-2xl p-6 shadow-xl group-hover:shadow-2xl group-hover:border-[#01b9d4]/40 transition-all duration-300">
                  {/* Header with premium invoice info */}
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        {/* Premium icon with glow effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d4] to-purple-600 rounded-xl blur-lg opacity-40 group-hover:opacity-60 transition-all duration-300"></div>
                        <div className="relative p-4 bg-gradient-to-br from-[#01b9d4] via-[#01b9d4]/90 to-purple-600 rounded-xl shadow-xl group-hover:shadow-2xl transform group-hover:scale-110 transition-all duration-300">
                          <Receipt className="w-6 h-6 text-white drop-shadow-lg" />
                        </div>
                        {/* Sparkle effect */}
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full opacity-80 group-hover:scale-125 transition-transform duration-300"></div>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent" style={{ fontFamily: 'Poppins, sans-serif' }}>
                          Invoice #{invoice.invoice_number}
                        </h3>
                        <p className="text-sm mt-2 flex items-center gap-2">
                          {invoice.visit_date ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/patients/${patientId}?visit=${invoice.visit_id}`);
                              }}
                              className="px-3 py-1.5 bg-gradient-to-r from-[#01b9d4]/20 to-purple-600/20 text-[#01b9d4] font-semibold rounded-lg border border-[#01b9d4]/30 hover:from-[#01b9d4]/30 hover:to-purple-600/30 hover:scale-105 transition-all duration-200"
                            >
                              Visit: {format(parseISO(invoice.visit_date), 'MMM dd, yyyy')}
                            </button>
                          ) : (
                            <span className="text-gray-500 italic">Visit date not available</span>
                          )}
                        </p>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <motion.div 
                        whileHover={{ scale: 1.05 }}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border-2 shadow-lg backdrop-blur-sm ${statusColors[status]}`}>
                        {statusIcons[status]}
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </motion.div>
                      <motion.p 
                        whileHover={{ scale: 1.05 }}
                        className="text-4xl font-black bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mt-3 drop-shadow-sm" 
                        style={{ fontFamily: 'Rubik, sans-serif' }}
                      >
                        <span>N$ {Math.floor(invoice.total)}</span>
                        <span className="text-3xl opacity-70">.{String(invoice.total.toFixed(2)).split('.')[1]}</span>
                      </motion.p>
                    </div>
                  </div>

                  {/* Services summary with premium patient theme styling */}
                  <div className="bg-gradient-to-br from-[#01b9d4]/5 via-purple-600/5 to-[#01b9d4]/10 border border-[#01b9d4]/20 rounded-xl p-5 mb-4 backdrop-blur-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="font-bold text-gray-800 flex items-center gap-2">
                        <div className="w-2 h-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 rounded-full"></div>
                        Services Included
                      </h4>
                      <motion.span 
                        whileHover={{ scale: 1.1 }}
                        className="text-sm font-bold bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white px-3 py-1.5 rounded-full shadow-lg" 
                        style={{ fontFamily: 'Rubik, sans-serif' }}
                      >
                        {invoice.service_count} item{invoice.service_count !== 1 ? 's' : ''}
                      </motion.span>
                    </div>
                    
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {invoice.services.map((service, index) => (
                        <div key={service.id} className="flex items-center justify-between py-1">
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                              {service.code}
                            </span>
                            <span className="text-sm text-gray-600 ml-2">
                              {service.description}
                            </span>
                          </div>
                          <div className="text-right ml-4">
                            <span className="text-sm font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                              {service.quantity} × N$ {Math.floor(service.unit_price)}<span className="opacity-60">.{String(service.unit_price.toFixed(2)).split('.')[1]}</span>
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Premium financial breakdown */}
                  <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gradient-to-r from-[#01b9d4]/20 to-purple-600/20">
                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-3 bg-emerald-50 rounded-lg border border-emerald-200">
                      <p className="text-xs text-emerald-600 uppercase tracking-wider font-semibold mb-1">Medical Aid</p>
                      <p className="text-xl font-black text-emerald-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <span>N$ {Math.floor(invoice.medical_aid_covered)}</span>
                        <span className="text-lg opacity-70">.{String(invoice.medical_aid_covered.toFixed(2)).split('.')[1]}</span>
                      </p>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-3 bg-gradient-to-br from-[#01b9d4]/10 to-purple-600/10 rounded-lg border border-[#01b9d4]/30">
                      <p className="text-xs text-[#01b9d4] uppercase tracking-wider font-semibold mb-1">Patient Portion</p>
                      <p className="text-xl font-black bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        <span>N$ {Math.floor(invoice.patient_portion)}</span>
                        <span className="text-lg opacity-70">.{String(invoice.patient_portion.toFixed(2)).split('.')[1]}</span>
                      </p>
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.05 }} className="text-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600 uppercase tracking-wider font-semibold mb-1">Payment Method</p>
                      <p className="text-sm font-bold text-gray-700 capitalize">
                        {invoice.payment_method || 'Not specified'}
                      </p>
                    </motion.div>
                  </div>

                  {/* Premium hover effect indicator */}
                  <motion.div 
                    initial={{ opacity: 0, x: 10 }}
                    whileHover={{ opacity: 1, x: 0 }}
                    className="absolute bottom-4 right-4 transition-all duration-300"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white text-xs font-semibold rounded-full shadow-lg">
                      <span>Print/Email/SMS</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Service Details Modal using FormModal pattern */}
      <ServiceDetailsModal
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        service={selectedService}
      />
    </div>
  );
};

// Service Details Modal Component using FormModal pattern
const ServiceDetailsModal: React.FC<{ 
  isOpen: boolean; 
  onClose: () => void; 
  service: any; 
}> = ({ isOpen, onClose, service }) => {
  if (!service) return null;

  return (
    <FormModal
      isOpen={isOpen}
      onClose={onClose}
      title="Service Details"
    >
      <div className="space-y-6">
        {/* Service Information */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Service Details</h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service Code:</span>
              <span className="font-medium" style={{ fontFamily: 'Rubik, sans-serif' }}>{service.code}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Description:</span>
              <span className="font-medium">{service.description}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Visit Date:</span>
              <span className="font-medium">
                {service.visit_date ? format(parseISO(service.visit_date), 'MMMM dd, yyyy') : 'Not available'}
              </span>
            </div>
            {service.visit_time && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Visit Time:</span>
                <span className="font-medium">{service.visit_time}</span>
              </div>
            )}
            {service.chief_complaint && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Chief Complaint:</span>
                <span className="font-medium">{service.chief_complaint}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pricing Breakdown */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Pricing Details</h4>
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Code className="w-4 h-4 text-gray-400" />
                  <span className="text-sm font-medium text-gray-700" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    {service.code}
                  </span>
                </div>
                <p className="text-sm text-gray-900">{service.description}</p>
              </div>
              <div className="text-right ml-4">
                <p className="text-sm text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  {service.quantity} × N$ {service.unit_price?.toFixed(2)}
                </p>
                <p className="text-lg font-semibold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {service.total_price?.toFixed(2)}
                </p>
                {service.medical_aid_covered > 0 && (
                  <p className="text-xs text-green-600">
                    Medical Aid: N$ {service.medical_aid_covered.toFixed(2)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="border-t pt-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Service Total:</span>
              <span style={{ fontFamily: 'Rubik, sans-serif' }}>N$ {service.total_price?.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Medical Aid Covered:</span>
              <span className="text-green-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                N$ {(service.medical_aid_covered || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2">
              <span className="text-gray-600">Patient Portion:</span>
              <span className="font-medium text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                N$ {(service.patient_portion || service.total_price)?.toFixed(2)}
              </span>
            </div>
            {service.medical_aid_covered >= service.total_price && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-2 mt-2">
                <p className="text-xs text-green-700 font-medium">
                  ✓ Fully covered by Medical Aid
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Payment Status */}
        <div>
          <h4 className="font-semibold text-gray-900 mb-3">Payment Status</h4>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Status:</span>
              <span className={`font-medium ${
                service.payment_status === 'paid' ? 'text-green-600' :
                service.payment_status === 'pending' ? 'text-amber-600' :
                'text-red-600'
              }`}>
                {service.payment_status ? service.payment_status.toUpperCase() : 'PENDING'}
              </span>
            </div>
            {service.payment_method && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Payment Method:</span>
                <span className="font-medium">{service.payment_method}</span>
              </div>
            )}
            {service.invoice_number && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Invoice Number:</span>
                <span className="font-mono font-medium">#{service.invoice_number}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </FormModal>
  );
};