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
      <style jsx>{`
        @media print {
          .print-content {
            display: block !important;
          }
          .no-print {
            display: none !important;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
        }
      `}</style>
      
      {/* Modern Invoice Design */}
      <div className="bg-white p-8 max-w-4xl mx-auto shadow-2xl">
        {/* Header with Logo and Company Info */}
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <Receipt className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                HPMS
              </h1>
              <p className="text-gray-600">Healthcare Practice Management</p>
              <p className="text-sm text-gray-500">Windhoek, Namibia</p>
            </div>
          </div>
          
          <div className="text-right">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">INVOICE</h2>
            <div className="text-sm text-gray-600 space-y-1">
              <p><span className="font-medium">Invoice #:</span> {invoice.invoice_number}</p>
              <p><span className="font-medium">Date:</span> {invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'N/A'}</p>
              <p><span className="font-medium">Status:</span> 
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${statusColors[invoice.payment_status]}`}>
                  {invoice.payment_status.charAt(0).toUpperCase() + invoice.payment_status.slice(1)}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Patient Information */}
        <div className="grid grid-cols-2 gap-8 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <div className="p-2 bg-gradient-to-r from-[#01b9d4] to-purple-600 rounded-lg">
                <User className="w-5 h-5 text-white" />
              </div>
              Patient Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-600">Name:</span> 
                <span className="font-semibold text-gray-900">{invoice.patient_name || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-600">Phone:</span> 
                <span className="font-semibold text-gray-900">{invoice.patient_phone || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-600">Email:</span> 
                <span className="font-semibold text-gray-900">{invoice.patient_email || 'N/A'}</span>
              </div>
              {invoice.medical_aid_provider && (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-600">Medical Aid:</span> 
                  <span className="font-semibold text-emerald-600">{invoice.medical_aid_provider}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-xl border border-amber-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-3" style={{ fontFamily: 'Poppins, sans-serif' }}>
              <div className="p-2 bg-gradient-to-r from-amber-500 to-orange-600 rounded-lg">
                <Calendar className="w-5 h-5 text-white" />
              </div>
              Visit Information
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-600">Date:</span> 
                <span className="font-semibold text-gray-900">{invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="font-medium text-gray-600">Time:</span> 
                <span className="font-semibold text-gray-900">{invoice.visit_time || 'N/A'}</span>
              </div>
              {invoice.chief_complaint && (
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-600">Chief Complaint:</span> 
                    <p className="font-semibold text-gray-900 mt-1">{invoice.chief_complaint}</p>
                  </div>
                </div>
              )}
              {invoice.payment_method && (
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-gray-400" />
                  <span className="font-medium text-gray-600">Payment Method:</span> 
                  <span className="font-semibold text-gray-900">{invoice.payment_method}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Services Section - Enhanced Design */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-gradient-to-r from-emerald-500 to-green-600 rounded-xl">
              <Receipt className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Poppins, sans-serif' }}>
                Services Provided
              </h3>
              <p className="text-sm text-gray-600">Detailed breakdown of all services and procedures</p>
            </div>
          </div>
          
          {/* Services Cards for Better Visual Appeal */}
          <div className="space-y-4 mb-6">
            {invoice.services.map((service, index) => (
              <div key={service.id} className="bg-gradient-to-r from-white to-gray-50 border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-[#01b9d4] to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-lg" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      {index + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-lg font-bold text-gray-900 px-3 py-1 bg-gray-100 rounded-lg" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          {service.code}
                        </span>
                        <span className="text-sm font-medium text-gray-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                          Qty: {service.quantity}
                        </span>
                      </div>
                      <p className="text-gray-700 font-medium">{service.description}</p>
                      <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                        <span style={{ fontFamily: 'Rubik, sans-serif' }}>
                          Unit Price: <span className="font-semibold text-gray-700">N$ {service.unit_price.toFixed(2)}</span>
                        </span>
                        {service.medical_aid_covered && (
                          <span style={{ fontFamily: 'Rubik, sans-serif' }}>
                            Medical Aid: <span className="font-semibold text-emerald-600">N$ {service.medical_aid_covered.toFixed(2)}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      N$ {service.total_price.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {service.quantity} × N$ {service.unit_price.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Services Summary Table for Print */}
          <div className="overflow-hidden border border-gray-200 rounded-xl shadow-sm">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-gray-50 to-blue-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">Service Description</th>
                  <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">Qty</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Unit Price</th>
                  <th className="px-6 py-4 text-right text-xs font-bold text-gray-700 uppercase tracking-wider">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {invoice.services.map((service, index) => (
                  <tr key={service.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                    <td className="px-6 py-4 text-sm font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      {service.code}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                      {service.description}
                    </td>
                    <td className="px-6 py-4 text-sm text-center font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      {service.quantity}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      N$ {service.unit_price.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                      N$ {service.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end">
          <div className="w-80">
            <div className="bg-gray-50 p-4 rounded-lg space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Subtotal:</span>
                <span className="font-semibold" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {invoice.total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Medical Aid Covered:</span>
                <span className="font-semibold text-emerald-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {invoice.medical_aid_covered.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Patient Portion:</span>
                <span className="font-semibold text-blue-600" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {invoice.patient_portion.toFixed(2)}
                </span>
              </div>
              <div className="border-t border-gray-200 pt-3">
                <div className="flex justify-between text-lg font-bold">
                  <span>Total Amount:</span>
                  <span className="text-[#01b9d4]" style={{ fontFamily: 'Rubik, sans-serif' }}>
                    N$ {invoice.total.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
          <p>Thank you for choosing our healthcare services!</p>
          <p className="mt-1">For questions about this invoice, please contact us at your convenience.</p>
        </div>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 no-print">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative bg-gradient-to-br from-white via-gray-50/30 to-blue-50/20 rounded-2xl shadow-2xl overflow-hidden max-w-4xl w-full max-h-[90vh] overflow-y-auto no-print"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Premium Header */}
            <div className="relative bg-gradient-to-r from-[#01b9d5] to-blue-600 p-6 text-white">
              <div className="absolute inset-0 bg-gradient-to-r from-[#01b9d5]/20 to-blue-600/20 backdrop-blur-sm"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Receipt className="w-6 h-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Invoice #{invoice.invoice_number}
                    </h2>
                    <p className="text-blue-100 text-sm">
                      {invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : 'No date available'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleDownloadPDF}
                    className="px-4 py-2 bg-white/20 text-white rounded-lg hover:bg-white/30 transition-colors flex items-center gap-2 text-sm font-medium backdrop-blur-sm"
                  >
                    <Download className="w-4 h-4" />
                    Download
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handlePrint}
                    className="px-4 py-2 bg-white text-[#01b9d5] rounded-lg hover:bg-blue-50 transition-colors flex items-center gap-2 text-sm font-medium"
                  >
                    <Printer className="w-4 h-4" />
                    Print
                  </motion.button>
                  
                  <button
                    onClick={onClose}
                    className="p-2 text-white/70 hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
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
              </div>
            </motion.div>
          </div>
          <PrintableInvoice />
        </>
      )}
    </AnimatePresence>
  );
};

export default InvoiceDetailsModal;