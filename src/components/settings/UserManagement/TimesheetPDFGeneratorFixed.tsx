import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO, isWeekend, eachDayOfInterval } from 'date-fns';
import { supabase } from '../../../lib/supabase';
import { useAuthStore } from '../../../stores/authStore';
import toast from 'react-hot-toast';
import { Icon } from '@iconify/react';
import TimesheetPDFGeneratorOptimized from './TimesheetPDFGeneratorOptimized';

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
  primary_color?: string;
}

interface TimesheetPDFGeneratorFixedProps {
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
  
  const moveableHolidays: Record<number, Record<string, string>> = {
    2024: { '03-29': 'Good Friday', '04-01': 'Easter Monday', '05-09': 'Ascension Day' },
    2025: { '04-18': 'Good Friday', '04-21': 'Easter Monday', '05-29': 'Ascension Day' },
  };
  
  if (moveableHolidays[year] && moveableHolidays[year][monthDay]) {
    return moveableHolidays[year][monthDay];
  }
  
  return holidayMap[monthDay] || null;
};

const TimesheetPDFGeneratorFixed: React.FC<TimesheetPDFGeneratorFixedProps> = ({
  timesheet,
  onGenerating,
  onGenerated
}) => {
  const timesheetRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // Debug logging
  useEffect(() => {
    console.log('🔍 TimesheetPDFGeneratorFixed received timesheet:', {
      id: timesheet.id,
      period: `${timesheet.period_start} to ${timesheet.period_end}`,
      totalHours: timesheet.total_hours,
      entriesCount: timesheet.entries?.length || 0,
      entries: timesheet.entries
    });
  }, [timesheet]);
  
  // Header color
  const headerColor = '#535d8e';
  
  // Fetch practice details from database
  useEffect(() => {
    const fetchPracticeData = async () => {
      if (!user?.id) return;
      
      try {
        let practiceId = (user as { practice_id?: string }).practice_id;
        
        if (!practiceId && (user as { user_metadata?: { practice_id?: string } }).user_metadata?.practice_id) {
          practiceId = (user as { user_metadata: { practice_id: string } }).user_metadata.practice_id;
        }
        
        if (!practiceId) {
          console.error('No practice_id found for user');
          return;
        }
        
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select('id, name, contact_email, contact_phone, address, city, country, postal_code, logo_url, primary_color, tax_number, license_number')
          .eq('id', practiceId)
          .single();
          
        if (practiceError) {
          console.error('Error fetching practice data:', practiceError);
          return;
        }
        
        setPractice(practiceData as PracticeInfo);
        
      } catch (error) {
        console.error('Error fetching practice data:', error);
      }
    };
    
    fetchPracticeData();
  }, [user]);

  const generatePDF = async () => {
    if (!practice) {
      toast.error('Practice data not loaded. Please try again.');
      return;
    }

    onGenerating?.(true);
    setGenerating(true);
    
    const startTime = performance.now();
    
    try {
      console.log('⚡ Starting PDF generation with actual entries...');
      console.log('📊 Timesheet has', timesheet.entries?.length || 0, 'entries');
      
      // Wait for DOM render
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
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add pages if content is too long
      let heightLeft = imgHeight;
      let position = 0;
      
      while (heightLeft > 0) {
        if (position !== 0) {
          pdf.addPage();
        }
        
        const pageHeight = 297; // A4 height in mm
        pdf.addImage(imgData, 'PNG', 0, -position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
        position += pageHeight;
      }

      // Generate PDF blob
      const pdfBlob = pdf.output('blob');
      
      // Upload to Supabase storage
      const fileName = `timesheets/${timesheet.user_id}/${timesheet.id}_${format(parseISO(timesheet.period_start), 'yyyy-MM')}.pdf`;
      
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(fileName, pdfBlob, {
          contentType: 'application/pdf',
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(`Failed to upload PDF: ${uploadError.message}`);
      }

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
        throw new Error(`Failed to update timesheet: ${updateError.message}`);
      }

      const endTime = performance.now();
      console.log(`⚡ PDF generated in ${((endTime - startTime) / 1000).toFixed(2)}s`);
      
      // Download the PDF
      const filename = `timesheet_${timesheet.user?.full_name?.replace(/\s+/g, '_')}_${format(parseISO(timesheet.period_start), 'MMM_yyyy')}.pdf`;
      pdf.save(filename);
      
      toast.success('Premium PDF generated successfully!');
      onGenerated?.();
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      onGenerating?.(false);
      setGenerating(false);
    }
  };

  // Get all days in the timesheet period
  const periodStart = parseISO(timesheet.period_start);
  const periodEnd = parseISO(timesheet.period_end);
  const allDays = eachDayOfInterval({ start: periodStart, end: periodEnd });
  
  // Create a map of entries by date for quick lookup
  const entriesMap = new Map<string, TimesheetEntry>();
  timesheet.entries?.forEach(entry => {
    entriesMap.set(entry.date, entry);
  });
  
  // Determine the month for display
  const displayMonth = format(periodEnd, 'MMMM yyyy');

  if (!practice) {
    return (
      <div className="flex items-center justify-center p-4">
        <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Use optimized PDF generator once practice is loaded
  return (
    <TimesheetPDFGeneratorOptimized
      timesheet={timesheet}
      practice={{
        name: practice.name,
        contact_email: practice.contact_email,
        contact_phone: practice.contact_phone,
        license_number: practice.license_number,
        tax_number: practice.tax_number
      }}
      onGenerating={onGenerating}
      onGenerated={onGenerated}
    />
  );

  // Format time helper
  const formatTime = (time?: string) => {
    if (!time) return '';
    try {
      // Handle HH:MM:SS format
      const timeParts = time.split(':');
      const hours = parseInt(timeParts[0]);
      const minutes = timeParts[1];
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
      return `${displayHours}:${minutes} ${period}`;
    } catch {
      return time;
    }
  };

  return (
    <div>
      {/* Generate PDF Button */}
      <div className="mb-4 flex justify-center">
        <button
          onClick={generatePDF}
          disabled={generating}
          className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-lg hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
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
          width: '794px',
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: '10px',
          lineHeight: '1.2',
          color: '#333',
          backgroundColor: '#ffffff',
          padding: '30px',
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
            marginBottom: '15px',
            paddingBottom: '10px',
            paddingTop: '10px',
            paddingLeft: '15px',
            paddingRight: '15px',
            marginLeft: '-30px',
            marginRight: '-30px',
            marginTop: '-30px',
            background: headerColor
          }}
        >
          <div style={{ flex: 1, maxWidth: '55%' }}>
            <div
              style={{
                fontSize: '16px',
                fontWeight: '700',
                color: '#ffffff',
                marginBottom: '2px'
              }}
            >
              {practice.name}
            </div>
            <div
              style={{
                fontSize: '9px',
                color: 'rgba(255,255,255,0.8)',
                marginBottom: '2px',
                fontWeight: '400'
              }}
            >
              Employee Timesheet Report
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#ffffff',
                lineHeight: '1.3',
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
                fontSize: '18px',
                fontWeight: '700',
                color: '#ffffff',
                letterSpacing: '1px'
              }}
            >
              TIMESHEET
            </div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: '500',
                color: '#ffffff',
                marginTop: '4px'
              }}
            >
              {displayMonth}
            </div>
          </div>
        </div>

        {/* Employee Information */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10px',
            gap: '15px'
          }}
        >
          <div
            style={{
              flex: 1,
              borderRadius: '4px',
              padding: '8px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '9px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Employee Details
            </div>
            <div
              style={{
                fontSize: '9px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '2px'
              }}
            >
              {timesheet.user?.full_name || 'N/A'}
            </div>
            {timesheet.user?.email && <div style={{ fontSize: '8px', color: '#4b5563' }}>Email: {timesheet.user.email}</div>}
            <div style={{ fontSize: '8px', color: '#4b5563' }}>Status: {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}</div>
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: '4px',
              padding: '8px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}
          >
            <div
              style={{
                fontSize: '9px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Hours Summary
            </div>
            <div style={{ fontSize: '8px', color: '#4b5563', lineHeight: '1.5' }}>
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
        <div style={{ marginBottom: '15px' }}>
          <div
            style={{
              fontSize: '10px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '6px',
              paddingBottom: '2px',
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
              fontSize: '8px'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: headerColor }}>
                <th style={{ padding: '4px', textAlign: 'center', color: '#ffffff', fontSize: '8px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '5%' }}>#</th>
                <th style={{ padding: '4px', textAlign: 'left', color: '#ffffff', fontSize: '8px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '20%' }}>Date</th>
                <th style={{ padding: '4px', textAlign: 'center', color: '#ffffff', fontSize: '8px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '12%' }}>Time In</th>
                <th style={{ padding: '4px', textAlign: 'center', color: '#ffffff', fontSize: '8px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '12%' }}>Time Out</th>
                <th style={{ padding: '4px', textAlign: 'left', color: '#ffffff', fontSize: '8px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '35%' }}>Comments</th>
                <th style={{ padding: '4px', textAlign: 'center', color: '#ffffff', fontSize: '8px', fontWeight: '600', width: '16%' }}>Hours</th>
              </tr>
            </thead>
            <tbody>
              {allDays.map((day, index) => {
                const dateStr = format(day, 'yyyy-MM-dd');
                const entry = entriesMap.get(dateStr);
                const isWeekendDay = isWeekend(day);
                const holidayName = getHolidayName(dateStr);
                const rowNumber = index + 1;
                
                return (
                  <tr
                    key={dateStr}
                    style={{
                      backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb',
                      borderBottom: '1px solid #e5e7eb'
                    }}
                  >
                    <td style={{ padding: '3px', fontSize: '7px', color: '#4b5563', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {rowNumber}
                    </td>
                    <td style={{ padding: '3px', fontSize: '7px', color: '#1f2937', borderRight: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: '600' }}>{format(day, 'EEE')} {format(day, 'dd/MM')}</div>
                    </td>
                    <td style={{ padding: '3px', textAlign: 'center', fontSize: '7px', color: entry?.start_time ? '#1f2937' : '#9ca3af', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.start_time ? formatTime(entry.start_time) : (holidayName ? 'Holiday' : isWeekendDay ? 'Closed' : '—')}
                    </td>
                    <td style={{ padding: '3px', textAlign: 'center', fontSize: '7px', color: entry?.end_time ? '#1f2937' : '#9ca3af', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.end_time ? formatTime(entry.end_time) : '—'}
                    </td>
                    <td style={{ padding: '3px', fontSize: '7px', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.task_description || holidayName || (isWeekendDay ? 'Weekend' : '')}
                    </td>
                    <td style={{ padding: '3px', textAlign: 'center', fontSize: '7px', fontWeight: '600' }}>
                      {entry ? (
                        <span style={{ color: entry.is_overtime ? '#ea580c' : '#16a34a' }}>
                          {entry.total_hours.toFixed(1)}h{entry.is_overtime && ' OT'}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Signature Section */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '15px',
            borderTop: '1px solid #e5e7eb'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '30px'
            }}
          >
            {/* Employee Signature */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  borderBottom: '1px solid #6b7280',
                  height: '40px',
                  marginBottom: '4px'
                }}
              />
              <div
                style={{
                  fontSize: '8px',
                  color: '#4b5563',
                  textAlign: 'center'
                }}
              >
                Employee Signature
              </div>
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: '600',
                  color: '#1f2937',
                  textAlign: 'center',
                  marginTop: '2px'
                }}
              >
                {timesheet.user?.full_name || 'Employee Name'}
              </div>
              <div
                style={{
                  fontSize: '7px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                Date: _________________
              </div>
            </div>

            {/* Practice/Supervisor Signature */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  borderBottom: '1px solid #6b7280',
                  height: '40px',
                  marginBottom: '4px'
                }}
              />
              <div
                style={{
                  fontSize: '8px',
                  color: '#4b5563',
                  textAlign: 'center'
                }}
              >
                Practice Manager / Supervisor
              </div>
              <div
                style={{
                  fontSize: '9px',
                  fontWeight: '600',
                  color: '#1f2937',
                  textAlign: 'center',
                  marginTop: '2px'
                }}
              >
                {practice.name}
              </div>
              <div
                style={{
                  fontSize: '7px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                Date: _________________
              </div>
            </div>
          </div>

          {/* Document Info */}
          <div
            style={{
              marginTop: '15px',
              fontSize: '7px',
              color: '#9ca3af',
              textAlign: 'center'
            }}
          >
            Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}
            {practice.license_number && ` • License: ${practice.license_number}`}
            {practice.tax_number && ` • Tax No: ${practice.tax_number}`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetPDFGeneratorFixed;