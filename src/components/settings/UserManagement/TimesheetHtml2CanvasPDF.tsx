import React, { useState } from 'react';
import TimesheetPDFGenerator from './TimesheetPDFGenerator';
import toast from 'react-hot-toast';
import { supabase } from '../../../lib/supabase';

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
  entries?: any[];
}

export const downloadTimesheetHtml2CanvasPDF = async (timesheet: Timesheet) => {
  // If entries are not loaded, fetch them first
  let completeTimesheet = timesheet;
  if (!timesheet.entries || timesheet.entries.length === 0) {
    const { data: entries, error } = await supabase
      .from('timesheet_entries')
      .select('*')
      .eq('timesheet_id', timesheet.id)
      .order('date', { ascending: true });
    
    if (!error && entries) {
      completeTimesheet = { ...timesheet, entries };
    }
  }
  
  const container = document.createElement('div');
  document.body.appendChild(container);
  
  return new Promise<void>((resolve, reject) => {
    const handleGenerating = (generating: boolean) => {
      if (!generating) {
        // Cleanup
        document.body.removeChild(container);
        resolve();
      }
    };

    // Create a temporary React root to render the PDF generator
    const root = (window as unknown as { ReactDOM?: { createRoot?: (container: HTMLElement) => { render: (element: React.ReactElement) => void } } })?.ReactDOM?.createRoot?.(container) || 
                 (window as unknown as { ReactDOM?: { render?: (element: React.ReactElement, container: HTMLElement) => void } })?.ReactDOM?.render;
    
    const element = React.createElement(TimesheetPDFGenerator, {
      timesheet: completeTimesheet,
      onGenerating: handleGenerating
    });

    if (root?.render) {
      // React 18+
      root.render(element);
    } else if ((window as unknown as { ReactDOM?: { render?: (element: React.ReactElement, container: HTMLElement) => void } })?.ReactDOM?.render) {
      // React 17
      (window as unknown as { ReactDOM: { render: (element: React.ReactElement, container: HTMLElement) => void } }).ReactDOM.render(element, container);
    } else {
      // Fallback: Use a toast notification and the component directly
      toast.promise(
        new Promise((res, rej) => {
          try {
            // Create a modal container
            const modalContainer = document.createElement('div');
            modalContainer.style.position = 'fixed';
            modalContainer.style.top = '50%';
            modalContainer.style.left = '50%';
            modalContainer.style.transform = 'translate(-50%, -50%)';
            modalContainer.style.zIndex = '9999';
            modalContainer.style.backgroundColor = 'white';
            modalContainer.style.padding = '20px';
            modalContainer.style.borderRadius = '8px';
            modalContainer.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            document.body.appendChild(modalContainer);

            // Import React and ReactDOM dynamically
            import('react-dom/client').then(ReactDOMClient => {
              const root = ReactDOMClient.createRoot(modalContainer);
              root.render(
                React.createElement(TimesheetPDFGenerator, {
                  timesheet: completeTimesheet,
                  onGenerating: (generating: boolean) => {
                    if (!generating) {
                      root.unmount();
                      document.body.removeChild(modalContainer);
                      document.body.removeChild(container);
                      res(undefined);
                    }
                  }
                })
              );
            }).catch(err => {
              document.body.removeChild(container);
              rej(err);
            });
          } catch (error) {
            document.body.removeChild(container);
            rej(error);
          }
        }),
        {
          loading: 'Generating PDF...',
          success: 'PDF generated successfully!',
          error: 'Failed to generate PDF'
        }
      );
    }
  });
};

// Export a component version as well for direct usage
interface TimesheetHtml2CanvasPDFProps {
  timesheet: Timesheet;
  onClose?: () => void;
}

export const TimesheetHtml2CanvasPDF: React.FC<TimesheetHtml2CanvasPDFProps> = ({ 
  timesheet, 
  onClose 
}) => {
  const [generating, setGenerating] = useState(false);

  return (
    <div className="p-4">
      <TimesheetPDFGenerator 
        timesheet={timesheet} 
        onGenerating={(isGenerating) => {
          setGenerating(isGenerating);
          if (!isGenerating && onClose) {
            onClose();
          }
        }}
      />
    </div>
  );
};

export default TimesheetHtml2CanvasPDF;