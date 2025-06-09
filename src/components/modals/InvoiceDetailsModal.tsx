import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, 
  Printer, 
  Download, 
  Calendar, 
  User, 
  Phone, 
  Mail, 
  CreditCard,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle
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

  const handlePrint = () => {
    setShowPrintPreview(true);
    // Small delay to ensure the print content is rendered
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const handleDownloadPDF = () => {
    // This would integrate with a PDF generation service
    console.log('Download PDF functionality would be implemented here');
  };

  const PrintableInvoice = () => (
    <div className="print-content" style={{ display: showPrintPreview ? 'block' : 'none' }}>
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
            padding: 20px !important;
            background: white !important;
          }
          .no-print { display: none !important; }
        }
      `}</style>
      
      {/* Clean Print Layout */}
      <div className="bg-white p-8 max-w-none mx-auto"
           style={{ fontFamily: 'system-ui, -apple-system, sans-serif', lineHeight: '1.4' }}>
        {/* Clean Header */}
        <div style={{ marginBottom: '40px', borderBottom: '2px solid #000', paddingBottom: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 8px 0', color: '#000' }}>
                HPMS
              </h1>
              <p style={{ margin: '0', fontSize: '14px', color: '#666' }}>Healthcare Practice Management</p>
              <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>Windhoek, Namibia</p>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <h2 style={{ fontSize: '28px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#000' }}>INVOICE</h2>
              <div style={{ fontSize: '14px', color: '#333' }}>
                <p style={{ margin: '0 0 4px 0' }}><strong>Invoice #:</strong> {invoice.invoice_number}</p>
                <p style={{ margin: '0 0 4px 0' }}><strong>Date:</strong> {invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'N/A'}</p>
                <p style={{ margin: '0' }}><strong>Status:</strong> {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Patient Information */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '40px', marginBottom: '40px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#000' }}>
              Patient Information
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>Name:</strong> {invoice.patient_name || 'N/A'}</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Phone:</strong> {invoice.patient_phone || 'N/A'}</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Email:</strong> {invoice.patient_email || 'N/A'}</p>
              {invoice.medical_aid_provider && (
                <p style={{ margin: '0 0 8px 0' }}><strong>Medical Aid:</strong> {invoice.medical_aid_provider}</p>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 16px 0', color: '#000' }}>
              Visit Information
            </h3>
            <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
              <p style={{ margin: '0 0 8px 0' }}><strong>Date:</strong> {invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'N/A'}</p>
              <p style={{ margin: '0 0 8px 0' }}><strong>Time:</strong> {invoice.visit_time || 'N/A'}</p>
              {invoice.chief_complaint && (
                <p style={{ margin: '0 0 8px 0' }}><strong>Chief Complaint:</strong> {invoice.chief_complaint}</p>
              )}
              {invoice.payment_method && (
                <p style={{ margin: '0' }}><strong>Payment Method:</strong> {invoice.payment_method}</p>
              )}
            </div>
          </div>
        </div>

        {/* Services Table */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: 'bold', margin: '0 0 20px 0', color: '#000' }}>
            Services Provided
          </h3>
          
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #000' }}>
                <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 'bold' }}>Code</th>
                <th style={{ textAlign: 'left', padding: '12px 8px', fontWeight: 'bold' }}>Description</th>
                <th style={{ textAlign: 'center', padding: '12px 8px', fontWeight: 'bold' }}>Qty</th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 'bold' }}>Unit Price</th>
                <th style={{ textAlign: 'right', padding: '12px 8px', fontWeight: 'bold' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.services.map((service, index) => (
                <tr key={service.id} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: 'bold' }}>{service.code}</td>
                  <td style={{ padding: '12px 8px' }}>{service.description}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'center' }}>{service.quantity}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>N$ {service.unit_price.toFixed(2)}</td>
                  <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold' }}>N$ {service.total_price.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Payment Summary */}
        <div style={{ marginTop: '40px', borderTop: '2px solid #000', paddingTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <div style={{ width: '300px' }}>
              <div style={{ fontSize: '14px', lineHeight: '1.6' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span>Subtotal:</span>
                  <span>N$ {invoice.total.toFixed(2)}</span>
                </div>
                
                {invoice.medical_aid_covered > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span>Medical Aid Covered:</span>
                    <span>N$ {invoice.medical_aid_covered.toFixed(2)}</span>
                  </div>
                )}
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px', paddingBottom: '8px', borderBottom: '1px solid #ddd' }}>
                  <span>Patient Portion:</span>
                  <span>N$ {invoice.patient_portion.toFixed(2)}</span>
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 'bold' }}>
                  <span>Total Amount:</span>
                  <span>N$ {invoice.total.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
          
          <div style={{ marginTop: '40px', fontSize: '12px', color: '#666', textAlign: 'center' }}>
            <p style={{ margin: '0' }}>Thank you for choosing HPMS Healthcare Services</p>
            <p style={{ margin: '8px 0 0 0' }}>For questions about this invoice, please contact us at your convenience.</p>
          </div>
        </div>
      </div>
    </div>
  );
            <h2 className="text-lg font-medium text-gray-900">Invoice #{invoice.invoice_number}</h2>
            <p className="text-sm text-gray-500 mt-1">
              {invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'No date available'}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
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
                        <span className="text-gray-900">{invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'N/A'}</span>
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
      </motion.div>
      <PrintableInvoice />
    </div>
  );
};

export default InvoiceDetailsModal;