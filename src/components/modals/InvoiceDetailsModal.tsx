import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Download, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  CreditCard,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface InvoiceService {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  medical_aid_covered?: number;
  patient_portion?: number;
}

interface InvoiceDetails {
  id: string;
  invoice_number: string;
  visit_date?: string;
  visit_time?: string;
  patient_name?: string;
  patient_phone?: string;
  patient_email?: string;
  medical_aid_provider?: string;
  payment_status: 'paid' | 'pending' | 'overdue';
  payment_method?: string;
  total: number;
  medical_aid_covered: number;
  patient_portion: number;
  services: InvoiceService[];
  chief_complaint?: string;
  created_at: string;
}

interface InvoiceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: InvoiceDetails | null;
}

const InvoiceDetailsModal: React.FC<InvoiceDetailsModalProps> = ({ 
  isOpen, 
  onClose, 
  invoice 
}) => {
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  if (!invoice) return null;

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


  const handleDownloadPDF = () => {
    // This would integrate with a PDF generation service
    console.log('Download PDF functionality would be implemented here');
  };

  const PrintableInvoice = () => (
    <div className="print-content" style={{ display: 'none' }}>
      <style>{`
        @media print {
          * { box-sizing: border-box; }
          body * { visibility: hidden; }
          .print-content, .print-content * { visibility: visible; }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 15px !important;
            background: white !important;
            display: block !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      
      {/* Compact Print Layout */}
      <div className="bg-white p-4 max-w-none mx-auto"
           style={{ fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.3' }}>
        {/* Compact Header */}
        <div style={{ marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            {/* No practice details are loaded here, so none are printed (this printed "HPMS, Windhoek"
                as if it were the practice's name and address) */}
            <div />
            
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#000' }}>INVOICE</h2>
              <div style={{ fontSize: '12px', color: '#333' }}>
                <p style={{ margin: '0 0 2px 0' }}><strong>Invoice #:</strong> {invoice.invoice_number}</p>
                <p style={{ margin: '0 0 2px 0' }}><strong>Date:</strong> {invoice.visit_date ? format(parseISO(invoice.visit_date), 'd MMMM yyyy') : 'N/A'}</p>
                <p style={{ margin: '0' }}><strong>Status:</strong> {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Patient Information */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#000' }}>
              Patient Information
            </h3>
            <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong>Name:</strong> {invoice.patient_name || 'N/A'}</p>
              <p style={{ margin: '0 0 4px 0' }}><strong>Phone:</strong> {invoice.patient_phone || 'N/A'}</p>
              <p style={{ margin: '0 0 4px 0' }}><strong>Email:</strong> {invoice.patient_email || 'N/A'}</p>
              {invoice.medical_aid_provider && (
                <p style={{ margin: '0' }}><strong>Medical Aid:</strong> {invoice.medical_aid_provider}</p>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#000' }}>
              Visit Information
            </h3>
            <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 4px 0' }}><strong>Date:</strong> {invoice.visit_date ? format(parseISO(invoice.visit_date), 'd MMMM yyyy') : 'N/A'}</p>
              <p style={{ margin: '0 0 4px 0' }}><strong>Time:</strong> {invoice.visit_time || 'N/A'}</p>
              {invoice.chief_complaint && (
                <p style={{ margin: '0 0 4px 0' }}><strong>Chief Complaint:</strong> {invoice.chief_complaint}</p>
              )}
              {invoice.payment_method && (
                <p style={{ margin: '0' }}><strong>Payment Method:</strong> {invoice.payment_method}</p>
              )}
            </div>
          </div>
        </div>

        {/* Services Table */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#000' }}>
            Services Provided
          </h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 'bold' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 'bold' }}>Description</th>
                <th style={{ textAlign: 'center', padding: '6px 4px', fontWeight: 'bold' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 'bold' }}>Unit Price</th>
                <th style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 'bold' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.services.map((service, index) => (
                <tr key={service.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '6px 4px', fontFamily: 'monospace', fontWeight: 'bold' }}>{service.code}</td>
                  <td style={{ padding: '6px 4px' }}>{service.description}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'center' }}>{service.quantity}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right' }}>N$ {service.unit_price.toFixed(2)}</td>
                  <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 'bold' }}>N$ {service.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Summary */}
        <div style={{ marginTop: '20px', borderTop: '2px solid #000', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '250px' }}>
              <div style={{ fontSize: '12px', lineHeight: '1.4' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Subtotal:</span>
                  <span>N$ {invoice.total.toFixed(2)}</span>
                </div>
                
                {invoice.medical_aid_covered > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span>Medical Aid Covered:</span>
                    <span>N$ {invoice.medical_aid_covered.toFixed(2)}</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingBottom: '4px', borderBottom: '1px solid #ddd' }}>
                  <span>Patient Portion:</span>
                  <span>N$ {invoice.patient_portion.toFixed(2)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                  <span>Total Amount:</span>
                  <span>N$ {invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Payment reference. The practice's bank account isn't stored in HPMS, so no bank details are
              printed (this used to print a made-up account number that patients could have paid into). */}
          <div style={{ marginTop: '20px', padding: '12px', backgroundColor: '#f8f9fa', border: '1px solid #ddd' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#000' }}>Payment</h4>
            <div style={{ fontSize: '11px', lineHeight: '1.4' }}>
              <p style={{ margin: '0 0 3px 0' }}><strong>Reference:</strong> Invoice #{invoice.invoice_number}</p>
              <p style={{ margin: '0' }}>Please contact the practice for payment details.</p>
            </div>
          </div>
          
          {/* Signature Section */}
          <div style={{ marginTop: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px' }}>
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 20px 0', color: '#000' }}>Patient Signature</h4>
              <div style={{ borderBottom: '1px solid #000', height: '40px', marginBottom: '8px' }}></div>
              <div style={{ fontSize: '10px', textAlign: 'center' }}>
                <p style={{ margin: '0' }}>Signature</p>
                <p style={{ margin: '4px 0 0 0' }}>Date: _____________</p>
              </div>
            </div>
            
            <div>
              <h4 style={{ fontSize: '12px', fontWeight: 'bold', margin: '0 0 20px 0', color: '#000' }}>Doctor Signature</h4>
              <div style={{ borderBottom: '1px solid #000', height: '40px', marginBottom: '8px' }}></div>
              <div style={{ fontSize: '10px', textAlign: 'center' }}>
                <p style={{ margin: '0' }}>Name: _____________</p>
                <p style={{ margin: '4px 0 0 0' }}>Date: _____________</p>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '20px', fontSize: '11px', color: '#666', textAlign: 'center' }}>
            <p style={{ margin: '0' }}>Thank you for your visit.</p>
            <p style={{ margin: '4px 0 0 0' }}>For questions about this invoice, please contact us at your convenience.</p>
          </div>
        </div>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return createPortal(
    // Bottom sheet on phones (up to the full height), centred dialog from sm: the header stays put and
    // only the invoice body scrolls
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 z-[9999]" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        role="dialog"
        aria-modal="true"
        className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[100dvh] sm:max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Header */}
        <div className="flex-none flex items-center justify-between gap-3 p-4 sm:p-6 border-b border-gray-100">
          <div className="min-w-0">
            <h2 className="text-lg font-medium text-gray-900">Invoice #{invoice.invoice_number}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {invoice.visit_date ? format(parseISO(invoice.visit_date), 'd MMMM yyyy') : 'No date available'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 p-4 sm:p-6 overflow-y-auto">
                {/* Patient & Visit Info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Patient Information</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{invoice.patient_name || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{invoice.patient_phone || 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{invoice.patient_email || 'N/A'}</span>
                      </div>
                      {invoice.medical_aid_provider && (
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-4 h-4 text-gray-400" />
                          <span className="text-gray-700">{invoice.medical_aid_provider}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider">Visit Details</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-900">{invoice.visit_date ? format(parseISO(invoice.visit_date), 'd MMMM yyyy') : 'N/A'}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-700">{invoice.visit_time || 'N/A'}</span>
                      </div>
                      {invoice.chief_complaint && (
                        <div className="flex items-start gap-3">
                          <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                          <span className="text-gray-700">{invoice.chief_complaint}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[invoice.payment_status]}`}>
                          {statusIcons[invoice.payment_status]}
                          <span className="ml-1.5">{invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Services Section */}
                <div className="mb-8">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Services & Procedures</h3>
                  
                  {/* Clean Services Table */}
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                          <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Unit Price</th>
                          <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {invoice.services.map((service, index) => (
                          <tr key={service.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4">
                              <span className="text-sm font-mono text-gray-900 bg-gray-100 px-2 py-1 rounded">
                                {service.code}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-sm text-gray-900">{service.description}</span>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <span className="text-sm text-gray-700">{service.quantity}</span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-sm text-gray-700">N$ {service.unit_price.toFixed(2)}</span>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className="text-sm font-medium text-gray-900">N$ {service.total_price.toFixed(2)}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Payment Summary */}
                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-4">Payment Summary</h3>
                  
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal:</span>
                      <span className="text-gray-900">N$ {invoice.total.toFixed(2)}</span>
                    </div>
                    
                    {invoice.medical_aid_covered > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Medical Aid Covered:</span>
                        <span className="text-gray-900">N$ {invoice.medical_aid_covered.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Patient Portion:</span>
                      <span className="text-gray-900">N$ {invoice.patient_portion.toFixed(2)}</span>
                    </div>
                    
                    <div className="border-t border-gray-300 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-base font-medium text-gray-900">Total Amount:</span>
                        <span className="text-lg font-semibold text-gray-900">N$ {invoice.total.toFixed(2)}</span>
                      </div>
                    </div>
                    
                    <div className="border-t border-gray-300 pt-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Payment Status:</span>
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[invoice.payment_status]}`}>
                          {statusIcons[invoice.payment_status]}
                          <span className="ml-1.5">{invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}</span>
                        </span>
                      </div>
                      {invoice.payment_method && (
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-sm text-gray-600">Payment Method:</span>
                          <span className="text-sm text-gray-900">{invoice.payment_method}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
        </div>
      </motion.div>
      <PrintableInvoice />
    </div>,
    document.body
  );
};

export default InvoiceDetailsModal;