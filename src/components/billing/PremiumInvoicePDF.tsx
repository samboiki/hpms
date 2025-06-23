import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  pdf
} from '@react-pdf/renderer';
import { format, parseISO } from 'date-fns';
import { generateHeaderGradient, generateSectionColors, generatePaymentColors, getIconColor } from '../../utils/gradientGenerator';

// Premium styles using built-in fonts
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 35,
    fontSize: 10,
    lineHeight: 1.4,
    fontFamily: 'Helvetica',
  },
  // Header Section with gradient
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    paddingBottom: 20,
    paddingTop: 15,
    paddingHorizontal: 20,
    marginHorizontal: -35,
    marginTop: -35,
  },
  practiceSection: {
    flex: 1,
    maxWidth: '55%',
  },
  // Logo removed from header
  practiceInfo: {
    flex: 1,
  },
  practiceName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 3,
    fontFamily: 'Helvetica-Bold',
  },
  practiceTagline: {
    fontSize: 10,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  practiceDetails: {
    fontSize: 8,
    color: '#ffffff',
    lineHeight: 1.2,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  contactText: {
    fontSize: 8,
    color: '#ffffff',
  },
  invoiceSection: {
    flex: 1,
    maxWidth: '40%',
    alignItems: 'flex-end',
  },
  invoiceTitleMedical: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
  },
  invoiceTitleInvoice: {
    fontSize: 28,
    fontWeight: 'normal',
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Helvetica',
  },
  invoiceNumber: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'right',
  },
  dateRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 10,
  },
  dateItem: {
    flex: 1,
    alignItems: 'flex-end',
  },
  dateLabel: {
    fontSize: 7,
    color: 'rgba(255,255,255,0.7)',
    textTransform: 'uppercase',
  },
  dateValue: {
    fontSize: 9,
    color: '#ffffff',
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  // Status badge removed
  // Billing Section
  billingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 25,
    gap: 20,
  },
  billingCard: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Helvetica-Bold',
  },
  cardContent: {
    fontSize: 9,
    color: '#4a5568',
    lineHeight: 1.3,
  },
  patientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 3,
  },
  medicalAidRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  medicalAidText: {
    fontSize: 8,
    color: '#4a5568',
  },
  cardBoldText: {
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 3,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  // Visit Section
  visitSection: {
    backgroundColor: '#f0fff4',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#c6f6d5',
  },
  visitTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#22543d',
    marginBottom: 5,
    fontFamily: 'Helvetica-Bold',
  },
  visitDetails: {
    fontSize: 9,
    color: '#2f855a',
    lineHeight: 1.4,
  },
  // Services Section
  servicesSection: {
    marginBottom: 25,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Helvetica-Bold',
  },
  table: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#01b9d5',
    padding: 10,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    padding: 10,
    minHeight: 35,
  },
  tableRowEven: {
    backgroundColor: '#f8fafc',
  },
  headerCell: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#ffffff',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    fontFamily: 'Helvetica-Bold',
  },
  cell: {
    fontSize: 9,
    color: '#4a5568',
  },
  cellBold: {
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  cellCode: {
    width: '12%',
    fontWeight: 'bold',
    color: '#1a365d',
  },
  cellDescription: {
    width: '38%',
  },
  serviceCode: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#1a365d',
    marginBottom: 2,
    fontFamily: 'Helvetica-Bold',
  },
  serviceDescription: {
    fontSize: 9,
    color: '#4a5568',
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
    color: '#22543d',
  },
  cellTotal: {
    width: '14%',
    textAlign: 'right',
    color: '#1a365d',
  },
  // Summary Section
  summarySection: {
    marginTop: 20,
    alignSelf: 'flex-end',
    width: '55%',
  },
  summaryCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 15,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  summaryRowTotal: {
    backgroundColor: '#01b9d5',
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
    color: '#4a5568',
  },
  summaryLabelTotal: {
    fontSize: 11,
    color: '#ffffff',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  summaryValue: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#1a365d',
    fontFamily: 'Helvetica-Bold',
  },
  summaryValueTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'Helvetica-Bold',
  },
  // Banking Details (compact)
  bankingSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  bankingTitle: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#2d3748',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica-Bold',
  },
  bankingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  bankingRow: {
    flexDirection: 'row',
    width: '48%',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  bankingLabel: {
    fontSize: 8,
    color: '#718096',
    width: '40%',
  },
  bankingValue: {
    fontSize: 8,
    color: '#1a365d',
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
    width: '60%',
  },
  // Footer with logo
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerContent: {
    flex: 1,
  },
  footerText: {
    fontSize: 9,
    color: '#718096',
    lineHeight: 1.5,
  },
  footerBold: {
    color: '#01b9d5',
    fontWeight: 'bold',
    fontFamily: 'Helvetica-Bold',
  },
  footerLogo: {
    width: 40,
    height: 40,
    marginLeft: 20,
  },
  // Page number
  pageNumber: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    textAlign: 'center',
    fontSize: 8,
    color: '#718096',
  },
  // Watermark
  watermark: {
    position: 'absolute',
    top: '45%',
    left: '35%',
    fontSize: 60,
    color: '#f0f9ff',
    fontWeight: 'bold',
    opacity: 0.1,
    transform: 'rotate(-45deg)',
    fontFamily: 'Helvetica-Bold',
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
  website?: string;
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
}

