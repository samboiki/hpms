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
import { generateHeaderGradient, generateSectionColors, generatePaymentColors, getIconColor } from '../../utils/gradientGenerator';

// Register Montserrat Google Font with proper TTF URLs
Font.register({
  family: 'Montserrat',
  fonts: [
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v12/JTUSjIg1_i6t8kCHKm459Wlhzg.ttf',
      fontWeight: 400
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v12/JTURjIg1_i6t8kCHKm45_bZF3gnD-w.ttf',
      fontWeight: 700
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v12/JTUQjIg1_i6t8kCHKm459WxRxg.ttf',
      fontWeight: 600
    },
    {
      src: 'https://fonts.gstatic.com/s/montserrat/v12/JTUSjIg1_i6t8kCHKm459Wdlzg.ttf',
      fontWeight: 300
    }
  ]
});

// Receipt styles with special payment details color
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 40,
    fontSize: 10,
    lineHeight: 1.4,
    fontFamily: 'Montserrat',
  },
  // Header Section with gradient background
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 35,
    paddingBottom: 20,
    paddingTop: 15,
    paddingHorizontal: 20,
    marginHorizontal: -40,
    marginTop: -40,
  },
  practiceSection: {
    flex: 1,
    maxWidth: '55%',
  },
  practiceInfo: {
    flex: 1,
    marginBottom: 12,
  },
  practiceName: {
    fontSize: 18,
    fontWeight: 700,
    marginBottom: 4,
    fontFamily: 'Montserrat',
  },
  practiceTagline: {
    fontSize: 11,
    marginBottom: 6,
    fontWeight: 400,
    fontFamily: 'Montserrat',
  },
  practiceDetails: {
    fontSize: 9,
    color: '#ffffff',
    lineHeight: 1.2,
    fontFamily: 'Montserrat',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  contactText: {
    fontSize: 9,
    color: '#ffffff',
    fontFamily: 'Montserrat',
  },
  
  // Receipt Section with proper spacing
  receiptSection: {
    flex: 1,
    maxWidth: '40%',
    alignItems: 'flex-end',
  },
  receiptHeader: {
    alignItems: 'flex-end',
    marginBottom: 15,
  },
  receiptTitlePayment: {
    fontSize: 32,
    fontWeight: 900,
    color: '#ffffff',
    fontFamily: 'Montserrat',
  },
  receiptTitleReceipt: {
    fontSize: 32,
    fontWeight: 500,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: 'Montserrat',
  },
  receiptNumber: {
    fontSize: 16,
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: 5,
    fontFamily: 'Montserrat',
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
    fontSize: 8,
    color: 'rgba(255,255,255,0.7)',
    fontFamily: 'Montserrat',
    textTransform: 'uppercase',
  },
  dateValue: {
    fontSize: 10,
    color: '#ffffff',
    fontWeight: 600,
    fontFamily: 'Montserrat',
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
    fontFamily: 'Montserrat',
  },
  cardContent: {
    fontSize: 9,
    color: '#4b5563',
    lineHeight: 1.3,
    fontFamily: 'Montserrat',
  },
  cardBoldText: {
    fontWeight: 600,
    color: '#1f2937',
    marginBottom: 3,
    fontSize: 10,
    fontFamily: 'Montserrat',
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
    color: '#4b5563',
    fontFamily: 'Montserrat',
  },
  
  // Payment Details Section (special #76a5af color)
  paymentDetailsSection: {
    backgroundColor: '#76a5af',
    borderRadius: 8,
    padding: 15,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#5a8893',
  },
  paymentDetailsTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#ffffff',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontFamily: 'Montserrat',
  },
  paymentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 4,
  },
  paymentLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.9)',
    fontFamily: 'Montserrat',
  },
  paymentValue: {
    fontSize: 10,
    fontWeight: 600,
    color: '#ffffff',
    fontFamily: 'Montserrat',
  },
  paymentTotal: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.3)',
    paddingTop: 8,
    marginTop: 8,
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
    fontFamily: 'Montserrat',
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
    fontFamily: 'Montserrat',
  },
  cell: {
    fontSize: 9,
    color: '#4b5563',
    fontFamily: 'Montserrat',
  },
  cellBold: {
    fontWeight: 600,
    fontFamily: 'Montserrat',
  },
  cellCode: {
    width: '12%',
    fontWeight: 600,
    color: '#1f2937',
  },
  cellDescription: {
    width: '38%',
  },
  serviceCode: {
    fontSize: 8,
    fontWeight: 700,
    color: '#1f2937',
    marginBottom: 2,
    fontFamily: 'Montserrat',
  },
  serviceDescription: {
    fontSize: 9,
    color: '#4b5563',
    fontFamily: 'Montserrat',
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
  
  // Banking Details (compact)
  bankingSection: {
    marginTop: 20,
    marginBottom: 20,
  },
  bankingTitle: {
    fontSize: 11,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: 'Montserrat',
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
    color: '#6b7280',
    fontFamily: 'Montserrat',
    width: '40%',
  },
  bankingValue: {
    fontSize: 8,
    color: '#1f2937',
    fontWeight: 600,
    fontFamily: 'Montserrat',
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
    borderTopColor: '#e5e7eb',
  },
  footerContent: {
    flex: 1,
  },
  footerText: {
    fontSize: 9,
    color: '#6b7280',
    lineHeight: 1.5,
    fontFamily: 'Montserrat',
  },
  footerBold: {
    color: '#374151',
    fontWeight: 600,
    fontFamily: 'Montserrat',
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
    color: '#6b7280',
    fontFamily: 'Montserrat',
  },
});

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

