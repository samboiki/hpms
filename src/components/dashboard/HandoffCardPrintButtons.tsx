import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { documentGenerationService } from '../../services/documentGenerationService';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';

interface HandoffCardPrintButtonsProps {
  visitId: string;
  patientId: string;
  practiceId: string;
  onDocumentGenerated?: () => void;
  showLabels?: boolean;
}

export const HandoffCardPrintButtons: React.FC<HandoffCardPrintButtonsProps> = ({ 
  visitId, 
  patientId, 
  practiceId,
  onDocumentGenerated,
  showLabels = false 
}) => {
  const { user } = useAuthStore();
  const [generatingDocs, setGeneratingDocs] = useState<Record<string, boolean>>({});
  const [existingDocs, setExistingDocs] = useState<Record<string, string>>({});
  const [availableData, setAvailableData] = useState<Record<string, boolean>>({
    prescription: false,
    leave_form: false,
    invoice: false
  });
  const [visitPracticeId, setVisitPracticeId] = useState<string>('');

  // Check if documents already exist and data is available
  React.useEffect(() => {
    checkExistingDocuments();
    checkAvailableData();
    fetchVisitPracticeId();
    
    // Poll for document generation status every 5 seconds
    const interval = setInterval(() => {
      checkExistingDocuments();
    }, 5000);
    
    return () => clearInterval(interval);
  }, [visitId]);

  const checkExistingDocuments = async () => {
    try {
      const docs = await documentGenerationService.getVisitDocuments(visitId);
      const docMap: Record<string, string> = {};
      
      docs.forEach(doc => {
        if (doc.document_type && doc.file_path) {
          docMap[doc.document_type] = documentGenerationService.getDocumentUrl(doc.file_path);
        }
      });
      
      setExistingDocs(docMap);
    } catch (error) {
      console.error('Error checking existing documents:', error);
    }
  };

  const checkAvailableData = async () => {
    try {
      // Check prescription data
      const { data: medications } = await supabase
        .from('medications')
        .select('*')
        .eq('visit_id', visitId)
        .limit(1);
      
      // Check leave form data
      const { data: leaveForm } = await (supabase as any)
        .from('leave_forms')
        .select('*')
        .eq('visit_id', visitId)
        .maybeSingle();
      
      // Check invoice data
      const { data: invoice } = await supabase
        .from('invoices_enhanced')
        .select(`
          *,
          invoice_services (*)
        `)
        .eq('visit_id', visitId)
        .maybeSingle();
      
      setAvailableData({
        prescription: medications && medications.length > 0,
        leave_form: !!leaveForm,
        invoice: invoice && invoice.invoice_services && invoice.invoice_services.length > 0
      });
    } catch (error) {
      console.error('Error checking available data:', error);
    }
  };

  const fetchVisitPracticeId = async () => {
    try {
      const { data: visit } = await supabase
        .from('visits')
        .select('practice_id')
        .eq('id', visitId)
        .single();
      
      if (visit?.practice_id) {
        setVisitPracticeId(visit.practice_id);
      }
    } catch (error) {
      console.error('Error fetching visit practice ID:', error);
    }
  };

  const handleGenerateDocument = async (docType: 'prescription' | 'leave_form' | 'invoice') => {
    // If document already exists, just open it
    if (existingDocs[docType]) {
      window.open(existingDocs[docType], '_blank');
      return;
    }

    // Determine the correct practiceId to use
    const effectivePracticeId = practiceId || visitPracticeId || user?.practice_id || '';
    
    // Validate required props
    if (!visitId || !patientId || !effectivePracticeId) {
      console.error('Missing required props:', { visitId, patientId, practiceId: effectivePracticeId });
      toast.error('Unable to generate document: Missing practice information');
      return;
    }

    // Check if we actually have data for this document type
    let hasData = false;
    
    try {
      setGeneratingDocs(prev => ({ ...prev, [docType]: true }));
      
      // Check data availability based on document type
      switch (docType) {
        case 'prescription':
          const { data: medications } = await supabase
            .from('medications')
            .select('*')
            .eq('visit_id', visitId)
            .limit(1);
          hasData = medications && medications.length > 0;
          break;
          
        case 'leave_form':
          const { data: leaveForm } = await (supabase as any)
            .from('leave_forms')
            .select('*')
            .eq('visit_id', visitId)
            .maybeSingle();
          hasData = !!leaveForm;
          break;
          
        case 'invoice':
          const { data: invoice } = await supabase
            .from('invoices_enhanced')
            .select(`
              *,
              invoice_services (*)
            `)
            .eq('visit_id', visitId)
            .maybeSingle();
          hasData = invoice && invoice.invoice_services && invoice.invoice_services.length > 0;
          break;
      }

      if (!hasData) {
        const messages = {
          prescription: 'No prescription data available for this visit',
          leave_form: 'No leave form data available for this visit',
          invoice: 'No invoice data available for this visit'
        };
        toast.error(messages[docType]);
        return;
      }

      // Generate the document
      const documents = await documentGenerationService.generateVisitDocuments({
        visitId,
        patientId,
        practiceId: effectivePracticeId,
        documents: [docType]
      });

      if (documents.length > 0) {
        const generatedDoc = documents[0];
        if (generatedDoc.publicUrl) {
          // Update existing docs cache
          setExistingDocs(prev => ({ ...prev, [docType]: generatedDoc.publicUrl! }));
          
          // Open the document
          console.log('Opening document:', generatedDoc.publicUrl);
          const newWindow = window.open(generatedDoc.publicUrl, '_blank');
          
          // If popup was blocked, create a link and click it
          if (!newWindow || newWindow.closed || typeof newWindow.closed == 'undefined') {
            const link = document.createElement('a');
            link.href = generatedDoc.publicUrl;
            link.target = '_blank';
            link.download = `${docType}_${new Date().getTime()}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          
          // Notify parent component
          onDocumentGenerated?.();
          
          toast.success(`${docType === 'prescription' ? 'Prescription' : 
                          docType === 'leave_form' ? 'Leave form' : 
                          'Invoice'} generated successfully`);
        }
      }
    } catch (error) {
      console.error(`Error generating ${docType}:`, error);
      toast.error(`Failed to generate ${docType === 'prescription' ? 'prescription' : 
                                          docType === 'leave_form' ? 'leave form' : 
                                          'invoice'}`);
    } finally {
      setGeneratingDocs(prev => ({ ...prev, [docType]: false }));
    }
  };

  return (
    <div className={`flex items-center ${showLabels ? 'gap-2' : 'gap-1'}`} onClick={(e) => e.stopPropagation()}>
      {/* Prescription Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          if (existingDocs.prescription) {
            handleGenerateDocument('prescription');
          }
        }}
        disabled={!existingDocs.prescription}
        className={`${showLabels ? `px-3 py-2 ${existingDocs.prescription ? 'bg-blue-50 hover:bg-blue-100 border border-blue-200 hover:scale-105 hover:shadow-md' : 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'} rounded-lg flex items-center gap-2 transition-all` : 'p-1.5 hover:bg-blue-50 rounded-md transition-colors'} group relative`}
        title="Print Prescription"
      >
        <Icon icon="solar:medical-kit-bold-duotone" className={`w-5 h-5 ${existingDocs.prescription ? 'text-blue-600 group-hover:text-blue-700' : 'text-gray-400'}`} />
        {showLabels && <span className={`text-sm font-medium ${existingDocs.prescription ? 'text-blue-700' : 'text-gray-500'}`}>Prescription</span>}
        {existingDocs.prescription && !showLabels && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </button>

      {/* Leave Form Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          if (existingDocs.leave_form) {
            handleGenerateDocument('leave_form');
          }
        }}
        disabled={!existingDocs.leave_form}
        className={`${showLabels ? `px-3 py-2 ${existingDocs.leave_form ? 'bg-orange-50 hover:bg-orange-100 border border-orange-200 hover:scale-105 hover:shadow-md' : 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'} rounded-lg flex items-center gap-2 transition-all` : 'p-1.5 hover:bg-orange-50 rounded-md transition-colors'} group relative`}
        title="Print Leave Form"
      >
        <Icon icon="solar:document-text-bold-duotone" className={`w-5 h-5 ${existingDocs.leave_form ? 'text-orange-600 group-hover:text-orange-700' : 'text-gray-400'}`} />
        {showLabels && <span className={`text-sm font-medium ${existingDocs.leave_form ? 'text-orange-700' : 'text-gray-500'}`}>Leave Form</span>}
        {existingDocs.leave_form && !showLabels && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </button>

      {/* Invoice Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          if (existingDocs.invoice) {
            handleGenerateDocument('invoice');
          }
        }}
        disabled={!existingDocs.invoice}
        className={`${showLabels ? `px-3 py-2 ${existingDocs.invoice ? 'bg-[#00a7ad]/10 hover:bg-[#00a7ad]/20 border border-[#00a7ad]/30 hover:scale-105 hover:shadow-md' : 'bg-gray-100 border border-gray-200 opacity-50 cursor-not-allowed'} rounded-lg flex items-center gap-2 transition-all` : 'p-1.5 hover:bg-[#00a7ad]/10 rounded-md transition-colors'} group relative`}
        title="Print Invoice"
      >
        <Icon icon="solar:wallet-bold-duotone" className={`w-5 h-5 ${existingDocs.invoice ? 'text-[#00a7ad] group-hover:text-[#00959a]' : 'text-gray-400'}`} />
        {showLabels && <span className={`text-sm font-medium ${existingDocs.invoice ? 'text-[#00a7ad]' : 'text-gray-500'}`}>Invoice</span>}
        {existingDocs.invoice && !showLabels && (
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
        )}
      </button>
    </div>
  );
};