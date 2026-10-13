import React, { useState, useEffect } from 'react';
import { Icon } from '@iconify/react';
import { motion } from 'framer-motion';
import { documentGenerationService } from '../../services/documentGenerationService';
import { openRecord } from '../../services/recordFiles';
import { supabase } from '../../lib/supabase';
import { formatServiceDate } from '../../utils/billing/dates';
import toast from 'react-hot-toast';

interface HandoffCardProps {
  visitId: string;
  patientId: string;
  practiceId: string;
  onDocumentsGenerated?: () => void;
}

const HandoffCard: React.FC<HandoffCardProps> = ({ 
  visitId, 
  patientId, 
  practiceId,
  onDocumentsGenerated 
}) => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load existing documents
  useEffect(() => {
    loadDocuments();
  }, [visitId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const docs = await documentGenerationService.getVisitDocuments(visitId);
      setDocuments(docs);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateDocuments = async () => {
    try {
      setIsGenerating(true);
      
      // Generate all available documents
      const generatedDocs = await documentGenerationService.generateVisitDocuments({
        visitId,
        patientId,
        practiceId,
        documents: ['prescription', 'leave_form', 'invoice']
      });

      if (generatedDocs.length > 0) {
        toast.success(`Generated ${generatedDocs.length} document(s) successfully`);
        await loadDocuments();
        onDocumentsGenerated?.();
      } else {
        toast('No documents to generate for this visit');
      }
    } catch (error) {
      console.error('Error generating documents:', error);
      toast.error('Failed to generate documents');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrintDocument = (doc: any) => {
    openRecord(doc.file_path, doc.storage_bucket).catch(error => {
      console.error('Error opening document:', error);
      toast.error('The document could not be opened. Please try again.');
    });
  };

  const handleDownloadDocument = async (doc: any) => {
    try {
      const url = await documentGenerationService.getDocumentUrl(doc.file_path, doc.storage_bucket);
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = doc.document_name + '.pdf';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error downloading document:', error);
      toast.error('Failed to download document');
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'prescription':
        return 'solar:pills-3-bold-duotone';
      case 'leave_form':
        return 'solar:calendar-add-bold-duotone';
      case 'invoice':
        return 'solar:bill-list-bold-duotone';
      default:
        return 'solar:document-bold-duotone';
    }
  };

  const getDocumentColor = (type: string) => {
    switch (type) {
      case 'prescription':
        return 'text-purple-600';
      case 'leave_form':
        return 'text-blue-600';
      case 'invoice':
        return 'text-green-600';
      default:
        return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Icon icon="solar:refresh-bold-duotone" className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-xl border border-gray-200 shadow-sm p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
            <Icon icon="solar:hand-shake-bold-duotone" className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Visit Documents</h3>
            <p className="text-sm text-gray-500">Printable documents for this visit</p>
          </div>
        </div>
        
        <button
          onClick={handleGenerateDocuments}
          disabled={isGenerating}
          className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating ? (
            <>
              <Icon icon="solar:refresh-bold-duotone" className="w-4 h-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Icon icon="solar:document-add-bold-duotone" className="w-4 h-4" />
              Generate Documents
            </>
          )}
        </button>
      </div>

      {/* Documents List */}
      {documents.length === 0 ? (
        <div className="text-center py-8">
          <Icon icon="solar:document-text-bold-duotone" className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No documents generated yet</p>
          <p className="text-sm text-gray-400 mt-1">Click "Generate Documents" to create printable PDFs</p>
        </div>
      ) : (
        <div className="space-y-3">
          {documents.map((doc) => (
            <motion.div
              key={doc.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg bg-white shadow-sm flex items-center justify-center ${getDocumentColor(doc.document_type)}`}>
                  <Icon icon={getDocumentIcon(doc.document_type)} className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">{doc.document_name}</p>
                  <p className="text-sm text-gray-500">
                    Generated {formatServiceDate(new Date(doc.generated_at || doc.created_at))} at {new Date(doc.generated_at || doc.created_at).toLocaleTimeString()}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePrintDocument(doc)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Print Document"
                >
                  <Icon icon="solar:printer-bold-duotone" className="w-5 h-5" />
                </button>
                <button
                  onClick={() => handleDownloadDocument(doc)}
                  className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                  title="Download Document"
                >
                  <Icon icon="solar:download-bold-duotone" className="w-5 h-5" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <div className="flex gap-3">
          <Icon icon="solar:info-circle-bold-duotone" className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-medium mb-1">Available Documents:</p>
            <ul className="space-y-1 ml-2">
              <li className="flex items-center gap-2">
                <Icon icon="solar:pills-3-bold-duotone" className="w-4 h-4 text-purple-600" />
                <span>Prescription - Generated if medications are prescribed</span>
              </li>
              <li className="flex items-center gap-2">
                <Icon icon="solar:calendar-add-bold-duotone" className="w-4 h-4 text-blue-600" />
                <span>Leave Form - Generated if medical leave is issued</span>
              </li>
              <li className="flex items-center gap-2">
                <Icon icon="solar:bill-list-bold-duotone" className="w-4 h-4 text-green-600" />
                <span>Invoice - Generated if billing services are added</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HandoffCard;