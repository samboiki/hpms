import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Calendar,
  FileText,
  Download,
  Sparkles,
  Building2,
  User,
  DollarSign,
  Clock,
  CheckCircle2,
  AlertCircle,
  Printer
} from 'lucide-react';
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subQuarters } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface Invoice {
  id: string;
  invoice_number: string;
  visit_id: string;
  visit_date?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  total: number;
  created_at: string;
  services: any[];
  medical_aid_covered: number;
}

interface PrintStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  invoices: Invoice[];
}

const PrintStatementModal: React.FC<PrintStatementModalProps> = ({
  isOpen,
  onClose,
  patientId,
  invoices
}) => {
  const { currentTheme } = useTheme();
  const { user } = useAuthStore();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Create portal root for modal to render at document body level
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) {
    console.log('🚫 PrintStatementModal not rendering - isOpen:', isOpen);
    return null;
  }
  
  console.log('✅ PrintStatementModal rendering with props:', {
    isOpen,
    patientId,
    invoicesCount: invoices.length,
    domElement: 'About to render'
  });

  const getDateRange = () => {
    const now = new Date();
    
    switch (selectedPeriod) {
      case 'current_month':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
          label: format(now, 'MMMM yyyy')
        };
      case 'last_month':
        const lastMonth = subMonths(now, 1);
        return {
          start: startOfMonth(lastMonth),
          end: endOfMonth(lastMonth),
          label: format(lastMonth, 'MMMM yyyy')
        };
      case 'current_quarter':
        return {
          start: startOfQuarter(now),
          end: endOfQuarter(now),
          label: `Q${Math.floor((now.getMonth() / 3)) + 1} ${format(now, 'yyyy')}`
        };
      case 'last_quarter':
        const lastQuarter = subQuarters(now, 1);
        return {
          start: startOfQuarter(lastQuarter),
          end: endOfQuarter(lastQuarter),
          label: `Q${Math.floor((lastQuarter.getMonth() / 3)) + 1} ${format(lastQuarter, 'yyyy')}`
        };
      case 'current_year':
        return {
          start: startOfYear(now),
          end: endOfYear(now),
          label: format(now, 'yyyy')
        };
      case 'custom':
        return {
          start: customStartDate ? parseISO(customStartDate) : startOfMonth(now),
          end: customEndDate ? parseISO(customEndDate) : endOfMonth(now),
          label: `${customStartDate || 'Start'} to ${customEndDate || 'End'}`
        };
      default:
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
          label: format(now, 'MMMM yyyy')
        };
    }
  };

  const filterInvoicesByDateRange = () => {
    const { start, end } = getDateRange();
    
    return invoices.filter(invoice => {
      const invoiceDate = parseISO(invoice.created_at);
      return invoiceDate >= start && invoiceDate <= end;
    });
  };

  const generateStatementPDF = async () => {
    setIsGenerating(true);
    
    try {
      // Get filtered invoices
      const filteredInvoices = filterInvoicesByDateRange();
      const { label } = getDateRange();
      
      if (filteredInvoices.length === 0) {
        toast.error('No invoices found for the selected period');
        return;
      }

      // Fetch patient details
      const { data: patientData, error: patientError } = await supabase
        .from('patients')
        .select('first_name, last_name, email, cell_number, home_address')
        .eq('id', patientId)
        .single();

      if (patientError) {
        throw new Error('Failed to fetch patient details');
      }

      // Fetch practice details
      let userPracticeId = user?.practice_id;
      if (!userPracticeId && user?.user_metadata?.practice_id) {
        userPracticeId = user.user_metadata.practice_id;
      }

      if (!userPracticeId) {
        throw new Error('No practice associated with user');
      }

      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        .select(`
          id, name, slug, domain, logo_url, primary_color, secondary_color,
          contact_email, contact_phone, address, city, country, postal_code,
          tax_number, license_number, practice_number, hero_subtitle
        `)
        .eq('id', userPracticeId)
        .single();

      if (practiceError) {
        throw new Error('Failed to fetch practice details');
      }

      // Import required libraries
      const html2canvas = (await import('html2canvas')).default;
      const jsPDF = (await import('jspdf')).default;

      // Load fonts
      const fontLink = document.createElement('link');
      fontLink.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Rubik:wght@400;500;600;700;800;900&display=swap';
      fontLink.rel = 'stylesheet';
      document.head.appendChild(fontLink);

      await document.fonts.ready;

      // Get practice primary color
      const primaryColor = practiceData?.primary_color || '#01b9d4';
      
      // Generate gradient colors
      function hexToRgb(hex: string) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? [
          parseInt(result[1], 16),
          parseInt(result[2], 16),
          parseInt(result[3], 16)
        ] : [1, 185, 212];
      }
      
      function adjustBrightness(hex: string, percent: number) {
        const [r, g, b] = hexToRgb(hex);
        const adjust = (color: number) => Math.max(0, Math.min(255, Math.round(color * (1 + percent / 100))));
        return `#${((1 << 24) + (adjust(r) << 16) + (adjust(g) << 8) + adjust(b)).toString(16).slice(1)}`;
      }

      const lightColor = adjustBrightness(primaryColor, 20);
      const darkColor = adjustBrightness(primaryColor, -15);

      // Calculate totals
      const totalAmount = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
      const totalPaid = filteredInvoices.filter(inv => inv.payment_status === 'paid').reduce((sum, inv) => sum + inv.total, 0);
      const totalPending = filteredInvoices.filter(inv => inv.payment_status === 'pending').reduce((sum, inv) => sum + inv.total, 0);
      const totalOverdue = filteredInvoices.filter(inv => inv.payment_status === 'overdue').reduce((sum, inv) => sum + inv.total, 0);

      // Create HTML for statement
      const statementHTML = `
        <div style="width: 800px; margin: 0 auto; background: white; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6;">
          <!-- Header -->
          <div style="background: linear-gradient(135deg, ${primaryColor} 0%, ${lightColor} 50%, ${darkColor} 100%); padding: 40px 30px; color: white; position: relative; overflow: hidden;">
            <div style="position: absolute; top: -20px; right: -20px; width: 200px; height: 200px; background: rgba(255,255,255,0.1); border-radius: 50%; opacity: 0.3;"></div>
            <div style="position: absolute; bottom: -30px; left: -30px; width: 150px; height: 150px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
            
            <div style="position: relative; z-index: 2;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 25px;">
                <div>
                  <h1 style="margin: 0; font-size: 28px; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.1); font-family: 'Rubik', sans-serif;">${practiceData.name}</h1>
                  <p style="margin: 5px 0 0 0; font-size: 14px; opacity: 0.9; font-weight: 500;">${practiceData.hero_subtitle || 'Professional Healthcare Services'}</p>
                </div>
                <div style="text-align: right; font-size: 12px; opacity: 0.9;">
                  ${practiceData.contact_phone ? `<div>${practiceData.contact_phone}</div>` : ''}
                  ${practiceData.contact_email ? `<div>${practiceData.contact_email}</div>` : ''}
                </div>
              </div>
              
              <div style="border-top: 2px solid rgba(255,255,255,0.3); padding-top: 20px;">
                <h2 style="margin: 0; font-size: 24px; font-weight: 700; font-family: 'Rubik', sans-serif;">ACCOUNT STATEMENT</h2>
                <p style="margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">Period: ${label}</p>
              </div>
            </div>
          </div>

          <!-- Patient Info -->
          <div style="padding: 30px; background: #f8fafc; border-bottom: 1px solid #e2e8f0;">
            <h3 style="margin: 0 0 15px 0; font-size: 18px; font-weight: 600; color: #2d3748;">Patient Information</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
              <div>
                <p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Name:</strong> ${patientData.first_name} ${patientData.last_name}</p>
                ${patientData.email ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #4a5568;"><strong>Email:</strong> ${patientData.email}</p>` : ''}
              </div>
              <div>
                ${patientData.cell_number ? `<p style="margin: 0; font-size: 14px; color: #4a5568;"><strong>Phone:</strong> ${patientData.cell_number}</p>` : ''}
                ${patientData.home_address ? `<p style="margin: 8px 0 0 0; font-size: 14px; color: #4a5568;"><strong>Address:</strong> ${patientData.home_address}</p>` : ''}
              </div>
            </div>
          </div>

          <!-- Summary Cards -->
          <div style="padding: 30px; background: white;">
            <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #2d3748;">Financial Summary</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px;">
              <div style="padding: 20px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">N$ ${totalPaid.toFixed(2)}</div>
                <div style="font-size: 12px; opacity: 0.9; font-weight: 500;">Paid</div>
              </div>
              <div style="padding: 20px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">N$ ${totalPending.toFixed(2)}</div>
                <div style="font-size: 12px; opacity: 0.9; font-weight: 500;">Pending</div>
              </div>
              <div style="padding: 20px; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">N$ ${totalOverdue.toFixed(2)}</div>
                <div style="font-size: 12px; opacity: 0.9; font-weight: 500;">Overdue</div>
              </div>
              <div style="padding: 20px; background: linear-gradient(135deg, ${primaryColor} 0%, ${darkColor} 100%); border-radius: 12px; color: white; text-align: center;">
                <div style="font-size: 24px; font-weight: 700; margin-bottom: 5px;">N$ ${totalAmount.toFixed(2)}</div>
                <div style="font-size: 12px; opacity: 0.9; font-weight: 500;">Total</div>
              </div>
            </div>
          </div>

          <!-- Invoice Table -->
          <div style="padding: 0 30px 30px 30px;">
            <h3 style="margin: 0 0 20px 0; font-size: 18px; font-weight: 600; color: #2d3748;">Invoice Details</h3>
            <div style="overflow: hidden; border-radius: 12px; border: 1px solid #e2e8f0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background: #f7fafc;">
                    <th style="padding: 15px 10px; text-align: left; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0;">Invoice #</th>
                    <th style="padding: 15px 10px; text-align: left; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0;">Date</th>
                    <th style="padding: 15px 10px; text-align: left; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0;">Status</th>
                    <th style="padding: 15px 10px; text-align: right; font-weight: 600; color: #4a5568; border-bottom: 1px solid #e2e8f0;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  ${filteredInvoices.map((invoice, index) => `
                    <tr style="background: ${index % 2 === 0 ? 'white' : '#f8fafc'};">
                      <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; font-weight: 500;">${invoice.invoice_number}</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; color: #4a5568;">${format(parseISO(invoice.created_at), 'MMM dd, yyyy')}</td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9;">
                        <span style="padding: 4px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: uppercase; 
                          ${invoice.payment_status === 'paid' ? 'background: #dcfce7; color: #166534;' :
                            invoice.payment_status === 'pending' ? 'background: #fef3c7; color: #92400e;' :
                            invoice.payment_status === 'overdue' ? 'background: #fee2e2; color: #991b1b;' :
                            'background: #f3f4f6; color: #374151;'}">
                          ${invoice.payment_status}
                        </span>
                      </td>
                      <td style="padding: 12px 10px; border-bottom: 1px solid #f1f5f9; text-align: right; font-weight: 600;">N$ ${invoice.total.toFixed(2)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding: 20px 30px; background: #f8fafc; border-top: 1px solid #e2e8f0;">
            <div style="text-align: center; font-size: 12px; color: #6b7280;">
              <p style="margin: 0 0 10px 0;">Thank you for choosing <strong>${practiceData.name}</strong></p>
              <p style="margin: 0; font-size: 11px; color: #9ca3af;">
                Statement generated on ${format(new Date(), 'MMMM dd, yyyy')} by OneHealth Systems
              </p>
            </div>
          </div>
        </div>
      `;

      // Create temporary container
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      document.body.appendChild(tempContainer);
      tempContainer.innerHTML = statementHTML;

      // Generate canvas
      const canvas = await html2canvas(tempContainer.firstElementChild as HTMLElement, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, '', 'FAST');

      // Download PDF
      pdf.save(`statement-${patientData.first_name}-${patientData.last_name}-${label.replace(/\s+/g, '-')}.pdf`);

      // Clean up
      document.body.removeChild(tempContainer);
      
      toast.success('Statement generated successfully!');
      onClose();

    } catch (error) {
      console.error('Error generating statement:', error);
      toast.error('Failed to generate statement. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const { label } = getDateRange();
  const filteredInvoices = filterInvoicesByDateRange();

  // Create portal to render modal at document.body level
  const modalContent = (
    <div 
      className="fixed inset-0" 
      style={{ 
        zIndex: 2147483649, // Higher than FormModal (2147483648)
      }}
      data-testid="print-statement-modal"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xl"
        onClick={onClose}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <div className="pointer-events-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
        style={{ zIndex: 2147483647 }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Generate Statement</h3>
                <p className="text-purple-100 text-sm">Patient account statement</p>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                disabled={isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
            {/* Period Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Select Period
              </label>
              <div className="space-y-3">
                {[
                  { value: 'current_month', label: 'Current Month' },
                  { value: 'last_month', label: 'Last Month' },
                  { value: 'current_quarter', label: 'This Quarter' },
                  { value: 'last_quarter', label: 'Last Quarter' },
                  { value: 'current_year', label: 'Current Year' },
                  { value: 'custom', label: 'Custom Range' }
                ].map((period) => (
                  <label key={period.value} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="period"
                      value={period.value}
                      checked={selectedPeriod === period.value}
                      onChange={(e) => setSelectedPeriod(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-gray-700">{period.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Custom Date Range */}
            {selectedPeriod === 'custom' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Start Date
                  </label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    End Date
                  </label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="font-medium text-gray-800 mb-2">Statement Preview</h3>
              <p className="text-sm text-gray-600">Period: {label}</p>
              <p className="text-sm text-gray-600">Invoices: {filteredInvoices.length} found</p>
              <p className="text-sm text-gray-600">
                Total Amount: N$ {filteredInvoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 bg-gray-50 border-t">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={generateStatementPDF}
              disabled={isGenerating || filteredInvoices.length === 0}
              className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                isGenerating || filteredInvoices.length === 0
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:from-purple-700 hover:to-indigo-700'
              }`}
            >
              {isGenerating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Generate Statement
                </>
              )}
            </button>
          </div>
      </motion.div>
        </div>
      </div>
    </div>
  );

  // Use portal to render at document.body level, outside any parent containers
  return createPortal(modalContent, document.body);
};

export default PrintStatementModal;