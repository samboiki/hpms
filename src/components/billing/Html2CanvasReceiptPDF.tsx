import React, { useRef, useState, useEffect } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, parseISO } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuthStore } from '../../stores/authStore';

interface Payment {
  id: string;
  receipt_number: string;
  invoice_id: string;
  amount_paid: number;
  payment_method: string;
  payment_date: string;
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
  bank_name?: string;
  account_number?: string;
  branch_code?: string;
  swift_code?: string;
  // Note: This should be populated from practices table using user_id link
}

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  medicalAidShortName?: string;
  membershipNumber?: string;
}

interface Html2CanvasReceiptPDFProps {
  payment: Payment;
  patient: PatientInfo;
  onGenerating?: (generating: boolean) => void;
}

// Load Montserrat font CSS
const fontStyle = `
  @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap');
`;

// Add font style to document head if not already added
if (!document.getElementById('montserrat-font-receipt')) {
  const style = document.createElement('style');
  style.id = 'montserrat-font-receipt';
  style.textContent = fontStyle;
  document.head.appendChild(style);
}

const Html2CanvasReceiptPDF: React.FC<Html2CanvasReceiptPDFProps> = ({
  payment,
  patient,
  onGenerating
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const { user } = useAuthStore();
  const [practice, setPractice] = useState<PracticeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  
  const currency = practice?.country === 'Namibia' ? 'N$' : '$';

  // Header color
  const headerColor = '#80788a';
  
  // Fetch practice details from database
  useEffect(() => {
    const fetchPracticeData = async () => {
      if (!user?.id) return;
      
      try {
        // Get user's practice_id - first try user metadata, then direct property
        let practiceId = user.practice_id;
        
        if (!practiceId && user.user_metadata?.practice_id) {
          practiceId = user.user_metadata.practice_id;
        }
        
        if (!practiceId) {
          console.error('No practice_id found for user');
          return;
        }
        
        console.log('Fetching practice data for practice_id:', practiceId);
        
        // Get practice details from practices table
        const { data: practiceData, error: practiceError } = await supabase
          .from('practices')
          .select(`
            id, name, contact_email, contact_phone, address, city, country,
            postal_code, logo_url, primary_color, tax_number, license_number,
            bank_name, account_number, branch_code, swift_code
          `)
          .eq('id', practiceId)
          .single();
          
        if (practiceError) {
          console.error('Error fetching practice data:', practiceError);
          return;
        }
        
        console.log('Practice data fetched:', practiceData);
        
        // Get medical aid short name if patient has medical aid
        let medicalAidShortName = null;
        if (patient.medicalAidProvider) {
          const { data: medicalAidData } = await supabase
            .from('medical_aid_providers')
            .select('short_name')
            .ilike('name', patient.medicalAidProvider)
            .single();
            
          medicalAidShortName = medicalAidData?.short_name;
          console.log('Medical aid short name:', medicalAidShortName);
        }
        
        setPractice({
          ...practiceData,
          medicalAidShortName
        } as PracticeInfo & { medicalAidShortName?: string });
        
      } catch (error) {
        console.error('Error fetching practice data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPracticeData();
  }, [user?.id, user?.practice_id, user?.user_metadata?.practice_id, patient.medicalAidProvider]);

  const generatePDF = async () => {
    if (!receiptRef.current) return;

    onGenerating?.(true);
    
    try {
      // Wait for fonts to load
      await document.fonts.ready;
      
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3, // High resolution for crisp text
        useCORS: true,
        letterRendering: true,
        backgroundColor: '#ffffff',
        width: 794, // A4 width at 96 DPI
        height: 1123, // A4 height at 96 DPI
        scrollX: 0,
        scrollY: 0,
        windowWidth: 794,
        windowHeight: 1123,
        onclone: (clonedDoc) => {
          // Ensure fonts are loaded in the cloned document
          const clonedStyle = clonedDoc.createElement('style');
          clonedStyle.textContent = fontStyle;
          clonedDoc.head.appendChild(clonedStyle);
        }
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
        compress: true
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pdfWidth;
      const imgHeight = (canvas.height * pdfWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      // Add first page
      pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
      heightLeft -= pdfHeight;

      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight, '', 'FAST');
        heightLeft -= pdfHeight;
      }

      // Save the PDF
      pdf.save(`receipt-${payment.receipt_number}.pdf`);
      
      console.log('✅ Receipt PDF generated successfully using html2canvas + jsPDF');
    } catch (error) {
      console.error('❌ Receipt PDF generation failed:', error);
      throw new Error(`Failed to generate receipt PDF: ${error.message}`);
    } finally {
      onGenerating?.(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-gray-600">Loading practice details...</div>
      </div>
    );
  }
  
  if (!practice) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="text-red-600">Error: Could not load practice details</div>
      </div>
    );
  }

  return (
    <div>
      {/* PDF Generation Button */}
      <button
        onClick={generatePDF}
        className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg flex items-center gap-2 mb-4"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        Download Receipt PDF
      </button>

      {/* Receipt Content - Hidden but rendered for PDF generation */}
      <div
        ref={receiptRef}
        style={{
          width: '794px', // A4 width at 96 DPI
          minHeight: '1123px', // A4 height at 96 DPI
          fontFamily: 'Montserrat, Arial, sans-serif',
          fontSize: '12px',
          lineHeight: '1.4',
          color: '#333',
          backgroundColor: '#ffffff',
          padding: '40px',
          margin: '0 auto',
          boxSizing: 'border-box',
          position: 'relative'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '35px',
            paddingBottom: '20px',
            paddingTop: '15px',
            paddingLeft: '20px',
            paddingRight: '20px',
            marginLeft: '-40px',
            marginRight: '-40px',
            marginTop: '-40px',
            background: headerColor,
            zIndex: 2,
            position: 'relative'
          }}
        >
          <div style={{ flex: 1, maxWidth: '55%' }}>
            <div style={{ flex: 1, marginBottom: '12px' }}>
              <div
                style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  fontFamily: 'Rubik, sans-serif',
                  color: '#ffffff',
                  marginBottom: '4px'
                }}
              >
                {practice.name}
              </div>
              <div
                style={{
                  fontSize: '11px',
                  color: 'rgba(255,255,255,0.8)',
                  marginBottom: '6px',
                  fontWeight: '400'
                }}
              >
                Excellence in Healthcare
              </div>
            </div>
            <div
              style={{
                fontSize: '11px',
                color: '#ffffff',
                lineHeight: '1.5',
                fontWeight: '500'
              }}
            >
              {practice.address && <div>{practice.address}</div>}
              {practice.city && practice.country && (
                <div>{practice.city}, {practice.country} {practice.postal_code || ''}</div>
              )}
              {practice.contact_phone && <div>Tel: {practice.contact_phone}</div>}
              {practice.contact_email && <div>Email: {practice.contact_email}</div>}
              {practice.practice_number && <div>Practice No: {practice.practice_number}</div>}
              {practice.license_number && <div>License: {practice.license_number}</div>}
            </div>
          </div>

          <div
            style={{
              flex: 1,
              maxWidth: '40%',
              textAlign: 'right'
            }}
          >
            {/* Single row with PAYMENT RECEIPT, Receipt Number and Dates */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: '8px'
              }}
            >
              {/* PAYMENT RECEIPT Title */}
              <div style={{ display: 'flex' }}>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#ffffff',
                    letterSpacing: '1px'
                  }}
                >
                  PAYMENT{' '}
                </span>
                <span
                  style={{
                    fontSize: '24px',
                    fontWeight: '500',
                    color: 'rgba(255,255,255,0.8)',
                    letterSpacing: '1px'
                  }}
                >
                  RECEIPT
                </span>
              </div>
              
              {/* Receipt Number */}
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#ffffff'
                }}
              >
                #{payment.receipt_number}
              </div>
              
              {/* Date and Method Row in single line */}
              <div
                style={{
                  display: 'flex',
                  gap: '20px',
                  fontSize: '9px',
                  color: '#ffffff'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '2px', fontSize: '8px' }}>PAID DATE</div>
                  <div style={{ fontWeight: '600' }}>{format(parseISO(payment.payment_date), 'dd MMM yyyy')}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', marginBottom: '2px', fontSize: '8px' }}>METHOD</div>
                  <div style={{ fontWeight: '600' }}>{payment.payment_method}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* PREPARED FOR Title */}
        <div
          style={{
            fontSize: '13px',
            fontWeight: '600',
            color: '#1f2937',
            marginBottom: '8px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}
        >
          PREPARED FOR
        </div>

        {/* Billing Information */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '20px'
          }}
        >
          <div
            style={{
              flex: 1,
              borderRadius: '8px',
              padding: '15px',
              border: '1px solid #e5e7eb'
            }}
          >
            <div
              style={{
                fontSize: '11px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}
            >
              Paid By
            </div>
            <div
              style={{
                fontSize: '9px',
                color: '#4b5563',
                lineHeight: '1.5'
              }}
            >
              <div
                style={{
                  fontWeight: '600',
                  color: '#1f2937',
                  marginBottom: '3px',
                  fontSize: '10px'
                }}
              >
                {patient.name}
              </div>
              {patient.phone && <div>Phone: {patient.phone}</div>}
              {patient.email && <div>Email: {patient.email}</div>}
              {patient.address && <div>{patient.address}</div>}
            </div>
          </div>

          {patient.medicalAidProvider && (
            <div
              style={{
                flex: 1,
                borderRadius: '8px',
                padding: '15px',
                border: '1px solid #e5e7eb'
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: '#374151',
                  marginBottom: '8px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}
              >
                Medical Aid Details
              </div>
              <div
                style={{
                  fontSize: '9px',
                  color: '#4b5563',
                  lineHeight: '1.5'
                }}
              >
                <div
                  style={{
                    fontWeight: '600',
                    color: '#1f2937',
                    marginBottom: '3px',
                    fontSize: '10px'
                  }}
                >
                  {(practice as PracticeInfo & { medicalAidShortName?: string })?.medicalAidShortName || patient.medicalAidShortName || patient.medicalAidProvider}
                </div>
                {patient.membershipNumber && (
                  <div>Member No: {patient.membershipNumber}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Payment Details Section with special #76a5af color */}
        <div
          style={{
            backgroundColor: '#76a5af',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '25px',
            border: '1px solid #5a8893'
          }}
        >
          <div
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#ffffff',
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Payment Details
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingVertical: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)' }}>Total Amount:</span>
            <span style={{ fontSize: '10px', fontWeight: '600', color: '#ffffff' }}>
              {currency} {payment.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
            </span>
          </div>
          
          {payment.medical_aid_covered > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingVertical: '4px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)' }}>Medical Aid Coverage:</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#ffffff' }}>
                {currency} {payment.medical_aid_covered.toFixed(2)}
              </span>
            </div>
          )}
          
          {payment.patient_portion > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingVertical: '4px' }}>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)' }}>Patient Portion:</span>
              <span style={{ fontSize: '10px', fontWeight: '600', color: '#ffffff' }}>
                {currency} {payment.patient_portion.toFixed(2)}
              </span>
            </div>
          )}
          
          <div
            style={{
              borderTop: '1px solid rgba(255,255,255,0.3)',
              paddingTop: '8px',
              marginTop: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              paddingVertical: '4px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: '700', color: '#ffffff' }}>Amount Paid:</span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>
              {currency} {payment.amount_paid.toFixed(2)}
            </span>
          </div>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', paddingVertical: '4px' }}>
            <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.9)' }}>Payment Method:</span>
            <span style={{ fontSize: '10px', fontWeight: '600', color: '#ffffff' }}>{payment.payment_method}</span>
          </div>
        </div>

        {/* Services Table */}
        <div style={{ marginBottom: '25px' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: '600',
              color: '#1f2937',
              marginBottom: '12px',
              paddingBottom: '4px',
              borderBottom: '1px solid #e5e7eb',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Services
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#ffffff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#535d8e' }}>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'left',
                    width: '12%'
                  }}
                >
                  Code
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'left',
                    width: '50%'
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'center',
                    width: '8%'
                  }}
                >
                  Qty
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'right',
                    width: '10%'
                  }}
                >
                  Unit Price
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'right',
                    width: '10%'
                  }}
                >
                  Med Aid
                </th>
                <th
                  style={{
                    padding: '10px',
                    fontSize: '11px',
                    fontWeight: '600',
                    color: '#ffffff',
                    textTransform: 'uppercase',
                    letterSpacing: '0.3px',
                    textAlign: 'right',
                    width: '10%'
                  }}
                >
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {payment.services.map((service, index) => (
                <tr
                  key={service.id}
                  style={{
                    backgroundColor: index % 2 === 1 ? '#f9fafb' : 'transparent',
                    borderBottom: '1px solid #f3f4f6'
                  }}
                >
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#1f2937',
                      fontWeight: '600'
                    }}
                  >
                    {service.code}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#4b5563'
                    }}
                  >
                    {service.description}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#4b5563',
                      textAlign: 'center'
                    }}
                  >
                    {service.quantity}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#4b5563',
                      textAlign: 'right',
                      fontWeight: '600'
                    }}
                  >
                    {currency} {service.unit_price.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#374151',
                      textAlign: 'right',
                      fontWeight: '600'
                    }}
                  >
                    {currency} {service.medical_aid_covered.toFixed(2)}
                  </td>
                  <td
                    style={{
                      padding: '10px',
                      fontSize: '11px',
                      color: '#1f2937',
                      textAlign: 'right',
                      fontWeight: '600'
                    }}
                  >
                    {currency} {service.total_price.toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div
          style={{
            marginTop: '30px',
            paddingTop: '20px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end'
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: '9px',
                color: '#6b7280',
                lineHeight: '1.5'
              }}
            >
              Thank you for your payment. This receipt serves as proof of payment for services rendered by{' '}
              <span style={{ color: '#374151', fontWeight: '600' }}>{practice.name}</span>
              <br />
              For inquiries: {practice.contact_phone} • {practice.contact_email}
            </div>
          </div>
          {practice.logo_url && (
            <div style={{ marginLeft: '20px' }}>
              <img
                src={practice.logo_url}
                alt="Practice Logo"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '4px'
                }}
              />
            </div>
          )}
        </div>

        {/* Page Number */}
        <div
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '0',
            right: '0',
            textAlign: 'center',
            fontSize: '8px',
            color: '#6b7280'
          }}
        >
          Page 1 of 1
        </div>
      </div>
    </div>
  );
};

export default Html2CanvasReceiptPDF;