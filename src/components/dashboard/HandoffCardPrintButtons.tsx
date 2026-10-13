import React, { useState } from 'react';
import { Icon } from '@iconify/react';
import { documentGenerationService } from '../../services/documentGenerationService';
import { documentStatusService } from '../../services/documentStatusService';
import { RECORDS_BUCKET, openRecord } from '../../services/recordFiles';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';
import { useAuthStore } from '../../stores/authStore';
import { latestDocumentByType } from './handoffDocuments';

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
  // Where each document is stored; a link is made only when it is opened
  const [existingDocs, setExistingDocs] = useState<Record<string, { path: string; bucket: string | null }>>({});
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
    
    // Subscribe to real-time document updates
    const unsubscribe = documentStatusService.subscribeToVisit(visitId, (status) => {
      console.log('📄 Document status update:', status);
      // When documents are updated, refresh our local state
      checkExistingDocuments();
      checkAvailableData();
    });
    
    // Also keep a fallback poll every 10 seconds (less frequent)
    const interval = setInterval(() => {
      // Nobody sees the buttons while the app is in a background tab: skip (the realtime updates above still arrive)
      if (document.hidden) return;
      checkExistingDocuments();
      checkAvailableData();
    }, 10000);
    
    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [visitId]);

  const checkExistingDocuments = async () => {
    try {
      const docs = await documentGenerationService.getVisitDocuments(visitId);
      // The newest copy of each document (each visit save stores a new one): the visit as it is now
      setExistingDocs(latestDocumentByType(docs));
    } catch (error) {
      console.error('Error checking existing documents:', error);
    }
  };

  const checkAvailableData = async () => {
    try {
      // Is there a prescription, a leave form, an invoice with lines? Only whether they exist is needed, so ids only,
      // asked for together (this runs every 10 seconds for each handed-off visit)
      const [{ data: medications }, { data: leaveForm }, { data: invoice }] = await Promise.all([
        supabase
          .from('medications')
          .select('id')
          .eq('visit_id', visitId)
          .limit(1),
        (supabase as any)
          .from('leave_forms')
          .select('id')
          .eq('visit_id', visitId)
          .maybeSingle(),
        supabase
          .from('invoices_enhanced')
          .select('id, invoice_services (id)')
          .eq('visit_id', visitId)
          .maybeSingle()
      ]);
      
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
    const existing = existingDocs[docType];
    if (existing) {
      openRecord(existing.path, existing.bucket).catch(error => {
        console.error(`Error opening ${docType}:`, error);
        toast.error('The document could not be opened. Please try again.');
      });
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
        if (generatedDoc.filePath) {
          // Update existing docs cache
          setExistingDocs(prev => ({ ...prev, [docType]: { path: generatedDoc.filePath, bucket: RECORDS_BUCKET } }));

          // Open the document (a short-lived link; a blocked pop-up falls back to a link click)
          await openRecord(generatedDoc.filePath, RECORDS_BUCKET);

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

  // A button is only enabled once its document exists, so the tooltip says why it is greyed out
  const buttonTitle = (docType: 'prescription' | 'leave_form' | 'invoice', name: string) => {
    if (existingDocs[docType]) return `Print ${name}`;
    if (availableData[docType]) return `No ${name} document yet: open the visit to create it`;
    return `No ${name} for this visit`;
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
        title={buttonTitle('prescription', 'prescription')}
        aria-label={buttonTitle('prescription', 'prescription')}
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
        title={buttonTitle('leave_form', 'leave form')}
        aria-label={buttonTitle('leave_form', 'leave form')}
      >
        <Icon icon="solar:document-medicine-bold-duotone" className={`w-5 h-5 ${existingDocs.leave_form ? 'text-orange-600 group-hover:text-orange-700' : 'text-gray-400'}`} />
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
        title={buttonTitle('invoice', 'invoice')}
        aria-label={buttonTitle('invoice', 'invoice')}
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