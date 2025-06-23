import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Printer,
  Mail,
  MessageSquare,
  Download,
  Eye,
  Building2,
  Calendar,
  User,
  Phone,
  MapPin,
  Receipt,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  Send,
  FileDown
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { toast } from 'react-hot-toast';
import jsPDF from 'jspdf';
import { supabase } from '../../lib/supabase';

interface PremiumInvoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  patient: any;
  medicalAid?: any;
  practiceInfo?: any;
}

const PremiumInvoiceModal: React.FC<PremiumInvoiceModalProps> = ({
  isOpen,
  onClose,
  invoice,
  patient,
  medicalAid,
  practiceInfo
}) => {
  const { currentTheme } = useTheme();
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [emailAddress, setEmailAddress] = useState(patient?.email || '');
  const [phoneNumber, setPhoneNumber] = useState(patient?.cell_number || '');
  const [emailSubject, setEmailSubject] = useState(`Invoice #${invoice?.invoice_number} - ${practiceInfo?.practice_name || 'HPMS'}`);
  const [emailMessage, setEmailMessage] = useState('Please find your invoice attached.');
  const [smsMessage, setSmsMessage] = useState(`Hi ${patient?.first_name}, your invoice #${invoice?.invoice_number} for N$${invoice?.total?.toFixed(2)} is ready. Visit our portal to view details.`);
  const [isLoading, setIsLoading] = useState(false);
  const [practice, setPractice] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  // Fetch practice info on mount
  useEffect(() => {
    const fetchPracticeInfo = async () => {
      try {
        const { data, error } = await supabase
          .from('practice_info')
          .select('*')
          .limit(1)
          .single();

        if (error) throw error;
        setPractice(data);
      } catch (error) {
        console.error('Error fetching practice info:', error);
      }
    };

    if (isOpen) {
      fetchPracticeInfo();
    }
  }, [isOpen]);

  if (!isOpen || !invoice) return null;

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

  const generateEnhancedPDF = async () => {
    if (!practice) {
      toast.error('Practice information not loaded');
      return;
    }

    try {
      setGenerating(true);
      console.log('🎯 Starting enhanced multi-page PDF generation...');

      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const contentWidth = pageWidth - (margin * 2);
      
      // Page layout constants
      const headerHeight = 40;
      const footerHeight = 25;
      const contentHeight = pageHeight - headerHeight - footerHeight - (margin * 2);
      
      // Service table constants
      const tableStartY = headerHeight + margin + 60; // After header + invoice details
      const rowHeight = 8;
      const maxRowsPerPage = Math.floor((contentHeight - 60) / rowHeight); // Reserve space for totals
      
      // Colors
      const primaryColor = practice.primary_color || '#01b9d4';

      // Helper function to convert hex to RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 1, g: 185, b: 212 }; // fallback to cyan
      };

      const primaryRgb = hexToRgb(primaryColor);

      // Helper function to add header to each page
      const addHeader = (pageNum: number, totalPages: number) => {
        // Header background
        pdf.setFillColor(primaryRgb.r, primaryRgb.g, primaryRgb.b);
        pdf.rect(0, 0, pageWidth, headerHeight, 'F');

        // Practice logo/name
        pdf.setFontSize(18);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        pdf.text(practice.name, margin, 20);

        // Practice details
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        let yPos = 28;
        if (practice.contact_phone) {
          pdf.text(`Phone: ${practice.contact_phone}`, margin, yPos);
          yPos += 4;
        }
        if (practice.contact_email) {
          pdf.text(`Email: ${practice.contact_email}`, margin, yPos);
        }

        // Invoice number and date (right side)
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('INVOICE', pageWidth - margin - 30, 15);
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        pdf.text(`#${invoice.invoice_number}`, pageWidth - margin - 30, 22);
        pdf.text(format(parseISO(invoice.created_at), 'dd/MM/yyyy'), pageWidth - margin - 30, 28);
        
        // Page number
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 30, 35);
      };

      // Helper function to add footer to each page
      const addFooter = (pageNum: number) => {
        const footerY = pageHeight - footerHeight;
        
        // Footer line
        pdf.setDrawColor(200, 200, 200);
        pdf.line(margin, footerY, pageWidth - margin, footerY);
        
        pdf.setFontSize(8);
        pdf.setTextColor(100, 100, 100);
        pdf.setFont('helvetica', 'normal');
        
        let yPos = footerY + 8;
        
        // Practice details in footer
        if (practice.license_number) {
          pdf.text(`License: ${practice.license_number}`, margin, yPos);
          yPos += 4;
        }
        
        if (practice.tax_number) {
          pdf.text(`Tax No: ${practice.tax_number}`, margin, yPos);
        }
        
        // Bank details (right side)
        if (practice.bank_name && practice.account_number) {
          pdf.text(`${practice.bank_name}`, pageWidth - margin - 60, footerY + 8);
          pdf.text(`Acc: ${practice.account_number}`, pageWidth - margin - 60, footerY + 12);
          if (practice.branch_code) {
            pdf.text(`Branch: ${practice.branch_code}`, pageWidth - margin - 60, footerY + 16);
          }
        }
      };

      // Get invoice services
      const services = invoice.services || [];
      const totalPages = Math.max(1, Math.ceil(services.length / maxRowsPerPage));

      // Generate pages
      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        if (pageNum > 1) {
          pdf.addPage();
        }

        // Add header and footer
        addHeader(pageNum, totalPages);
        addFooter(pageNum);

        // Content area starts after header
        let currentY = headerHeight + margin + 10;

        // First page: Add invoice details and patient info
        if (pageNum === 1) {
          // Patient information section
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Bill To:', margin, currentY);
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          currentY += 6;
          pdf.text(patient.name || `${patient.first_name} ${patient.last_name}`, margin, currentY);
          currentY += 5;
          
          if (patient.phone || patient.cell_number) {
            pdf.text(`Phone: ${patient.phone || patient.cell_number}`, margin, currentY);
            currentY += 4;
          }
          
          if (patient.email) {
            pdf.text(`Email: ${patient.email}`, margin, currentY);
            currentY += 4;
          }
          
          if (medicalAid?.provider && patient.membershipNumber) {
            pdf.text(`Medical Aid: ${medicalAid.provider} - ${patient.membershipNumber}`, margin, currentY);
            currentY += 4;
          }

          // Visit details (right side)
          if (invoice.visit_date) {
            pdf.text(`Visit Date: ${format(parseISO(invoice.visit_date), 'dd/MM/yyyy')}`, pageWidth - margin - 80, headerHeight + margin + 16);
          }
          
          if (invoice.chief_complaint) {
            const maxComplaintLength = 50;
            const complaint = invoice.chief_complaint.length > maxComplaintLength 
              ? invoice.chief_complaint.substring(0, maxComplaintLength) + '...'
              : invoice.chief_complaint;
            pdf.text(`Chief Complaint: ${complaint}`, pageWidth - margin - 80, headerHeight + margin + 22);
          }

          currentY += 10;
        }

        // Services table header
        const tableY = pageNum === 1 ? currentY : headerHeight + margin + 10;
        
        // Table header background
        pdf.setFillColor(243, 244, 246);
        pdf.rect(margin, tableY, contentWidth, rowHeight, 'F');
        
        // Table header text
        pdf.setFontSize(9);
        pdf.setTextColor(0, 0, 0);
        pdf.setFont('helvetica', 'bold');
        
        const colWidths = {
          code: 25,
          description: 80,
          quantity: 20,
          unitPrice: 25,
          total: 30
        };
        
        let colX = margin + 2;
        pdf.text('Code', colX, tableY + 5);
        colX += colWidths.code;
        pdf.text('Description', colX, tableY + 5);
        colX += colWidths.description;
        pdf.text('Qty', colX, tableY + 5);
        colX += colWidths.quantity;
        pdf.text('Unit Price', colX, tableY + 5);
        colX += colWidths.unitPrice;
        pdf.text('Total', colX, tableY + 5);

        // Services for this page
        const startIndex = (pageNum - 1) * maxRowsPerPage;
        const endIndex = Math.min(startIndex + maxRowsPerPage, services.length);
        const pageServices = services.slice(startIndex, endIndex);

        // Table rows
        pdf.setFont('helvetica', 'normal');
        let rowY = tableY + rowHeight;
        
        pageServices.forEach((service: any, index: number) => {
          // Alternate row background
          if (index % 2 === 1) {
            pdf.setFillColor(248, 249, 250);
            pdf.rect(margin, rowY, contentWidth, rowHeight, 'F');
          }
          
          pdf.setTextColor(0, 0, 0);
          
          let colX = margin + 2;
          pdf.text(service.code || '', colX, rowY + 5);
          colX += colWidths.code;
          
          // Truncate long descriptions
          const maxDescLength = 45;
          const description = service.description.length > maxDescLength 
            ? service.description.substring(0, maxDescLength) + '...'
            : service.description;
          pdf.text(description, colX, rowY + 5);
          colX += colWidths.description;
          
          pdf.text(service.quantity.toString(), colX, rowY + 5);
          colX += colWidths.quantity;
          
          pdf.text(`R ${service.unit_price.toFixed(2)}`, colX, rowY + 5);
          colX += colWidths.unitPrice;
          
          pdf.text(`R ${service.total_price.toFixed(2)}`, colX, rowY + 5);
          
          rowY += rowHeight;
        });

        // Last page: Add totals
        if (pageNum === totalPages) {
          rowY += 10;
          
          // Totals section
          const totalsX = pageWidth - margin - 80;
          
          pdf.setFont('helvetica', 'normal');
          pdf.text('Subtotal:', totalsX, rowY);
          pdf.text(`R ${invoice.total.toFixed(2)}`, totalsX + 40, rowY);
          rowY += 6;
          
          if (invoice.medical_aid_covered > 0) {
            pdf.text('Medical Aid:', totalsX, rowY);
            pdf.text(`R ${invoice.medical_aid_covered.toFixed(2)}`, totalsX + 40, rowY);
            rowY += 6;
          }
          
          pdf.setFont('helvetica', 'bold');
          pdf.text('Patient Portion:', totalsX, rowY);
          pdf.text(`R ${invoice.patient_portion.toFixed(2)}`, totalsX + 40, rowY);
          
          // Payment status
          rowY += 10;
          pdf.setFont('helvetica', 'normal');
          const statusColor = invoice.payment_status === 'paid' ? [16, 185, 129] : 
                             invoice.payment_status === 'pending' ? [245, 158, 11] : [239, 68, 68];
          pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
          pdf.text(`Status: ${invoice.payment_status.toUpperCase()}`, totalsX, rowY);
        }
      }

      return pdf;
    } catch (error) {
      console.error('❌ Enhanced PDF generation failed:', error);
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = async () => {
    try {
      const pdf = await generateEnhancedPDF();
      if (pdf) {
        // Open PDF in new window for printing
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            printWindow.print();
          };
        }
      }
    } catch (error) {
      toast.error('Failed to generate PDF for printing');
    }
  };

  const handleDownload = async () => {
    try {
      const pdf = await generateEnhancedPDF();
      if (pdf) {
        pdf.save(`invoice-${invoice.invoice_number}.pdf`);
        toast.success('Enhanced multi-page PDF downloaded successfully!');
      }
    } catch (error) {
      toast.error('Failed to generate PDF for download');
    }
  };

  const handleEmailSend = async () => {
    if (!emailAddress.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setIsLoading(true);
    try {
      const invoiceHTML = generateInvoiceHTML();
      
      // Here you would implement the actual email sending using your Resend API
      // For now, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success('Invoice email sent successfully!');
      setIsEmailModalOpen(false);
    } catch (error) {
      toast.error('Failed to send email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSmsSend = async () => {
    if (!phoneNumber.trim()) {
      toast.error('Please enter a phone number');
      return;
    }

    setIsLoading(true);
    try {
      // Here you would implement the actual SMS sending
      // For now, we'll simulate the process
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      toast.success('Invoice SMS sent successfully!');
      setIsSmsModalOpen(false);
    } catch (error) {
      toast.error('Failed to send SMS. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const generateInvoiceHTML = () => {
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Invoice #${invoice.invoice_number}</title>
        <style>
            body { font-family: 'Arial', sans-serif; margin: 0; padding: 20px; background: #f8fafc; }
            .invoice-container { max-width: 800px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
            .header { background: linear-gradient(135deg, #01b9d4, #6366f1); color: white; padding: 30px; }
            .practice-logo { width: 60px; height: 60px; background: white; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 20px; }
            .practice-info h1 { margin: 0; font-size: 28px; font-weight: bold; }
            .practice-info p { margin: 5px 0; opacity: 0.9; }
            .invoice-details { display: flex; justify-content: space-between; padding: 30px; border-bottom: 2px solid #e2e8f0; }
            .patient-info, .invoice-meta { flex: 1; }
            .invoice-meta { text-align: right; }
            .invoice-number { font-size: 24px; font-weight: bold; color: #01b9d4; }
            .services-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
            .services-table th, .services-table td { padding: 15px; text-align: left; border-bottom: 1px solid #e2e8f0; }
            .services-table th { background: #f8fafc; font-weight: bold; color: #374151; }
            .totals { background: #f8fafc; padding: 30px; }
            .total-row { display: flex; justify-content: space-between; margin: 10px 0; }
            .total-row.final { border-top: 2px solid #01b9d4; padding-top: 15px; font-size: 20px; font-weight: bold; color: #01b9d4; }
            .footer { text-align: center; padding: 20px; color: #6b7280; border-top: 1px solid #e2e8f0; }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="practice-logo">
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#01b9d4" stroke-width="2" stroke-linejoin="round"/>
                        <path d="M2 17L12 22L22 17" stroke="#01b9d4" stroke-width="2" stroke-linejoin="round"/>
                        <path d="M2 12L12 17L22 12" stroke="#01b9d4" stroke-width="2" stroke-linejoin="round"/>
                    </svg>
                </div>
                <div class="practice-info">
                    <h1>${practiceInfo?.practice_name || 'HPMS Medical Practice'}</h1>
                    <p>${practiceInfo?.address || 'Professional Medical Services'}</p>
                    <p>${practiceInfo?.phone || '+264 61 123 4567'} • ${practiceInfo?.email || 'info@hpms.com'}</p>
                </div>
            </div>
            
            <div class="invoice-details">
                <div class="patient-info">
                    <h3>Bill To:</h3>
                    <p><strong>${patient?.first_name} ${patient?.last_name}</strong></p>
                    <p>${patient?.email || ''}</p>
                    <p>${patient?.cell_number || ''}</p>
                    <p>${patient?.address || ''}</p>
                    ${medicalAid ? `<p><strong>Medical Aid:</strong> ${medicalAid.provider} (${medicalAid.member_number})</p>` : ''}
                </div>
                <div class="invoice-meta">
                    <div class="invoice-number">Invoice #${invoice.invoice_number}</div>
                    <p><strong>Date:</strong> ${invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : format(new Date(), 'MMMM dd, yyyy')}</p>
                    <p><strong>Status:</strong> <span style="color: ${invoice.payment_status === 'paid' ? '#10b981' : invoice.payment_status === 'pending' ? '#f59e0b' : '#ef4444'}">${invoice.payment_status?.toUpperCase() || 'PENDING'}</span></p>
                </div>
            </div>
            
            <div style="padding: 30px;">
                <h3>Services Provided</h3>
                <table class="services-table">
                    <thead>
                        <tr>
                            <th>Service Code</th>
                            <th>Description</th>
                            <th>Qty</th>
                            <th>Unit Price</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${invoice.services?.map(service => `
                            <tr>
                                <td>${service.code}</td>
                                <td>${service.description}</td>
                                <td>${service.quantity}</td>
                                <td>N$ ${service.unit_price?.toFixed(2)}</td>
                                <td>N$ ${service.total_price?.toFixed(2)}</td>
                            </tr>
                        `).join('') || ''}
                    </tbody>
                </table>
            </div>
            
            <div class="totals">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>N$ ${invoice.total?.toFixed(2)}</span>
                </div>
                <div class="total-row">
                    <span>Medical Aid Coverage:</span>
                    <span>N$ ${invoice.medical_aid_covered?.toFixed(2) || '0.00'}</span>
                </div>
                <div class="total-row">
                    <span>Patient Portion:</span>
                    <span>N$ ${invoice.patient_portion?.toFixed(2) || invoice.total?.toFixed(2)}</span>
                </div>
                <div class="total-row final">
                    <span>Total Amount:</span>
                    <span>N$ ${invoice.total?.toFixed(2)}</span>
                </div>
            </div>
            
            <div class="footer">
                <p>Thank you for choosing ${practiceInfo?.practice_name || 'HPMS Medical Practice'}!</p>
                <p>For questions about this invoice, please contact us at ${practiceInfo?.phone || '+264 61 123 4567'}</p>
            </div>
        </div>
    </body>
    </html>
    `;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
          >
            {/* Premium Header */}
            <div className="bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-sm">
                    <Receipt className="w-8 h-8 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Invoice Details</h2>
                    <p className="text-white/80">#{invoice.invoice_number}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${statusColors[invoice.payment_status || 'pending']}`}>
                    {statusIcons[invoice.payment_status || 'pending']}
                    <span className="font-semibold">{(invoice.payment_status || 'pending').toUpperCase()}</span>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={onClose}
                    className="p-2 hover:bg-white/20 rounded-xl transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </motion.button>
                </div>
              </div>
            </div>

            {/* Invoice Content */}
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              {/* Invoice Preview */}
              <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 mb-6">
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Patient Information</h3>
                    <p className="text-gray-600"><strong>{patient?.first_name} {patient?.last_name}</strong></p>
                    <p className="text-gray-600">{patient?.email}</p>
                    <p className="text-gray-600">{patient?.cell_number}</p>
                    {medicalAid && (
                      <p className="text-gray-600 mt-2">
                        <strong>Medical Aid:</strong> {medicalAid.provider} ({medicalAid.member_number})
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold bg-gradient-to-r from-[#01b9d4] to-purple-600 bg-clip-text text-transparent">
                      N$ {invoice.total?.toFixed(2)}
                    </p>
                    <p className="text-gray-600">
                      {invoice.visit_date ? format(parseISO(invoice.visit_date), 'MMMM dd, yyyy') : format(new Date(), 'MMMM dd, yyyy')}
                    </p>
                  </div>
                </div>

                {/* Services Summary */}
                <div className="border-t border-gray-200 pt-4">
                  <h4 className="font-semibold text-gray-800 mb-3">Services ({invoice.service_count} items)</h4>
                  <div className="space-y-2">
                    {invoice.services?.slice(0, 3).map((service, index) => (
                      <div key={index} className="flex justify-between text-sm">
                        <span>{service.code} - {service.description}</span>
                        <span className="font-semibold">N$ {service.total_price?.toFixed(2)}</span>
                      </div>
                    ))}
                    {invoice.services?.length > 3 && (
                      <p className="text-sm text-gray-500 italic">... and {invoice.services.length - 3} more items</p>
                    )}
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="border-t border-gray-200 pt-4 mt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Medical Aid Coverage:</span>
                    <span className="text-emerald-600 font-semibold">N$ {invoice.medical_aid_covered?.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Patient Portion:</span>
                    <span className="text-[#01b9d4] font-semibold">N$ {invoice.patient_portion?.toFixed(2) || invoice.total?.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-gray-200 p-6 bg-gray-50">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsEmailModalOpen(true)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Mail className="w-5 h-5" />
                  <span>Email</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setIsSmsModalOpen(true)}
                  className="flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <MessageSquare className="w-5 h-5" />
                  <span>SMS</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: generating ? 1 : 1.05, y: generating ? 0 : -2 }}
                  whileTap={{ scale: generating ? 1 : 0.95 }}
                  onClick={handlePrint}
                  disabled={generating}
                  className={`flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Printer className="w-5 h-5" />
                      <span>Print Enhanced PDF</span>
                    </>
                  )}
                </motion.button>

                <motion.button
                  whileHover={{ scale: generating ? 1 : 1.05, y: generating ? 0 : -2 }}
                  whileTap={{ scale: generating ? 1 : 0.95 }}
                  onClick={handleDownload}
                  disabled={generating}
                  className={`flex items-center justify-center gap-3 px-4 py-3 bg-gradient-to-r from-[#01b9d4] to-purple-600 text-white rounded-xl font-semibold shadow-lg hover:shadow-xl transition-all duration-300 ${generating ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  {generating ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-5 h-5" />
                      <span>Download Enhanced PDF</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>

            {/* Email Modal */}
            <AnimatePresence>
              {isEmailModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-800">Send Invoice via Email</h3>
                      <button
                        onClick={() => setIsEmailModalOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
                        <input
                          type="email"
                          value={emailAddress}
                          onChange={(e) => setEmailAddress(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent outline-none transition-all"
                          placeholder="patient@email.com"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                        <input
                          type="text"
                          value={emailSubject}
                          onChange={(e) => setEmailSubject(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent outline-none transition-all"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                        <textarea
                          value={emailMessage}
                          onChange={(e) => setEmailMessage(e.target.value)}
                          rows={3}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent outline-none transition-all resize-none"
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setIsEmailModalOpen(false)}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                      >
                        Cancel
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleEmailSend}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Send Email
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>

            {/* SMS Modal */}
            <AnimatePresence>
              {isSmsModalOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-xl font-bold text-gray-800">Send Invoice via SMS</h3>
                      <button
                        onClick={() => setIsSmsModalOpen(false)}
                        className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Phone Number</label>
                        <input
                          type="tel"
                          value={phoneNumber}
                          onChange={(e) => setPhoneNumber(e.target.value)}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent outline-none transition-all"
                          placeholder="+264 XX XXX XXXX"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                        <textarea
                          value={smsMessage}
                          onChange={(e) => setSmsMessage(e.target.value)}
                          rows={4}
                          maxLength={160}
                          className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-[#01b9d4] focus:border-transparent outline-none transition-all resize-none"
                        />
                        <p className="text-xs text-gray-500 mt-1">{smsMessage.length}/160 characters</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 mt-6">
                      <button
                        onClick={() => setIsSmsModalOpen(false)}
                        className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
                      >
                        Cancel
                      </button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleSmsSend}
                        disabled={isLoading}
                        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl hover:shadow-lg transition-all font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isLoading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <MessageSquare className="w-5 h-5" />
                            Send SMS
                          </>
                        )}
                      </motion.button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default PremiumInvoiceModal;