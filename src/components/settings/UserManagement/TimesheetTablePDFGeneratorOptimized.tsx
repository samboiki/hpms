import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO, eachDayOfInterval, isWeekend } from 'date-fns';
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
  primary_color?: string;
}

interface TimesheetTablePDFGeneratorOptimizedProps {
  timesheet: Timesheet;
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

const TimesheetTablePDFGeneratorOptimized: React.FC<TimesheetTablePDFGeneratorOptimizedProps> = ({
  timesheet,
  onGenerating,
  onGenerated
}) => {
  const timesheetRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [generating, setGenerating] = useState(false);
  
  // Fetch practice details from database (cached)
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
        
        // Use cache for practice data
        const cachedPractice = sessionStorage.getItem(`practice_${practiceId}`);
        if (cachedPractice) {
          setPractice(JSON.parse(cachedPractice));
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
        
        // Cache the practice data
        sessionStorage.setItem(`practice_${practiceId}`, JSON.stringify(practiceData));
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
      console.log('⚡ Starting OPTIMIZED PDF generation...');
      
      // Minimal wait for DOM render
      await new Promise(resolve => setTimeout(resolve, 50));

      const element = timesheetRef.current;
      if (!element) {
        throw new Error('Timesheet element not found');
      }

      // Optimized canvas generation
      const canvas = await html2canvas(element, {
        scale: 1.5, // Reduced scale for faster processing
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        windowWidth: 794,
        windowHeight: element.scrollHeight,
        imageTimeout: 0, // Disable image timeout
        onclone: (clonedDoc) => {
          // Ensure fonts are loaded in clone
          clonedDoc.fonts.ready.then(() => {
            console.log('Fonts loaded in clone');
          });
        }
      });

      // Create PDF with optimized settings
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
        compress: true
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95); // Use JPEG for smaller size
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);

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
      
      toast.success('PDF generated successfully!');
      onGenerated?.();
      
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      toast.error(`Failed to generate PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      onGenerating?.(false);
      setGenerating(false);
    }
  };

  // Get days for the exact period
  const periodStart = parseISO(timesheet.period_start);
  const periodEnd = parseISO(timesheet.period_end);
  const days = eachDayOfInterval({ start: periodStart, end: periodEnd });
  
  // Create entries map
  const entriesMap = new Map<string, TimesheetEntry>();
  timesheet.entries?.forEach(entry => {
    entriesMap.set(entry.date, entry);
  });

  if (!practice) {
    return (
      <div className="flex items-center justify-center p-4">
        <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  // Format time helper
  const formatTime = (time?: string) => {
    if (!time) return '';
    try {
      return format(parseISO(`2000-01-01T${time}`), 'h:mm a');
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

      {/* Simplified Table for faster rendering */}
      <div
        ref={timesheetRef}
        style={{
          width: '794px',
          backgroundColor: '#ffffff',
          fontFamily: 'Arial, sans-serif',
          fontSize: '11px',
          padding: '30px'
        }}
      >
        {/* Simple Header */}
        <div style={{ marginBottom: '20px', borderBottom: '2px solid #374151', paddingBottom: '10px' }}>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 'bold', color: '#1f2937' }}>{practice.name}</h1>
          <p style={{ margin: '5px 0 0 0', fontSize: '14px', color: '#4b5563' }}>
            Employee Timesheet - {format(periodStart, 'MMMM yyyy')}
          </p>
        </div>

        {/* Employee Info */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ margin: '5px 0' }}><strong>Employee:</strong> {timesheet.user?.full_name || 'N/A'}</p>
          <p style={{ margin: '5px 0' }}><strong>Period:</strong> {format(periodStart, 'MMM dd')} - {format(periodEnd, 'MMM dd, yyyy')}</p>
          <p style={{ margin: '5px 0' }}>
            <strong>Total Hours:</strong> {timesheet.total_hours.toFixed(1)}h 
            ({timesheet.regular_hours.toFixed(1)}h regular, {timesheet.overtime_hours.toFixed(1)}h overtime)
          </p>
        </div>

        {/* Simple Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #d1d5db' }}>
          <thead>
            <tr style={{ backgroundColor: '#374151' }}>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffffff', border: '1px solid #374151' }}>#</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffffff', border: '1px solid #374151' }}>Date</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#ffffff', border: '1px solid #374151' }}>Time In</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#ffffff', border: '1px solid #374151' }}>Time Out</th>
              <th style={{ padding: '8px', textAlign: 'left', color: '#ffffff', border: '1px solid #374151' }}>Comments</th>
              <th style={{ padding: '8px', textAlign: 'center', color: '#ffffff', border: '1px solid #374151' }}>Hours</th>
            </tr>
          </thead>
          <tbody>
            {days.map((day, index) => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const entry = entriesMap.get(dateStr);
              const isWeekendDay = isWeekend(day);
              const holidayName = getHolidayName(dateStr);
              
              return (
                <tr key={dateStr} style={{ backgroundColor: index % 2 === 0 ? '#ffffff' : '#f9fafb' }}>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>{index + 1}</td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>
                    {format(day, 'EEE')}, {format(day, 'MMM dd')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                    {entry?.start_time ? formatTime(entry.start_time) : (holidayName ? 'Holiday' : isWeekendDay ? 'Closed' : '—')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #d1d5db' }}>
                    {entry?.end_time ? formatTime(entry.end_time) : '—'}
                  </td>
                  <td style={{ padding: '8px', border: '1px solid #d1d5db' }}>
                    {entry?.task_description || holidayName || (isWeekendDay ? 'Weekend' : '')}
                  </td>
                  <td style={{ padding: '8px', textAlign: 'center', border: '1px solid #d1d5db', fontWeight: 'bold' }}>
                    {entry ? `${entry.total_hours.toFixed(1)}h` : '0.0h'}
                    {entry?.is_overtime && <span style={{ fontSize: '9px', color: '#dc2626' }}> OT</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Footer */}
        <div style={{ marginTop: '20px', paddingTop: '10px', borderTop: '1px solid #d1d5db', fontSize: '9px', color: '#6b7280' }}>
          Generated on {format(new Date(), 'MMM dd, yyyy HH:mm')}
        </div>
      </div>
    </div>
  );
};

export default TimesheetTablePDFGeneratorOptimized;