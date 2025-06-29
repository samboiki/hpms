import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../../lib/supabase';

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
  name: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  logo_url?: string;
}

export const downloadTimesheetPDF = async (timesheet: Timesheet, preview: boolean = false) => {
  try {
    // Fetch practice information through the user's practice_id or user_practice_assignments
    const { data: userData } = await supabase
      .from('users')
      .select(`
        practice_id,
        practices!users_practice_id_fkey (
          name,
          contact_email,
          contact_phone,
          address,
          city,
          country,
          logo_url
        )
      `)
      .eq('id', timesheet.user_id)
      .single();

    let practice: PracticeInfo | null = null;
    
    if (userData?.practices) {
      practice = userData.practices as PracticeInfo;
    } else {
      // Try user_practice_assignments if no direct practice_id
      const { data: assignmentData } = await supabase
        .from('user_practice_assignments')
        .select(`
          practices!user_practice_assignments_practice_id_fkey (
            name,
            contact_email,
            contact_phone,
            address,
            city,
            country,
            logo_url
          )
        `)
        .eq('user_id', timesheet.user_id)
        .eq('is_active', true)
        .single();
        
      if (assignmentData?.practices) {
        practice = assignmentData.practices as PracticeInfo;
      }
    }

    // Create PDF document
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set font
    pdf.setFont('helvetica');

    // Header section
    let yPosition = 20;

    // Practice name as title
    pdf.setFontSize(22);
    pdf.setTextColor(41, 128, 185);
    pdf.text(practice?.name || 'Practice Timesheet', 105, yPosition, { align: 'center' });

    yPosition += 10;

    // Subtitle
    pdf.setFontSize(16);
    pdf.setTextColor(60, 60, 60);
    pdf.text('Employee Timesheet', 105, yPosition, { align: 'center' });

    yPosition += 15;

    // Employee Information Box
    pdf.setDrawColor(200, 200, 200);
    pdf.setFillColor(245, 245, 245);
    pdf.rect(15, yPosition, 180, 30, 'FD');

    pdf.setFontSize(10);
    pdf.setTextColor(0, 0, 0);
    pdf.text('Employee Name:', 20, yPosition + 8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(timesheet.user?.full_name || 'N/A', 55, yPosition + 8);

    pdf.setFont('helvetica', 'normal');
    pdf.text('Email:', 20, yPosition + 16);
    pdf.text(timesheet.user?.email || 'N/A', 55, yPosition + 16);

    pdf.text('Period:', 20, yPosition + 24);
    pdf.setFont('helvetica', 'bold');
    const periodText = `${format(parseISO(timesheet.period_start), 'MMM dd')} - ${format(parseISO(timesheet.period_end), 'MMM dd, yyyy')}`;
    pdf.text(periodText, 55, yPosition + 24);

    // Summary Statistics on the right
    pdf.setFont('helvetica', 'normal');
    pdf.text('Total Hours:', 120, yPosition + 8);
    pdf.setFont('helvetica', 'bold');
    pdf.text(`${timesheet.total_hours.toFixed(1)}`, 150, yPosition + 8);

    pdf.setFont('helvetica', 'normal');
    pdf.text('Regular Hours:', 120, yPosition + 16);
    pdf.text(`${timesheet.regular_hours.toFixed(1)}`, 150, yPosition + 16);

    pdf.text('Overtime Hours:', 120, yPosition + 24);
    pdf.text(`${timesheet.overtime_hours.toFixed(1)}`, 150, yPosition + 24);

    yPosition += 40;

    // Time Entries Table
    const tableData: any[] = [];
    
    if (timesheet.entries && timesheet.entries.length > 0) {
      // Sort entries by date
      const sortedEntries = [...timesheet.entries].sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      sortedEntries.forEach(entry => {
        const date = parseISO(entry.date);
        tableData.push([
          format(date, 'EEE, MMM dd'),
          entry.start_time || '-',
          entry.end_time || '-',
          entry.task_description || '-',
          entry.total_hours.toFixed(1),
          entry.is_overtime ? 'Yes' : 'No'
        ]);
      });
    }

    // Add table
    autoTable(pdf, {
      startY: yPosition,
      head: [['Date', 'Start Time', 'End Time', 'Comments', 'Hours', 'Overtime']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245]
      },
      columnStyles: {
        0: { cellWidth: 35 },
        1: { cellWidth: 25 },
        2: { cellWidth: 25 },
        3: { cellWidth: 60 },
        4: { cellWidth: 20, halign: 'center' },
        5: { cellWidth: 20, halign: 'center' }
      }
    });

    // Get the final Y position after the table
    const finalY = (pdf as any).lastAutoTable.finalY + 20;

    // Signature Section
    pdf.setDrawColor(200, 200, 200);
    
    // Employee Signature
    pdf.line(15, finalY, 85, finalY);
    pdf.setFontSize(10);
    pdf.text('Employee Signature', 50, finalY + 5, { align: 'center' });
    pdf.text('Date: _____________', 50, finalY + 10, { align: 'center' });

    // Supervisor Signature
    pdf.line(125, finalY, 195, finalY);
    pdf.text('Supervisor Signature', 160, finalY + 5, { align: 'center' });
    pdf.text('Date: _____________', 160, finalY + 10, { align: 'center' });

    // Footer
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    const footerY = 280;
    pdf.text(`Generated on ${format(new Date(), 'MMM dd, yyyy')}`, 105, footerY, { align: 'center' });
    
    if (practice) {
      const contactInfo = [];
      if (practice.contact_email) contactInfo.push(practice.contact_email);
      if (practice.contact_phone) contactInfo.push(practice.contact_phone);
      if (contactInfo.length > 0) {
        pdf.text(contactInfo.join(' | '), 105, footerY + 5, { align: 'center' });
      }
    }

    // Save or preview the PDF
    if (preview) {
      // Open in new window for print preview
      const pdfBlob = pdf.output('blob');
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, '_blank');
    } else {
      // Download the PDF
      const filename = `timesheet_${timesheet.user?.full_name?.replace(/\s+/g, '_')}_${format(parseISO(timesheet.period_start), 'MMM_yyyy')}.pdf`;
      pdf.save(filename);
    }

    return pdf;
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw error;
  }
};