import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';

interface TimesheetEntry {
  id?: string;
  date: string;
  start_time?: string;
  end_time?: string;
  total_hours: number;
  task_description?: string;
  is_overtime: boolean;
  is_holiday?: boolean;
}

interface Timesheet {
  id: string;
  user_id: string;
  period_start: string;
  period_end: string;
  total_hours: number;
  regular_hours: number;
  overtime_hours: number;
  status: string;
  user?: {
    full_name: string;
    email: string;
  };
  entries?: TimesheetEntry[];
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
}

interface TimesheetPDFGeneratorProps {
  timesheet: Timesheet;
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

const TimesheetPDFGenerator: React.FC<TimesheetPDFGeneratorProps> = ({
  timesheet,
  onGenerating
}) => {
  const timesheetRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const currency = practice?.country === 'Namibia' ? 'N$' : '$';
  
  // Header color
  const headerColor = '#535d8e';
  
  // Fetch practice details from database
  useEffect(() => {
    const fetchPracticeData = async () => {
      if (!user?.id) return;
      
      try {
        // Get user's practice_id - first try user metadata, then direct property
        let practiceId = (user as { practice_id?: string }).practice_id;
        
        if (!practiceId && (user as { user_metadata?: { practice_id?: string } }).user_metadata?.practice_id) {
          practiceId = (user as { user_metadata: { practice_id: string } }).user_metadata.practice_id;
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
        setPractice(practiceData as PracticeInfo);
        
      } catch (error) {
        console.error('Error fetching practice data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPracticeData();
  }, [user?.id, (user as { practice_id?: string })?.practice_id, (user as { user_metadata?: { practice_id?: string } })?.user_metadata?.practice_id]);

  // Auto-generate PDF when practice data is loaded
  useEffect(() => {
    if (!loading && practice) {
      generatePDF();
    }
  }, [loading, practice]);

  const generatePDF = async () => {
    if (!practice) {
      console.error('❌ Cannot generate PDF: Practice data not loaded');
      toast.error('Practice data not loaded. Please try again.');
      return;
    }

    if (!timesheet.entries || timesheet.entries.length === 0) {
      console.warn('⚠️ No timesheet entries found');
    }

    onGenerating?.(true);
    
    try {
      console.log('🎯 Starting enhanced timesheet PDF generation...');
      console.log('📊 Timesheet data:', {
        id: timesheet.id,
        period: `${timesheet.period_start} to ${timesheet.period_end}`,
        entries: timesheet.entries?.length || 0,
        user: timesheet.user?.full_name
      });

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
      
      // Table constants
      const tableStartY = headerHeight + margin + 60; // After header + employee details
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

        // Timesheet title and period (right side)
        pdf.setFontSize(12);
        pdf.setFont('helvetica', 'bold');
        pdf.text('TIMESHEET', pageWidth - margin - 35, 15);
        
        pdf.setFontSize(9);
        pdf.setFont('helvetica', 'normal');
        const periodText = `${format(parseISO(timesheet.period_start), 'MMM dd')} - ${format(parseISO(timesheet.period_end), 'MMM dd, yyyy')}`;
        pdf.text(periodText, pageWidth - margin - 35, 22);
        
        // Page number
        pdf.text(`Page ${pageNum} of ${totalPages}`, pageWidth - margin - 35, 28);
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
        
        // Generated date (right side)
        pdf.text(`Generated on ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, pageWidth - margin - 60, footerY + 8);
      };

      // Sort entries by date
      const sortedEntries = timesheet.entries ? [...timesheet.entries].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      ) : [];

      // Calculate total pages needed
      const totalPages = Math.max(1, Math.ceil(sortedEntries.length / maxRowsPerPage));

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

        // First page: Add employee details and summary
        if (pageNum === 1) {
          // Employee information section
          pdf.setFontSize(11);
          pdf.setTextColor(0, 0, 0);
          pdf.setFont('helvetica', 'bold');
          pdf.text('Employee Information:', margin, currentY);
          
          pdf.setFont('helvetica', 'normal');
          pdf.setFontSize(10);
          currentY += 6;
          pdf.text(`Name: ${timesheet.user?.full_name || 'N/A'}`, margin, currentY);
          currentY += 5;
          
          if (timesheet.user?.email) {
            pdf.text(`Email: ${timesheet.user.email}`, margin, currentY);
            currentY += 5;
          }
          
          pdf.text(`Status: ${timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}`, margin, currentY);

          // Summary statistics (right side)
          const summaryX = pageWidth - margin - 80;
          let summaryY = headerHeight + margin + 16;
          
          pdf.setFillColor(243, 244, 246);
          pdf.rect(summaryX - 5, summaryY - 6, 85, 35, 'F');
          
          pdf.setFont('helvetica', 'bold');
          pdf.text('Total Hours:', summaryX, summaryY);
          pdf.setFont('helvetica', 'normal');
          pdf.text(`${timesheet.total_hours.toFixed(1)}h`, summaryX + 40, summaryY);
          summaryY += 10;
          
          pdf.text('Regular Hours:', summaryX, summaryY);
          pdf.text(`${timesheet.regular_hours.toFixed(1)}h`, summaryX + 40, summaryY);
          summaryY += 10;
          
          pdf.text('Overtime Hours:', summaryX, summaryY);
          pdf.text(`${timesheet.overtime_hours.toFixed(1)}h`, summaryX + 40, summaryY);

          currentY += 20;
        }

        // Time entries table header
        const tableY = pageNum === 1 ? currentY : headerHeight + margin + 10;
        
        // Table header background
        pdf.setFillColor(83, 93, 142); // Using the header color
        pdf.rect(margin, tableY, contentWidth, rowHeight, 'F');
        
        // Table header text
        pdf.setFontSize(9);
        pdf.setTextColor(255, 255, 255);
        pdf.setFont('helvetica', 'bold');
        
        const colWidths = {
          date: 35,
          startTime: 25,
          endTime: 25,
          description: 60,
          hours: 20,
          type: 20
        };
        
        let colX = margin + 2;
        pdf.text('Date', colX, tableY + 5);
        colX += colWidths.date;
        pdf.text('Start Time', colX, tableY + 5);
        colX += colWidths.startTime;
        pdf.text('End Time', colX, tableY + 5);
        colX += colWidths.endTime;
        pdf.text('Comments', colX, tableY + 5);
        colX += colWidths.description;
        pdf.text('Hours', colX, tableY + 5);
        colX += colWidths.hours;
        pdf.text('Type', colX, tableY + 5);

        // Entries for this page
        const startIndex = (pageNum - 1) * maxRowsPerPage;
        const endIndex = Math.min(startIndex + maxRowsPerPage, sortedEntries.length);
        const pageEntries = sortedEntries.slice(startIndex, endIndex);

        // Table rows
        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(0, 0, 0);
        let rowY = tableY + rowHeight;
        
        pageEntries.forEach((entry, index) => {
          // Alternate row background
          if (index % 2 === 1) {
            pdf.setFillColor(248, 249, 250);
            pdf.rect(margin, rowY, contentWidth, rowHeight, 'F');
          }
          
          let colX = margin + 2;
          
          // Date
          pdf.text(format(parseISO(entry.date), 'EEE, MMM dd'), colX, rowY + 5);
          colX += colWidths.date;
          
          // Start time
          pdf.text(entry.start_time || '-', colX, rowY + 5);
          colX += colWidths.startTime;
          
          // End time
          pdf.text(entry.end_time || '-', colX, rowY + 5);
          colX += colWidths.endTime;
          
          // Description (truncate if too long)
          const maxDescLength = 40;
          const description = entry.task_description || '-';
          const truncatedDesc = description.length > maxDescLength 
            ? description.substring(0, maxDescLength) + '...'
            : description;
          pdf.text(truncatedDesc, colX, rowY + 5);
          colX += colWidths.description;
          
          // Hours
          pdf.text(entry.total_hours.toFixed(1), colX, rowY + 5);
          colX += colWidths.hours;
          
          // Type (Regular/Overtime/Holiday)
          let typeText = 'Regular';
          let typeColor = [0, 0, 0];
          if (entry.is_holiday) {
            typeText = 'Holiday';
            typeColor = [59, 130, 246]; // Blue
          } else if (entry.is_overtime) {
            typeText = 'Overtime';
            typeColor = [249, 115, 22]; // Orange
          }
          
          pdf.setTextColor(typeColor[0], typeColor[1], typeColor[2]);
          pdf.text(typeText, colX, rowY + 5);
          pdf.setTextColor(0, 0, 0); // Reset to black
          
          rowY += rowHeight;
        });

        // Last page: Add signature sections
        if (pageNum === totalPages) {
          rowY += 20;
          
          // Signature section background
          pdf.setFillColor(249, 250, 251);
          pdf.rect(margin, rowY - 5, contentWidth, 40, 'F');
          
          // Signature lines
          pdf.setDrawColor(200, 200, 200);
          
          // Employee Signature
          const sig1X = margin + 10;
          pdf.line(sig1X, rowY + 20, sig1X + 60, rowY + 20);
          pdf.setFontSize(9);
          pdf.text('Employee Signature', sig1X + 30, rowY + 25, { align: 'center' });
          pdf.text(`Date: ${format(new Date(), 'dd/MM/yyyy')}`, sig1X + 30, rowY + 30, { align: 'center' });
          
          // Supervisor Signature
          const sig2X = pageWidth - margin - 70;
          pdf.line(sig2X, rowY + 20, sig2X + 60, rowY + 20);
          pdf.text('Supervisor Signature', sig2X + 30, rowY + 25, { align: 'center' });
          pdf.text('Date: _____________', sig2X + 30, rowY + 30, { align: 'center' });
        }
      }

      // Save the PDF
      const filename = `timesheet_${timesheet.user?.full_name?.replace(/\s+/g, '_')}_${format(parseISO(timesheet.period_start), 'MMM_yyyy')}.pdf`;
      pdf.save(filename);
      
      console.log('✅ Enhanced timesheet PDF generated successfully');
    } catch (error) {
      console.error('❌ Timesheet PDF generation failed:', error);
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
      {/* Auto-generating PDF message */}
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600 mx-auto mb-4"></div>
          <div className="text-gray-600 font-medium">Generating your timesheet PDF...</div>
          <div className="text-sm text-gray-500 mt-2">The download will start automatically</div>
        </div>
      </div>

      {/* Timesheet Content - Hidden but rendered for visual PDF generation */}
      <div
        ref={timesheetRef}
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
        {/* Watermark for approved timesheets */}
        {timesheet.status === 'approved' && (
          <div
            style={{
              position: 'absolute',
              top: '45%',
              left: '30%',
              fontSize: '60px',
              color: '#f3f4f6',
              fontWeight: '700',
              opacity: 0.15,
              transform: 'rotate(-45deg)',
              pointerEvents: 'none',
              zIndex: 1
            }}
          >
            APPROVED
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
                Employee Timesheet Report
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
            </div>
          </div>

          <div
            style={{
              flex: 1,
              maxWidth: '40%',
              textAlign: 'right'
            }}
          >
            {/* Timesheet Title and Period */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px'
              }}
            >
              {/* TIMESHEET Title */}
              <div
                style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: '#ffffff',
                  letterSpacing: '1px'
                }}
              >
                TIMESHEET
              </div>
              
              {/* Period */}
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: '500',
                  color: '#ffffff'
                }}
              >
                {format(parseISO(timesheet.period_start), 'MMMM yyyy')}
              </div>
              
              {/* Date Range */}
              <div
                style={{
                  fontSize: '10px',
                  color: 'rgba(255,255,255,0.9)'
                }}
              >
                {format(parseISO(timesheet.period_start), 'MMM dd')} - {format(parseISO(timesheet.period_end), 'MMM dd, yyyy')}
              </div>
            </div>
          </div>
        </div>

        {/* Employee Information */}
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
              Employee Details
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
                {timesheet.user?.full_name || 'N/A'}
              </div>
              {timesheet.user?.email && <div>Email: {timesheet.user.email}</div>}
              <div>Status: {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}</div>
            </div>
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: '8px',
              padding: '15px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
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
              Hours Summary
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#4b5563',
                lineHeight: '1.8'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Total Hours:</span>
                <span style={{ fontWeight: '600', color: '#1f2937' }}>{timesheet.total_hours.toFixed(1)}h</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Regular Hours:</span>
                <span style={{ fontWeight: '600', color: '#16a34a' }}>{timesheet.regular_hours.toFixed(1)}h</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Overtime Hours:</span>
                <span style={{ fontWeight: '600', color: '#ea580c' }}>{timesheet.overtime_hours.toFixed(1)}h</span>
              </div>
            </div>
          </div>
        </div>

        {/* Time Entries Table */}
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
            Time Entries
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
                    width: '20%'
                  }}
                >
                  Date
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
                    width: '15%'
                  }}
                >
                  Start Time
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
                    width: '15%'
                  }}
                >
                  End Time
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
                    width: '30%'
                  }}
                >
                  Comments
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
                    width: '10%'
                  }}
                >
                  Hours
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
                    width: '10%'
                  }}
                >
                  Type
                </th>
              </tr>
            </thead>
            <tbody>
              {timesheet.entries && timesheet.entries.length > 0 ? (
                [...timesheet.entries]
                  .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((entry, index) => (
                    <tr
                      key={entry.id || index}
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
                          fontWeight: '500'
                        }}
                      >
                        {format(parseISO(entry.date), 'EEE, MMM dd')}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          fontSize: '11px',
                          color: '#4b5563'
                        }}
                      >
                        {entry.start_time || '-'}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          fontSize: '11px',
                          color: '#4b5563'
                        }}
                      >
                        {entry.end_time || '-'}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          fontSize: '11px',
                          color: '#4b5563'
                        }}
                      >
                        {entry.task_description || '-'}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          fontSize: '11px',
                          color: '#1f2937',
                          textAlign: 'center',
                          fontWeight: '600'
                        }}
                      >
                        {entry.total_hours.toFixed(1)}
                      </td>
                      <td
                        style={{
                          padding: '10px',
                          fontSize: '11px',
                          textAlign: 'center'
                        }}
                      >
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '500',
                            backgroundColor: entry.is_holiday ? '#dbeafe' : entry.is_overtime ? '#ffedd5' : '#d1fae5',
                            color: entry.is_holiday ? '#1e40af' : entry.is_overtime ? '#c2410c' : '#047857'
                          }}
                        >
                          {entry.is_holiday ? 'Holiday' : entry.is_overtime ? 'Overtime' : 'Regular'}
                        </span>
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: '20px',
                      textAlign: 'center',
                      color: '#6b7280',
                      fontSize: '11px'
                    }}
                  >
                    No time entries recorded
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div
          style={{
            marginTop: '40px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #e5e7eb'
          }}
        >
          <div
            style={{
              fontSize: '11px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '20px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Approval Signatures
          </div>
          
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '40px'
            }}
          >
            {/* Employee Signature */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  borderBottom: '2px solid #d1d5db',
                  paddingBottom: '20px',
                  marginBottom: '8px'
                }}
              >
                &nbsp;
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  textAlign: 'center'
                }}
              >
                Employee Signature
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#9ca3af',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                Date: {format(new Date(), 'dd/MM/yyyy')}
              </div>
            </div>

            {/* Supervisor Signature */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  borderBottom: '2px solid #d1d5db',
                  paddingBottom: '20px',
                  marginBottom: '8px'
                }}
              >
                &nbsp;
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#6b7280',
                  textAlign: 'center'
                }}
              >
                Supervisor Signature
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#9ca3af',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                Date: _______________
              </div>
            </div>
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
              Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}
              <br />
              {practice.license_number && `License: ${practice.license_number}`}
              {practice.tax_number && ` • Tax No: ${practice.tax_number}`}
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

export default TimesheetPDFGenerator;