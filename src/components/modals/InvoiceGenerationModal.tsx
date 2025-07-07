import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  FileText,
  Receipt,
  Eye,
  Download,
  Loader2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  services: any[];
  created_at: string;
  payment_status: string;
}

interface InvoiceGenerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
  patientName: string;
  onGenerateInvoice: () => Promise<void>;
  onGenerateReceipt: () => Promise<void>;
  onPreview: () => void;
  isGenerating: boolean;
  generationType: 'invoice' | 'receipt' | null;
}

const InvoiceGenerationModal: React.FC<InvoiceGenerationModalProps> = ({
  isOpen,
  onClose,
  invoice,
  patientName,
  onGenerateInvoice,
  onGenerateReceipt,
  onPreview,
  isGenerating,
  generationType
}) => {
  const [selectedOption, setSelectedOption] = useState<'invoice' | 'receipt' | 'preview' | null>(null);

  console.log('🔍 InvoiceGenerationModal render check:', { isOpen, invoice: !!invoice });
  
  if (!isOpen || !invoice) {
    console.log('❌ Modal not rendering because:', { isOpen, hasInvoice: !!invoice });
    return null;
  }

  console.log('✅ InvoiceGenerationModal rendering with:', { 
    isOpen, 
    invoiceNumber: invoice.invoice_number,
    patientName 
  });

  const handleGenerate = async () => {
    if (selectedOption === 'invoice') {
      await onGenerateInvoice();
    } else if (selectedOption === 'receipt') {
      await onGenerateReceipt();
    } else if (selectedOption === 'preview') {
      onPreview();
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" 
      style={{ zIndex: 9999 }}
      data-testid="invoice-generation-modal"
    >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">Generate Document</h3>
                <p className="text-blue-100 text-sm">Invoice #{invoice.invoice_number}</p>
              </div>
              <button
                onClick={onClose}
                className="p-1 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                disabled={isGenerating}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* Patient Info */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">For Patient:</div>
              <div className="font-semibold text-gray-900">{patientName}</div>
              <div className="text-sm text-gray-600">Total: N$ {invoice.total.toFixed(2)}</div>
            </div>

            {/* Generation Status */}
            {isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <div className="font-medium text-blue-900">
                      Generating {generationType}...
                    </div>
                    <div className="text-sm text-blue-700">
                      Please wait while we create your document
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Options */}
            <div className="space-y-3">
              <div className="text-sm font-medium text-gray-700 mb-3">
                Choose document type:
              </div>

              {/* Invoice Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedOption('invoice')}
                disabled={isGenerating}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  selectedOption === 'invoice'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedOption === 'invoice' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <FileText className={`w-5 h-5 ${
                      selectedOption === 'invoice' ? 'text-blue-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Medical Invoice</div>
                    <div className="text-sm text-gray-600">
                      Professional invoice for payment processing
                    </div>
                  </div>
                  {selectedOption === 'invoice' && (
                    <CheckCircle className="w-5 h-5 text-blue-600 ml-auto" />
                  )}
                </div>
              </motion.button>

              {/* Receipt Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedOption('receipt')}
                disabled={isGenerating}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  selectedOption === 'receipt'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedOption === 'receipt' ? 'bg-green-100' : 'bg-gray-100'
                  }`}>
                    <Receipt className={`w-5 h-5 ${
                      selectedOption === 'receipt' ? 'text-green-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Payment Receipt</div>
                    <div className="text-sm text-gray-600">
                      Proof of payment for completed transactions
                    </div>
                  </div>
                  {selectedOption === 'receipt' && (
                    <CheckCircle className="w-5 h-5 text-green-600 ml-auto" />
                  )}
                </div>
              </motion.button>

              {/* Preview Option */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedOption('preview')}
                disabled={isGenerating}
                className={`w-full p-4 rounded-lg border-2 transition-all ${
                  selectedOption === 'preview'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-gray-300'
                } ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    selectedOption === 'preview' ? 'bg-purple-100' : 'bg-gray-100'
                  }`}>
                    <Eye className={`w-5 h-5 ${
                      selectedOption === 'preview' ? 'text-purple-600' : 'text-gray-600'
                    }`} />
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-gray-900">Preview Document</div>
                    <div className="text-sm text-gray-600">
                      View before generating final document
                    </div>
                  </div>
                  {selectedOption === 'preview' && (
                    <CheckCircle className="w-5 h-5 text-purple-600 ml-auto" />
                  )}
                </div>
              </motion.button>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={!selectedOption || isGenerating}
                className={`flex-1 px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 ${
                  selectedOption === 'invoice'
                    ? 'bg-blue-600 hover:bg-blue-700 text-white'
                    : selectedOption === 'receipt'
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : selectedOption === 'preview'
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                }`}
              >
                {isGenerating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : selectedOption === 'preview' ? (
                  <Eye className="w-4 h-4" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
                {isGenerating
                  ? 'Generating...'
                  : selectedOption === 'preview'
                  ? 'Preview'
                  : selectedOption === 'invoice'
                  ? 'Generate Invoice'
                  : selectedOption === 'receipt'
                  ? 'Generate Receipt'
                  : 'Select Option'
                }
              </button>
            </div>
          </div>
        </motion.div>
      </div>
  );
};

export default InvoiceGenerationModal;