import React, { useState } from 'react';
import { format, parseISO } from 'date-fns';

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
  practice_number?: string;
  primary_color?: string;
}

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  membershipNumber?: string;
}

interface PuppeteerPDFProps {
  invoice: Invoice;
  patient: PatientInfo;
  practice: PracticeInfo;
}

// Generate HTML template for Puppeteer
const generateInvoiceHTML = (invoice: Invoice, patient: PatientInfo, practice: PracticeInfo): string => {
  const currency = practice.country === 'Namibia' ? 'N$' : '$';
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e', border: '#fbbf24' };
      case 'overdue':
        return { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5' };
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
    }
  };

  const statusColors = getStatusColor(invoice.payment_status);

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>Invoice ${invoice.invoice_number}</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Montserrat', Arial, sans-serif;
          font-size: 12px;
          line-height: 1.4;
          color: #333;
          background: white;
          padding: 40px;
          width: 210mm;
          min-height: 297mm;
          margin: 0 auto;
        }
        
        .watermark {
          position: absolute;
          top: 45%;
          left: 35%;
          font-size: 60px;
          color: #f3f4f6;
          font-weight: 700;
          opacity: 0.15;
          transform: rotate(-45deg);
          pointer-events: none;
          z-index: 1;
        }
        
        .invoice-container {
          position: relative;
          z-index: 2;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 35px;
          padding-bottom: 20px;
          border-bottom: 2px solid #6b7280;
        }
        
        .practice-section {
          flex: 1;
          max-width: 55%;
        }
        
        .logo-row {
          display: flex;
          align-items: flex-start;
          margin-bottom: 12px;
        }
        
        .logo {
          width: 50px;
          height: 50px;
          margin-right: 15px;
          border-radius: 8px;
        }
        
        .practice-info {
          flex: 1;
        }
        
        .practice-name {
          font-size: 18px;
          font-weight: 700;
          color: #1f2937;
          margin-bottom: 4px;
        }
        
        .practice-tagline {
          font-size: 11px;
          color: #6b7280;
          margin-bottom: 6px;
          font-weight: 400;
        }
        
        .practice-details {
          font-size: 9px;
          color: #4b5563;
          line-height: 1.4;
        }
        
        .invoice-section {
          flex: 1;
          max-width: 40%;
          text-align: right;
        }
        
        .invoice-title {
          font-size: 32px;
          font-weight: 700;
          color: #374151;
          margin-bottom: 15px;
          letter-spacing: 1px;
        }
        
        .invoice-number {
          font-size: 16px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 5px;
        }
        
        .invoice-date {
          font-size: 10px;
          color: #6b7280;
          margin-bottom: 12px;
        }
        
        .status-badge {
          background-color: ${statusColors.bg};
          border: 1px solid ${statusColors.border};
          border-radius: 6px;
          padding: 6px 12px;
          display: inline-block;
        }
        
        .status-text {
          font-size: 9px;
          font-weight: 600;
          color: ${statusColors.text};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .billing-section {
          display: flex;
          justify-content: space-between;
          margin-bottom: 25px;
          gap: 20px;
        }
        
        .billing-card {
          flex: 1;
          background-color: #f9fafb;
          border-radius: 8px;
          padding: 15px;
          border: 1px solid #e5e7eb;
        }
        
        .card-title {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .card-content {
          font-size: 9px;
          color: #4b5563;
          line-height: 1.5;
        }
        
        .card-bold-text {
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 3px;
          font-size: 10px;
        }
        
        .visit-section {
          background-color: #f9fafb;
          border-radius: 8px;
          padding: 12px;
          margin-bottom: 20px;
          border: 1px solid #e5e7eb;
        }
        
        .visit-title {
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 5px;
        }
        
        .visit-details {
          font-size: 9px;
          color: #4b5563;
          line-height: 1.4;
        }
        
        .services-section {
          margin-bottom: 25px;
        }
        
        .section-title {
          font-size: 13px;
          font-weight: 600;
          color: #1f2937;
          margin-bottom: 12px;
          padding-bottom: 4px;
          border-bottom: 1px solid #e5e7eb;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .services-table {
          width: 100%;
          border-collapse: collapse;
          background-color: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }
        
        .table-header {
          background-color: #6b7280;
        }
        
        .table-header th {
          padding: 10px;
          font-size: 9px;
          font-weight: 600;
          color: #ffffff;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          text-align: left;
        }
        
        .table-row {
          border-bottom: 1px solid #f3f4f6;
        }
        
        .table-row:nth-child(even) {
          background-color: #f9fafb;
        }
        
        .table-row td {
          padding: 10px;
          font-size: 9px;
          color: #4b5563;
          min-height: 35px;
          vertical-align: middle;
        }
        
        .cell-bold {
          font-weight: 600;
        }
        
        .cell-code {
          width: 12%;
          font-weight: 600;
          color: #1f2937;
        }
        
        .cell-description {
          width: 38%;
        }
        
        .cell-qty {
          width: 8%;
          text-align: center;
        }
        
        .cell-price {
          width: 14%;
          text-align: right;
        }
        
        .cell-aid {
          width: 14%;
          text-align: right;
          color: #374151;
        }
        
        .cell-total {
          width: 14%;
          text-align: right;
          color: #1f2937;
        }
        
        .summary-section {
          margin-top: 20px;
          margin-left: auto;
          width: 55%;
        }
        
        .summary-card {
          background-color: #f9fafb;
          border-radius: 8px;
          padding: 15px;
          border: 1px solid #e5e7eb;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 5px 10px;
        }
        
        .summary-row-total {
          background-color: #374151;
          margin: 10px -15px -15px -15px;
          padding: 10px 20px;
          border-radius: 0 0 8px 8px;
        }
        
        .summary-label {
          font-size: 10px;
          color: #4b5563;
        }
        
        .summary-label-total {
          font-size: 11px;
          color: #ffffff;
          font-weight: 600;
          text-transform: uppercase;
        }
        
        .summary-value {
          font-size: 10px;
          font-weight: 600;
          color: #1f2937;
        }
        
        .summary-value-total {
          font-size: 14px;
          font-weight: 700;
          color: #ffffff;
        }
        
        .footer {
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          text-align: center;
          font-size: 9px;
          color: #6b7280;
          line-height: 1.5;
        }
        
        .footer-bold {
          color: #374151;
          font-weight: 600;
        }
        
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      ${invoice.payment_status === 'paid' ? '<div class="watermark">PAID</div>' : ''}
      
      <div class="invoice-container">
        <!-- Header -->
        <div class="header">
          <div class="practice-section">
            <div class="logo-row">
              ${practice.logo_url ? `<img src="${practice.logo_url}" alt="Practice Logo" class="logo">` : ''}
              <div class="practice-info">
                <div class="practice-name">${practice.name}</div>
                <div class="practice-tagline">Excellence in Healthcare</div>
              </div>
            </div>
            <div class="practice-details">
              ${practice.address ? `<div>${practice.address}</div>` : ''}
              ${practice.city && practice.country ? `<div>${practice.city}, ${practice.country} ${practice.postal_code || ''}</div>` : ''}
              ${practice.contact_phone ? `<div>Tel: ${practice.contact_phone}</div>` : ''}
              ${practice.contact_email ? `<div>Email: ${practice.contact_email}</div>` : ''}
              ${practice.practice_number ? `<div>Practice No: ${practice.practice_number}</div>` : ''}
              ${practice.license_number ? `<div>License: ${practice.license_number}</div>` : ''}
            </div>
          </div>
          
          <div class="invoice-section">
            <div class="invoice-title">INVOICE</div>
            <div class="invoice-number">#${invoice.invoice_number}</div>
            <div class="invoice-date">Date: ${format(parseISO(invoice.created_at), 'dd MMMM yyyy')}</div>
            <div class="status-badge">
              <span class="status-text">${invoice.payment_status.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <!-- Billing Information -->
        <div class="billing-section">
          <div class="billing-card">
            <div class="card-title">Bill To</div>
            <div class="card-content">
              <div class="card-bold-text">${patient.name}</div>
              ${patient.phone ? `<div>Phone: ${patient.phone}</div>` : ''}
              ${patient.email ? `<div>Email: ${patient.email}</div>` : ''}
              ${patient.address ? `<div>${patient.address}</div>` : ''}
            </div>
          </div>

          ${patient.medicalAidProvider ? `
            <div class="billing-card">
              <div class="card-title">Medical Aid Details</div>
              <div class="card-content">
                <div class="card-bold-text">${patient.medicalAidProvider}</div>
                ${patient.membershipNumber ? `<div>Member No: ${patient.membershipNumber}</div>` : ''}
                <div style="margin-top: 5px; color: #374151; font-weight: bold;">
                  Coverage: ${currency} ${invoice.medical_aid_covered.toFixed(2)}
                </div>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Visit Information -->
        ${invoice.visit_date ? `
          <div class="visit-section">
            <div class="visit-title">
              Visit #${invoice.visit_number} - ${format(parseISO(invoice.visit_date), 'dd MMMM yyyy')}
            </div>
            ${invoice.chief_complaint ? `
              <div class="visit-details">
                Chief Complaint: ${invoice.chief_complaint}
              </div>
            ` : ''}
          </div>
        ` : ''}

        <!-- Services Table -->
        <div class="services-section">
          <div class="section-title">Services & Procedures</div>
          
          <table class="services-table">
            <thead class="table-header">
              <tr>
                <th class="cell-code">Code</th>
                <th class="cell-description">Description</th>
                <th class="cell-qty">Qty</th>
                <th class="cell-price">Unit Price</th>
                <th class="cell-aid">Med Aid</th>
                <th class="cell-total">Total</th>
              </tr>
            </thead>
            <tbody>
              ${invoice.services.map((service, index) => `
                <tr class="table-row">
                  <td class="cell-code cell-bold">${service.code}</td>
                  <td class="cell-description">${service.description}</td>
                  <td class="cell-qty">${service.quantity}</td>
                  <td class="cell-price cell-bold">${currency} ${service.unit_price.toFixed(2)}</td>
                  <td class="cell-aid cell-bold">${currency} ${service.medical_aid_covered.toFixed(2)}</td>
                  <td class="cell-total cell-bold">${currency} ${service.total_price.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Summary -->
        <div class="summary-section">
          <div class="summary-card">
            <div class="summary-row">
              <span class="summary-label">Subtotal:</span>
              <span class="summary-value">${currency} ${invoice.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}</span>
            </div>
            
            ${invoice.medical_aid_covered > 0 ? `
              <div class="summary-row">
                <span class="summary-label">Medical Aid Coverage:</span>
                <span class="summary-value" style="color: #374151;">-${currency} ${invoice.medical_aid_covered.toFixed(2)}</span>
              </div>
            ` : ''}
            
            <div class="summary-row">
              <span class="summary-label">Patient Portion:</span>
              <span class="summary-value">${currency} ${invoice.patient_portion.toFixed(2)}</span>
            </div>
            
            <div class="summary-row-total">
              <div class="summary-row">
                <span class="summary-label-total">Total Amount Due:</span>
                <span class="summary-value-total">${currency} ${invoice.total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="footer">
          Payment is due within 30 days. Thank you for choosing 
          <span class="footer-bold">${practice.name}</span><br>
          For inquiries: ${practice.contact_phone} • ${practice.contact_email}
        </div>
      </div>
    </body>
    </html>
  `;
};

const PuppeteerPDF: React.FC<PuppeteerPDFProps> = ({ invoice, patient, practice }) => {
  const [generating, setGenerating] = useState(false);

  const generatePDF = async () => {
    setGenerating(true);
    
    try {
      const html = generateInvoiceHTML(invoice, patient, practice);
      
      const response = await fetch('/api/generate-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ html, filename: `invoice-${invoice.invoice_number}.pdf` }),
      });

      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `invoice-${invoice.invoice_number}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      console.log('✅ PDF generated successfully using Puppeteer');
    } catch (error) {
      console.error('❌ PDF generation failed:', error);
      throw error;
    } finally {
      setGenerating(false);
    }
  };

  return (
    <button
      onClick={generatePDF}
      disabled={generating}
      className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2"
    >
      {generating ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Generate PDF (Puppeteer)
        </>
      )}
    </button>
  );
};

// Export functions for compatibility
export const generateInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<Blob> => {
  const html = generateInvoiceHTML(invoice, patient, practice);
  
  const response = await fetch('/api/generate-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ html, filename: `invoice-${invoice.invoice_number}.pdf` }),
  });

  if (!response.ok) {
    throw new Error(`PDF generation failed: ${response.statusText}`);
  }

  return await response.blob();
};

export const downloadInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<void> => {
  const blob = await generateInvoicePDF(invoice, patient, practice);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `invoice-${invoice.invoice_number}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default PuppeteerPDF;