interface PatientInfo {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  medicalAidProvider?: string;
  membershipNumber?: string;
  schemeName?: string;
  medicalAidNumber?: string;
}

interface PremiumInvoicePDFProps {
  invoice: Invoice;
  patient: PatientInfo;
  practice: PracticeInfo;
}

const PremiumInvoicePDF: React.FC<PremiumInvoicePDFProps> = ({
  invoice,
  patient,
  practice,
}) => {
  const currency = practice.country === 'Namibia' ? 'N$' : '$';
  const gradientColors = generateHeaderGradient(practice.primary_color);
  const sectionColors = generateSectionColors(practice.primary_color);
  const primaryColor = practice.primary_color || '#01b9d5';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark for paid invoices */}
        {invoice.payment_status === 'paid' && (
          <Text style={styles.watermark}>PAID</Text>
        )}

        {/* Header with gradient */}
        <View style={[styles.header, { backgroundColor: gradientColors.primary }]}>
          <View style={styles.practiceSection}>
            <View style={styles.practiceInfo}>
              <Text style={[styles.practiceName, { color: '#ffffff' }]}>{practice.name}</Text>
              <Text style={[styles.practiceTagline, { color: 'rgba(255,255,255,0.8)' }]}>Excellence in Healthcare</Text>
            </View>
            <View style={styles.practiceDetails}>
              {practice.address && (
                <View style={styles.contactRow}>
                  <Text style={styles.contactText}>📍 {practice.address}</Text>
                </View>
              )}
              {practice.city && practice.country && (
                <View style={styles.contactRow}>
                  <Text style={styles.contactText}>{practice.city}, {practice.country} {practice.postal_code || ''}</Text>
                </View>
              )}
              {practice.contact_phone && (
                <View style={styles.contactRow}>
                  <Text style={styles.contactText}>📞 {practice.contact_phone}</Text>
                </View>
              )}
              {practice.contact_email && (
                <View style={styles.contactRow}>
                  <Text style={styles.contactText}>✉️ {practice.contact_email}</Text>
                </View>
              )}
              {practice.website && (
                <View style={styles.contactRow}>
                  <Text style={styles.contactText}>🌐 {practice.website}</Text>
                </View>
              )}
            </View>
          </View>
          
          <View style={styles.invoiceSection}>
            <View style={{ flexDirection: 'row' }}>
              <Text style={[styles.invoiceTitleMedical, { color: gradientColors.dark }]}>MEDICAL </Text>
              <Text style={[styles.invoiceTitleInvoice, { color: gradientColors.light }]}>INVOICE</Text>
            </View>
            <Text style={styles.invoiceNumber}>#{invoice.invoice_number}</Text>
            
            {/* Date Row */}
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Date</Text>
                <Text style={styles.dateValue}>
                  {format(parseISO(invoice.created_at), 'dd MMM yyyy')}
                </Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Prepared</Text>
                <Text style={styles.dateValue}>
                  {format(parseISO(invoice.created_at), 'dd MMM yyyy')}
                </Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Due Date</Text>
                <Text style={styles.dateValue}>
                  {format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'dd MMM yyyy')}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Information */}
        <View style={styles.billingSection}>
          <View style={styles.billingCard}>
            <Text style={styles.cardTitle}>Bill To</Text>
            <View style={styles.cardContent}>
              <View style={styles.patientRow}>
                <Text style={styles.cardBoldText}>👤 {patient.name}</Text>
              </View>
              {patient.phone && (
                <View style={styles.patientRow}>
                  <Text>📞 {patient.phone}</Text>
                </View>
              )}
              {patient.email && (
                <View style={styles.patientRow}>
                  <Text>✉️ {patient.email}</Text>
                </View>
              )}
              {patient.address && (
                <View style={styles.patientRow}>
                  <Text>📍 {patient.address}</Text>
                </View>
              )}
            </View>
          </View>

          {patient.medicalAidProvider && (
            <View style={styles.billingCard}>
              <Text style={styles.cardTitle}>Medical Aid Details</Text>
              <View style={styles.cardContent}>
                <View style={styles.medicalAidRow}>
                  <Text style={styles.cardBoldText}>🏥 {patient.medicalAidProvider}</Text>
                </View>
                {patient.schemeName && (
                  <View style={styles.medicalAidRow}>
                    <Text style={styles.medicalAidText}>📋 Scheme: {patient.schemeName}</Text>
                  </View>
                )}
                {patient.medicalAidNumber && (
                  <View style={styles.medicalAidRow}>
                    <Text style={styles.medicalAidText}>🆔 Member: {patient.medicalAidNumber}</Text>
                  </View>
                )}
                <Text style={{ marginTop: 5, color: '#22543d', fontWeight: 'bold' }}>
                  💰 Coverage: {currency} {invoice.medical_aid_covered.toFixed(2)}
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
            <View style={[styles.tableHeader, { backgroundColor: primaryColor }]}>
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
                <View style={styles.cellDescription}>
                  <Text style={styles.serviceCode}>({service.code})</Text>
                  <Text style={styles.serviceDescription}>{service.description}</Text>
                  {service.medical_aid_covered > 0 && (
                    <Text style={[styles.serviceDescription, { fontSize: 7, color: '#22543d', marginTop: 2 }]}>
                      Medical Aid: {currency} {service.medical_aid_covered.toFixed(2)} | Patient: {currency} {service.patient_portion.toFixed(2)}
                    </Text>
                  )}
                </View>
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
                <Text style={[styles.summaryValue, { color: '#22543d' }]}>
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
            
            <View style={[styles.summaryRowTotal, { backgroundColor: primaryColor }]}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelTotal}>Total Amount Due:</Text>
                <Text style={styles.summaryValueTotal}>
                  {currency} {invoice.total.toFixed(2)}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Banking Details */}
        {(practice.bank_name || practice.account_number) && (
          <View style={styles.bankingSection}>
            <Text style={styles.bankingTitle}>Banking Details</Text>
            <View style={styles.bankingGrid}>
              {practice.bank_name && (
                <View style={styles.bankingRow}>
                  <Text style={styles.bankingLabel}>Bank:</Text>
                  <Text style={styles.bankingValue}>{practice.bank_name}</Text>
                </View>
              )}
              {practice.account_number && (
                <View style={styles.bankingRow}>
                  <Text style={styles.bankingLabel}>Account:</Text>
                  <Text style={styles.bankingValue}>{practice.account_number}</Text>
                </View>
              )}
              {practice.branch_code && (
                <View style={styles.bankingRow}>
                  <Text style={styles.bankingLabel}>Branch:</Text>
                  <Text style={styles.bankingValue}>{practice.branch_code}</Text>
                </View>
              )}
              {practice.swift_code && (
                <View style={styles.bankingRow}>
                  <Text style={styles.bankingLabel}>SWIFT:</Text>
                  <Text style={styles.bankingValue}>{practice.swift_code}</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Footer with Logo */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Text style={styles.footerText}>
              Payment is due within 30 days. Thank you for choosing{' '}
              <Text style={styles.footerBold}>{practice.name}</Text>
              {'\n'}For inquiries: {practice.contact_phone} • {practice.contact_email}
            </Text>
          </View>
          {practice.logo_url && (
            <Image style={styles.footerLogo} src={practice.logo_url} />
          )}
        </View>
        
        {/* Page Number */}
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => (
          `Page ${pageNumber} of ${totalPages}`
        )} fixed />
      </Page>
    </Document>
  );
};

// Export function to generate PDF blob
export const generateInvoicePDF = async (
  invoice: Invoice,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<Blob> => {
  try {
    const doc = <PremiumInvoicePDF invoice={invoice} patient={patient} practice={practice} />;
    return await pdf(doc).toBlob();
  } catch (error) {
    console.error('PDF generation error:', error);
    throw error;
  }
};

// Export function to download PDF
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
  } catch (error) {
    console.error('PDF download error:', error);
    throw error;
  }
};

export default PremiumInvoicePDF;