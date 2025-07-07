import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

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

interface PracticeInfo {
  id: string;
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  logo_url?: string;
  license_number?: string;
  tax_number?: string;
  practice_number?: string;
  primary_color?: string;
  bank_name?: string;
  account_number?: string;
  branch_code?: string;
  swift_code?: string;
  // Note: This should be populated from practices table using user_id link
}

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  medicalAidShortName?: string;
  membershipNumber?: string;
}

interface Html2CanvasPDFProps {
  invoice: Invoice;
  patient: PatientInfo;
  onGenerating?: (generating: boolean) => void;
}

// Load Montserrat font CSS
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
`;

// Add font style to document head if not already added
if (!document.getElementById('montserrat-font')) {
  const style = document.createElement('style');
  style.id = 'montserrat-font';
  style.textContent = fontStyle;
  document.head.appendChild(style);
}

const Html2CanvasPDF: React.FC<Html2CanvasPDFProps> = ({
  invoice,
  patient,
  onGenerating
}) => {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const currency = practice?.country === 'Namibia' ? 'N$' : '$';
  
  // Header color
  const headerColor = '#80788a';
  
  // Fetch practice details from database
  useEffect(() => {
    const fetchPracticeData = async () => {
      if (!user?.id) return;
      
      try {
        // Get user's practice_id - first try user metadata, then direct property
        let practiceId = user.practice_id;
        
        if (!practiceId && user.user_metadata?.practice_id) {
          practiceId = user.user_metadata.practice_id;
        }
        
        if (!practiceId) {
          console.error('No practice_id found for user');
          return;
        }
        
        console.log('Fetching practice data for practice_id:', practiceId);
        
        // Get practice details from practices table
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select(`
            id, name, contact_email, contact_phone, address, city, country,
            postal_code, logo_url, primary_color, tax_number, license_number,
            bank_name, account_number, branch_code, swift_code
          `)
          .eq('id', practiceId)
          .single();
          
        if (practiceError) {
          console.error('Error fetching practice data:', practiceError);
          return;
        }
        
        console.log('Practice data fetched:', practiceData);
        
        // Get medical aid short name if patient has medical aid
        let medicalAidShortName = null;
        if (patient.medicalAidProvider) {
          const { data: medicalAidData } = await supabase
            .from('medical_aid_providers')
            .select('short_name')
            .ilike('name', patient.medicalAidProvider)
            .single();
            
          medicalAidShortName = medicalAidData?.short_name;
          console.log('Medical aid short name:', medicalAidShortName);
        }
        
        setPractice({
          ...practiceData,
          medicalAidShortName
        } as PracticeInfo & { medicalAidShortName?: string });
        
      } catch (error) {
        console.error('Error fetching practice data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPracticeData();
  }, [user?.id, user?.practice_id, user?.user_metadata?.practice_id, patient.medicalAidProvider]);

  const generatePDF = async () => {
    if (!practice) return;

    onGenerating?.(true);
    
    try {
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
      const grayColor = '#6B7280';
      const lightGrayColor = '#F3F4F6';

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

      // Calculate total pages needed
      const totalPages = Math.max(1, Math.ceil(invoice.services.length / maxRowsPerPage));

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
          pdf.text(patient.name, margin, currentY);
          currentY += 5;
          
          if (patient.phone) {
            pdf.text(`Phone: ${patient.phone}`, margin, currentY);
            currentY += 4;
          }
          
          if (patient.email) {
            pdf.text(`Email: ${patient.email}`, margin, currentY);
            currentY += 4;
          }
          
          if (patient.medicalAidProvider && patient.membershipNumber) {
            pdf.text(`Medical Aid: ${patient.medicalAidProvider} - ${patient.membershipNumber}`, margin, currentY);
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
        const endIndex = Math.min(startIndex + maxRowsPerPage, invoice.services.length);
        const pageServices = invoice.services.slice(startIndex, endIndex);

        // Table rows
        pdf.setFont('helvetica', 'normal');
        let rowY = tableY + rowHeight;
        
        pageServices.forEach((service, index) => {
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

      // Save the PDF
      pdf.save(`invoice-${invoice.invoice_number}.pdf`);
      
      console.log('✅ Enhanced multi-page PDF generated successfully');
    } catch (error) {
      console.error('❌ Enhanced PDF generation failed:', error);
      throw new Error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      onGenerating?.(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-gray-600">Loading practice details...</div>
      </div>
    );
  }
  
  if (!practice) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-red-600">Error: Could not load practice details</div>
      </div>
    );
  }

  return (
    <div>
      {/* PDF Generation Button */}
      <div className="space-y-3 mb-4">
        <button
          onClick={generatePDF}
          className="bg-cyan-600 hover:bg-cyan-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download Enhanced Multi-Page PDF
        </button>
        
        <div className="text-sm text-gray-600">
          <p>✨ Enhanced Features:</p>
          <ul className="list-disc list-inside mt-1 space-y-1">
            <li>Professional multi-page layout with proper pagination</li>
            <li>Headers and footers on every page</li>
            <li>Page numbering (Page X of Y)</li>
            <li>Proper table continuation across pages</li>
            <li>Practice branding and colors</li>
            <li>Searchable text (not image-based)</li>
          </ul>
        </div>
      </div>

      {/* Invoice Content - Hidden but rendered for PDF generation */}
      <div
        ref={invoiceRef}
        style={{
          width: '794px', // A4 width at 96 DPI
          minHeight: '1123px', // A4 height at 96 DPI
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.4',
          color: '#333',
          backgroundColor: '#ffffff',
          padding: '40px',
          margin: '0 auto',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Watermark for paid invoices */}
        {invoice.payment_status === 'paid' && (
          <div
            style={{
              position: 'absolute',
              top: '45%',
              left: '35%',
              fontSize: '60px',
              color: '#f3f4f6',
              fontWeight: '700',
              opacity: 0.15,
              transform: 'rotate(-45deg)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            PAID
          </div>
        )}

        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '35px',
            paddingBottom: '20px',
            paddingTop: '15px',
            paddingLeft: '20px',
            paddingRight: '20px',
            marginLeft: '-40px',
            marginRight: '-40px',
            marginTop: '-40px',
            background: headerColor,
            zIndex: 2,
            position: 'relative'
          }}
        >
          <div style={{ flex: 1, maxWidth: '55%' }}>
            <div style={{ flex: 1, marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: '#ffffff',
                  marginBottom: '4px'
                }}
              >
                {practice.name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: '6px',
                  fontWeight: '400'
                }}
              >
                Excellence in Healthcare
              </div>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#ffffff',
                lineHeight: '1.5',
                fontWeight: '500'
              }}
            >
              {practice.address && <div>{practice.address}</div>}
              {practice.city && practice.country && (
                <div>{practice.city}, {practice.country} {practice.postal_code || ''}</div>
              )}
              {practice.contact_phone && <div>Tel: {practice.contact_phone}</div>}
              {practice.contact_email && <div>Email: {practice.contact_email}</div>}
              {practice.practice_number && <div>Practice No: {practice.practice_number}</div>}
              {practice.license_number && <div>License: {practice.license_number}</div>}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              maxWidth: '40%',
              textAlign: 'right'
            }}
          >
            {/* Single row with MEDICAL INVOICE, Invoice Number and Dates */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px'
              }}
            >
              {/* MEDICAL INVOICE Title */}
              <div style={{ display: 'flex' }}>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#ffffff',
                    letterSpacing: '1px'
                  }}
                >
                  MEDICAL{' '}
                </span>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: '500',
                    color: 'rgba(255,255,255,0.8)',
                    letterSpacing: '1px'
                  }}
                >
                  INVOICE
                </span>
              </div>
              
              {/* Invoice Number */}
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#ffffff'
                }}
              >
                #{invoice.invoice_number}
              </div>
              
              {/* Date Row in single line */}
              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                  fontSize: '9px',
                  color: '#ffffff'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '2px', fontSize: '8px' }}>DATE</div>
                  <div style={{ fontWeight: '600' }}>{format(parseISO(invoice.created_at), 'dd MMM yyyy')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '2px', fontSize: '8px' }}>PREPARED</div>
                  <div style={{ fontWeight: '600' }}>{format(parseISO(invoice.created_at), 'dd MMM yyyy')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '2px', fontSize: '8px' }}>DUE DATE</div>
                  <div style={{ fontWeight: '600' }}>{format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'dd MMM yyyy')}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PREPARED FOR Title */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          PREPARED FOR
        </div>

        {/* Billing Information */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '20px'
          }}
        >
          <div
            style={{
              flex: 1,
              borderRadius: '8px',
              padding: '15px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Bill To
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#4b5563',
                lineHeight: '1.5'
              }}
            >
              <div
                style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '3px',
                  fontSize: '10px'
                }}
              >
                {patient.name}
              </div>
              {patient.phone && <div>Phone: {patient.phone}</div>}
              {patient.email && <div>Email: {patient.email}</div>}
              {patient.address && <div>{patient.address}</div>}
            </div>
          </div>

          {patient.medicalAidProvider && (
            <div
              style={{
                flex: 1,
                borderRadius: '8px',
                padding: '15px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Medical Aid Details
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#4b5563',
                  lineHeight: '1.5'
                }}
              >
                <div
                  style={{
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '3px',
                    fontSize: '10px'
                  }}
                >
                  {(practice as PracticeInfo & { medicalAidShortName?: string })?.medicalAidShortName || patient.medicalAidShortName || patient.medicalAidProvider}
                </div>
                {patient.membershipNumber && (
                  <div>Member No: {patient.membershipNumber}</div>
                )}
                <div
                  style={{
                    marginTop: '5px',
                    color: '#374151',
                    fontWeight: 'bold'
                  }}
                >
                  Coverage: {currency} {invoice.medical_aid_covered.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Visit Information */}
        {invoice.visit_date && (
          <div
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '12px',
              marginBottom: '20px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '5px'
              }}
            >
              Visit #{invoice.visit_number} - {format(parseISO(invoice.visit_date), 'dd MMMM yyyy')}
            </div>
            {invoice.chief_complaint && (
              <div
                style={{
                  fontSize: '9px',
                  color: '#4b5563',
                  lineHeight: '1.4'
                }}
              >
                Chief Complaint: {invoice.chief_complaint}
              </div>
            )}
          </div>
        )}

        {/* Services Table */}
        <div style={{ marginBottom: '25px' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
              paddingBottom: '4px',
              borderBottom: '1px solid #e5e7eb',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Services
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#535d8e' }}>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'left',
                    width: '12%'
                  }}
                >
                  Code
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'left',
                    width: '50%'
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'center',
                    width: '8%'
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'right',
                    width: '10%'
                  }}
                >
                  Unit Price
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'right',
                    width: '10%'
                  }}
                >
                  Med Aid
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'right',
                    width: '10%'
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.services.map((service, index) => (
                <tr
                  key={service.id}
                  style={{
                    backgroundColor: index % 2 === 1 ? '#f9fafb' : 'transparent',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                >
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#1f2937',
                      fontWeight: '600'
                    }}
                  >
                    {service.code}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#4b5563'
                    }}
                  >
                    {service.description}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#4b5563',
                      textAlign: 'center'
                    }}
                  >
                    {service.quantity}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#4b5563',
                      textAlign: 'right',
                      fontWeight: '600'
                    }}
                  >
                    {currency} {service.unit_price.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#374151',
                      textAlign: 'right',
                      fontWeight: '600'
                    }}
                  >
                    {currency} {service.medical_aid_covered.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#1f2937',
                      textAlign: 'right',
                      fontWeight: '600'
                    }}
                  >
                    {currency} {service.total_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary */}
        <div
          style={{
            marginTop: '20px',
            marginLeft: 'auto',
            width: '55%'
          }}
        >
          <div
            style={{
              backgroundColor: '#f9fafb',
              borderRadius: '8px',
              padding: '15px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '5px 10px'
              }}
            >
              <span style={{ fontSize: '10px', color: '#4b5563' }}>Subtotal:</span>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: '600',
                  color: '#1f2937'
                }}
              >
                {currency} {invoice.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
              </span>
            </div>


            <div
              style={{
                backgroundColor: '#535d8e',
                margin: '-15px -15px -15px -15px',
                marginTop: '10px',
                padding: '10px 20px',
                borderRadius: '0 0 8px 8px'
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '5px 10px'
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    color: '#ffffff',
                    fontWeight: '600',
                    textTransform: 'uppercase'
                  }}
                >
                  Total Amount Due:
                </span>
                <span
                  style={{
                    fontSize: '14px',
                    fontWeight: '700',
                    color: '#ffffff'
                  }}
                >
                  {currency} {invoice.total.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Banking Details */}
        <div
          style={{
            marginTop: '20px',
            marginBottom: '20px'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}
          >
            Banking Details
          </div>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '15px',
              padding: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              backgroundColor: '#ffffff'
            }}
          >
            {practice.bank_name && (
              <div style={{ width: '48%', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '8px', color: '#6b7280', width: '40%' }}>Bank:</span>
                <span style={{ fontSize: '8px', color: '#1f2937', fontWeight: '600', width: '60%' }}>
                  {practice.bank_name}
                </span>
              </div>
            )}
            {practice.account_number && (
              <div style={{ width: '48%', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '8px', color: '#6b7280', width: '40%' }}>Account:</span>
                <span style={{ fontSize: '8px', color: '#1f2937', fontWeight: '600', width: '60%' }}>
                  {practice.account_number}
                </span>
              </div>
            )}
            {practice.branch_code && (
              <div style={{ width: '48%', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '8px', color: '#6b7280', width: '40%' }}>Branch:</span>
                <span style={{ fontSize: '8px', color: '#1f2937', fontWeight: '600', width: '60%' }}>
                  {practice.branch_code}
                </span>
              </div>
            )}
            {practice.swift_code && (
              <div style={{ width: '48%', display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ fontSize: '8px', color: '#6b7280', width: '40%' }}>SWIFT:</span>
                <span style={{ fontSize: '8px', color: '#1f2937', fontWeight: '600', width: '60%' }}>
                  {practice.swift_code}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '9px',
                color: '#6b7280',
                lineHeight: '1.5'
              }}
            >
              Payment is due within 30 days. Thank you for choosing{' '}
              <span style={{ color: '#374151', fontWeight: '600' }}>{practice.name}</span>
              <br />
              For inquiries: {practice.contact_phone} • {practice.contact_email}
            </div>
          </div>
          {practice.logo_url && (
            <div style={{ marginLeft: '20px' }}>
              <img
                src={practice.logo_url}
                alt="Practice Logo"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px'
                }}
              />
            </div>
          )}
        </div>

        {/* Page Number */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '0',
            right: '0',
            textAlign: 'center',
            fontSize: '8px',
            color: '#6b7280'
          }}
        >
          Page 1 of 1
        </div>
      </div>
    </div>
  );
};

export default Html2CanvasPDF;