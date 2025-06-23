import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf,
  Font
} from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';

// Font loading with multiple fallback strategies
let fontsRegistered = false;

const registerFonts = async () => {
  if (fontsRegistered) return;
  
  try {
    // Strategy 1: Self-hosted fonts (most reliable)
    Font.register({
      family: 'Montserrat',
      fonts: [
        {
          src: '/fonts/montserrat-regular.ttf',
          fontWeight: 400
        },
        {
          src: '/fonts/montserrat-medium.ttf',
          fontWeight: 500
        },
        {
          src: '/fonts/montserrat-semibold.ttf',
          fontWeight: 600
        },
        {
          src: '/fonts/montserrat-bold.ttf',
          fontWeight: 700
        }
      ]
    });
    
    console.log('✅ Montserrat fonts registered successfully (self-hosted)');
    fontsRegistered = true;
    
  } catch (error) {
    console.warn('⚠️ Self-hosted fonts failed, trying CDN fallback...', error);
    
    try {
      // Strategy 2: jsDelivr CDN fallback
      Font.register({
        family: 'Montserrat',
        fonts: [
          {
            src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.0.18/files/montserrat-latin-400-normal.woff',
            fontWeight: 400
          },
          {
            src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.0.18/files/montserrat-latin-500-normal.woff',
            fontWeight: 500
          },
          {
            src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.0.18/files/montserrat-latin-600-normal.woff',
            fontWeight: 600
          },
          {
            src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5.0.18/files/montserrat-latin-700-normal.woff',
            fontWeight: 700
          }
        ]
      });
      
      console.log('✅ Montserrat fonts registered successfully (CDN fallback)');
      fontsRegistered = true;
      
    } catch (cdnError) {
      console.warn('⚠️ CDN fonts failed, trying Google Fonts...', cdnError);
      
      try {
        // Strategy 3: Google Fonts direct URLs
        Font.register({
          family: 'Montserrat',
          fonts: [
            {
              src: 'https://fonts.gstatic.com/s/montserrat/v25/JTUSjIg1_i6t8kCHKm459Wlhzg.ttf',
              fontWeight: 400
            },
            {
              src: 'https://fonts.gstatic.com/s/montserrat/v25/JTUQjIg1_i6t8kCHKm459WxJwg.ttf',
              fontWeight: 500
            },
            {
              src: 'https://fonts.gstatic.com/s/montserrat/v25/JTUQjIg1_i6t8kCHKm459WxRxg.ttf',
              fontWeight: 600
            },
            {
              src: 'https://fonts.gstatic.com/s/montserrat/v25/JTURjIg1_i6t8kCHKm45_dJE3g.ttf',
              fontWeight: 700
            }
          ]
        });
        
        console.log('✅ Montserrat fonts registered successfully (Google Fonts)');
        fontsRegistered = true;
        
      } catch (googleError) {
        console.error('❌ All font loading strategies failed:', googleError);
        // Will fall back to system fonts in styles
      }
    }
  }
};

// Register fonts immediately
registerFonts();

