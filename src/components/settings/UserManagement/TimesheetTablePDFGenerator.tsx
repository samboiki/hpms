import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { Icon } from '@iconify/react';

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

interface TimesheetTablePDFGeneratorProps {
  timesheet: Timesheet;
  onGenerating?: (generating: boolean) => void;
  onGenerated?: () => void;
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

// Get holiday name helper
const getHolidayName = (date: string): string | null => {
  const monthDay = date.substring(5);
  const year = parseInt(date.substring(0, 4));
  
  const holidayMap: Record<string, string> = {
    '01-01': "New Year's Day",
    '03-21': 'Independence Day',
    '05-01': "Workers' Day",
    '05-04': 'Cassinga Day',
    '05-25': 'Africa Day',
    '08-26': "Heroes' Day",
    '09-10': 'Day of the Namibian Child',
    '12-10': 'International Human Rights Day',
    '12-25': 'Christmas Day',
    '12-26': 'Family Day',
  };
  
  // Handle moveable holidays
  const moveableHolidays: Record<number, Record<string, string>> = {
    2024: { '03-29': 'Good Friday', '04-01': 'Easter Monday', '05-09': 'Ascension Day' },
    2025: { '04-18': 'Good Friday', '04-21': 'Easter Monday', '05-29': 'Ascension Day' },
    2026: { '04-03': 'Good Friday', '04-06': 'Easter Monday', '05-14': 'Ascension Day' },
    2027: { '03-26': 'Good Friday', '03-29': 'Easter Monday', '05-06': 'Ascension Day' },
    2028: { '04-14': 'Good Friday', '04-17': 'Easter Monday', '05-25': 'Ascension Day' },
  };
  
  if (moveableHolidays[year] && moveableHolidays[year][monthDay]) {
    return moveableHolidays[year][monthDay];
  }
  
  return holidayMap[monthDay] || null;
};

const TimesheetTablePDFGenerator: React.FC<TimesheetTablePDFGeneratorProps> = ({
  timesheet,
  onGenerating,
  onGenerated
}) => {
  const timesheetRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Header color
  const headerColor = '#535d8e';
  
  // Fetch practice details from database
  useEffect(() => {
    const fetchPracticeData = async () => {
      if (!user?.id) return;
      
      try {
        // Get user's practice_id
        let practiceId = (user as { practice_id?: string }).practice_id;
        
        if (!practiceId && (user as { user_metadata?: { practice_id?: string } }).user_metadata?.practice_id) {
          practiceId = (user as { user_metadata: { practice_id: string } }).user_metadata.practice_id;
        }
        
        if (!practiceId) {
          console.error('No practice_id found for user');
          return;
        }
        
        // Get practice details
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
        
        setPractice(practiceData as PracticeInfo);
        
      } catch (error) {
        console.error('Error fetching practice data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPracticeData();
  }, [user]);

  const generatePDF = async () => {
    if (!practice) {
      console.error('❌ Cannot generate PDF: Practice data not loaded');
      toast.error('Practice data not loaded. Please try again.');
      return;
    }

    onGenerating?.(true);
    setGenerating(true);
    
    try {
      console.log('🎯 Starting table timesheet PDF generation...');
      console.log('📅 Timesheet period:', {
        start: timesheet.period_start,
        end: timesheet.period_end,
        totalEntries: timesheet.entries?.length || 0
      });

      // Wait for content to render
      await new Promise(resolve => setTimeout(resolve, 100));

      const element = timesheetRef.current;
      if (!element) {
        throw new Error('Timesheet element not found');
      }

      // Generate canvas
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 210; // A4 width in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add pages if content is too long
      let heightLeft = imgHeight;
      let position = 0;
      
      while (heightLeft > 0) {
        if (position !== 0) {
          pdf.addPage();
        }
        
        const pageHeight = 297; // A4 height in mm
        Math.min(pageHeight, heightLeft);
        
        pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position += pageHeight;
      }

      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      
      // Upload to Supabase storage
      const fileName = `timesheets/${timesheet.user_id}/${timesheet.id}_${format(parseISO(timesheet.period_start), 'yyyy-MM')}.pdf`;
      
      console.log('📤 Uploading PDF to storage:', fileName);
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        console.error('❌ Storage upload error:', uploadError);
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

      console.log('✅ PDF uploaded to storage:', uploadData);

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('documents')
        .getPublicUrl(fileName);

      // Update timesheet with PDF URL
      const { error: updateError } = await supabase
        .from('timesheets')
        .update({ pdf_url: publicUrl })
        .eq('id', timesheet.id);

      if (updateError) {
        console.error('❌ Database update error:', updateError);
        throw new Error(`Failed to update timesheet: ${updateError.message}`);
      }

      console.log('✅ Timesheet updated with PDF URL:', publicUrl);
      
      // Download the PDF
      const filename = `timesheet_${timesheet.user?.full_name?.replace(/\s+/g, '_')}_${format(parseISO(timesheet.period_start), 'MMM_yyyy')}.pdf`;
      pdf.save(filename);
      
      toast.success('Premium PDF generated and saved successfully!');
      onGenerated?.();
      
    } catch (error) {
      console.error('❌ Table PDF generation failed:', error);
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      onGenerating?.(false);
      setGenerating(false);
    }
  };

  // Get all days in the timesheet period - use the EXACT period dates
  const periodStart = parseISO(timesheet.period_start);
  const periodEnd = parseISO(timesheet.period_end);
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  
  console.log('📆 PDF Date range:', {
    periodStart: format(periodStart, 'yyyy-MM-dd'),
    periodEnd: format(periodEnd, 'yyyy-MM-dd'),
    totalDays: days.length,
    month: format(periodStart, 'MMMM yyyy')
  });
  
  // Create entries map for quick lookup
  const entriesMap = new Map<string, TimesheetEntry>();
  timesheet.entries?.forEach(entry => {
    entriesMap.set(entry.date, entry);
    console.log('🕒 Entry:', {
      date: entry.date,
      start: entry.start_time,
      end: entry.end_time,
      hours: entry.total_hours
    });
  });

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
      {/* Generate PDF Button */}
      <div className="mb-4 flex justify-center">
        <button
          onClick={generatePDF}
          disabled={generating}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Icon 
            icon={generating ? "solar:refresh-bold-duotone" : "solar:document-medicine-bold-duotone"} 
            className={`w-5 h-5 mr-2 ${generating ? 'animate-spin' : ''}`} 
          />
          {generating ? 'Generating PDF...' : 'Generate Premium PDF'}
        </button>
      </div>

      {/* Table Timesheet Content */}
      <div
        ref={timesheetRef}
        style={{
          width: '794px', // A4 width at 96 DPI
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: '11px',
          lineHeight: '1.4',
          color: '#333',
          backgroundColor: '#ffffff',
          padding: '40px',
          margin: '0 auto',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '30px',
            paddingBottom: '20px',
            paddingTop: '15px',
            paddingLeft: '20px',
            paddingRight: '20px',
            marginLeft: '-40px',
            marginRight: '-40px',
            marginTop: '-40px',
            background: headerColor
          }}
        >
          <div style={{ flex: 1, maxWidth: '55%' }}>
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
            <div
              style={{
                fontSize: '11px',
                color: '#ffffff',
                lineHeight: '1.5',
                fontWeight: '500'
              }}
            >
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
            <div
              style={{
                fontSize: '12px',
                fontWeight: '500',
                color: '#ffffff',
                marginTop: '8px'
              }}
            >
              {format(parseISO(timesheet.period_start), 'MMMM yyyy')}
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
                fontSize: '10px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '3px'
              }}
            >
              {timesheet.user?.full_name || 'N/A'}
            </div>
            {timesheet.user?.email && <div style={{ fontSize: '9px', color: '#4b5563' }}>Email: {timesheet.user.email}</div>}
            <div style={{ fontSize: '9px', color: '#4b5563' }}>Status: {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}</div>
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
            <div style={{ fontSize: '9px', color: '#4b5563', lineHeight: '1.8' }}>
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

        {/* Table */}
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
            Daily Time Log
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              overflow: 'hidden'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: headerColor }}>
                <th style={{ padding: '10px', textAlign: 'left', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Date</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', minWidth: '80px' }}>Time In</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', minWidth: '80px' }}>Time Out</th>
                <th style={{ padding: '10px', textAlign: 'left', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)' }}>Comments</th>
                <th style={{ padding: '10px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600' }}>Total Hours</th>
              </tr>
            </thead>
            <tbody>
              {days.map((day, index) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const entry = entriesMap.get(dateStr);
                const isWeekendDay = isWeekend(day);
                const holidayName = getHolidayName(dateStr);
                const isHoliday = !!holidayName;
                const rowNumber = index + 1;
                
                return (
                  <tr
                    key={dateStr}
                    style={{
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td style={{ padding: '10px', fontSize: '10px', color: '#1f2937', borderRight: '1px solid #e5e7eb' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ fontWeight: '600', color: '#4b5563', minWidth: '20px' }}>{rowNumber}</div>
                        <div>
                          <div style={{ fontWeight: '600' }}>{format(day, 'EEEE')}</div>
                          <div style={{ fontSize: '9px', color: '#6b7280' }}>{format(day, 'MMM dd, yyyy')}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '10px', color: entry?.start_time ? '#1f2937' : '#9ca3af', borderRight: '1px solid #e5e7eb', fontWeight: entry?.start_time ? '500' : '400' }}>
                      {entry?.start_time ? (
                        <div style={{ fontFamily: 'monospace' }}>
                          {format(parseISO(`2000-01-01T${entry.start_time}`), 'h:mm a')}
                        </div>
                      ) : (isHoliday ? 'Holiday' : isWeekendDay ? 'Closed' : '—')}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '10px', color: entry?.end_time ? '#1f2937' : '#9ca3af', borderRight: '1px solid #e5e7eb', fontWeight: entry?.end_time ? '500' : '400' }}>
                      {entry?.end_time ? (
                        <div style={{ fontFamily: 'monospace' }}>
                          {format(parseISO(`2000-01-01T${entry.end_time}`), 'h:mm a')}
                        </div>
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px', fontSize: '9px', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.task_description || (isHoliday ? holidayName : isWeekendDay ? 'Weekend' : '')}
                    </td>
                    <td style={{ padding: '10px', textAlign: 'center', fontSize: '10px', fontWeight: '600' }}>
                      {entry && entry.total_hours > 0 ? (
                        <div>
                          <div style={{ color: entry.is_overtime ? '#ea580c' : '#16a34a' }}>
                            {entry.total_hours.toFixed(1)}h
                          </div>
                          {entry.is_overtime && (
                            <div style={{ fontSize: '8px', color: '#ea580c', marginTop: '2px' }}>
                              {(entry.total_hours - 8).toFixed(1)}h OT
                            </div>
                          )}
                          {!entry.is_overtime && entry.total_hours > 0 && (
                            <div style={{ fontSize: '8px', color: '#16a34a', marginTop: '2px' }}>
                              Regular
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>0.0h</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb',
            fontSize: '9px',
            color: '#6b7280',
            textAlign: 'center'
          }}
        >
          Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}
          {practice.license_number && ` • License: ${practice.license_number}`}
          {practice.tax_number && ` • Tax No: ${practice.tax_number}`}
        </div>
      </div>
    </div>
  );
};

export default TimesheetTablePDFGenerator;