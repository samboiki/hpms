/**
 * Owner-designed print format: do not change the layout or look without the owner's explicit request.
 *
 * The patient's account statement as the owner designed it (git bd02f25), opened from Statement on his invoice table
 * on the patient file's Billing tab: logo and practice details, ACCOUNT STATEMENT with the period, patient
 * information and statement summary, every service of the invoices in the period, Subtotal, Patient Portion and the
 * total, banking details and footer, on A4 pages drawn into a PDF. Content changes kept on purpose (listed for the
 * owner, 15 Oct 2026): the practice's own bank account (a hard-coded one used to print on every practice's
 * statement; none when the practice has not entered one), "Total Invoiced" for the total row (it adds up paid
 * invoices too, so it is not an amount due), missing practice details left out instead of "null", the custom
 * period ending at the end of its last day, and the practice selected by a user who works at several practices.
 */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
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
import { format, parseISO, startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, startOfQuarter, endOfQuarter, subQuarters, endOfDay } from 'date-fns';
import { useTheme } from '../../stores/themeStore';
import { toast } from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import html2canvas from 'html2canvas';
import { useAuthStore } from '../../stores/authStore';
import { practiceWebsiteText } from '../../utils/practiceWebsite';

interface Invoice {
  id: string;
  invoice_number: string;
  visit_id: string;
  visit_date?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  total: number;
  created_at: string;
  services: Service[];
  medical_aid_covered: number;
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
  const { user, selectedPracticeId } = useAuthStore();
  const [selectedPeriod, setSelectedPeriod] = useState<string>('current_month');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);

  console.log('🎯 PrintStatementModal render:', { isOpen, patientId, invoicesCount: invoices.length });

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      console.log('🔒 Locking body scroll');
      document.body.style.overflow = 'hidden';
      document.body.style.paddingRight = '15px'; // Prevent layout shift
    } else {
      console.log('🔓 Unlocking body scroll');
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
      document.body.style.paddingRight = '0px';
    };
  }, [isOpen]);

  if (!isOpen) {
    console.log('❌ Modal not open, returning null');
    return null;
  }

  console.log('✅ Modal is open, rendering...');

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
          // parseISO('yyyy-MM-dd') is midnight; include invoices created during the end date
          end: customEndDate ? endOfDay(parseISO(customEndDate)) : endOfMonth(now),
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
    console.log('🖨️ Starting statement PDF generation...');
    setIsGenerating(true);
    
    try {
      // Get filtered invoices
      const filteredInvoices = filterInvoicesByDateRange();
      const { label } = getDateRange();
      
      if (filteredInvoices.length === 0) {
        toast.error('No invoices found for the selected period');
        return;
      }

      console.log('📄 Filtered invoices:', filteredInvoices.length);

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
      // authStore user has no user_metadata; use the selected practice (multi-practice users) first
      const userPracticeId = selectedPracticeId || user?.practice_id;

      if (!userPracticeId) {
        throw new Error('No practice associated with user');
      }

      const { data: practiceData, error: practiceError } = await supabase
        .from('practices')
        // Every column: the website the practice typed (website_url) is read when it is there, and naming a column
        // the database lacks would fail the whole statement header
        .select('*')
        .eq('id', userPracticeId)
        .single();

      if (practiceError) {
        throw new Error('Failed to fetch practice details');
      }

      // Only this practice's own details: missing values are left out (no "null", and no
      // hard-coded bank account, which used to be printed on every practice's statements)
      const practiceLocation = [
        [practiceData.city, practiceData.country].filter(Boolean).join(', '),
        practiceData.postal_code
      ].filter(Boolean).join(' ');
      const practiceContact = [practiceData.contact_phone, practiceData.contact_email].filter(Boolean).join(' • ');
      const bankDetailsHTML = practiceData.account_number ? `
            <div style="margin: 30px 40px 40px 40px; padding: 20px; background: #f8fafc; border-radius: 8px; border: 1px solid #e5e7eb;">
              <h3 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Banking Details</h3>
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; font-size: 13px; color: #4b5563;">
                ${practiceData.bank_name ? `<div><span style="font-weight: 600;">Bank:</span> ${practiceData.bank_name}</div>` : ''}
                <div><span style="font-weight: 600;">Account:</span> ${practiceData.account_number}</div>
                ${practiceData.branch_code ? `<div><span style="font-weight: 600;">Branch:</span> ${practiceData.branch_code}</div>` : ''}
              </div>
            </div>` : '';

      // Import required libraries
      // html2canvas is already imported at the top
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

      // Get all services from all invoices with detailed breakdown
      const allServices: any[] = [];
      filteredInvoices.forEach(invoice => {
        invoice.services.forEach(service => {
          allServices.push({
            ...service,
            invoice_number: invoice.invoice_number,
            invoice_date: invoice.created_at,
            payment_status: invoice.payment_status
          });
        });
      });

      console.log('📋 Total services found:', allServices.length);

      // Create HTML for statement using EXACT invoice/receipt style from screenshot
      const statementHTML = `
        <div style="width: 800px; margin: 0 auto; background: white; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6;">
          
          <!-- Header Section -->
          <div style="padding: 40px 40px 30px 40px; background: white; border-bottom: 2px solid #e5e7eb;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
              <div>
                <!-- EXACT invoice header structure -->
                ${practiceData.logo_url ? `
                  <div style="flex-shrink: 0; margin-bottom: 8px;">
                    <img src="${practiceData.logo_url}" alt="Practice Logo" style="width: 120px; height: auto; max-height: 65px; border-radius: 8px; object-fit: contain;" />
                  </div>
                ` : ''}
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #5f6578; font-family: 'Rubik', sans-serif; letter-spacing: -0.2px;">${practiceData.name}</h1>
              </div>
              <!-- EXACT practice details from invoice -->
              <div style="text-align: right; max-width: 300px;">
                <div style="font-size: 10px; line-height: 1.6; color: #5a5a5a; font-weight: 400;">
                  ${practiceData.address ? `<div style="margin-bottom: 2px;">${practiceData.address}</div>` : ''}
                  ${practiceLocation ? `<div style="margin-bottom: 2px;">${practiceLocation}</div>` : ''}
                  ${practiceData.contact_phone ? `<div style="margin-bottom: 2px;">Tel: ${practiceData.contact_phone}</div>` : ''}
                  ${practiceData.contact_email ? `<div style="margin-bottom: 2px;">Email: ${practiceData.contact_email}</div>` : ''}
                  ${practiceWebsiteText(practiceData) ? `<div>${practiceWebsiteText(practiceData)}</div>` : ''}
                </div>
              </div>
            </div>
            
            <div style="text-align: center; margin-bottom: 30px;">
              <h2 style="margin: 0; font-size: 28px; font-weight: 700; color: #1f2937; font-family: 'Rubik', sans-serif;">ACCOUNT STATEMENT</h2>
              <p style="margin: 8px 0 0 0; font-size: 16px; color: #6b7280; font-weight: 500;">Period: ${label}</p>
            </div>
            
            <!-- Patient Information -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px;">
              <div>
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">Patient Information</h3>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Name:</span> ${patientData.first_name} ${patientData.last_name}</p>
                ${patientData.email ? `<p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Email:</span> ${patientData.email}</p>` : ''}
                ${patientData.cell_number ? `<p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Phone:</span> ${patientData.cell_number}</p>` : ''}
              </div>
              <div>
                <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">Statement Summary</h3>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Total Invoices:</span> ${filteredInvoices.length}</p>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Total Services:</span> ${allServices.length}</p>
                <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Generated:</span> ${format(new Date(), 'dd MMM yyyy')}</p>
              </div>
            </div>
          </div>

          <!-- Services Table - EXACT style from screenshot -->
          <div style="padding: 40px;">
            <table style="width: 100%; border-collapse: collapse; font-family: 'Montserrat', sans-serif;">
              <thead>
                <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                  <th style="padding: 16px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Code</th>
                  <th style="padding: 16px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                  <th style="padding: 16px 12px; text-align: center; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                  <th style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Service Price</th>
                  <th style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Medical Aid</th>
                  <th style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Patient Portion</th>
                </tr>
              </thead>
              <tbody>
                ${allServices.map((service, index) => `
                  <tr style="border-bottom: 1px solid #f3f4f6; ${index % 2 === 0 ? 'background: white;' : 'background: #fafbfc;'}">
                    <td style="padding: 14px 12px; font-size: 14px; font-weight: 600; color: #1f2937;">${service.code}</td>
                    <td style="padding: 14px 12px; font-size: 13px; color: #4b5563; line-height: 1.4;">${service.description}</td>
                    <td style="padding: 14px 12px; text-align: center; font-size: 14px; font-weight: 500; color: #1f2937;">${service.quantity ?? ''}</td>
                    <td style="padding: 14px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">N$ ${service.total_price.toFixed(2)}</td>
                    <td style="padding: 14px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">N$ ${(service.medical_aid_covered || 0).toFixed(2)}</td>
                    <td style="padding: 14px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">N$ ${(service.total_price - (service.medical_aid_covered || 0)).toFixed(2)}</td>
                  </tr>
                `).join('')}
                
                <!-- Subtotal Row -->
                <tr style="background: #f9fafb; border-top: 2px solid #e5e7eb;">
                  <td colspan="5" style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 14px; color: #374151;">Subtotal:</td>
                  <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px; color: #1f2937;">N$ ${totalAmount.toFixed(2)}</td>
                </tr>
                
                <!-- Patient Portion Row -->
                <tr style="background: #fff7ed; border-bottom: 1px solid #fed7aa;">
                  <td colspan="5" style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 14px; color: #ea580c;">Patient Portion:</td>
                  <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px; color: #ea580c;">N$ ${(totalAmount - filteredInvoices.reduce((sum, inv) => sum + (inv.medical_aid_covered || 0), 0)).toFixed(2)}</td>
                </tr>
                
                <!-- Total Invoiced Row (sum of all listed invoices, including paid ones: not an amount due) -->
                <tr style="background: #5f6578;">
                  <td colspan="5" style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 14px; color: white; text-transform: uppercase;">Total Invoiced:</td>
                  <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 18px; color: white;">N$ ${totalAmount.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          ${bankDetailsHTML}

          <!-- Footer Section - EXACT style from screenshot -->
          <div style="padding: 30px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center;">
            <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
              Payment is due within 30 days. Thank you for choosing <strong style="color: #374151;">${practiceData.name}</strong>${practiceContact ? ` For inquiries: ${practiceContact}` : ''}
            </p>
            <div style="margin-top: 15px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px;">
              Statement generated by <strong style="color: #6b7280;">OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
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

      // SMART MULTI-PAGE GENERATION
      console.log('📄 Implementing smart multi-page logic for', allServices.length, 'services');
      
      // Smart pagination logic - first page cuts at 7th row to prevent cutting
      const serviceChunks = [];
      if (allServices.length <= 7) {
        // Single page with footer
        serviceChunks.push(allServices);
        console.log('📑 Single page (≤7 services):', allServices.length);
      } else {
        // First page: 7 services (to prevent cutting), continuation pages: 20 services each
        serviceChunks.push(allServices.slice(0, 7));
        let remaining = allServices.slice(7);
        while (remaining.length > 0) {
          serviceChunks.push(remaining.slice(0, 20));
          remaining = remaining.slice(20);
        }
        console.log('📑 Multi-page: first page = 7, continuation pages of 20, total pages =', serviceChunks.length);
      }

      // Create PDF with proper multi-page support
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      // Generate each page
      for (let pageIndex = 0; pageIndex < serviceChunks.length; pageIndex++) {
        const pageServices = serviceChunks[pageIndex];
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === serviceChunks.length - 1;
        
        console.log(`🏗️ Generating page ${pageIndex + 1}/${serviceChunks.length} with ${pageServices.length} services`);
        
        // Create page-specific HTML
        const pageHTML = `
          <div style="width: 800px; margin: 0 auto; background: white; font-family: 'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6; min-height: 1000px;">
            
            ${isFirstPage ? `
            <!-- Header Section (only on first page) -->
            <div style="padding: 40px 40px 30px 40px; background: white; border-bottom: 2px solid #e5e7eb;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px;">
                <div>
                  ${practiceData.logo_url ? `
                    <div style="flex-shrink: 0; margin-bottom: 8px;">
                      <img src="${practiceData.logo_url}" alt="Practice Logo" style="width: 120px; height: auto; max-height: 65px; border-radius: 8px; object-fit: contain;" />
                    </div>
                  ` : ''}
                  <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #5f6578; font-family: 'Rubik', sans-serif; letter-spacing: -0.2px;">${practiceData.name}</h1>
                </div>
                <div style="text-align: right; max-width: 300px;">
                  <div style="font-size: 10px; line-height: 1.6; color: #5a5a5a; font-weight: 400;">
                    ${practiceData.address ? `<div style="margin-bottom: 2px;">${practiceData.address}</div>` : ''}
                    ${practiceLocation ? `<div style="margin-bottom: 2px;">${practiceLocation}</div>` : ''}
                    ${practiceData.contact_phone ? `<div style="margin-bottom: 2px;">Tel: ${practiceData.contact_phone}</div>` : ''}
                    ${practiceData.contact_email ? `<div style="margin-bottom: 2px;">Email: ${practiceData.contact_email}</div>` : ''}
                    ${practiceWebsiteText(practiceData) ? `<div>${practiceWebsiteText(practiceData)}</div>` : ''}
                  </div>
                </div>
              </div>
              
              <div style="text-align: center; margin-bottom: 30px;">
                <h2 style="margin: 0; font-size: 28px; font-weight: 700; color: #1f2937; font-family: 'Rubik', sans-serif;">ACCOUNT STATEMENT</h2>
                <p style="margin: 8px 0 0 0; font-size: 16px; color: #6b7280; font-weight: 500;">Period: ${label}</p>
              </div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 20px;">
                <div>
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">Patient Information</h3>
                  <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Name:</span> ${patientData.first_name} ${patientData.last_name}</p>
                  ${patientData.email ? `<p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Email:</span> ${patientData.email}</p>` : ''}
                  ${patientData.cell_number ? `<p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Phone:</span> ${patientData.cell_number}</p>` : ''}
                </div>
                <div>
                  <h3 style="margin: 0 0 12px 0; font-size: 16px; font-weight: 600; color: #374151;">Statement Summary</h3>
                  <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Total Invoices:</span> ${filteredInvoices.length}</p>
                  <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Total Services:</span> ${allServices.length}</p>
                  <p style="margin: 0 0 6px 0; font-size: 14px; color: #4b5563;"><span style="font-weight: 600;">Generated:</span> ${format(new Date(), 'dd MMM yyyy')}</p>
                </div>
              </div>
            </div>
            ` : `
            <!-- Continuation Header -->
            <div style="padding: 20px 40px; background: #5f6578; color: white; text-align: center;">
              <h2 style="margin: 0; font-size: 20px; font-weight: 700; font-family: 'Rubik', sans-serif;">ACCOUNT STATEMENT (CONTINUED)</h2>
              <p style="margin: 5px 0 0 0; font-size: 14px;">Page ${pageIndex + 1} of ${serviceChunks.length} • ${patientData.first_name} ${patientData.last_name}</p>
            </div>
            `}

            <!-- Services Table -->
            <div style="padding: 40px;">
              <table style="width: 100%; border-collapse: collapse; font-family: 'Montserrat', sans-serif;">
                <thead>
                  <tr style="background: #f9fafb; border-bottom: 2px solid #e5e7eb;">
                    <th style="padding: 16px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Code</th>
                    <th style="padding: 16px 12px; text-align: left; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Description</th>
                    <th style="padding: 16px 12px; text-align: center; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Qty</th>
                    <th style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Service Price</th>
                    <th style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Medical Aid</th>
                    <th style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 12px; color: #374151; text-transform: uppercase; letter-spacing: 0.5px;">Patient Portion</th>
                  </tr>
                </thead>
                <tbody>
                  ${pageServices.map((service, index) => `
                    <tr style="border-bottom: 1px solid #f3f4f6; ${index % 2 === 0 ? 'background: white;' : 'background: #fafbfc;'}">
                      <td style="padding: 14px 12px; font-size: 14px; font-weight: 600; color: #1f2937;">${service.code}</td>
                      <td style="padding: 14px 12px; font-size: 13px; color: #4b5563; line-height: 1.4;">${service.description}</td>
                      <td style="padding: 14px 12px; text-align: center; font-size: 14px; font-weight: 500; color: #1f2937;">${service.quantity ?? ''}</td>
                      <td style="padding: 14px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">N$ ${service.total_price.toFixed(2)}</td>
                      <td style="padding: 14px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">N$ ${(service.medical_aid_covered || 0).toFixed(2)}</td>
                      <td style="padding: 14px 12px; text-align: right; font-size: 14px; font-weight: 600; color: #1f2937;">N$ ${(service.total_price - (service.medical_aid_covered || 0)).toFixed(2)}</td>
                    </tr>
                  `).join('')}
                  
                  ${isLastPage ? `
                  <!-- Totals (only on last page) -->
                  <tr style="background: #f9fafb; border-top: 2px solid #e5e7eb;">
                    <td colspan="5" style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 14px; color: #374151;">Subtotal:</td>
                    <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px; color: #1f2937;">N$ ${totalAmount.toFixed(2)}</td>
                  </tr>
                  <tr style="background: #fff7ed; border-bottom: 1px solid #fed7aa;">
                    <td colspan="5" style="padding: 16px 12px; text-align: right; font-weight: 600; font-size: 14px; color: #ea580c;">Patient Portion:</td>
                    <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 16px; color: #ea580c;">N$ ${(totalAmount - filteredInvoices.reduce((sum, inv) => sum + (inv.medical_aid_covered || 0), 0)).toFixed(2)}</td>
                  </tr>
                  <tr style="background: #5f6578;">
                    <td colspan="5" style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 14px; color: white; text-transform: uppercase;">Total Invoiced:</td>
                    <td style="padding: 16px 12px; text-align: right; font-weight: 700; font-size: 18px; color: white;">N$ ${totalAmount.toFixed(2)}</td>
                  </tr>
                  ` : ''}
                </tbody>
              </table>
            </div>

            ${isLastPage ? `
            <!-- Banking Details and Footer (only on last page) -->
            ${bankDetailsHTML}
            <div style="padding: 30px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #6b7280;">
                Payment is due within 30 days. Thank you for choosing <strong style="color: #374151;">${practiceData.name}</strong>${practiceContact ? ` For inquiries: ${practiceContact}` : ''}
              </p>
              <div style="margin-top: 15px; font-size: 11px; color: #9ca3af; border-top: 1px solid #f3f4f6; padding-top: 12px;">
                Statement generated by <strong style="color: #6b7280;">OneHealth Systems</strong> • www.onehealthsystems.com • © 2024
              </div>
            </div>
            ` : `
            <!-- Page footer for continuation pages -->
            <div style="padding: 20px 40px; background: #f8fafc; border-top: 1px solid #e5e7eb; text-align: center; margin-top: auto;">
              <p style="margin: 0; font-size: 11px; color: #6b7280;">Page ${pageIndex + 1} of ${serviceChunks.length} • Continued on next page</p>
            </div>
            `}
          </div>
        `;
        
        // Create temporary container for this page
        const pageContainer = document.createElement('div');
        pageContainer.style.position = 'absolute';
        pageContainer.style.left = '-9999px';
        pageContainer.style.top = '-9999px';
        document.body.appendChild(pageContainer);
        pageContainer.innerHTML = pageHTML;

        // Generate canvas for this page
        const canvas = await html2canvas(pageContainer.firstElementChild as HTMLElement, {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          width: 800,
          height: 1000,
          scrollX: 0,
          scrollY: 0
        });
        
        // Clean up page container
        document.body.removeChild(pageContainer);

        // Add page to PDF
        if (pageIndex > 0) {
          pdf.addPage();
        }
        
        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        const imgWidth = pdfWidth;
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        // If image is taller than page, scale it to fit
        if (imgHeight > pdfHeight) {
          const scaledHeight = pdfHeight;
          const scaledWidth = (canvas.width * pdfHeight) / canvas.height;
          pdf.addImage(imgData, 'JPEG', (pdfWidth - scaledWidth) / 2, 0, scaledWidth, scaledHeight, '', 'FAST');
        } else {
          pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight, '', 'FAST');
        }
        
        console.log(`✅ Page ${pageIndex + 1}/${serviceChunks.length} generated successfully`);
      }
      
      // Clean up temp container
      document.body.removeChild(tempContainer);

      // Download the PDF
      pdf.save(`statement-${patientData.first_name}-${patientData.last_name}-${label.replace(/\s+/g, '-')}.pdf`);
      
      console.log('✅ Multi-page statement with EXACT invoice styling generated successfully!');
      
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

  const modalContent = (
    <div 
      className="fixed inset-0" 
      style={{ zIndex: 2147483649 }}
      data-testid="print-statement-modal"
    >
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/60 backdrop-blur-xl" 
        onClick={() => {
          console.log('🔙 Backdrop clicked, closing modal');
          onClose();
        }}
      />
      
      {/* Modal Container */}
      <div className="fixed inset-0 flex items-center justify-center p-4 pointer-events-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            console.log('📱 Modal content clicked, preventing close');
          }}
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Generate Statement</h3>
                <p className="text-purple-100 text-sm">Patient account statement</p>
              </div>
              <button
                onClick={() => {
                  console.log('❌ Close button clicked');
                  onClose();
                }}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                disabled={isGenerating}
                title="Close"
                aria-label="Close"
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
                      onChange={(e) => {
                        console.log('📅 Period changed to:', e.target.value);
                        setSelectedPeriod(e.target.value);
                      }}
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
                Services: {filteredInvoices.reduce((sum, inv) => sum + inv.services.length, 0)} total
              </p>
              <p className="text-sm text-gray-600">
                Total Amount: N$ {filteredInvoices.reduce((sum, inv) => sum + inv.total, 0).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex gap-3 p-6 bg-gray-50 border-t">
            <button
              onClick={() => {
                console.log('🚫 Cancel button clicked');
                onClose();
              }}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                console.log('🖨️ Generate button clicked');
                generateStatementPDF();
              }}
              disabled={isGenerating || filteredInvoices.length === 0}
              title={filteredInvoices.length === 0 ? 'No invoices in the selected period' : undefined}
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
  );

  // Use React Portal to render modal at document.body level
  console.log('🚀 Rendering modal with portal to document.body');
  return createPortal(modalContent, document.body);
};

export default PrintStatementModal;