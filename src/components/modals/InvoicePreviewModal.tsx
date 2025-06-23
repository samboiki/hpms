import React from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Receipt,
  Calendar,
  User,
  Building2,
  Phone,
  Mail,
  FileText,
  CreditCard,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  Printer,
  Share2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import UnifiedPDFGenerator from '../billing/UnifiedPDFGenerator';
import { useAuthStore } from '../../stores/authStore';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

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

interface InvoicePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  patientName?: string;
  patientPhone?: string;
  patientEmail?: string;
  patientAddress?: string;
  medicalAidProvider?: string;
  membershipNumber?: string;
}

const InvoicePreviewModal: React.FC<InvoicePreviewModalProps> = ({
  isOpen,
  onClose,
  invoice,
  patientName = 'N/A',
  patientPhone = 'N/A',
  patientEmail = 'N/A',
  patientAddress = 'N/A',
  medicalAidProvider,
  membershipNumber
}) => {
  const [isGeneratingPDF, setIsGeneratingPDF] = React.useState(false);
  const [practiceData, setPracticeData] = React.useState<any>(null);
  const { user } = useAuthStore();
  const practiceId = user?.practice_id;

  // Fetch practice data
  React.useEffect(() => {
    const fetchPracticeData = async () => {
      if (!practiceId) return;
      
      try {
        const { data, error } = await supabase
          .from('practices')
          .select('*')
          .eq('id', practiceId)
          .single();
          
        if (error) {
          console.error('Error fetching practice:', error);
          return;
        }
        
        setPracticeData(data);
      } catch (error) {
        console.error('Error fetching practice data:', error);
      }
    };

    if (practiceId) {
      fetchPracticeData();
    }
  }, [practiceId]);

  if (!isOpen || !invoice) return null;

  // PDF generation is now handled by UnifiedPDFGenerator component

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return {
          bg: 'bg-emerald-50',
          text: 'text-emerald-700',
          border: 'border-emerald-200',
          icon: <CheckCircle2 className="w-5 h-5" />
        };
      case 'pending':
        return {
          bg: 'bg-amber-50',
          text: 'text-amber-700',
          border: 'border-amber-200',
          icon: <Clock className="w-5 h-5" />
        };
      case 'overdue':
        return {
          bg: 'bg-red-50',
          text: 'text-red-700',
          border: 'border-red-200',
          icon: <AlertTriangle className="w-5 h-5" />
        };
      default:
        return {
          bg: 'bg-gray-50',
          text: 'text-gray-700',
          border: 'border-gray-200',
          icon: <FileText className="w-5 h-5" />
        };
    }
  };

  const statusColors = getStatusColor(invoice.payment_status);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-700 p-6 text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-white opacity-10 transform -skew-y-3"></div>
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                <Receipt className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-3xl font-bold" style={{ fontFamily: 'Poppins, sans-serif' }}>
                  Invoice #{invoice.invoice_number}
                </h2>
                <p className="text-blue-100 text-sm">
                  Created: {format(parseISO(invoice.created_at), 'MMMM dd, yyyy')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 ${statusColors.bg} ${statusColors.text} ${statusColors.border} bg-white`}
              >
                {statusColors.icon}
                <span className="font-semibold capitalize">{invoice.payment_status}</span>
              </motion.div>
              
              <button
                onClick={onClose}
                className="p-2 bg-white/20 rounded-lg hover:bg-white/30 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Invoice Details Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            {/* Patient Information */}
            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-blue-600" />
                Patient Information
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Name:</span>
                  <span className="font-medium text-gray-900">{patientName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phone:</span>
                  <span className="font-medium text-gray-900">{patientPhone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Email:</span>
                  <span className="font-medium text-gray-900">{patientEmail}</span>
                </div>
                {medicalAidProvider && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Medical Aid:</span>
                    <span className="font-medium text-emerald-600">{medicalAidProvider}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Visit Information */}
            <div className="bg-blue-50 rounded-xl p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" />
                Visit Details
              </h3>
              <div className="space-y-3">
                {invoice.visit_date && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visit Date:</span>
                    <span className="font-medium text-gray-900">
                      {format(parseISO(invoice.visit_date), 'MMMM dd, yyyy')}
                    </span>
                  </div>
                )}
                {invoice.visit_number && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Visit Number:</span>
                    <span className="font-medium text-blue-600">#{invoice.visit_number}</span>
                  </div>
                )}
                {invoice.chief_complaint && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Chief Complaint:</span>
                    <span className="font-medium text-gray-900">{invoice.chief_complaint}</span>
                  </div>
                )}
                {invoice.payment_method && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Payment Method:</span>
                    <span className="font-medium text-gray-900 capitalize">{invoice.payment_method}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Services Table */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                Services & Procedures
              </h3>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Code</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Description</th>
                    <th className="px-6 py-3 text-center text-xs font-semibold text-gray-600 uppercase">Qty</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Unit Price</th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoice.services.map((service, index) => (
                    <motion.tr
                      key={service.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 text-sm font-mono font-medium text-gray-900">
                        {service.code}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">
                        {service.description}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-600">
                        {service.quantity}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-medium text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        N$ {service.unit_price.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm text-right font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                        N$ {service.total_price.toFixed(2)}
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Financial Summary */}
          <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-xl p-6 border border-blue-200">
            <div className="grid md:grid-cols-3 gap-6">
              <motion.div
                whileHover={{ scale: 1.02 }}
                className="text-center p-4 bg-white rounded-lg border border-emerald-200 shadow-sm"
              >
                <Building2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-emerald-600 uppercase tracking-wide mb-1">
                  Medical Aid Covered
                </p>
                <p className="text-2xl font-bold text-emerald-700" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {invoice.medical_aid_covered.toFixed(2)}
                </p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="text-center p-4 bg-white rounded-lg border border-blue-200 shadow-sm"
              >
                <User className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide mb-1">
                  Patient Portion
                </p>
                <p className="text-2xl font-bold text-blue-700" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {invoice.patient_portion.toFixed(2)}
                </p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.02 }}
                className="text-center p-4 bg-white rounded-lg border border-gray-300 shadow-sm"
              >
                <Receipt className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-1">
                  Invoice Total
                </p>
                <p className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Rubik, sans-serif' }}>
                  N$ {invoice.total.toFixed(2)}
                </p>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Actions Footer */}
        <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Invoice generated on {format(parseISO(invoice.created_at), 'MMMM dd, yyyy')}
          </div>
          
          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Share2 className="w-4 h-4" />
              Share
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                console.log('🖨️ Print button clicked - opening browser print dialog');
                window.print();
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 border border-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print
            </motion.button>
            
            {/* PDF Generation with multiple methods */}
            <div className="w-full">
              <UnifiedPDFGenerator
                invoice={invoice}
                patient={{
                  name: patientName,
                  phone: patientPhone !== 'N/A' ? patientPhone : undefined,
                  email: patientEmail !== 'N/A' ? patientEmail : undefined,
                  address: patientAddress !== 'N/A' ? patientAddress : undefined,
                  medicalAidProvider,
                  membershipNumber,
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default InvoicePreviewModal;