// Professional styles with proper fallbacks
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 10,
    lineHeight: 1.4,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif', // Fallback chain
  },
  // Header Section with proper spacing
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 35,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: '#6b7280',
  },
  practiceSection: {
    flex: 1,
    maxWidth: '55%',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  logo: {
    width: 50,
    height: 50,
    marginRight: 15,
    borderRadius: 8,
  },
  practiceInfo: {
    flex: 1,
  },
  practiceName: {
    fontSize: 18,
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: 4,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  practiceTagline: {
    fontSize: 11,
    color: '#6b7280',
    marginBottom: 6,
    fontWeight: 400,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  practiceDetails: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  
  // Fixed Invoice Section with proper spacing
  invoiceSection: {
    flex: 1,
    maxWidth: '40%',
    alignItems: 'flex-end',
  },
  invoiceHeader: {
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  invoiceTitle: {
    fontSize: 32,
    fontWeight: 700,
    color: '#374151',
    marginBottom: 15,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
    textAlign: 'right',
    letterSpacing: 1,
  },
  invoiceNumberContainer: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 5,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
    textAlign: 'right',
  },
  invoiceDate: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 12,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
    textAlign: 'right',
  },
  statusBadge: {
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#d1d5db',
    alignSelf: 'flex-end',
  },
  statusText: {
    fontSize: 9,
    fontWeight: 600,
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  
  // Billing Section
  billingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 20,
  },
  billingCard: {
    flex: 1,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  cardContent: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.5,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  cardBoldText: {
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 3,
    fontSize: 10,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  
  // Visit Section
  visitSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  visitTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 5,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  visitDetails: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.4,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  
  // Services Section
  servicesSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  table: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#6b7280',
    padding: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    padding: 10,
    minHeight: 35,
  },
  tableRowEven: {
    backgroundColor: '#f9fafb',
  },
  headerCell: {
    fontSize: 9,
    fontWeight: 600,
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  cell: {
    fontSize: 9,
    color: '#4b5563',
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  cellBold: {
    fontWeight: 600,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  cellCode: {
    width: '12%',
    fontWeight: 600,
    color: '#1f2937',
  },
  cellDescription: {
    width: '38%',
  },
  cellQty: {
    width: '8%',
    textAlign: 'center',
  },
  cellPrice: {
    width: '14%',
    textAlign: 'right',
  },
  cellAid: {
    width: '14%',
    textAlign: 'right',
    color: '#374151',
  },
  cellTotal: {
    width: '14%',
    textAlign: 'right',
    color: '#1f2937',
  },
  
  // Summary Section
  summarySection: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '55%',
  },
  summaryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  summaryRowTotal: {
    backgroundColor: '#374151',
    marginHorizontal: -15,
    marginTop: 10,
    marginBottom: -15,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  summaryLabel: {
    fontSize: 10,
    color: '#4b5563',
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  summaryLabelTotal: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 600,
    textTransform: 'uppercase',
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 600,
    color: '#1f2937',
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  summaryValueTotal: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ffffff',
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  
  // Footer
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    textAlign: 'center',
  },
  footerText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.5,
    fontFamily: 'Montserrat, Helvetica, Arial, sans-serif',
  },
  footerBold: {
    color: '#374151',
    fontWeight: 600,
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
  
  // Watermark
  watermark: {
    position: 'absolute',
    top: '45%',
    left: '35%',
    fontSize: 60,
    color: '#f3f4f6',
    fontWeight: 700,
    opacity: 0.15,
    transform: 'rotate(-45deg)',
    fontFamily: 'Montserrat, Helvetica-Bold, Arial, sans-serif',
  },
});

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

interface ReliableInvoicePDFProps {
  invoice: Invoice;
  patient: PatientInfo;
  practice: PracticeInfo;
}

const ReliableInvoicePDF: React.FC<ReliableInvoicePDFProps> = ({
  invoice,
  patient,
  practice,
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
      case 'pending':
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
      case 'overdue':
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
      default:
        return { bg: '#f3f4f6', text: '#374151', border: '#d1d5db' };
    }
  };

  const statusColors = getStatusColor(invoice.payment_status);
  const currency = practice.country === 'Namibia' ? 'N$' : '$';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark for paid invoices */}
        {invoice.payment_status === 'paid' && (
          <Text style={styles.watermark}>PAID</Text>
        )}

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.practiceSection}>
            <View style={styles.logoRow}>
              {practice.logo_url && (
                <Image style={styles.logo} src={practice.logo_url} />
              )}
              <View style={styles.practiceInfo}>
                <Text style={styles.practiceName}>{practice.name}</Text>
                <Text style={styles.practiceTagline}>Excellence in Healthcare</Text>
              </View>
            </View>
            <View style={styles.practiceDetails}>
              {practice.address && <Text>{practice.address}</Text>}
              {practice.city && practice.country && (
                <Text>{practice.city}, {practice.country} {practice.postal_code || ''}</Text>
              )}
              {practice.contact_phone && <Text>Tel: {practice.contact_phone}</Text>}
              {practice.contact_email && <Text>Email: {practice.contact_email}</Text>}
              {practice.practice_number && <Text>Practice No: {practice.practice_number}</Text>}
              {practice.license_number && <Text>License: {practice.license_number}</Text>}
            </View>
          </View>
          
          <View style={styles.invoiceSection}>
            <View style={styles.invoiceHeader}>
              <Text style={styles.invoiceTitle}>INVOICE</Text>
            </View>
            <View style={styles.invoiceNumberContainer}>
              <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
              <Text style={styles.invoiceDate}>
                Date: {format(parseISO(invoice.created_at), 'dd MMMM yyyy')}
              </Text>
            </View>
            <View style={[
              styles.statusBadge, 
              { 
                backgroundColor: statusColors.bg,
                borderColor: statusColors.border 
              }
            ]}>
              <Text style={[styles.statusText, { color: statusColors.text }]}>
                {invoice.payment_status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* Billing Information */}
        <View style={styles.billingSection}>
          <View style={styles.billingCard}>
            <Text style={styles.cardTitle}>Bill To</Text>
            <View style={styles.cardContent}>
              <Text style={styles.cardBoldText}>{patient.name}</Text>
              {patient.phone && <Text>Phone: {patient.phone}</Text>}
              {patient.email && <Text>Email: {patient.email}</Text>}
              {patient.address && <Text>{patient.address}</Text>}
            </View>
          </View>

          {patient.medicalAidProvider && (
            <View style={styles.billingCard}>
              <Text style={styles.cardTitle}>Medical Aid Details</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardBoldText}>{patient.medicalAidProvider}</Text>
                {patient.membershipNumber && (
                  <Text>Member No: {patient.membershipNumber}</Text>
                )}
                <Text style={{ marginTop: 5, color: '#374151', fontWeight: 'bold' }}>
                  Coverage: {currency} {invoice.medical_aid_covered.toFixed(2)}
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Visit Information */}
        {invoice.visit_date && (
          <View style={styles.visitSection}>
            <Text style={styles.visitTitle}>
              Visit #{invoice.visit_number} - {format(parseISO(invoice.visit_date), 'dd MMMM yyyy')}
            </Text>
            {invoice.chief_complaint && (
              <Text style={styles.visitDetails}>
                Chief Complaint: {invoice.chief_complaint}
              </Text>
            )}
          </View>
        )}

        {/* Services Table */}
        <View style={styles.servicesSection}>
          <Text style={styles.sectionTitle}>Services & Procedures</Text>
          
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={[styles.headerCell, styles.cellCode]}>Code</Text>
              <Text style={[styles.headerCell, styles.cellDescription]}>Description</Text>
              <Text style={[styles.headerCell, styles.cellQty]}>Qty</Text>
              <Text style={[styles.headerCell, styles.cellPrice]}>Unit Price</Text>
              <Text style={[styles.headerCell, styles.cellAid]}>Med Aid</Text>
              <Text style={[styles.headerCell, styles.cellTotal]}>Total</Text>
            </View>

            {invoice.services.map((service, index) => (
              <View 
                key={service.id} 
                style={[
                  styles.tableRow, 
                  index % 2 === 1 ? styles.tableRowEven : {}
                ]}
              >
                <Text style={[styles.cell, styles.cellCode, styles.cellBold]}>{service.code}</Text>
                <Text style={[styles.cell, styles.cellDescription]}>{service.description}</Text>
                <Text style={[styles.cell, styles.cellQty]}>{service.quantity}</Text>
                <Text style={[styles.cell, styles.cellPrice, styles.cellBold]}>
                  {currency} {service.unit_price.toFixed(2)}
                </Text>
                <Text style={[styles.cell, styles.cellAid, styles.cellBold]}>
                  {currency} {service.medical_aid_covered.toFixed(2)}
                </Text>
                <Text style={[styles.cell, styles.cellTotal, styles.cellBold]}>
                  {currency} {service.total_price.toFixed(2)}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Summary */}
        <View style={styles.summarySection}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Subtotal:</Text>
              <Text style={styles.summaryValue}>
                {currency} {invoice.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
              </Text>
            </View>
            
            {invoice.medical_aid_covered > 0 && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Medical Aid Coverage:</Text>
                <Text style={[styles.summaryValue, { color: '#374151' }]}>
                  -{currency} {invoice.medical_aid_covered.toFixed(2)}
                </Text>
              </View>
            )}
            
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Patient Portion:</Text>
              <Text style={styles.summaryValue}>
                {currency} {invoice.patient_portion.toFixed(2)}
              </Text>
            </View>
            
            <View style={styles.summaryRowTotal}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelTotal}>Total Amount Due:</Text>
                <Text style={styles.summaryValueTotal}>
                  {currency} {invoice.total.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Payment is due within 30 days. Thank you for choosing{' '}
            <Text style={styles.footerBold}>{practice.name}</Text>
            {'\n'}For inquiries: {practice.contact_phone} • {practice.contact_email}
          </Text>
        </View>
      </Page>
    </Document>
  );
};

// Export function to generate PDF blob with error handling
export const generateInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<Blob> => {
  try {
    // Ensure fonts are registered before PDF generation
    await registerFonts();
    
    const doc = <ReliableInvoicePDF invoice={invoice} patient={patient} practice={practice} />;
    return await pdf(doc).toBlob();
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`Failed to generate PDF: ${error.message}`);
  }
};

// Export function to download PDF with error handling
export const downloadInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<void> => {
  try {
    const blob = await generateInvoicePDF(invoice, patient, practice);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `invoice-${invoice.invoice_number}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('✅ PDF downloaded successfully');
  } catch (error) {
    console.error('PDF download error:', error);
    throw new Error(`Failed to download PDF: ${error.message}`);
  }
};

export default ReliableInvoicePDF;