interface PaymentReceiptPDFProps {
  payment: Payment;
  patient: PatientInfo;
  practice: PracticeInfo;
}

const PaymentReceiptPDF: React.FC<PaymentReceiptPDFProps> = ({
  payment,
  patient,
  practice,
}) => {
  const currency = practice.country === 'Namibia' ? 'N$' : '$';
  const gradientColors = generateHeaderGradient(practice.primary_color);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
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
          
          <View style={styles.receiptSection}>
            <View style={styles.receiptHeader}>
              <View style={{ flexDirection: 'row' }}>
                <Text style={[styles.receiptTitlePayment, { color: gradientColors.dark }]}>PAYMENT </Text>
                <Text style={[styles.receiptTitleReceipt, { color: gradientColors.light }]}>RECEIPT</Text>
              </View>
            </View>
            <Text style={styles.receiptNumber}>#{payment.receipt_number}</Text>
            
            {/* Date Row */}
            <View style={styles.dateRow}>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Paid Date</Text>
                <Text style={styles.dateValue}>
                  {format(parseISO(payment.payment_date), 'dd MMM yyyy')}
                </Text>
              </View>
              <View style={styles.dateItem}>
                <Text style={styles.dateLabel}>Method</Text>
                <Text style={styles.dateValue}>
                  {payment.payment_method}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Billing Information */}
        <View style={styles.billingSection}>
          <View style={styles.billingCard}>
            <Text style={styles.cardTitle}>Paid By</Text>
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
              </View>
            </View>
          )}
        </View>

        {/* Payment Details Section with special #76a5af color */}
        <View style={styles.paymentDetailsSection}>
          <Text style={styles.paymentDetailsTitle}>Payment Details</Text>
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Total Amount:</Text>
            <Text style={styles.paymentValue}>
              {currency} {payment.services.reduce((sum, s) => sum + s.total_price, 0).toFixed(2)}
            </Text>
          </View>
          
          {payment.medical_aid_covered > 0 && (
            <View style={styles.paymentRow}>
              <Text style={styles.paymentLabel}>Medical Aid Coverage:</Text>
              <Text style={styles.paymentValue}>
                {currency} {payment.medical_aid_covered.toFixed(2)}
              </Text>
            </View>
          )}
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Patient Portion:</Text>
            <Text style={styles.paymentValue}>
              {currency} {payment.patient_portion.toFixed(2)}
            </Text>
          </View>
          
          <View style={[styles.paymentRow, styles.paymentTotal]}>
            <Text style={[styles.paymentLabel, { fontWeight: 700, fontSize: 12 }]}>Amount Paid:</Text>
            <Text style={[styles.paymentValue, { fontWeight: 700, fontSize: 14 }]}>
              {currency} {payment.amount_paid.toFixed(2)}
            </Text>
          </View>
          
          <View style={styles.paymentRow}>
            <Text style={styles.paymentLabel}>Payment Method:</Text>
            <Text style={styles.paymentValue}>{payment.payment_method}</Text>
          </View>
        </View>

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

            {payment.services.map((service, index) => (
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

        {/* Footer with Logo */}
        <View style={styles.footer}>
          <View style={styles.footerContent}>
            <Text style={styles.footerText}>
              Thank you for your payment. This receipt serves as proof of payment for services rendered by{' '}
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
export const generateReceiptPDF = async (
  payment: Payment,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<Blob> => {
  try {
    const doc = <PaymentReceiptPDF payment={payment} patient={patient} practice={practice} />;
    return await pdf(doc).toBlob();
  } catch (error) {
    console.error('Receipt PDF generation error:', error);
    throw error;
  }
};

// Export function to download PDF
export const downloadReceiptPDF = async (
  payment: Payment,
  patient: PatientInfo,
  practice: PracticeInfo
): Promise<void> => {
  try {
    const blob = await generateReceiptPDF(payment, patient, practice);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `receipt-${payment.receipt_number}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Receipt PDF download error:', error);
    throw error;
  }
};

export default PaymentReceiptPDF;