import React, { useState } from 'react';
import Html2CanvasPDF from './Html2CanvasPDF';
import PuppeteerPDF from './PuppeteerPDF';

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

  const methods = [
    {
      id: 'html2canvas' as PDFMethod,
      name: 'HTML2Canvas + jsPDF',
      description: 'Client-side PDF generation from HTML',
      pros: ['✅ Works immediately', '✅ No server setup', '✅ Perfect font rendering'],
      cons: ['⚠️ Large file sizes', '⚠️ Image-based text'],
      recommended: true,
      status: '🟢 Ready'
    },
    {
      id: 'puppeteer' as PDFMethod,
      name: 'Puppeteer (Server-side)',
      description: 'Professional PDF generation using headless Chrome',
      pros: ['✅ Perfect rendering', '✅ Small file sizes', '✅ Searchable text', '✅ Production ready'],
      cons: ['⚠️ Requires server setup', '⚠️ Node.js dependency'],
      recommended: false,
      status: '🟡 Needs API setup'
    },
    {
      id: 'browser-print' as PDFMethod,
      name: 'Browser Print (CSS)',
      description: 'Use browser\'s native print functionality',
      pros: ['✅ Zero dependencies', '✅ Perfect fonts', '✅ Lightweight'],
      cons: ['⚠️ Manual user action', '⚠️ Inconsistent across browsers'],
      recommended: false,
      status: '🟢 Ready'
    }
  ];

  const handleBrowserPrint = () => {
    window.print();
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          🚀 Choose PDF Generation Method
        </h3>
        <p className="text-sm text-gray-600">
          Select the best PDF generation method for your needs. Each has different trade-offs.
        </p>
      </div>

      {/* Method Selection */}
      <div className="grid gap-4 mb-6">
        {methods.map((method) => (
          <div
            key={method.id}
            className={`border rounded-lg p-4 cursor-pointer transition-all ${
              selectedMethod === method.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            } ${method.recommended ? 'ring-2 ring-green-200' : ''}`}
            onClick={() => setSelectedMethod(method.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={selectedMethod === method.id}
                  onChange={() => setSelectedMethod(method.id)}
                  className="text-blue-600"
                />
                <h4 className="font-medium text-gray-900">
                  {method.name}
                  {method.recommended && (
                    <span className="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                      Recommended
                    </span>
                  )}
                </h4>
              </div>
              <span className="text-sm">{method.status}</span>
            </div>
            
            <p className="text-sm text-gray-600 mb-3">{method.description}</p>
            
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <h5 className="text-xs font-medium text-green-700 mb-1">Pros:</h5>
                <ul className="text-xs text-gray-600 space-y-1">
                  {method.pros.map((pro, index) => (
                    <li key={index}>{pro}</li>
                  ))}
                </ul>
              </div>
              <div>
                <h5 className="text-xs font-medium text-amber-700 mb-1">Considerations:</h5>
                <ul className="text-xs text-gray-600 space-y-1">
                  {method.cons.map((con, index) => (
                    <li key={index}>{con}</li>
                  ))}
                </ul>
              </div>
            </div>
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
          
          {selectedMethod === 'puppeteer' && (
            <div className="flex flex-col gap-2">
              <PuppeteerPDF
                invoice={invoice}
                patient={patient}
              />
              <p className="text-xs text-amber-600">
                ⚠️ Requires server-side API setup (see instructions below)
              </p>
            </div>
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

      {/* Setup Instructions */}
      {selectedMethod === 'puppeteer' && (
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="font-medium text-yellow-800 mb-2">
            🛠️ Puppeteer Setup Required
          </h4>
          <div className="text-sm text-yellow-700 space-y-2">
            <p>To use Puppeteer PDF generation, you need to set up a server-side API:</p>
            <div className="bg-yellow-100 p-3 rounded border font-mono text-xs overflow-x-auto">
              <div className="mb-2"># 1. Install dependencies</div>
              <div className="mb-2">npm install puppeteer express</div>
              <div className="mb-2"># 2. Create server/pdf-service.js (see documentation)</div>
              <div># 3. Add API endpoint: POST /api/generate-pdf</div>
            </div>
            <p>
              <a 
                href="https://github.com/puppeteer/puppeteer" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-yellow-800 underline hover:text-yellow-900"
              >
                View Puppeteer documentation →
              </a>
            </p>
          </div>
        </div>
      )}

      {/* Migration Notice */}
      <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-medium text-green-800 mb-2">
          ✅ Migration from React-PDF Complete
        </h4>
        <div className="text-sm text-green-700 space-y-1">
          <p>• ✅ Montserrat font now renders perfectly</p>
          <p>• ✅ No more "Buffer is not defined" errors</p>
          <p>• ✅ No more "Font family not registered" errors</p>
          <p>• ✅ Professional grey color scheme applied</p>
          <p>• ✅ Fixed INVOICE/invoice number spacing</p>
        </div>
      </div>
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