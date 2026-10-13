import React, { useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO, isWeekend, eachDayOfInterval } from 'date-fns';
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
  name: string;
  contact_email?: string;
  contact_phone?: string;
  license_number?: string;
  tax_number?: string;
}

interface TimesheetPDFGeneratorOptimizedProps {
  timesheet: Timesheet;
  practice: PracticeInfo;
  onGenerating?: (generating: boolean) => void;
  onGenerated?: () => void;
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

const TimesheetPDFGeneratorOptimized: React.FC<TimesheetPDFGeneratorOptimizedProps> = ({
  timesheet,
  practice,
  onGenerating,
  onGenerated
}) => {
  const timesheetRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  
  // Header color
  const headerColor = '#535d8e';

  const generatePDF = async () => {
    onGenerating?.(true);
    setGenerating(true);
    
    const startTime = performance.now();
    
    try {
      console.log('⚡ Starting OPTIMIZED PDF generation...');
      console.log('📊 Timesheet has', timesheet.entries?.length || 0, 'entries');
      
      // Minimal wait for DOM render
      await new Promise(resolve => setTimeout(resolve, 50));

      const element = timesheetRef.current;
      if (!element) {
        throw new Error('Timesheet element not found');
      }

      // Optimized canvas generation with lower scale for faster processing
      const canvas = await html2canvas(element, {
        scale: 1, // Lower scale for much faster processing
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: 1123, // A4 height at 96 DPI
        imageTimeout: 0,
        removeContainer: false
      });

      // Create PDF
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.8); // Lower quality for faster processing
      const imgWidth = 210; // A4 width in mm
      const imgHeight = 297; // A4 height in mm
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

      const endTime = performance.now();
      console.log(`⚡ PDF generated in ${((endTime - startTime) / 1000).toFixed(2)}s`);
      
      // Download the PDF
      const filename = `timesheet_${timesheet.user?.full_name?.replace(/\s+/g, '_')}_${format(parseISO(timesheet.period_start), 'MMM_yyyy')}.pdf`;
      pdf.save(filename);
      
      toast.success('PDF generated successfully!');
      onGenerated?.();
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      // The reason is in the console; "Unknown error" or a library message tells staff nothing
      toast.error('The timesheet PDF could not be made. Please try again.');
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

  // Format time helper
  const formatTime = (time?: string) => {
    if (!time) return '';
    try {
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
          {generating ? 'Generating PDF...' : 'Generate PDF'}
        </button>
      </div>

      {/* A4 Size Content - Optimized for full page usage */}
      <div
        ref={timesheetRef}
        style={{
          width: '794px', // A4 width at 96 DPI
          height: '1123px', // A4 height at 96 DPI
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.4',
          color: '#333',
          backgroundColor: '#ffffff',
          padding: '40px',
          margin: '0 auto',
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '20px',
            paddingBottom: '15px',
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
                fontSize: '22px',
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
                marginBottom: '4px',
                fontWeight: '400'
              }}
            >
              Employee Timesheet Report
            </div>
            <div
              style={{
                fontSize: '10px',
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
                fontSize: '26px',
                fontWeight: '700',
                color: '#ffffff',
                letterSpacing: '1px'
              }}
            >
              TIMESHEET
            </div>
            <div
              style={{
                fontSize: '13px',
                fontWeight: '500',
                color: '#ffffff',
                marginTop: '6px'
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
            marginBottom: '20px',
            gap: '20px'
          }}
        >
          <div
            style={{
              flex: 1,
              borderRadius: '6px',
              padding: '12px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Employee Details
            </div>
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#1f2937',
                marginBottom: '3px'
              }}
            >
              {timesheet.user?.full_name || 'N/A'}
            </div>
            {timesheet.user?.email && <div style={{ fontSize: '10px', color: '#4b5563' }}>Email: {timesheet.user.email}</div>}
            <div style={{ fontSize: '10px', color: '#4b5563' }}>Status: {timesheet.status.charAt(0).toUpperCase() + timesheet.status.slice(1)}</div>
          </div>

          <div
            style={{
              flex: 1,
              borderRadius: '6px',
              padding: '12px',
              border: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Hours Summary
            </div>
            <div style={{ fontSize: '10px', color: '#4b5563', lineHeight: '1.6' }}>
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

        {/* Table - Takes up remaining space */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '20px' }}>
          <div
            style={{
              fontSize: '12px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '10px',
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
              fontSize: '10px'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: headerColor }}>
                <th style={{ padding: '6px 4px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '5%' }}>#</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '22%' }}>Date</th>
                <th style={{ padding: '6px 4px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '13%' }}>Time In</th>
                <th style={{ padding: '6px 4px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '13%' }}>Time Out</th>
                <th style={{ padding: '6px 8px', textAlign: 'left', color: '#ffffff', fontSize: '10px', fontWeight: '600', borderRight: '1px solid rgba(255,255,255,0.2)', width: '32%' }}>Comments</th>
                <th style={{ padding: '6px 4px', textAlign: 'center', color: '#ffffff', fontSize: '10px', fontWeight: '600', width: '15%' }}>Hours</th>
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
                    <td style={{ padding: '5px 4px', fontSize: '9px', color: '#6b7280', borderRight: '1px solid #e5e7eb', textAlign: 'center' }}>
                      {rowNumber}
                    </td>
                    <td style={{ padding: '5px 8px', fontSize: '9px', color: '#1f2937', borderRight: '1px solid #e5e7eb' }}>
                      <div style={{ fontWeight: '600' }}>{format(day, 'EEE')} {format(day, 'dd MMM')}</div>
                    </td>
                    <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: '9px', color: entry?.start_time ? '#1f2937' : '#9ca3af', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.start_time ? formatTime(entry.start_time) : (holidayName ? 'Holiday' : isWeekendDay ? 'Closed' : '—')}
                    </td>
                    <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: '9px', color: entry?.end_time ? '#1f2937' : '#9ca3af', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.end_time ? formatTime(entry.end_time) : '—'}
                    </td>
                    <td style={{ padding: '5px 8px', fontSize: '9px', color: '#6b7280', borderRight: '1px solid #e5e7eb' }}>
                      {entry?.task_description || holidayName || (isWeekendDay ? 'Weekend' : '')}
                    </td>
                    <td style={{ padding: '5px 4px', textAlign: 'center', fontSize: '9px', fontWeight: '600' }}>
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

        {/* Signature Section - Fixed at bottom */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: '40px',
              marginBottom: '15px'
            }}
          >
            {/* Employee Signature */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  borderBottom: '1px solid #6b7280',
                  height: '50px',
                  marginBottom: '6px'
                }}
              />
              <div
                style={{
                  fontSize: '10px',
                  color: '#4b5563',
                  textAlign: 'center'
                }}
              >
                Employee Signature
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#1f2937',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                {timesheet.user?.full_name || 'Employee Name'}
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '6px'
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
                  height: '50px',
                  marginBottom: '6px'
                }}
              />
              <div
                style={{
                  fontSize: '10px',
                  color: '#4b5563',
                  textAlign: 'center'
                }}
              >
                Practice Manager / Supervisor
              </div>
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#1f2937',
                  textAlign: 'center',
                  marginTop: '4px'
                }}
              >
                {practice.name}
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#6b7280',
                  textAlign: 'center',
                  marginTop: '6px'
                }}
              >
                Date: _________________
              </div>
            </div>
          </div>

          {/* Document Info */}
          <div
            style={{
              fontSize: '8px',
              color: '#9ca3af',
              textAlign: 'center'
            }}
          >
            Generated on {format(new Date(), 'd MMM yyyy HH:mm')}
            {practice.license_number && ` • License: ${practice.license_number}`}
            {practice.tax_number && ` • Tax No: ${practice.tax_number}`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TimesheetPDFGeneratorOptimized;