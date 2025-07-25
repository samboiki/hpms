import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { documentGenerationService } from '../../services/documentGenerationService';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

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
  const [generatingDocs, setGeneratingDocs] = useState<Record<string, boolean>>({});
  const [existingDocs, setExistingDocs] = useState<Record<string, string>>({});

  // Check if documents already exist
  React.useEffect(() => {
    checkExistingDocuments();
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

  const handleGenerateDocument = async (docType: 'prescription' | 'leave_form' | 'invoice') => {
    // If document already exists, just open it
    if (existingDocs[docType]) {
      window.open(existingDocs[docType], '_blank');
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
        practiceId,
        documents: [docType]
      });

      if (documents.length > 0) {
        const generatedDoc = documents[0];
        if (generatedDoc.publicUrl) {
          // Update existing docs cache
          setExistingDocs(prev => ({ ...prev, [docType]: generatedDoc.publicUrl! }));
          
          // Open the document
          window.open(generatedDoc.publicUrl, '_blank');
          
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
          handleGenerateDocument('prescription');
        }}
        disabled={generatingDocs.prescription}
        className={`${showLabels ? 'px-3 py-2 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg flex items-center gap-2 transition-all hover:scale-105 hover:shadow-md animate-pulse' : 'p-1.5 hover:bg-blue-50 rounded-md transition-colors'} group relative`}
        title="Print Prescription"
      >
        {generatingDocs.prescription ? (
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Icon icon="solar:medical-kit-bold-duotone" className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
            {showLabels && <span className="text-sm font-medium text-blue-700">Prescription</span>}
            {existingDocs.prescription && !showLabels && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </>
        )}
      </button>

      {/* Leave Form Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          handleGenerateDocument('leave_form');
        }}
        disabled={generatingDocs.leave_form}
        className={`${showLabels ? 'px-3 py-2 bg-orange-50 hover:bg-orange-100 border border-orange-200 rounded-lg flex items-center gap-2 transition-all hover:scale-105 hover:shadow-md animate-pulse' : 'p-1.5 hover:bg-orange-50 rounded-md transition-colors'} group relative`}
        title="Print Leave Form"
      >
        {generatingDocs.leave_form ? (
          <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Icon icon="solar:document-text-bold-duotone" className="w-5 h-5 text-orange-600 group-hover:text-orange-700" />
            {showLabels && <span className="text-sm font-medium text-orange-700">Leave Form</span>}
            {existingDocs.leave_form && !showLabels && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </>
        )}
      </button>

      {/* Invoice Button */}
      <button
        onClick={(e) => {
          e.preventDefault();
          handleGenerateDocument('invoice');
        }}
        disabled={generatingDocs.invoice}
        className={`${showLabels ? 'px-3 py-2 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg flex items-center gap-2 transition-all hover:scale-105 hover:shadow-md animate-pulse' : 'p-1.5 hover:bg-green-50 rounded-md transition-colors'} group relative`}
        title="Print Invoice"
      >
        {generatingDocs.invoice ? (
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
        ) : (
          <>
            <Icon icon="solar:wallet-bold-duotone" className="w-5 h-5 text-green-600 group-hover:text-green-700" />
            {showLabels && <span className="text-sm font-medium text-green-700">Invoice</span>}
            {existingDocs.invoice && !showLabels && (
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full" />
            )}
          </>
        )}
      </button>
    </div>
  );
};