import React, { useState } from 'react';
import Html2CanvasPDF from './Html2CanvasPDF';

interface Invoice {
  id: string;
  invoice_number: string;
  visit_id: string;
  visit_date?: string;
  visit_number?: number;
  chief_complaint?: string;
  payment_status: 'paid' | 'pending' | 'overdue' | 'cancelled';
  payment_method?: string;
  total: number;
  created_at: string;
  services: Service[];
  medical_aid_covered: number;
  patient_portion: number;
}

interface Service {
  id: string;
  code: string;
  description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  medical_aid_covered: number;
  patient_portion: number;
}

// PracticeInfo interface removed - components now fetch practice data directly from database

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  membershipNumber?: string;
}

interface UnifiedPDFGeneratorProps {
  invoice: Invoice;
  patient: PatientInfo;
}

type PDFMethod = 'html2canvas' | 'puppeteer' | 'browser-print';

const UnifiedPDFGenerator: React.FC<UnifiedPDFGeneratorProps> = ({
  invoice,
  patient
}) => {
  const [selectedMethod, setSelectedMethod] = useState<PDFMethod>('html2canvas');
  const [generating, setGenerating] = useState(false);

  // A method with unavailableReason is listed with the reason but cannot be chosen
  const methods: Array<{
    id: PDFMethod;
    name: string;
    description: string;
    recommended: boolean;
    unavailableReason?: string;
  }> = [
    {
      id: 'html2canvas',
      name: 'Download PDF',
      description: 'Saves the invoice as a PDF file on this computer.',
      recommended: true
    },
    {
      id: 'puppeteer',
      name: 'Server PDF',
      description: 'Creates the PDF on a server.',
      recommended: false,
      // The app has no /api/generate-pdf endpoint (only an example in server-examples/), and this
      // option never received the practice details, so its button failed without a message
      unavailableReason: 'Not available: no PDF server has been set up for this system.'
    },
    {
      id: 'browser-print',
      name: 'Print',
      description: "Opens your browser's print window for this page.",
      recommended: false
    }
  ];

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Download or print this invoice
        </h3>
        <p className="text-sm text-gray-600">
          Choose how you want a copy of this invoice.
        </p>
      </div>

      {/* Method Selection */}
      <div className="grid gap-4 mb-6">
        {methods.map((method) => (
          <div
            key={method.id}
            className={`border rounded-lg p-4 transition-all ${
              method.unavailableReason
                ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                : selectedMethod === method.id
                  ? 'border-blue-500 bg-blue-50 cursor-pointer'
                  : 'border-gray-200 hover:border-gray-300 cursor-pointer'
            } ${method.recommended ? 'ring-2 ring-green-200' : ''}`}
            onClick={() => {
              if (!method.unavailableReason) setSelectedMethod(method.id);
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <input
                type="radio"
                name="invoice-copy-method"
                checked={selectedMethod === method.id}
                disabled={Boolean(method.unavailableReason)}
                onChange={() => setSelectedMethod(method.id)}
                className="text-blue-600"
                aria-label={method.name}
              />
              <h4 className={`font-medium ${method.unavailableReason ? 'text-gray-500' : 'text-gray-900'}`}>
                {method.name}
                {method.recommended && (
                  <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                    Recommended
                  </span>
                )}
              </h4>
            </div>

            <p className="text-sm text-gray-600">{method.description}</p>
            {method.unavailableReason && (
              <p className="mt-1 text-xs font-medium text-amber-700">{method.unavailableReason}</p>
            )}
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="border-t pt-4">
        <div className="flex flex-wrap gap-3">
          {selectedMethod === 'html2canvas' && (
            <Html2CanvasPDF
              invoice={invoice}
              patient={patient}
              onGenerating={setGenerating}
            />
          )}
          
          {selectedMethod === 'browser-print' && (
            <button
              onClick={handleBrowserPrint}
              className="bg-purple-600 hover:bg-purple-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a1 1 0 001-1v-4a1 1 0 00-1-1H9a1 1 0 00-1 1v4a1 1 0 001 1zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print Invoice
            </button>
          )}
        </div>
      </div>

      {/* Status */}
      {generating && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm text-blue-800">Generating PDF...</span>
          </div>
        </div>
      )}
    </div>
  );
};

// Export functions for backward compatibility
export const generateInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo
): Promise<Blob> => {
  // Default to html2canvas method since it works immediately
  throw new Error('Use the UnifiedPDFGenerator component to select your preferred PDF generation method');
};

export const downloadInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo
): Promise<void> => {
  // Default to html2canvas method since it works immediately
  throw new Error('Use the UnifiedPDFGenerator component to select your preferred PDF generation method');
};

export default UnifiedPDFGenerator;